import { z } from "zod";
import { DEFAULT_PROFILE, standingChips, type Profile } from "@/components/site/friends/profile";

// "Make Hush yours": how your Hush talks to you (name, color, tone, length, how proactive, emoji,
// quiet hours) and what it plans around (diet, allergies, cuisines, spice, drinks, budget, access,
// travel, vibe, times). Same shape as the Friends page studio, saved on your account.
// Used in your private chat with Hush, and (without your name) when Hush plans for a group.

const hhmm = z.string().regex(/^\d{2}:\d{2}$/);
export const StyleSchema = z.object({
  you: z.string().trim().max(30).default(""),
  botName: z.string().trim().max(20).default("Hush"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#5B3DF5"),
  tone: z.enum(["warm", "playful", "direct"]).default("warm"),
  length: z.enum(["brief", "balanced", "chatty"]).default("balanced"),
  proactivity: z.enum(["ask", "gentle", "proactive"]).default("gentle"),
  emoji: z.boolean().default(false),
  quietHours: z.boolean().default(true),
  quietFrom: hhmm.default("22:00"),
  quietTo: hhmm.default("08:00"),
  diet: z.array(z.string().max(30)).max(12).default([]),
  allergies: z.array(z.string().max(30)).max(12).default([]),
  cuisines: z.array(z.string().max(30)).max(20).default([]),
  spice: z.number().int().min(0).max(3).default(1),
  drinks: z.enum(["yes", "sometimes", "no"]).default("yes"),
  budget: z.number().int().min(0).max(500).default(30),
  stepFree: z.boolean().default(false),
  travel: z.number().int().min(5).max(120).default(30),
  vibe: z.array(z.string().max(30)).max(10).default([]),
  times: z.array(z.string().max(40)).max(10).default([]),
  workShare: z.array(z.string().max(20)).max(10).default([]),
});
export type HushStyle = Profile;

export function readStyle(raw: unknown): HushStyle {
  const p = StyleSchema.safeParse({ ...DEFAULT_PROFILE, ...((raw as object) ?? {}) });
  return (p.success ? p.data : DEFAULT_PROFILE) as HushStyle;
}

/** A chat-room's Hush: what the group calls it and how it behaves there. */
export const RoomStyleSchema = z.object({
  botName: z.string().trim().min(1).max(20).default("Hush"),
  tone: z.enum(["warm", "playful", "direct"]).default("warm"),
  proactivity: z.enum(["ask", "gentle", "proactive"]).default("gentle"),
  emoji: z.boolean().default(false),
});
export type RoomStyle = z.infer<typeof RoomStyleSchema>;
export function readRoomStyle(raw: unknown): RoomStyle {
  const p = RoomStyleSchema.safeParse({ ...((raw as object) ?? {}) });
  return p.success ? p.data : RoomStyleSchema.parse({});
}

const TONE = {
  warm: "Warm and kind, like a thoughtful friend.",
  playful: "Playful and light, a little witty.",
  direct: "Direct and efficient. No small talk.",
} as const;
const LENGTH = { brief: "Keep every message very short (one sentence).", balanced: "Keep messages short.", chatty: "You can be a bit chatty." } as const;

/** How to talk to this person (for their private chat). */
export function voiceFor(s: HushStyle) {
  return `Your name in this private chat is ${s.botName || "Hush"}. ${TONE[s.tone]} ${LENGTH[s.length]} ${s.emoji ? "Use an emoji now and then." : "Don't use emoji."}`;
}

/** How to talk in a group chat. */
export function roomVoice(r: RoomStyle) {
  return `In this group you're called ${r.botName}. ${TONE[r.tone]} ${r.emoji ? "An emoji now and then is fine." : "No emoji."}`;
}

/** Their standing preferences as Markdown bullets (private section of their profile). */
export function prefsMd(s: HushStyle) {
  const lines = standingChips(s).map((c) => `- ${c}`);
  if (s.cuisines.length) lines.push(`- Likes: ${s.cuisines.join(", ")}`);
  if (s.spice !== 1) lines.push(`- Spice: ${["no heat", "mild", "medium", "bring the fire"][s.spice]}`);
  return lines.join("\n");
}

export const budgetCents = (s: HushStyle) => (s.budget > 0 ? s.budget * 100 : null);

/** Is it quiet hours for them right now (in their time zone)? */
export function inQuietHours(s: HushStyle, tz: string | null) {
  if (!s.quietHours) return false;
  const now = new Intl.DateTimeFormat("en-GB", { timeZone: tz ?? "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
  const [f, t] = [s.quietFrom, s.quietTo];
  return f <= t ? now >= f && now < t : now >= f || now < t;
}
