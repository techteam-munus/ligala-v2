# IDMeta KYC Verification & Document Ingestion — Design Spec

- **Date:** 2026-05-26
- **Status:** Draft (brainstorming) — awaiting user review before implementation planning
- **Author:** Session (Claude + techteam)
- **Related:** PROCESS.md (KYC / Phase 2 idmeta worker); `apps/api/src/routes/webhooks.ts` (existing `/idmeta` stub handler); `packages/db/src/schema/kyc.ts`

## 1. Context & goal

The codebase already anticipated IDMeta: `kyc_submission.idmetaApplicantId` exists, `POST /webhooks/idmeta` reconciles a submission's status, `workers/idmeta/handler.ts` is a "Phase 2" no-op stub, and `.env.example` lists `IDMETA_BASE_URL` / `IDMETA_TOKEN` / `IDMETA_TEMPLATE_ID` / `IDMETA_WEBHOOK_SECRET`. Today's *actual* KYC flow on `/lawyer/kyc` is manual document upload (gov ID, bar cert, selfie) → S3 (presigned PUT) → admin review at `/admin/kyc`.

**Goal:** add an **API-driven IDMeta verification path** to the `/lawyer/kyc` page, *alongside* the existing manual upload. A lawyer launches IDMeta's hosted verification (selfie + ID) in a new tab; when they finish, our backend **ingests the documents IDMeta captured into our own S3** as `kyc_document` rows and updates the submission status — so admins see the same artifacts they get from manual upload, and the verification result maps back to the correct lawyer.

## 2. Scope

**In scope (this build):**

- IDMeta API client (`create-verification`, `finalize-verification`, document fetch/decode) using `IDMETA_BASE_URL` + `IDMETA_TOKEN` + `IDMETA_TEMPLATE_ID`.
- `POST /lawyers/kyc/idmeta/start` — creates an IDMeta verification carrying our `submissionId` in `metadata`, upserts a `kyc_submission` (`method = idmeta`), returns the hosted URL.
- Webhook-triggered ingestion: enhance `POST /webhooks/idmeta` → on completion, `finalize-verification` → parse captured images → upload to our S3 → write `kyc_document` rows → update submission status. Inline in dev, enqueue to the `workers/idmeta` SQS Lambda in prod, sharing one `ingestIdmetaResult()` helper.
- `kyc_submission.method` enum column (`upload` | `idmeta`, default `upload`) + migration.
- `/lawyer/kyc` UI: a themed "Verify with IDMeta" card above the existing upload form (feature-gated on env), and a client launcher that opens the hosted URL in a new tab.
- Unit tests: API client, status mapping, `verification_data` document extraction, ingestion idempotency, webhook handler.

**Out of scope (deferred):**

- Replacing or removing the manual upload flow (both coexist; this is "add alongside").
- Per-applicant deep-linking polish, retries UI, or live status polling on the KYC page beyond a reload/refresh (page already renders current status on load).
- Any change to the admin KYC inbox rendering (it already lists submission status + documents via presigned GET).
- The other worker stubs (`paymongo`, `paypal`, `image`) stay as-is.

## 3. Architecture

```
/lawyer/kyc  ──click "Verify with IDMeta"──> startIdmetaVerification() [server action]
                                                   │
                                                   v
   POST /lawyers/kyc/idmeta/start (Hono, requireSession)
     1. upsert kyc_submission (lawyerId, status=pending, method=idmeta)
     2. IDMeta create-verification { template_id, metadata: { submissionId } } -> verification.id
     3. store verification.id on submission.idmetaApplicantId
     4. return { hostedUrl }                         hostedUrlFor(verificationId)  [* unknown #1]
                                                   │
                          window.open(hostedUrl, "_blank", "noopener")
                                                   │
                              (lawyer completes selfie + ID on IDMeta)
                                                   │
                  IDMeta ──webhook (HMAC, IDMETA_WEBHOOK_SECRET)──> POST /webhooks/idmeta  [* unknown #2]
                                                   │
                            dev: inline          prod: SQS -> workers/idmeta
                                                   │
                                   ingestIdmetaResult(verificationId):
     a. finalize-verification { template_id, verification_id }
        -> { status (numeric) [* unknown #3], metadata.submissionId, verification_data }
     b. parse verification_data for images: selfie (face_url/photo/base64), ID (imageFrontSide/imageBackSide/url)
     c. for each: download URL or decode base64 -> S3 PutObject  kyc_document/<lawyerId>/<uuid>.<ext>
        -> INSERT kyc_document { kind: selfie | government_id, s3Key }
     d. UPDATE kyc_submission { status (mapped), submittedAt, decidedAt, rejectReason }
        idempotent on verification_id (skip re-ingest if docs already present)
                                                   │
                                                   v
                 /lawyer/kyc + /admin/kyc render status + docs (unchanged, presigned GET)
```

