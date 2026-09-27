import type { Circle, Member, User } from "@prisma/client";
import { db } from "@/lib/db";
import { avatarFor } from "@/lib/avatars";
import { newDeviceToken } from "@/lib/identity";
import { newSlug } from "@/lib/slug";
import { encryptPhone, decryptPhone, normalizePhone, phoneHash } from "@/lib/phone";
import { ensureOpening, handleTurn } from "@/lib/ai/interview";
import { groupInclude, toGroupSafe } from "@/lib/serialize";
import {
  addDmParticipant,
  addGroupSmsParticipant,
  addHushToGroup,
  createConversation,
  deleteConversation,
  HUSH_IDENTITY,
  listParticipants,
  recentMessages,
  sendConversationMessage,
  textingEnabled,
  TwilioError,
} from "./client";
import { DISPARITY_THRESHOLD, dayKey, gate, judge, rulesPass, type GroupLine } from "./disparity";
import {
  ASK_NAME,
  CHECK_IN_GROUP_MESSAGE,
  cleanName,
  formatForSms,
  HUSH_HELP,
  HUSH_INTRO,
  parseKeyword,
  resolveReply,
} from "./sms";
import { canText, SITE_URL, SMS_OPT_IN_CONFIRMATION } from "./consent";

// Hush in the group text (spec §2). Web chat and SMS feed the SAME interview state:
// both call handleTurn() on the same Member row.
//
// SMS consent is a hard condition (lib/twilio/consent.ts#canText): Hush only texts numbers whose
// owner opted in on the web, and only takes part in a group text when EVERYONE in it has opted in.
// Otherwise it stays silent there and tells the opted-in members privately.

type MemberWithCircle = Member & { circle: Circle };

const FRIEND = "Friend";
const MAX_GROUP_PHONES = 9; // Group MMS caps at 10 participants, Hush included.

/** Entry point for Conversations `onMessageAdded` webhooks. */
export async function handleConversationEvent(p: Record<string, string>) {
  if (p.EventType !== "onMessageAdded") return;
  const convSid = p.ConversationSid;
  const body = (p.Body ?? "").trim();
  if (!convSid || !body || p.Author === HUSH_IDENTITY) return;
  const phone = normalizePhone(p.Author ?? "");
  if (!phone) return; // Non-SMS authors (web chat identities) are handled by the web app.

  const circle = await db.circle.findUnique({ where: { groupConversationSid: convSid } });
  if (circle) return onGroupMessage(circle, convSid, phone, body);

  const dmUser = await db.user.findUnique({ where: { dmConversationSid: convSid } });
  if (dmUser) return onDirectMessage(dmUser, convSid, phone, body);

  // A conversation we haven't seen: Twilio auto-created it when someone texted Hush's number,
  // either 1:1 or by adding Hush to an existing group text.
  const phones = await smsPhonesIn(convSid);
  if (phones.length >= 2) {
    const created = await circleFromGroupText(convSid, phones, phone);
    if (created.smsHeldAt) return; // someone in it hasn't opted in: stay silent
    return onGroupMessage(created, convSid, phone, body);
  }
  // 1:1 text from a number that never opted in: only HELP gets an answer; nothing is stored.
  const known = await db.user.findUnique({ where: { phoneHash: phoneHash(phone) } });
  if (!canText(known)) {
    if (parseKeyword(body)?.kw === "help") await say(convSid, HUSH_HELP);
    return;
  }
  const claimed = await db.user.update({ where: { id: known!.id }, data: { dmConversationSid: convSid } });
  return onDirectMessage(claimed, convSid, phone, body);
}

// ---------- Group thread ----------

