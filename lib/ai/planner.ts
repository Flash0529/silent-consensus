import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { callLLM } from "@/lib/ai/client";
import { aggregateNeeds, hardFilter, openOverlapMinutes, type GroupNeeds, type VaultLike } from "@/lib/ai/filter";
import { checkGroupText, type GuardContext, type Leak } from "@/lib/ai/guard";
import { allocate, helperCapacity, type AllocMember } from "@/lib/money/allocate";
import { VENUES, venueById, venueCost, type Venue } from "@/lib/venues";
import { weekdayName } from "@/lib/dates";
import { money } from "@/lib/format";

// Hybrid planner: deterministic filter → LLM compose → deterministic cost and
// chip-in → LLM explain → leak guard → persist. Names never reach the composer.

const TZ = "America/New_York";

const Compose = z.object({
  candidates: z
    .array(
      z.object({
        title: z.string().max(60),
        stops: z.array(z.object({ venueId: z.string(), time: z.string() })).min(2).max(3),
        vibeFit: z.number().min(0).max(1),
      }),
    )
    .min(1)
    .max(3),
});

const Explain = z.object({
  title: z.string().max(60),
  whyItWorks: z.array(z.string().max(70)).min(2).max(3),
});

export type PlanStop = {
  time: string;
  venueId: string;
  name: string;
  note: string;
  verified: boolean;
  items: { label: string; cents: number }[];
};

type Candidate = { title: string; stops: PlanStop[]; perPersonCents: number; vibeFit: number };

const SAFE_WHY = ["Fits every budget Hush heard", "Easy for everyone to get around", "Food the whole group can eat"];

function hhmm(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

const timeRe = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
function to24(t: string) {
  const m = t.trim().match(timeRe);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  return h * 60 + Number(m[2]);
}
const toMin = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};

function validateCandidate(
  c: z.infer<typeof Compose>["candidates"][number],
  allowed: Map<string, Venue>,
  window: { start: string; end: string },
): { ok: true; cand: Candidate } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  const seen = new Set<string>();
  let last = -1;
  const stops: PlanStop[] = [];
  for (const s of c.stops) {
    const v = allowed.get(s.venueId);
    if (!v) {
      issues.push(`venueId "${s.venueId}" is not in the list`);
      continue;
    }
    if (seen.has(v.id)) issues.push(`venue ${v.id} used twice`);
    seen.add(v.id);
    const t = to24(s.time);
    if (t === null) issues.push(`time "${s.time}" must look like "6:30 PM"`);
    else {
      if (t < toMin(window.start) || t > toMin(window.end)) issues.push(`time ${s.time} is outside ${window.start}-${window.end}`);
      if (t <= last) issues.push(`times must go in order`);
      if (openOverlapMinutes(v, { start: `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`, end: window.end }) < 30)
        issues.push(`${v.id} is not open at ${s.time}`);
      last = t;
    }
    stops.push({ time: s.time.toUpperCase().replace(/\s+/, " "), venueId: v.id, name: v.label, note: v.note, verified: v.verified, items: v.items });
  }
  if (issues.length) return { ok: false, issues };
  const perPersonCents = stops.reduce((sum, s) => sum + s.items.reduce((a, i) => a + i.cents, 0), 0);
  return { ok: true, cand: { title: c.title, stops, perPersonCents, vibeFit: c.vibeFit } };
}

function needsSummary(n: GroupNeeds) {
  const needs: string[] = [];
  if (n.diets.length) needs.push(`every meal stop must offer: ${n.diets.join(", ")}`);
  if (n.otherDietNotes.length) needs.push(`food notes: ${n.otherDietNotes.join(", ")}`);
  if (n.noAlcoholFocus) needs.push("no drinking-focused places");
  if (n.preferFewerBars) needs.push("lean away from bars");
  if (n.stepFree) needs.push("step-free everywhere");
  if (n.quiet) needs.push("quieter is better");
  return needs;
}

async function stage(circleId: string, s: "READING" | "FILTERING" | "COMPOSING" | "BALANCING" | "CHECKING" | "DONE" | "FAILED") {
  await db.circle.update({ where: { id: circleId }, data: { planningStage: s } });
}

async function localTrace(circleId: string, task: string, label: string, meta: Record<string, unknown>, ms = 0) {
  await db.aiTrace.create({ data: { circleId, task, provider: "local", ms, ok: true, label, meta: meta as Prisma.InputJsonValue } });
}

