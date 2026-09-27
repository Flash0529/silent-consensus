// Seeds a FAKE demo company for trying the business version: "Northwind Studio" (northwind.test).
// Re-running it resets the demo company (only rows belonging to it). Usage: node scripts/seed-demo-company.mjs
import { randomBytes, scrypt as scryptCb, createHash } from "node:crypto";
import { promisify } from "node:util";
import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";

nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const db = new PrismaClient();
const scrypt = promisify(scryptCb);
const PASSWORD = "northwind-demo";
const DOMAIN = "northwind.test";
const COLORS = ["blue", "peach", "green", "lilac"];

async function hash(pw) {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}
const token = () => createHash("sha256").update(randomBytes(24)).digest("hex");
const slug = () => randomBytes(6).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8).padEnd(8, "x");

// Next Tuesday 2 PM and Thursday 5 PM Eastern (as UTC instants; EDT = UTC-4).
function nextDow(dow, hourEt) {
  const d = new Date();
  const add = ((dow - d.getUTCDay() + 7) % 7) || 7;
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + add, hourEt + 4, 0));
  return t;
}

(async () => {
  // Reset the demo company if it exists.
  const old = await db.organization.findUnique({ where: { domain: DOMAIN } });
  if (old) {
    await db.circle.deleteMany({ where: { orgId: old.id } });
    await db.account.deleteMany({ where: { orgId: old.id } });
    await db.organization.delete({ where: { id: old.id } });
  }
  // Manager review is on in the demo so it can be shown (Priya manages the team; Morgan is HR).
  const org = await db.organization.create({ data: { name: "Northwind Studio", domain: DOMAIN, isDemo: true, managerReview: true } });
  const people = [
    ["Priya Shah", "priya", "ADMIN"],
    ["Jordan Lee", "jordan", "MEMBER"],
    ["Sam Rivera", "sam", "MEMBER"],
    ["Alex Kim", "alex", "MEMBER"],
    ["Morgan Ellis", "morgan", "MEMBER"],
  ];
  const pw = await hash(PASSWORD);
  const acct = {};
  for (const [name, user, role] of people) {
    acct[user] = await db.account.create({
      data: {
        name,
        email: `${user}@${DOMAIN}`,
        passwordHash: pw,
        orgId: org.id,
        orgRole: role,
        isHr: user === "morgan",
        bio: role === "ADMIN" ? "Head of Product" : user === "morgan" ? "People Ops" : null,
      },
    });
  }
  for (const u of ["jordan", "sam", "alex"]) await db.account.update({ where: { id: acct[u].id }, data: { managerId: acct.priya.id } });

  async function group(title, users, script, items) {
    const now = new Date();
    const circle = await db.circle.create({
      data: {
        slug: slug(), title, activity: "work", area: "", mode: "WORK", orgId: org.id,
        windowStart: now, windowEnd: new Date(now.getTime() + 14 * 86_400_000),
      },
    });
    const mem = {};
    for (const [i, u] of users.entries()) {
      mem[u] = await db.member.create({
        data: {
          circleId: circle.id, name: acct[u].name, avatarColor: COLORS[i % 4], tokenHash: token(),
          accountId: acct[u].id, role: i === 0 ? "ORGANIZER" : "MEMBER", lastReadAt: new Date(),
        },
      });
    }
    await db.circle.update({ where: { id: circle.id }, data: { organizerId: mem[users[0]].id } });
    let t = Date.now() - (script.length + 3) * 90_000;
    const at = () => new Date((t += 90_000));
    await db.groupMessage.create({ data: { circleId: circle.id, kind: "EVENT", body: `${acct[users[0]].name} started the group`, createdAt: at() } });
    await db.groupMessage.create({
      data: {
        circleId: circle.id, kind: "HUSH", createdAt: at(),
        body: "Hi team, I'm Hush. I'll quietly keep track of meetings, action items and decisions as you chat, so nothing slips. Press and hold an empty spot in the chat (right-click on a computer) if you want me to step in.",
      },
    });
    for (const [u, body] of script) await db.groupMessage.create({ data: { circleId: circle.id, kind: "TEXT", memberId: mem[u].id, body, createdAt: at() } });
    for (const it of items) {
      const item = await db.chatItem.create({ data: { circleId: circle.id, ...it.data } });
      await db.groupMessage.create({ data: { circleId: circle.id, kind: "ITEM", body: "new", itemId: item.id, createdAt: at() } });
      for (const [u, answer] of it.rsvp ?? []) await db.chatItemResponse.create({ data: { itemId: item.id, memberId: mem[u].id, answer } });
    }
    return circle;
  }

  const launch = await group(
    "Spring launch",
    ["priya", "jordan", "sam", "alex"],
    [
      ["priya", "Morning all. Can we do a launch review next Tuesday at 2 in the Harbor room?"],
      ["jordan", "Works for me"],
      ["sam", "Same. I'll finish the pricing page by Thursday so we can review it there"],
      ["alex", "I can have the launch video cut by then too"],
      ["priya", "Great. Decision: we're shipping April 14, no more scope changes"],
    ],
    [
      { data: { kind: "EVENT", title: "Launch review", startsAt: nextDow(2, 14), whenText: "next Tuesday at 2", place: "Harbor room" }, rsvp: [["priya", "IN"], ["jordan", "IN"], ["sam", "IN"]] },
      { data: { kind: "TASK", title: "Finish the pricing page", owner: "Sam Rivera", startsAt: nextDow(4, 17), whenText: "by Thursday" } },
      { data: { kind: "TASK", title: "Cut the launch video", owner: "Alex Kim", whenText: "before the launch review" } },
      { data: { kind: "DECISION", title: "Ship on April 14, no more scope changes" } },
    ],
  );
  await group(
    "Design crit",
    ["alex", "priya", "jordan"],
    [
      ["alex", "New onboarding screens are up in Figma"],
      ["jordan", "Nice. The empty state on step 3 feels a bit heavy"],
      ["alex", "Agreed, I'll simplify it before Friday"],
    ],
    [{ data: { kind: "TASK", title: "Simplify the step 3 empty state", owner: "Alex Kim", whenText: "before Friday" } }],
  );
  console.log(`Seeded ${org.name}: ${people.length} people, 2 work groups (launch: ${launch.slug}). Password for all: ${PASSWORD}`);
  await db.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