async function onGroupMessage(circle: Circle, convSid: string, phone: string, body: string) {
  if (!(await groupReady(circle, convSid))) return; // not everyone has opted in: stay silent
  const user = await ensureUser(phone);
  await memberFor(circle, user);

  const kw = parseKeyword(body);
  if (kw?.kw === "mute") {
    await db.circle.update({ where: { id: circle.id }, data: { proactiveMutedAt: new Date() } });
    return say(convSid, "Got it. I'll pause my check-ins for this group. Text UNMUTE anytime.");
  }
  if (kw?.kw === "unmute") {
    await db.circle.update({ where: { id: circle.id }, data: { proactiveMutedAt: null } });
    return say(convSid, "I'm back on. I'll check in privately if a plan seems stuck.");
  }
  if (kw?.kw === "help") return say(convSid, HUSH_HELP);
  if (kw) return; // STOP/START are handled by carrier opt-out; JOIN makes no sense in a group.

  // Recent lines are read transiently for the judge and never stored.
  let recent: GroupLine[] = [];
  try {
    recent = (await recentMessages(convSid, 12)).filter((m) => m.author !== HUSH_IDENTITY);
  } catch (e) {
    console.error("recentMessages failed", e);
  }
  const latest: GroupLine = { author: phone, body };
  const before = recent.length && recent[recent.length - 1].body === body ? recent.slice(0, -1) : recent;

  const rule = rulesPass(latest, before);
  if (!rule.fired) return;
  const asked = rule.kind === "asked";

  let kind = rule.kind;
  let confidence = rule.score;
  if (!asked) {
    const verdict = await judge([...before, latest], circle.id);
    if (verdict) {
      kind = verdict.kind;
      confidence = verdict.disparity ? verdict.confidence : 0;
    }
  }

  const fresh = await db.circle.findUniqueOrThrow({ where: { id: circle.id } });
  const g = gate(fresh, { asked });
  const acted = confidence >= DISPARITY_THRESHOLD && g.ok;
  await db.disparityEvent.create({ data: { circleId: circle.id, kind, confidence, acted } });
  if (acted) await startCheckIns(fresh, { asked });
}

/**
 * Post one neutral message to the group, then check in with EVERY member privately, never
 * only the person who hesitated (spec §2.3 privacy rule).
 */
export async function startCheckIns(circle: Circle, opts: { asked?: boolean } = {}) {
  const today = dayKey();
  await db.circle.update({
    where: { id: circle.id },
    data: {
      lastDisparityAt: new Date(),
      disparityDay: today,
      disparityCountToday: circle.disparityDay === today ? { increment: 1 } : 1,
    },
  });
  if (circle.groupConversationSid)
    await say(
      circle.groupConversationSid,
      opts.asked ? "On it. I'll check in with each of you privately." : CHECK_IN_GROUP_MESSAGE,
    );

  const members = await db.member.findMany({ where: { circleId: circle.id }, include: { circle: true, user: true } });
  for (const m of members) {
    if (m.interviewStatus === "DONE") continue;
    await ensureOpening(m);
    if (m.user) await nudgePrivately(m.user, m).catch((e) => console.error("private check-in failed", e));
  }
}

/** Point the person's private thread at this circle and send where the chat left off. */
async function nudgePrivately(user: User, member: MemberWithCircle) {
  if (!canText(user) || !textingEnabled()) return;
  const convSid = await ensureDm(user);
  await db.user.update({ where: { id: user.id }, data: { activeMemberId: member.id } });
  if (!user.displayName) return say(convSid, ASK_NAME);
  await sendResume(convSid, member);
}

async function sendResume(convSid: string, member: MemberWithCircle) {
  await ensureOpening(member);
  const last = await db.message.findFirst({
    where: { memberId: member.id, role: "HUSH" },
    orderBy: { createdAt: "desc" },
  });
  if (last)
    await say(
      convSid,
      formatForSms([
        { content: last.content, options: last.options as string[] | null, chips: last.chips as string[] | null },
      ]),
    );
}

// ---------- Private thread ----------

