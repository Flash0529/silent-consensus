"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCircle, useMe, withAs } from "@/lib/useCircle";
import { api } from "@/lib/client";
import { FloatingIconButton } from "@/components/FloatingIconButton";
import { GroupPill } from "@/components/GroupPill";
import { BackIcon, LockIcon, ShareIcon } from "@/components/Icons";
import { MemberStatusGrid } from "@/components/MemberStatusGrid";
import { PlanningStepper } from "@/components/PlanningStepper";
import { PrimaryPill } from "@/components/PrimaryPill";
import { Sheet } from "@/components/Sheet";
import { InviteCard } from "@/components/InviteCard";
import { PlanCard } from "@/components/PlanCard";
import { MediationCardView } from "@/components/MediationCardView";
import { HushBubble } from "@/components/HushBubble";
import { OptionCard } from "@/components/OptionCard";

const PLAN_VOTES = [
  { label: "I'm in", choice: "IN" },
  { label: "Different time", choice: "DIFFERENT_TIME" },
  { label: "Tweak something", choice: "TWEAK" },
] as const;
const MEDIATE_VOTES = [
  { label: "I can agree to this", choice: "IN" },
  { label: "I'd change one thing", choice: "TWEAK" },
  { label: "I'm not ready yet", choice: "NOT_READY" },
] as const;

