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

type Step = "name" | "mode" | "what" | "when" | "where" | "topic" | "checkin" | "creating" | "done";
type Line = { from: "hush" | "me"; text: string };

const MODES = ["Plan a hangout", "Work through a disagreement"];
const TOPICS = ["The apartment", "The group trip", "Money stuff", "Something else"];
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

function checkinOptions(): When[] {
  return [3, 7, 14].map((days) => {
    const t = new Date(Date.now() + days * 86400000);
    const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" })
      .format(t)
      .split("-")
      .map(Number);
    const start = etDate(y, m, d, 19);
    return {
      label: `${days === 3 ? "In 3 days" : days === 7 ? "In a week" : "In two weeks"} (${dateLabel(start, "")})`,
      start,
      end: etDate(y, m, d, 21),
      title: "",
    };
  });
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
  const data = useRef({ name: "", kind: "PLAN" as "PLAN" | "MEDIATE", activity: "", topic: "", when: null as When | null, area: "" });
  const whens = useMemo(whenOptions, []);
  const checkins = useMemo(checkinOptions, []);
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
          kind: d.kind,
          topic: d.kind === "MEDIATE" ? d.topic : undefined,
          title: d.kind === "MEDIATE" ? d.topic : d.when!.title,
          activity: d.kind === "MEDIATE" ? "conversation" : d.activity.toLowerCase(),
          area: d.area,
          windowStart: d.when!.start.toISOString(),
          windowEnd: d.when!.end.toISOString(),
        }),
      });
      setSlug(res.slug);
      setTyping(false);
      setLines((l) => [
        ...l,
        {
          from: "hush",
          text:
            d.kind === "MEDIATE"
              ? `"${d.topic}" is set. Share this with everyone involved. I'll hear each side privately, including yours, and never quote anyone.`
              : `"${d.when!.title}" is set. Share this with your friends. I'll talk to each of them privately, and you too.`,
        },
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
      hush(`Nice to meet you, ${data.current.name}. What can I help with?`, "mode");
    } else if (step === "what") pickWhat(t);
    else if (step === "where") pickWhere(t);
    else if (step === "topic") pickTopic(t);
  };
  const pickMode = (i: number) => {
    me(MODES[i]);
    if (i === 0) {
      data.current.kind = "PLAN";
      hush("What are we planning?", "what");
    } else {
      data.current.kind = "MEDIATE";
      hush("What should we call it? Keep it neutral, so no one feels singled out.", "topic");
    }
  };
  const pickTopic = (t: string) => {
    if (t === "Something else") return hush("Type a short, neutral name.", "topic");
    data.current.topic = t.slice(0, 60);
    me(t);
    hush("When should everyone have a way forward by?", "checkin");
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
        {!typing && step === "mode" && <OptionCard options={MODES} onPick={pickMode} />}
        {!typing && step === "topic" && <OptionCard options={TOPICS} onPick={(i) => pickTopic(TOPICS[i])} />}
        {!typing && step === "checkin" && (
          <OptionCard
            options={checkins.map((w) => w.label)}
            onPick={(i) => {
              data.current.when = checkins[i];
              me(checkins[i].label);
              create();
            }}
          />
        )}
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
            <InviteCard slug={slug} title={data.current.kind === "MEDIATE" ? data.current.topic : data.current.when!.title} />
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

      {(step === "name" || step === "what" || step === "where" || step === "topic") && (
        <Composer
          onSend={onText}
          showPlus={false}
          placeholder={step === "name" ? "Your first name" : step === "topic" ? "Or type a name" : "Or type your own"}
        />
      )}
    </main>
  );
}
