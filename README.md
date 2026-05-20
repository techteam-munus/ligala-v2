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

```bash
# Requires Node 20+, pnpm 9+
pnpm install

# Copy env templates (per app), fill in values
cp .env.example apps/web/.env.local
cp .env.example apps/api/.env.local

# Run dev (web on :3000, api on :8787)
pnpm dev

# Typecheck / lint / test the whole monorepo
pnpm typecheck
pnpm lint
pnpm test
```

## Status

Active development. See [`PROCESS.md`](./PROCESS.md) for the live phase tracker, session log, and decisions.
