import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError, parseBody } from "@/lib/http";
import { getAccount } from "@/lib/account";

// Admins: change someone's role, or remove them from the company (their account stays).
async function adminAnd(id: string) {
  const a = await getAccount();
  if (!a?.orgId || a.orgRole !== "ADMIN") return { error: jsonError("Only company admins can do this.", 403) };
  const target = await db.account.findUnique({ where: { id } });
  if (!target || target.orgId !== a.orgId) return { error: jsonError("Not found", 404) };
  return { a, target };
}

async function lastAdmin(orgId: string, excluding: string) {
  return (await db.account.count({ where: { orgId, orgRole: "ADMIN", id: { not: excluding } } })) === 0;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await adminAnd(id);
  if (r.error) return r.error;
  const body = await parseBody(
    req,
    z.object({ role: z.enum(["ADMIN", "MEMBER"]).optional(), managerId: z.string().max(40).nullable().optional(), isHr: z.boolean().optional() }),
  );
  if (!body.ok) return body.res;
  const d = body.data;
  if (d.role === "MEMBER" && (await lastAdmin(r.a!.orgId!, id))) return jsonError("A company needs at least one admin.", 409);
  if (d.managerId) {
    if (d.managerId === id) return jsonError("Someone can't be their own manager.", 400);
    const m = await db.account.findUnique({ where: { id: d.managerId }, select: { orgId: true, managerId: true } });
    if (!m || m.orgId !== r.a!.orgId) return jsonError("Pick someone in the company.", 400);
    // No loops (A manages B manages A).
    let cur: string | null = d.managerId;
    for (let i = 0; i < 20 && cur; i++) {
      if (cur === id) return jsonError("That would make a loop of managers.", 400);
      cur = (await db.account.findUnique({ where: { id: cur }, select: { managerId: true } }))?.managerId ?? null;
    }
  }
  await db.account.update({
    where: { id },
    data: { ...(d.role ? { orgRole: d.role } : {}), ...(d.managerId !== undefined ? { managerId: d.managerId } : {}), ...(d.isHr !== undefined ? { isHr: d.isHr } : {}) },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await adminAnd(id);
  if (r.error) return r.error;
  if (await lastAdmin(r.a!.orgId!, id)) return jsonError("A company needs at least one admin.", 409);
  await db.account.update({ where: { id }, data: { orgId: null, orgRole: null } });
  return NextResponse.json({ ok: true });
}
