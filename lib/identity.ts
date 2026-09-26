import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";

// One httpOnly cookie per circle: qc_<slug> = <memberId>.<token>.<hmac>.
// The DB only stores sha256(token).

const MAX_AGE = 60 * 60 * 24 * 30;

function secret() {
  const s = process.env.COOKIE_SECRET;
  if (!s) throw new Error("COOKIE_SECRET is not set");
  return s;
}

export const cookieName = (slug: string) => `qc_${slug}`;

export function newDeviceToken() {
  const token = randomBytes(24).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function encodeCookie(memberId: string, token: string) {
  const body = `${memberId}.${token}`;
  return `${body}.${sign(body)}`;
}

export function decodeCookie(raw: string | undefined) {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [memberId, token, mac] = parts;
  const expected = sign(`${memberId}.${token}`);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { memberId, token };
}

export async function setMemberCookie(slug: string, memberId: string, token: string) {
  const jar = await cookies();
  jar.set(cookieName(slug), encodeCookie(memberId, token), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export const demoMode = () => process.env.DEMO_MODE === "true";

/** The member calling this request for circle `slug`, or null. */
export async function getMember(slug: string) {
  // Demo impersonation: presenter iframes send x-demo-as. Only for demo circles.
  if (demoMode()) {
    const as = (await headers()).get("x-demo-as");
    if (as) {
      const m = await db.member.findUnique({ where: { id: as }, include: { circle: true } });
      if (m && m.circle.slug === slug && m.circle.isDemo) return m;
      return null;
    }
  }
  const decoded = decodeCookie((await cookies()).get(cookieName(slug))?.value);
  if (!decoded) return null;
  const m = await db.member.findUnique({
    where: { tokenHash: hashToken(decoded.token) },
    include: { circle: true },
  });
  if (!m || m.id !== decoded.memberId || m.circle.slug !== slug) return null;
  return m;
}

export type CurrentMember = NonNullable<Awaited<ReturnType<typeof getMember>>>;
