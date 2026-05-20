import { NextResponse } from "next/server";
import { headers } from "next/headers";

const API_URL = process.env.API_URL ?? "http://localhost:8787";

/**
 * Client components can't talk to the Hono API directly (different origin,
 * cookies don't cross). This proxy forwards the call with the session cookie
 * attached so KYC uploads can run from the browser.
 */
export const runtime = "nodejs";

export async function POST(request: Request) {
  const h = await headers();
  const cookie = h.get("cookie") ?? "";
  const body = await request.text();
  const upstream = await fetch(`${API_URL}/files/presign`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body,
  });
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