export default function GroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const { data: circle, error, mutate } = useCircle(slug);
  const { data: me } = useMe(slug);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (error) return <Centered title="That plan doesn't exist" body="Check the link and try again." />;
  if (!circle) return <Centered title="Loading…" />;

  const mediate = circle.kind === "MEDIATE";
  const total = circle.members.length;
  const done = circle.members.filter((m) => m.interviewStatus === "DONE").length;
  const allDone = total > 0 && done === total;
  const waiting = total - done;
  const plan = circle.plan;
  const status = circle.status;
  const isOrganizer = !!me?.member?.isOrganizer;
  const myRow = circle.members.find((m) => m.id === me?.member?.id);
  const iVoted = !!myRow?.hasVoted;
  const showPlan = !!plan && (status === "PROPOSED" || status === "CONFIRMED");
  const planning = status === "PLANNING" || circle.planningStage === "FAILED";
  const nonIn = plan ? plan.voteCounts.differentTime + plan.voteCounts.tweak + plan.voteCounts.notReady : 0;

  const heading =
    status === "PAUSED"
      ? "Paused for now"
      : status === "CONFIRMED"
        ? mediate
          ? "Everyone agreed"
          : "It's on!"
        : showPlan
          ? mediate
            ? "A way forward"
            : "Here's the plan"
          : allDone
            ? mediate
              ? "Every side is heard"
              : "Everyone's in"
            : waiting === 1
              ? `Waiting on 1 ${mediate ? "person" : "friend"}`
              : `Waiting on ${waiting} ${mediate ? "people" : "friends"}`;

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      await mutate();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const vote = (choice: string) =>
    act(async () => {
      const res = await api<{ goTo: "chat" | "share" }>(`/api/me/vote?c=${slug}`, {
        method: "POST",
        body: JSON.stringify({ choice }),
      });
      router.push(withAs(res.goTo === "share" ? `/c/${slug}/share` : `/c/${slug}/chat`));
    });

  const runPlanner = (replan = false) =>
    act(() => api(`/api/circles/${slug}/plan`, { method: "POST", body: JSON.stringify({ replan }) }));

  const votes = mediate ? MEDIATE_VOTES : PLAN_VOTES;

  return (
    <main className="relative min-h-dvh pb-44">
      <div className="absolute inset-x-4 top-5 z-20 flex items-center gap-2">
        <FloatingIconButton label="Back to the group chat" href={withAs(me?.member ? `/c/${slug}/group` : "/start")}>
          <BackIcon />
        </FloatingIconButton>
        <GroupPill title={circle.title} members={circle.members} />
        <div className="grow" />
        {status === "COLLECTING" && (
          <FloatingIconButton label="Share invite link" onClick={() => setInviteOpen(true)}>
            <ShareIcon />
          </FloatingIconButton>
        )}
      </div>

      <div className="flex flex-col gap-6 px-[22px] pt-[104px]">
        <div>
          <h1 className="text-[30px] font-bold leading-tight tracking-[-0.02em]">{heading}</h1>
          <p className="mt-1.5 text-body text-muted">{plan && showPlan ? plan.dateLabel : circle.dateLabel}</p>
        </div>

        {!showPlan && <MemberStatusGrid members={circle.members} />}

        {planning && (
          <PlanningStepper
            stage={circle.planningStage}
            memberCount={done || total}
            venueCount={circle.foundCount}
            kind={circle.kind}
          />
        )}

        {status === "COLLECTING" && circle.planningStage !== "FAILED" && (
          <p className="text-secondary text-ink-2">
            {done} of {total} finished chatting with Hush.{" "}
            {mediate ? "Hush suggests a way forward once every side is heard." : "Hush plans as soon as everyone's done."}
          </p>
        )}
        {status === "PAUSED" && (
          <p className="text-secondary text-ink-2">Hush paused this one. Some things are better worked through with a person.</p>
        )}

        {showPlan && plan && (
          <>
            <HushBubble>
              {mediate
                ? `Here's a way forward for all ${total} of you.`
                : `Here's a plan that works for all ${total === 4 ? "four" : total} of you.`}
            </HushBubble>
            {mediate && plan.card ? (
              <MediationCardView card={plan.card} leakCheckPassed={plan.leakCheckPassed} />
            ) : (
              <PlanCard
                title={plan.title}
                dateLabel={plan.dateLabel}
                stops={plan.stops}
                whyItWorks={plan.whyItWorks}
                leakCheckPassed={plan.leakCheckPassed}
              />
            )}

            {me?.member && status === "PROPOSED" && !iVoted && (
              <OptionCard
                question={mediate ? "Can you agree to this?" : "Does this work for you?"}
                options={votes.map((v) => v.label)}
                disabled={busy}
                onPick={(i) => vote(votes[i].choice)}
              />
            )}

            <div className="flex flex-col gap-3">
              <MemberStatusGrid
                members={circle.members.map((m) => ({ ...m, interviewStatus: m.hasVoted ? "DONE" : "IN_PROGRESS" }))}
              />
              <p className="text-secondary text-ink-2">
                {status === "CONFIRMED"
                  ? mediate
                    ? "Everyone agreed. Check in together on the date above."
                    : "Everyone's in. See you there!"
                  : `${plan.voteCounts.in} of ${total} ${mediate ? "can agree" : "are in"}${
                      nonIn ? `. ${nonIn === 1 ? "1 person wants" : `${nonIn} people want`} a change.` : "."
                    }`}
              </p>
            </div>
          </>
        )}

        {actionError && <p className="text-secondary text-danger">{actionError}</p>}

        <p className="flex items-center gap-2 text-secondary text-muted">
          <LockIcon size={15} stroke={2.4} />
          Answers stay private, even from the organizer.
        </p>
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-app flex-col gap-2 bg-gradient-to-t from-surface via-surface to-surface/0 px-[22px] pb-[max(34px,env(safe-area-inset-bottom))] pt-6">
        {isOrganizer && status === "COLLECTING" && done >= 2 && !allDone && (
          <button
            type="button"
            disabled={busy}
            onClick={() => runPlanner()}
            className="h-row rounded-full bg-hairline text-body font-medium disabled:opacity-50"
          >
            {mediate ? "Draft now with who's finished" : "Plan now with who's finished"}
          </button>
        )}
        {isOrganizer && circle.planningStage === "FAILED" && (
          <PrimaryPill onClick={() => runPlanner()} disabled={busy}>
            Try again
          </PrimaryPill>
        )}
        {isOrganizer && status === "PROPOSED" && nonIn > 0 && circle.canReplan && (
          <button
            type="button"
            disabled={busy}
            onClick={() => runPlanner(true)}
            className="h-row rounded-full bg-hairline text-body font-medium disabled:opacity-50"
          >
            {mediate ? "Ask Hush for a second draft" : "Ask Hush to replan"}
          </button>
        )}
        {me?.member ? (
          showPlan ? (
            (iVoted || status === "CONFIRMED") && (
              <PrimaryPill href={withAs(`/c/${slug}/share`)}>{mediate ? "My private notes" : "My share"}</PrimaryPill>
            )
          ) : (
            me.member.interviewStatus !== "DONE" &&
            status === "COLLECTING" && <PrimaryPill href={withAs(`/c/${slug}/chat`)}>Open my private chat</PrimaryPill>
          )
        ) : (
          status === "COLLECTING" && <PrimaryPill href={`/j/${slug}`}>Join this plan</PrimaryPill>
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
        <Link href="/start" className="font-medium underline">
          Go home
        </Link>
      )}
    </main>
  );
}
