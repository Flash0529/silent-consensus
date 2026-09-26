import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getMember, newDeviceToken, setMemberCookie } from "@/lib/identity";
import { jsonError, parseBody } from "@/lib/http";
import { avatarFor } from "@/lib/avatars";

const Body = z.object({ name: z.string().trim().min(1).max(30) });

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const existing = await getMember(slug);
  if (existing) return NextResponse.json({ memberId: existing.id, already: true });

  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;

  const circle = await db.circle.findUnique({ where: { slug }, include: { _count: { select: { members: true } } } });
  if (!circle) return jsonError("This plan link doesn't exist.", 404);
  if (circle.status !== "COLLECTING") return jsonError("This plan is already being made.", 409);
  if (circle._count.members >= 12) return jsonError("This plan is full.", 409);

  const { token, tokenHash } = newDeviceToken();
  const member = await db.member.create({
    data: { circleId: circle.id, name: body.data.name, avatarColor: avatarFor(circle._count.members), tokenHash },
  });
  await setMemberCookie(slug, member.id, token);
  return NextResponse.json({ memberId: member.id });
}
