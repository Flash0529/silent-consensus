import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/http";
import { seedStory } from "@/lib/demo";
import { demoOnly } from "../guard";

const Body = z.object({ story: z.enum(["hangout", "mediation"]).default("hangout") });

export async function POST(req: Request) {
  const off = demoOnly();
  if (off) return off;
  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;
  return NextResponse.json(await seedStory(body.data.story));
}
