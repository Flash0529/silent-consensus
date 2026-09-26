"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useCircle, useMe, withAs } from "@/lib/useCircle";
import { FloatingIconButton } from "@/components/FloatingIconButton";
import { GroupPill } from "@/components/GroupPill";
import { BackIcon, LockIcon, ShareIcon } from "@/components/Icons";
import { MemberStatusGrid } from "@/components/MemberStatusGrid";
import { PlanningStepper } from "@/components/PlanningStepper";
import { PrimaryPill } from "@/components/PrimaryPill";
import { Sheet } from "@/components/Sheet";
import { InviteCard } from "@/components/InviteCard";

export default function GroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data: circle, error } = useCircle(slug);
  const { data: me } = useMe(slug);
  const [inviteOpen, setInviteOpen] = useState(false);

  if (error) return <Centered title="That plan doesn't exist" body="Check the link and try again." />;
  if (!circle) return <Centered title="Loading…" />;

  const done = circle.members.filter((m) => m.interviewStatus === "DONE").length;
  const total = circle.members.length;
  const allDone = total > 0 && done === total;
  const waiting = total - done;
  const planning = circle.status === "PLANNING" || circle.planningStage !== "NONE";
  const heading = allDone ? "Everyone's in" : waiting === 1 ? "Waiting on 1 friend" : `Waiting on ${waiting} friends`;

  return (
    <main className="relative min-h-dvh pb-40">
      <div className="absolute inset-x-4 top-5 z-20 flex items-center gap-2">
        <FloatingIconButton label="Back to my chat" href={withAs(me?.member ? `/c/${slug}/chat` : "/")}>
          <BackIcon />
        </FloatingIconButton>
        <GroupPill title={circle.title} members={circle.members} />
        <div className="grow" />
        <FloatingIconButton label="Share invite link" onClick={() => setInviteOpen(true)}>
          <ShareIcon />
        </FloatingIconButton>
      </div>

      <div className="flex flex-col gap-6 px-[22px] pt-[104px]">
        <div>
          <h1 className="text-[30px] font-bold leading-tight tracking-[-0.02em]">{heading}</h1>
          <p className="mt-1.5 text-body text-muted">{circle.dateLabel}</p>
        </div>
        <MemberStatusGrid members={circle.members} />
        {planning ? (
          <PlanningStepper stage={circle.planningStage} memberCount={total} />
        ) : (
          <p className="text-secondary text-ink-2">
            {done} of {total} finished chatting with Hush.{" "}
            {allDone ? "Hush will plan in a moment." : "Hush plans as soon as everyone's done."}
          </p>
        )}
        <p className="flex items-center gap-2 text-secondary text-muted">
          <LockIcon size={15} stroke={2.4} />
          Answers stay private, even from the organizer.
        </p>
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-app flex-col gap-2 bg-gradient-to-t from-white via-white to-white/0 px-[22px] pb-[max(34px,env(safe-area-inset-bottom))] pt-6">
        {me?.member ? (
          me.member.interviewStatus !== "DONE" && <PrimaryPill href={withAs(`/c/${slug}/chat`)}>Open my private chat</PrimaryPill>
        ) : (
          circle.status === "COLLECTING" && <PrimaryPill href={`/j/${slug}`}>Join this plan</PrimaryPill>
        )}
      </div>

      <Sheet open={inviteOpen} onClose={() => setInviteOpen(false)} label="Invite friends">
        <InviteCard slug={slug} title={circle.title} />
      </Sheet>
    </main>
  );
}

function Centered({ title, body }: { title: string; body?: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-8 text-center">
      <h1 className="text-card-title">{title}</h1>
      {body && <p className="text-body text-muted">{body}</p>}
      {body && (
        <Link href="/" className="font-medium underline">
          Go home
        </Link>
      )}
    </main>
  );
}
