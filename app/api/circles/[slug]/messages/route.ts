import { after, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getMember } from "@/lib/identity";
import { jsonError, parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { hushListens, postToGroup } from "@/lib/groupchat";
import { scheduleDetect } from "@/lib/ai/detect";
import { reviewWorkMessage } from "@/lib/ai/tone";
import { clearFlag, matchFlag, policyFor, recordOverride, rememberFlag } from "@/lib/review";

// The group chat. Members only; everyone in the plan sees the same thread. Private chats with Hush
// are separate (/api/me/chat) and never appear here.

type Params = { params: Promise<{ slug: string }> };

export async function GET(req: Request, { params }: Params) {
  const { slug } = await params;
  const me = await getMember(slug);
  if (!me) return jsonError("Not a member of this plan", 401);
  // ?limit=8 for the chat-list preview (press and hold a chat).
  const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get("limit")) || 300, 1), 300);
  const rows = await db.groupMessage.findMany({
    // "Delete chat" for me: only what came after.
    where: { circleId: me.circleId, ...(me.clearedAt ? { createdAt: { gt: me.clearedAt } } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      reactions: { select: { emoji: true, memberId: true, member: { select: { name: true } } } },
      attachment: { select: { id: true, name: true, mime: true, size: true, aiVisible: true, aiAnswered: true, memberId: true, expiresAt: true } },
      member: { select: { id: true, name: true, avatarColor: true, account: { select: { photo: true } } } },
      replyTo: { select: { id: true, body: true, kind: true, senderName: true, member: { select: { name: true } } } },
      ask: { include: { answers: { select: { memberId: true, choice: true, text: true } } } },
    },
  });
  const total = await db.member.count({ where: { circleId: me.circleId, accountId: { not: null } } });
  // Check-in cards: progress only (how many are done, and whether you are), never anyone's answers.
  const ciIds = rows.filter((m) => m.kind === "CHECKIN").map((m) => m.body);
  const checkIns = ciIds.length
    ? await db.hushCheckIn.findMany({
        where: { id: { in: ciIds }, circleId: me.circleId },
        select: {
          id: true,
          status: true,
          stage: true,
          organizerId: true,
          createdAt: true,
          brief: true,
          verdict: true,
          item: { select: { title: true } },
          replies: { select: { memberId: true, status: true, attending: true, confirm: true } },
        },
      })
    : [];
  const ciById = new Map(checkIns.map((c) => [c.id, c]));
  return NextResponse.json(
    {
      messages: rows.reverse().map((m) => ({
        // Hush's follow-up question: your own private answer and a count, never anyone else's.
        ask: m.ask
          ? (() => {
              const mine = m.ask.answers.find((a) => a.memberId === me.id);
              return {
                id: m.ask.id,
                field: m.ask.field,
                question: m.ask.question,
                options: m.ask.options as string[],
                status: m.ask.status,
                result: m.ask.result,
                answered: m.ask.answers.length,
                total,
                mine: mine ? { choice: mine.choice, text: mine.text } : null,
              };
            })()
          : null,
        checkIn:
          m.kind === "CHECKIN" && ciById.has(m.body)
            ? (() => {
                const c = ciById.get(m.body)!;
                const mine = c.replies.find((r) => r.memberId === me.id);
                const voters = c.replies.filter((r) => r.attending !== "OUT");
                const confirming = c.stage === "CONFIRMING";
                const needsMe =
                  !!mine &&
                  c.status === "OPEN" &&
                  ((c.stage === "INTAKE" && c.organizerId === me.id) ||
                    (c.stage === "ASKING" && mine.status === "ASKING") ||
                    (confirming && mine.attending !== "OUT" && !mine.confirm));
                // Progress only: how many are done, and whether you are. Never anyone's answers.
                return {
                  id: c.id,
                  title: c.item?.title ?? c.brief?.slice(0, 60) ?? null,
                  status: c.status,
                  stage: c.stage,
                  deletedBy: c.stage === "CANCELLED" && c.verdict?.startsWith("DELETED:") ? c.verdict.slice(8) : null,
                  startedAt: c.createdAt,
                  done: confirming ? voters.filter((r) => r.confirm).length : c.replies.filter((r) => r.status === "DONE").length,
                  total: confirming ? voters.length : c.replies.length,
                  mine: needsMe ? "ASKING" : mine ? "DONE" : null,
                };
              })()
            : null,
        // Shared files: download link, and whether Hush may see it (only the sender decides).
        file: m.attachment
          ? {
              id: m.attachment.id,
              name: m.attachment.name,
              mime: m.attachment.mime,
              size: m.attachment.size,
              url: `/api/files/${m.attachment.id}`,
              aiVisible: m.attachment.aiVisible,
              needsAnswer: m.attachment.memberId === me.id && !m.attachment.aiAnswered,
              expiresAt: m.attachment.expiresAt,
            }
          : null,
        id: m.id,
        kind: m.kind,
        body: m.kind === "CHECKIN" ? "" : m.body,
        itemId: m.itemId,
        createdAt: m.createdAt,
        mine: m.memberId === me.id,
        sender: m.member
          ? { id: m.member.id, name: m.member.name, color: m.member.avatarColor, photo: m.member.account?.photo ?? null }
          : m.kind === "TEXT" && m.senderName
            ? { id: `gone-${m.senderName}`, name: m.senderName, color: "gray", photo: null } // left or removed
            : null,
        replyToId: m.replyTo?.id ?? null,
        // Tapbacks, grouped by emoji. Reactions are part of the group chat, so everyone sees who reacted.
        reactions: groupReactions(m.reactions, me.id),
        replyTo: m.replyTo
          ? {
              id: m.replyTo.id,
              body: m.replyTo.body.split("\n")[0].slice(0, 140),
              from: m.replyTo.member?.name ?? m.replyTo.senderName ?? (m.replyTo.kind === "EVENT" ? null : "Hush"),
            }
          : null,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function groupReactions(rows: { emoji: string; memberId: string; member: { name: string } }[], meId: string) {
  const by = new Map<string, { emoji: string; count: number; mine: boolean; names: string[] }>();
  for (const r of rows) {
    const g = by.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false, names: [] };
    g.count++;
    g.mine ||= r.memberId === meId;
    g.names.push(r.memberId === meId ? "You" : r.member.name);
    by.set(r.emoji, g);
  }
  return [...by.values()].sort((a, b) => b.count - a.count);
}

const Body = z.object({
  body: z.string().trim().min(1).max(2000),
  replyToId: z.string().max(40).optional(),
  // Work groups: set once the sender has seen Hush's tone suggestion (and chose what to send).
  reviewed: z.boolean().optional(),
});

export async function POST(req: Request, { params }: Params) {
  const { slug } = await params;
  const me = await getMember(slug);
  if (!me) return jsonError("Not a member of this plan", 401);
  if (!rateLimit(`group-msg:${me.id}`, 30, 60_000)) return jsonError("You're sending messages too fast.", 429);
  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;
  // A reply must point at a message in this same chat.
  let replyToId: string | null = null;
  if (body.data.replyToId) {
    const target = await db.groupMessage.findUnique({ where: { id: body.data.replyToId }, select: { circleId: true } });
    if (!target || target.circleId !== me.circleId) return jsonError("That message isn't in this chat.", 400);
    replyToId = body.data.replyToId;
  }
  // Work groups: Hush reads the message before anyone else does. If it would land badly, only the
  // sender gets a suggested rewrite back; nothing is posted until they choose. Whether they sent
  // Hush's version or their own ("anyway") is decided here from what Hush flagged, not by the client.
  let override: { issue: string | null; severity: "tone" | "serious" } | null = null;
  const circleCfg = await db.circle.findUnique({ where: { id: me.circleId }, select: { mode: true, org: { select: { toneCheck: true } } } });
  if (circleCfg?.mode === "WORK" && circleCfg.org?.toneCheck !== false) {
    const hit = matchFlag(me.id, body.data.body);
    if (hit) {
      clearFlag(me.id);
      if (hit.kind === "original") override = { issue: hit.p.issue, severity: hit.p.severity };
    } else {
      const recent = await db.groupMessage.findMany({
        where: { circleId: me.circleId, kind: "TEXT" },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { member: { select: { name: true } } },
      });
      const review = await reviewWorkMessage(
        body.data.body,
        recent.reverse().map((r) => `${r.member?.name ?? "Someone"}: ${r.body}`),
        me.circleId,
      );
      if (review?.verdict === "revise" && review.suggestion) {
        const severity = review.severity === "serious" ? "serious" : "tone";
        rememberFlag(me.id, { original: body.data.body, suggestion: review.suggestion, issue: review.issue, severity });
        const policy = await policyFor(me.accountId, severity);
        return NextResponse.json({ review: { issue: review.issue, suggestion: review.suggestion, policy } });
      }
    }
  }
  const msg = await postToGroup(me.circleId, "TEXT", body.data.body, me.id, replyToId);
  await db.member.update({ where: { id: me.id }, data: { lastReadAt: new Date() } });
  const toHush = replyToId
    ? !!(await db.groupMessage.findFirst({ where: { id: replyToId, kind: { in: ["HUSH", "ITEM", "ASK", "PLAN"] } }, select: { id: true } }))
    : false;
  after(() => hushListens(me.circleId, me.id, body.data.body, { toHush }).catch((e) => console.error("hush listen failed", e)));
  scheduleDetect(me.circleId);
  // Sent a flagged message as written: counts toward manager review (only if the company turned it on).
  const escalated =
    override && me.accountId
      ? !!(await recordOverride({ accountId: me.accountId, memberId: me.id, circleId: me.circleId, text: body.data.body, issue: override.issue, severity: override.severity }))
      : false;
  return NextResponse.json({ id: msg.id, createdAt: msg.createdAt, escalated });
}