At-least-once webhook delivery + idempotency on `verification_id` (skip if the submission already has ingested IDMeta docs) ⇒ effectively-once ingestion. Mirrors the existing payment-webhook idempotency pattern.

## 4. Components

| Package / file | Change |
| --- | --- |
| `packages/db/src/schema/kyc.ts` | Add `kycMethod` pgEnum (`upload`, `idmeta`); add `method` column to `kyc_submission` (default `upload`, not null). Reuse `idmetaApplicantId` to hold the IDMeta `verification.id`. `kyc_document.kind` reuses existing `selfie` / `government_id`. |
| `packages/db/drizzle/NNNN_*.sql` | Generated migration (`pnpm db:generate`) for the new enum + column. |
| `packages/shared/src/schemas/kyc.ts` | Add `idmetaStartResponse` (`{ hostedUrl, submissionId }`). Rework `idmetaWebhookPayload` to a defensive shape: `verification_id` required (accept common aliases), everything else optional/passthrough. Add numeric-status → `kyc_status` mapping helper. |
| `apps/api/src/lib/env.ts` | Add `IDMETA_BASE_URL` (default `https://integrate.idmetagroup.com`), `IDMETA_TOKEN`, `IDMETA_TEMPLATE_ID`, `IDMETA_WEBHOOK_SECRET` — all optional; feature is gated OFF when `IDMETA_TOKEN`/`IDMETA_TEMPLATE_ID` are unset (same pattern as Sentry/PayMongo). |
| `apps/api/src/lib/idmeta.ts` (new) | API client: `createVerification({ metadata })`, `finalizeVerification(verificationId)`, `hostedUrlFor(verificationId)`, plus `extractDocuments(verificationData)` and `fetchDocumentBytes(ref)` (download URL or decode `data:` base64). Bearer auth. |
| `apps/api/src/lib/kyc-ingest.ts` (new) | `ingestIdmetaResult(verificationId)`: finalize → extract → S3 put (reusing the `S3Client`/`PutObjectCommand` pattern from `routes/files.ts`, bucket `S3_UPLOADS_BUCKET`, key `kyc_document/<lawyerId>/<uuid>.<ext>`) → DB writes. Idempotent. Shared by the webhook (dev inline) and the SQS worker (prod). |
| `apps/api/src/routes/lawyers.ts` | Add `POST /kyc/idmeta/start` (create-verification + upsert submission + return hosted URL). |
| `apps/api/src/routes/webhooks.ts` | Enhance `/idmeta`: verify signature, extract `verification_id`; dev → `await ingestIdmetaResult(...)`; prod → enqueue to SQS. |
| `workers/idmeta/handler.ts` | Implement: parse SQS records → `ingestIdmetaResult(verificationId)` → `reportBatchItemFailures` on error. |
| `apps/web/app/(lawyer)/lawyer/kyc/page.tsx` | Add themed IDMeta card above the upload form; render only when the feature env is present (read server-side). Divider "Or upload documents manually" before the existing `KycForm`. |
| `apps/web/app/(lawyer)/lawyer/kyc/idmeta-launch.tsx` (new) | Client component: button → calls `startIdmetaVerification()` → `window.open(hostedUrl, "_blank", "noopener")`; pending + "complete in the new tab" states. |
| `apps/web/lib/actions/lawyer.ts` | Add `startIdmetaVerification()` server action → `POST /lawyers/kyc/idmeta/start`; `revalidatePath('/lawyer/kyc')`. |

## 5. Data model

`kyc_submission` (added column):

- `method`: `kycMethod` enum (`upload` | `idmeta`), `default 'upload'`, not null. Existing rows default to `upload`.
- `idmetaApplicantId` (existing): now stores the IDMeta `verification.id` for `idmeta` submissions.

`kyc_document.kind` (existing enum `government_id` | `bar_certificate` | `selfie` | `other`) is reused: IDMeta selfie → `selfie`, IDMeta ID image → `government_id`. No enum change.

## 6. IDMeta contract (confirmed from OpenAPI) & status mapping

