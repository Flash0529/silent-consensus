import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { getAccount } from "@/lib/account";
import { zTitle } from "@/lib/names";

// Company management (business admins). Members see a read-only summary.

async function me() {
  const a = await getAccount();
  if (!a?.orgId) return null;
  return a;
}

export async function GET() {
  const a = await me();
  if (!a) return jsonError("You're not part of a company account.", 403);
  const org = await db.organization.findUniqueOrThrow({ where: { id: a.orgId! } });
  const admin = a.orgRole === "ADMIN";
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [accounts, circles, msgs7d, items] = await Promise.all([
    db.account.findMany({
      where: { orgId: org.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, name: true, email: true, orgRole: true, createdAt: true, photo: true, managerId: true, isHr: true,
        sessions: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { members: true } },
      },
    }),
    db.circle.findMany({
      where: { orgId: org.id },
      orderBy: { createdAt: "desc" },
      select: {
        slug: true, title: true, createdAt: true, _count: { select: { members: true } },
        groupMessages: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    db.groupMessage.count({ where: { circle: { orgId: org.id }, kind: "TEXT", createdAt: { gte: weekAgo } } }),
    db.chatItem.findMany({ where: { circle: { orgId: org.id }, status: { not: "DISMISSED" } }, select: { kind: true, status: true } }),
  ]);
  return NextResponse.json(
    {
      org: { name: org.name, domain: org.domain, toneCheck: org.toneCheck, autoDetect: org.autoDetect, managerReview: org.managerReview, isDemo: org.isDemo },
      admin,
      you: a.id,
      stats: {
        people: accounts.length,
        groups: circles.length,
        messages7d: msgs7d,
        meetings: items.filter((i) => i.kind === "EVENT").length,
        actionOpen: items.filter((i) => i.kind === "TASK" && i.status === "OPEN").length,
        actionDone: items.filter((i) => i.kind === "TASK" && i.status === "DONE").length,
        decisions: items.filter((i) => i.kind === "DECISION").length,
      },
      people: accounts.map((p) => ({
        id: p.id,
        name: p.name,
        email: admin ? p.email : null,
        role: p.orgRole ?? "MEMBER",
        managerId: p.managerId,
        isHr: p.isHr,
        joined: p.createdAt,
        lastActive: p.sessions[0]?.createdAt ?? null,
        groups: p._count.members,
        photo: p.photo,
      })),
      groups: circles.map((c) => ({ slug: c.slug, title: c.title, members: c._count.members, lastActive: c.groupMessages[0]?.createdAt ?? c.createdAt })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const Patch = z.object({
  name: zTitle(80).optional(),
  toneCheck: z.boolean().optional(),
  autoDetect: z.boolean().optional(),
  managerReview: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const a = await me();
  if (!a || a.orgRole !== "ADMIN") return jsonError("Only company admins can change this.", 403);
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("Invalid request");
  }
  const p = Patch.safeParse(raw);
  if (!p.success) return jsonError("Check your changes.");
  await db.organization.update({ where: { id: a.orgId! }, data: p.data });
  return NextResponse.json({ ok: true });
}
