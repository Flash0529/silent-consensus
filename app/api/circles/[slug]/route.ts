import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { groupInclude, toGroupSafe } from "@/lib/serialize";
import { jsonError } from "@/lib/http";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const circle = await db.circle.findUnique({ where: { slug }, include: groupInclude });
  if (!circle) return jsonError("Not found", 404);
  return NextResponse.json(toGroupSafe(circle), { headers: { "Cache-Control": "no-store" } });
}
