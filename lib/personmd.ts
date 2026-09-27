import { db } from "@/lib/db";
import { prefsMd, readStyle } from "@/lib/hushstyle";

// Every person has a small Markdown profile that Hush reads before it talks to them or plans for them,
// so it starts from what it already knows instead of from zero (a "soft entrance").
//
//   # Ana
//   ## About (the group can know this)      ← name, bio, time zone, whether a calendar is linked
//   ## Private (only Hush reads this)       ← things they told Hush privately that are worth keeping
//
// Privacy rules:
// - Prompts whose output the GROUP sees (detection, Hush replying in the group, tone check) only ever
//   get the About section (aboutFor / groupAbout).
// - Private chats with Hush get the whole profile, for that one person only (personMd).
// - Group-level decisions (lib/checkin.ts) get everyone's profile WITHOUT names (P1, P2, …), and the
//   result is name-filtered before it's posted.
// - People can read, edit, download or clear their own profile in Settings.

const MAX_NOTES = 2500;

type AccountLike = {
  id: string;
  name: string;
  bio: string | null;
  timeZone: string | null;
  hushMd: string | null;
  hushStyle?: unknown;
  _count?: { calendars: number };
};

async function load(accountId: string): Promise<AccountLike | null> {
  return db.account.findUnique({
    where: { id: accountId },
    select: { id: true, name: true, bio: true, timeZone: true, hushMd: true, hushStyle: true, _count: { select: { calendars: true } } },
  });
}

/** What they set in "Make Hush yours" (only if they've set it). */
const prefsOf = (a: AccountLike) => (a.hushStyle ? `\n### Preferences they set\n${prefsMd(readStyle(a.hushStyle))}\n` : "");

function about(a: AccountLike, nameAs?: string) {
  const lines = [`- Name: ${nameAs ?? a.name}`];
  if (a.bio && !nameAs) lines.push(`- Bio: ${a.bio.replace(/\s+/g, " ").slice(0, 200)}`);
  if (a.timeZone) lines.push(`- Time zone: ${a.timeZone}`);
  lines.push(`- Calendar linked: ${a._count?.calendars ? "yes (Hush can see when they're busy, never what it is)" : "no"}`);
  return lines.join("\n");
}

const notesOf = (a: AccountLike) => (a.hushMd ?? "").trim() || "_Nothing yet._";

/** The whole profile, for this person's own private chat with Hush. */
export async function personMd(accountId: string) {
  const a = await load(accountId);
  if (!a) return "";
  return `# ${a.name}\n\n## About (the group can know this)\n${about(a)}\n\n## Private (only Hush reads this; never share or quote it)\n${notesOf(a)}\n${prefsOf(a)}`;
}

/** Same profile with the name swapped for a label (P1, P2…), for group-level decisions. */
export async function anonymousMd(accountId: string, label: string) {
  const a = await load(accountId);
  if (!a) return "";
  const scrub = (t: string) => t.replace(new RegExp(`\\b${a.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), label);
  return `# ${label}\n## About\n${about(a, label)}\n## Private notes\n${scrub(notesOf(a))}\n${prefsOf(a)}`;
}

/** Only the About parts of everyone in a group, for prompts whose output the whole group sees. */
export async function groupAbout(circleId: string) {
  const members = await db.member.findMany({
    where: { circleId, accountId: { not: null } },
    select: { name: true, account: { select: { id: true, name: true, bio: true, timeZone: true, hushMd: true, _count: { select: { calendars: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  const parts = members.filter((m) => m.account).map((m) => `### ${m.name}\n${about({ ...m.account!, name: m.name })}`);
  return parts.length ? `People in this chat (public profile only):\n${parts.join("\n")}` : "";
}

/** Add things worth remembering to someone's private notes (deduped, newest last, size-capped). */
export async function rememberFacts(accountId: string, facts: string[]) {
  const clean = facts.map((f) => f.replace(/\s+/g, " ").trim().replace(/^[-*]\s*/, "")).filter((f) => f.length > 2 && f.length < 200);
  if (!clean.length) return;
  const a = await db.account.findUnique({ where: { id: accountId }, select: { hushMd: true } });
  const existing = (a?.hushMd ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const seen = new Set(existing.map((l) => l.replace(/^[-*]\s*/, "").toLowerCase()));
  const added = clean.filter((f) => !seen.has(f.toLowerCase())).map((f) => `- ${f}`);
  if (!added.length) return;
  let lines = [...existing, ...added];
  while (lines.join("\n").length > MAX_NOTES && lines.length > 1) lines = lines.slice(1); // oldest go first
  await db.account.update({ where: { id: accountId }, data: { hushMd: lines.join("\n") } });
}
