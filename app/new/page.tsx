"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HushBubble, MemberBubble, TypingDots } from "@/components/HushBubble";
import { OptionCard } from "@/components/OptionCard";
import { Composer } from "@/components/Composer";
import { FloatingHeader } from "@/components/ScrollFade";
import { FloatingIconButton } from "@/components/FloatingIconButton";
import { BotPill } from "@/components/BotPill";
import { BackIcon } from "@/components/Icons";
import { InviteCard } from "@/components/InviteCard";
import { PrimaryPill } from "@/components/PrimaryPill";
import { api } from "@/lib/client";
import { dateLabel, etDate, nextWeekday } from "@/lib/dates";

type Step = "name" | "what" | "when" | "where" | "creating" | "done";
type Line = { from: "hush" | "me"; text: string };

const WHAT = ["Dinner", "Hangout", "Coffee or dessert", "Something active", "Something else"];
const WHERE = ["Midtown Atlanta", "Near Georgia Tech", "Downtown Atlanta", "Decatur", "Somewhere else"];

type When = { label: string; start: Date; end: Date; title: string };

function whenOptions(): When[] {
  const tomorrow = new Date(Date.now() + 86400000);
  const at = (weekday: number, startH: number, endH: number, title: string): When => {
    const { y, m, d } = nextWeekday(weekday, tomorrow);
    const start = etDate(y, m, d, startH);
    return {
      label: `${dateLabel(start, "").replace(/ · $/, "")} · ${startH >= 17 ? "evening" : "afternoon"}`,
      start,
      end: etDate(y, m, d, endH),
      title,
    };
  };
  return [at(5, 18, 23, "Friday night"), at(6, 18, 23, "Saturday night"), at(0, 12, 17, "Sunday afternoon")];
}

export default function NewPlan() {
  const [step, setStep] = useState<Step>("name");
  const [lines, setLines] = useState<Line[]>([
    { from: "hush", text: "Hi! I'm Hush. I'll check in with each friend privately, then plan something everyone can say yes to." },
    { from: "hush", text: "First, what should I call you?" },
  ]);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const data = useRef({ name: "", activity: "", when: null as When | null, area: "" });
  const whens = useMemo(whenOptions, []);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [lines, typing, step]);

  const hush = (text: string, next: Step) => {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setLines((l) => [...l, { from: "hush", text }]);
      setStep(next);
    }, 450);
  };
  const me = (text: string) => setLines((l) => [...l, { from: "me", text }]);

  const create = async () => {
    setStep("creating");
    setTyping(true);
    const d = data.current;
    try {
      const res = await api<{ slug: string }>("/api/circles", {
        method: "POST",
        body: JSON.stringify({
          organizerName: d.name,
          title: d.when!.title,
          activity: d.activity.toLowerCase(),
          area: d.area,
          windowStart: d.when!.start.toISOString(),
          windowEnd: d.when!.end.toISOString(),
        }),
      });
      setSlug(res.slug);
      setTyping(false);
      setLines((l) => [
        ...l,
        { from: "hush", text: `"${d.when!.title}" is set. Share this with your friends. I'll talk to each of them privately, and you too.` },
      ]);
      setStep("done");
    } catch (e) {
      setTyping(false);
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStep("where");
    }
  };

  const onText = (t: string) => {
    if (step === "name") {
      data.current.name = t.slice(0, 30);
      me(t);
      hush(`Nice to meet you, ${data.current.name}. What are we planning?`, "what");
    } else if (step === "what") pickWhat(t);
    else if (step === "where") pickWhere(t);
  };
  const pickWhat = (t: string) => {
    if (t === "Something else") return hush("Tell me in a few words.", "what");
    data.current.activity = t;
    me(t);
    hush("When works?", "when");
  };
  const pickWhere = (t: string) => {
    if (t === "Somewhere else") return hush("Which neighborhood or city?", "where");
    data.current.area = t;
    me(t);
    create();
  };

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
        {typing && <TypingDots />}
        {!typing && step === "what" && <OptionCard options={WHAT} onPick={(i) => pickWhat(WHAT[i])} />}
        {!typing && step === "when" && (
          <OptionCard
            options={whens.map((w) => w.label)}
            onPick={(i) => {
              data.current.when = whens[i];
              me(whens[i].label);
              hush("Which area?", "where");
            }}
          />
        )}
        {!typing && step === "where" && <OptionCard options={WHERE} onPick={(i) => pickWhere(WHERE[i])} />}
        {error && <p className="self-center text-caption text-red-700">{error}</p>}
        {step === "done" && slug && (
          <>
            <InviteCard slug={slug} title={data.current.when!.title} />
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

      {(step === "name" || step === "what" || step === "where") && (
        <Composer
          onSend={onText}
          showPlus={false}
          placeholder={step === "name" ? "Your first name" : "Or type your own"}
        />
      )}
    </main>
  );
}
