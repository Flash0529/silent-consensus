import { NextResponse } from "next/server";
import { getMember } from "@/lib/identity";
import { jsonError } from "@/lib/http";
import { removeMember } from "@/lib/members";

// Leave a group. If you were the last admin, the person who's been in it longest becomes admin.
export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await getMember(slug);
  if (!me) return jsonError("You're not in this group.", 401);
  if (me.circle.isDirect) return jsonError("You can delete a direct message, but not leave it.", 400);
  const r = await removeMember(me.circleId, me.id, null);
  return NextResponse.json(r);
}
