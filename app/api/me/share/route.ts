import { NextResponse } from "next/server";
import { getMember } from "@/lib/identity";
import { jsonError } from "@/lib/http";
import { myShareView } from "@/lib/mine";

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("c") ?? "";
  const me = await getMember(slug);
  if (!me) return jsonError("Not a member of this plan", 401);
  const view = await myShareView(me.id, me.circleId);
  return NextResponse.json({ name: me.name, share: view }, { headers: { "Cache-Control": "no-store" } });
}
