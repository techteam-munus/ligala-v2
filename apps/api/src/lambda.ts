import type { APIGatewayProxyEventV2, Context } from "aws-lambda";
import { handle } from "hono/aws-lambda";
import { bootstrapEnv } from "./lib/bootstrap-env";
import { initSentry, Sentry } from "./lib/sentry";

// Module-level promise resolves to a wrapped handler once env bootstrap +
// Sentry init complete. Cached across warm invocations so Secrets Manager is
// only hit once per container.
let handlerPromise:
  | Promise<
      (event: APIGatewayProxyEventV2, context: Context) => Promise<unknown>
    >
  | null = null;

function getHandler() {
  if (handlerPromise) return handlerPromise;
  handlerPromise = (async () => {
    await bootstrapEnv();
    initSentry();
    const { createApp } = await import("./app");
    const honoHandler = handle(createApp()) as (
      event: APIGatewayProxyEventV2,
      context: Context,
    ) => Promise<unknown>;
    return process.env.SENTRY_DSN
      ? (Sentry.wrapHandler(honoHandler) as typeof honoHandler)
      : honoHandler;
  })();
  return handlerPromise;
}

export const handler = async (
  event: APIGatewayProxyEventV2,
  context: Context,
) => {
  const h = await getHandler();
  return h(event, context);
};
