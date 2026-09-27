import { NextResponse } from "next/server";
import { getAccount } from "@/lib/account";
import { addGoogleLink, checkGoogleState, googleExchange } from "@/lib/calendar";
import { SITE_URL } from "@/lib/twilio/consent";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const back = (s: string) => NextResponse.redirect(`${SITE_URL}/settings?calendar=${s}`);
  const account = await getAccount();
  const who = checkGoogleState(u.searchParams.get("state"));
  // The signed state must match whoever is logged in right now.
  if (!account || !who || who !== account.id) return back("error");
  const code = u.searchParams.get("code");
  if (!code) return back(u.searchParams.get("error") === "access_denied" ? "cancelled" : "error");
  try {
    await addGoogleLink(account.id, await googleExchange(code));
    return back("google-connected");
  } catch (e) {
    console.error("google calendar connect failed", e);
    return back("error");
  }
}
