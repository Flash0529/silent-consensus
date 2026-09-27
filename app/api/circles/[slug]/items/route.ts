import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMember } from "@/lib/identity";
import { jsonError } from "@/lib/http";
import { hushBusy } from "@/lib/ai/detect";
import { bookingLinks, type Place } from "@/lib/places";
import { groupZone } from "@/lib/calendar";

// Things Hush noticed in this group chat (events / to-dos / decisions) with everyone's responses.
// Members only; built from the group chat, which every member can already see.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await getMember(slug);
  if (!me) return jsonError("Not a member of this plan", 401);
  const total = await db.member.count({ where: { circleId: me.circleId, accountId: { not: null } } });
  const [items, circle] = await Promise.all([
    db.chatItem.findMany({
      where: { circleId: me.circleId, status: { not: "DISMISSED" } },
      orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
      include: { responses: { select: { memberId: true, answer: true } }, shares: { where: { memberId: me.id }, select: { memberId: true, finalCents: true, paidAt: true } } },
    }),
    db.circle.findUnique({ where: { id: me.circleId }, select: { mode: true, title: true } }),
  ]);
  const tz = await groupZone(me.circleId);
  const checking = new Set(
    (await db.hushCheckIn.findMany({ where: { circleId: me.circleId, status: "OPEN", itemId: { not: null } }, select: { itemId: true } })).map((c) => c.itemId),
  );
  return NextResponse.json(
    {
      mode: circle?.mode ?? "FRIENDS",
      busy: hushBusy(me.circleId),
      items: items.map((i) => ({
        id: i.id,
        kind: i.kind,
        title: i.title,
        startsAt: i.startsAt,
        whenText: i.whenText,
        place: i.place,
        owner: i.owner,
        details: i.details,
        status: i.status,
        // Answers are private: only your own, plus how many have answered. Never who said what.
        mine: i.responses.find((r) => r.memberId === me.id)?.answer ?? null,
        answered: i.responses.length,
        total,
        outcome: i.outcome,
        checking: checking.has(i.id),
        // Multi-part plans (concert, then food) and your own share (only yours).
        parts: i.parts ?? null,
        costCents: i.costCents,
        myShare: (() => {
          const sh = i.shares.find((x) => x.memberId === me.id);
          return sh ? { finalCents: sh.finalCents, paid: !!sh.paidAt } : null;
        })(),
        // A real place Hush found: links to book it (Resy / OpenTable) or open it in Maps.
        book: i.placeMeta ? bookingLinks(i.placeMeta as unknown as Place, { startsAt: i.startsAt, party: total, tz }) : null,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
