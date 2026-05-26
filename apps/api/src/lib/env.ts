import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  AWS_REGION: z.string().default("ap-southeast-1"),
  S3_UPLOADS_BUCKET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  PAYMONGO_SECRET_KEY: z.string().optional(),
  PAYMONGO_WEBHOOK_SECRET: z.string().optional(),
  // Disbursements / payouts
  PAYMONGO_TRANSFER_WEBHOOK_SECRET: z.string().optional(),
  // Source (platform) wallet account for batch_transfers — confirm in sandbox.
  PAYMONGO_WALLET_ACCOUNT_NUMBER: z.string().optional(),
  PAYMONGO_WALLET_ACCOUNT_NAME: z.string().default("Ligala"),
  PAYMONGO_WALLET_BIC: z.string().optional(),
  // Minimum withdrawal (PHP 500) + clearing window before earnings are withdrawable.
  PAYOUT_MIN_CENTS: z.coerce.number().int().positive().default(50000),
  PAYOUT_CLEARING_DAYS: z.coerce.number().int().min(0).default(3),
  // Comma-separated IPv4 CIDRs. Empty/unset = no IP gate (dev/test). Set on
  // the API Lambda when there's an office/VPN range to lock /admin/* to.
  ADMIN_IP_ALLOWLIST: z.string().optional(),
  EMAIL_QUEUE_URL: z.string().optional(),
  EMAIL_FROM: z.string().default("no-reply@mymunus.com"),
  EMAIL_REPLY_TO: z.string().default("support@mymunus.com"),
  EMAIL_VERIFICATION_REQUIRED: z.enum(["true", "false"]).default("false"),
  EMAIL_DEV_VERIFY_ENABLED: z.enum(["true", "false"]).default("false"),
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
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
    );
  }
  cached = parsed.data;
  return cached;
}