async function compose(circleId: string, venues: Venue[], n: GroupNeeds, activity: string, dateText: string, maxPerPersonCents?: number) {
  const list = venues.map((v) => ({
    id: v.id,
    label: v.label,
    kind: v.kind,
    costPerPersonCents: venueCost(v),
    items: v.items,
    servesMeal: v.servesMeal,
    noise: v.noise,
    outdoor: v.outdoor,
    hours: v.hours,
    note: v.note,
  }));
  const brief = {
    activity,
    date: dateText,
    window: n.window,
    people: n.memberCount,
    lowestBudgetCents: n.lowestCapCents,
    maxPerPersonCents: maxPerPersonCents ?? null,
    needs: needsSummary(n),
    vibe: n.vibe,
  };
  const allowed = new Map(venues.map((v) => [v.id, v]));
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    {
      role: "system",
      content: `You compose group outings. Use ONLY venue ids from the VENUES list; never invent places, prices or facts.
Return exactly 2 different candidate plans. Each has 2 or 3 stops in time order, times like "6:30 PM" inside the window, each stop at a time the venue is open, about 60-75 minutes apart. Evenings feel best with 3 stops: an easy start, the meal, then something relaxed after.
Include one meal stop when the activity is dinner or food. Aim for a per-person total (sum of each venue's costPerPersonCents) near the lowest budget; a little over is OK because friends can quietly chip in, but prefer at most lowestBudget + $10.${maxPerPersonCents ? ` Hard ceiling: ${maxPerPersonCents} cents per person.` : ""}
Titles are short and warm, like "Picnic + food truck night". Never mention anyone's needs in the title.
vibeFit (0-1): how well it fits the vibe tags.
Output JSON only.`,
    },
    { role: "user", content: `GROUP (anonymous): ${JSON.stringify(brief)}\nVENUES: ${JSON.stringify(list)}` },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    const { data } = await callLLM({
      task: "compose",
      label: "Compose candidates",
      circleId,
      schema: Compose,
      reasoningEffort: "medium",
      temperature: 0.7,
      maxTokens: 1500,
      messages,
    });
    const valid: Candidate[] = [];
    const issues: string[] = [];
    for (const c of data.candidates) {
      const r = validateCandidate(c, allowed, n.window);
      if (r.ok) valid.push(r.cand);
      else issues.push(`"${c.title}": ${r.issues.join("; ")}`);
    }
    if (valid.length >= 2 || (valid.length >= 1 && attempt === 1)) return valid;
    messages.push(
      { role: "assistant", content: JSON.stringify(data) },
      { role: "user", content: `Fix these problems and return 2 valid candidates: ${issues.join(" | ")}` },
    );
  }
  return [];
}

