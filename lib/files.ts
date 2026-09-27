import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";

// Files shared in chats (photos, PDFs, documents).
// - Kept for 7 days, then deleted (the message stays, saying the file was removed).
// - Hush CANNOT see a file unless the person who sent it answered "Yes" to the fixed question
//   "Would you like this to be seen by Hush AI?". That answer is stored on the file (aiVisible) and
//   only the sender can set it. Every prompt that mentions files goes through aiFileLines(), which
//   only ever reads files with aiVisible = true. Nothing else hands file contents to the model.

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "/home/pi/quiet-consensus/uploads";
export const MAX_BYTES = 15 * 1024 * 1024;
export const KEEP_DAYS = 7;

// Allowed types (no SVG/HTML: they could run scripts when opened).
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "text/markdown": "md",
  "application/json": "json",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/zip": "zip",
};
export const allowedType = (mime: string) => mime in TYPES;
export const isImage = (mime: string) => /^image\/(jpeg|png|gif|webp)$/.test(mime);
const TEXTY = /^(text\/|application\/json)/;

export async function saveFile(opts: { circleId: string; memberId: string; name: string; mime: string; bytes: Buffer }) {
  await mkdir(UPLOAD_DIR, { recursive: true, mode: 0o700 });
  const name = opts.name.replace(/[\u0000-\u001f\\/:*?"<>|]+/g, "_").slice(0, 120) || "file";
  const msg = await db.groupMessage.create({ data: { circleId: opts.circleId, memberId: opts.memberId, kind: "FILE", body: name } });
  const att = await db.attachment.create({
    data: {
      circleId: opts.circleId,
      memberId: opts.memberId,
      messageId: msg.id,
      name,
      mime: opts.mime,
      size: opts.bytes.length,
      path: "",
      expiresAt: new Date(Date.now() + KEEP_DAYS * 864e5),
    },
  });
  const file = path.join(UPLOAD_DIR, `${att.id}.${TYPES[opts.mime] ?? "bin"}`);
  await writeFile(file, opts.bytes, { mode: 0o600 });
  await db.attachment.update({ where: { id: att.id }, data: { path: file } });
  return { messageId: msg.id, attachmentId: att.id };
}

export async function readAttachment(id: string) {
  const a = await db.attachment.findUnique({ where: { id } });
  if (!a || !a.path || a.expiresAt < new Date()) return null;
  return { a, bytes: await readFile(a.path) };
}

/** Delete files past their 7 days (runs every hour, and on demand). */
export async function cleanupExpiredFiles() {
  const old = await db.attachment.findMany({ where: { expiresAt: { lt: new Date() } }, take: 200 });
  for (const a of old) {
    if (a.path) await rm(a.path, { force: true }).catch(() => {});
    if (a.messageId) await db.groupMessage.update({ where: { id: a.messageId }, data: { body: `${a.name} (removed after ${KEEP_DAYS} days)` } }).catch(() => {});
    await db.attachment.delete({ where: { id: a.id } }).catch(() => {});
  }
  return old.length;
}

/**
 * The ONLY way file contents reach a prompt: files in this chat whose sender said "Yes" to Hush
 * seeing them. Text files contribute their first 2,000 characters; others just their name and type.
 */
export async function aiFileLines(circleId: string) {
  const files = await db.attachment.findMany({ where: { circleId, aiVisible: true, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, take: 5 });
  const out: string[] = [];
  for (const f of files) {
    let excerpt = "";
    if (TEXTY.test(f.mime) && f.path) excerpt = (await readFile(f.path, "utf8").catch(() => "")).slice(0, 2000);
    out.push(`[Shared file "${f.name}" (${f.mime})${excerpt ? `:\n${excerpt}` : ""}]`);
  }
  return out;
}
