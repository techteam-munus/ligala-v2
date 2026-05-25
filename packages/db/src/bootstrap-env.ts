import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

let bootstrapped: Promise<void> | null = null;

/**
 * Populate process.env from AWS Secrets Manager during Lambda cold start.
 *
 * Two secrets are read:
 *   1. DB_MASTER_SECRET_ARN — Aurora-managed master credentials. Combined with
 *      DB_PROXY_ENDPOINT + DB_NAME to build DATABASE_URL.
 *   2. APP_SECRET_ARN — flat JSON of app-level values (BETTER_AUTH_SECRET +
 *      provider keys). Each key becomes a process.env entry, unless already set.
 *
 * Memoized: the SDK call only happens once per Lambda container.
 *
 * No-op when the *_ARN env vars are unset (i.e. local dev, where env.ts and the
 * Drizzle client read directly from .env.local).
 */
export function bootstrapEnv(): Promise<void> {
  if (bootstrapped) return bootstrapped;
  bootstrapped = run();
  return bootstrapped;
}

async function run(): Promise<void> {
  const region = process.env.AWS_REGION ?? "ap-southeast-1";
  const masterArn = process.env.DB_MASTER_SECRET_ARN;
  const appArn = process.env.APP_SECRET_ARN;

  if (!masterArn && !appArn) return;

  const sm = new SecretsManagerClient({ region });

  if (masterArn) {
    const result = await sm.send(
      new GetSecretValueCommand({ SecretId: masterArn }),
    );
    if (!result.SecretString) {
      throw new Error("DB master secret has no SecretString");
    }
    const creds = JSON.parse(result.SecretString) as {
      username: string;
      password: string;
      host?: string;
    };
    const host = process.env.DB_PROXY_ENDPOINT ?? creds.host;
    if (!host) {
      throw new Error(
        "DB_PROXY_ENDPOINT env var is unset and master secret has no host",
      );
    }
    const dbName = process.env.DB_NAME ?? "ligala";
    process.env.DATABASE_URL = `postgres://${encodeURIComponent(creds.username)}:${encodeURIComponent(creds.password)}@${host}:5432/${dbName}?sslmode=require`;
  }

  if (appArn) {
    const result = await sm.send(
      new GetSecretValueCommand({ SecretId: appArn }),
    );
    if (!result.SecretString) {
      throw new Error("App secret has no SecretString");
    }
    const app = JSON.parse(result.SecretString) as Record<string, unknown>;
    for (const [key, value] of Object.entries(app)) {
      if (typeof value !== "string" || value.length === 0) continue;
      if (process.env[key]) continue;
      process.env[key] = value;
    }
  }
}
