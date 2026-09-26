import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getMember } from "@/lib/identity";
import { groupInclude, toGroupSafe } from "@/lib/serialize";
import { JoinSheet } from "./JoinSheet";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const circle = await db.circle.findUnique({ where: { slug }, include: groupInclude });
  if (!circle)
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
        <h1 className="text-card-title">That link doesn't work</h1>
        <p className="text-body text-muted">Ask your friend to send the invite again.</p>
        <Link href="/" className="font-medium underline">
          Go home
        </Link>
      </main>
    );
  if (await getMember(slug)) redirect(`/c/${slug}/chat`);
  return <JoinSheet circle={toGroupSafe(circle)} />;
}
