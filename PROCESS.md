# Ligala v2 — Process & Status

> Living dev log. Update at the **start and end of every working session** and **after every phase milestone**.
> Source of truth for "where are we right now" — readable by humans and by future Claude sessions.

---

## Current State

- **Active phase:** Phase 5 — Billing **DONE locally** (full 22-step API smoke test passed including invoice CRUD, discount apply, dev-simulate checkout, webhook idempotency, ledger; awaiting browser walkthrough + AWS dev deploy + real provider keys)
- **Last working session:** 2026-05-20
- **Environment status:** local dev stack up (compose: Postgres 16 + Redis 7) | AWS dev not yet | staging not yet | prod not yet. **Playwright MCP intermittent** (briefly online this session, disconnected again before walkthrough could run).
- **Next action:** browser walkthrough of the billing flow + earlier-phase backlog, OR jump to Phase 6 (referrals + pro bono polish), OR wire real PayMongo + PayPal signature verification.
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
- [ ] **Phase 4 — Cases & engagements** *(23-step API smoke test passed; browser walkthrough pending)*
  - [x] Drizzle schema: 5 new tables (case, case_activity, case_note, case_attachment, engagement) + 6 enums (case_type, case_status, case_activity_kind, case_note_visibility, engagement_rate_type, engagement_status)
  - [x] Migration `0003_burly_rhino.sql` applied; total: 21 tables in dev
  - [x] Shared Zod schemas: case (`caseCreateInput`, `caseDecisionInput`, `caseCloseInput`, `caseNoteInput`, `caseAttachmentInput`) + engagement (`engagementInput` with rate-type cross-field refine, `engagementDecisionInput`)
  - [x] Hono `/cases`: list (role-scoped), POST (clients only, requires lawyer slug + verified KYC), GET/:id, POST/:id/decision (lawyer accept/decline, pro bono jumps to active), POST/:id/close (close=either-party when active, cancel=client-only pre-active), notes GET+POST with visibility filtering (`shared` for both, `lawyer` for lawyer-only, `client` for client-only — clients can't post lawyer-only and vice versa), attachments GET+POST, activities GET (append-only timeline written by every state-changing handler)
  - [x] Hono `/engagements`: POST `/engagements/cases/:caseId` (lawyer sends terms, paid+accepted only), POST `/engagements/:id/decision` (client signs → engagement signed + case → active; client declines → engagement declined)
  - [x] Next.js client portal: `/cases` (list), `/cases/new?lawyer=slug` (form), `/cases/[id]` (detail w/ sign/decline engagement, add note, attach file, cancel/close)
  - [x] Next.js lawyer portal: `/lawyer/cases` (3-bucket inbox: pending / open / closed), `/lawyer/cases/[id]` (detail w/ accept/decline, send engagement, notes/attachments, close)
  - [x] Shared `app/_components/case-detail.tsx` renders the same case view for both client + lawyer with role-conditional action sections (saves duplicating ~500 LOC)
  - [x] "Engage this lawyer" CTA on `/lawyers/[slug]` → `/cases/new?lawyer=slug` (middleware redirects unauthed to /login?next=…)
  - [x] Lawyer dashboard now shows pending/active case counts; client dashboard links to /cases
  - [x] Full API smoke (`curl`, 23 checks): paid case lifecycle (create → accept → engagement sent → signed → active → notes (shared+lawyer-only, visibility-filtered) → attachment → close); pro bono (create → accept → straight-to-active); decline; ACL (outsider gets 403); state guard (re-decision after decline 409). DB verified.
  - [ ] Browser walkthrough of the engage/decide/sign/close flow (Playwright MCP currently unavailable)
  - [ ] Real S3 presigning for case attachments (dev stub same as KYC)
  - [ ] Deployed smoke test against dev env
- [ ] **Phase 5 — Billing** *(22-step API smoke test passed; browser walkthrough + real provider signature verification pending)*
  - [x] Drizzle schema: 5 new tables (invoice, invoice_line, discount_code, payment, transaction) + 5 enums (invoice_status, payment_provider, payment_status, discount_kind, transaction_kind, transaction_direction)
  - [x] Migration `0004_fresh_mercury.sql` applied; total: 26 tables in dev
  - [x] Shared Zod: invoiceCreateInput, invoiceLineInput, invoicePatch, invoiceVoidInput, discountCodeInput (cross-field refine on kind↔value), applyDiscountInput, checkoutInput, paymentWebhookInput
  - [x] Hono `/billing`: invoices list/create/read/patch (drafts only)/send/void, discount apply, checkout (returns provider URL), `/billing/dev/simulate-payment` (no-auth-style dev stub), transactions ledger
  - [x] Hono `/billing/discount-codes`: lawyer-owned codes (list + create); uppercase + unique per lawyer
  - [x] `apps/api/src/lib/billing.ts`: integer-cents math (computeLineTotalCents, computeDiscountCents), `newInvoiceNumber()` (INV-XXXXXX collision-retry)
  - [x] Webhook handlers: `/webhooks/paymongo` + `/webhooks/paypal` both normalize to the shared `applyPaymentWebhook(...)` helper. Idempotency via unique (provider, providerPaymentId) index; replay returns `{ idempotent: true }`. Success writes payment + transaction (ledger credit) + flips invoice status to paid (or partially_paid) + bumps discount code redemptions on first successful payment.
  - [x] Next.js client portal: `/invoices` list, `/invoices/[id]` detail (line items table, discount apply, pay widget with PayMongo / PayPal / Dev-Simulate buttons), client case detail links to invoices section
  - [x] Next.js lawyer portal: `/lawyer/invoices` list, `/lawyer/invoices/new?case=...` line-item editor, `/lawyer/invoices/[id]` detail (send + void), `/lawyer/discount-codes` create + list. Lawyer case detail page has "New invoice" CTA when case is accepted/active/closed.
  - [x] Shared `app/_components/invoice-detail.tsx` (Client Component, viewerRole prop): renders both client and lawyer views with role-conditional sections
  - [x] Dashboards: client + lawyer both gained an "Invoices" tile
  - [x] Full API smoke (`curl`, 22 checks): create draft with 2 line items (₱5,500 subtotal) → create LAUNCH10 (10% off) → apply → totals re-compute (₱4,950) → send → checkout via dev_simulate → POST checkoutUrl → idempotency replay no-ops → invoice flips to paid → ledger has charge row → discount redemptions=1 → 409 on pay/patch/void after paid → real `/webhooks/paymongo` no-auth POST flips a fresh invoice → outsider 403 → discount kind/value mismatch 400 → invoice on pending case 409.
  - [ ] Browser walkthrough of the lawyer-creates-invoice → client-pays flow
  - [ ] Real PayMongo + PayPal signature verification on inbound webhooks (deferred — drop-in once keys are provisioned)
  - [ ] Real PayMongo Checkout / PayPal Orders v2 redirect URL generation (deferred — wraps `/checkout` handler)
  - [ ] Refunds + partial-refunds (deferred to Phase 7 admin tooling)
  - [ ] Deployed smoke test against dev env
- [ ] Phase 6 — Referrals + pro bono polish (referral graph, IBP chapter integration)
- [ ] Phase 7 — Admin portal (account oversight, verification approvals, discount mgmt)
- [ ] Phase 8 — Hardening (Playwright E2E, observability alarms, load test, marketing MDX)

---

## Session Log

### 2026-05-20 — Session 7 (Phase 5 billing)

- **Did:**
  - Schema: 5 new aggregates (`invoice`, `invoice_line`, `discount_code`, `payment`, `transaction`) + 5 enums in `packages/db/src/schema/billing.ts`. Migration `0004_fresh_mercury.sql` applied; 26 tables total.
  - Shared Zod for invoice / discount / checkout / webhook payloads. `discountCodeInput` has a cross-field refine: kind=percent requires valueBps, kind=fixed requires valueCents; opposite slot must be null.
  - Hono `/billing` (auth'd, role-scoped reads; lawyer-only writes for invoice mutation; client-only checkout). Invoice lifecycle: draft → sent → paid (or partially_paid if a payment lands but doesn't cover the full total) | void. Lines are immutable once sent; discounts can still be applied while in `sent` state.
  - Helper `apps/api/src/lib/billing.ts`: `computeLineTotalCents` (integer math), `computeDiscountCents` (percent via bps, fixed via cents, both capped at subtotal), `newInvoiceNumber()` (INV-XXXXXX with 6-char alnum, 5-attempt retry on collision against the unique index).
  - Lawyer-owned discount codes: codes live in the lawyer's namespace (unique on (lawyerId, code)); validation matches by lawyer of the invoice. Redemptions counter bumped only on the first successful payment for an invoice (avoids double-counting on idempotent replay).
  - Payment webhooks: `/webhooks/paymongo` + `/webhooks/paypal` both validate `paymentWebhookInput`, then call the shared `applyPaymentWebhook(...)` helper. Idempotency via unique (provider, providerPaymentId) index — replay returns `{ idempotent: true, paymentId, status }` without re-applying. Dev simulate endpoint at `/billing/dev/simulate-payment` does the same thing for the in-house test path.
  - Next.js: client portal gains `/invoices` (list) + `/invoices/[id]` (detail with discount apply + pay widget); lawyer portal gains `/lawyer/invoices` (list) + `/lawyer/invoices/new?case=...` (line-item editor with live subtotal) + `/lawyer/invoices/[id]` (send + void) + `/lawyer/discount-codes` (list + create). Shared `app/_components/invoice-detail.tsx` powers both views via a `viewerRole` prop, same pattern as Phase 4's case-detail.
  - 22-step curl smoke (see Phase Tracker entry for the full chain). DB verified.
  - **Playwright MCP came back online mid-session, then disconnected again before any walkthrough could run.** Sweep across Phases 1–5 still queued.
- **Did NOT:**
  - Browser walkthrough (deferred; queued with Phase 1–4 walkthroughs).
  - Real PayMongo / PayPal signature verification on webhooks (dev accepts the normalized payload directly; production wiring is a one-file change in `webhooks.ts`).
  - Real PayMongo Checkout / PayPal Orders v2 URL generation in the `/checkout` handler (returns the dev simulate URL today).
  - Refunds + partial refunds (Phase 7 admin tooling; transaction kind enum already has `refund`).
  - Invoice PDF export (deferred — no real demand yet; Phase 8 or beyond).
  - Email-on-invoice-sent (SES wiring lands when AWS deploys).
- **Decisions made:**
  - Money is integer cents end-to-end. Discount values: bps for percent (1% = 100bps), cents for fixed. Both stored as nullable columns with a cross-field check at write time. Why: rerunning a percent code against a different subtotal recomputes deterministically with `floor((subtotal * bps) / 10_000)`; floats lose pennies. **How to apply:** Phase 7 admin tooling and any partial-refund flow uses the same integer convention; never introduce `numeric(10,2)` or float in money paths.
  - Webhook idempotency lives at the DB level via unique (provider, providerPaymentId). `applyPaymentWebhook` is shared by both real webhook endpoints AND the dev simulate stub so replay-correctness is exercised by every smoke run. **How to apply:** when SQS workers in `workers/{paymongo,paypal}/handler.ts` land, they call the same helper — no duplicated logic.
  - Discount codes live in the lawyer's namespace (unique on (lawyerId, code)). Two lawyers can both have `LAUNCH10` with different rates without colliding. Why: simpler than a global namespace with admin moderation; no admin UI required at MVP; the validation path is `find where lawyerId=invoice.lawyerId AND code=...`. **How to apply:** if admin-level platform-wide codes are needed later, add `lawyerId IS NULL` as the "global" sentinel and update the lookup to `OR (lawyerId IS NULL)`.
  - Invoice number format = `INV-XXXXXX` (6 alphanumeric chars excluding I/O/0/1 ambiguity). Why: humans need to read these aloud over the phone; unique index + 5-attempt retry handles the rare collision. Per-lawyer sequential numbering would need row locks. **How to apply:** if compliance (PH BIR) requires monotonic per-lawyer sequence numbers, add `seq` column + per-lawyer counter table; the current `number` becomes a secondary display.
  - Dashboard tiles standardized at 4-column grid for both portals. Each role's nav surface is now: cases / invoices / public-profile / office (lawyer); find / cases / invoices / profile (client). **How to apply:** new top-level features get their own tile only after the user can actually do something useful with them; intermediate nav lives behind the tile.
  - Discount can still be applied while invoice is in `sent` state (not just `draft`). Why: lawyers can negotiate post-send; locking discounts at send-time forces re-issuing an invoice for any negotiation. **How to apply:** locking happens at the first successful payment via the invoice state machine (paid + partially_paid both reject discount changes).
- **Open questions:** none — Playwright sweep + AWS deploy are the standing items.

### 2026-05-20 — Session 6 (Phase 4 cases + engagements)

- **Did:**
  - Schema: 5 new aggregates (`case`, `case_activity`, `case_note`, `case_attachment`, `engagement`) + 6 enums in `packages/db/src/schema/cases.ts`. Migration `0003_burly_rhino.sql` applied; 21 tables total in dev.
  - Shared Zod: `case.ts` + `engagement.ts` with cross-field refine (rate amount must match `rateType`).
  - Hono `/cases`: role-scoped list, create (client + KYC-verified lawyer slug), decision (lawyer accept/decline; pro bono jumps to active), close (close=active only by either party; cancel=client-only pre-active), notes GET+POST with visibility filtering, attachments GET+POST (s3Key + metadata), activities GET (read-only timeline). Every state-changing handler writes a `case_activity` row via the `logActivity` helper.
  - Hono `/engagements`: `POST /engagements/cases/:caseId` (lawyer sends, paid+accepted only) and `POST /engagements/:id/decision` (client signs → engagement signed + case active; or client declines).
  - Next.js: `(client)/cases/{list,new,[id]}` + `(lawyer)/lawyer/cases/{list,[id]}`. Shared `app/_components/case-detail.tsx` renders the case view for both sides with role-conditional sections (saves ~500 LOC of duplicate UI). Client dashboard gains a "Your cases" tile; lawyer dashboard shows pending/active counts; public lawyer profile gains the "Engage this lawyer" CTA which routes to `/cases/new?lawyer=<slug>` (middleware redirects unauthed users to login with `next` set).
  - 23-step curl smoke: paid (create → accept → engagement sent (hourly @ ₱2,500/hr) → client signs → status flips to active → client adds shared note → lawyer adds lawyer-only note → client sees 1 note, lawyer sees 2 → attachment added → outsider gets 403 → lawyer closes); pro bono (create → accept → jumps to active, no engagement); decline (lawyer declines → status=declined → re-decision returns 409). Full activity timeline (9 rows for the paid case) verified.
- **Did NOT:**
  - Browser walkthrough (Playwright MCP still down).
  - Real S3 presigning for case attachments (same dev stub as KYC; flips when real S3 lands).
  - Reopen / restart of closed cases (intentional — terminal status; reopening is a Phase 6+ polish item).
  - Lawyer search "engage" deep linking to a draft case row (the form just pre-fills the lawyer slug; a "draft" concept would be Phase 6).
  - Editing or deleting notes/attachments (append-only by design at MVP; deferred).
- **Decisions made:**
  - Shared `app/_components/case-detail.tsx` (Client Component, marked `"use client"`) used by both `(client)/cases/[id]` and `(lawyer)/lawyer/cases/[id]`. Why: 90% of the UI is identical between the two roles — header, engagement section, notes, attachments, timeline. The only role-specific bits are which action buttons render (lawyer-only Accept/Decline + Send-engagement, client-only Sign/Decline-engagement). One component with a `viewerRole` prop is much easier to keep in sync than two copies. **How to apply:** any future detail page that's shown to multiple roles with mostly identical chrome should follow the same pattern (one component + `viewerRole`), not duplicate.
  - Append-only `case_activity` written by every state change. Why: gives both sides a complete, indelible timeline without needing to diff snapshots or parse audit logs in another system; payload as `jsonb` keeps the kind set small without losing context. **How to apply:** any new state mutation on a case MUST call `logActivity(...)` in the same handler; if you're adding a new kind, also add it to the `case_activity_kind` pgEnum (requires migration).
  - Pro bono cases skip engagement: lawyer accept goes pending → active directly, with a second `activated` activity for clarity. Why: free legal work shouldn't gate on a signed fee agreement; an explicit engagement row would just be empty/zero-rate noise. Re-introduce only if Bar regulation requires a written pro bono engagement letter. **How to apply:** the decision handler checks `caseRow.type === "probono"` and writes two activities; engagement-creation path explicitly rejects pro bono cases (`engagement_not_applicable`).
  - Rate amounts stored as integer cents (and contingency as basis points, 1%=100bps). Why: integer math is safe across JS/Postgres/JSON boundaries; floats accumulate error when discounted/multiplied; bps gives 0.01% precision which is more than enough for contingency tiers. **How to apply:** all payment-adjacent fields in Phase 5 (invoices, line items, discounts) follow the same integer-cents convention.
  - Note visibility: `shared` | `lawyer` | `client`. Clients can't post `lawyer`-only; lawyers can't post `client`-only. The server enforces this even though the UI hides the options — never trust the form. **How to apply:** any future per-role-private content (e.g., internal billing memos) reuses the same enum and the same `!includes(...visibilityForRole)` filter on read.
- **Open questions:** none — the pre-existing Playwright UI gap remains the only outstanding item.

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
- **2026-05-20 — Case detail page is one shared Client Component (`app/_components/case-detail.tsx`) with a `viewerRole` prop.** Why: ~90% of the UI is identical between client + lawyer views of a case (header, engagement panel, notes, attachments, timeline); only the action buttons differ. One component is easier to keep in sync than two duplicate ~500 LOC files. **How to apply:** detail pages shown to multiple roles with mostly identical chrome should follow the same pattern; the `_components` folder is private (Next.js excludes underscore-prefixed folders from routing) and is the home for non-routed shared UI.
- **2026-05-20 — Append-only `case_activity` written by every state change.** Why: gives both parties an indelible timeline without diff-ing snapshots; `payload` is `jsonb` so the kind enum stays small without losing context. **How to apply:** every handler that mutates a case calls `logActivity(caseId, actorUserId, kind, payload)`; adding a new kind requires adding the value to the `case_activity_kind` pgEnum + a migration.
- **2026-05-20 — Pro bono cases skip the engagement row.** Why: free legal work shouldn't gate on a signed fee agreement; an empty/zero-rate engagement is noise. The decision handler writes both `accepted` and `activated` activities for clarity. **How to apply:** any future `paid`-only behaviour gates on `caseRow.type === "paid"`; the engagement create endpoint explicitly returns `engagement_not_applicable` for pro bono.
- **2026-05-20 — Money fields are integer cents; contingency is basis points (1% = 100 bps).** Why: integer math is safe across JS/Postgres/JSON boundaries; floats accumulate error when discounted; bps gives 0.01% precision (way more than needed). **How to apply:** all payment-adjacent fields in Phase 5 (invoices, line items, discounts, refunds) use the same integer-cents + bps convention. Never store currency as `numeric(10,2)` or float.
- **2026-05-20 — Note visibility enforced server-side, not just hidden in UI.** Why: a malicious client could POST `visibility: "lawyer"` and try to read everyone else's private notes; the server rejects on write (clients can't post `lawyer`, lawyers can't post `client`) AND filters on read. **How to apply:** any future per-role-private content reuses the same enum + the `(includes(allowed) OR author=self)` filter pattern.
- **2026-05-20 — Payment-webhook idempotency lives at the DB level via unique (provider, providerPaymentId).** Why: webhooks retry on 5xx; the same providerPaymentId arriving twice MUST NOT double-credit the invoice or double-bump discount redemptions. The shared `applyPaymentWebhook(...)` helper detects the dup via the unique index and returns `{ idempotent: true }` early. **How to apply:** the dev simulate stub + future SQS workers all call the same helper — no place to forget the check.
- **2026-05-20 — Discount codes are lawyer-namespaced (unique on (lawyerId, code)).** Why: two lawyers can use the same code text with different rates; no admin moderation required at MVP; validation is a single equality query. **How to apply:** if platform-wide codes are needed later, add `lawyerId IS NULL` as a sentinel and OR it into the lookup; preserve uniqueness with a partial index.
- **2026-05-20 — Invoice numbers are `INV-XXXXXX` (6 alnum, ambiguity-free chars).** Why: must be readable aloud; per-lawyer sequential numbering would need row locks. Retry-on-collision against the unique index handles the rare hit (5 attempts cover 32^6 / 5 birthday probability). **How to apply:** if PH BIR compliance requires monotonic per-lawyer numbering, add a `seq` column populated from a per-lawyer counter; keep `number` as the friendly display.
- **2026-05-20 — Discount apply allowed in both `draft` AND `sent` states.** Why: lawyers may negotiate post-send; locking at send forces re-issue. Discount lock happens only when the first payment posts (status transitions to paid/partially_paid). **How to apply:** any other "post-send but pre-pay" mutation (memo update, due-date adjustment) should follow the same gate — allowed while `status IN ('draft','sent')`, rejected after first payment.

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
- **Case attachments via real S3 presigning** — Same dev stub as KYC (`/files/presign` returns a localhost upload URL). Flips when CoreStack provisions the uploads bucket.
- **Reopen / restart closed cases** — Currently terminal. Add a `reopen` activity kind + transition if user research shows demand; ideally rare.
- **Edit / delete notes + attachments** — Append-only at MVP. Edit-with-history is a Phase 6 polish if anyone asks (need a `case_note_revision` table to keep an audit trail).
- **Engagement amendments** — One engagement per case; lawyer can't send a revised one if the first is signed. Real-world workflow may need amendment-as-new-engagement (Phase 6+).
- **Multi-engagement / case bundling** — Each case has one lawyer + one engagement. Co-counsel and matter bundles are a future concern; revisit if firms ask.
- **Real PayMongo + PayPal signature verification** — Dev webhooks accept normalized JSON without signature check. Production wiring goes in `webhooks.ts` — for PayMongo, validate `X-Paymongo-Signature` HMAC; for PayPal, call `/v1/notifications/verify-webhook-signature`. Drop-in once keys land in Secrets Manager.
- **Real PayMongo Checkout / PayPal Orders v2 redirect URLs** — `/checkout` returns the dev simulate URL. Swap to provider URL builders behind the same response shape; the client UI doesn't need to change.
- **Refunds + partial refunds** — `transaction_kind` enum already includes `refund`; no handler yet. Add when a real refund happens or for Phase 7 admin tooling.
- **Invoice PDF export** — No PDF generator wired. Defer until a user actually asks; if needed, render via React Email + Puppeteer in a worker.
- **Invoice-on-send email via SES** — Lands with AWS deploy. Template lives in `packages/email/` (currently empty).
- **Per-case invoice filter on the case detail page** — The list endpoint doesn't accept a `caseId` filter yet; client case page shows all the user's invoices with a note. Add `?caseId=…` query param + filter on Phase 6 polish.
- **Platform fee / payouts** — Currently money flows lawyer ← client direct via PayMongo/PayPal merchant accounts. When we add a platform take rate, we need split-pay or a clearing account; add `fee` rows to the ledger.

---

## Maintenance Rule

Every PR that completes a phase milestone must:
1. Update **Current State** (active phase, last session, env status, next action).
2. Tick the **Phase Tracker** box with the commit SHA.
3. Append a **Session Log** entry (Did / Did NOT / Decisions / Open Questions).
4. Append to **Decisions Log** or **Deferred Items** if applicable.

Phase Tracker boxes are checked **only after** the deployed-env smoke test passes — not just local green.
