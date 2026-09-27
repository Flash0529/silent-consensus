import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getMember, newDeviceToken, setMemberCookie } from "@/lib/identity";
import { jsonError, parseBody } from "@/lib/http";
import { avatarFor } from "@/lib/avatars";
import { getDeviceProfile } from "@/lib/profile";
import { getAccount } from "@/lib/account";
import { onMemberJoined } from "@/lib/groupchat";
import { zPersonName } from "@/lib/names";

const Body = z.object({ name: zPersonName() });

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const existing = await getMember(slug);
  if (existing) return NextResponse.json({ memberId: existing.id, already: true });
  const account = await getAccount();
  if (!account) return jsonError("Log in to join this plan.", 401);

  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;

  const circle = await db.circle.findUnique({ where: { slug }, include: { _count: { select: { members: true } } } });
  if (!circle) return jsonError("This plan link doesn't exist.", 404);
  // Removed by an admin: the link doesn't let them back in (an admin can add them back).
  if (await db.circleRemoval.findUnique({ where: { circleId_accountId: { circleId: circle.id, accountId: account.id } } }))
    return jsonError("An admin removed you from this group. Ask them to add you back.", 403);
  if (circle.status !== "COLLECTING") return jsonError("This plan is already being made.", 409);
  if (circle._count.members >= 12) return jsonError("This plan is full.", 409);

  const { token, tokenHash } = newDeviceToken();
  const member = await db.member.create({
    data: {
      circleId: circle.id,
      name: body.data.name,
      avatarColor: avatarFor(circle._count.members),
      tokenHash,
      profileId: (await getDeviceProfile())?.id ?? null,
      accountId: account.id,
    },
  });
  await setMemberCookie(slug, member.id, token);
  await onMemberJoined(circle.id, member.name).catch((e) => console.error("join event failed", e));
  return NextResponse.json({ memberId: member.id });
}
