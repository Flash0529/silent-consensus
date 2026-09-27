import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { maskPhone } from "@/lib/phone";
import { accountPhone, endAllSessions, getAccount, hashPassword, normalizeEmail, startSession, verifyPassword } from "@/lib/account";
import { zPersonName } from "@/lib/names";

// Your account settings. Only ever the caller's own account; sensitive changes need your password.

export async function GET() {
  const a = await getAccount();
  if (!a) return jsonError("Log in first.", 401);
  const phone = accountPhone(a);
  return NextResponse.json(
    { name: a.name, email: a.email, phone: phone ? maskPhone(phone) : null, twoFactor: a.twoFactor, createdAt: a.createdAt, photo: a.photo, bio: a.bio },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const Patch = z.object({
  name: zPersonName().optional(),
  email: z.string().trim().email("Enter a valid email.").max(200).optional(),
  newPassword: z.string().min(8, "Use at least 8 characters.").max(200).optional(),
  twoFactor: z.boolean().optional(),
  currentPassword: z.string().max(200).optional(),
  // Profile photo: a small JPEG data URL resized in the browser; null removes it.
  photo: z.string().max(300_000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/, "Unsupported photo.").nullable().optional(),
  bio: z.string().trim().max(140).nullable().optional(),
  // The browser's time zone (sent automatically), so Hush's times are right for you.
  timeZone: z.string().max(60).regex(/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/).optional(),
});

export async function PATCH(req: Request) {
  const a = await getAccount();
  if (!a) return jsonError("Log in first.", 401);
  if (!rateLimit(`acct:${a.id}`, 20, 10 * 60_000)) return jsonError("Slow down a little and try again.", 429);
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("Invalid request");
  }
  const p = Patch.safeParse(raw);
  if (!p.success) return jsonError(p.error.issues[0]?.message ?? "Check your details.");
  const d = p.data;

  const sensitive = d.email !== undefined || d.newPassword !== undefined || d.twoFactor === false;
  if (sensitive && !(d.currentPassword && (await verifyPassword(d.currentPassword, a.passwordHash))))
    return jsonError("Your current password isn't right.", 403);

  const data: Record<string, unknown> = {};
  if (d.name !== undefined) data.name = d.name;
  if (d.photo !== undefined) data.photo = d.photo;
  if (d.bio !== undefined) data.bio = d.bio || null;
  if (d.timeZone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: d.timeZone });
      data.timeZone = d.timeZone;
    } catch {
      /* not a real zone: ignore */
    }
  }
  if (d.email !== undefined) {
    const email = normalizeEmail(d.email);
    if (email !== a.email && (await db.account.findUnique({ where: { email } })))
      return jsonError("Another account already uses that email.", 409);
    data.email = email;
  }
  if (d.newPassword !== undefined) data.passwordHash = await hashPassword(d.newPassword);
  if (d.twoFactor !== undefined) {
    if (d.twoFactor && !accountPhone(a)) return jsonError("Link a phone first.", 400);
    data.twoFactor = d.twoFactor;
  }
  await db.account.update({ where: { id: a.id }, data });
  // Keep your own name in your groups in step with your account name.
  if (d.name !== undefined) await db.member.updateMany({ where: { accountId: a.id }, data: { name: d.name } });
  // New password: sign out everywhere else, keep this device signed in.
  if (d.newPassword !== undefined) {
    await endAllSessions(a.id);
    await startSession(a.id);
  }
  return NextResponse.json({ ok: true });
}
