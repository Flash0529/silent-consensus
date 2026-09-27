"use client";

import { useEffect, useRef, useState } from "react";
import { HushBubble, MemberBubble, TypingDots } from "@/components/HushBubble";
import { OptionCard } from "@/components/OptionCard";
import { ConfirmCard } from "@/components/ConfirmChips";
import { Composer } from "@/components/Composer";
import { FloatingHeader } from "@/components/ScrollFade";
import { FloatingIconButton } from "@/components/FloatingIconButton";
import { BotPill } from "@/components/BotPill";
import { BackIcon } from "@/components/Icons";
import { InviteCard } from "@/components/InviteCard";
import { PrimaryPill } from "@/components/PrimaryPill";
import { api } from "@/lib/client";
import type { SetupDraft } from "@/lib/ai/schemas";
import type { CirclePayload, SetupResult } from "@/lib/ai/setup";

type Line = { from: "hush" | "me"; text: string };

// The opening is fixed so it shows instantly and costs no model call.
const OPENING: Line[] = [
  { from: "hush", text: "Hi! I'm Hush. I'll check in with each friend privately, then plan something everyone can say yes to." },
  { from: "hush", text: "First, what should I call you?" },
];
const CREATE = "Create the plan";
const CHANGE = "Change something";

export default function NewPlan() {
  const [lines, setLines] = useState<Line[]>(OPENING);
  const [options, setOptions] = useState<string[]>([]);
  const [draft, setDraft] = useState<SetupDraft>({});
  const [ready, setReady] = useState<{ circle: CirclePayload; summary: string[] } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, thinking, options, ready, trouble, slug]);

  const turn = async (history: Line[]) => {
    setThinking(true);
    setTrouble(null);
    setOptions([]);
    setReady(null);
    try {
      const res = await api<SetupResult>("/api/new/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: history.map((l) => ({ role: l.from === "me" ? "user" : "assistant", content: l.text })),
          draft,
        }),
      });
      setLines((l) => [...l, { from: "hush", text: res.reply }]);
      setDraft(res.draft);
      setOptions(res.options);
      if (res.ready && res.circle) setReady({ circle: res.circle, summary: res.summary });
    } catch (e) {
      setTrouble(e instanceof Error ? e.message : "I'm having trouble thinking right now. Try again in a moment.");
    } finally {
      setThinking(false);
    }
  };

  const send = (text: string) => {
    if (thinking) return;
    if (ready && text === CREATE) return create(ready);
    const next = [...lines, { from: "me" as const, text }];
    setLines(next);
    turn(next);
  };

  const create = async (confirmed: { circle: CirclePayload; summary: string[] }) => {
    const { circle } = confirmed;
    setLines((l) => [...l, { from: "me", text: CREATE }]);
    setReady(null);
    setThinking(true);
    setTrouble(null);
    try {
      const res = await api<{ slug: string }>("/api/circles", { method: "POST", body: JSON.stringify(circle) });
      setTitle(circle.title);
      setSlug(res.slug);
      setLines((l) => [
        ...l,
        {
          from: "hush",
          text:
            circle.kind === "MEDIATE"
              ? `"${circle.title}" is set. Share this with everyone involved. I'll hear each side privately, including yours, and never quote anyone.`
              : `"${circle.title}" is set. Share this with your friends. I'll talk to each of them privately, and you too.`,
        },
      ]);
    } catch (e) {
      setTrouble(e instanceof Error ? e.message : "Something went wrong");
      setReady(confirmed);
    } finally {
      setThinking(false);
    }
  };

  const lastIsMine = lines.at(-1)?.from === "me";

  return (
    <main className="relative flex h-dvh flex-col">
      <FloatingHeader>
        <FloatingIconButton label="Back" href="/">
          <BackIcon />
        </FloatingIconButton>
        <BotPill />
      </FloatingHeader>

      <div className="no-scrollbar flex grow flex-col gap-3 overflow-y-auto px-[18px] pb-3 pt-24">
        <div className="grow" />
        {lines.map((l, i) =>
          l.from === "hush" ? <HushBubble key={i}>{l.text}</HushBubble> : <MemberBubble key={i}>{l.text}</MemberBubble>,
        )}
        {thinking && <TypingDots />}
        {!thinking && ready && (
          <>
            {ready.summary.length > 0 && <ConfirmCard lead="Here's what I'll set up:" chips={ready.summary} />}
            <OptionCard options={[CREATE, CHANGE]} onPick={(i) => send(i === 0 ? CREATE : CHANGE)} />
          </>
        )}
        {!thinking && !ready && !slug && options.length > 0 && <OptionCard options={options} onPick={(i) => send(options[i])} />}
        {trouble && (
          <div className="flex flex-col items-start gap-2">
            <HushBubble>{trouble}</HushBubble>
            {lastIsMine && (
              <button type="button" onClick={() => turn(lines)} className="ml-2 text-secondary font-medium underline">
                Try again
              </button>
            )}
          </div>
        )}
        {slug && (
          <>
            <InviteCard slug={slug} title={title} />
            <div className="flex flex-col gap-3 pt-2">
              <PrimaryPill href={`/c/${slug}/chat`}>Start my private chat</PrimaryPill>
              <a href={`/c/${slug}`} className="py-2 text-center text-body font-medium text-muted">
                See who's joined
              </a>
            </div>
          </>
        )}
        <div ref={bottom} />
      </div>

      {!slug && (
        <Composer
          onSend={send}
          showPlus={false}
          disabled={thinking}
          placeholder={lines.length <= OPENING.length ? "Your first name" : "Tell Hush anything"}
        />
      )}
    </main>
  );
}
