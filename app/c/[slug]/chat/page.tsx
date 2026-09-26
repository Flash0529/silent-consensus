"use client";

import { use, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { FloatingHeader } from "@/components/ScrollFade";
import { FloatingIconButton } from "@/components/FloatingIconButton";
import { BotPill } from "@/components/BotPill";
import { BackIcon, GroupIcon } from "@/components/Icons";
import { HushBubble, MemberBubble, TypingDots } from "@/components/HushBubble";
import { OptionCard } from "@/components/OptionCard";
import { ConfirmChips } from "@/components/ConfirmChips";
import { Composer } from "@/components/Composer";
import { PrimaryPill } from "@/components/PrimaryPill";
import { api, fetcher, withAs } from "@/lib/client";
import type { OwnMessage } from "@/lib/ai/interview";

type ChatData = {
  me: { id: string; name: string; interviewStatus: string; isOrganizer: boolean };
  circle: { kind: "PLAN" | "MEDIATE"; title: string; status: string };
  messages: OwnMessage[];
};

type PostRes = { messages: OwnMessage[]; error: string | null; trouble: string | null };

export default function ChatPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const key = `/api/me/chat?c=${slug}`;
  const { data, error, mutate } = useSWR<ChatData>(key, fetcher, { refreshInterval: 2000, revalidateOnFocus: false });
  const [pending, setPending] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const msgs = data?.messages ?? [];
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs.length, pending, thinking, trouble]);

  const send = async (body: { text?: string; optionIndex?: number; retry?: boolean }, preview?: string) => {
    if (thinking) return;
    setTrouble(null);
    setPending(preview ?? null);
    setThinking(true);
    try {
      const res = await api<PostRes>(key, { method: "POST", body: JSON.stringify(body) });
      await mutate(
        (cur) => (cur ? { ...cur, messages: [...cur.messages, ...res.messages.filter((m) => !cur.messages.some((c) => c.id === m.id))] } : cur),
        { revalidate: true },
      );
      if (res.trouble) setTrouble(res.trouble);
    } catch (e) {
      setTrouble(e instanceof Error ? e.message : "I'm having trouble thinking right now. Try again in a moment.");
    } finally {
      setPending(null);
      setThinking(false);
    }
  };

  if (error)
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
        <h1 className="text-card-title">You're not in this plan yet</h1>
        <p className="text-body text-muted">Open the invite link your friend sent to join.</p>
        <PrimaryPill href={`/j/${slug}`}>Join this plan</PrimaryPill>
      </main>
    );

  const done = data?.me.interviewStatus === "DONE";
  const paused = data?.circle.status === "PAUSED";
  const lastHushIdx = msgs.map((m) => m.role).lastIndexOf("HUSH");

  return (
    <main className="relative flex h-dvh flex-col">
      <FloatingHeader>
        <FloatingIconButton label="Home" href="/">
          <BackIcon />
        </FloatingIconButton>
        <BotPill />
        <div className="grow" />
        <FloatingIconButton label="Group status" href={withAs(`/c/${slug}`)}>
          <GroupIcon />
        </FloatingIconButton>
      </FloatingHeader>

      <div className="no-scrollbar flex grow flex-col gap-3 overflow-y-auto px-[18px] pb-3 pt-24">
        <div className="grow" />
        {!data && <TypingDots />}
        {msgs.map((m, i) => {
          if (m.role === "MEMBER") return <MemberBubble key={m.id}>{m.transcript ?? m.content}</MemberBubble>;
          const next = msgs[i + 1];
          const answered = next?.role === "MEMBER" ? m.options?.indexOf(next.content) ?? -1 : -1;
          const live = i === lastHushIdx && !done && !paused && !thinking;
          const options = m.options?.length ? (
            <OptionCard
              question={m.chips?.length ? undefined : m.content}
              options={m.options}
              selected={answered >= 0 ? answered : null}
              disabled={!live}
              onPick={(idx) => send({ optionIndex: idx }, m.options![idx])}
            />
          ) : null;
          if (m.chips?.length) {
            const lines = m.content.split("\n");
            const question = lines.length > 1 ? lines.pop() : undefined;
            return (
              <div key={m.id} className="flex flex-col gap-3">
                <div className="mr-[22px] flex flex-col gap-3 rounded-card bg-bubble p-[18px]">
                  <p className="text-body">{lines.join(" ")}</p>
                  <ConfirmChips chips={m.chips} />
                  {question && <p className="text-question">{question}</p>}
                </div>
                {options}
              </div>
            );
          }
          if (options) return <div key={m.id} className="flex flex-col">{options}</div>;
          return <HushBubble key={m.id}>{m.content}</HushBubble>;
        })}
        {pending && <MemberBubble>{pending}</MemberBubble>}
        {thinking && <TypingDots />}
        {trouble && (
          <div className="flex flex-col items-start gap-2">
            <HushBubble>{trouble}</HushBubble>
            <button type="button" onClick={() => send({ retry: true })} className="ml-2 text-secondary font-medium underline">
              Try again
            </button>
          </div>
        )}
        {paused && (
          <HushBubble>This one is paused for now. Some things are better worked through with a person.</HushBubble>
        )}
        <div ref={bottom} />
      </div>

      {done ? (
        <div className="flex flex-col gap-2 px-[18px] pb-[max(28px,env(safe-area-inset-bottom))] pt-2">
          <PrimaryPill href={withAs(`/c/${slug}`)}>See the group</PrimaryPill>
          <Link href={withAs(`/c/${slug}`)} className="sr-only">
            Group status
          </Link>
        </div>
      ) : (
        !paused && <Composer onSend={(t) => send({ text: t }, t)} disabled={thinking || !data} />
      )}
    </main>
  );
}
