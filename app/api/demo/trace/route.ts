import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { demoOnly } from "../guard";

// Trace rows carry task, provider, latency and a count label. Never prompts or private text.
export async function GET(req: Request) {
  const off = demoOnly();
  if (off) return off;
  const slug = new URL(req.url).searchParams.get("c") ?? "";
  const circle = await db.circle.findUnique({ where: { slug }, select: { id: true, isDemo: true } });
  if (!circle?.isDemo) return NextResponse.json({ traces: [] });
  const traces = await db.aiTrace.findMany({
    where: { circleId: circle.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, task: true, provider: true, ms: true, ok: true, label: true, meta: true, createdAt: true },
  });
  return NextResponse.json({
    traces: traces.map((t) => {
      const meta = (t.meta ?? {}) as Record<string, unknown>;
      return {
        id: t.id,
        task: t.task,
        provider: t.provider,
        providerLabel: typeof meta.providerLabel === "string" ? meta.providerLabel : t.provider === "local" ? "Code" : t.provider,
        model: typeof meta.model === "string" ? meta.model : null,
        ms: t.ms,
        ok: t.ok,
        label: t.label,
        at: t.createdAt.toISOString(),
      };
    }),
  });
}
