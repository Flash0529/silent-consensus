import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/twilio/consent";
import { claimDeviceMemberships, hashPassword, normalizeEmail, startSession } from "@/lib/account";
import { domainOf, isPersonalDomain, orgForEmail } from "@/lib/org";
import { zPersonName, zTitle } from "@/lib/names";

const Body = z.object({
  name: zPersonName(),
  email: z.string().trim().email("Enter a valid email.").max(200),
  password: z.string().min(8, "Use at least 8 characters.").max(200),
  // Business sign-up: the company name (only used if this is the first account at that email domain).
  company: zTitle(80).optional(),
});

export async function POST(req: Request) {
  if (!rateLimit(`signup:${clientIp(req) ?? "?"}`, 10, 60 * 60_000)) return jsonError("Too many sign-ups. Try again later.", 429);
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("Invalid request");
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Check your details.");
  const email = normalizeEmail(parsed.data.email);
  if (await db.account.findUnique({ where: { email } }))
    return jsonError("There's already an account with that email. Log in instead.", 409);
  // Work email: join that company, or (business sign-up) set the company up with you as its admin.
  let org = await orgForEmail(email);
  let orgRole: string | null = org ? "MEMBER" : null;
  if (parsed.data.company !== undefined) {
    const d = domainOf(email);
    if (isPersonalDomain(d)) return jsonError("Use your work email (not Gmail, Outlook, iCloud and so on).");
    if (!org) {
      org = await db.organization.create({ data: { name: parsed.data.company, domain: d } });
      orgRole = "ADMIN";
    }
  }
  const account = await db.account.create({
    data: {
      email,
      name: parsed.data.name,
      passwordHash: await hashPassword(parsed.data.password),
      orgId: org?.id ?? null,
      orgRole,
    },
  });
  await startSession(account.id);
  const claimed = await claimDeviceMemberships(account.id);
  return NextResponse.json({ account: { name: account.name, email: account.email }, claimed });
}
