import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { adminIpAllowlist } from "./admin-ip-allowlist";

function app() {
  return new Hono()
    .use("*", adminIpAllowlist)
    .get("/", (c) => c.text("ok"));
}

describe("adminIpAllowlist", () => {
  const prev = process.env.ADMIN_IP_ALLOWLIST;
  beforeEach(() => {
    delete process.env.ADMIN_IP_ALLOWLIST;
  });
  afterEach(() => {
    if (prev !== undefined) process.env.ADMIN_IP_ALLOWLIST = prev;
    else delete process.env.ADMIN_IP_ALLOWLIST;
  });

  it("passes through when env var is unset", async () => {
    const res = await app().request("/", {
      headers: { "x-forwarded-for": "203.0.113.5" },
    });
    expect(res.status).toBe(200);
  });

  it("allows a /32 match", async () => {
    process.env.ADMIN_IP_ALLOWLIST = "203.0.113.5/32";
    const res = await app().request("/", {
      headers: { "x-forwarded-for": "203.0.113.5" },
    });
    expect(res.status).toBe(200);
  });

  it("403s on a /32 miss", async () => {
    process.env.ADMIN_IP_ALLOWLIST = "203.0.113.5/32";
    const res = await app().request("/", {
      headers: { "x-forwarded-for": "203.0.113.6" },
    });
    expect(res.status).toBe(403);
  });

  it("respects subnet boundaries on /24", async () => {
    process.env.ADMIN_IP_ALLOWLIST = "198.51.100.0/24";
    const okRes = await app().request("/", {
      headers: { "x-forwarded-for": "198.51.100.250" },
    });
    expect(okRes.status).toBe(200);
    const badRes = await app().request("/", {
      headers: { "x-forwarded-for": "198.51.101.1" },
    });
    expect(badRes.status).toBe(403);
  });

  it("uses the first hop from x-forwarded-for", async () => {
    process.env.ADMIN_IP_ALLOWLIST = "203.0.113.5/32";
    const res = await app().request("/", {
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1, 10.0.0.2" },
    });
    expect(res.status).toBe(200);
  });

  it("403s when x-forwarded-for is missing", async () => {
    process.env.ADMIN_IP_ALLOWLIST = "203.0.113.5/32";
    const res = await app().request("/");
    expect(res.status).toBe(403);
  });

  it("accepts multiple CIDRs", async () => {
    process.env.ADMIN_IP_ALLOWLIST = "203.0.113.5/32, 198.51.100.0/24";
    const a = await app().request("/", {
      headers: { "x-forwarded-for": "203.0.113.5" },
    });
    expect(a.status).toBe(200);
    const b = await app().request("/", {
      headers: { "x-forwarded-for": "198.51.100.50" },
    });
    expect(b.status).toBe(200);
    const c = await app().request("/", {
      headers: { "x-forwarded-for": "192.0.2.1" },
    });
    expect(c.status).toBe(403);
  });
});
