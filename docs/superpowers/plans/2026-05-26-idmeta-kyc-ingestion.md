# IDMeta KYC Verification & Document Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an API-driven IDMeta identity-verification path to `/lawyer/kyc` (alongside manual upload) that ingests the selfie + ID IDMeta captured into our own S3 as `kyc_document` rows and reconciles the submission status.

**Architecture:** A new `@ligala/kyc` workspace package holds the IDMeta REST client, a recursive image extractor, the S3 ingestion routine, and an SQS producer — so both `apps/api` (webhook, inline in dev) and `workers/idmeta` (SQS, prod) share one `ingestIdmetaResult()`. A lawyer clicks "Verify with IDMeta" → `POST /lawyers/kyc/idmeta/start` creates an IDMeta verification carrying our `submissionId` in `metadata` and returns a hosted URL opened in a new tab → on completion IDMeta calls `POST /webhooks/idmeta` → we map by `verification_id`, pull images from the webhook's `verification_results` (finalize as backstop), upload to S3, write `kyc_document` rows, update status.

**Tech Stack:** TypeScript, Hono (api), Drizzle/Postgres, `@aws-sdk/client-s3` + `@aws-sdk/client-sqs`, Next.js 15 App Router (web), Vitest, esbuild (workers). Spec: `docs/superpowers/specs/2026-05-26-idmeta-kyc-ingestion-design.md`.

