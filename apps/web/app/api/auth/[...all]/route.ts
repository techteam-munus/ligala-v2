import { auth } from "@ligala/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const runtime = "nodejs";

export const { POST, GET } = toNextJsHandler(auth);