async function onDirectMessage(user: User, convSid: string, phone: string, body: string) {
  const kw = parseKeyword(body);
  if (kw?.kw === "stop") {
    await db.user.update({ where: { id: user.id }, data: { smsOptedOutAt: new Date() } });
    return; // Twilio's opt-out handling sends the confirmation.
  }
  if (kw?.kw === "help") return say(convSid, HUSH_HELP);
  if (kw?.kw === "start") {
    const back = await db.user.update({ where: { id: user.id }, data: { smsOptedOutAt: null } });
    // START only resumes texts for someone who opted in on the web; it isn't an opt-in by itself.
    if (canText(back)) return say(convSid, SMS_OPT_IN_CONFIRMATION);
    return;
  }
  if (!canText(user)) return;

  const active = user.activeMemberId
    ? await db.member.findUnique({ where: { id: user.activeMemberId }, include: { circle: true } })
    : null;

  if (kw?.kw === "mute" || kw?.kw === "unmute") {
    if (!active) return say(convSid, "You're not in a plan with me right now.");
    await db.circle.update({
      where: { id: active.circleId },
      data: { proactiveMutedAt: kw.kw === "mute" ? new Date() : null },
    });
    return say(
      convSid,
      kw.kw === "mute"
        ? `Paused check-ins for "${active.circle.title}".`
        : `Check-ins are back on for "${active.circle.title}".`,
    );
  }
  if (kw?.kw === "join") return joinBySms(user, convSid, kw.arg!);

  // First contact: learn their name before anything else.
  if (!user.displayName) {
    const name = cleanName(body);
    if (!name) return say(convSid, ASK_NAME);
    await db.user.update({ where: { id: user.id }, data: { displayName: name } });
    await db.member.updateMany({ where: { userId: user.id, name: FRIEND }, data: { name } });
    if (!active)
      return say(
        convSid,
        `Nice to meet you, ${name}! Add this number to your group text, or text JOIN and a plan code.`,
      );
    const renamed = await db.member.findUniqueOrThrow({ where: { id: active.id }, include: { circle: true } });
    return sendResume(convSid, renamed);
  }

  if (!active)
    return say(
      convSid,
      "You're not in a plan with me yet. Add this number to your group text, or text JOIN and a plan code.",
    );

  const lastHush = await db.message.findFirst({
    where: { memberId: active.id, role: "HUSH" },
    orderBy: { createdAt: "desc" },
  });
  const text = resolveReply(body, lastHush?.options as string[] | null);
  const res = await handleTurn(active, { text });
  if (res.error) return say(convSid, res.error);
  const hush = res.messages.filter((m) => m.role === "HUSH");
  if (hush.length)
    await say(
      convSid,
      formatForSms(
        hush.map((m) => ({
          content: m.content,
          options: m.options as string[] | null,
          chips: m.chips as string[] | null,
        })),
      ),
    );
}

async function joinBySms(user: User, convSid: string, slug: string) {
  const circle = await db.circle.findUnique({ where: { slug } });
  if (!circle) return say(convSid, "I couldn't find a plan with that code. Double-check it and try again.");
  if (circle.status !== "COLLECTING")
    return say(convSid, "That plan is already being made, so it's closed to new people.");
  const member = await memberFor(circle, user);
  await db.user.update({ where: { id: user.id }, data: { activeMemberId: member.id } });
  if (!user.displayName) return say(convSid, ASK_NAME);
  await say(convSid, `You're in "${circle.title}".`);
  return sendResume(convSid, { ...member, circle });
}

// ---------- Group thread creation ----------

/** Someone added Hush's number to an existing group text: make a circle for it. */
async function circleFromGroupText(convSid: string, phones: string[], firstAuthor: string) {
  const now = new Date();
  const circle = await db.circle.create({
    data: {
      slug: newSlug(),
      title: "Group plan",
      activity: "hangout",
      area: "",
      windowStart: now,
      windowEnd: new Date(now.getTime() + 7 * 86_400_000),
      groupConversationSid: convSid,
    },
  });
  // Only opted-in people become members; numbers that haven't opted in are not stored.
  let organizerId: string | null = null;
  for (const ph of phones.slice(0, MAX_GROUP_PHONES)) {
    const user = await db.user.findUnique({ where: { phoneHash: phoneHash(ph) } });
    if (!canText(user)) continue;
    const m = await memberFor(circle, user!);
    if (ph === firstAuthor) organizerId = m.id;
  }
  if (organizerId) await db.circle.update({ where: { id: circle.id }, data: { organizerId } });
  await groupReady(circle, convSid, true);
  return db.circle.findUniqueOrThrow({ where: { id: circle.id } }); // smsHeldAt set if not everyone opted in
}

