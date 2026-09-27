import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { cookieName, decodeCookie, hashToken } from "@/lib/identity";
import { decryptPhone } from "@/lib/phone";

// Email + password accounts. Plans, chats, votes and shares are Member rows; a logged-in account
// owns its Member rows (Member.accountId), so they follow the person across devices.
// Passwords: scrypt with a per-password salt. Sessions: random token in an httpOnly cookie,
// only sha256(token) in the DB.

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number) => Promise<Buffer>;
export const ACCOUNT_COOKIE = "qc_account";
const SESSION_DAYS = 60;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [alg, salt, key] = stored.split("$");
  if (alg !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64url");
  const got = await scrypt(password, Buffer.from(salt, "base64url"), expected.length);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export const normalizeEmail = (e: string) => e.trim().toLowerCase();

// Devices: each browser gets a long-lived random id (qc_dev). Sessions remember which device and
// browser they're on and when they were last used, so Settings → Devices can list and remove them.
// Only sha256(device id) is stored.
const DEVICE_COOKIE = "qc_dev";
export async function deviceHash(create = true) {
  const jar = await cookies();
  let dev = jar.get(DEVICE_COOKIE)?.value;
  if (!dev && create) {
    dev = randomBytes(18).toString("base64url");
    jar.set(DEVICE_COOKIE, dev, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 400 * 86_400 });
  }
  return dev ? hashToken(dev) : null;
}

/** Is this browser one the account chose to remember (skip two-step codes here)? */
export async function isTrustedDevice(accountId: string) {
  const d = await deviceHash(false);
  return !!d && !!(await db.trustedDevice.findUnique({ where: { accountId_deviceHash: { accountId, deviceHash: d } } }));
}

