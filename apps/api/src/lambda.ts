import { handle } from "hono/aws-lambda";
import { createApp } from "./app";

// Cold-start: build the app once per Lambda container.
const app = createApp();

export const handler = handle(app);
