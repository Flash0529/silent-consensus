"use client";

import { use, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { motion } from "framer-motion";
import { FloatingHeader } from "@/components/ScrollFade";
import { FloatingIconButton } from "@/components/FloatingIconButton";
import { BotPill } from "@/components/BotPill";
import { BackIcon, CalendarIcon, CheckIcon, LockIcon, ShareIcon } from "@/components/Icons";
import { HushBubble } from "@/components/HushBubble";
import { PrimaryPill } from "@/components/PrimaryPill";
import { Sheet } from "@/components/Sheet";
import { MediationCardView, type MediationCardData } from "@/components/MediationCardView";
import { api, fetcher, money, withAs } from "@/lib/client";

type ShareRes = {
  name: string;
  share: null | {
    kind: "PLAN" | "MEDIATE";
    status: string;
    title: string;
    dateLabel: string;
    myVote: string | null;
    paid: boolean;
    privateNote: string;
    brief: { reflected: string[]; opener: string; offer: string } | null;
    card: MediationCardData | null;
    money: null | {
      lines: { label: string; cents: number }[];
      baseCents: number;
      coveredCents: number;
      chipInCents: number;
      finalCents: number;
    };
  };
};

export default function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const key = `/api/me/share?c=${slug}`;
  const { data, error, mutate } = useSWR<ShareRes>(key, fetcher, { refreshInterval: 3000, revalidateOnFocus: false });
  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState(false);

  const header = (
    <FloatingHeader>
      <FloatingIconButton label="Back to the plan" href={withAs(`/c/${slug}`)}>
        <BackIcon />
      </FloatingIconButton>
      <BotPill />
    </FloatingHeader>
  );

  if (error)
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
        <h1 className="text-card-title">You're not in this plan</h1>
        <PrimaryPill href="/">Go home</PrimaryPill>
      </main>
    );
  if (!data) return <main className="relative min-h-dvh">{header}</main>;
  const s = data.share;
  if (!s)
    return (
      <main className="relative flex min-h-dvh flex-col">
        {header}
        <div className="flex grow flex-col justify-end gap-3 px-[18px] pb-10 pt-24">
          <HushBubble>There's nothing to show yet. I'll let you know when the plan is ready.</HushBubble>
        </div>
      </main>
    );

  if (s.kind === "MEDIATE") {
    return (
      <main className="relative min-h-dvh">
        {header}
        <div className="flex flex-col gap-3 px-[18px] pb-12 pt-24">
          <HushBubble>Here are your private notes, {data.name}. Only you can see these.</HushBubble>
          {s.brief && (
            <motion.section
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col gap-4 rounded-card bg-bubble p-[18px]"
            >
              <div className="flex flex-col gap-2">
                <p className="text-secondary font-semibold">Where your needs show up</p>
                <ul className="flex flex-col gap-1.5">
                  {s.brief.reflected.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-secondary text-ink-2">
                      <span className="mt-0.5">
                        <CheckIcon size={16} stroke={2.6} />
                      </span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-secondary font-semibold">A way you could start</p>
                <p className="rounded-list border border-hairline bg-surface px-4 py-3 text-secondary italic text-ink-2">
                  “{s.brief.opener}”
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-secondary font-semibold">Something you could offer</p>
                <p className="text-secondary text-ink-2">{s.brief.offer}</p>
              </div>
              <p className="flex items-center gap-1.5 text-caption text-muted">
                <LockIcon />
                Only you see this
              </p>
            </motion.section>
          )}
          {s.card && <MediationCardView card={s.card} leakCheckPassed={false} />}
          <Link href={withAs(`/c/${slug}`)} className="py-2 text-center text-body font-medium text-muted">
            Back to the way forward
          </Link>
        </div>
      </main>
    );
  }

  const m = s.money!;
  const day = s.dateLabel.split(" · ")[0]?.split(",")[0] ?? "";
  const dayName =
    ({ Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" } as Record<string, string>)[
      day
    ] ?? "the plan";

  const pay = async () => {
    setPaying(true);
    try {
      await api(`/api/me/pay?c=${slug}`, { method: "POST" });
      await mutate();
    } finally {
      setPaying(false);
    }
  };

  const ics = () => {
    const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const body = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Quiet Consensus//EN",
      "BEGIN:VEVENT",
      `UID:${slug}-${now}@quietconsensus`,
      `DTSTAMP:${now}`,
      `SUMMARY:${s.title}`,
      `DESCRIPTION:${s.dateLabel}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(body)}`;
  };

  const sharePlan = async () => {
    const url = `${window.location.origin}/c/${slug}`;
    const text = `${s.title} · ${s.dateLabel}`;
    if (navigator.share) await navigator.share({ title: s.title, text, url }).catch(() => {});
    else await navigator.clipboard.writeText(`${text}\n${url}`).catch(() => {});
  };

  return (
    <main className="relative min-h-dvh">
      {header}
      <div className="flex flex-col gap-3 px-[18px] pb-12 pt-24">
        <HushBubble>
          {s.status === "CONFIRMED" ? `You're all set for ${dayName}, ${data.name}.` : `Here's your share for ${dayName}, ${data.name}.`}
        </HushBubble>
        <motion.section
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col gap-[14px] rounded-card bg-bubble p-[18px]"
        >
          <div className="flex flex-col gap-1 px-1">
            <p className="text-secondary font-medium text-ink-2">Your share</p>
            <p className="text-[44px] font-bold leading-none tracking-[-0.02em]">{money(m.finalCents)}</p>
            <p className="mt-1 flex items-center gap-1.5 text-secondary text-ink-2">
              <CheckIcon size={16} stroke={2.6} />
              {s.privateNote.startsWith("Fits what you told Hush") ? "Fits what you told Hush" : s.privateNote}
            </p>
          </div>
          <ul className="overflow-hidden rounded-list border border-hairline bg-surface">
            {m.lines.map((l, i) => (
              <li key={i} className="flex justify-between border-b border-divider px-4 py-3 text-body">
                <span>{l.label}</span>
                <span>{money(l.cents)}</span>
              </li>
            ))}
            {m.coveredCents > 0 && (
              <li className="flex justify-between border-b border-divider px-4 py-3 text-body">
                <span>Quiet group pool</span>
                <span>−{money(m.coveredCents)}</span>
              </li>
            )}
            {m.chipInCents > 0 && (
              <li className="flex justify-between border-b border-divider px-4 py-3 text-body">
                <span>Your quiet chip-in</span>
                <span>+{money(m.chipInCents)}</span>
              </li>
            )}
            <li className="flex justify-between px-4 py-3 text-body font-semibold">
              <span>You pay</span>
              <span>{money(m.finalCents)}</span>
            </li>
          </ul>
          {m.coveredCents > 0 && (
            <p className="px-1 text-secondary text-ink-2">
              A quiet group pool covered {money(m.coveredCents)}. No one can see who gave or who it helped.
            </p>
          )}
          {m.chipInCents > 0 && (
            <p className="px-1 text-secondary text-ink-2">
              You quietly added {money(m.chipInCents)} to the pool. No one can see who gave or who it helped.
            </p>
          )}
        </motion.section>

        <div className="mt-2 flex flex-col gap-3">
          {s.paid ? (
            <p className="flex h-pill items-center justify-center gap-2 rounded-full bg-bubble text-[18px] font-semibold">
              <CheckIcon /> Paid (demo)
            </p>
          ) : (
            <PrimaryPill onClick={() => setPayOpen(true)}>Pay {money(m.finalCents)}</PrimaryPill>
          )}
          <div className="grid grid-cols-2 gap-3">
            <a
              href={ics()}
              download={`${s.title}.ics`}
              className="flex h-row items-center justify-center gap-2 rounded-btn bg-hairline text-body font-medium"
            >
              <CalendarIcon size={18} color="#0B0B0C" />
              Add to calendar
            </a>
            <button type="button" onClick={sharePlan} className="flex h-row items-center justify-center gap-2 rounded-btn bg-hairline text-body font-medium">
              <ShareIcon size={18} />
              Share plan
            </button>
          </div>
          <p className="text-center text-caption text-muted">Demo payment. No real money moves.</p>
        </div>
      </div>

      <Sheet open={payOpen} onClose={() => setPayOpen(false)} label="Demo payment">
        <div className="flex flex-col items-center gap-4 text-center">
          {s.paid ? (
            <>
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ink">
                <CheckIcon size={30} color="#FFFFFF" stroke={3} />
              </span>
              <h2 className="text-card-title">Paid {money(m.finalCents)}</h2>
              <p className="text-body text-muted">Demo payment. No real money moves.</p>
              <PrimaryPill onClick={() => setPayOpen(false)}>Done</PrimaryPill>
            </>
          ) : (
            <>
              <h2 className="text-card-title">Pay {money(m.finalCents)}</h2>
              <p className="text-body text-muted">Demo payment. No real money moves.</p>
              <PrimaryPill onClick={pay} disabled={paying}>
                {paying ? "Paying…" : `Confirm ${money(m.finalCents)}`}
              </PrimaryPill>
              <button type="button" onClick={() => setPayOpen(false)} className="text-body font-medium text-muted">
                Cancel
              </button>
            </>
          )}
        </div>
      </Sheet>
    </main>
  );
}
