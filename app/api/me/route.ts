import { NextResponse } from "next/server";
import { getMember } from "@/lib/identity";

// Who am I in circle ?c=. Returns only the caller's own identity.
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("c") ?? "";
  const me = await getMember(slug);
  if (!me) return NextResponse.json({ member: null });
  return NextResponse.json({
    member: {
      id: me.id,
      name: me.name,
      avatarColor: me.avatarColor,
      isOrganizer: me.id === me.circle.organizerId,
      interviewStatus: me.interviewStatus,
    },
  });
}
