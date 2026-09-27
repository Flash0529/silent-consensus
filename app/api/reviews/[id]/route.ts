import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAccount } from "@/lib/account";
import { jsonError, parseBody } from "@/lib/http";
import { reviewsFor } from "@/lib/review";

// Close a review: reviewed (with an optional private note) or dismissed (Hush got it wrong).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await getAccount();
  if (!a) return jsonError("Log in first.", 401);
  const body = await parseBody(req, z.object({ status: z.enum(["OPEN", "REVIEWED", "DISMISSED"]), note: z.string().trim().max(1000).optional() }));
  if (!body.ok) return body.res;
  const { where } = await reviewsFor(a.id);
  if (!where) return jsonError("Not found", 404);
  const r = await db.escalation.findFirst({ where: { id, ...where } });
  if (!r) return jsonError("Not found", 404);
  await db.escalation.update({
    where: { id },
    data: { status: body.data.status, note: body.data.note ?? r.note, reviewedBy: a.name, reviewedAt: body.data.status === "OPEN" ? null : new Date() },
  });
  return NextResponse.json({ ok: true });
}
