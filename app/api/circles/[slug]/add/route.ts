import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getMember, newDeviceToken } from "@/lib/identity";
import { jsonError, parseBody } from "@/lib/http";
import { avatarFor } from "@/lib/avatars";
import { normalizeEmail } from "@/lib/account";
import { rateLimit } from "@/lib/ratelimit";
import { postToGroup } from "@/lib/groupchat";
import { isAdmin } from "@/lib/members";

// Admins add people to a group: their contacts (people they already share a group with) or anyone
// with an account, by email. They see the group in their chat list right away.

const MAX_MEMBERS = 12;
const Body = z.object({
  accountIds: z.array(z.string().max(40)).max(MAX_MEMBERS).default([]),
  email: z.string().trim().max(200).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await getMember(slug);
  if (!me || !me.accountId) return jsonError("You're not in this group.", 401);
  if (!me.circle.isDirect && !isAdmin(me)) return jsonError("Only group admins can add people. Ask an admin.", 403);
  if (!rateLimit(`add:${me.id}`, 20, 10 * 60_000)) return jsonError("Slow down a little and try again.", 429);
  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;

  let targets = [...new Set(body.data.accountIds)];
  if (targets.length) {
    // Only your contacts can be added by id (people who share a group with you).
    const mine = await db.member.findMany({ where: { accountId: me.accountId }, select: { circleId: true } });
    const allowed = await db.member.findMany({
      where: { accountId: { in: targets }, circleId: { in: mine.map((m) => m.circleId) } },
      select: { accountId: true },
    });
    const ok = new Set(allowed.map((a) => a.accountId));
    targets = targets.filter((t) => ok.has(t));
  }
  if (body.data.email) {
    const acct = await db.account.findUnique({ where: { email: normalizeEmail(body.data.email) } });
    if (!acct)
      return jsonError("No one has an account with that email yet. Send them the invite link instead.", 404);
    targets.push(acct.id);
  }
  if (!targets.length) return jsonError("Pick someone to add.");

  const circle = await db.circle.findUniqueOrThrow({ where: { id: me.circleId }, include: { members: { select: { accountId: true } } } });
  const already = new Set(circle.members.map((m) => m.accountId));
  let count = circle.members.length;
  const added: string[] = [];
  for (const accountId of targets) {
    if (already.has(accountId)) continue;
    if (count >= MAX_MEMBERS) return jsonError(`Groups can have up to ${MAX_MEMBERS} people.`, 409);
    const acct = await db.account.findUnique({ where: { id: accountId }, select: { name: true } });
    if (!acct) continue;
    await db.member.create({
      data: { circleId: circle.id, name: acct.name, avatarColor: avatarFor(count), tokenHash: newDeviceToken().tokenHash, accountId },
    });
    // Added back by an admin: the invite link works for them again too.
    await db.circleRemoval.deleteMany({ where: { circleId: circle.id, accountId } });
    await postToGroup(circle.id, "EVENT", `${me.name} added ${acct.name}`);
    already.add(accountId);
    added.push(acct.name);
    count++;
  }
  return NextResponse.json({ added });
}
