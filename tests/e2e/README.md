# E2E suite

Golden-path Playwright specs for the local dev stack.

## Run locally

Bring up the dependencies first:

```sh
docker compose up -d            # Postgres + Redis
pnpm db:migrate                  # apply schema
pnpm db:seed                     # reference data (IBP chapters, practice areas, jurisdictions)
pnpm dev                         # web on :3000, api on :8787
```

In a second shell:

```sh
pnpm exec playwright install --with-deps chromium  # one-time
pnpm exec playwright test                          # run the suite
pnpm exec playwright test --ui                     # interactive runner
```

Override the targets if you want to run against a deployed dev env:

```sh
PLAYWRIGHT_BASE_URL=https://dev.ligala.ph \
  PLAYWRIGHT_API_URL=https://api.dev.ligala.ph \
  pnpm exec playwright test
```

## Coverage

- `marketing.spec.ts` — landing page + MDX pages (/about, /pricing, /terms, /privacy) + nav to /lawyers.
- `signup.spec.ts` — client signup → /dashboard; redirect of signed-in users away from /login.
- `lawyer-onboarding.spec.ts` — signup → promote → profile → KYC → IDMeta webhook → directory visibility.

Deeper API-level smoke (engagements, billing, refunds, admin) is covered by
the `curl` chains documented per phase in `PROCESS.md`. Adding a Playwright
spec for each one only earns its keep when it exercises the *UI* — otherwise
the curl chain is the cheaper test.

## Conventions

- Every spec uses `uniqueEmail()` so re-runs don't collide.
- Specs that need cookie-shared API calls go through the Next.js Server
  Actions (visit the page, fill the form, click submit) — Playwright's
  `request` fixture doesn't share the browser session out of the box.