/** Deterministic backup when the composer can't produce a valid plan. */
function fallbackCandidate(venues: Venue[], n: GroupNeeds): Candidate | null {
  const meal = venues.filter((v) => v.servesMeal).sort((a, b) => venueCost(a) - venueCost(b))[0];
  const extra = venues.filter((v) => !v.servesMeal && v.id !== meal?.id).sort((a, b) => venueCost(a) - venueCost(b))[0];
  const picks = [meal, extra].filter(Boolean) as Venue[];
  if (picks.length < 2) return null;
  const start = toMin(n.window.start) + 30;
  const stops = picks.map((v, i) => {
    const t = start + i * 75;
    const h = Math.floor(t / 60);
    const time = `${((h + 11) % 12) + 1}:${String(t % 60).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
    return { time, venueId: v.id, name: v.label, note: v.note, verified: v.verified, items: v.items };
  });
  return { title: "An easy night out", stops, perPersonCents: stops.reduce((s, x) => s + x.items.reduce((a, i) => a + i.cents, 0), 0), vibeFit: 0.5 };
}

function pickCandidate(cands: Candidate[], members: AllocMember[]) {
  const scored = cands.map((c) => {
    const ms = members.map((m) => ({ ...m, baseCents: c.perPersonCents }));
    const a = allocate(ms);
    const feasible = a.needCents <= helperCapacity(ms);
    return { c, need: a.needCents, feasible, score: c.vibeFit - 0.02 * (a.needCents / 100) };
  });
  const feasible = scored.filter((s) => s.feasible);
  if (!feasible.length) return null;
  const best = [...feasible].sort((a, b) => b.score - a.score || a.need - b.need)[0];
  // A zero-shortfall plan wins only if it fits about as well.
  const zero = feasible.filter((s) => s.need === 0).sort((a, b) => b.c.vibeFit - a.c.vibeFit)[0];
  if (zero && zero !== best && zero.c.vibeFit >= best.c.vibeFit - 0.1) return zero;
  return best;
}

async function explain(circleId: string, cand: Candidate, n: GroupNeeds, feedback: Leak[]) {
  const { data } = await callLLM({
    task: "explain",
    label: "Explain the plan",
    circleId,
    schema: Explain,
    reasoningEffort: "medium",
    temperature: 0.5,
    messages: [
      {
        role: "system",
        content: `Write the group-facing title and 2-3 "Why this works" bullets (max 7 words each) for a plan every friend will see.
PRIVACY RULES: never mention a person, never say "someone" or "one of you", never state a need as the reason (no "since", "because", "for those who"), no dollar amounts. The bullets must NOT name any specific need at all: no diet words (halal, vegetarian, dietary), no access words (step-free, accessible, wheelchair), no drinking words, no money words except the exact phrase "every budget". Describe coverage generically.
Good bullets: "Fits every budget Hush heard", "Easy for everyone to get around", "Food the whole group can eat", "Chill, outdoors, and unhurried".
Output JSON only.`,
      },
      {
        role: "user",
        content: `PLAN: ${JSON.stringify({ title: cand.title, stops: cand.stops.map((s) => ({ time: s.time, name: s.name, note: s.note })) })}
Group needs covered (anonymous): ${JSON.stringify(needsSummary(n))}${
          feedback.length ? `\nYOUR LAST DRAFT LEAKED. Fix these: ${JSON.stringify(feedback.slice(0, 5))}` : ""
        }`,
      },
    ],
  });
  return data;
}

function privateNoteFor(v: VaultLike, finalCents: number, coveredCents: number) {
  const bits: string[] = [];
  if (v.budgetCapCents !== null) bits.push(finalCents <= v.budgetCapCents ? "fits your budget" : "is close to your budget");
  if (v.dietary.length) bits.push("has food you can eat");
  if (v.alcohol === "none" || v.alcohol === "prefer_none") bits.push("isn't built around drinks");
  if (v.stepFreeRequired) bits.push("is step-free the whole way");
  if (Array.isArray(v.availableWindows) && v.availableWindows.length) bits.push("fits when you're free");
  const base = bits.length ? `Fits what you told Hush: it ${bits.join(", ")}.` : "Fits what you told Hush.";
  return coveredCents > 0 ? `${base} A quiet group pool helps with your share.` : base;
}

export async function runPlanner(circleId: string) {
  const started = Date.now();
  try {
    const circle = await db.circle.findUniqueOrThrow({
      where: { id: circleId },
      include: { members: { include: { vault: true }, orderBy: { createdAt: "asc" } }, plans: { select: { version: true } } },
    });
    await stage(circleId, "READING");
    const members = circle.members;
    const vaults: VaultLike[] = members.map((m) => ({
      budgetCapCents: m.vault?.budgetCapCents ?? null,
      dietary: m.vault?.dietary ?? [],
      alcohol: m.vault?.alcohol ?? null,
      stepFreeRequired: m.vault?.stepFreeRequired ?? null,
      availableWindows: m.vault?.availableWindows ?? null,
      noise: m.vault?.noise ?? null,
      vibe: m.vault?.vibe ?? [],
    }));
    const done = members.filter((m) => m.interviewStatus === "DONE").length;
    await localTrace(circleId, "read", `${done} private chats read`, { members: members.length, done });

    await stage(circleId, "FILTERING");
    const day = weekdayName(circle.windowStart);
    const needs = aggregateNeeds(vaults, { start: hhmm(circle.windowStart), end: hhmm(circle.windowEnd), day });
    const { kept, before, after } = hardFilter(VENUES, needs);
    await db.circle.update({ where: { id: circleId }, data: { foundCount: after } });
    await localTrace(circleId, "filter", `${before} → ${after} venues after hard filter`, { before, after });

    await stage(circleId, "COMPOSING");
    const dateText = `${day}, ${new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" }).format(circle.windowStart)}`;
    let cands = await compose(circleId, kept, needs, circle.activity, dateText);
    await localTrace(circleId, "compose", `${cands.length} candidates composed`, { candidates: cands.length });

    await stage(circleId, "BALANCING");
    const alloc: AllocMember[] = members.map((m, i) => ({ id: m.id, baseCents: 0, capCents: vaults[i].budgetCapCents }));
    let pick = pickCandidate(cands, alloc);
    if (!pick) {
      const ceiling = (needs.lowestCapCents ?? 5000) + Math.min(1000, helperCapacity(alloc.map((a) => ({ ...a, baseCents: 0 }))));
      cands = await compose(circleId, kept, needs, circle.activity, dateText, ceiling);
      pick = pickCandidate(cands, alloc);
    }
    if (!pick) {
      const fb = fallbackCandidate(kept, needs);
      if (!fb) throw new Error("No workable plan from the filtered venues");
      pick = { c: fb, need: 0, feasible: true, score: 0 };
    }
    const chosen = pick.c;
    const a0 = allocate(alloc.map((m) => ({ ...m, baseCents: chosen.perPersonCents })));
    await localTrace(circleId, "allocate", `Cost balanced: shortfall ${money(a0.needCents)}`, {
      perPersonCents: chosen.perPersonCents,
      needCents: a0.needCents,
      helpers: a0.helperCount,
    });

    await stage(circleId, "CHECKING");
    const guardCtx: GuardContext = {
      mode: "PLAN",
      allowedCents: [chosen.perPersonCents, ...chosen.stops.flatMap((s) => s.items.map((i) => i.cents))],
      members: members.map((m, i) => ({
        name: m.name,
        capCents: vaults[i].budgetCapCents,
        privatePhrases: [m.vault?.privateNote ?? ""].filter(Boolean),
        facts: [
          vaults[i].budgetCapCents !== null ? `budget up to ${money(vaults[i].budgetCapCents!)}` : "",
          vaults[i].dietary.length ? `eats ${vaults[i].dietary.join(", ")}` : "",
          vaults[i].alcohol === "none" ? "doesn't drink" : vaults[i].alcohol === "prefer_none" ? "prefers not to drink" : "",
          vaults[i].stepFreeRequired ? "needs step-free places" : "",
          m.vault?.privateNote ?? "",
        ].filter(Boolean),
      })),
    };
    let feedback: Leak[] = [];
    let text = { title: chosen.title, whyItWorks: SAFE_WHY };
    let passed = false;
    let attempts = 0;
    for (; attempts < 3 && !passed; attempts++) {
      try {
        text = await explain(circleId, chosen, needs, feedback);
      } catch {
        break;
      }
      const g = await checkGroupText(
        [text.title, ...text.whyItWorks, ...chosen.stops.flatMap((s) => [s.name, s.note])],
        { ...guardCtx, reasons: [text.title, ...text.whyItWorks] },
        circleId,
      );
      passed = g.pass;
      feedback = g.leaks;
    }
    if (!passed) {
      text = { title: `${day} night out`, whyItWorks: SAFE_WHY };
      const g = await checkGroupText(
        [text.title, ...text.whyItWorks, ...chosen.stops.flatMap((s) => [s.name, s.note])],
        { ...guardCtx, reasons: [text.title, ...text.whyItWorks] },
        circleId,
      ).catch(
        () => ({ pass: false, leaks: [] as Leak[] }),
      );
      passed = g.pass;
    }
    await localTrace(
      circleId,
      "guard",
      passed ? (attempts > 1 ? `Leak check: ${attempts - 1} fix${attempts > 2 ? "es" : ""}, then pass` : "Leak check: pass") : "Leak check: safe template",
      { attempts, passed },
    );

    const version = Math.max(0, ...circle.plans.map((p) => p.version)) + 1;
    const dateLabel = `${new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" }).format(circle.windowStart)} · ${chosen.stops[0].time} · ${circle.area.replace(/ Atlanta$/, "")}`;
    await db.$transaction(async (tx) => {
      await tx.plan.updateMany({ where: { circleId, status: "PROPOSED" }, data: { status: "SUPERSEDED" } });
      const plan = await tx.plan.create({
        data: {
          circleId,
          kind: "PLAN",
          version,
          title: text.title,
          dateLabel,
          stops: chosen.stops as unknown as Prisma.InputJsonValue,
          perPersonCents: chosen.perPersonCents,
          whyItWorks: text.whyItWorks,
          leakCheckPassed: passed,
        },
      });
      for (const [i, line] of a0.lines.entries()) {
        await tx.memberShare.create({
          data: {
            planId: plan.id,
            memberId: line.id,
            baseCents: line.baseCents,
            capCents: line.capCents,
            shortfallCents: line.shortfallCents,
            headroomCents: line.headroomCents,
            finalCents: line.finalCents,
            privateNote: privateNoteFor(vaults[i], line.baseCents - line.shortfallCents, line.shortfallCents),
          },
        });
        await tx.message.create({
          data: {
            memberId: line.id,
            role: "HUSH",
            kind: "TEXT",
            topic: "plan-ready",
            content: "The plan is ready. Take a look and tell me if it works for you.",
          },
        });
      }
      await tx.circle.update({ where: { id: circleId }, data: { status: "PROPOSED", planningStage: "DONE" } });
    });
    await localTrace(circleId, "plan", "Plan ready", { totalMs: Date.now() - started }, Date.now() - started);
  } catch (e) {
    console.error("planner failed", e);
    await db.circle.update({ where: { id: circleId }, data: { planningStage: "FAILED", status: "COLLECTING" } }).catch(() => {});
    await db.aiTrace
      .create({ data: { circleId, task: "plan", provider: "local", ms: Date.now() - started, ok: false, label: "Planning failed", meta: {} } })
      .catch(() => {});
  }
}
