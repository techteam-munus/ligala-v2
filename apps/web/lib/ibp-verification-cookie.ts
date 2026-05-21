import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "ligala_ibp_verified";
const TTL_SECONDS = 30 * 60;

export type VerifiedIbp = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  rollNumber: string;
};

type CookiePayload = VerifiedIbp & { exp: number };

function secret(): string {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("BETTER_AUTH_SECRET is required");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(payload: Omit<CookiePayload, "exp">): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + TTL_SECONDS * 1000 }),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(value: string): CookiePayload | null {
  const dot = value.indexOf(".");
  if (dot < 0) return null;
  const body = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  const expected = sign(body);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (
      typeof parsed?.id !== "string" ||
      typeof parsed?.firstName !== "string" ||
      typeof parsed?.lastName !== "string" ||
      typeof parsed?.rollNumber !== "string" ||
      typeof parsed?.exp !== "number"
    ) {
      return null;
    }
    if (parsed.exp < Date.now()) return null;
    return parsed as CookiePayload;
  } catch {
    return null;
  }
}

export async function setIbpVerifiedCookie(lawyer: VerifiedIbp) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, encode(lawyer), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function readVerifiedIbp(): Promise<VerifiedIbp | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const parsed = decode(raw);
  if (!parsed) return null;
  const { exp: _exp, ...lawyer } = parsed;
  return lawyer;
}

export async function clearIbpVerifiedCookie() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
