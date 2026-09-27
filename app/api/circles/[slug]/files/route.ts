import { NextResponse } from "next/server";
import { getMember } from "@/lib/identity";
import { jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { allowedType, MAX_BYTES, saveFile } from "@/lib/files";
import { db } from "@/lib/db";

// Share a file in the chat. It's deleted after 7 days, and Hush can't see it unless you say so.
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await getMember(slug);
  if (!me) return jsonError("Not a member of this chat", 401);
  if (!rateLimit(`upload:${me.id}`, 20, 10 * 60_000)) return jsonError("That's a lot of files. Try again in a few minutes.", 429);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("Upload a file.");
  }
  const f = form.get("file");
  if (!(f instanceof File)) return jsonError("Upload a file.");
  if (f.size > MAX_BYTES) return jsonError("Files can be up to 15 MB.", 413);
  if (!allowedType(f.type)) return jsonError("That type of file isn't supported. Photos, PDFs, text and Office files work.", 415);
  const bytes = Buffer.from(await f.arrayBuffer());
  const r = await saveFile({ circleId: me.circleId, memberId: me.id, name: f.name, mime: f.type, bytes });
  await db.member.update({ where: { id: me.id }, data: { lastReadAt: new Date() } });
  return NextResponse.json(r);
}
