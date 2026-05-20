import { handle } from "hono/aws-lambda";
import { createApp } from "./app";
import { initSentry, Sentry } from "./lib/sentry";

initSentry();

const app = createApp();
const honoHandler = handle(app);

// Wrap the Lambda handler so unhandled exceptions reach Sentry with the right
// AWS context (event, awsRequestId, function name) and so traces are stitched.
// When SENTRY_DSN is unset, wrapHandler is a thin pass-through.
export const handler = process.env.SENTRY_DSN
  ? Sentry.wrapHandler(honoHandler)
  : honoHandler;
