import { SITE_URL, SUPPORT_EMAIL } from "./consent";
// Plain-text rendering of Hush's private chat for SMS (spec §3.1: "Texters get the same
// content in plain text: Reply A, B or C"). Pure functions; tested in tests/twilio.test.ts.

const LETTERS = "ABCDE";

export type SmsTurn = { content: string; options?: string[] | null; chips?: string[] | null };

/** Collapse one reply's Hush messages into a single text. */
export function formatForSms(turns: SmsTurn[]): string {
  const parts: string[] = [];
  let options: string[] = [];
  for (const t of turns) {
    let body = t.content.trim();
    if (t.chips?.length) body += `\n${t.chips.map((c) => `• ${c}`).join("\n")}`;
    parts.push(body);
    if (t.options?.length) options = t.options.slice(0, 5);
  }
  if (options.length) {
    parts.push(options.map((o, i) => `${LETTERS[i]}) ${o}`).join("\n"));
    const letters = LETTERS.slice(0, options.length).split("");
    const list =
      letters.length > 1 ? `${letters.slice(0, -1).join(", ")} or ${letters[letters.length - 1]}` : letters[0];
    parts.push(`Reply ${list}, or just type.`);
  }
  return parts.join("\n\n");
}

/** "b", "B)", " c. " → the matching option text; anything else passes through unchanged. */
export function resolveReply(text: string, options: string[] | null | undefined): string {
  const m = text.trim().match(/^([A-Ea-e])[).:]?$/);
  if (!m || !options?.length) return text.trim();
  return options[LETTERS.indexOf(m[1].toUpperCase())] ?? text.trim();
}

export type Keyword = "stop" | "start" | "help" | "mute" | "unmute" | "join";

export function parseKeyword(text: string): { kw: Keyword; arg?: string } | null {
  const t = text.trim();
  if (/^(stop|stopall|unsubscribe|cancel|end|quit)$/i.test(t)) return { kw: "stop" };
  if (/^(start|unstop)$/i.test(t)) return { kw: "start" };
  if (/^(help|info)$/i.test(t)) return { kw: "help" };
  if (/^mute$/i.test(t)) return { kw: "mute" };
  if (/^unmute$/i.test(t)) return { kw: "unmute" };
  const j = t.match(/^join\s+(?:\S*\/j\/)?([a-z0-9]{4,32})$/i);
  if (j) return { kw: "join", arg: j[1].toLowerCase() };
  return null;
}

export const HUSH_INTRO =
  "Hi all, I'm Hush from Silent Consensus. I read along to help this group make plans that work for everyone. " +
  "If a plan seems stuck, I'll check in with each of you privately, and nothing you tell me privately is ever " +
  "shared. Msg & data rates may apply. Text MUTE to pause check-ins, HELP for help, STOP to opt out.";

export const HUSH_HELP =
  "Silent Consensus (Hush) helps your group plan things everyone can say yes to. Support: " +
  `${SUPPORT_EMAIL} or ${SITE_URL.replace("https://", "")}. Msg & data rates may apply. ` +
  "MUTE pauses check-ins, UNMUTE resumes, JOIN <code> joins a plan, STOP opts out.";

export const CHECK_IN_GROUP_MESSAGE =
  "Want me to find something that works for everyone? I'll check in with each of you privately.";

export const ASK_NAME = "Hi, it's Hush. Quick one before we start: what should I call you?";

/** Clean a texted name ("it's maya!!" → "Maya"). */
export function cleanName(text: string): string | null {
  const t = text
    .trim()
    .replace(/^(hi|hey|hello)[,! ]+/i, "")
    .replace(/^(it'?s|i'?m|im|call me|my name is)\s+/i, "")
    .replace(/[^\p{L}\p{M}' -]/gu, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(" ");
  if (!t || t.length > 30) return null;
  return t.charAt(0).toUpperCase() + t.slice(1);
}
