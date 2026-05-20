# Ligala v2 — Process & Status

> Living dev log. Update at the **start and end of every working session** and **after every phase milestone**.
> Source of truth for "where are we right now" — readable by humans and by future Claude sessions.

---

## Current State

- **Active phase:** Phase 3 — Client onboarding & lawyer discovery **DONE locally** (full API + Next.js SSR smoke test passed; awaiting browser walkthrough + AWS dev deploy)
- **Last working session:** 2026-05-20
- **Environment status:** local dev stack up (compose: Postgres 16 + Redis 7) | AWS dev not yet | staging not yet | prod not yet
- **Next action:** browser walkthrough of `/lawyers` directory + `/lawyers/[slug]` public profile + client `/profile` flow once Playwright MCP is back, OR jump to Phase 4 (cases + engagements).
- **Blockers:** none

---

## Phase Tracker

- [ ] **Phase 0 — Scaffold & infra** *(in progress)*
  - [x] Monorepo directory tree
  - [x] Root config files (pnpm-workspace, turbo.json, tsconfig.base, .gitignore, .env.example)
  - [x] `PROCESS.md` initialized
  - [x] apps/web Next.js 15 skeleton with `/api/health`
  - [x] apps/api Hono skeleton with `/health`
  - [x] packages skeletons (db, auth, ui, shared, email)
  - [x] infra CDK skeleton (CoreStack + AppStack stubs)
  - [x] workers/ skeleton
  - [x] GitHub Actions CI workflow
  - [x] `pnpm install` clean (no peer warnings — after zod 4 + hono 4.10 bump)
  - [x] `pnpm typecheck` green locally (9/9 packages, ~3s)
  - [x] `pnpm build` green locally (web Next.js 5.1s + api esbuild 21ms + workers esbuild 11ms; 4 web routes detected, api bundle 78.4kb)
  - [x] `pnpm lint` green locally (ESLint 9 flat config; 0 errors, 0 warnings)
  - [ ] `pnpm test` green locally (no tests yet)
  - [x] CDK `synth` clean (Core=35 resources: VPC + 6 subnets + NAT + S3 + endpoints; App=placeholder)
  - [ ] CDK `deploy` to dev env
  - [ ] Sentry DSN wired in both apps
  - [ ] `/health` returns 200 from deployed API and Next URLs
- [ ] **Phase 1 — Auth foundation** *(scaffold complete; needs deployed smoke test)*
  - [x] Drizzle schema: `user`, `session`, `account`, `verification` + `user_role` enum
  - [x] First migration generated (`packages/db/drizzle/0000_regular_rachel_grey.sql`)
  - [x] Better Auth config in `packages/auth` (Drizzle adapter, email/password, conditional Google OAuth, role on user)
  - [x] Mounted in `apps/web` at `/api/auth/[...all]` (Next.js catch-all)
  - [x] Mounted in `apps/api` at `/auth/*` (Hono catch-all)
  - [x] `requireSession` + `requireRole` middleware in Hono
  - [x] Edge-safe session-cookie middleware in Next.js + role-guarded route group layouts
  - [x] Minimal `/login`, `/signup` pages (client components, react-hook-form deferred to later phase)
  - [x] Role-aware redirect (`roleHome`) for cross-portal navigation
  - [x] Local Postgres + Redis running via `docker compose up -d` (compose.yaml, both healthy in <15s)
  - [x] `pnpm db:migrate` applied (commit `86b6d25` added dotenv auto-loading; psql confirms 4 tables + user_role enum + FKs)
  - [x] Signup → signin → role dashboard flow exercised in browser at `localhost:3000` (Playwright, see Session Log)
  - [ ] Deployed smoke test against dev env