/**
 * Hush takes part in a group text only when every SMS participant has opted in. Checked on every
 * group message (people can be added to a group text at any time). The first time a group is held,
 * the opted-in members are told privately; when everyone has opted in, Hush says hi.
 */
async function groupReady(circle: Circle, convSid: string, isNew = false) {
  const all = await smsPhonesIn(convSid);
  const users = await Promise.all(all.map((ph) => db.user.findUnique({ where: { phoneHash: phoneHash(ph) } })));
  const missing = users.filter((u) => !canText(u)).length;

  if (missing === 0) {
    for (const u of users) await memberFor(circle, u!);
    if (circle.smsHeldAt) {
      // Everyone has now opted in: un-hold and introduce Hush.
      await db.circle.update({ where: { id: circle.id }, data: { smsHeldAt: null } });
      await say(convSid, HUSH_INTRO);
    } else if (isNew) {
      await say(convSid, HUSH_INTRO);
    }
    return true;
  }

  if (!circle.smsHeldAt) {
    await db.circle.update({ where: { id: circle.id }, data: { smsHeldAt: new Date() } });
    const n = missing === 1 ? "1 person" : `${missing} people`;
    const note =
      `Hush here. I was added to a group text, but ${n} in it ${missing === 1 ? "hasn't" : "haven't"} signed up ` +
      `for Hush texts yet, so I'll stay quiet there. Ask them to opt in at ${SITE_URL} and I'll say hi once ` +
      `everyone has.`;
    for (const u of users) {
      if (!canText(u)) continue;
      try {
        await say(await ensureDm(u!), note);
      } catch (e) {
        console.error("held-group notice failed", e);
      }
    }
  }
  return false;
}

export class GroupTextError extends Error {}

/**
 * Organizer-started group text from the web app: every member with a linked phone, plus any
 * friends the organizer invites by number, and Hush via a projected address.
 */
export async function createGroupText(circle: Circle, invites: { name: string; phone: string }[]) {
  if (!textingEnabled()) throw new GroupTextError("Texting isn't set up on this server yet.");
  if (circle.groupConversationSid) throw new GroupTextError("This plan already has a group text.");

  // Only people who opted in themselves can be in the group text. An invited number that hasn't
  // opted in gets no texts and isn't stored; the organizer is told to share the invite link.
  const notOptedIn: string[] = [];
  for (const inv of invites) {
    const phone = normalizePhone(inv.phone);
    if (!phone) throw new GroupTextError(`${inv.name}'s number doesn't look like a US or Canadian number.`);
    const user = await db.user.findUnique({ where: { phoneHash: phoneHash(phone) } });
    if (canText(user)) await memberFor(circle, user!, inv.name);
    else notOptedIn.push(inv.name);
  }
  const linked = await db.member.findMany({
    where: { circleId: circle.id, userId: { not: null } },
    include: { user: true },
  });
  const phones = [...new Set(linked.filter((m) => canText(m.user)).map((m) => decryptPhone(m.user!.phoneEnc)))];
  if (phones.length < 2)
    throw new GroupTextError(
      "At least two people need to link their number and agree to texts before Hush can start a group text.",
    );
  if (phones.length > MAX_GROUP_PHONES) throw new GroupTextError("Group texts can include up to 9 people plus Hush.");

  const conv = await createConversation(`Hush · ${circle.title}`, { circle: circle.slug, kind: "group" });
  try {
    for (const ph of phones) await addGroupSmsParticipant(conv.sid, ph);
    await addHushToGroup(conv.sid);
  } catch (e) {
    await deleteConversation(conv.sid).catch(() => {});
    throw e;
  }
  await db.circle.update({ where: { id: circle.id }, data: { groupConversationSid: conv.sid } });
  await say(conv.sid, HUSH_INTRO);
  return { participants: phones.length, notOptedIn };
}

