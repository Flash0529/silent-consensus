// SMS consent (A2P 10DLC). Pure module: safe to import from client components.
// The wording here is what the Twilio campaign registration quotes, so change both together.

export const SITE_URL = "https://silentconsensus.world";
export const SUPPORT_EMAIL = "basushamit@gmail.com";

/** Shown next to the UNCHECKED checkbox on the phone-link step. Bump the version when it changes. */
export const SMS_CONSENT_TEXT =
  "I agree to receive texts from Silent Consensus (Hush) about my group plans. Message frequency varies. " +
  "Msg & data rates may apply. Reply HELP for help, STOP to opt out.";
export const SMS_CONSENT_VERSION = "2026-09-27";

/** Sent once the number is verified, and in reply to START. */
export const SMS_OPT_IN_CONFIRMATION =
  "Silent Consensus: You're subscribed to Hush group-planning texts. Message frequency varies with your " +
  "group's plans. Msg & data rates may apply. Reply HELP for help, STOP to opt out.";

/**
 * Hush may text a number only if its owner completed the web opt-in and hasn't replied STOP.
 * This is a condition of every text, including being in a group text with Hush.
 */
export function canText(user: { smsConsentAt: Date | null; smsOptedOutAt: Date | null } | null | undefined) {
  return !!user?.smsConsentAt && !user.smsOptedOutAt;
}

/** Best-effort client IP behind Cloudflare -> Nginx Proxy Manager, stored as proof of consent. */
export function clientIp(req: Request) {
  const h = req.headers;
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip");
  return ip?.trim().slice(0, 64) || null;
}
