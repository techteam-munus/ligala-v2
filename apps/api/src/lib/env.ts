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
  // Comma-separated IPv4 CIDRs. Empty/unset = no IP gate (dev/test). Set on
  // the API Lambda when there's an office/VPN range to lock /admin/* to.
  ADMIN_IP_ALLOWLIST: z.string().optional(),
  EMAIL_QUEUE_URL: z.string().optional(),
  EMAIL_FROM: z.string().default("no-reply@mymunus.com"),
  EMAIL_REPLY_TO: z.string().default("support@mymunus.com"),
  EMAIL_VERIFICATION_REQUIRED: z.enum(["true", "false"]).default("false"),
  EMAIL_DEV_VERIFY_ENABLED: z.enum(["true", "false"]).default("false"),
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
