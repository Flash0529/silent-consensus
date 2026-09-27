import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// "Forget this device": drop every qc_<slug> membership cookie this browser sent.
// Only cookies present on the request are cleared, so a cross-site POST (which
// carries no SameSite=Lax cookies) can't clear anything.
export async function POST() {
  const jar = await cookies();
  const mine = jar.getAll().filter((c) => c.name.startsWith("qc_"));
  for (const c of mine) jar.delete(c.name);
  return NextResponse.json({ forgotten: mine.length });
}
