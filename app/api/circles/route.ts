import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { newDeviceToken, setMemberCookie } from "@/lib/identity";
import { parseBody } from "@/lib/http";
import { newSlug } from "@/lib/slug";
import { avatarFor } from "@/lib/avatars";
import { getDeviceProfile } from "@/lib/profile";
import { getAccount } from "@/lib/account";
import { onGroupCreated } from "@/lib/groupchat";
import { jsonError } from "@/lib/http";
import { zPersonName, zTitle } from "@/lib/names";

const Body = z.object({
  organizerName: zPersonName(),
  kind: z.enum(["PLAN", "MEDIATE"]).default("PLAN"),
  topic: z.string().trim().max(60).optional(),
  title: zTitle(),
  activity: z.string().trim().min(1).max(40),
  area: z.string().trim().max(60).default(""),
  windowStart: z.coerce.date(),
  windowEnd: z.coerce.date(),
  mode: z.enum(["FRIENDS", "WORK"]).default("FRIENDS"),
});

export async function POST(req: Request) {
  const account = await getAccount();
  if (!account) return jsonError("Log in to start a plan.", 401);
  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;
  const { organizerName, windowStart, windowEnd, ...rest } = body.data;
  if (windowEnd <= windowStart) return NextResponse.json({ error: "End must be after start" }, { status: 400 });

  const { token, tokenHash } = newDeviceToken();
  const slug = newSlug();
  const profile = await getDeviceProfile();
  const circle = await db.circle.create({
    data: {
      ...rest,
      slug,
      windowStart,
      windowEnd,
      orgId: body.data.mode === "WORK" ? account.orgId : null,
      members: {
        create: {
          name: organizerName,
          avatarColor: avatarFor(0),
          tokenHash,
          role: "ORGANIZER",
          profileId: profile?.id ?? null,
          accountId: account.id,
        },
      },
    },
    include: { members: true },
  });
  const organizer = circle.members[0];
  await db.circle.update({ where: { id: circle.id }, data: { organizerId: organizer.id } });
  await setMemberCookie(slug, organizer.id, token);
  await onGroupCreated(circle.id, organizerName, body.data.mode).catch((e) => console.error("group intro failed", e));
  return NextResponse.json({ slug, memberId: organizer.id });
}