export async function startSession(accountId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const ua = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  await db.accountSession.create({
    data: { tokenHash: hashToken(token), accountId, expiresAt, deviceHash: await deviceHash(), userAgent: ua, lastSeenAt: new Date() },
  });
  (await cookies()).set(ACCOUNT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(ACCOUNT_COOKIE)?.value;
  if (token) await db.accountSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(ACCOUNT_COOKIE);
}

/** The logged-in account for this request, or null. */
export async function getAccount() {
  const token = (await cookies()).get(ACCOUNT_COOKIE)?.value;
  if (!token) return null;
  const s = await db.accountSession.findUnique({ where: { tokenHash: hashToken(token) }, include: { account: true } });
  if (!s || s.expiresAt < new Date()) return null;
  // "Last active" for Settings → Devices (at most one write every 5 minutes per session).
  if (!s.lastSeenAt || Date.now() - +s.lastSeenAt > 5 * 60_000)
    await db.accountSession.update({ where: { tokenHash: s.tokenHash }, data: { lastSeenAt: new Date() } }).catch(() => {});
  return s.account;
}

/**
 * Attach plans joined on this browser before logging in (per-plan qc_<slug> cookies) to the account,
 * so nothing done before signing up is lost. Only unclaimed memberships are taken.
 */
export async function claimDeviceMemberships(accountId: string) {
  const jar = await cookies();
  let claimed = 0;
  for (const c of jar.getAll()) {
    if (!c.name.startsWith("qc_") || c.name === ACCOUNT_COOKIE || c.name === "qc_profile") continue;
    const decoded = decodeCookie(c.value);
    if (!decoded) continue;
    const m = await db.member.findUnique({ where: { tokenHash: hashToken(decoded.token) }, include: { circle: true } });
    if (!m || m.id !== decoded.memberId || cookieName(m.circle.slug) !== c.name || m.accountId) continue;
    // One membership per account per plan.
    const dup = await db.member.findFirst({ where: { circleId: m.circleId, accountId } });
    if (dup) continue;
    await db.member.update({ where: { id: m.id }, data: { accountId } });
    claimed++;
  }
  return claimed;
}

/** This account's chats (plans), most recently active first, with a preview and unread count. */
export async function myPlans(accountId: string) {
  const rows = await db.member.findMany({
    where: { accountId },
    take: 50,
    select: {
      id: true,
      interviewStatus: true,
      role: true,
      lastReadAt: true,
      clearedAt: true,
      createdAt: true,
      circle: {
        select: {
          id: true,
          slug: true,
          organizerId: true,
          orgId: true,
          isDemo: true,
          org: { select: { isDemo: true } },
          title: true,
          kind: true,
          status: true,
          isDirect: true,
          photo: true,
          members: { select: { id: true, name: true, avatarColor: true, account: { select: { photo: true } } }, orderBy: { createdAt: "asc" }, take: 6 },
          _count: { select: { members: true } },
        },
      },
    },
  });
  const waiting = await db.hushCheckInReply.findMany({
    where: { memberId: { in: rows.map((r) => r.id) }, checkIn: { status: "OPEN" } },
    select: {
      memberId: true,
      status: true,
      attending: true,
      confirm: true,
      checkIn: { select: { stage: true, organizerId: true, brief: true, item: { select: { title: true } } } },
    },
  });
  // Hush is waiting on you in your Hush chat (same rule as lib/checkin.ts needsMe).
  const needs = (w: (typeof waiting)[number]) =>
    w.checkIn.stage === "INTAKE"
      ? w.checkIn.organizerId === w.memberId
      : w.checkIn.stage === "ASKING"
        ? w.status === "ASKING"
        : w.checkIn.stage === "CONFIRMING" && w.attending !== "OUT" && !w.confirm;
  const waitingFor = new Map(waiting.filter(needs).map((w) => [w.memberId, w.checkIn.item?.title ?? w.checkIn.brief?.slice(0, 40) ?? "a plan"]));
  const out = await Promise.all(
    rows.map(async (r) => {
      const last = await db.groupMessage.findFirst({
        where: { circleId: r.circle.id, ...(r.clearedAt ? { createdAt: { gt: r.clearedAt } } : {}) },
        orderBy: { createdAt: "desc" },
        include: { member: { select: { name: true } }, item: { select: { title: true, kind: true } } },
      });
      const unread = await db.groupMessage.count({
        where: {
          circleId: r.circle.id,
          createdAt: { gt: [r.lastReadAt ?? r.createdAt, r.clearedAt ?? r.createdAt].reduce((a, b) => (a > b ? a : b)) },
          OR: [{ memberId: null }, { memberId: { not: r.id } }],
        },
      });
      // DMs show the other person, not a group name.
      const other = r.circle.isDirect ? r.circle.members.find((m) => m.id !== r.id) : null;
      return {
        slug: r.circle.slug,
        title: other ? other.name : r.circle.title,
        isDirect: r.circle.isDirect,
        photo: other ? (other.account?.photo ?? null) : r.circle.photo,
        kind: r.circle.kind,
        status: r.circle.status,
        members: r.circle._count.members,
        faces: (other ? [other] : r.circle.members).map((m) => ({ name: m.name, avatarColor: m.avatarColor })),
        organizer: r.role === "ORGANIZER",
        myChatDone: r.interviewStatus === "DONE",
        isAdmin: r.role === "ORGANIZER" || r.role === "ADMIN",
        hushWaiting: waitingFor.get(r.id) ?? null,
        // "Delete for everyone" is for group admins (not DMs, not the demo company).
        canDeleteForEveryone: !r.circle.isDirect && (r.role === "ORGANIZER" || r.role === "ADMIN") && !r.circle.isDemo && !r.circle.org?.isDemo,
        hidden: !!r.clearedAt && !last,
        unread,
        last: last
          ? {
              body: last.kind === "FILE" ? `📎 ${last.body}` : last.kind === "ITEM" && last.item ? `noticed ${last.item.kind === "TASK" ? "a to-do" : last.item.kind === "DECISION" ? "a decision" : "a plan"}: ${last.item.title}` : last.body.split("\n")[0],
              kind: last.kind,
              from: last.kind === "TEXT" || last.kind === "FILE" ? (last.member?.name ?? null) : last.kind === "HUSH" || last.kind === "PLAN" || last.kind === "ITEM" || last.kind === "ASK" ? "Hush" : null,
              at: last.createdAt,
            }
          : null,
        activeAt: last?.createdAt ?? r.createdAt,
      };
    }),
  );
  // Deleted for me, and nothing new since: not in the list.
  return out.filter((c) => !c.hidden || c.hushWaiting).sort((a, b) => +new Date(b.activeAt) - +new Date(a.activeAt));
}

// ---------- Two-step login (pending state between password and SMS code) ----------


const PENDING_COOKIE = "qc_2fa";
const PENDING_MS = 10 * 60_000;
const sign2fa = (v: string) => createHmac("sha256", process.env.COOKIE_SECRET ?? "").update(`2fa:${v}`).digest("base64url");

export async function setPending2fa(accountId: string) {
  const exp = Date.now() + PENDING_MS;
  const body = `${accountId}.${exp}`;
  (await cookies()).set(PENDING_COOKIE, `${body}.${sign2fa(body)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PENDING_MS / 1000,
  });
}

export async function readPending2fa() {
  const raw = (await cookies()).get(PENDING_COOKIE)?.value;
  if (!raw) return null;
  const [id, exp, mac] = raw.split(".");
  if (!id || !exp || !mac) return null;
  const expected = sign2fa(`${id}.${exp}`);
  if (mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  if (Number(exp) < Date.now()) return null;
  return id;
}

export async function clearPending2fa() {
  (await cookies()).delete(PENDING_COOKIE);
}

export const accountPhone = (a: { phoneEnc: string | null; phoneVerifiedAt: Date | null }) =>
  a.phoneEnc && a.phoneVerifiedAt ? decryptPhone(a.phoneEnc) : null;

export async function endAllSessions(accountId: string) {
  await db.accountSession.deleteMany({ where: { accountId } });
}

/**
 * Delete an account: private data goes (Hush chats, private answers, messages they sent); plans other
 * people are in keep working, with this person shown as "Deleted user".
 */
export async function deleteAccount(accountId: string) {
  const members = await db.member.findMany({ where: { accountId }, select: { id: true } });
  const ids = members.map((m) => m.id);
  await db.$transaction([
    db.message.deleteMany({ where: { memberId: { in: ids } } }),
    db.vault.deleteMany({ where: { memberId: { in: ids } } }),
    db.perspective.deleteMany({ where: { memberId: { in: ids } } }),
    db.groupMessage.deleteMany({ where: { memberId: { in: ids } } }),
    db.member.updateMany({
      where: { id: { in: ids } },
      data: { name: "Deleted user", accountId: null, userId: null, profileId: null, persona: null },
    }),
    db.account.delete({ where: { id: accountId } }),
  ]);
  (await cookies()).delete(ACCOUNT_COOKIE);
}
