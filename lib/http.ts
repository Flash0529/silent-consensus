import { NextResponse } from "next/server";
import { z } from "zod";

export function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function parseBody<T extends z.ZodType>(req: Request, schema: T) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false as const, res: jsonError("Invalid JSON") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, res: jsonError("Invalid request") };
  return { ok: true as const, data: parsed.data as z.infer<T> };
}

export function originOf(req: Request) {
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : (process.env.APP_URL ?? "http://localhost:3000");
}
