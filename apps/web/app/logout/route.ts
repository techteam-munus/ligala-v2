import { NextResponse, type NextRequest } from "next/server";

// Names Better Auth uses for the session cookie. `cookiePrefix: "ligala"` makes
// it `ligala.session_token`; over HTTPS Better Auth adds the `__Secure-` prefix
// (which the browser only accepts — and only clears — when the Secure attribute
// is present). Clear both so this works in local dev and on Amplify.
const SESSION_COOKIES = [
  { name: "ligala.session_token", secure: false },
  { name: "__Secure-ligala.session_token", secure: true },
] as const;

/**
 * Clears the session cookie and sends the user to /login.
 *
 * Why this exists: when a session is invalidated server-side (the user row is
 * deleted — which cascade-deletes its `session` rows — an admin revokes the
 * session, or the DB is reset) the browser still holds the session cookie.
 * The edge middleware only checks cookie *presence* (it can't reach the DB), so
 * it treats the request as authenticated and bounces /login -> /dashboard. The
 * route-group layouts, meanwhile, call getSession(), find no valid session, and
 * redirect -> /login. The two disagree and the request ping-pongs until the
 * browser aborts with ERR_TOO_MANY_REDIRECTS.
 *
 * Routing the layouts' "no valid session" redirect through here breaks the loop
 * by purging the stale cookie, so the next /login request is genuinely
 * unauthenticated and the middleware stops bouncing it.
 */
export function GET(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", request.url));
  for (const { name, secure } of SESSION_COOKIES) {
    res.cookies.set(name, "", { path: "/", maxAge: 0, secure });
  }
  return res;
}
