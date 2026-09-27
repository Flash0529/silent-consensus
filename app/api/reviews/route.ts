import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAccount } from "@/lib/account";
import { jsonError } from "@/lib/http";
import { reviewsFor } from "@/lib/review";

// Reviews for managers / HR: only the flagged messages someone sent anyway, and Hush's reason.
export async function GET() {
  const a = await getAccount();
  if (!a) return jsonError("Log in first.", 401);
  const { where } = await reviewsFor(a.id);
  if (!where) return NextResponse.json({ reviews: [] });
  const rows = await db.escalation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { subject: { select: { name: true, email: true, photo: true } }, overrides: { orderBy: { at: "asc" } } },
  });
  return NextResponse.json(
    {
      reviews: rows.map((r) => ({
        id: r.id,
        route: r.route,
        severity: r.severity,
        status: r.status,
        note: r.note,
        createdAt: r.createdAt,
        reviewedAt: r.reviewedAt,
        person: r.subject,
        messages: r.overrides.map((o) => ({ text: o.text, issue: o.issue, severity: o.severity, chat: o.circleTitle, at: o.at })),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