**Conventions to respect (from CLAUDE.md):**
- `noUncheckedIndexedAccess` is on — array/record reads are `T | undefined`, handle it (no `!`).
- Type-only imports use `import type`.
- Scoped `git add` touching any `package.json` MUST also stage `pnpm-lock.yaml`.
- Money is integer cents (not relevant here, but don't introduce floats).
- Run from repo root; `pnpm --filter <pkg> <script>` to narrow.

---

## Task 1: Scaffold the `@ligala/kyc` package

**Files:**
- Create: `packages/kyc/package.json`
- Create: `packages/kyc/tsconfig.json`
- Create: `packages/kyc/src/index.ts`
- Modify: `apps/api/package.json` (add dependency)
- Modify: `workers/package.json` (add dependency)

- [ ] **Step 1: Create `packages/kyc/package.json`**

```json
{
  "name": "@ligala/kyc",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run --passWithNoTests",
    "clean": "rm -rf .turbo"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.700.0",
    "@aws-sdk/client-sqs": "^3.700.0",
    "@ligala/db": "workspace:*",
    "@ligala/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^20.16.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `packages/kyc/tsconfig.json`** (mirrors `packages/email/tsconfig.json`, no JSX)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "noEmit": true,
    "lib": ["dom", "ES2022"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `packages/kyc/src/index.ts`** (placeholder; real exports added in later tasks)

```ts
export {};
```

- [ ] **Step 4: Add `@ligala/kyc` to `apps/api/package.json` dependencies**

In `apps/api/package.json`, add to `"dependencies"` (after the `@ligala/email` line):

```json
    "@ligala/kyc": "workspace:*",
```

- [ ] **Step 5: Add `@ligala/kyc` to `workers/package.json` dependencies**

In `workers/package.json`, add to `"dependencies"` (after the `@ligala/email` line):

```json
    "@ligala/kyc": "workspace:*",
```

- [ ] **Step 6: Install so the workspace link + lockfile update**

Run: `pnpm install`
Expected: completes; `pnpm-lock.yaml` updated; `@ligala/kyc` linked into `apps/api` and `workers`.

- [ ] **Step 7: Typecheck the new package**

Run: `pnpm --filter @ligala/kyc typecheck`
Expected: PASS (no errors).

- [ ] **Step 8: Commit**

```bash
git add packages/kyc apps/api/package.json workers/package.json pnpm-lock.yaml
git commit -m "chore(kyc): scaffold @ligala/kyc package"
```

---

## Task 2: Add `method` column + `kycMethod` enum to the schema

**Files:**
- Modify: `packages/db/src/schema/kyc.ts`
- Create (generated): `packages/db/drizzle/NNNN_*.sql`

- [ ] **Step 1: Add the enum + column in `packages/db/src/schema/kyc.ts`**

Add the enum next to the existing `kycStatus` / `kycDocumentKind` enums (after line ~22):

```ts
export const kycMethod = pgEnum("kyc_method", ["upload", "idmeta"]);
```

Add the column to `kycSubmissions` (inside `pgTable("kyc_submission", { ... })`, after the `status` field):

```ts
  method: kycMethod("method").default("upload").notNull(),
```

- [ ] **Step 2: Generate the migration**

Run: `pnpm db:generate`
Expected: a new file `packages/db/drizzle/NNNN_*.sql` is written containing `CREATE TYPE "public"."kyc_method"` and `ALTER TABLE "kyc_submission" ADD COLUMN "method" ... DEFAULT 'upload' NOT NULL`.

- [ ] **Step 3: Apply the migration to the dev DB**

Run: `pnpm db:migrate`
Expected: migration applies cleanly (requires `docker compose up -d` Postgres running).

- [ ] **Step 4: Typecheck the db package**

Run: `pnpm --filter @ligala/db typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/kyc.ts packages/db/drizzle
git commit -m "feat(db): add kyc_submission.method (upload|idmeta)"
```

---

## Task 3: Shared schemas — start response + defensive webhook payload

**Files:**
- Modify: `packages/shared/src/schemas/kyc.ts`
- Test: `packages/shared/src/schemas/kyc.test.ts` (create)

- [ ] **Step 1: Write the failing test** — create `packages/shared/src/schemas/kyc.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { idmetaWebhookPayload, idmetaStartResponse } from "./kyc";

describe("idmetaWebhookPayload", () => {
  it("parses the confirmed IDMeta webhook shape and keeps unknown fields out of the way", () => {
    const parsed = idmetaWebhookPayload.parse({
      id: "ver_123",
      company_id: "co_1",
      template_id: "tpl_1",
      status: "REVIEW_NEEDED",
      metadata: { submissionId: "sub_1" },
      profile_name: "JOHN DOE",
      verification_results: { document_verification: { request_data: {} } },
      some_future_field: true,
    });
    expect(parsed.id).toBe("ver_123");
    expect(parsed.status).toBe("REVIEW_NEEDED");
    expect(parsed.metadata).toEqual({ submissionId: "sub_1" });
  });

  it("accepts verification_id as an alias for id", () => {
    const parsed = idmetaWebhookPayload.parse({ verification_id: "ver_9" });
    expect(parsed.id).toBe("ver_9");
  });

  it("rejects a payload with neither id nor verification_id", () => {
    expect(idmetaWebhookPayload.safeParse({ status: "VERIFIED" }).success).toBe(false);
  });
});

describe("idmetaStartResponse", () => {
  it("requires hostedUrl + submissionId", () => {
    expect(
      idmetaStartResponse.parse({ hostedUrl: "https://x/y", submissionId: "sub_1" }),
    ).toEqual({ hostedUrl: "https://x/y", submissionId: "sub_1" });
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @ligala/shared test -- kyc`
Expected: FAIL (`idmetaStartResponse` not exported; webhook shape mismatch).

- [ ] **Step 3: Rewrite the IDMeta schemas in `packages/shared/src/schemas/kyc.ts`**

Replace the existing `idmetaWebhookPayload` block (lines ~26-36) with:

```ts
/**
 * IDMeta verification webhook. Confirmed shape (Postman collection): the
 * webhook delivers `id` (= the verification id), a string `status`, the
 * `metadata` we set at create time (echoed back), and `verification_results`
 * carrying the captured document/biometric data. We model the minimum and
 * keep everything else permissive — IDMeta may add fields, and the image
 * extraction scans `verification_results` structurally rather than by path.
 */
export const idmetaWebhookPayload = z
  .object({
    // Some IDMeta surfaces use `id`, others `verification_id`. Accept both,
    // normalize to `id`.
    id: z.string().min(1).optional(),
    verification_id: z.string().min(1).optional(),
    company_id: z.union([z.string(), z.number()]).optional(),
    template_id: z.union([z.string(), z.number()]).optional(),
    status: z.union([z.string(), z.number()]).optional(),
    status_message: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
    profile_name: z.string().optional(),
    verification_results: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .passthrough()
  .transform((p) => ({ ...p, id: p.id ?? p.verification_id }))
  .refine((p) => typeof p.id === "string" && p.id.length > 0, {
    message: "missing verification id",
  });

export type IdmetaWebhookPayload = z.infer<typeof idmetaWebhookPayload>;

/** Response of POST /lawyers/kyc/idmeta/start — the URL the browser opens. */
export const idmetaStartResponse = z.object({
  hostedUrl: z.string().url(),
  submissionId: z.string().min(1),
});

export type IdmetaStartResponse = z.infer<typeof idmetaStartResponse>;
```

(Leave the existing `kycDocumentKind` and `kycSubmissionInput` exports untouched.)

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @ligala/shared test -- kyc`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schemas/kyc.ts packages/shared/src/schemas/kyc.test.ts
git commit -m "feat(shared): idmeta start response + defensive webhook payload schema"
```

---

## Task 4: Status mapping (`mapIdmetaStatus`)

**Files:**
- Create: `packages/kyc/src/status.ts`
- Test: `packages/kyc/src/status.test.ts`

- [ ] **Step 1: Write the failing test** — create `packages/kyc/src/status.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { mapIdmetaStatus } from "./status";

describe("mapIdmetaStatus", () => {
  it("maps confirmed string statuses", () => {
    expect(mapIdmetaStatus("VERIFIED")).toBe("approved");
    expect(mapIdmetaStatus("REJECTED")).toBe("rejected");
    expect(mapIdmetaStatus("FAILED")).toBe("rejected");
    expect(mapIdmetaStatus("REVIEW_NEEDED")).toBe("submitted");
    expect(mapIdmetaStatus("INCOMPLETE")).toBe("pending");
    expect(mapIdmetaStatus("IN_PROGRESS")).toBe("pending");
    expect(mapIdmetaStatus("EMPTY")).toBe("pending");
  });

  it("maps confirmed numeric codes", () => {
    expect(mapIdmetaStatus(3)).toBe("approved");
    expect(mapIdmetaStatus(1)).toBe("rejected");
    expect(mapIdmetaStatus(6)).toBe("rejected");
    expect(mapIdmetaStatus(2)).toBe("submitted");
    expect(mapIdmetaStatus(4)).toBe("pending");
    expect(mapIdmetaStatus(5)).toBe("pending");
    expect(mapIdmetaStatus(99)).toBe("pending");
  });

  it("is case-insensitive and tolerant of whitespace", () => {
    expect(mapIdmetaStatus(" verified ")).toBe("approved");
  });

  it("defaults unknown values to submitted (surfaces for admin review)", () => {
    expect(mapIdmetaStatus("WHATEVER")).toBe("submitted");
    expect(mapIdmetaStatus(42)).toBe("submitted");
    expect(mapIdmetaStatus(undefined)).toBe("submitted");
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @ligala/kyc test -- status`
Expected: FAIL (`./status` not found).

- [ ] **Step 3: Implement `packages/kyc/src/status.ts`**

```ts
export type KycStatus = "pending" | "submitted" | "approved" | "rejected";

// IDMeta status codes (confirmed via Postman collection):
//   1 Rejected · 2 Review Needed · 3 Verified · 4 Incomplete
//   5 In Progress · 6 Failed · 99 Empty (created, no actions)
const BY_CODE: Record<number, KycStatus> = {
  1: "rejected",
  2: "submitted",
  3: "approved",
  4: "pending",
  5: "pending",
  6: "rejected",
  99: "pending",
};

const BY_NAME: Record<string, KycStatus> = {
  REJECTED: "rejected",
  REVIEW_NEEDED: "submitted",
  VERIFIED: "approved",
  INCOMPLETE: "pending",
  IN_PROGRESS: "pending",
  FAILED: "rejected",
  EMPTY: "pending",
};

/**
 * Normalize an IDMeta status (string message like "REVIEW_NEEDED" or numeric
 * code) to our kyc_status. Unknown values default to "submitted" so a
 * verification we can't classify still surfaces for manual admin review rather
 * than silently approving/rejecting.
 */
export function mapIdmetaStatus(status: string | number | undefined): KycStatus {
  if (typeof status === "number") return BY_CODE[status] ?? "submitted";
  if (typeof status === "string") {
    const key = status.trim().toUpperCase();
    return BY_NAME[key] ?? "submitted";
  }
  return "submitted";
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @ligala/kyc test -- status`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/kyc/src/status.ts packages/kyc/src/status.test.ts
git commit -m "feat(kyc): IDMeta status -> kyc_status mapping"
```

---

## Task 5: Recursive image extractor (`extractImages`)

**Files:**
- Create: `packages/kyc/src/extract.ts`
- Test: `packages/kyc/src/extract.test.ts`

- [ ] **Step 1: Write the failing test** — create `packages/kyc/src/extract.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { extractImages } from "./extract";

describe("extractImages", () => {
  it("finds base64 document images and classifies front/back as government_id", () => {
    const results = extractImages({
      verification_results: {
        document_verification: {
          request_data: {
            imageFrontSide: "data:image/jpeg;base64,/9j/AAAA",
            imageBackSide: "data:image/png;base64,iVBORw0AAAA",
          },
        },
      },
    });
    expect(results).toContainEqual({
      kind: "government_id",
      ref: "data:image/jpeg;base64,/9j/AAAA",
    });
    expect(results.filter((r) => r.kind === "government_id")).toHaveLength(2);
  });

  it("classifies face/selfie image URLs as selfie", () => {
    const results = extractImages({
      verification_results: {
        biometric_verification: {
          request_result: { face_url: "https://idmeta.example/s3/faces/abc.jpg" },
        },
      },
    });
    expect(results).toContainEqual({
      kind: "selfie",
      ref: "https://idmeta.example/s3/faces/abc.jpg",
    });
  });

  it("ignores non-image strings and dedupes identical refs", () => {
    const results = extractImages({
      profile_name: "JOHN DOE",
      status: "VERIFIED",
      a: { photo: "https://x/p.jpg" },
      b: { photo: "https://x/p.jpg" },
    });
    expect(results).toEqual([{ kind: "selfie", ref: "https://x/p.jpg" }]);
  });

  it("returns [] for null / empty input", () => {
    expect(extractImages(null)).toEqual([]);
    expect(extractImages({})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @ligala/kyc test -- extract`
Expected: FAIL (`./extract` not found).

- [ ] **Step 3: Implement `packages/kyc/src/extract.ts`**

```ts
export type ExtractedImageKind = "selfie" | "government_id";
export interface ExtractedImage {
  kind: ExtractedImageKind;
  /** Either an http(s) URL or a `data:image/...;base64,...` string. */
  ref: string;
}

// Key-name hints → document kind. Checked as a lowercased substring of the key.
const SELFIE_HINTS = ["face", "selfie", "photo", "liveness", "portrait"];
const DOCUMENT_HINTS = ["front", "back", "document", "doc", "id", "passport", "license"];

function isImageRef(value: string): boolean {
  if (value.startsWith("data:image/")) return true;
  if (!/^https?:\/\//i.test(value)) return false;
  // URL without an obvious non-image extension is still accepted (IDMeta S3
  // URLs often omit extensions); only reject clearly non-image doc types.
  return !/\.(pdf|json|xml|txt|csv)(\?|$)/i.test(value);
}

function classify(key: string): ExtractedImageKind | null {
  const k = key.toLowerCase();
  if (SELFIE_HINTS.some((h) => k.includes(h))) return "selfie";
  if (DOCUMENT_HINTS.some((h) => k.includes(h))) return "government_id";
  return null;
}

/**
 * Recursively scan an arbitrary IDMeta result object for captured images.
 * IDMeta nests images under per-check keys (e.g.
 * verification_results.document_verification.request_data.imageFrontSide) and
 * the exact path varies by template, so we walk the whole tree and classify by
 * the key the image string sits under. Deduped by ref.
 */
export function extractImages(source: unknown): ExtractedImage[] {
  const out: ExtractedImage[] = [];
  const seen = new Set<string>();

  const walk = (node: unknown, key: string): void => {
    if (node == null) return;
    if (typeof node === "string") {
      if (!isImageRef(node) || seen.has(node)) return;
      const kind = classify(key);
      if (!kind) return;
      seen.add(node);
      out.push({ kind, ref: node });
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item, key);
      return;
    }
    if (typeof node === "object") {
      for (const [childKey, value] of Object.entries(node as Record<string, unknown>)) {
        walk(value, childKey);
      }
    }
  };

  walk(source, "");
  return out;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @ligala/kyc test -- extract`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/kyc/src/extract.ts packages/kyc/src/extract.test.ts
git commit -m "feat(kyc): recursive image extractor for IDMeta results"
```

---

## Task 6: IDMeta REST client (`createVerification`, `finalizeVerification`, `hostedUrlFor`, `fetchDocumentBytes`)

**Files:**
- Create: `packages/kyc/src/idmeta.ts`
- Test: `packages/kyc/src/idmeta.test.ts`

- [ ] **Step 1: Write the failing test** — create `packages/kyc/src/idmeta.test.ts`

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createVerification,
  finalizeVerification,
  hostedUrlFor,
  fetchDocumentBytes,
} from "./idmeta";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.IDMETA_BASE_URL = "https://integrate.idmetagroup.com";
  process.env.IDMETA_TOKEN = "tok_test";
  process.env.IDMETA_TEMPLATE_ID = "tpl_42";
  process.env.IDMETA_HOSTED_URL =
    "https://web-sdk.idmetagroup.com/?templateId=abc&k=sig&u=314";
});
afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.restoreAllMocks();
});

describe("createVerification", () => {
  it("POSTs template_id + metadata with the bearer token and returns the verification id", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ verification: { id: "ver_1", status: 99 } }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const res = await createVerification({ submissionId: "sub_1" });

    expect(res.verificationId).toBe("ver_1");
    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(
      "https://integrate.idmetagroup.com/api/v1/verification/create-verification",
    );
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok_test");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      template_id: "tpl_42",
      metadata: { submissionId: "sub_1" },
    });
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 403, text: async () => "expired" })),
    );
    await expect(createVerification({ submissionId: "s" })).rejects.toThrow(/403/);
  });
});

describe("finalizeVerification", () => {
  it("POSTs template_id + verification_id and returns the parsed body", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ status: 2, status_message: "REVIEW_NEEDED", verification: { id: "ver_1" } }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await finalizeVerification("ver_1");
    expect(res.status_message).toBe("REVIEW_NEEDED");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/finalize-verification");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      template_id: "tpl_42",
      verification_id: "ver_1",
    });
  });
});

describe("hostedUrlFor", () => {
  it("uses a session URL from the create response when present", () => {
    expect(hostedUrlFor("ver_1", { url: "https://web-sdk.idmetagroup.com/session/xyz" })).toBe(
      "https://web-sdk.idmetagroup.com/session/xyz",
    );
  });

  it("otherwise appends verification_id to the configured hosted link", () => {
    const out = hostedUrlFor("ver_1", {});
    expect(out).toContain("https://web-sdk.idmetagroup.com/?templateId=abc");
    expect(out).toContain("verification_id=ver_1");
  });
});

describe("fetchDocumentBytes", () => {
  it("decodes a base64 data: URL without a network call", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    // "hi" base64 = aGk=
    const { bytes, contentType } = await fetchDocumentBytes("data:image/png;base64,aGk=");
    expect(contentType).toBe("image/png");
    expect(Buffer.from(bytes).toString()).toBe("hi");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("downloads an http URL and reports its content-type", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: { get: (h: string) => (h.toLowerCase() === "content-type" ? "image/jpeg" : null) },
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      })),
    );
    const { bytes, contentType } = await fetchDocumentBytes("https://x/y.jpg");
    expect(contentType).toBe("image/jpeg");
    expect(bytes.length).toBe(3);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @ligala/kyc test -- idmeta`
Expected: FAIL (`./idmeta` not found).

- [ ] **Step 3: Implement `packages/kyc/src/idmeta.ts`**

```ts
const DEFAULT_BASE_URL = "https://integrate.idmetagroup.com";

function baseUrl(): string {
  return (process.env.IDMETA_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
}

function token(): string {
  const t = process.env.IDMETA_TOKEN;
  if (!t) throw new Error("IDMETA_TOKEN is not configured");
  return t;
}

function templateId(): string {
  const t = process.env.IDMETA_TEMPLATE_ID;
  if (!t) throw new Error("IDMETA_TEMPLATE_ID is not configured");
  return t;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`idmeta ${path} failed: ${res.status} ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export interface CreateVerificationResult {
  verificationId: string;
  /** Full parsed response — `hostedUrlFor` inspects it for a session URL. */
  raw: Record<string, unknown>;
}

/** create-verification: stash our submissionId in metadata so it round-trips. */
export async function createVerification(opts: {
  submissionId: string;
}): Promise<CreateVerificationResult> {
  const raw = await post<Record<string, unknown>>(
    "/api/v1/verification/create-verification",
    { template_id: templateId(), metadata: { submissionId: opts.submissionId } },
  );
  const verification = (raw.verification ?? {}) as { id?: unknown };
  const id = typeof verification.id === "string" ? verification.id : undefined;
  if (!id) throw new Error("idmeta create-verification returned no verification id");
  return { verificationId: id, raw };
}

/** finalize-verification: authoritative status/result backstop. */
export async function finalizeVerification(
  verificationId: string,
): Promise<Record<string, unknown>> {
  return post<Record<string, unknown>>("/api/v1/verification/finalize-verification", {
    template_id: templateId(),
    verification_id: verificationId,
  });
}

/**
 * Build the URL the lawyer opens. SANDBOX-CONFIRM (spec §11.1): if create
 * returns a ready session URL we use it; otherwise we append the verification
 * id to the configured Trust Flow link. The exact param name may need
 * adjusting once confirmed against the live dashboard.
 */
export function hostedUrlFor(
  verificationId: string,
  createRaw: Record<string, unknown>,
): string {
  const sessionUrl = createRaw.url ?? createRaw.verification_url ?? createRaw.hosted_url;
  if (typeof sessionUrl === "string" && sessionUrl.length > 0) return sessionUrl;

  const base = process.env.IDMETA_HOSTED_URL;
  if (!base) throw new Error("IDMETA_HOSTED_URL is not configured");
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}verification_id=${encodeURIComponent(verificationId)}`;
}

export interface DocumentBytes {
  bytes: Uint8Array;
  contentType: string;
}

/** Resolve an image ref (http URL or data: URL) to raw bytes + content type. */
export async function fetchDocumentBytes(ref: string): Promise<DocumentBytes> {
  if (ref.startsWith("data:")) {
    const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(ref);
    if (!match) throw new Error("malformed data URL");
    const contentType = match[1] || "application/octet-stream";
    const isBase64 = !!match[2];
    const data = match[3] ?? "";
    const bytes = isBase64
      ? new Uint8Array(Buffer.from(data, "base64"))
      : new Uint8Array(Buffer.from(decodeURIComponent(data), "utf-8"));
    return { bytes, contentType };
  }
  const res = await fetch(ref);
  if (!res.ok) throw new Error(`download failed: ${res.status} ${ref.slice(0, 120)}`);
  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const buf = await res.arrayBuffer();
  return { bytes: new Uint8Array(buf), contentType };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @ligala/kyc test -- idmeta`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/kyc/src/idmeta.ts packages/kyc/src/idmeta.test.ts
git commit -m "feat(kyc): IDMeta REST client (create/finalize/hostedUrl/fetch)"
```

---

## Task 7: SQS producer (`enqueueIdmetaIngest`) + webhook signature verifier

**Files:**
- Create: `packages/kyc/src/queue.ts`
- Create: `packages/kyc/src/signature.ts`
- Test: `packages/kyc/src/queue.test.ts`
- Test: `packages/kyc/src/signature.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/kyc/src/queue.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const send = vi.fn();
vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: vi.fn(() => ({ send })),
  SendMessageCommand: vi.fn((input) => ({ input })),
}));

import { enqueueIdmetaIngest } from "./queue";

beforeEach(() => {
  send.mockReset();
  delete process.env.IDMETA_QUEUE_URL;
});

describe("enqueueIdmetaIngest", () => {
  it("no-ops when IDMETA_QUEUE_URL is unset", async () => {
    await enqueueIdmetaIngest({ verificationId: "ver_1" });
    expect(send).not.toHaveBeenCalled();
  });

  it("sends a SendMessage with the verificationId body when configured", async () => {
    process.env.IDMETA_QUEUE_URL = "https://sqs/idmeta";
    send.mockResolvedValue({});
    await enqueueIdmetaIngest({ verificationId: "ver_1" });
    expect(send).toHaveBeenCalledTimes(1);
    const cmd = send.mock.calls[0]?.[0] as { input: { MessageBody: string } };
    expect(JSON.parse(cmd.input.MessageBody)).toMatchObject({ verificationId: "ver_1" });
  });
});
```

Create `packages/kyc/src/signature.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyIdmetaSignature } from "./signature";

const secret = "whsec_test";
const body = JSON.stringify({ id: "ver_1", status: "VERIFIED" });
const goodSig = createHmac("sha256", secret).update(body).digest("hex");

describe("verifyIdmetaSignature", () => {
  it("returns true when no secret is configured (dev skip)", () => {
    expect(verifyIdmetaSignature(body, goodSig, undefined)).toBe(true);
  });
  it("accepts a valid HMAC-SHA256 hex signature", () => {
    expect(verifyIdmetaSignature(body, goodSig, secret)).toBe(true);
  });
  it("rejects a bad signature", () => {
    expect(verifyIdmetaSignature(body, "deadbeef", secret)).toBe(false);
  });
  it("rejects a missing signature when a secret is set", () => {
    expect(verifyIdmetaSignature(body, null, secret)).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `pnpm --filter @ligala/kyc test -- queue signature`
Expected: FAIL (`./queue` / `./signature` not found).

- [ ] **Step 3: Implement `packages/kyc/src/queue.ts`**

```ts
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

export interface IdmetaIngestMessage {
  verificationId: string;
}

let client: SQSClient | null = null;
function sqs(): SQSClient {
  if (!client) client = new SQSClient({ region: process.env.AWS_REGION ?? "ap-southeast-1" });
  return client;
}

/** Enqueue an ingest job. No-ops (logs) when IDMETA_QUEUE_URL is unset so the
 *  api can import this in any runtime without throwing. */
export async function enqueueIdmetaIngest(msg: IdmetaIngestMessage): Promise<void> {
  const url = process.env.IDMETA_QUEUE_URL;
  if (!url) {
    console.warn("[kyc] IDMETA_QUEUE_URL unset; skipping enqueue", msg.verificationId);
    return;
  }
  await sqs().send(new SendMessageCommand({ QueueUrl: url, MessageBody: JSON.stringify(msg) }));
}
```

- [ ] **Step 4: Implement `packages/kyc/src/signature.ts`**

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify an IDMeta webhook signature (HMAC-SHA256 hex over the raw body).
 * SANDBOX-CONFIRM (spec §11.2): header name + encoding are assumed; adjust the
 * caller's header lookup once confirmed. When no secret is configured we skip
 * verification (dev), matching the PayMongo webhook's "not configured" stance.
 */
export function verifyIdmetaSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string | undefined,
): boolean {
  if (!secret) return true; // dev / not configured
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 5: Run the tests to confirm they pass**

Run: `pnpm --filter @ligala/kyc test -- queue signature`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/kyc/src/queue.ts packages/kyc/src/signature.ts packages/kyc/src/queue.test.ts packages/kyc/src/signature.test.ts
git commit -m "feat(kyc): SQS ingest producer + webhook signature verifier"
```

---

## Task 8: Ingestion routine (`ingestIdmetaResult`) + S3 helper

**Files:**
- Create: `packages/kyc/src/s3.ts`
- Create: `packages/kyc/src/ingest.ts`
- Test: `packages/kyc/src/ingest.test.ts`

- [ ] **Step 1: Write the failing test** — create `packages/kyc/src/ingest.test.ts`

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- S3 mock ---------------------------------------------------------------
const s3Send = vi.fn();
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => ({ send: s3Send })),
  PutObjectCommand: vi.fn((input) => ({ input })),
}));

// --- IDMeta client mock (finalize backstop not needed; images come from arg) ---
vi.mock("./idmeta", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./idmeta")>();
  return {
    ...actual,
    finalizeVerification: vi.fn(async () => ({ status: 3, status_message: "VERIFIED" })),
    fetchDocumentBytes: vi.fn(async () => ({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "image/jpeg",
    })),
  };
});

// --- DB mock ---------------------------------------------------------------
const docInserts: unknown[] = [];
const submissionUpdates: unknown[] = [];
let submission: { id: string; lawyerId: string; idmetaApplicantId: string | null } | null;
let existingDocs: { kind: string }[];

vi.mock("@ligala/db", () => {
  const insertValues = vi.fn(async (rows: unknown) => {
    docInserts.push(rows);
  });
  return {
    db: () => ({
      query: {
        kycSubmissions: { findFirst: vi.fn(async () => submission) },
        kycDocuments: { findMany: vi.fn(async () => existingDocs) },
      },
      insert: vi.fn(() => ({ values: insertValues })),
      update: vi.fn(() => ({ set: (v: unknown) => ({ where: vi.fn(async () => { submissionUpdates.push(v); }) }) })),
      select: vi.fn(),
    }),
    schema: {
      kycSubmissions: { idmetaApplicantId: "idmeta_applicant_id", id: "id" },
      kycDocuments: { submissionId: "submission_id" },
    },
  };
});

import { ingestIdmetaResult } from "./ingest";

const webhookResults = {
  document_verification: {
    request_data: { imageFrontSide: "data:image/jpeg;base64,/9j/AAAA" },
  },
  biometric_verification: { request_result: { face_url: "https://x/face.jpg" } },
};

beforeEach(() => {
  docInserts.length = 0;
  submissionUpdates.length = 0;
  s3Send.mockReset().mockResolvedValue({});
  submission = { id: "sub_1", lawyerId: "usr_1", idmetaApplicantId: "ver_1" };
  existingDocs = [];
  process.env.S3_UPLOADS_BUCKET = "test-bucket";
});
afterEach(() => {
  delete process.env.S3_UPLOADS_BUCKET;
  vi.clearAllMocks();
});

describe("ingestIdmetaResult", () => {
  it("uploads each captured image to S3 and inserts kyc_document rows, updating status", async () => {
    const res = await ingestIdmetaResult({
      verificationId: "ver_1",
      status: "VERIFIED",
      verificationResults: webhookResults,
    });
    expect(res.ingestedDocuments).toBe(2); // front ID + face selfie
    expect(s3Send).toHaveBeenCalledTimes(2);
    // both kinds present
    const rows = docInserts.flat() as { kind: string; s3Key: string }[];
    const kinds = rows.map((r) => r.kind).sort();
    expect(kinds).toEqual(["government_id", "selfie"]);
    expect(rows.every((r) => r.s3Key.startsWith("kyc_document/usr_1/"))).toBe(true);
    expect(submissionUpdates[0]).toMatchObject({ status: "approved" });
  });

  it("is idempotent: re-running with documents already present uploads nothing new", async () => {
    existingDocs = [{ kind: "government_id" }, { kind: "selfie" }];
    const res = await ingestIdmetaResult({
      verificationId: "ver_1",
      status: "VERIFIED",
      verificationResults: webhookResults,
    });
    expect(res.ingestedDocuments).toBe(0);
    expect(s3Send).not.toHaveBeenCalled();
    // status is still reconciled
    expect(submissionUpdates[0]).toMatchObject({ status: "approved" });
  });

  it("returns notFound when no submission maps to the verification id", async () => {
    submission = null;
    const res = await ingestIdmetaResult({ verificationId: "ver_x" });
    expect(res.notFound).toBe(true);
    expect(s3Send).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @ligala/kyc test -- ingest`
Expected: FAIL (`./ingest` / `./s3` not found).

- [ ] **Step 3: Implement `packages/kyc/src/s3.ts`**

```ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

let s3: S3Client | null = null;
function client(): S3Client {
  if (!s3) s3 = new S3Client({ region: process.env.AWS_REGION ?? "ap-southeast-1" });
  return s3;
}

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/**
 * Upload an ingested KYC document to the uploads bucket under the per-lawyer
 * prefix the rest of the app already expects (kyc_document/<lawyerId>/...).
 * Returns the S3 key, or null when no bucket is configured (dev) — the caller
 * skips the DB row in that case.
 */
export async function putKycDocument(
  lawyerId: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string | null> {
  const bucket = process.env.S3_UPLOADS_BUCKET;
  if (!bucket) {
    console.warn("[kyc] S3_UPLOADS_BUCKET unset; skipping ingest upload for", lawyerId);
    return null;
  }
  const ext = EXT_BY_TYPE[contentType.toLowerCase()] ?? "bin";
  const key = `kyc_document/${lawyerId}/${crypto.randomUUID()}.${ext}`;
  await client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      Metadata: { kind: "kyc_document", "user-id": lawyerId, source: "idmeta" },
    }),
  );
  return key;
}
```

- [ ] **Step 4: Implement `packages/kyc/src/ingest.ts`**

```ts
import { eq } from "drizzle-orm";
import { db, schema } from "@ligala/db";
import { extractImages } from "./extract";
import { fetchDocumentBytes, finalizeVerification } from "./idmeta";
import { mapIdmetaStatus, type KycStatus } from "./status";
import { putKycDocument } from "./s3";

export interface IngestInput {
  verificationId: string;
  /** String/numeric status from the webhook, if present. */
  status?: string | number;
  /** `verification_results` from the webhook, if present (primary image source). */
  verificationResults?: unknown;
}

export interface IngestResult {
  notFound?: boolean;
  submissionId?: string;
  status?: KycStatus;
  ingestedDocuments: number;
}

/**
 * Reconcile one IDMeta verification into our KYC tables. Idempotent: maps the
 * verification to a submission (by idmetaApplicantId, then metadata fallback),
 * skips image ingestion when the submission already has documents, and always
 * reconciles the submission status. Shared by the api webhook (inline, dev) and
 * the workers/idmeta Lambda (SQS, prod).
 */
export async function ingestIdmetaResult(input: IngestInput): Promise<IngestResult> {
  const conn = db();

  // 1. Resolve submission. Primary: the verification id we stored at /start.
  let submission = await conn.query.kycSubmissions.findFirst({
    where: eq(schema.kycSubmissions.idmetaApplicantId, input.verificationId),
  });
  // Fallback: a submission whose id equals the verification id (defensive).
  if (!submission) {
    submission = await conn.query.kycSubmissions.findFirst({
      where: eq(schema.kycSubmissions.id, input.verificationId),
    });
  }
  if (!submission) return { notFound: true, ingestedDocuments: 0 };

  // 2. Determine status. Prefer the webhook status; finalize as a backstop.
  let statusValue: string | number | undefined = input.status;
  let results: unknown = input.verificationResults;
  if (statusValue === undefined || results == null) {
    try {
      const finalized = (await finalizeVerification(input.verificationId)) as Record<string, unknown>;
      statusValue ??=
        (finalized.status_message as string | undefined) ??
        (finalized.status as string | number | undefined);
      results ??= finalized.verification_results ?? finalized;
    } catch (err) {
      console.error("[kyc] finalize backstop failed for", input.verificationId, err);
    }
  }
  const status = mapIdmetaStatus(statusValue);

  // 3. Ingest images — skip if this submission already has documents (idempotent).
  let ingestedDocuments = 0;
  const existing = await conn.query.kycDocuments.findMany({
    where: eq(schema.kycDocuments.submissionId, submission.id),
  });
  if (existing.length === 0) {
    const images = extractImages(results);
    const rows: { id: string; submissionId: string; kind: "selfie" | "government_id"; s3Key: string }[] = [];
    for (const img of images) {
      try {
        const { bytes, contentType } = await fetchDocumentBytes(img.ref);
        const key = await putKycDocument(submission.lawyerId, bytes, contentType);
        if (key) rows.push({ id: crypto.randomUUID(), submissionId: submission.id, kind: img.kind, s3Key: key });
      } catch (err) {
        console.error("[kyc] failed to ingest one image for", submission.id, err);
      }
    }
    if (rows.length > 0) {
      await conn.insert(schema.kycDocuments).values(rows);
      ingestedDocuments = rows.length;
    }
  }

  // 4. Reconcile submission status.
  const now = new Date();
  const decided = status === "approved" || status === "rejected";
  await conn
    .update(schema.kycSubmissions)
    .set({
      status,
      idmetaApplicantId: input.verificationId,
      submittedAt: submission.submittedAt ?? now,
      decidedAt: decided ? now : null,
      updatedAt: now,
    })
    .where(eq(schema.kycSubmissions.id, submission.id));

  return { submissionId: submission.id, status, ingestedDocuments };
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `pnpm --filter @ligala/kyc test -- ingest`
Expected: PASS.

- [ ] **Step 6: Run the whole package test + typecheck**

Run: `pnpm --filter @ligala/kyc test && pnpm --filter @ligala/kyc typecheck`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/kyc/src/s3.ts packages/kyc/src/ingest.ts packages/kyc/src/ingest.test.ts
git commit -m "feat(kyc): S3 put + idempotent ingestIdmetaResult"
```

---

## Task 9: Export the package surface

**Files:**
- Modify: `packages/kyc/src/index.ts`

- [ ] **Step 1: Replace `packages/kyc/src/index.ts`**

```ts
export {
  createVerification,
  finalizeVerification,
  hostedUrlFor,
  fetchDocumentBytes,
  type CreateVerificationResult,
} from "./idmeta";
export { ingestIdmetaResult, type IngestInput, type IngestResult } from "./ingest";
export { enqueueIdmetaIngest, type IdmetaIngestMessage } from "./queue";
export { verifyIdmetaSignature } from "./signature";
export { mapIdmetaStatus, type KycStatus } from "./status";
export { extractImages, type ExtractedImage } from "./extract";
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ligala/kyc typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/kyc/src/index.ts
git commit -m "feat(kyc): export package public surface"
```

---

## Task 10: API env vars + `.env.example`

**Files:**
- Modify: `apps/api/src/lib/env.ts`
- Modify: `.env.example`

- [ ] **Step 1: Add IDMeta vars to the schema in `apps/api/src/lib/env.ts`**

Add inside the `z.object({ ... })` (after the `EMAIL_DEV_VERIFY_ENABLED` line):

```ts
  // --- KYC / IDMeta ---
  IDMETA_BASE_URL: z.string().url().default("https://integrate.idmetagroup.com"),
  IDMETA_TOKEN: z.string().optional(),
  IDMETA_TEMPLATE_ID: z.string().optional(),
  IDMETA_WEBHOOK_SECRET: z.string().optional(),
  // Full Trust Flow hosted link (used to build the per-lawyer launch URL, and
  // as the dev fallback when no IDMETA_TOKEN is set).
  IDMETA_HOSTED_URL: z.string().url().optional(),
  // SQS queue for async ingest in prod. Unset => webhook ingests inline (dev).
  IDMETA_QUEUE_URL: z.string().url().optional(),
```

- [ ] **Step 2: Update the `# --- KYC ---` block in `.env.example`**

Replace the existing KYC block:

```
# --- KYC ---
IDMETA_BASE_URL=
IDMETA_TOKEN=
IDMETA_TEMPLATE_ID=
IDMETA_WEBHOOK_SECRET=
```

with:

```
# --- KYC / IDMeta ---
IDMETA_BASE_URL=https://integrate.idmetagroup.com
IDMETA_TOKEN=
IDMETA_TEMPLATE_ID=
IDMETA_WEBHOOK_SECRET=
# Full Trust Flow hosted link. Used to build the per-lawyer launch URL and as
# the dev fallback when IDMETA_TOKEN is unset. Also gates the IDMeta card in web.
IDMETA_HOSTED_URL=
# SQS queue URL for async ingest in prod (unset => inline ingest in the webhook).
IDMETA_QUEUE_URL=
```

- [ ] **Step 3: Typecheck the api**

Run: `pnpm --filter @ligala/api typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/env.ts .env.example
git commit -m "feat(api): IDMeta env config"
```

---

## Task 11: `POST /lawyers/kyc/idmeta/start`

**Files:**
- Modify: `apps/api/src/routes/lawyers.ts`
- Test: `apps/api/src/routes/lawyers.idmeta.test.ts` (create)

- [ ] **Step 1: Write the failing test** — create `apps/api/src/routes/lawyers.idmeta.test.ts`

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

const { testUser } = vi.hoisted(() => ({
  testUser: { id: "usr_1", role: "lawyer" as const, name: "Atty", email: "a@b.com", status: "active" as const },
}));

vi.mock("../middleware/session", () => ({
  requireRole: () => async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set("user", testUser);
    await next();
  },
  requireSession: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set("user", testUser);
    await next();
  },
}));
vi.mock("../lib/sentry", () => ({ captureException: vi.fn(), initSentry: vi.fn() }));

const createVerification = vi.fn(async () => ({ verificationId: "ver_1", raw: {} }));
const hostedUrlFor = vi.fn(() => "https://web-sdk.idmetagroup.com/?templateId=abc&verification_id=ver_1");
vi.mock("@ligala/kyc", () => ({ createVerification, hostedUrlFor }));

const insertValues = vi.fn(async () => {});
const updateWhere = vi.fn(async () => {});
const findFirst = vi.fn(async () => null);
vi.mock("@ligala/db", () => ({
  db: () => ({
    query: { kycSubmissions: { findFirst } },
    insert: vi.fn(() => ({ values: insertValues })),
    update: vi.fn(() => ({ set: () => ({ where: updateWhere }) })),
  }),
  schema: { kycSubmissions: { lawyerId: "lawyer_id", id: "id" } },
}));

import { lawyers } from "./lawyers";
import { errorHandler } from "../middleware/error";

function app() {
  const a = new Hono();
  a.route("/lawyers", lawyers);
  a.onError(errorHandler);
  return a;
}

beforeEach(() => {
  createVerification.mockClear();
  hostedUrlFor.mockClear();
  insertValues.mockClear();
  findFirst.mockResolvedValue(null);
  process.env.IDMETA_TOKEN = "tok";
  process.env.IDMETA_TEMPLATE_ID = "tpl_42";
});
afterEach(() => {
  delete process.env.IDMETA_TOKEN;
  delete process.env.IDMETA_TEMPLATE_ID;
  delete process.env.IDMETA_HOSTED_URL;
});

describe("POST /lawyers/kyc/idmeta/start", () => {
  it("creates a submission + IDMeta verification and returns the hosted URL", async () => {
    const res = await app().request("/lawyers/kyc/idmeta/start", { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { hostedUrl: string; submissionId: string };
    expect(body.hostedUrl).toContain("verification_id=ver_1");
    expect(typeof body.submissionId).toBe("string");
    expect(createVerification).toHaveBeenCalledWith({ submissionId: body.submissionId });
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ lawyerId: "usr_1", method: "idmeta", status: "pending" }),
    );
  });

  it("falls back to the static hosted link when IDMETA_TOKEN is unset (dev)", async () => {
    delete process.env.IDMETA_TOKEN;
    process.env.IDMETA_HOSTED_URL = "https://web-sdk.idmetagroup.com/?templateId=abc&k=sig&u=314";
    const res = await app().request("/lawyers/kyc/idmeta/start", { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { hostedUrl: string };
    expect(body.hostedUrl).toBe("https://web-sdk.idmetagroup.com/?templateId=abc&k=sig&u=314");
    expect(createVerification).not.toHaveBeenCalled();
  });

  it("returns 501 when neither token nor hosted URL is configured", async () => {
    delete process.env.IDMETA_TOKEN;
    const res = await app().request("/lawyers/kyc/idmeta/start", { method: "POST" });
    expect(res.status).toBe(501);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @ligala/api test -- lawyers.idmeta`
Expected: FAIL (route not found → 404).

- [ ] **Step 3: Add the route in `apps/api/src/routes/lawyers.ts`**

At the top, extend the existing `@ligala/kyc` usage — add this import after the `requireRole` import (line ~14):

```ts
import { createVerification, hostedUrlFor } from "@ligala/kyc";
```

Insert the new route immediately after the existing `.post("/kyc", ...)` block (after line ~122, before `// --- Office ---`):

```ts
  .post("/kyc/idmeta/start", async (c) => {
    const user = c.get("user");
    const hasApi = !!process.env.IDMETA_TOKEN && !!process.env.IDMETA_TEMPLATE_ID;
    const staticLink = process.env.IDMETA_HOSTED_URL;
    if (!hasApi && !staticLink) {
      throw new HTTPException(501, { message: "idmeta_not_configured" });
    }

    const conn = db();
    const now = new Date();
    const submissionId = newId();
    await conn.insert(schema.kycSubmissions).values({
      id: submissionId,
      lawyerId: user.id,
      status: "pending",
      method: "idmeta",
    });

    // Dev / no-API fallback: open the static Trust Flow link, no verification
    // is pre-created (ingestion is skipped without a token + bucket anyway).
    if (!hasApi) {
      return c.json({ hostedUrl: staticLink as string, submissionId });
    }

    const created = await createVerification({ submissionId });
    await conn
      .update(schema.kycSubmissions)
      .set({ idmetaApplicantId: created.verificationId, updatedAt: now })
      .where(eq(schema.kycSubmissions.id, submissionId));

    const hostedUrl = hostedUrlFor(created.verificationId, created.raw);
    return c.json({ hostedUrl, submissionId });
  })
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @ligala/api test -- lawyers.idmeta`
Expected: PASS (all three cases).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/lawyers.ts apps/api/src/routes/lawyers.idmeta.test.ts
git commit -m "feat(api): POST /lawyers/kyc/idmeta/start"
```

---

## Task 12: Enhance the `/webhooks/idmeta` handler

**Files:**
- Modify: `apps/api/src/routes/webhooks.ts`
- Test: `apps/api/src/routes/webhooks.idmeta.test.ts` (create)

- [ ] **Step 1: Write the failing test** — create `apps/api/src/routes/webhooks.idmeta.test.ts`

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { createHmac } from "node:crypto";

const ingestIdmetaResult = vi.fn(async () => ({ submissionId: "sub_1", status: "approved", ingestedDocuments: 2 }));
const enqueueIdmetaIngest = vi.fn(async () => {});
vi.mock("@ligala/kyc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ligala/kyc")>();
  return { ...actual, ingestIdmetaResult, enqueueIdmetaIngest };
});
vi.mock("../lib/sentry", () => ({ captureException: vi.fn(), initSentry: vi.fn() }));
// billing import pulls in db; stub it so importing webhooks.ts is cheap.
vi.mock("./billing", () => ({ applyPaymentWebhook: vi.fn() }));
vi.mock("@ligala/db", () => ({ db: () => ({}), schema: {} }));

import { webhooks } from "./webhooks";
import { errorHandler } from "../middleware/error";

function app() {
  const a = new Hono();
  a.route("/webhooks", webhooks);
  a.onError(errorHandler);
  return a;
}

const payload = JSON.stringify({
  id: "ver_1",
  status: "VERIFIED",
  metadata: { submissionId: "sub_1" },
  verification_results: { document_verification: { request_data: { imageFrontSide: "data:image/jpeg;base64,/9j/A" } } },
});

beforeEach(() => {
  ingestIdmetaResult.mockClear();
  enqueueIdmetaIngest.mockClear();
  delete process.env.IDMETA_WEBHOOK_SECRET;
  delete process.env.IDMETA_QUEUE_URL;
});
afterEach(() => {
  delete process.env.IDMETA_WEBHOOK_SECRET;
  delete process.env.IDMETA_QUEUE_URL;
});

describe("POST /webhooks/idmeta", () => {
  it("ingests inline when no queue is configured (dev)", async () => {
    const res = await app().request("/webhooks/idmeta", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
    });
    expect(res.status).toBe(200);
    expect(ingestIdmetaResult).toHaveBeenCalledWith(
      expect.objectContaining({ verificationId: "ver_1", status: "VERIFIED" }),
    );
    expect(enqueueIdmetaIngest).not.toHaveBeenCalled();
  });

  it("enqueues (does not ingest inline) when IDMETA_QUEUE_URL is set", async () => {
    process.env.IDMETA_QUEUE_URL = "https://sqs/idmeta";
    const res = await app().request("/webhooks/idmeta", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
    });
    expect(res.status).toBe(202);
    expect(enqueueIdmetaIngest).toHaveBeenCalledWith({ verificationId: "ver_1" });
    expect(ingestIdmetaResult).not.toHaveBeenCalled();
  });

  it("rejects a bad signature with 401 when a secret is configured", async () => {
    process.env.IDMETA_WEBHOOK_SECRET = "whsec";
    const res = await app().request("/webhooks/idmeta", {
      method: "POST",
      headers: { "content-type": "application/json", "idmeta-signature": "wrong" },
      body: payload,
    });
    expect(res.status).toBe(401);
    expect(ingestIdmetaResult).not.toHaveBeenCalled();
  });

  it("accepts a valid signature", async () => {
    process.env.IDMETA_WEBHOOK_SECRET = "whsec";
    const sig = createHmac("sha256", "whsec").update(payload).digest("hex");
    const res = await app().request("/webhooks/idmeta", {
      method: "POST",
      headers: { "content-type": "application/json", "idmeta-signature": sig },
      body: payload,
    });
    expect(res.status).toBe(200);
    expect(ingestIdmetaResult).toHaveBeenCalled();
  });

  it("400s a payload with no verification id", async () => {
    const res = await app().request("/webhooks/idmeta", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "VERIFIED" }),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @ligala/api test -- webhooks.idmeta`
Expected: FAIL (current handler reconciles via direct db, ignores signature/queue).

- [ ] **Step 3: Rewrite the `/idmeta` handler in `apps/api/src/routes/webhooks.ts`**

Update the imports at the top of the file. The old `/idmeta` handler was the only user of `eq` and `@ligala/db` in this file, so **delete** these two lines:

```ts
import { eq } from "drizzle-orm";
import { db, schema } from "@ligala/db";
```

Add the `@ligala/kyc` import next to the existing shared-schemas import (keep `idmetaWebhookPayload`):

```ts
import { idmetaWebhookPayload, paymentWebhookInput } from "@ligala/shared/schemas";
import { ingestIdmetaResult, enqueueIdmetaIngest, verifyIdmetaSignature } from "@ligala/kyc";
```

Replace the entire existing `.post("/idmeta", ...)` block (lines ~25-60) with the following. Note it reads `process.env.IDMETA_WEBHOOK_SECRET` directly (not `env()`) so the handler never forces full env validation — matching how `@ligala/kyc` reads its own config:

```ts
  /**
   * IDMeta verification webhook. Verifies the HMAC signature (when a secret is
   * configured), normalizes the payload, then either ingests inline (dev) or
   * enqueues to the idmeta SQS worker (prod, when IDMETA_QUEUE_URL is set).
   * Maps the verification to a kyc_submission, pulls captured images into our
   * S3, and reconciles status — all inside the shared ingestIdmetaResult().
   */
  .post("/idmeta", async (c) => {
    const raw = await c.req.raw.text();
    const signature =
      c.req.header("Idmeta-Signature") ?? c.req.header("X-Idmeta-Signature") ?? null;
    if (!verifyIdmetaSignature(raw, signature, process.env.IDMETA_WEBHOOK_SECRET)) {
      return c.json({ error: "invalid_signature" }, 401);
    }

    const parsed = idmetaWebhookPayload.safeParse(JSON.parse(raw || "null"));
    if (!parsed.success) {
      return c.json({ error: "bad_payload", issues: parsed.error.flatten() }, 400);
    }
    const verificationId = parsed.data.id as string;

    // Prod: hand off to the SQS worker so the webhook returns fast (downloading
    // several images can outlast the webhook timeout). Dev: process inline so
    // the flow is observable end-to-end locally.
    if (process.env.IDMETA_QUEUE_URL) {
      await enqueueIdmetaIngest({ verificationId });
      return c.json({ queued: true, verificationId }, 202);
    }

    const result = await ingestIdmetaResult({
      verificationId,
      status: parsed.data.status,
      verificationResults: parsed.data.verification_results ?? undefined,
    });
    if (result.notFound) {
      console.error("idmeta_webhook_submission_not_found", { verificationId });
      return c.json({ error: "submission_not_found", verificationId }, 404);
    }
    return c.json({ ok: true, ...result });
  })
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @ligala/api test -- webhooks.idmeta`
Expected: PASS (all five cases).

- [ ] **Step 5: Run the full api test suite + typecheck**

Run: `pnpm --filter @ligala/api test && pnpm --filter @ligala/api typecheck`
Expected: PASS (no regressions in existing webhook/billing tests).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/webhooks.ts apps/api/src/routes/webhooks.idmeta.test.ts
git commit -m "feat(api): IDMeta webhook -> signed, inline-dev/SQS-prod ingestion"
```

---

## Task 13: Implement the `workers/idmeta` Lambda

**Files:**
- Modify: `workers/idmeta/handler.ts`
- Test: `workers/idmeta/handler.test.ts` (create)

- [ ] **Step 1: Write the failing test** — create `workers/idmeta/handler.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQSEvent } from "aws-lambda";

const ingestIdmetaResult = vi.fn(async () => ({ submissionId: "sub_1", status: "approved", ingestedDocuments: 2 }));
vi.mock("@ligala/kyc", () => ({ ingestIdmetaResult }));
vi.mock("@ligala/db", () => ({ bootstrapEnv: vi.fn(async () => {}), db: () => ({}), schema: {} }));

import { handler } from "./handler";

function event(bodies: unknown[]): SQSEvent {
  return {
    Records: bodies.map((b, i) => ({ messageId: `m${i}`, body: JSON.stringify(b) })),
  } as unknown as SQSEvent;
}

beforeEach(() => ingestIdmetaResult.mockClear());

describe("idmeta worker", () => {
  it("calls ingestIdmetaResult per record and reports no failures on success", async () => {
    const res = await handler(event([{ verificationId: "ver_1" }, { verificationId: "ver_2" }]));
    expect(ingestIdmetaResult).toHaveBeenCalledTimes(2);
    expect(ingestIdmetaResult).toHaveBeenCalledWith({ verificationId: "ver_1" });
    expect(res.batchItemFailures).toEqual([]);
  });

  it("reports the failing record so SQS retries only it", async () => {
    ingestIdmetaResult.mockRejectedValueOnce(new Error("boom"));
    const res = await handler(event([{ verificationId: "bad" }, { verificationId: "ok" }]));
    expect(res.batchItemFailures).toEqual([{ itemIdentifier: "m0" }]);
  });

  it("reports a record with an unparseable body as a failure", async () => {
    const res = await handler({ Records: [{ messageId: "m0", body: "{" }] } as unknown as SQSEvent);
    expect(res.batchItemFailures).toEqual([{ itemIdentifier: "m0" }]);
    expect(ingestIdmetaResult).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @ligala/workers test -- idmeta`
Expected: FAIL (current handler is a no-op that never calls ingest).

- [ ] **Step 3: Implement `workers/idmeta/handler.ts`**

```ts
import type { SQSEvent, SQSBatchResponse } from "aws-lambda";
import { bootstrapEnv } from "@ligala/db";
import { ingestIdmetaResult } from "@ligala/kyc";

// Consumes IDMeta ingest jobs enqueued by POST /webhooks/idmeta: finalize +
// download the captured selfie/ID into our S3 and reconcile the submission.
export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  await bootstrapEnv();
  const failures: { itemIdentifier: string }[] = [];

  for (const r of event.Records) {
    try {
      const body = JSON.parse(r.body) as { verificationId?: unknown };
      if (typeof body.verificationId !== "string" || body.verificationId.length === 0) {
        console.error("[idmeta-worker] invalid message", r.messageId, r.body.slice(0, 200));
        failures.push({ itemIdentifier: r.messageId });
        continue;
      }
      const result = await ingestIdmetaResult({ verificationId: body.verificationId });
      if (result.notFound) {
        // No submission maps to this verification — non-retryable; log & ack.
        console.error("[idmeta-worker] submission not found", body.verificationId);
        continue;
      }
      console.info("[idmeta-worker] ingested", body.verificationId, result.status, result.ingestedDocuments);
    } catch (err) {
      console.error("[idmeta-worker] ingest failed", r.messageId, err);
      failures.push({ itemIdentifier: r.messageId });
    }
  }

  return { batchItemFailures: failures };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm --filter @ligala/workers test -- idmeta`
Expected: PASS.

- [ ] **Step 5: Verify the worker still bundles**

Run: `pnpm --filter @ligala/workers build`
Expected: `[workers/build] dist/{paymongo,paypal,idmeta,email,image}/handler.js + package.json ready` — no esbuild errors.

- [ ] **Step 6: Commit**

```bash
git add workers/idmeta/handler.ts workers/idmeta/handler.test.ts
git commit -m "feat(workers): implement idmeta ingest Lambda"
```

---

## Task 14: Web — server action + IDMeta card on the KYC page

**Files:**
- Modify: `apps/web/lib/actions/lawyer.ts`
- Create: `apps/web/app/(lawyer)/lawyer/kyc/idmeta-launch.tsx`
- Modify: `apps/web/app/(lawyer)/lawyer/kyc/page.tsx`

- [ ] **Step 1: Add the server action to `apps/web/lib/actions/lawyer.ts`**

Add `IdmetaStartResponse` to the type import block (the `import type { ... } from "@ligala/shared/schemas"`):

```ts
  IdmetaStartResponse,
```

Add the action after `submitKyc` (after line ~25):

```ts
export async function startIdmetaVerification(): Promise<IdmetaStartResponse> {
  const res = await api<IdmetaStartResponse>("/lawyers/kyc/idmeta/start", {
    method: "POST",
  });
  revalidatePath("/lawyer/kyc");
  return res;
}
```

- [ ] **Step 2: Create the client launcher `apps/web/app/(lawyer)/lawyer/kyc/idmeta-launch.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { startIdmetaVerification } from "@/lib/actions/lawyer";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function IdmetaLaunch() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [launched, setLaunched] = useState(false);

  function onClick() {
    setError(null);
    start(async () => {
      try {
        const { hostedUrl } = await startIdmetaVerification();
        window.open(hostedUrl, "_blank", "noopener,noreferrer");
        setLaunched(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start verification.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <Button type="button" onClick={onClick} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
        {pending ? "Starting…" : "Start IDMeta verification"}
        {!pending ? <ExternalLink className="opacity-70" /> : null}
      </Button>
      {launched ? (
        <p className="text-xs text-muted-foreground">
          Verification opened in a new tab. Complete it there — this page updates
          once IDMeta finishes processing (you may need to refresh).
        </p>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Add the `pending` status to `STATUS_META` in `apps/web/app/(lawyer)/lawyer/kyc/page.tsx`**

The `start` endpoint creates submissions with `status: "pending"`, which the current `STATUS_META` map lacks (it would crash rendering). Update the `KycResponse` status union and the map.

Change the `KycResponse` submission `status` type (line ~18) to include `pending`:

```ts
    status: "pending" | "draft" | "submitted" | "approved" | "rejected";
```

Change the `STATUS_META` Record key union (line ~44) and add the `pending` entry (place it before `draft`):

```ts
const STATUS_META: Record<
  "none" | "pending" | "draft" | "submitted" | "approved" | "rejected",
  {
    label: string;
    icon: React.ReactNode;
    accent: string;
    tone: string;
  }
> = {
  none: {
    label: "Not submitted",
    icon: <CircleDashed className="size-3.5" />,
    accent: "bg-zinc-300",
    tone: "text-muted-foreground",
  },
  pending: {
    label: "Verification started",
    icon: <Clock className="size-3.5" />,
    accent: "bg-sky-500",
    tone: "text-sky-700 dark:text-sky-300",
  },
```

(Leave the existing `draft`, `submitted`, `approved`, `rejected` entries as-is.)

- [ ] **Step 4: Render the IDMeta card in `apps/web/app/(lawyer)/lawyer/kyc/page.tsx`**

Add the import alongside the existing `KycForm` import (line ~13):

```ts
import { IdmetaLaunch } from "./idmeta-launch";
```

Read the feature flag inside `KycPage` (after the `const meta = ...` line, ~line 93):

```ts
  const idmetaEnabled = !!process.env.IDMETA_HOSTED_URL;
```

Replace the left-column `<div>` that wraps `<KycForm .../>` (lines ~116-119) with an IDMeta card above a divider, then the existing form:

```tsx
        {/* Verification methods --------------------------------------- */}
        <div className="space-y-6">
          {idmetaEnabled ? (
            <Card
              size="sm"
              className="gap-3 ring-emerald-300/70 bg-emerald-50/30 dark:ring-emerald-900/40 dark:bg-emerald-950/20"
            >
              <CardHeader>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                  Fast verification
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Verify your identity instantly with IDMeta — capture your
                  selfie and a government ID. We securely store the captured
                  documents for our records.
                </p>
                <IdmetaLaunch />
              </CardContent>
            </Card>
          ) : null}

          {idmetaEnabled ? (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or upload documents manually
                </span>
              </div>
            </div>
          ) : null}

          <KycForm allowResubmit={!!allowResubmit} />
        </div>
```

- [ ] **Step 5: Typecheck + lint the web app**

Run: `pnpm --filter @ligala/web typecheck && pnpm --filter @ligala/web lint`
Expected: PASS (no type errors; no `import type` / no-console violations).

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/actions/lawyer.ts "apps/web/app/(lawyer)/lawyer/kyc/idmeta-launch.tsx" "apps/web/app/(lawyer)/lawyer/kyc/page.tsx"
git commit -m "feat(web): IDMeta verification card + launcher on /lawyer/kyc"
```

---

## Task 15: Full-graph verification + PROCESS.md

**Files:**
- Modify: `PROCESS.md`

- [ ] **Step 1: Run the full checks across the graph**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all PASS. If a downstream package fails to resolve `@ligala/kyc`, re-run `pnpm install` and retry.

- [ ] **Step 2: Build to confirm bundling**

Run: `pnpm build`
Expected: Next build + esbuild (api + workers) succeed.

- [ ] **Step 3: Update `PROCESS.md`**

Add a short entry under the current KYC/phase section noting: IDMeta API-driven verification + S3 ingestion shipped — `@ligala/kyc` package, `POST /lawyers/kyc/idmeta/start`, signed `/webhooks/idmeta` (inline dev / SQS `workers/idmeta` prod), `kyc_submission.method`. Note the three sandbox-confirm items from the spec §11 (hosted-link param, webhook signature header, image nesting) as follow-ups once the IDMeta dashboard/sandbox is wired.

- [ ] **Step 4: Commit**

```bash
git add PROCESS.md
git commit -m "docs: record IDMeta KYC ingestion in PROCESS.md"
```

---

## Post-implementation: infra follow-ups (NOT in this plan — flag to the team)

These require the AWS account / dashboard and are out of scope for the code build, but must happen before the feature is live in a deployed env:

1. **SQS queue + DLQ for idmeta** in `infra/lib/app-stack.ts` (mirror the email queue), wire `workers/idmeta` as its consumer, set `IDMETA_QUEUE_URL` on the api Lambda, and `attach*` the DLQ-depth alarm via the `Monitoring` construct.
2. **IDMeta dashboard:** set the Trust Flow webhook URL to the deployed `/webhooks/idmeta`, generate an app token (`IDMETA_TOKEN`), and confirm the three §11 items (hosted-link binding param, signature header/encoding, image nesting) against a sandbox verification.
3. **Env/secrets:** populate `IDMETA_*` on the api Lambda + `IDMETA_HOSTED_URL` on web (Amplify) via Secrets Manager / env config.