- **Create:** `POST {IDMETA_BASE_URL}/api/v1/verification/create-verification`, `Authorization: Bearer {IDMETA_TOKEN}`, body `{ template_id, metadata }` → `{ verification: { id, status: 99 /* created */ } }`. `metadata` is echoed back at finalize.
- **Finalize:** `POST {IDMETA_BASE_URL}/api/v1/verification/finalize-verification`, body `{ template_id, verification_id }` → `{ verification: { id, status, ... }, status, status_message }`. Used as a status/result backstop.
- **Webhook payload (confirmed via Postman collection):** `{ id /* = verification_id */, company_id, template_id, status /* string, e.g. "REVIEW_NEEDED" */, metadata /* echoed back from create */, profile_name, verification_results: { document_verification: { request_data, request_result }, ... } }`. The webhook carries both our echoed `metadata` **and** the verification results (where captured images live), so it is the primary ingestion source; finalize is the backstop.
- **Document image fields:** `imageFrontSide` / `imageBackSide` (document, base64 `data:` URLs), and face/selfie images in the biometric check results (`face_url` / `photo` URLs or base64). Exact nesting inside `verification_results` is handled by a defensive recursive scan (`extractImages`) rather than hard-coded paths.
- **Status mapping (confirmed codes):** `3 VERIFIED → approved`; `1 REJECTED / 6 FAILED → rejected`; `2 REVIEW_NEEDED → submitted`; `4 INCOMPLETE / 5 IN_PROGRESS / 99 EMPTY → pending`; unknown → `submitted` (safe: surfaces for admin review). One `mapIdmetaStatus()` function keys off the string `status`/`status_message` first, numeric `status` second.

## 7. Error handling & idempotency

- **Idempotency:** `ingestIdmetaResult` is keyed on `verification_id` → its `kyc_submission`. If the submission already has IDMeta-sourced documents, re-ingestion is a no-op (status may still be re-reconciled). Webhook replays return `{ idempotent: true }`.
- **Submission mapping precedence:** resolve `verification_id` → submission via `idmetaApplicantId`; cross-check `metadata.submissionId` from finalize. If neither resolves, 404 + loud log (do not create an orphan).
- **Webhook failures:** dev surfaces inline; prod relies on SQS retry → DLQ (alarmed via the `Monitoring` construct, like other queues).
- **Partial images:** ingest whatever images are present; a missing selfie or ID is logged but does not fail the whole submission (status still updates).
- **Feature gating:** if `IDMETA_TOKEN`/`IDMETA_TEMPLATE_ID` unset, `start` and the IDMeta card are disabled; `/webhooks/idmeta` returns `501 idmeta_not_configured`.

## 8. Security

- `IDMETA_TOKEN` is server-only (api/worker); never exposed to the browser. The `start` endpoint runs behind `requireSession`.
- Webhook signature verified with `IDMETA_WEBHOOK_SECRET` (HMAC; exact scheme confirmed in dashboard during implementation). Unsigned/invalid → 401.
- S3 keys stay under the per-lawyer `kyc_document/<lawyerId>/` prefix; documents served only via short-lived presigned GET (existing behavior), bucket private.
- Do not trust client-supplied `submissionId`; the server derives `lawyerId` from the session at `start` and from the stored submission at ingest.

## 9. Dev fallback

No `IDMETA_TOKEN` / no `S3_UPLOADS_BUCKET` in dev:

- `start` returns the static Trust Flow hosted link directly (so the SDK still opens and the flow is demoable locally).
- Ingestion is skipped (same "dev docs aren't actually served" limitation the manual KYC upload already has via the `/files/_dev/upload` sink).

## 10. Testing

- **API client** (`idmeta.test.ts`): mock `fetch`; assert request shape/headers for create + finalize; `extractDocuments` over a representative `verification_data`; `fetchDocumentBytes` for both URL and base64 `data:` inputs.
- **Status mapping**: numeric → `kyc_status`, incl. unknown → `submitted` default.
- **Ingestion idempotency** (`kyc-ingest.test.ts`): re-running for the same `verification_id` does not duplicate `kyc_document` rows.
- **Webhook** (extend `webhooks.test.ts`): valid signed payload → ingestion invoked; invalid signature → 401; unconfigured → 501.
- Run via `pnpm --filter @ligala/api test`.

## 11. Open items to confirm against the IDMeta sandbox (isolated, non-blocking)

1. **Hosted-link ↔ created-verification binding** — how a server-created `verification.id` reaches the hosted Trust Flow link the lawyer opens (the exact query param appended to the link, vs. a session URL field in the create response). Abstracted behind `hostedUrlFor(verificationId, createResponse)`; the rest of the build is independent of the answer.
2. **Webhook signature scheme** — payload shape is confirmed (§6); only the HMAC header name/encoding used with `IDMETA_WEBHOOK_SECRET` needs confirming. `verifyIdmetaSignature()` isolates it; unset secret ⇒ verification skipped (dev).
3. **Exact image nesting** inside `verification_results` — handled by the recursive `extractImages` scan, so no hard dependency; a sandbox sample just lets us tighten the kind-classification heuristics.

These are confirmable in the dashboard/sandbox (credentials available) and are quarantined behind single functions so the rest of the build is unaffected.
