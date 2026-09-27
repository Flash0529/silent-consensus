import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { demoOnly } from "../guard";

// Deletes every demo circle (cascades to members, chats, vaults, plans, traces).
export async function POST() {
  const off = demoOnly();
  if (off) return off;
  const res = await db.circle.deleteMany({ where: { isDemo: true } });
  return NextResponse.json({ deleted: res.count });
}
