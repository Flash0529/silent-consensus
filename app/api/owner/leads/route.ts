import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { ownerAccount } from "@/lib/owner";

// Owner only: everyone who signed up for the Android waitlist or asked for a Teams pilot.
// ?format=csv downloads it.
export async function GET(req: Request) {
  if (!(await ownerAccount())) return jsonError("Not found", 404);
  const leads = await db.lead.findMany({ orderBy: { createdAt: "desc" }, take: 5000 });
  if (new URL(req.url).searchParams.get("format") === "csv") {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [["kind", "email", "name", "company", "teamSize", "source", "createdAt"], ...leads.map((l) => [l.kind, l.email, l.name, l.company, l.teamSize, l.source, l.createdAt.toISOString()])];
    return new NextResponse(rows.map((r) => r.map(esc).join(",")).join("\n"), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="silent-consensus-signups.csv"', "Cache-Control": "no-store" },
    });
  }
  return NextResponse.json({ leads }, { headers: { "Cache-Control": "no-store" } });
}
