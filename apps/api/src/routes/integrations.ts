import { Hono } from "hono";

// CD Asia legal database proxy mounted under /integrations/cdasia/*.
export const integrations = new Hono().get("/", (c) =>
  c.json({ error: "not_implemented", phase: 3 }, 501),
);
