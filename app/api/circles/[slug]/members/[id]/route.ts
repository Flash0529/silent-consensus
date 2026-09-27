import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getMember } from "@/lib/identity";
import { jsonError, parseBody } from "@/lib/http";
import { postToGroup } from "@/lib/groupchat";
import { isAdmin, removeMember } from "@/lib/members";

// Admins only: remove someone from the group, make them an admin, or take admin away.
const Body = z.object({ action: z.enum(["remove", "promote", "demote"]) });

export async function POST(req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const me = await getMember(slug);
  if (!me) return jsonError("You're not in this group.", 401);
  if (me.circle.isDirect) return jsonError("Direct messages don't have admins.", 400);
  if (!isAdmin(me)) return jsonError("Only group admins can do that.", 403);
  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;
  const target = await db.member.findUnique({ where: { id }, select: { id: true, name: true, role: true, circleId: true } });
  if (!target || target.circleId !== me.circleId) return jsonError("That person isn't in this group.", 404);

  if (body.data.action === "remove") {
    if (target.id === me.id) return jsonError("To leave the group, use Leave group.", 400);
    const r = await removeMember(me.circleId, target.id, me.name);
    return NextResponse.json(r);
  }
  if (body.data.action === "promote") {
    if (isAdmin(target)) return NextResponse.json({ ok: true });
    await db.member.update({ where: { id: target.id }, data: { role: "ADMIN" } });
    await postToGroup(me.circleId, "EVENT", `${me.name} made ${target.name} an admin`);
    return NextResponse.json({ ok: true });
  }
  // demote
  if (!isAdmin(target)) return NextResponse.json({ ok: true });
  const admins = await db.member.count({ where: { circleId: me.circleId, role: { in: ["ORGANIZER", "ADMIN"] } } });
  if (admins <= 1) return jsonError("A group needs at least one admin. Make someone else an admin first.", 409);
  await db.member.update({ where: { id: target.id }, data: { role: "MEMBER" } });
  await postToGroup(me.circleId, "EVENT", target.id === me.id ? `${me.name} is no longer an admin` : `${me.name} removed ${target.name} as an admin`);
  return NextResponse.json({ ok: true });
}
