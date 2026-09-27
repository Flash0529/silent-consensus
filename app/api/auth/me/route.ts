import { NextResponse } from "next/server";
import { inQuietHours, readStyle } from "@/lib/hushstyle";
import { reviewsFor } from "@/lib/review";
import { getAccount, myPlans } from "@/lib/account";
import { db } from "@/lib/db";

// The logged-in account and its plans. Only ever the caller's own data.
export async function GET() {
  const account = await getAccount();
  if (!account) return NextResponse.json({ account: null, plans: [] }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(
    {
      account: {
        name: account.name,
        email: account.email,
        photo: account.photo,
        timeZone: account.timeZone,
        // Quiet hours (Make Hush yours): Hush doesn't pull you into its chat right now.
        quiet: inQuietHours(readStyle(account.hushStyle), account.timeZone),
        // Open reviews waiting on you (managers / HR, when the company uses manager review).
        reviews: await (async () => {
          const { where } = await reviewsFor(account.id);
          return where ? db.escalation.count({ where: { ...where, status: "OPEN" } }) : 0;
        })(),
        org: account.orgId
          ? { name: (await db.organization.findUnique({ where: { id: account.orgId }, select: { name: true } }))?.name ?? "", role: account.orgRole ?? "MEMBER" }
          : null,
      },
      plans: await myPlans(account.id),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
