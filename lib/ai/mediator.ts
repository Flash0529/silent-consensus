import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { callLLM } from "@/lib/ai/client";
import { checkGroupText, type GuardContext, type Leak } from "@/lib/ai/guard";
import { dateLabel } from "@/lib/dates";

// Mediator: only consented, nameless gists (plus the needs, hopes and offers
// behind them) enter. Stories, feelings, off-limits items and raw messages never
// reach the drafting prompt; they are used only by the leak guard to block leaks.

const MapOut = z.object({
  sharedNeeds: z.array(z.string().max(100)).max(6),
  tensions: z.array(z.string().max(120)).max(6),
  possibleTrades: z.array(z.string().max(140)).max(6),
});

export const MediationCard = z.object({
  title: z.string().max(60),
  commonGround: z.array(z.string().max(110)).min(1).max(4),
  whatMatters: z.array(z.string().max(110)).min(1).max(5),
  proposal: z.array(z.object({ step: z.string().max(70), detail: z.string().max(160) })).min(2).max(5),
  conversationGuide: z.object({
    groundRules: z.array(z.string().max(100)).min(2).max(4),
    openers: z.array(z.string().max(140)).min(1).max(3),
  }),
  checkIn: z.string().max(100),
});
export type MediationCard = z.infer<typeof MediationCard>;

const Brief = z.object({
  reflected: z.array(z.string().max(120)).max(4),
  opener: z.string().max(200),
  offer: z.string().max(160),
});
export type MediationBrief = z.infer<typeof Brief>;

function shuffle<T>(xs: T[]) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cardTexts(c: MediationCard) {
  return [
    c.title,
    ...c.commonGround,
    ...c.whatMatters,
    ...c.proposal.flatMap((p) => [p.step, p.detail]),
    ...c.conversationGuide.groundRules,
    ...c.conversationGuide.openers,
    c.checkIn,
  ];
}

function safeCard(topic: string, checkIn: string): MediationCard {
  return {
    title: `A fresh start on ${topic.toLowerCase().replace(/^the /, "the ")}`,
    commonGround: ["Everyone wants this to feel fair", "Everyone wants things to feel calmer"],
    whatMatters: ["Feeling heard", "A fair share of the load", "Some predictability"],
    proposal: [
      { step: "Name one small change each", detail: "Each person picks one thing they will do differently this week." },
      { step: "Write it down together", detail: "Put the changes somewhere everyone can see them." },
      { step: "Check in", detail: "Meet for 15 minutes to see what's working." },
    ],
    conversationGuide: {
      groundRules: ["One person talks at a time", "Talk about what you need, not what others did wrong"],
      openers: ["What's one thing that would make this easier for you?"],
    },
    checkIn,
  };
}

async function stage(circleId: string, s: "READING" | "MAPPING" | "DRAFTING" | "CHECKING" | "DONE" | "FAILED") {
  await db.circle.update({ where: { id: circleId }, data: { planningStage: s } });
}

async function localTrace(circleId: string, task: string, label: string, meta: Record<string, unknown>, ms = 0) {
  await db.aiTrace.create({ data: { circleId, task, provider: "local", ms, ok: true, label, meta: meta as Prisma.InputJsonValue } });
}

