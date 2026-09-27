import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { ACCOUNT_COOKIE, deviceHash, getAccount } from "@/lib/account";
import { hashToken } from "@/lib/identity";
import { jsonError, parseBody } from "@/lib/http";

// Settings → Devices: where you're logged in, when each was last used, remember this device (skip
// two-step codes here), and remove a device (logs it out).

function label(ua: string | null) {
  if (!ua) return "Unknown device";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /CrOS/.test(ua) ? "Chromebook" : /Linux/.test(ua) ? "Linux" : "Device";
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Firefox\//.test(ua) ? "Firefox" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${br} on ${os}`;
}

export async function GET() {
  const a = await getAccount();
  if (!a) return jsonError("Log in first.", 401);
  const token = (await cookies()).get(ACCOUNT_COOKIE)?.value ?? "";
  const mine = hashToken(token);
  const sessions = await db.accountSession.findMany({ where: { accountId: a.id, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" } });
  const trusted = new Set((await db.trustedDevice.findMany({ where: { accountId: a.id } })).map((t) => t.deviceHash));
  // One row per device (a device can have several sessions after logging in again).
  const byDevice = new Map<string, (typeof sessions)[number][]>();
  for (const s of sessions) {
    const k = s.deviceHash ?? `session:${s.tokenHash}`;
    byDevice.set(k, [...(byDevice.get(k) ?? []), s]);
  }
  const devices = [...byDevice.entries()].map(([k, list]) => ({
    id: k.slice(0, 16),
    label: label(list[0].userAgent),
    lastSeenAt: list.map((s) => s.lastSeenAt ?? s.createdAt).sort((x, y) => +y - +x)[0],
    firstSeenAt: list.map((s) => s.createdAt).sort((x, y) => +x - +y)[0],
    current: list.some((s) => s.tokenHash === mine),
    remembered: !k.startsWith("session:") && trusted.has(k),
  }));
  return NextResponse.json({ devices }, { headers: { "Cache-Control": "no-store" } });
}

/** Remember (or forget) THIS device: two-step codes are skipped here while remembered. */
export async function POST(req: Request) {
  const a = await getAccount();
  if (!a) return jsonError("Log in first.", 401);
  const body = await parseBody(req, z.object({ remember: z.boolean() }));
  if (!body.ok) return body.res;
  const d = await deviceHash();
  if (!d) return jsonError("Couldn't identify this device.", 400);
  if (body.data.remember) await db.trustedDevice.upsert({ where: { accountId_deviceHash: { accountId: a.id, deviceHash: d } }, create: { accountId: a.id, deviceHash: d }, update: {} });
  else await db.trustedDevice.deleteMany({ where: { accountId: a.id, deviceHash: d } });
  return NextResponse.json({ ok: true });
}
