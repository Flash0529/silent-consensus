import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAccount } from "@/lib/account";
import { jsonError, parseBody } from "@/lib/http";
import { personMd } from "@/lib/personmd";

// Your Hush profile (Markdown): what Hush reads before it talks to you. You can see all of it, edit the
// private notes, download it, or clear it. ?download=1 returns it as a .md file.
export async function GET(req: Request) {
  const account = await getAccount();
  if (!account) return jsonError("Log in first.", 401);
  const md = await personMd(account.id);
  if (new URL(req.url).searchParams.get("download"))
    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="hush-profile.md"`,
        "Cache-Control": "no-store",
      },
    });
  const a = await db.account.findUnique({ where: { id: account.id }, select: { hushMd: true } });
  return NextResponse.json({ md, notes: a?.hushMd ?? "" }, { headers: { "Cache-Control": "no-store" } });
}

const Body = z.object({ notes: z.string().max(2500) });

export async function PATCH(req: Request) {
  const account = await getAccount();
  if (!account) return jsonError("Log in first.", 401);
  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;
  await db.account.update({ where: { id: account.id }, data: { hushMd: body.data.notes.trim() || null } });
  return NextResponse.json({ ok: true, md: await personMd(account.id) });
}
