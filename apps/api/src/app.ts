import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { health } from "./routes/health.js";
import { auth } from "./routes/auth.js";
import { lawyers } from "./routes/lawyers.js";
import { clients } from "./routes/clients.js";
import { cases } from "./routes/cases.js";
import { engagements } from "./routes/engagements.js";
import { billing } from "./routes/billing.js";
import { referrals } from "./routes/referrals.js";
import { files } from "./routes/files.js";
import { references } from "./routes/references.js";
import { integrations } from "./routes/integrations.js";
import { webhooks } from "./routes/webhooks.js";
import { admin } from "./routes/admin.js";
import { errorHandler } from "./middleware/error.js";

export function createApp() {
  const app = new Hono();

  app.use("*", logger());
  app.use(
    "*",
    cors({
      origin: (origin) => origin ?? "*",
      credentials: true,
    }),
  );

  app.route("/health", health);
  app.route("/auth", auth);
  app.route("/accounts", clients);
  app.route("/lawyers", lawyers);
  app.route("/cases", cases);
  app.route("/engagements", engagements);
  app.route("/billing", billing);
  app.route("/referrals", referrals);
  app.route("/files", files);
  app.route("/references", references);
  app.route("/integrations", integrations);
  app.route("/webhooks", webhooks);
  app.route("/admin", admin);

  app.onError(errorHandler);
  app.notFound((c) => c.json({ error: "not_found", path: c.req.path }, 404));

  return app;
}

export type App = ReturnType<typeof createApp>;
