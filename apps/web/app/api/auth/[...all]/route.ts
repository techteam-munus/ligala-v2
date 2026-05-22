export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_URL = process.env.API_URL ?? "http://localhost:8787";

/**
 * Proxy /api/auth/* (Next.js) to /auth/* on the Hono API Lambda.
 *
 * Better Auth needs DB access; on Amplify the Next.js Lambda runs outside our
 * VPC and can't reach Aurora. The API Lambda runs Better Auth in-VPC, so we
 * forward the incoming request body + cookies and pipe the response (including
 * Set-Cookie) back to the browser. Cookies land on the Amplify origin since
 * Set-Cookie carries no Domain attribute.
 */
async function forward(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/auth/, "/auth");
  const target = `${API_URL}${path}${url.search}`;

  const headers = new Headers(req.headers);
  // Let fetch set host/content-length itself.
  headers.delete("host");
  headers.delete("content-length");

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await req.arrayBuffer() : undefined;

  const res = await fetch(target, {
    method: req.method,
    headers,
    body,
    redirect: "manual",
  });

  // Pass headers through unchanged so Set-Cookie + redirects work.
  const respHeaders = new Headers(res.headers);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: respHeaders,
  });
}

export const GET = forward;
export const POST = forward;
