import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAccount } from "@/lib/account";
import { jsonError } from "@/lib/http";
import { openDm } from "@/lib/dm";

// The invite page: who invited you (name + photo only), and accepting it (opens a DM between you).
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await db.friendInvite.findUnique({ where: { token }, include: { from: { select: { name: true, photo: true } } } });
  if (!inv) return jsonError("This invite link doesn't exist.", 404);
  return NextResponse.json({ from: inv.from, used: !!inv.usedById });
}

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const me = await getAccount();
  if (!me) return jsonError("Create an account (or log in) first.", 401);
  const inv = await db.friendInvite.findUnique({ where: { token }, include: { from: { select: { id: true, name: true } } } });
  if (!inv) return jsonError("This invite link doesn't exist.", 404);
  if (inv.fromId === me.id) return jsonError("That's your own invite link. Send it to a friend!", 400);
  if (inv.usedById && inv.usedById !== me.id) return jsonError("This invite was already used. Ask your friend for a new link.", 409);
  if (!inv.usedById) await db.friendInvite.update({ where: { token }, data: { usedById: me.id, usedAt: new Date() } });
  const slug = await openDm({ id: me.id, name: me.name }, inv.from);
  return NextResponse.json({ slug });
}
