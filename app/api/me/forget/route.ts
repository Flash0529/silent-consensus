import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getDeviceProfile, PROFILE_COOKIE } from "@/lib/profile";

// "Forget this device": delete this phone's saved preferences (if any) and drop every
// qc_* cookie this browser sent (memberships and the qc_profile link).
// Only cookies present on the request are cleared, so a cross-site POST (which
// carries no SameSite=Lax cookies) can't clear anything.
export async function POST() {
  const profile = await getDeviceProfile();
  if (profile) await db.profile.delete({ where: { id: profile.id } });
  const jar = await cookies();
  const mine = jar.getAll().filter((c) => c.name.startsWith("qc_"));
  for (const c of mine) jar.delete(c.name);
  return NextResponse.json({ forgotten: mine.length, profileDeleted: !!profile });
}
