import { db } from "@/lib/db";

// Manager review (business, off by default; a company admin turns it on):
// - In work chats Hush reads each message before coworkers do (lib/ai/tone.ts). If it's flagged, only
//   the sender sees a suggested rewrite, plus (when the policy is on) a clear warning of what happens
//   if they send it as written anyway.
// - Sending a flagged message as written ("Send mine anyway") 3+ times in 7 days opens a review for
//   the person's manager (HR if any of them was serious: harassment, threats, slurs, discrimination;
//   HR too if no manager is set). They're told when it happens.
// - A review contains ONLY those messages as they were sent to coworkers, and Hush's reason. Never
//   anything from private Hush chats. A person decides what happens; Hush never acts on its own.
//
// "Sent as written" is decided by the server, not the client: the server remembers what it flagged
// and what it suggested, and compares the message that's finally sent.

export const THRESHOLD = 3;
export const WINDOW_MS = 7 * 864e5;
const PENDING_MS = 15 * 60_000;

type Pending = { original: string; suggestion: string; issue: string | null; severity: "tone" | "serious"; at: number };
const pending = new Map<string, Pending>(); // member id → the last message Hush flagged for them

export function rememberFlag(memberId: string, p: Omit<Pending, "at">) {
  pending.set(memberId, { ...p, at: Date.now() });
}

/** Is this send Hush's suggestion, the flagged original (sent anyway), or something new? */
export function matchFlag(memberId: string, body: string): { kind: "suggestion" | "original"; p: Pending } | null {
  const p = pending.get(memberId);
  if (!p || Date.now() - p.at > PENDING_MS) return null;
  const norm = (t: string) => t.trim().replace(/\s+/g, " ");
  if (norm(body) === norm(p.suggestion)) return { kind: "suggestion", p };
  if (norm(body) === norm(p.original)) return { kind: "original", p };
  return null;
}
export const clearFlag = (memberId: string) => pending.delete(memberId);

/** What the sender is told before they choose (null = the company doesn't use manager review). */
export async function policyFor(accountId: string | null, severity: "tone" | "serious") {
  if (!accountId) return null;
  const a = await db.account.findUnique({ where: { id: accountId }, select: { orgId: true, managerId: true, org: { select: { managerReview: true } } } });
  if (!a?.orgId || !a.org?.managerReview) return null;
  const count = await db.toneOverride.count({ where: { accountId, escalationId: null, at: { gt: new Date(Date.now() - WINDOW_MS) } } });
  const to = severity === "serious" || !a.managerId ? "HR" : "your manager";
  return { next: count + 1, threshold: THRESHOLD, to, willEscalate: count + 1 >= THRESHOLD };
}

/** They sent a flagged message as written. Record it (policy on only) and escalate at the threshold. */
export async function recordOverride(opts: { accountId: string; memberId: string; circleId: string; text: string; issue: string | null; severity: "tone" | "serious" }) {
  const a = await db.account.findUnique({ where: { id: opts.accountId }, select: { id: true, name: true, orgId: true, managerId: true, org: { select: { managerReview: true } } } });
  if (!a?.orgId || !a.org?.managerReview) return null;
  const circle = await db.circle.findUnique({ where: { id: opts.circleId }, select: { title: true, isDirect: true } });
  await db.toneOverride.create({
    data: { accountId: a.id, orgId: a.orgId, circleTitle: circle?.isDirect ? "a direct message" : (circle?.title ?? "a chat"), text: opts.text.slice(0, 2000), issue: opts.issue?.slice(0, 300) ?? null, severity: opts.severity },
  });
  const open = await db.toneOverride.findMany({ where: { accountId: a.id, escalationId: null, at: { gt: new Date(Date.now() - WINDOW_MS) } }, orderBy: { at: "asc" } });
  if (open.length < THRESHOLD) return null;
  const serious = open.some((o) => o.severity === "serious");
  const route = serious || !a.managerId ? "HR" : "MANAGER";
  const esc = await db.escalation.create({
    data: { orgId: a.orgId, subjectId: a.id, route, recipientId: route === "MANAGER" ? a.managerId : null, severity: serious ? "serious" : "tone" },
  });
  await db.toneOverride.updateMany({ where: { id: { in: open.map((o) => o.id) } }, data: { escalationId: esc.id } });
  // Tell them (in their private Hush chat for this group), plainly.
  await db.message.create({
    data: {
      memberId: opts.memberId,
      role: "HUSH",
      topic: "dm",
      content: `Heads up: this week you sent ${open.length} messages as written after I flagged them, so they've been shared with ${route === "HR" ? "HR" : "your manager"} for review, as your company's policy says. Only those messages and why I flagged them were shared. Nothing from our private chats.`,
    },
  });
  return esc;
}

/** Reviews this person can see: theirs as a manager, and HR's if they're on HR (or an admin when the company has no HR). */
export async function reviewsFor(accountId: string) {
  const me = await db.account.findUnique({ where: { id: accountId }, select: { id: true, orgId: true, isHr: true, orgRole: true } });
  if (!me?.orgId) return { me, where: null };
  const hrCount = await db.account.count({ where: { orgId: me.orgId, isHr: true } });
  const seesHr = me.isHr || (hrCount === 0 && me.orgRole === "ADMIN");
  const where = { orgId: me.orgId, OR: [{ recipientId: me.id }, ...(seesHr ? [{ route: "HR" }] : [])] };
  return { me, where };
}
