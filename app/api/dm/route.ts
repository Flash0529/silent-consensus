import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAccount } from "@/lib/account";
import { jsonError, parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { checkConnectToken, openDm, sharesAGroup } from "@/lib/dm";

// Open (or reopen) a DM with someone you know: you share a group, or you found them in your contacts.
const Body = z.object({ accountId: z.string().max(40), token: z.string().max(200).optional() });

export async function POST(req: Request) {
  const me = await getAccount();
  if (!me) return jsonError("Log in first.", 401);
  if (!rateLimit(`dm:${me.id}`, 30, 10 * 60_000)) return jsonError("Slow down a little.", 429);
  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;
  if (body.data.accountId === me.id) return jsonError("That's you!");
  const other = await db.account.findUnique({ where: { id: body.data.accountId }, select: { id: true, name: true } });
  if (!other) return jsonError("Not found", 404);
  const allowed =
    (await sharesAGroup(me.id, other.id)) || (body.data.token ? checkConnectToken(me.id, other.id, body.data.token) : false);
  if (!allowed) return jsonError("You can message people you share a group with, or find in your contacts.", 403);
  const slug = await openDm({ id: me.id, name: me.name }, other);
  return NextResponse.json({ slug });
}