- [ ] **Phase 2 — Lawyer onboarding** *(API smoke test passed; browser walkthrough pending)*
  - [x] Drizzle schema: 11 new tables (ibp_chapter, practice_area, jurisdiction, lawyer_profile, lawyer_practice_area, lawyer_jurisdiction, kyc_submission, kyc_document, office, office_schedule, office_faq) + `kyc_status` + `kyc_document_kind` enums
  - [x] Migration `0001_military_maggott.sql` applied; total: 15 tables in dev
  - [x] Reference data seeded (`pnpm db:seed`): 13 IBP chapters, 15 practice areas, 10 jurisdictions, stable slug IDs, idempotent re-runs
  - [x] Shared Zod schemas: lawyer profile/patch, KYC submission, office input/patch/schedule/FAQ, file presign request/response, role assignment
  - [x] Hono routes: `/accounts/me`, `/accounts/role` (promotion), `/lawyers/profile`, `/lawyers/kyc`, `/lawyers/office`, `/lawyers/office/schedule`, `/lawyers/office/faqs`, `/references/*`, `/webhooks/idmeta`, `/files/presign` (dev stub) + `/files/_dev/upload`
  - [x] Next.js pages: `/become-a-lawyer`, `/lawyer/dashboard` (status chips), `/lawyer/profile` (form + reference dropdowns/checkboxes), `/lawyer/kyc` (form with browser-side presigned upload via Next proxy), `/lawyer/office` (office + 7-day schedule + FAQ CRUD)
  - [x] Server Actions in `apps/web/lib/actions/{role,lawyer}.ts` forward session cookies to api via `lib/api.ts`
  - [x] Full API smoke (`curl`): signup → promote → patch profile → submit KYC → IDMeta webhook approves → create office → set schedule → add FAQ. DB verified.
  - [ ] Browser walkthrough of `/become-a-lawyer → onboarding flow` (Playwright MCP currently unavailable)
  - [ ] Real S3 presigning (stub in dev; lands when CDK provisions the bucket)
  - [ ] Deployed smoke test against dev env
