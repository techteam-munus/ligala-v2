# Ligala v2

Greenfield rebuild of the Ligala legal-services platform.

## Stack

Next.js 15 (App Router) + Hono on AWS Lambda + Aurora Serverless v2 Postgres + Drizzle + Better Auth + Tailwind v4 + shadcn/ui, all deployed via AWS CDK.

See `docs/` for the architecture plan. See [`PROCESS.md`](./PROCESS.md) for current dev status.

## Layout

```
apps/
  web/   Next.js 15 (client-facing UI, RSC + Server Actions)
  api/   Hono service (REST + webhooks, deployed as one Lambda)
workers/  SQS-triggered Lambda handlers
packages/
  db/     Drizzle schema + migrations
  auth/   Better Auth (shared by web + api)
  ui/     shadcn primitives + design tokens
  shared/ Zod schemas, types, errors
  email/  React Email templates for SES
infra/    AWS CDK app (CoreStack + AppStack)
```

## Getting Started

Requires Node 20+, pnpm 9+, and Docker (for local Postgres + Redis).

```bash
# 1. Install deps
pnpm install

# 2. Bring up Postgres 16 + Redis 7
docker compose up -d

# 3. Apply DB migrations (loads .env.local automatically)
pnpm db:migrate

# 4. (First time only) seed env files for the apps. These are gitignored;
#    drop real values into them before running dev. A sensible local set is
#    already in this repo's git history if you scaffolded it; otherwise:
cp .env.example apps/web/.env.local
cp .env.example apps/api/.env.local
cp .env.example packages/db/.env.local

# 5. Run dev (web on :3000, api on :8787)
pnpm dev

# 6. Useful one-offs
pnpm typecheck
pnpm lint
pnpm test
pnpm db:studio          # Drizzle Studio
docker compose down     # stop services (keeps data)
docker compose down -v  # stop + wipe DB/Redis volumes
```

Default local credentials (set in `compose.yaml`): user `ligala`, password `ligala`, db `ligala_dev`.

## Status

Active development. See [`PROCESS.md`](./PROCESS.md) for the live phase tracker, session log, and decisions.
