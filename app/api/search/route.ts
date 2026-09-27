import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAccount } from "@/lib/account";
import { jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";

// Search your messages across every chat you're in (only chats you're in, and only what you can
// still see there: not before you deleted a chat for yourself). Private Hush chats aren't searched
// here; they're yours and live in the Hush chat.
export async function GET(req: Request) {
  const a = await getAccount();
  if (!a) return jsonError("Log in first.", 401);
  if (!rateLimit(`search:${a.id}`, 60, 60_000)) return jsonError("Slow down a little.", 429);
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ results: [] });
  const mems = await db.member.findMany({
    where: { accountId: a.id },
    select: { id: true, clearedAt: true, circle: { select: { id: true, slug: true, title: true, isDirect: true, members: { select: { id: true, name: true } } } } },
  });
  if (!mems.length) return NextResponse.json({ results: [] });
  const rows = await db.groupMessage.findMany({
    where: {
      kind: "TEXT",
      body: { contains: q, mode: "insensitive" },
      OR: mems.map((m) => ({ circleId: m.circle.id, ...(m.clearedAt ? { createdAt: { gt: m.clearedAt } } : {}) })),
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, body: true, createdAt: true, circleId: true, senderName: true, member: { select: { name: true } }, memberId: true },
  });
  const byCircle = new Map(mems.map((m) => [m.circle.id, m]));
  return NextResponse.json({
    results: rows.map((r) => {
      const m = byCircle.get(r.circleId)!;
      const title = m.circle.isDirect ? (m.circle.members.find((x) => x.id !== m.id)?.name ?? "DM") : m.circle.title;
      const i = r.body.toLowerCase().indexOf(q.toLowerCase());
      const start = Math.max(0, i - 40);
      return {
        slug: m.circle.slug,
        title,
        messageId: r.id,
        snippet: `${start > 0 ? "…" : ""}${r.body.slice(start, start + 120)}${start + 120 < r.body.length ? "…" : ""}`,
        from: r.memberId === m.id ? "You" : (r.member?.name ?? r.senderName ?? "Someone"),
        at: r.createdAt,
      };
    }),
  });
}
