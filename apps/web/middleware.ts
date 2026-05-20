import { NextResponse, type NextRequest } from "next/server";

// Phase 0: pass-through. Phase 1 will add Better Auth session check + role-based
// redirects between (client) / (lawyer) / (admin) route groups.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next internals, static files, and the API health probe.
    "/((?!_next/static|_next/image|favicon.ico|api/health).*)",
  ],
};
