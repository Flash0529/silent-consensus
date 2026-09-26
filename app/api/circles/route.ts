import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { newDeviceToken, setMemberCookie } from "@/lib/identity";
import { parseBody } from "@/lib/http";
import { newSlug } from "@/lib/slug";
import { avatarFor } from "@/lib/avatars";

const Body = z.object({
  organizerName: z.string().trim().min(1).max(30),
  kind: z.enum(["PLAN", "MEDIATE"]).default("PLAN"),
  topic: z.string().trim().max(60).optional(),
  title: z.string().trim().min(1).max(60),
  activity: z.string().trim().min(1).max(40),
  area: z.string().trim().max(60).default(""),
  windowStart: z.coerce.date(),
  windowEnd: z.coerce.date(),
});

export async function POST(req: Request) {
  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;
  const { organizerName, windowStart, windowEnd, ...rest } = body.data;
  if (windowEnd <= windowStart) return NextResponse.json({ error: "End must be after start" }, { status: 400 });

  const { token, tokenHash } = newDeviceToken();
  const slug = newSlug();
  const circle = await db.circle.create({
    data: {
      ...rest,
      slug,
      windowStart,
      windowEnd,
      members: {
        create: { name: organizerName, avatarColor: avatarFor(0), tokenHash, role: "ORGANIZER" },
      },
    },
    include: { members: true },
  });
  const organizer = circle.members[0];
  await db.circle.update({ where: { id: circle.id }, data: { organizerId: organizer.id } });
  await setMemberCookie(slug, organizer.id, token);
  return NextResponse.json({ slug, memberId: organizer.id });
}
