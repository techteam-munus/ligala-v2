import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { health } from "./routes/health";
import { auth } from "./routes/auth";
import { lawyers } from "./routes/lawyers";
import { clients } from "./routes/clients";
import { cases } from "./routes/cases";
import { engagements } from "./routes/engagements";
import { billing } from "./routes/billing";
import { referrals } from "./routes/referrals";
import { files } from "./routes/files";
import { references } from "./routes/references";
import { integrations } from "./routes/integrations";
import { webhooks } from "./routes/webhooks";
import { admin } from "./routes/admin";
import { errorHandler } from "./middleware/error";

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
