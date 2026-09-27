// Thin Twilio REST client (Conversations + Verify) over fetch. Server-only.
// Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_CONVERSATIONS_SERVICE_SID,
// TWILIO_PHONE_NUMBER (Hush's +1 number), TWILIO_VERIFY_SERVICE_SID.

/** Author name Hush uses when posting; also its chat identity in group threads. */
export const HUSH_IDENTITY = "hush";

export class TwilioError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: number,
  ) {
    super(message);
  }
}

export function twilioEnv() {
  const e = process.env;
  return {
    accountSid: e.TWILIO_ACCOUNT_SID ?? "",
    authToken: e.TWILIO_AUTH_TOKEN ?? "",
    serviceSid: e.TWILIO_CONVERSATIONS_SERVICE_SID ?? "",
    hushNumber: e.TWILIO_PHONE_NUMBER ?? "",
    verifySid: e.TWILIO_VERIFY_SERVICE_SID ?? "",
  };
}

/** True when Hush can send texts (Conversations configured). */
export function textingEnabled() {
  const t = twilioEnv();
  return !!(t.accountSid && t.authToken && t.serviceSid && t.hushNumber);
}

export function verifyEnabled() {
  const t = twilioEnv();
  return !!(t.accountSid && t.authToken && t.verifySid);
}

async function call<T>(method: "GET" | "POST" | "DELETE", url: string, form?: Record<string, string>): Promise<T> {
  const { accountSid, authToken } = twilioEnv();
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as { message?: string; code?: number } & T;
  if (!res.ok) throw new TwilioError(data.message ?? `Twilio ${res.status}`, res.status, data.code);
  return data;
}

const conv = (path = "") =>
  `https://conversations.twilio.com/v1/Services/${twilioEnv().serviceSid}/Conversations${path}`;

export type Participant = {
  sid: string;
  identity: string | null;
  messaging_binding: { type?: string; address?: string; proxy_address?: string; projected_address?: string } | null;
};

export async function createConversation(friendlyName: string, attributes: Record<string, unknown> = {}) {
  return call<{ sid: string }>("POST", conv(), {
    FriendlyName: friendlyName.slice(0, 256),
    Attributes: JSON.stringify(attributes),
  });
}

/** One SMS participant in a group MMS thread (no proxy address; Hush joins via a projected address). */
export function addGroupSmsParticipant(conversationSid: string, phone: string) {
  return call<Participant>("POST", conv(`/${conversationSid}/Participants`), { "MessagingBinding.Address": phone });
}

/** Hush's own seat in a group MMS thread: posts appear from Hush's number. */
export function addHushToGroup(conversationSid: string) {
  return call<Participant>("POST", conv(`/${conversationSid}/Participants`), {
    Identity: HUSH_IDENTITY,
    "MessagingBinding.ProjectedAddress": twilioEnv().hushNumber,
  });
}

/** A 1:1 SMS thread between one person and Hush's number. */
export function addDmParticipant(conversationSid: string, phone: string) {
  return call<Participant>("POST", conv(`/${conversationSid}/Participants`), {
    "MessagingBinding.Address": phone,
    "MessagingBinding.ProxyAddress": twilioEnv().hushNumber,
  });
}

export async function listParticipants(conversationSid: string) {
  const r = await call<{ participants: Participant[] }>("GET", conv(`/${conversationSid}/Participants?PageSize=50`));
  return r.participants;
}

export function sendConversationMessage(conversationSid: string, body: string) {
  return call<{ sid: string }>("POST", conv(`/${conversationSid}/Messages`), {
    Author: HUSH_IDENTITY,
    Body: body.slice(0, 1500),
  });
}

/**
 * The last few group messages, newest last. Used transiently by the disparity judge and
 * never written anywhere (spec §2.3).
 */
export async function recentMessages(conversationSid: string, n = 12) {
  const r = await call<{ messages: { author: string; body: string | null }[] }>(
    "GET",
    conv(`/${conversationSid}/Messages?Order=desc&PageSize=${n}`),
  );
  return r.messages.reverse().map((m) => ({ author: m.author, body: m.body ?? "" }));
}

export function deleteConversation(conversationSid: string) {
  return call<void>("DELETE", conv(`/${conversationSid}`));
}

const verify = (path: string) => `https://verify.twilio.com/v2/Services/${twilioEnv().verifySid}${path}`;

export function startVerification(phone: string) {
  return call<{ status: string }>("POST", verify("/Verifications"), { To: phone, Channel: "sms" });
}

export async function checkVerification(phone: string, code: string) {
  try {
    const r = await call<{ status: string }>("POST", verify("/VerificationCheck"), { To: phone, Code: code });
    return r.status === "approved";
  } catch (e) {
    // 404 = no pending verification (expired or already used).
    if (e instanceof TwilioError && e.status === 404) return false;
    throw e;
  }
}
