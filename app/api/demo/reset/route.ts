import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { demoOnly } from "../guard";

// Deletes every demo circle (cascades to members, chats, vaults, plans, traces).
export async function POST() {
  const off = demoOnly();
  if (off) return off;
  // Demo personas' saved profiles go too (real people's profiles are never touched).
  const demoProfiles = await db.member.findMany({
    where: { circle: { isDemo: true }, profileId: { not: null } },
    select: { profileId: true },
  });
  const res = await db.circle.deleteMany({ where: { isDemo: true } });
  const ids = [...new Set(demoProfiles.map((m) => m.profileId!))];
  const stillUsed = await db.member.findMany({ where: { profileId: { in: ids } }, select: { profileId: true } });
  const orphaned = ids.filter((id) => !stillUsed.some((u) => u.profileId === id));
  if (orphaned.length) await db.profile.deleteMany({ where: { id: { in: orphaned } } });
  return NextResponse.json({ deleted: res.count });
}
