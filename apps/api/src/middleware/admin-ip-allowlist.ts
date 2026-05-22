import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";

// IPv4 only; the office VPN/office IPs we'd allowlist are v4 in practice.
// If we later need v6, swap the parser for the `ip-address` package.
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    const byte = Number(part);
    if (!Number.isInteger(byte) || byte < 0 || byte > 255) return null;
    n = (n * 256) + byte;
  }
  return n >>> 0;
}

type Cidr = { network: number; mask: number };

function parseCidr(cidr: string): Cidr | null {
  const [ip, bitsStr] = cidr.includes("/") ? cidr.split("/") : [cidr, "32"];
  const bits = Number(bitsStr);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return null;
  const network = ipv4ToInt(ip ?? "");
  if (network === null) return null;
  // /0 → mask 0; /32 → 0xffffffff. Avoid the `<< 32` UB by special-casing.
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return { network: (network & mask) >>> 0, mask };
}

function ipMatches(ip: string, cidrs: Cidr[]): boolean {
  const addr = ipv4ToInt(ip);
  if (addr === null) return false;
  for (const { network, mask } of cidrs) {
    if (((addr & mask) >>> 0) === network) return true;
  }
  return false;
}

let cached: { raw: string; cidrs: Cidr[] } | null = null;
function getAllowlist(): Cidr[] | null {
  const raw = process.env.ADMIN_IP_ALLOWLIST?.trim() ?? "";
  if (!raw) return null;
  if (cached && cached.raw === raw) return cached.cidrs;
  const cidrs = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseCidr)
    .filter((c): c is Cidr => c !== null);
  cached = { raw, cidrs };
  return cidrs;
}

/**
 * Gate /admin/* on a CIDR allowlist sourced from `ADMIN_IP_ALLOWLIST`
 * (comma-separated, e.g. `203.0.113.5/32,198.51.100.0/24`). When the env var
 * is unset or empty, requests pass through — dev and local test setups stay
 * unaffected.
 *
 * The source IP comes from `x-forwarded-for` (API Gateway sets it from the
 * client). We use the first hop, which is the original caller; subsequent
 * hops are AWS infra and would falsely match a corporate proxy.
 *
 * Runs BEFORE the session check so an IP scan never learns which paths
 * exist or whether a user is admin — wrong IP gets a generic 403.
 */
export const adminIpAllowlist: MiddlewareHandler = async (c, next) => {
  const cidrs = getAllowlist();
  if (cidrs === null || cidrs.length === 0) {
    await next();
    return;
  }
  const xff = c.req.header("x-forwarded-for") ?? "";
  const clientIp = xff.split(",")[0]?.trim() ?? "";
  if (!ipMatches(clientIp, cidrs)) {
    throw new HTTPException(403, { message: "forbidden" });
  }
  await next();
};
