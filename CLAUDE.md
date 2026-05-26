# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Day-to-day (run from repo root unless noted):

```bash
pnpm install                          # bootstrap
docker compose up -d                  # Postgres 16 + Redis 7 (creds: ligala/ligala/ligala_dev)
pnpm db:migrate                       # apply Drizzle migrations
pnpm db:seed                          # reference data (IBP chapters, practice areas, jurisdictions)
pnpm --filter @ligala/db seed-admin <email>   # promote an existing user to admin (idempotent)
pnpm dev                              # web on :3000, api on :8787 (turbo, persistent)
pnpm typecheck                        # tsc across the graph (9 packages)
pnpm lint
pnpm test                             # vitest in every package that has it
pnpm build                            # Next build + esbuild for api/workers
pnpm test:e2e                         # Playwright (requires docker stack + `pnpm dev` already running)
pnpm test:e2e:ui                      # Playwright UI mode
pnpm cdk:synth | pnpm cdk:diff | pnpm cdk:deploy:dev
```

Narrowing scope:

- One package: `pnpm --filter @ligala/api typecheck` (or `lint`, `test`, `build`, …).
- One Vitest spec: `pnpm --filter @ligala/api test -- routes/cases` (anything after `--` is passed to vitest's filename filter).
- DB schema work: edit `packages/db/src/schema/*.ts`, then `pnpm db:generate` (writes `packages/db/drizzle/NNNN_*.sql`), then `pnpm db:migrate`. Studio: `pnpm db:studio`.
- Drizzle Kit reads `DATABASE_URL` from `packages/db/.env.local` (see `packages/db/drizzle.config.ts` — it loads dotenv itself).
- E2E targets: override the base URLs with `PLAYWRIGHT_BASE_URL` (and optionally `PLAYWRIGHT_API_URL`) to run against a deployed env.

## Architecture

**Monorepo, three runtimes, one Better Auth session.** pnpm workspaces + Turbo. The three runtimes — Next.js web, Hono api, SQS worker Lambdas — all import `@ligala/db` (Drizzle), `@ligala/auth` (Better Auth) and `@ligala/shared` (Zod schemas + stable error codes) from `packages/`. Any change to a shared package ripples into all three; treat them as one deployable concern.

**Two HTTP surfaces, both behind the same cookie.**

- `apps/web` (Next 15, App Router, React 19): all UI + Server Actions. Mounts Better Auth at `app/api/auth/[...all]/route.ts` via `toNextJsHandler(auth)`. Server Components/Actions call the api via `apps/web/lib/api.ts`, which forwards the incoming request's `cookie` header to `process.env.API_URL` (default `http://localhost:8787`). The browser never talks to the api directly — different origin, cookies wouldn't cross.
- `apps/api` (Hono): builds with esbuild to a single `dist/lambda.js` and ships as one AWS Lambda behind API Gateway. `src/app.ts` registers every route module; `src/lambda.ts` is the Lambda entry (`hono/aws-lambda`); `src/dev.ts` is the local Node server (`@hono/node-server`). The middleware in `src/middleware/session.ts` resolves the Better Auth session from request headers and sets `c.var.user` / `c.var.session`.

**Better Auth specifics that bite if forgotten:**

- `cookiePrefix: "ligala"` — every cookie helper must pass this prefix (see `apps/web/middleware.ts`). The default `better-auth.session_token` is wrong here.
- `cookieCache.enabled: false` — role/status changes take effect on the next request rather than waiting for the cache to expire. Don't re-enable without routing role mutations through Better Auth's own update API.
- `additionalFields` adds `role` ("client"|"lawyer"|"admin") and `status` ("active"|"paused"|"banned") on the user. Both are `input: false`, so signup can't self-assign. Bootstrap the first admin with `seed-admin`.
- A build-time placeholder `BETTER_AUTH_SECRET` is set in `packages/auth/src/index.ts` so `next build` page-data collection doesn't crash when the real secret isn't injected (CI builds). Same trick for `DATABASE_URL` in `packages/db/src/client.ts` (lazy-connects so the placeholder only fails when something actually queries).

**Three-layer role gating.** Don't rely on any single layer:

1. Edge middleware (`apps/web/middleware.ts`) — coarse: cookie present? Otherwise redirect to `/login`. Cannot read the DB.
2. Route-group layouts (`apps/web/app/(client|lawyer|admin)/layout.tsx`) — Server Components that call `getSession()` and `redirect(roleHome(role))` on mismatch.
3. Hono `requireSession` / `requireRole(...)` (`apps/api/src/middleware/session.ts`) — the only layer that runs for api-direct callers (workers, webhooks adjacent calls). `assertStatus` runs here too: `banned` → 403 on any method; `paused` → 403 on writes only (GET/HEAD still pass). **Admins are exempt from status checks** to avoid locking themselves out via their own audit endpoint.

**Server Action → api convention.** Mutating actions live in `apps/web/lib/actions/*.ts`. Each one parses the input with the shared Zod schema (`@ligala/shared/schemas`) before calling `api()`, then `revalidatePath()` for any pages whose data changed. The Hono route validates again with `@hono/zod-validator`. Validation on both sides is intentional: client gets fast feedback, server is the trust boundary.

**Domain modules.** Each aggregate lives in three matching files: `packages/db/src/schema/<x>.ts` + `packages/shared/src/schemas/<x>.ts` + `apps/api/src/routes/<x>.ts`. Aggregates: `auth`, `lawyers`/`kyc`/`offices`/`reference`, `clients`, `cases`/`engagements`, `billing` (invoices, discount codes, payments, transactions ledger), `referrals`, `admin`. Reading all three files for one aggregate is usually enough context to change it.

**Money is integer cents.** `apps/api/src/lib/billing.ts` (`computeLineTotalCents`, `computeDiscountCents`, `newInvoiceNumber`). Never introduce floats into pricing math.

**Webhook idempotency.** Payment webhooks (`/webhooks/paymongo`, `/webhooks/paypal`) normalize to a single `applyPaymentWebhook(...)` helper, deduplicate on a unique `(provider, providerPaymentId)` index, and write the same `transaction` ledger row regardless of source. Replays return `{ idempotent: true }`.

**Refunds today are accounting-only.** `refundPayment(...)` in `apps/api/src/routes/billing.ts` rolls back `payment.refundedCents` and the invoice status (`paid → partially_paid → sent`). Provider API calls (PayMongo / PayPal) are deferred — the production refund flow will hit the provider first, then call this helper on success.

**Sentry init is DSN-gated everywhere.** `SENTRY_DSN` unset = clean no-op (web instrumentation, api `initSentry()`, Lambda handler wrapper). Adopters opt in by setting the env var; nothing else changes. The api bundle is ~5 MB cold because `@sentry/aws-serverless` pulls OpenTelemetry — acceptable until measured cold-starts say otherwise.

**Infra: two CDK stacks.** `CoreStack` (long-lived: VPC, S3 uploads bucket; will grow Aurora Serverless v2, RDS Proxy, ElastiCache, SES, Secrets Manager). `AppStack` (per-deploy: Hono Lambda + API Gateway, worker Lambdas + SQS queues + DLQs, EventBridge schedules, Amplify hosting). `infra/lib/monitoring.ts` exposes a `Monitoring` construct with per-resource `attach*` factories (Lambda errors/throttles/duration p95, SQS DLQ depth, API 5xx as a `MathExpression` percentage, API latency p95). **Call the matching `attach*` on the line a resource is created** — there is no god-method "wire all alarms."

## Conventions that aren't obvious from the code

- **Imports order matters in `apps/api/src/dev.ts`.** `import "./load-env"` MUST be first so dotenv populates `process.env` before any sibling module (Better Auth, db client, `lib/env.ts`) reads it at evaluation time. Same pattern in `packages/db/scripts/seed-admin.ts`.
- **`apps/api/src/lib/env.ts`** Zod-validates `process.env` and caches. New env vars consumed by the api should be added there with their schema.
- **Drizzle DB client** in `packages/db/src/client.ts` is `postgres(url, { max: 1, prepare: false })` and cached at module scope. `max: 1` keeps the per-Lambda connection footprint small so RDS Proxy can multiplex; `prepare: false` is required by RDS Proxy in pinning-aware mode. Don't bump these without understanding the proxy implications.
- **`noUncheckedIndexedAccess` is on** (`tsconfig.base.json`). Array/record reads are `T | undefined` — handle it, don't `!`-assert.
- **ESLint flat config at root.** `apps/web` layers Next plugin rules on top via `apps/web/eslint.config.mjs`. `workers/` and `infra/` may use `console` freely; others get `no-console` (warn, allow warn/error/info). Type-only imports must use `import type` (`consistent-type-imports`).
- **Route groups own their chrome.** Wide listing pages (`/lawyers`, `/chapters`) live under `(marketing)` with their own containers. Article-style prose pages live under `(marketing)/(prose)/<slug>/page.mdx` and inherit a narrow `max-w-3xl prose` wrapper. Portal pages live under `(client)/(lawyer)/(admin)` and inherit per-portal layouts that gate on role.
- **Public paths are listed explicitly in `apps/web/middleware.ts`.** Any new public route (marketing, public directory, public webhook proxy) must be added there or it 302s to `/login`.
- **shadcn lives in `apps/web/components/ui/`.** Added via `pnpm dlx shadcn@latest add <name>` from inside `apps/web` (config in `apps/web/components.json`, style `new-york`, neutral base, RSC on). `@ligala/ui` only exports `cn()` today — promote a component there only when a second app needs it.
- **All date/time display goes through `apps/web/lib/datetime.ts` (`phDateFormat`).** It pins `timeZone: "Asia/Manila"` so SSR (Lambda, UTC) and client hydration (browser, local) format identical text — a raw `Intl.DateTimeFormat` without `timeZone` causes React #418 hydration mismatch in client components. Never call `new Intl.DateTimeFormat` directly in `apps/web` (currency `Intl.NumberFormat` is tz-independent and exempt). Relative-time labels (`Date.now()`-based "Xm ago") are non-deterministic across the SSR→hydration gap regardless of tz — wrap their rendered text node in `<span suppressHydrationWarning>` (only needed in client components).
- **Admin mutations require `reason` (≥3 chars).** Every admin status/role/refund/KYC-decision schema in `packages/shared/src/schemas/admin.ts` enforces this; the handler writes it to `admin_audit_log`. Don't add an admin mutation route without an audit row.
- **`PROCESS.md` is the live phase tracker.** Update at the start and end of every working session and after every phase milestone. It is the source of truth for "where are we right now" — readable by humans and future Claude sessions.
- **Playwright runs serially (`workers: 1`)** because parallel workers cause concurrent `next dev` cold compiles that time out the first signup POST. Override with `--workers=N` only against a built/deployed target.