/**
 * Post the proposed plan to the group text. Uses ONLY toGroupSafe() output and only when the
 * leak check passed. The planner calls this when a plan is PROPOSED.
 */
export async function announcePlanToGroup(circleId: string) {
  const circle = await db.circle.findUnique({ where: { id: circleId }, include: groupInclude });
  if (!circle?.groupConversationSid) return false;
  if (!(await groupReady(circle, circle.groupConversationSid))) return false;
  const g = toGroupSafe(circle);
  if (!g.plan || !g.plan.leakCheckPassed) return false;
  const lines = [
    `Here's a plan for everyone: ${g.plan.title}`,
    ...g.plan.stops.map((s) => `${s.time}  ${s.name}`),
    ...(g.plan.whyItWorks.length ? ["", "Why this works:", ...g.plan.whyItWorks.map((w) => `• ${w}`)] : []),
    "",
    "Tell me privately if you're in. Just text me.",
  ];
  await say(circle.groupConversationSid, lines.join("\n"));
  return true;
}

/** Send the opt-in confirmation right after someone verifies their number on the web. */
export async function sendOptInConfirmation(user: User) {
  if (!textingEnabled() || !canText(user)) return;
  await say(await ensureDm(user), SMS_OPT_IN_CONFIRMATION);
}

// ---------- helpers ----------

async function say(convSid: string, body: string) {
  if (!textingEnabled()) return;
  await sendConversationMessage(convSid, body);
}

async function smsPhonesIn(convSid: string) {
  const parts = await listParticipants(convSid);
  const hush = process.env.TWILIO_PHONE_NUMBER;
  return [
    ...new Set(
      parts
        .map((p) => normalizePhone(p.messaging_binding?.address ?? ""))
        .filter((x): x is string => !!x && x !== hush),
    ),
  ];
}

export async function ensureUser(phone: string, displayName?: string) {
  const hash = phoneHash(phone);
  const existing = await db.user.findUnique({ where: { phoneHash: hash } });
  if (existing) return existing;
  return db.user.create({ data: { phoneHash: hash, phoneEnc: encryptPhone(phone), displayName: displayName ?? null } });
}

async function memberFor(circle: Circle, user: User, name?: string) {
  const existing = await db.member.findUnique({ where: { circleId_userId: { circleId: circle.id, userId: user.id } } });
  if (existing) return existing;
  const count = await db.member.count({ where: { circleId: circle.id } });
  return db.member.create({
    data: {
      circleId: circle.id,
      userId: user.id,
      name: name ?? user.displayName ?? FRIEND,
      avatarColor: avatarFor(count),
      tokenHash: newDeviceToken().tokenHash,
    },
  });
}

/** One private thread per phone (Twilio: one conversation per address + proxy pair). */
async function ensureDm(user: User) {
  if (user.dmConversationSid) return user.dmConversationSid;
  const phone = decryptPhone(user.phoneEnc);
  const conv = await createConversation("Hush · private", { kind: "dm" });
  let sid = conv.sid;
  try {
    await addDmParticipant(conv.sid, phone);
  } catch (e) {
    // 50416: this phone + Hush number is already bound to another conversation; reuse it.
    const existing = e instanceof TwilioError ? e.message.match(/CH[0-9a-f]{32}/)?.[0] : undefined;
    await deleteConversation(conv.sid).catch(() => {});
    if (!existing) throw e;
    sid = existing;
  }
  await db.user.update({ where: { id: user.id }, data: { dmConversationSid: sid } });
  return sid;
}
