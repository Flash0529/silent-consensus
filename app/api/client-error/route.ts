import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/ratelimit";

// Browser errors, so crashes people hit show up in the server log (message + page only; no content).
const Body = z.object({ message: z.string().max(500), digest: z.string().max(100).optional(), path: z.string().max(200), stack: z.string().max(2000).optional() });

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "?";
  if (!rateLimit(`client-error:${ip}`, 20, 60_000)) return NextResponse.json({ ok: true });
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }
  const p = Body.safeParse(raw);
  if (p.success) console.error(`[client error] ${p.data.path}: ${p.data.message}${p.data.digest ? ` (digest ${p.data.digest})` : ""}\n${(p.data.stack ?? "").split("\n").slice(0, 6).join("\n")}`);
  return NextResponse.json({ ok: true });
}
