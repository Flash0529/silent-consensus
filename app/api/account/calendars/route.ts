import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAccount } from "@/lib/account";
import { jsonError, parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { addIcsLink, googleConfigured } from "@/lib/calendar";

// Your linked calendars (Hush only reads free/busy). The link itself is never sent back to the browser.
const view = { id: true, provider: true, label: true, lastOkAt: true, lastError: true, createdAt: true } as const;

export async function GET() {
  const account = await getAccount();
  if (!account) return jsonError("Log in first.", 401);
  const calendars = await db.calendarLink.findMany({ where: { accountId: account.id }, select: view, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ calendars, google: googleConfigured() }, { headers: { "Cache-Control": "no-store" } });
}

const Body = z.object({ url: z.string().trim().min(8).max(1000), label: z.string().trim().max(40).optional() });

export async function POST(req: Request) {
  const account = await getAccount();
  if (!account) return jsonError("Log in first.", 401);
  if (!rateLimit(`cal:${account.id}`, 10, 10 * 60_000)) return jsonError("Slow down a little and try again.", 429);
  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;
  if ((await db.calendarLink.count({ where: { accountId: account.id } })) >= 5) return jsonError("You can link up to 5 calendars.", 409);
  try {
    const cal = await addIcsLink(account.id, body.data.url, body.data.label);
    return NextResponse.json({ calendar: cal });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Couldn't read that calendar.", 400);
  }
}
