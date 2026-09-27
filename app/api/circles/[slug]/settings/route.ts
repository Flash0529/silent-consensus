import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getMember } from "@/lib/identity";
import { jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { postToGroup } from "@/lib/groupchat";
import { cleanName, zTitle } from "@/lib/names";
import { readRoomStyle, RoomStyleSchema } from "@/lib/hushstyle";

// Chat settings: name, color, background and chat photo. Any member can change them (like most
// group chats); each change is announced in the chat. Images arrive already resized to small JPEGs.

const JPEG = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
const PRESETS = ["preset:none", "preset:aurora", "preset:dusk", "preset:grid", "preset:dots", "preset:paper"];
const Body = z.object({
  title: zTitle().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  bgImage: z.string().max(900_000).nullable().optional(),
  photo: z.string().max(300_000).nullable().optional(),
  // "Hush in this chat": what the group calls Hush and how it behaves here.
  hushStyle: RoomStyleSchema.partial().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await getMember(slug);
  if (!me) return jsonError("Not a member of this chat", 401);
  if (!rateLimit(`chat-settings:${me.id}`, 20, 10 * 60_000)) return jsonError("Slow down a little.", 429);
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("Invalid request");
  }
  const p = Body.safeParse(raw);
  if (!p.success) return jsonError("That image is too big or not a supported type.");
  const d = p.data;
  if (d.bgImage && !(PRESETS.includes(d.bgImage) || JPEG.test(d.bgImage))) return jsonError("Unsupported background.");
  if (d.photo && !JPEG.test(d.photo)) return jsonError("Unsupported photo.");
  const data: Record<string, unknown> = {};
  const said: string[] = [];
  if (d.title !== undefined && !me.circle.isDirect && d.title !== me.circle.title) {
    data.title = d.title;
    said.push(`renamed the chat to "${d.title}"`);
  }
  if (d.color !== undefined) {
    data.color = d.color;
    said.push("changed the chat color");
  }
  if (d.bgImage !== undefined) {
    data.bgImage = d.bgImage === "preset:none" ? null : d.bgImage;
    said.push("changed the chat background");
  }
  if (d.photo !== undefined && !me.circle.isDirect) {
    data.photo = d.photo;
    said.push(d.photo ? "changed the chat photo" : "removed the chat photo");
  }
  if (d.hushStyle) {
    const cur = readRoomStyle(me.circle.hushStyle);
    const next = { ...cur, ...d.hushStyle, botName: cleanName(d.hushStyle.botName ?? cur.botName) || "Hush" };
    // Hush can't be renamed to look like someone in the chat.
    const names = await db.member.findMany({ where: { circleId: me.circleId }, select: { name: true } });
    if (names.some((n) => n.name.trim().toLowerCase() === next.botName.toLowerCase())) return jsonError("That's someone's name in this chat. Pick another name for Hush.");
    data.hushStyle = next;
    said.push(next.botName !== cur.botName ? `renamed Hush to "${next.botName}" in this chat` : "changed how Hush behaves in this chat");
  }
  if (!Object.keys(data).length) return NextResponse.json({ ok: true });
  await db.circle.update({ where: { id: me.circleId }, data });
  await postToGroup(me.circleId, "EVENT", `${me.name} ${said.join(" and ")}`);
  return NextResponse.json({ ok: true });
}
