import { z } from "zod";

// Every AI output enters the system through one of these schemas.

// Lenient list: accepts "a, b" strings, trims, and truncates instead of failing.
const shortList = (max: number, len = 60) =>
  z.preprocess(
    (v) =>
      (typeof v === "string" ? v.split(/\s*[,;]\s*/) : Array.isArray(v) ? v : v == null ? [] : [String(v)])
        .map((x) => String(x).trim().slice(0, len))
        .filter(Boolean)
        .slice(0, max),
    z.array(z.string()),
  );
const opts = z.preprocess(
  (v) => (Array.isArray(v) ? v.map((x) => String(x).slice(0, 40)).filter(Boolean).slice(0, 5) : []),
  z.array(z.string()),
);
const text = (len: number) => z.preprocess((v) => (typeof v === "string" ? v.slice(0, len) : v), z.string());
const optText = (len: number) => z.preprocess((v) => (typeof v === "string" ? v.slice(0, len) : undefined), z.string().optional());

export const Window = z.object({
  day: z.string().max(20),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

export const PlanTopic = z.enum(["budget", "food", "drinks", "access", "timing", "vibe", "confirm", "done"]);

export const PlanConstraintUpdates = z.object({
  budgetCapCents: z.number().int().nonnegative().nullable().optional(),
  dietary: shortList(8, 30).optional(),
  alcohol: z.enum(["fine", "prefer_none", "none"]).nullable().optional(),
  stepFreeRequired: z.boolean().nullable().optional(),
  availableWindows: z.array(Window).max(6).optional(),
  noise: z.enum(["quiet", "any"]).nullable().optional(),
  vibe: shortList(5, 30).optional(),
  maxTravelMinutes: z.number().int().positive().nullable().optional(),
  privateNote: z.preprocess((v) => (typeof v === "string" ? v.slice(0, 200) : v), z.string().nullable().optional()),
});

export const PlanInterviewTurn = z.object({
  ack: optText(240),
  question: text(240),
  options: opts,
  topic: PlanTopic,
  constraintUpdates: PlanConstraintUpdates.default({}),
  confirmChips: shortList(6, 40).optional(),
  safety: z.enum(["none", "concern", "stop"]).catch("none"),
  done: z.boolean().default(false),
});
export type PlanInterviewTurn = z.infer<typeof PlanInterviewTurn>;

export const MediationTopic = z.enum(["story", "impact", "needs", "hopes", "offers", "offLimits", "consent", "done"]);

export const PerspectiveUpdates = z.object({
  story: z.preprocess((v) => (typeof v === "string" ? v.slice(0, 800) : v), z.string().nullable().optional()),
  feelings: shortList(6, 40).optional(),
  needs: shortList(6, 80).optional(),
  hopes: shortList(6, 100).optional(),
  offers: shortList(6, 100).optional(),
  offLimits: shortList(6, 100).optional(),
  gist: z.preprocess((v) => (typeof v === "string" ? v.slice(0, 400) : v), z.string().nullable().optional()),
});

export const MediationInterviewTurn = z.object({
  ack: optText(280),
  question: text(400),
  options: opts,
  topic: MediationTopic,
  updates: PerspectiveUpdates.default({}),
  confirmChips: shortList(6, 60).optional(),
  safety: z.enum(["none", "concern", "stop"]).catch("none"),
  done: z.boolean().default(false),
});
export type MediationInterviewTurn = z.infer<typeof MediationInterviewTurn>;
