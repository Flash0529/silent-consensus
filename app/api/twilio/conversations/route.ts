import { after, NextResponse } from "next/server";
import { jsonError, originOf } from "@/lib/http";
import { twilioEnv } from "@/lib/twilio/client";
import { isValidTwilioSignature } from "@/lib/twilio/signature";
import { handleConversationEvent } from "@/lib/twilio/hush";

export const maxDuration = 60;

/**
 * Twilio Conversations service webhook (post-event, onMessageAdded). Every request must carry a
 * valid X-Twilio-Signature. We answer 200 immediately and do the work in after(), because
 * interview turns and the disparity judge can take longer than Twilio waits.
 */
export async function POST(req: Request) {
  const { authToken } = twilioEnv();
  if (!authToken) return jsonError("Texting isn't configured.", 503);

  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") params[k] = v;

  // Twilio signs the exact public URL it called. Behind a proxy, set TWILIO_WEBHOOK_URL to it.
  const u = new URL(req.url);
  const url = process.env.TWILIO_WEBHOOK_URL ?? `${originOf(req)}${u.pathname}${u.search}`;
  const skip = process.env.TWILIO_SKIP_SIGNATURE === "true" && process.env.NODE_ENV !== "production";
  if (!skip && !isValidTwilioSignature(authToken, req.headers.get("x-twilio-signature"), url, params))
    return jsonError("Bad signature", 403);

  after(async () => {
    try {
      await handleConversationEvent(params);
    } catch (e) {
      console.error("twilio webhook failed", e);
    }
  });
  return new NextResponse(null, { status: 200 });
}
