import { z } from "zod";

// Every AI output enters the system through one of these schemas.

const shortList = (max: number, len = 60) => z.array(z.string().max(len)).max(max);

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
  privateNote: z.string().max(200).nullable().optional(),
});

export const PlanInterviewTurn = z.object({
  ack: z.string().max(240).optional(),
  question: z.string().max(240),
  options: z.array(z.string().max(40)).max(5),
  topic: PlanTopic,
  constraintUpdates: PlanConstraintUpdates,
  confirmChips: shortList(6, 40).optional(),
  safety: z.enum(["none", "concern", "stop"]).default("none"),
  done: z.boolean(),
});
export type PlanInterviewTurn = z.infer<typeof PlanInterviewTurn>;

export const MediationTopic = z.enum(["story", "impact", "needs", "hopes", "offers", "offLimits", "consent", "done"]);

export const PerspectiveUpdates = z.object({
  story: z.string().max(800).nullable().optional(),
  feelings: shortList(6, 40).optional(),
  needs: shortList(6, 80).optional(),
  hopes: shortList(6, 100).optional(),
  offers: shortList(6, 100).optional(),
  offLimits: shortList(6, 100).optional(),
  gist: z.string().max(400).nullable().optional(),
});

export const MediationInterviewTurn = z.object({
  ack: z.string().max(280).optional(),
  question: z.string().max(400),
  options: z.array(z.string().max(40)).max(5),
  topic: MediationTopic,
  updates: PerspectiveUpdates,
  confirmChips: shortList(6, 60).optional(),
  safety: z.enum(["none", "concern", "stop"]).default("none"),
  done: z.boolean(),
});
export type MediationInterviewTurn = z.infer<typeof MediationInterviewTurn>;