- [ ] **Phase 3 — Client onboarding & lawyer discovery** *(API + SSR smoke test passed; browser walkthrough pending)*
  - [x] Drizzle schema: `client_profile` (userId PK/FK to user; displayName, phone, city, region, preferredLanguage)
  - [x] Migration `0002_tired_roland_deschain.sql` applied; total: 16 tables in dev
  - [x] Shared Zod schemas: `clientProfileInput`/`clientProfilePatch`, `lawyerSearchQuery`, `lawyerSearchResultItem`
  - [x] Hono routes: `/accounts/profile` GET/PATCH (auth'd, auto-create on first read); public `/directory/lawyers` (search w/ q + practiceAreaId + jurisdictionId + city + page/pageSize); public `/directory/lawyers/:slug` (full profile w/ practice areas, jurisdictions, IBP chapter, office, schedule, FAQs) — both directory endpoints visible-only to KYC-approved lawyers
  - [x] Next.js public pages: `/lawyers` (SSR directory with filter sidebar + pagination, MetaData for SEO) and `/lawyers/[slug]` (SSR public profile with generateMetadata, Google Maps iframe via lat/lng or address, weekly schedule grid, FAQ list)
  - [x] Next.js client portal: `/profile` editor (Server Action), dashboard now links to `/lawyers` + `/profile`
  - [x] Middleware allows public access to `/lawyers` + `/lawyers/[slug]` (SEO + anonymous browse)
  - [x] Full API + SSR smoke (`curl`, 17 checks): client signup → auto-create profile → patch → verify; public search no-filter, by-practice-area, by-city, by-q (positive + empty); 404 for unverified lawyer slug; pagination beyond range; Next.js SSR `/lawyers`, `/lawyers/[slug]`, `/lawyers/<bad>` all 200/200/404. DB verified.
  - [ ] Browser walkthrough of the directory + public profile + client profile editor (Playwright MCP currently unavailable)
  - [ ] Real Google Maps Embed API + key (dev uses keyless `google.com/maps?q=…&output=embed` which works without an API key)
  - [ ] Deployed smoke test against dev env
- [ ] Phase 4 — Cases & engagements (paid + pro bono unified, accept/decline, activities, notes)
- [ ] Phase 5 — Billing (invoices, PayMongo + PayPal + webhooks, discount codes)
- [ ] Phase 6 — Referrals + pro bono polish (referral graph, IBP chapter integration)
- [ ] Phase 7 — Admin portal (account oversight, verification approvals, discount mgmt)
- [ ] Phase 8 — Hardening (Playwright E2E, observability alarms, load test, marketing MDX)

---

## Session Log

### 2026-05-20 — Session 5 (Phase 3 client onboarding + lawyer discovery)

- **Did:**
  - Schema: `client_profile` aggregate (`packages/db/src/schema/clients.ts`) — 1:1 with `user` via userId PK/FK + cascade delete. Migration `0002_tired_roland_deschain.sql` applied; 16 tables total.
  - Shared Zod: `client.ts` (`clientProfileInput`/`Patch`) and `search.ts` (`lawyerSearchQuery` with coerce-int pagination, `lawyerSearchResultItem`).
  - Hono: extended `/accounts` with profile GET (lazy-create on first read) + PATCH (upsert via `onConflictDoUpdate`); new public router `directory.ts` mounted at `/directory` with `/lawyers` search and `/lawyers/:slug` profile. Search is paginated and filterable; visibility scope is "current KYC submission = approved" — unverified lawyers never appear and slug lookup returns 404 to not leak existence.
  - Next.js: public pages under `(marketing)` route group — `/lawyers` (filter sidebar + result cards + pagination, full `metadata`) and `/lawyers/[slug]` (`generateMetadata` for SEO, Google Maps iframe via lat/lng → fallback to address, weekly schedule grid, FAQ list). Client portal gains `/profile` editor (form + Server Action) and dashboard tiles linking to `/lawyers` and `/profile`.
  - Middleware: extended `isPublic` to allow unauthenticated access to `/lawyers` + `/lawyers/[slug]` (SEO + anonymous browse). Other paths stay gated.
  - Smoke test via curl (17 checks): client signup → auto-create profile on first GET → PATCH → re-GET; public search no-filter / by-practice / by-jurisdiction-equivalent (via city) / by-q (positive + empty); 404 on unverified slug; pagination beyond range. Next.js SSR `/lawyers`, `/lawyers/atty-final`, `/lawyers/nonexistent` returned 200/200/404. DB verified.
- **Did NOT:**
  - Browser walkthrough (Playwright MCP still unavailable; same situation as Phase 2). API + SSR HEAD-level smoke is conclusive.
  - Real Google Maps Embed API + key (kept the keyless `google.com/maps?q=…&output=embed` for dev; production swap is a one-line change once the key is provisioned in Secrets Manager).
  - "Favorite a lawyer" or saved searches (Phase 6 polish item).
  - Distance/geo search (no PostGIS or lat-lng radius filter at MVP; city ILIKE is enough until we have real lawyer volume).
  - Public profile photo rendering (lawyer_profile.profile_photo_s3_key exists; needs S3 presign on the read path — lands when real S3 is wired).
- **Decisions made:**
  - "Verified" gate for the directory = newest `kyc_submission` for the lawyer has `status='approved'`. Why: a lawyer who had an approved submission then resubmitted (now pending/rejected) should drop off the directory until re-approved; using the freshest row reflects current trust. **How to apply:** any read path that surfaces a lawyer publicly must apply this same `(newest row WHERE status='approved')` gate, not "exists any approved submission".
  - Public `/directory` namespace separate from the auth-gated `/lawyers` Hono router. Why: `requireRole("lawyer")` is mounted at `use("*", ...)` on the existing `lawyers` router and would block public traffic; using a separate router at a separate prefix keeps the auth boundary clean. **How to apply:** anything public-readable about lawyers goes under `/directory`; anything for the signed-in lawyer themself goes under `/lawyers`.
  - Lazy initialization of `client_profile` on first GET. Why: keeps signup cheap (no extra write at sign-up time), avoids a backfill migration for any pre-Phase-3 users, and keeps the auth + role tables independent of the profile aggregate. **How to apply:** future per-user "shadow" aggregates (notification prefs, billing prefs) can follow the same lazy-create pattern.
  - Google Maps embed via keyless `https://www.google.com/maps?q=…&output=embed`. Why: works in dev with zero config, no quota tracking, no key rotation. Production cutover is one helper function (`mapsEmbedSrc`) — swap for the Embed API URL when the key lands. **How to apply:** never query the Embed API from the browser without a domain-restricted key; keep all key references behind a server-side helper.
- **Open questions:** none — pre-existing Playwright UI gap remains the only outstanding item.

### 2026-05-20 — Session 4 (Phase 2 lawyer onboarding)

- **Did:**
  - Schema: 11 new tables across `packages/db/src/schema/{reference,lawyers,kyc,offices}.ts`; one migration generated and applied (`0001_military_maggott.sql`); reference data seeded via `pnpm db:seed` (idempotent).
  - Bumped drizzle-orm to ^0.45.2 and drizzle-kit to ^0.31.0 to satisfy better-auth's drizzle-adapter peer requirement.
  - Shared Zod schemas for every Phase 2 input (lawyer profile/patch, KYC, office, schedule, FAQ, file presign, role assignment).
  - Hono API: full CRUD for lawyer profile, KYC submission, office, schedule, FAQs + reference reads + IDMeta webhook (inline processing for dev; same logic moves to SQS worker later).
  - Next.js: `/become-a-lawyer` promotion page + Server Action; new `/lawyer/{dashboard,profile,kyc,office}` pages with client forms, dropdowns, checkboxes, file upload widget; cookie-forwarding `lib/api.ts` + `/api/files/presign-proxy` for browser-side presigned URLs.
  - Smoke test via curl: signup → promote → patch profile → submit KYC → webhook approves → create office → set schedule → add FAQ → DB verification all green.
- **Did NOT:**
  - Browser walkthrough (Playwright MCP disconnected mid-session). API smoke is conclusive; UI walkthrough deferred to next session.
  - Real S3 presigning (intentional — dev stub returns local URL).
  - Profile slug uniqueness retry beyond 5 attempts (good enough at MVP scale).
  - SQS worker implementation (the webhook handler in `apps/api/src/routes/webhooks.ts` does the work inline; `workers/idmeta/handler.ts` will reuse it when SQS lands in deploy).
- **Decisions made:**
  - Cookie cache disabled (was 5min). Why: role promotion needs to take effect on the next request, not 5 minutes later. Re-enable with a short TTL only after we route role changes through Better Auth's own `updateUser` (which invalidates the cache for us).
  - `apps/api/src/load-env.ts` side-effect-only module imported first in `dev.ts`. Why: ESM hoists imports above top-level statements within a module, so a `loadEnv()` call in `dev.ts`'s body runs AFTER `@ligala/auth` (which reads `process.env` at import time). A separate module's top-level statements run when the import is evaluated, in source order — so `import "./load-env"` first guarantees env is set before `import "./app"` triggers downstream `process.env` reads.
  - Office FAQs are append-only with sortOrder set by the client (current count). Resorting is a Phase 6 polish item.
  - One office per lawyer at launch (unique constraint). Multi-office support arrives if/when a paid firm asks.
- **Open questions:** none — pre-existing Playwright UI gap is the only outstanding item.

### 2026-05-20 — Session 3 (Phase 1 browser smoke test + local stack)

- **Did:**
  - `docker compose up -d` — Postgres 16 + Redis 7, both healthy in <15s. Round-tripped a Redis key as a sanity check.
  - `pnpm db:migrate` — applied `0000_regular_rachel_grey.sql` against local Postgres (`packages/db/drizzle.config.ts` now loads `.env.local` via `dotenv`). Verified 4 tables + `user_role` enum + FKs.
  - Wrote `.env.local` for `apps/web`, `apps/api`, `packages/db` (all gitignored; real 32-byte BETTER_AUTH_SECRET).
  - `pnpm dev` — Next on :3000, Hono on :8787. Both `/health` and `/api/health` returned 200.
  - Playwright walkthrough:
    1. `/` → "Sign in" / "Create account" links render.
    2. `/signup` → filled name/email/password, submitted. POST `/api/auth/sign-up/email` returned 200.
    3. Auto-navigation to `/dashboard` → **first run failed**: middleware redirected to `/login?next=/dashboard` because `getSessionCookie(request)` was looking for `better-auth.session_token` but our `cookiePrefix: "ligala"` set it as `ligala.session_token`.
    4. Fixed: middleware passes `{ cookiePrefix: "ligala" }` to `getSessionCookie`. Retried — `/dashboard` rendered "Welcome back, signed in as test@ligala.local (role: client)".
    5. `/lawyer/dashboard` as a client → redirected back to `/dashboard` via the `(lawyer)` layout's role guard.
    6. POST `/api/auth/sign-out` (with `Content-Type: application/json`) → 200, cookie cleared.
    7. `/dashboard` while logged out → middleware redirected to `/login?next=/dashboard`.
    8. Filled `/login`, submitted → 200, landed on `/dashboard`, role-correct render.
  - Screenshot kept at `apps/web/.playwright-mcp/phase1-dashboard-after-signin.png` (gitignored if `.playwright-mcp` is ignored; otherwise rotate it).
- **Did NOT:**
  - Test the lawyer role end-to-end (would require flipping the test user's role via psql; the cross-role guard direction is symmetric so the inverse is covered by inspection).
  - Cross-origin session sharing between web (:3000) and api (:8787). Phase 1 didn't require it; first cross-call lands in Phase 2 when the lawyer profile endpoint goes live.
  - AWS dev deploy.
- **Decisions made:**
  - Middleware passes `{ cookiePrefix: "ligala" }` to `getSessionCookie`. Added below.
- **Open questions:** none — Phase 1 is functionally complete locally.

### 2026-05-20 — Session 2 (Phase 1 auth foundation)

- **Did:**
  - Wrote Drizzle schema for Better Auth (`user`, `session`, `account`, `verification`) + `user_role` enum + custom `role` column on user.
  - Generated first migration via `drizzle-kit generate` → `drizzle/0000_regular_rachel_grey.sql` (4 tables, 2 FKs, 1 enum).
  - Configured Better Auth in `packages/auth/src/index.ts` (Drizzle adapter, email/password, conditional Google OAuth, `additionalFields.role`, 7-day sessions with 5-min cookie cache).
  - Mounted auth catch-all in `apps/web/app/api/auth/[...all]/route.ts` via `toNextJsHandler`.
  - Replaced Hono `/auth` route stub with Better Auth catch-all.
  - Added `requireSession` and `requireRole(...)` middleware factories in `apps/api/src/middleware/session.ts` with context augmentation for `user`/`session`.
  - Added Next.js client helper (`lib/auth-client.ts`) and server helper (`lib/session.ts` with `getSession`/`requireSession`).
  - Replaced pass-through Next.js middleware with edge-safe cookie check + redirect-to-`/login` logic.
  - Guarded `(client)`, `(lawyer)`, `(admin)` route group layouts with session + role checks, redirecting mismatches to the right portal home via new `lib/role.ts`.
  - Built minimal `/login` and `/signup` client components (no design system polish yet).
  - Updated root `/` to point to `/login` and `/signup`.
- **Did NOT:**
  - Apply the migration (needs a running Postgres; will run when local docker-compose lands or after CDK deploys Aurora).
  - Exercise the flow in a browser (deferred; pages typecheck and build, full smoke test pending).
  - Email verification / magic links (deferred to Phase 7+ per plan).
  - SES wiring (Phase 2+).
- **Decisions made:** five additions to Decisions Log above (`.js` extensions, db placeholder URL, auth secret placeholder, role enum, middleware split).
- **Open questions:**
  - Resolved same session: docker-compose for local Postgres + Redis (Postgres 16, Redis 7).

### 2026-05-20 — Session 1 (Phase 0 scaffolding)

**Commit:** `d687eaf` — `chore: scaffold ligala-v2 monorepo (Phase 0)` (85 files)

- **Did:**
  - Initialized git repo (main branch) at `C:\Users\dejes\munus\ligala\ligala-v2`
  - Created full monorepo directory tree
  - Wrote root config files (pnpm-workspace.yaml, turbo.json, tsconfig.base.json, .gitignore, .editorconfig, .nvmrc, .env.example)
  - Wrote app skeletons: Next.js 15 (`apps/web`) with route groups for (client)(lawyer)(admin)(marketing) and `/api/health`; Hono (`apps/api`) with `/health` and per-domain route stubs.
  - Wrote package skeletons: `@ligala/db` (Drizzle config + empty schema), `@ligala/auth` (Better Auth config), `@ligala/ui` (shadcn entry), `@ligala/shared` (Zod schemas + errors), `@ligala/email` (React Email).
  - Wrote CDK infra skeleton: `CoreStack` (VPC + Aurora + Redis + S3 + SES stubs) and `AppStack` (API Lambda + workers + SQS + EventBridge stubs).
  - Wrote workers skeleton (paymongo, paypal, idmeta, email, image handlers).
  - Wrote GitHub Actions CI workflow.
- **Did NOT:**
  - `pnpm install` (deferred — explicit step for dev to run after review)
  - Sentry DSN wiring (waiting on org Sentry project creation)
  - CDK `synth` / `deploy` (waiting on AWS creds + dev account)
  - Drizzle schema beyond Better Auth tables (each phase adds its own aggregates)
- **Decisions made:** captured in Decisions Log below.
- **Open questions:** none at scaffold level.

---

## Decisions Log

*Append-only. Each decision: date, what, why, revisit-when.*

- **2026-05-20 — Stack frozen at plan-approval time.** Next.js 15 + Hono + Aurora Serverless v2 Postgres + Drizzle + Better Auth + Tailwind v4 + shadcn/ui + CDK + GitHub Actions + Sentry + SES. Why: see `docs/` plan. Revisit: never as a bundle — only individual swaps with justification.
- **2026-05-20 — Single Next.js app, role-based route groups.** `(client)`, `(lawyer)`, `(admin)`, `(marketing)`. Why: smallest infra surface; role gating in middleware. Revisit: if admin compliance posture diverges (Phase 7+).
- **2026-05-20 — Drop from v1: Auth0, Azure MSAL, Builder.io, Web3, 3-mode API switcher, per-endpoint Lambdas, dual KYC components.** Why: see plan rationale.
- **2026-05-20 — Day-one integrations: PayMongo, PayPal, IDMeta KYC, Google Maps, CD Asia.** Why: confirmed during planning.
- **2026-05-20 — Sign-in methods at launch: email/password + Google OAuth only.** Microsoft OAuth and magic-link deferred to Phase 7+.
- **2026-05-20 — Sharp in dedicated Lambda layer (carry pattern from v1).** Why: avoids Next.js Image runtime cost for the high-volume KYC upload path.
- **2026-05-20 — `verbatimModuleSyntax: true` in `tsconfig.base.json`.** Why: forces explicit `import type` everywhere, which Drizzle and Next.js Server Actions are picky about.
- **2026-05-20 — Pinned zod to `^4.0.0` repo-wide and Hono to `^4.10.0` / `@hono/zod-validator` to `^0.8.0`.** Why: Better Auth's `better-call` requires zod v4, and `@hono/zod-validator@0.8` is the first version with dual zod v3/v4 peer support. Resolves peer-dep warning from initial install. **Migration impact:** `z.string().url()` and `z.string().email()` are deprecated in zod 4 (still work); prefer `z.url()` / `z.email()` in new schemas.
- **2026-05-20 — Drop `.js` extensions in internal TS imports across the repo.** Why: drizzle-kit's CJS loader couldn't resolve `./schema/index.js` (no `.ts` rewriting). Next.js webpack also failed with `.js` extensions in transpiled workspace packages. Bundler-mode TS, esbuild, and Next webpack all accept extensionless. Reverting only one file would be inconsistent. **How to apply:** all relative imports within and between workspace packages use bare specifiers (`"./client"`, not `"./client.js"`). External package imports unchanged.
- **2026-05-20 — `packages/db` `db()` falls back to a placeholder Postgres URL.** Why: Next.js's `next build` page-data collection step evaluates server modules; without `DATABASE_URL` the old hard-throw aborted builds. postgres-js lazy-connects, so the placeholder is safe — first real query fails loudly with a connection error. **How to apply:** never rely on the placeholder silently in prod; surface DATABASE_URL absence at deploy time via env checks elsewhere.
- **2026-05-20 — `packages/auth` seeds `process.env.BETTER_AUTH_SECRET` with a placeholder if missing.** Why: Better Auth performs its own env lookup at init independent of the config-passed `secret` and throws during `next build` page collection if absent. Placeholder unblocks builds. **How to apply:** real secret MUST be injected before serving traffic; the placeholder string is deliberately recognizable in logs.
- **2026-05-20 — Role on `user` table is a Postgres enum (`user_role`), not text.** Values: `client | lawyer | admin`. Why: enum gives DB-level integrity; tight value set means migration cost for new roles is acceptable. Mapped from Better Auth's `additionalFields` (which TS-types it as `string | null | undefined` regardless — we narrow at consumers).
- **2026-05-20 — Edge middleware does cookie presence only; role gating lives in route group layouts.** Why: Better Auth's session resolution needs Node runtime (jose, DB). Layouts are server components that can call `getSession()` against the DB. Middleware handles the cheap "are you signed in?" check that catches 99% of unauthorized hits before they reach a layout.
- **2026-05-20 — Local dev uses `docker compose` for Postgres 16 + Redis 7.** Why: parity with prod (Aurora Serverless v2 Postgres 16, ElastiCache Redis 7); zero-cost; survives `down`/`up` cycles via named volumes (`pgdata`, `redisdata`). `drizzle.config.ts` loads `.env.local` via `dotenv` so `pnpm db:migrate` works without manual env exports.
- **2026-05-20 — Edge middleware passes `cookiePrefix: "ligala"` to `getSessionCookie`.** Why: Better Auth's helper defaults to the standard `better-auth.session_token` cookie name; our config sets a custom `cookiePrefix: "ligala"`, producing `ligala.session_token`. Without the prefix arg, middleware sees no session and 100% of signed-in users get redirected to `/login` (caught during the first Playwright run). **How to apply:** any reader of the session cookie outside the Better Auth instance itself must thread the same `cookiePrefix`. If we ever change the prefix, this is the second place to update.
- **2026-05-20 — Better Auth session cookie cache disabled.** Why: cookie cache (default 5min) holds onto the old `role` field after a client→lawyer promotion, breaking `requireRole("lawyer")` for the entire cache window. With cache off, every request validates against DB — small per-request cost in exchange for instant role propagation. **How to apply:** revisit only after routing role changes through Better Auth's `updateUser` API (which invalidates the cache automatically); then we can re-enable cookieCache with a short maxAge (e.g. 30s).
- **2026-05-20 — `apps/api` env loading via dedicated side-effect module.** Why: ESM hoists imports above top-level statements *within* a module, so calling `dotenv.config()` inline in `dev.ts` runs AFTER `@ligala/auth` (imported transitively) has already read `process.env.BETTER_AUTH_SECRET`. A separate `load-env.ts` whose imports run first means its `loadEnv()` call executes before sibling imports load downstream modules. **How to apply:** any process that needs env vars set before module-evaluation reads must use a side-effect-only `import "./load-env"` as the FIRST import, not an inline call.
- **2026-05-20 — Server Actions forward session cookies to Hono via `apps/web/lib/api.ts`.** Why: browser cookies set on `localhost:3000` are not sent to `localhost:8787` (port differs → different origin per cookie spec). Server-side fetch via `headers()` reads the incoming request cookie and re-sends it; api validates the same Better Auth session. Browser-direct calls to api are blocked by design — except `/api/files/presign-proxy` which exists for client-side file uploads and forwards cookies similarly. **How to apply:** never call the api from a Client Component directly; always go through a Server Action or a `/api/*` proxy route.
- **2026-05-20 — Public lawyer endpoints live under `/directory`, not `/lawyers`.** Why: the existing `lawyers` Hono router applies `use("*", requireRole("lawyer"))`, which would 401/403 anonymous traffic. A separate router at a separate prefix keeps the auth boundary explicit instead of relying on per-route ordering. **How to apply:** anything public-readable about lawyers → `/directory/*`; anything for the signed-in lawyer themself → `/lawyers/*`. Web URLs (`/lawyers`, `/lawyers/[slug]`) are unaffected — they're a different namespace (Next.js routes), and the SSR pages call `/directory/*` server-side.
- **2026-05-20 — "Visible in directory" = newest `kyc_submission` for the lawyer has `status='approved'`.** Why: lets a lawyer drop off the directory automatically if they resubmit and the new submission is pending or rejected, even though they had an earlier approval. Using "any approved row" would let a fraud rescind never go dark. **How to apply:** every public read path that surfaces a lawyer must apply the freshest-row filter, not exists-approved.
- **2026-05-20 — `client_profile` is lazy-created on first GET.** Why: keeps signup cheap, no backfill needed for any pre-existing users, and decouples the profile aggregate from auth. **How to apply:** future per-user shadow aggregates (notification prefs, billing prefs) follow the same lazy-create pattern; never assume the profile row exists before the user opens the relevant page.
- **2026-05-20 — Google Maps embed via keyless `google.com/maps?q=…&output=embed`.** Why: works in dev without provisioning a key, no quota tracking, no rotation risk. Production swap is one helper (`mapsEmbedSrc` in `apps/web/app/(marketing)/lawyers/[slug]/page.tsx`) — point at the Embed API URL when the key is in Secrets Manager. **How to apply:** all map URL construction must go through that helper so the cutover is one file; never reference a key in client code (use a domain-restricted key + server-side URL building).

---

## Deferred Items

*Tracked, not forgotten. Each: what, why deferred, when to revisit.*

- **Microsoft OAuth in Better Auth** — Deferred to Phase 7+. Revisit if law-firm pilots ask for it.
- **Magic-link auth** — Deferred to Phase 7+. Revisit if password-reset volume becomes painful.
- **Next.js hosting choice: Amplify vs SST/Lambda** — Defaulting to Amplify in Phase 0. Revisit at Phase 8 if RSC streaming behavior is unsatisfactory.
- **Aurora min-ACU tuning** — Starting at 0.5 dev / 1.0 prod. Revisit after Phase 8 load test.
- **Microsoft 365 SSO for law firms** — Not on roadmap; revisit if a paid firm asks.
- **Builder.io CMS replacement** — Marketing pages will be MDX inside `app/(marketing)`. Revisit if non-devs need to edit content regularly.
- **PayMongo + PayPal abstraction layer** — Per-provider implementations in Phase 5; refactor to a `PaymentProvider` interface only if/when a third provider lands.
- **Real S3 presigning** — `/files/presign` is a dev stub; will use `@aws-sdk/s3-request-presigner` against the CoreStack uploads bucket once CDK deploys to dev.
- **SQS worker for IDMeta** — Webhook processes inline in dev (`apps/api/src/routes/webhooks.ts`). When AWS SQS lands the same logic moves to `workers/idmeta/handler.ts`; keep the implementations identical so the cutover is one-line.
- **Office multi-instance** — One office per lawyer at launch (unique constraint on `office.lawyer_id`). Drop the unique + add a `primary` flag if a firm asks.
- **Profile slug uniqueness with smarter retry** — Currently 5 random suffix attempts before giving up. Fine at MVP scale; revisit if collisions are a real problem.
- **Re-enable cookie cache** — Currently off so role changes propagate instantly. Re-enable with short TTL after role updates go through Better Auth's own update path.
- **Google Maps Embed API + domain-restricted key** — Currently using the keyless `google.com/maps?q=…&output=embed` URL. Swap `mapsEmbedSrc()` in `apps/web/app/(marketing)/lawyers/[slug]/page.tsx` to the Embed API when the key is provisioned in Secrets Manager.
- **Public lawyer profile photo** — `lawyer_profile.profile_photo_s3_key` exists in schema but the public profile page doesn't render it yet. Needs read-side S3 presigning (or a CloudFront signed URL) once real S3 is wired.
- **Geo/distance search** — City filter is plain ILIKE today. PostGIS + lat/lng radius can replace it once we have enough verified lawyers that "near me" is meaningful.
- **Favorites + saved searches** — Deferred to Phase 6 polish. v1 had "saved lawyers" in StartPage; bring back only if user research shows demand.

---

## Maintenance Rule

Every PR that completes a phase milestone must:
1. Update **Current State** (active phase, last session, env status, next action).
2. Tick the **Phase Tracker** box with the commit SHA.
3. Append a **Session Log** entry (Did / Did NOT / Decisions / Open Questions).
4. Append to **Decisions Log** or **Deferred Items** if applicable.

Phase Tracker boxes are checked **only after** the deployed-env smoke test passes — not just local green.
