import { NextResponse } from "next/server";
import { getAccount } from "@/lib/account";
import { googleAuthUrl, googleConfigured } from "@/lib/calendar";
import { SITE_URL } from "@/lib/twilio/consent";

// Connect Google Calendar (free/busy only). Needs GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.
export async function GET() {
  const account = await getAccount();
  if (!account) return NextResponse.redirect(`${SITE_URL}/login?next=/settings`);
  if (!googleConfigured()) return NextResponse.redirect(`${SITE_URL}/settings?calendar=google-not-set-up`);
  return NextResponse.redirect(googleAuthUrl(account.id));
}
