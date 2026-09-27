import { createHmac } from "node:crypto";
import { db } from "@/lib/db";
import { newDeviceToken } from "@/lib/identity";
import { newSlug } from "@/lib/slug";
import { postToGroup } from "@/lib/groupchat";

// Direct messages: a two-person chat (Circle.isDirect). You can DM someone you share a group with,
// or someone you found through your contacts (a signed, short-lived "connect" token from the match).

const secret = () => process.env.COOKIE_SECRET ?? "";
export function connectToken(fromAccountId: string, toAccountId: string) {
  const exp = Date.now() + 60 * 60_000;
  const body = `${fromAccountId}.${toAccountId}.${exp}`;
  return `${exp}.${createHmac("sha256", secret()).update(`connect:${body}`).digest("base64url")}`;
}
export function checkConnectToken(fromAccountId: string, toAccountId: string, token: string) {
  const [exp, mac] = token.split(".");
  if (!exp || !mac || Number(exp) < Date.now()) return false;
  const expected = createHmac("sha256", secret()).update(`connect:${fromAccountId}.${toAccountId}.${exp}`).digest("base64url");
  return mac === expected;
}

export async function sharesAGroup(a: string, b: string) {
  const mine = await db.member.findMany({ where: { accountId: a }, select: { circleId: true } });
  return !!(await db.member.findFirst({ where: { accountId: b, circleId: { in: mine.map((m) => m.circleId) } } }));
}

/** The existing DM between two accounts, or a new one. Returns its slug. */
export async function openDm(me: { id: string; name: string }, other: { id: string; name: string }) {
  const existing = await db.circle.findFirst({
    where: {
      isDirect: true,
      AND: [{ members: { some: { accountId: me.id } } }, { members: { some: { accountId: other.id } } }],
    },
    select: { slug: true },
  });
  if (existing) return existing.slug;
  const now = new Date();
  const circle = await db.circle.create({
    data: {
      slug: newSlug(),
      title: "Direct message",
      activity: "hangout",
      area: "",
      isDirect: true,
      windowStart: now,
      windowEnd: new Date(now.getTime() + 14 * 86_400_000),
      members: {
        create: [
          { name: me.name, avatarColor: "blue", tokenHash: newDeviceToken().tokenHash, role: "ORGANIZER", accountId: me.id },
          { name: other.name, avatarColor: "peach", tokenHash: newDeviceToken().tokenHash, accountId: other.id },
        ],
      },
    },
    include: { members: true },
  });
  await db.circle.update({ where: { id: circle.id }, data: { organizerId: circle.members.find((m) => m.accountId === me.id)!.id } });
  await postToGroup(circle.id, "EVENT", `${me.name} started a conversation`);
  return circle.slug;
}
