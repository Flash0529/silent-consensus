import { after, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMember } from "@/lib/identity";
import { jsonError } from "@/lib/http";
import { continueWithoutRest } from "@/lib/checkin";

// Someone went quiet: after 20 minutes anyone in the chat can have Hush continue with the answers it has.
export async function POST(_req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const me = await getMember(slug);
  if (!me) return jsonError("Not a member of this chat", 401);
  const s = await db.hushCheckIn.findUnique({ where: { id }, select: { circleId: true, createdAt: true, status: true } });
  if (!s || s.circleId !== me.circleId) return jsonError("Not found", 404);
  if (s.status !== "OPEN") return NextResponse.json({ ok: true });
  if (Date.now() - +s.createdAt < 20 * 60_000) return jsonError("Give everyone a little longer to answer (20 minutes).", 409);
  after(() => continueWithoutRest(id).catch((e) => console.error("continue failed", e)));
  return NextResponse.json({ ok: true });
}
