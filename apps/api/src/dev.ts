// MUST be first import — ESM hoists imports above top-level statements within
// a single module, but imports themselves are evaluated in source order, so a
// bare side-effect import guarantees env vars are loaded before downstream
// modules read process.env at evaluation time.
import "./load-env";

import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { initSentry } from "./lib/sentry";

initSentry();

const port = Number(process.env.PORT ?? 8787);
const app = createApp();

serve({ fetch: app.fetch, port }, (info) => {
  console.info(`[api] http://localhost:${info.port}`);
});
