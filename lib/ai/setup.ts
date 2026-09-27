import { callLLM } from "@/lib/ai/client";
import { SetupTurn, type SetupDraft } from "@/lib/ai/schemas";
import { setupPrompt } from "@/lib/ai/prompts/setup";
import { SAFETY_REPLY, screenText, stricter } from "@/lib/ai/safety";
import { dateLabel, etDate, timeLabel } from "@/lib/dates";

// Organizer setup chat for /new. Stateless: the client sends the transcript and the
// draft so far; the model replies and returns the updated draft. When the draft is
// complete, we hand back a validated body for POST /api/circles.

const TZ = "America/New_York";
const MAX_DAYS_AHEAD = 90;

export type SetupMsg = { role: "user" | "assistant"; content: string };

export type CirclePayload = {
  organizerName: string;
  kind: "PLAN" | "MEDIATE";
  topic?: string;
  title: string;
  activity: string;
  area: string;
  windowStart: string;
  windowEnd: string;
};

export type SetupResult = {
  reply: string;
  options: string[];
  draft: SetupDraft;
  ready: boolean;
  circle: CirclePayload | null;
  summary: string[];
};

function ymd(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function addDays(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days, 12)).toISOString().slice(0, 10);
}

function weekday(isoDate: string, style: "short" | "long") {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: style }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export function todayET(now = new Date()) {
  return ymd(now);
}

function calendar(today: string) {
  return Array.from({ length: 14 }, (_, i) => {
    const day = addDays(today, i);
    return `${weekday(day, "short")} ${day}${i === 0 ? " (today)" : i === 1 ? " (tomorrow)" : ""}`;
  }).join("\n");
}

const clean = (s: string | null | undefined) => (typeof s === "string" && s.trim() ? s.trim() : null);

/** Later values win; null/empty from the model never erases a known value. */
export function mergeDraft(known: SetupDraft, next: SetupDraft): SetupDraft {
  const out: SetupDraft = { ...known };
  for (const [k, v] of Object.entries(next) as [keyof SetupDraft, string | null | undefined][]) {
    const c = clean(v);
    if (c !== null) (out as Record<string, string>)[k] = c;
  }
  return out;
}

/** What still stops the draft from becoming a circle. Empty = complete. */
export function missingFields(d: SetupDraft, today: string): string[] {
  const miss: string[] = [];
  if (!clean(d.name)) miss.push("draft.name is missing");
  if (d.kind !== "PLAN" && d.kind !== "MEDIATE") miss.push("draft.kind is missing");
  if (!d.date) miss.push("draft.date is missing");
  else if (d.date < today) miss.push(`draft.date ${d.date} is in the past (today is ${today})`);
  else if (d.date > addDays(today, MAX_DAYS_AHEAD)) miss.push(`draft.date ${d.date} is more than ${MAX_DAYS_AHEAD} days away`);
  if (d.kind === "PLAN") {
    if (!clean(d.activity)) miss.push("draft.activity is missing");
    if (!clean(d.area)) miss.push("draft.area is missing");
    if (!clean(d.title)) miss.push("draft.title is missing");
    if (d.startTime && d.endTime && d.endTime <= d.startTime) miss.push("draft.endTime must be after draft.startTime");
  }
  if (d.kind === "MEDIATE" && !clean(d.topic)) miss.push("draft.topic is missing");
  return miss;
}

function hm(s: string) {
  const [h, m] = s.split(":").map(Number);
  return { h: Math.min(h, 23), m: Math.min(m, 59) };
}

/** A complete draft → the body POST /api/circles expects. */
export function toCirclePayload(d: SetupDraft): CirclePayload {
  const [y, mo, day] = d.date!.split("-").map(Number);
  if (d.kind === "MEDIATE") {
    const topic = clean(d.topic)!.slice(0, 60);
    return {
      organizerName: clean(d.name)!.slice(0, 30),
      kind: "MEDIATE",
      topic,
      title: topic,
      activity: "conversation",
      area: clean(d.area)?.slice(0, 60) ?? "",
      windowStart: etDate(y, mo, day, 19).toISOString(),
      windowEnd: etDate(y, mo, day, 21).toISOString(),
    };
  }
  const s = hm(d.startTime ?? "18:00");
  const start = etDate(y, mo, day, s.h, s.m);
  let end = d.endTime ? (() => { const e = hm(d.endTime); return etDate(y, mo, day, e.h, e.m); })() : null;
  if (!end || end <= start) {
    // Default: a 5-hour window, capped at 23:59 the same day.
    const cap = etDate(y, mo, day, 23, 59);
    end = new Date(Math.min(start.getTime() + 5 * 3600_000, cap.getTime()));
    if (end <= start) end = new Date(start.getTime() + 3600_000);
  }
  return {
    organizerName: clean(d.name)!.slice(0, 30),
    kind: "PLAN",
    title: clean(d.title)!.slice(0, 60),
    activity: clean(d.activity)!.toLowerCase().slice(0, 40),
    area: clean(d.area)!.slice(0, 60),
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
  };
}

/** Chips for the "here's what I'll set up" card. */
export function summarize(p: CirclePayload): string[] {
  const start = new Date(p.windowStart);
  const end = new Date(p.windowEnd);
  if (p.kind === "MEDIATE") return [p.topic ?? p.title, `Way forward by ${dateLabel(start, "")}`];
  const cap = p.activity.charAt(0).toUpperCase() + p.activity.slice(1);
  return [cap, `${dateLabel(start, "")}, ${timeLabel(start)} to ${timeLabel(end)}`, p.area];
}

export async function handleSetupTurn(history: SetupMsg[], known: SetupDraft): Promise<SetupResult> {
  const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  if (screenText(lastUser) === "stop") return { reply: SAFETY_REPLY, options: [], draft: known, ready: false, circle: null, summary: [] };

  const today = todayET();
  // Refinement feeds callLLM's repair retry: ready=true with gaps goes back to the model once.
  const schema = SetupTurn.superRefine((t, ctx) => {
    if (!t.ready) return;
    const miss = missingFields(mergeDraft(known, t.draft), today);
    if (miss.length) ctx.addIssue({ code: "custom", path: ["ready"], message: `ready is true but ${miss.join("; ")}` });
  });

  const { data: turn } = await callLLM({
    task: "setup",
    label: "Organizer setup turn",
    schema,
    reasoningEffort: "low",
    temperature: 0.6,
    maxTokens: 700,
    messages: [
      { role: "system", content: setupPrompt({ today: `${weekday(today, "long")} ${today}`, calendar: calendar(today), known }) },
      ...history,
    ],
  });

  if (stricter(screenText(lastUser), turn.safety) === "stop")
    return { reply: SAFETY_REPLY, options: [], draft: known, ready: false, circle: null, summary: [] };

  const draft = mergeDraft(known, turn.draft);
  const ready = turn.ready && missingFields(draft, today).length === 0;
  const circle = ready ? toCirclePayload(draft) : null;
  return {
    reply: turn.reply,
    options: ready ? [] : turn.options.slice(0, 5),
    draft,
    ready,
    circle,
    summary: circle ? summarize(circle) : [],
  };
}
