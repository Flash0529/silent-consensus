import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { decodeCookie, demoMode, encodeCookie, hashToken, newDeviceToken } from "@/lib/identity";
import type { VaultShape } from "@/lib/vault";

// "Remember me" lives on the phone: a long-lived httpOnly cookie links this device to
// a Profile. Nobody can load it by typing a name.

export const PROFILE_COOKIE = "qc_profile";
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function getDeviceProfile() {
  const decoded = decodeCookie((await cookies()).get(PROFILE_COOKIE)?.value);
  if (!decoded) return null;
  const p = await db.profile.findUnique({ where: { tokenHash: hashToken(decoded.token) } });
  return p && p.id === decoded.memberId ? p : null;
}

export type ProfilePrefs = Pick<VaultShape, "budgetCapCents" | "dietary" | "alcohol" | "stepFreeRequired" | "noise" | "vibe">;

export function prefsFromVault(v: VaultShape): ProfilePrefs {
  return {
    budgetCapCents: v.budgetCapCents,
    dietary: v.dietary,
    alcohol: v.alcohol,
    stepFreeRequired: v.stepFreeRequired,
    noise: v.noise,
    vibe: v.vibe,
  };
}

/** Create a profile from a finished interview and bind it to this phone. */
export async function rememberOnThisDevice(name: string, prefs: ProfilePrefs) {
  const { token, tokenHash } = newDeviceToken();
  const profile = await db.profile.create({ data: { name, tokenHash, ...prefs } });
  // Presenter iframes act as demo personas: never bind a persona's profile to the presenter's browser.
  if (demoMode() && (await headers()).get("x-demo-as")) return profile;
  (await cookies()).set(PROFILE_COOKIE, encodeCookie(profile.id, token), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return profile;
}

export function hasPrefs(p: ProfilePrefs) {
  return (
    p.budgetCapCents !== null ||
    p.dietary.length > 0 ||
    p.alcohol !== null ||
    p.stepFreeRequired !== null ||
    p.noise !== null ||
    p.vibe.length > 0
  );
}
