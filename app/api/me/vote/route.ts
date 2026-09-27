import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getMember } from "@/lib/identity";
import { jsonError, parseBody } from "@/lib/http";
import { currentPlan, maybeConfirm, recomputeShares } from "@/lib/shares";
import { money } from "@/lib/format";
import { weekdayName } from "@/lib/dates";

const Body = z.object({ choice: z.enum(["IN", "DIFFERENT_TIME", "TWEAK", "NOT_READY"]) });

const FOLLOWUPS = {
  DIFFERENT_TIME: {
    content: "No problem. What time would work better for you?",
    options: ["Earlier in the evening", "Later in the evening", "A different day", "I'll type it"],
  },
  TWEAK: {
    content: "Happy to adjust. What would you change?",
    options: ["The food", "The places", "The cost", "I'll type it"],
  },
  NOT_READY: {
    content: "That's completely okay. What would help most right now?",
    options: ["A bit more time", "Talking one-on-one first", "Changing one part", "I'll type it"],
  },
} as const;

export async function POST(req: Request) {
  const slug = new URL(req.url).searchParams.get("c") ?? "";
  const me = await getMember(slug);
  if (!me) return jsonError("Not a member of this plan", 401);
  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;
  const { choice } = body.data;

  const plan = await currentPlan(me.circleId);
  if (!plan || plan.status !== "PROPOSED") return jsonError("There's nothing to vote on right now.", 409);
  const allowed = plan.kind === "MEDIATE" ? ["IN", "TWEAK", "NOT_READY"] : ["IN", "DIFFERENT_TIME", "TWEAK"];
  if (!allowed.includes(choice)) return jsonError("That choice isn't available.");

  await db.vote.upsert({
    where: { planId_memberId: { planId: plan.id, memberId: me.id } },
    create: { planId: plan.id, memberId: me.id, choice },
    update: { choice },
  });

  if (choice === "IN") {
    if (plan.kind === "PLAN") {
      const a = await recomputeShares(plan.id);
      const line = a.lines.find((l) => l.id === me.id)!;
      const day = weekdayName(me.circle.windowStart);
      const msgs: { content: string; kind: "TEXT" | "CHIPIN"; topic: string }[] = [
        {
          kind: "TEXT",
          topic: "voted-in",
          content:
            line.shortfallCents > 0
              ? `You're in, ${me.name}! Your share for ${day} is ready to look at.`
              : `You're in, ${me.name}! Your share for ${day} is ${money(line.baseCents)}.`,
        },
      ];
      const offered = await db.message.count({ where: { memberId: me.id, kind: "CHIPIN", createdAt: { gte: plan.createdAt } } });
      if (line.isHelper && a.cardOpen && !offered) msgs.push({ kind: "CHIPIN", topic: "chipin", content: "Want to quietly help?" });
      for (const m of msgs) await db.message.create({ data: { memberId: me.id, role: "HUSH", ...m } });
    } else {
      await db.message.create({
        data: {
          memberId: me.id,
          role: "HUSH",
          topic: "voted-in",
          content: `Thank you, ${me.name}. Your private notes for the conversation are ready whenever you want them.`,
        },
      });
    }
    await maybeConfirm(me.circleId);
  } else {
    const f = FOLLOWUPS[choice];
    await db.message.create({
      data: { memberId: me.id, role: "HUSH", kind: "FOLLOWUP", topic: "followup", content: f.content, options: [...f.options] },
    });
  }
  return NextResponse.json({ ok: true, goTo: choice === "IN" && plan.kind === "PLAN" ? "chat" : choice === "IN" ? "share" : "chat" });
}