export async function runMediator(circleId: string) {
  const started = Date.now();
  try {
    const circle = await db.circle.findUniqueOrThrow({
      where: { id: circleId },
      include: {
        members: {
          orderBy: { createdAt: "asc" },
          include: { perspective: true, messages: { where: { role: "MEMBER" }, select: { content: true, transcript: true } } },
        },
        plans: { select: { version: true } },
      },
    });
    if (circle.members.some((m) => m.perspective?.safety === "STOP")) {
      await db.circle.update({ where: { id: circleId }, data: { status: "PAUSED", planningStage: "NONE" } });
      return;
    }
    const topic = circle.topic ?? circle.title;
    const checkInDate = dateLabel(circle.windowStart, "");

    await stage(circleId, "READING");
    const shared = circle.members.filter((m) => m.perspective?.gistConsent === "SHARE" && m.perspective.gist);
    await localTrace(circleId, "read", `${circle.members.length} sides heard privately`, {
      members: circle.members.length,
      sharedGists: shared.length,
    });

    const inputs = shuffle(shared).map((m, i) => ({
      person: `P${i + 1}`,
      gist: m.perspective!.gist,
      needs: m.perspective!.needs,
      hopes: m.perspective!.hopes,
      offers: m.perspective!.offers,
    }));
    const privateCount = circle.members.length - shared.length;

    await stage(circleId, "MAPPING");
    const mapped = await callLLM({
      task: "map",
      label: "Map shared needs",
      circleId,
      schema: MapOut,
      reasoningEffort: "medium",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: `You are a neutral mediator. Find shared needs, the real tensions (as needs vs needs, never blame), and possible trades where one person's offer meets another's need. Inputs are anonymous (P1..Pn). Output JSON only.`,
        },
        {
          role: "user",
          content: `Topic: ${topic}\nPerspectives shared with consent: ${JSON.stringify(inputs)}\n${privateCount} other person(s) asked to keep everything private; still aim for something that should work for everyone.`,
        },
      ],
    });
    await localTrace(circleId, "map", "Found common ground", { sharedNeeds: mapped.data.sharedNeeds.length });

    await stage(circleId, "DRAFTING");
    const guardCtx: GuardContext = {
      mode: "MEDIATE",
      allowedCents: [],
      members: circle.members.map((m) => {
        const p = m.perspective;
        const raw = m.messages.map((x) => x.transcript ?? x.content);
        return {
          name: m.name,
          capCents: null,
          facts: [p?.story ?? "", ...(p?.feelings ?? []).map((f) => `feels ${f}`), ...(p?.offLimits ?? []).map((o) => `private: ${o}`)].filter(Boolean),
          privatePhrases: [p?.story ?? "", ...(p?.offLimits ?? []), ...raw].filter(Boolean),
        };
      }),
    };

    let card: MediationCard = safeCard(topic, `Check in by ${checkInDate}`);
    let feedback: Leak[] = [];
    let passed = false;
    let attempts = 0;
    for (; attempts < 3 && !passed; attempts++) {
      try {
        const { data } = await callLLM({
          task: "draft",
          label: "Draft a way forward",
          circleId,
          schema: MediationCard,
          reasoningEffort: "medium",
          temperature: 0.5,
          maxTokens: 1600,
          messages: [
            {
              role: "system",
              content: `You write a shared, neutral way forward that EVERY person in a disagreement will read.
RULES:
- Never name anyone. Never say "someone", "one of you", "a roommate" or anything that points at one person.
- Never quote anyone or repeat private details (jobs, money, health, faith, family, feelings of a specific person).
- Needs are written as things the whole group values ("Getting enough sleep on weeknights", "A fair split of chores").
- The proposal is 3-5 concrete, small, fair agreements that meet the shared needs and use the offers. Each has a short "step" and a one-sentence "detail". Balanced: everyone gives something.
- conversationGuide: 2-4 ground rules and 1-3 gentle opening questions for talking in person.
- checkIn: one line with the date "${checkInDate}".
- Warm, plain, short. Title like "A calmer kitchen, a fairer week".
Output JSON only.`,
            },
            {
              role: "user",
              content: `Topic: ${topic}\nMap: ${JSON.stringify(mapped.data)}\nConsented perspectives: ${JSON.stringify(inputs)}${
                feedback.length ? `\nYOUR LAST DRAFT LEAKED. Rewrite to fix: ${JSON.stringify(feedback.slice(0, 6))}` : ""
              }`,
            },
          ],
        });
        card = data;
      } catch {
        break;
      }
      await stage(circleId, "CHECKING");
      const g = await checkGroupText(cardTexts(card), guardCtx, circleId);
      passed = g.pass;
      feedback = g.leaks;
    }
    if (!passed) {
      card = safeCard(topic, `Check in by ${checkInDate}`);
      passed = (await checkGroupText(cardTexts(card), guardCtx, circleId).catch(() => ({ pass: false }))).pass;
    }
    await localTrace(
      circleId,
      "guard",
      passed ? (attempts > 1 ? `Leak check: ${attempts - 1} fix${attempts > 2 ? "es" : ""}, then pass` : "Leak check: pass") : "Leak check: safe template",
      { attempts, passed },
    );

    // Private briefs: each built from the shared card plus only that person's own perspective.
    const briefs = await Promise.all(
      circle.members.map(async (m) => {
        const p = m.perspective;
        try {
          const { data } = await callLLM({
            task: "brief",
            label: "Private brief",
            circleId,
            schema: Brief,
            reasoningEffort: "low",
            temperature: 0.5,
            messages: [
              {
                role: "system",
                content: `Write a short private note for one person about a shared proposal. "reflected": which of THEIR needs the proposal meets (1-3 short lines, second person). "opener": one sentence they could say to start the conversation kindly, in first person, without blame. "offer": one small thing they could offer, based on their own offers. Only this person reads it. Output JSON only.`,
              },
              {
                role: "user",
                content: `Proposal: ${JSON.stringify({ title: card.title, proposal: card.proposal })}\nTheir needs: ${JSON.stringify(p?.needs ?? [])}\nTheir hopes: ${JSON.stringify(p?.hopes ?? [])}\nTheir offers: ${JSON.stringify(p?.offers ?? [])}`,
              },
            ],
          });
          return data;
        } catch {
          return { reflected: ["The proposal was shaped around what you told Hush."], opener: "I want this to work for all of us.", offer: "Pick one step you can start this week." };
        }
      }),
    );

    const version = Math.max(0, ...circle.plans.map((p) => p.version)) + 1;
    await db.$transaction(async (tx) => {
      await tx.plan.updateMany({ where: { circleId, status: "PROPOSED" }, data: { status: "SUPERSEDED" } });
      const plan = await tx.plan.create({
        data: {
          circleId,
          kind: "MEDIATE",
          version,
          title: card.title,
          dateLabel: `Check in by ${checkInDate}`,
          content: card as unknown as Prisma.InputJsonValue,
          whyItWorks: card.commonGround,
          leakCheckPassed: passed,
        },
      });
      for (const [i, m] of circle.members.entries()) {
        await tx.memberShare.create({
          data: { planId: plan.id, memberId: m.id, brief: briefs[i] as unknown as Prisma.InputJsonValue, privateNote: "Shaped around what you told Hush." },
        });
        await tx.message.create({
          data: {
            memberId: m.id,
            role: "HUSH",
            kind: "TEXT",
            topic: "plan-ready",
            content: "There's a way forward to look at. Your private notes are ready too.",
          },
        });
      }
      await tx.circle.update({ where: { id: circleId }, data: { status: "PROPOSED", planningStage: "DONE" } });
    });
    await localTrace(circleId, "plan", "Way forward ready", { totalMs: Date.now() - started }, Date.now() - started);
  } catch (e) {
    console.error("mediator failed", e);
    await db.circle.update({ where: { id: circleId }, data: { planningStage: "FAILED", status: "COLLECTING" } }).catch(() => {});
    await db.aiTrace
      .create({ data: { circleId, task: "plan", provider: "local", ms: Date.now() - started, ok: false, label: "Mediation failed", meta: {} } })
      .catch(() => {});
  }
}
