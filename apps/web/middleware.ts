import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Edge-safe coarse check: presence of the session cookie. Per-role gating
// happens in each route group's layout (server component, can hit the DB).
//
// Public paths anyone can hit:
const PUBLIC_PATHS = new Set(["/", "/login", "/signup", "/forgot-password"]);
const isPublic = (pathname: string) =>
  PUBLIC_PATHS.has(pathname) ||
  pathname.startsWith("/about") ||
  // Public lawyer directory + profile pages (SSR for SEO; no auth required).
  pathname === "/lawyers" ||
  pathname.startsWith("/lawyers/");

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Pass cookiePrefix so this matches the `ligala` prefix configured in
  // @ligala/auth. Without it the helper looks for `better-auth.session_token`
  // and fails to see our `ligala.session_token`.
  const hasSession = !!getSessionCookie(request, { cookiePrefix: "ligala" });

  if (!hasSession && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (hasSession && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next internals, the auth API (Better Auth handles its own routes),
    // the health probe, and static assets.
    "/((?!_next/static|_next/image|favicon.ico|api/auth|api/health).*)",
  ],
};
