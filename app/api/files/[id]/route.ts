import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAccount } from "@/lib/account";
import { jsonError } from "@/lib/http";
import { isImage, readAttachment } from "@/lib/files";

// Download a shared file: only people in that chat (and not after it's been removed).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getAccount();
  if (!me) return jsonError("Log in first.", 401);
  const meta = await db.attachment.findUnique({ where: { id }, select: { circleId: true } });
  if (!meta) return jsonError("This file isn't available anymore.", 404);
  const member = await db.member.findFirst({ where: { accountId: me.id, circleId: meta.circleId }, select: { clearedAt: true } });
  if (!member) return jsonError("Not found", 404);
  const f = await readAttachment(id);
  if (!f) return jsonError("This file was removed after 7 days.", 410);
  const inline = isImage(f.a.mime);
  return new NextResponse(new Uint8Array(f.bytes), {
    headers: {
      "Content-Type": f.a.mime,
      "Content-Length": String(f.bytes.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(f.a.name)}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
