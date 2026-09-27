import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAccount } from "@/lib/account";
import { jsonError } from "@/lib/http";

// Your contacts: people you share (or shared) a group with. Names only; never emails.
// ?c=<slug> marks who is already in that group.
export async function GET(req: Request) {
  const me = await getAccount();
  if (!me) return jsonError("Log in first.", 401);
  const slug = new URL(req.url).searchParams.get("c");
  const mine = await db.member.findMany({ where: { accountId: me.id }, select: { circleId: true } });
  const others = await db.member.findMany({
    where: { circleId: { in: mine.map((m) => m.circleId) }, accountId: { not: null, notIn: [me.id] } },
    select: { accountId: true, avatarColor: true, account: { select: { name: true } }, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const inGroup = slug
    ? new Set(
        (await db.member.findMany({ where: { circle: { slug }, accountId: { not: null } }, select: { accountId: true } })).map(
          (m) => m.accountId,
        ),
      )
    : new Set<string | null>();
  const seen = new Map<string, { id: string; name: string; avatarColor: string; inGroup: boolean }>();
  for (const o of others) {
    if (!o.accountId || seen.has(o.accountId)) continue;
    seen.set(o.accountId, { id: o.accountId, name: o.account?.name ?? "Friend", avatarColor: o.avatarColor, inGroup: inGroup.has(o.accountId) });
  }
  const contacts = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ contacts }, { headers: { "Cache-Control": "no-store" } });
}
