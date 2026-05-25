import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

describe("GET /logout", () => {
  it("redirects to /login", () => {
    const res = GET(new NextRequest("https://app.ligala.test/logout"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://app.ligala.test/login");
  });

  it("clears both the plain and __Secure- session cookies", () => {
    const res = GET(new NextRequest("https://app.ligala.test/logout"));

    // Breaking the redirect loop depends on the session cookie actually being
    // purged so the edge middleware's presence check stops firing.
    for (const name of ["ligala.session_token", "__Secure-ligala.session_token"]) {
      const cookie = res.cookies.get(name);
      expect(cookie?.value).toBe("");
      expect(cookie?.maxAge).toBe(0);
    }

    // The __Secure- prefix is only honored (and cleared) with the Secure attr.
    expect(res.cookies.get("__Secure-ligala.session_token")?.secure).toBe(true);
  });
});
