import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { postToGroup } from "@/lib/groupchat";

// Group roles: every person in a group is an admin or a regular member.
// - The person who starts a group is its first admin (role ORGANIZER); admins can make others admins.
// - Admins can add people and remove people. Anyone can leave.
// - If the last admin leaves (or is removed), the person who's been in the group longest takes over,
//   so a group is never left without an admin.

export const isAdmin = (m: { role: Role | string } | null | undefined) => !!m && (m.role === "ORGANIZER" || m.role === "ADMIN");

/**
 * Take someone out of a group. Their messages stay (with their name); their private answers, check-ins
 * and reactions go with them. `by` = the admin's name when they were removed, null when they left.
 */
export async function removeMember(circleId: string, memberId: string, by: string | null) {
  const m = await db.member.findUnique({ where: { id: memberId }, select: { id: true, name: true, accountId: true, circleId: true } });
  if (!m || m.circleId !== circleId) return { ok: false as const };
  await db.groupMessage.updateMany({ where: { memberId }, data: { senderName: m.name } });
  if (by && m.accountId)
    await db.circleRemoval.upsert({
      where: { circleId_accountId: { circleId, accountId: m.accountId } },
      create: { circleId, accountId: m.accountId },
      update: { at: new Date() },
    });
  await db.member.delete({ where: { id: memberId } });

  const remaining = await db.member.findMany({ where: { circleId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, role: true, accountId: true } });
  if (!remaining.length) {
    // Last one out: nothing left to keep.
    await db.circle.delete({ where: { id: circleId } });
    return { ok: true as const, deleted: true };
  }
  await postToGroup(circleId, "EVENT", by ? `${by} removed ${m.name}` : `${m.name} left`);

  // Never leave a group without an admin: the longest-standing member takes over.
  let admins = remaining.filter(isAdmin);
  if (!admins.length) {
    const next = remaining.find((r) => r.accountId) ?? remaining[0];
    await db.member.update({ where: { id: next.id }, data: { role: "ADMIN" } });
    await postToGroup(circleId, "EVENT", `${next.name} is now an admin`);
    admins = [{ ...next, role: "ADMIN" }];
  }
  const circle = await db.circle.findUnique({ where: { id: circleId }, select: { organizerId: true } });
  if (circle?.organizerId === memberId) await db.circle.update({ where: { id: circleId }, data: { organizerId: admins[0].id } });

  await recheckAfterMemberChange(circleId);
  return { ok: true as const, deleted: false };
}

/** Fewer people now: questions, RSVPs and check-ins that were only waiting on them can finish. */
export async function recheckAfterMemberChange(circleId: string) {
  const { evaluateRsvps, resolveIfEveryoneAnswered } = await import("@/lib/hushask");
  const { maybeAnalyze } = await import("@/lib/checkin");
  const [asks, events, checkIns] = await Promise.all([
    db.hushAsk.findMany({ where: { circleId, status: "OPEN" }, select: { id: true } }),
    db.chatItem.findMany({ where: { circleId, kind: "EVENT", status: "OPEN" }, select: { id: true } }),
    db.hushCheckIn.findMany({ where: { circleId, status: "OPEN" }, select: { id: true } }),
  ]);
  for (const a of asks) await resolveIfEveryoneAnswered(a.id).catch((e) => console.error("recheck ask", e));
  for (const e of events) await evaluateRsvps(e.id).catch((err) => console.error("recheck rsvp", err));
  for (const c of checkIns) await maybeAnalyze(c.id).catch((e) => console.error("recheck check-in", e));
}
