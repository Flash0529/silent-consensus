import { db } from "@/lib/db";

// Business accounts: a company (Organization) owns an email domain; anyone who signs up with an email
// at that domain joins it. Personal email providers can't be company domains.

const PERSONAL = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "yahoo.com", "ymail.com",
  "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "mail.com", "zoho.com",
  "yandex.com", "example.com",
]);

export const domainOf = (email: string) => email.trim().toLowerCase().split("@")[1] ?? "";
export const isPersonalDomain = (d: string) => PERSONAL.has(d);

export function orgForEmail(email: string) {
  const d = domainOf(email);
  if (!d || isPersonalDomain(d)) return null;
  return db.organization.findUnique({ where: { domain: d } });
}

/** An account's company role, or null. */
export async function orgOf(accountId: string) {
  const a = await db.account.findUnique({ where: { id: accountId }, include: { org: true } });
  return a?.org ? { org: a.org, role: a.orgRole ?? "MEMBER" } : null;
}
