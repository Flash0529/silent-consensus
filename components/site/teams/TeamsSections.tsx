"use client";

import { AnimatePresence, motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { HushMascot } from "@/components/HushMascot";
import {
  ArrowRight,
  Briefcase,
  Calendar,
  Chart,
  Chat,
  Check,
  Chevron,
  Clock,
  Coins,
  EyeOff,
  Filter,
  Heart,
  Lock,
  MapPin,
  Scale,
  Shield,
  Sparkle,
  Users,
  Utensils,
} from "../icons";
import { EASE, Reveal, SplitWords, TileIn, useIntroDone } from "../motion";
import { Capsule, Muted, NewMarker, PillLink, SectionHeading, pillClass } from "../ui";
import { Switch } from "../friends/controls";
import { Spinner } from "../EarlyAccess";
import { EMAIL_RE, Honeypot, submitLead } from "../submitLead";
import { TEAM_SIZES } from "@/lib/teamSizes";

export function TeamsHero() {
  const ready = useIntroDone();
  return (
    <section
      data-theme-section="dark"
      className="relative overflow-hidden pb-24 pt-40 text-porcelain sm:pb-32 sm:pt-48"
      aria-label="Hush for Teams"
    >
      <div
        aria-hidden
        className="spotlight pointer-events-none absolute left-1/2 top-[78%] h-[90vmin] w-[90vmin] -translate-x-1/2 -translate-y-1/2"
      />
      <div className="relative mx-auto flex max-w-[1100px] flex-col items-center px-5 text-center sm:px-6">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={ready ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.7, ease: EASE }}
          className="flex items-center gap-2 text-product text-porcelain"
        >
          <Briefcase size={18} className="text-ash" /> Hush for Teams
        </motion.p>
        <h1 className="mt-4 max-w-[1000px] text-balance text-[52px] font-semibold leading-[1.04] tracking-[-0.9px] text-porcelain sm:text-display lg:text-display-xl">
          <SplitWords text="Team events everyone actually shows up to." delay={0.1} play={ready} />
        </h1>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={ready ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.8, ease: EASE, delay: 0.7 }}
          className="mt-6 max-w-[640px] text-pretty text-[19px] leading-[1.42] text-ash sm:text-label sm:font-normal"
        >
          Budgets, diets, faith, sobriety, access needs, caregiving schedules. The same quiet limits keep coworkers out
          of team lunches. Hush plans around them, and nobody has to email HR to explain.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={ready ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.8, ease: EASE, delay: 0.85 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Capsule>Now booking pilots</Capsule>
          <PillLink href="#pilot">Request a pilot</PillLink>
          <PillLink href="#pricing" variant="outline">
            See pricing
          </PillLink>
        </motion.div>

        <HeroThread />
      </div>
    </section>
  );
}

function HeroThread() {
  const ready = useIntroDone();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!ready || n >= 3) return;
    const t = setTimeout(() => setN((x) => x + 1), n === 0 ? 1400 : 1300);
    return () => clearTimeout(t);
  }, [n, ready]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      animate={ready ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 1.1, ease: EASE, delay: 0.6 }}
      className="relative mt-16 w-full max-w-[760px] text-left"
    >
      <div className="rounded-tile bg-carbon p-5 shadow-[inset_0_0_0_1px_var(--c-steel)] sm:p-7">
        <div className="flex items-center justify-between border-b border-steel pb-4">
          <p className="text-[15px] font-semibold text-porcelain"># design-team-lunch</p>
          <p className="text-micro text-ash">14 members</p>
        </div>
        <div className="flex min-h-[210px] flex-col gap-4 pt-5">
          <AnimatePresence initial={false}>
            {n >= 1 && (
              <Row
                key="a"
                who="Dana (Manager)"
                color="#FFE3D3"
                ink="#7A2E0E"
                text="Offsite lunch next Thursday! Any ideas?"
              />
            )}
            {n >= 2 && (
              <motion.div
                key="b"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: EASE }}
                className="flex gap-3"
              >
                <HushMascot size={34} />
                <div>
                  <p className="text-[13px] font-semibold text-porcelain">Hush</p>
                  <p className="text-[15px] text-ash">
                    I&apos;ll check in with each of you privately and come back with one plan that works for everyone.
                  </p>
                </div>
              </motion.div>
            )}
            {n >= 3 && (
              <motion.div
                key="c"
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="ml-[46px] rounded-media bg-obsidian p-4 text-porcelain"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-product">Mediterranean lunch, Thursday 12:30</p>
                  <span className="shrink-0 text-micro font-semibold text-[#30d158]">13 of 14 in</span>
                </div>
                <p className="mt-1.5 text-body-sm text-ash">
                  Within the team spend cap · Step-free · Halal and vegan options · No bar
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function Row({ who, color, ink, text }: { who: string; color: string; ink: string; text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
      className="flex gap-3"
    >
      <span
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-[14px] font-semibold"
        style={{ background: color, color: ink }}
      >
        {who[0]}
      </span>
      <div>
        <p className="text-[13px] font-semibold text-porcelain">{who}</p>
        <p className="text-[15px] text-ash">{text}</p>
      </div>
    </motion.div>
  );
}

const CASES = [
  {
    icon: Utensils,
    title: "Team lunches and offsites",
    body: "One plan that fits every budget, diet and access need. Nobody has to explain themselves to get a seat at the table.",
  },
  {
    icon: Sparkle,
    title: "New hire onboarding",
    body: "Hush asks new teammates what works for them, then plans their first team hangout around it.",
  },
  {
    icon: MapPin,
    title: "Hybrid and remote meetups",
    body: "Finds the time and place that work across schedules, time zones and commutes.",
  },
  {
    icon: Scale,
    title: "Keeping it professional",
    body: "Hush reads a message before coworkers do and privately suggests a calmer rewrite. Repeated overrides can go to a manager, if your company turns that on.",
  },
];

export function UseCases() {
  const track = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.8, 440), behavior: "smooth" });
  };
  return (
    <section data-theme-section="dark" id="use-cases" className="scroll-mt-28 py-28 sm:py-36" aria-label="Use cases">
      <div className="mx-auto max-w-[1100px] px-5 sm:px-6">
        <div className="flex items-end justify-between gap-6">
          <SectionHeading eyebrow="Use cases" title="Get to know Hush at work." />
          <div className="hidden gap-2 sm:flex">
            <button
              type="button"
              aria-label="Previous"
              onClick={() => scroll(-1)}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-steel/70 text-porcelain transition hover:bg-steel"
            >
              <Chevron size={20} className="rotate-180" />
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={() => scroll(1)}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-steel/70 text-porcelain transition hover:bg-steel"
            >
              <Chevron size={20} />
            </button>
          </div>
        </div>
      </div>
      <div
        ref={track}
        className="no-scrollbar mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-[max(1.25rem,calc((100vw_-_1100px)/2_+_1.25rem))] pb-4 scroll-px-[max(1.25rem,calc((100vw_-_1100px)/2_+_1.25rem))] sm:px-[max(1.5rem,calc((100vw_-_1100px)/2_+_1.5rem))] sm:scroll-px-[max(1.5rem,calc((100vw_-_1100px)/2_+_1.5rem))]"
      >
        {CASES.map((c, i) => (
          <Reveal key={c.title} delay={i * 0.08} className="snap-start">
            <article className="group flex h-[460px] w-[300px] flex-col rounded-tile bg-carbon p-8 transition-transform duration-500 hover:-translate-y-1.5 sm:w-[372px]">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-obsidian text-porcelain">
                <c.icon size={22} />
              </span>
              <h3 className="mt-auto text-stat leading-[1.1] text-porcelain">{c.title}</h3>
              <p className="mt-3 text-lead text-ash">{c.body}</p>
            </article>
          </Reveal>
        ))}
        <div className="w-1 shrink-0" aria-hidden />
      </div>
    </section>
  );
}

const BENEFITS = [
  { icon: Users, t: "Higher turnout", b: "Events built around real limits mean fewer quiet no-shows." },
  {
    icon: Heart,
    t: "Inclusion without paperwork",
    b: "Diet, faith, sobriety and access handled privately. No form for a team lunch.",
  },
  {
    icon: Chat,
    t: "Stronger ties across teams",
    b: "Easier plans mean more of the casual time where trust gets built.",
  },
  { icon: Scale, t: "Less friction, earlier", b: "Mediation catches small conflicts before they escalate." },
  { icon: Clock, t: "Hours back for organizers", b: "No more polls, spreadsheets and dietary reply-all threads." },
  { icon: Shield, t: "Privacy employees trust", b: "Admins see participation. Never personal answers." },
];

const TODAY = [
  { icon: Briefcase, t: "Sign in with your work email", b: "People join your company automatically by email domain. Admins manage people, roles and company-wide policies on one page." },
  { icon: Calendar, t: "Meetings and action items, automatically", b: "Hush notices meetings, action items (with owners and due dates) and decisions as your team chats, with Outlook and Google Calendar links." },
  { icon: Clock, t: "Scheduling, privately", b: "Hush asks each person in their own Hush chat, checks linked calendars (busy/free only), and proposes one time everyone confirms before it's posted." },
  { icon: Filter, t: "Tone check before sending", b: "Rude, blaming or ALL-CAPS messages get a private suggested rewrite first. Only the sender sees it. On or off for the whole company." },
  { icon: Shield, t: "Manager review, if you want it", b: "Off by default. When on, someone who sends flagged messages anyway 3 times in a week is reviewed by their manager (HR for serious content). They're always warned first." },
  { icon: Lock, t: "Private by design", b: "Private Hush chats are never shown to anyone, including admins. Files are deleted after 7 days and Hush can't read them unless the sender says yes." },
];

/** What Hush for Teams does today (every item here is live in the web app). */
export function Capabilities() {
  return (
    <section data-theme-section="dark" id="capabilities" className="py-24 sm:py-32" aria-label="What Hush for Teams does today">
      <div className="mx-auto max-w-[1100px] px-5 sm:px-6">
        <SectionHeading
          eyebrow="Live today"
          title={
            <>
              Everything below works now. <Muted>Try it with the demo company.</Muted>
            </>
          }
          sub="On the login page, open the work sign-in and tap “Use the demo company” to explore Northwind Studio as its admin."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TODAY.map((c, i) => (
            <Reveal key={c.t} delay={0.05 * i}>
              <div className="h-full rounded-tile bg-graphite p-6 shadow-[inset_0_0_0_1px_var(--c-keyline)]">
                <c.icon size={22} className="text-link" />
                <h3 className="mt-4 text-label text-porcelain">{c.t}</h3>
                <p className="mt-2 text-lead text-ash">{c.b}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <PillLink href="/login?business=1">Try the demo company</PillLink>
          <a href="#pilot" className={pillClass("outline")}>
            Request a pilot
          </a>
        </div>
      </div>
    </section>
  );
}

export function Benefits() {
  return (
    <section data-theme-section="carbon" className="py-36 sm:py-44" aria-label="Benefits">
      <div className="mx-auto max-w-[1100px] px-5 sm:px-6">
        <SectionHeading
          center
          eyebrow="Why teams choose Hush"
          title="Good for people. Good for the business."
          sub="Track what matters in a pilot: event turnout, repeat attendance, organizer hours saved and conflicts resolved early."
        />
        <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b, i) => (
            <TileIn key={b.t} index={i % 3}>
              <div className="h-full rounded-tile bg-obsidian p-7 sm:p-8">
                <b.icon size={26} className="text-porcelain" />
                <h3 className="mt-5 text-label text-porcelain">{b.t}</h3>
                <p className="mt-2 text-lead text-ash">{b.b}</p>
              </div>
            </TileIn>
          ))}
        </div>
      </div>
    </section>
  );
}

const MONTHS = [
  { m: "Jan", v: 58 },
  { m: "Feb", v: 64 },
  { m: "Mar", v: 71 },
  { m: "Apr", v: 77 },
  { m: "May", v: 83 },
  { m: "Jun", v: 88 },
];

const HIDDEN = [
  "Individual answers",
  "Budgets and limits",
  "Who chipped in",
  "Diet, faith and health needs",
  "Private chats with Hush",
];

export function Dashboard() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -20% 0px" });
  return (
    <section
      data-theme-section="dark"
      id="dashboard"
      className="scroll-mt-28 py-28 text-porcelain sm:py-36"
      aria-label="What admins see"
    >
      <div className="mx-auto max-w-[1100px] px-5 sm:px-6">
        <SectionHeading
          eyebrow="Admin view"
          title={
            <>
              What admins see. <Muted>And what they never will.</Muted>
            </>
          }
          sub="The People team gets participation and plan counts. Nothing anyone told Hush ever reaches a dashboard."
        />
        <div ref={ref} className="mt-14 grid gap-3 rounded-tile bg-carbon p-3 sm:p-4 lg:grid-cols-[1.4fr_1fr]">
          <Reveal>
            <div className="rounded-tile bg-obsidian p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-[15px] font-semibold text-porcelain">
                  <Chart size={18} /> Team events · Design org
                </p>
                <span className="text-micro font-semibold text-amber">Sample data</span>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3">
                {[
                  ["Plans made", "24"],
                  ["People joined", "112"],
                  ["Resolved early", "3"],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-media bg-carbon p-4">
                    <p className="text-micro text-ash">{l}</p>
                    <p className="mt-2 text-stat tabular-nums text-porcelain">{v}</p>
                  </div>
                ))}
              </div>
              <p className="mt-7 text-micro text-ash">Participation rate</p>
              <div
                className="mt-3 flex h-[180px] items-end gap-3"
                role="img"
                aria-label="Sample participation rising from 58% in January to 88% in June"
              >
                {MONTHS.map((d, i) => (
                  <div key={d.m} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                    <div className="flex w-full flex-1 items-end pt-6">
                      <motion.div
                        className="relative w-full rounded-t-md bg-porcelain"
                        initial={{ height: 0 }}
                        animate={{ height: seen ? `${d.v}%` : 0 }}
                        transition={{ duration: 0.9, ease: EASE, delay: 0.1 * i }}
                      >
                        <span className="absolute inset-x-0 -top-5 text-center text-micro tabular-nums text-ash">
                          {d.v}%
                        </span>
                      </motion.div>
                    </div>
                    <span className="text-micro text-ash">{d.m}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="h-full rounded-tile bg-obsidian p-6 sm:p-8">
              <p className="flex items-center gap-2 text-[15px] font-semibold text-porcelain">
                <EyeOff size={18} /> Never visible to admins
              </p>
              <ul className="mt-6 flex flex-col gap-3">
                {HIDDEN.map((h, i) => (
                  <motion.li
                    key={h}
                    initial={{ opacity: 0, x: 12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.08, duration: 0.5, ease: EASE }}
                    className="flex items-center justify-between gap-4 rounded-media bg-carbon px-4 py-3.5"
                  >
                    <span className="text-[16px] text-porcelain">{h}</span>
                    <span className="h-3 w-20 shrink-0 rounded-full bg-steel blur-[2px]" aria-hidden />
                  </motion.li>
                ))}
              </ul>
              <p className="mt-6 flex items-start gap-2 text-body-sm text-ash">
                <Lock size={16} className="mt-0.5 shrink-0" />
                Personal and work profiles stay separate. Each person chooses which limits apply in work groups.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

const HEATED = "if someone takes my lunch from the fridge one more time I'm going to lose it";
const CALM = "Food keeps going missing from the shared fridge. Could we try labels?";

export function WorkFilter() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -25% 0px" });
  const [typed, setTyped] = useState(0);
  const [choice, setChoice] = useState<"use" | "edit" | "private" | null>(null);

  useEffect(() => {
    if (!seen || typed >= HEATED.length) return;
    const t = setTimeout(() => setTyped((n) => n + 1), 28);
    return () => clearTimeout(t);
  }, [seen, typed]);
  const done = typed >= HEATED.length;

  return (
    <section
      data-theme-section="dark"
      id="filter"
      className="scroll-mt-28 py-28 sm:py-36"
      aria-label="Work-friendly filter"
    >
      <div className="mx-auto grid max-w-[1100px] items-center gap-14 px-5 sm:px-6 lg:grid-cols-2">
        <div>
          <Reveal>
            <NewMarker>Coming next</NewMarker>
          </Reveal>
          <div className="mt-4">
            <SectionHeading
              eyebrow="Work-friendly filter"
              title="Keeps it professional. Privately."
              sub="Heated but with a real point? Hush nudges privately and suggests a rephrase. Nothing to rephrase? It redirects back to the plan. Real safety concerns always go to private support resources."
            />
          </div>
          <Reveal delay={0.2}>
            <ul className="mt-8 flex flex-col gap-3 text-lead text-porcelain">
              {[
                "Nudges are always private. No public call-outs.",
                "Filtered content never reaches the plan or the group.",
                "Always on in Teams workspaces.",
              ].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-steel text-porcelain">
                    <Check size={13} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <div ref={ref} className="rounded-tile bg-carbon p-5 sm:p-7">
            <p className="flex items-center gap-2 text-micro font-medium text-ash">
              <Lock size={13} /> Your private chat with Hush
            </p>
            <div className="mt-5 flex flex-col gap-3">
              <div className="ml-auto max-w-[85%] rounded-[20px] bg-porcelain px-4 py-3 text-[15px] leading-snug text-obsidian">
                {HEATED.slice(0, typed)}
                {!done && (
                  <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-obsidian" />
                )}
              </div>
              <AnimatePresence>
                {done && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: EASE, delay: 0.4 }}
                    className="flex gap-2.5"
                  >
                    <HushMascot size={30} />
                    <div className="max-w-[88%] rounded-[20px] bg-obsidian p-4">
                      <p className="text-[15px] text-porcelain">
                        Let&apos;s keep it work friendly. Want me to put it like this?
                      </p>
                      <p className="mt-3 rounded-xl bg-carbon px-3.5 py-2.5 text-[15px] font-medium text-porcelain">
                        “{CALM}”
                      </p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-body-sm font-medium">
                        <button
                          type="button"
                          onClick={() => setChoice("use")}
                          className={`h-10 cursor-pointer rounded-xl transition ${choice === "use" ? "bg-porcelain text-obsidian" : "bg-steel text-porcelain hover:bg-[#424245]"}`}
                        >
                          Use this
                        </button>
                        <button
                          type="button"
                          onClick={() => setChoice("edit")}
                          className={`h-10 cursor-pointer rounded-xl transition ${choice === "edit" ? "bg-porcelain text-obsidian" : "bg-steel text-porcelain hover:bg-[#424245]"}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setChoice("private")}
                          className={`h-10 cursor-pointer rounded-xl transition ${choice === "private" ? "bg-porcelain text-obsidian" : "bg-steel text-porcelain hover:bg-[#424245]"}`}
                        >
                          Keep private
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence mode="wait">
                {choice && (
                  <motion.p
                    key={choice}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="ml-10 flex items-center gap-2 text-body-sm text-ash"
                    role="status"
                  >
                    <Check size={15} className="text-[#30d158]" />
                    {
                      {
                        use: "Shared with the team, without your name on it.",
                        edit: "Tweak the wording. Nothing is shared until you say so.",
                        private: "Kept between you and Hush.",
                      }[choice]
                    }
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Policy() {
  const [cap, setCap] = useState(35);
  const [approved, setApproved] = useState(true);
  const [sync, setSync] = useState(true);
  return (
    <section data-theme-section="carbon" className="py-36 sm:py-44" aria-label="Policy controls">
      <div className="mx-auto grid max-w-[1100px] items-center gap-14 px-5 sm:px-6 lg:grid-cols-2">
        <Reveal className="order-2 lg:order-1">
          <div className="rounded-tile bg-obsidian p-6 sm:p-8">
            <p className="text-micro font-semibold uppercase tracking-[0.12em] text-ash">Workspace policy</p>
            <div className="mt-6">
              <div className="flex items-baseline justify-between">
                <label htmlFor="cap" className="text-[16px] font-medium text-porcelain">
                  Spend cap per person
                </label>
                <span className="text-stat tabular-nums text-porcelain">${cap}</span>
              </div>
              <input
                id="cap"
                type="range"
                min={10}
                max={100}
                step={5}
                value={cap}
                onChange={(e) => setCap(Number(e.target.value))}
                className="qc-range mt-3 w-full cursor-pointer"
                style={{ "--pct": `${((cap - 10) / 90) * 100}%` } as React.CSSProperties}
              />
            </div>
            <div className="mt-4 divide-y divide-steel">
              <div className="py-2">
                <Switch
                  checked={approved}
                  onChange={setApproved}
                  label="Approved venues only"
                  sub="Pick from your company's list."
                />
              </div>
              <div className="py-2">
                <Switch
                  checked={sync}
                  onChange={setSync}
                  label="Calendar sync"
                  sub="Find times that are actually free."
                />
              </div>
              <div className="flex min-h-12 items-center justify-between gap-4 py-3">
                <span>
                  <span className="block text-[16px] font-medium text-porcelain">Work-friendly filter</span>
                  <span className="block text-body-sm text-ash">Always on in Teams workspaces.</span>
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-carbon px-3 py-1.5 text-micro font-medium text-ash">
                  <Lock size={13} /> Locked on
                </span>
              </div>
            </div>
            <div className="mt-4 rounded-media bg-carbon p-4 text-body-sm text-porcelain">
              Next plan: under ${cap} a head{approved ? ", from approved venues" : ""}
              {sync ? ", during everyone's free time" : ""}.
            </div>
          </div>
        </Reveal>
        <div className="order-1 lg:order-2">
          <SectionHeading
            eyebrow="Controls"
            title="Your policy. Everyone's limits."
            sub="Set spend caps and approved venues once. Hush plans inside company policy and inside each person's private limits, at the same time."
          />
          <Reveal delay={0.2}>
            <div className="mt-8 flex flex-wrap gap-2 text-body-sm font-medium">
              {[
                [Calendar, "Calendar sync"],
                [Coins, "Spend caps"],
                [MapPin, "Approved venues"],
                [Filter, "Work-friendly filter"],
                [Chat, "Slack and Teams app"],
              ].map(([I, t]) => {
                const Icon = I as typeof Calendar;
                return (
                  <span
                    key={t as string}
                    className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-porcelain shadow-[inset_0_0_0_1px_#6e6e73]"
                  >
                    <Icon size={15} className="text-ash" /> {t as string}
                  </span>
                );
              })}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

const PLANS = [
  {
    name: "Friends",
    price: "Free",
    per: "forever",
    blurb: "For friend groups, roommates and clubs.",
    features: ["Private planning in your Hush chat", "Quiet chip-in (Stripe)", "Make Hush yours", "Real places, events and calendars"],
    cta: { label: "Log in / Sign up", href: "/login" },
  },
  {
    name: "Team",
    price: "Pilot",
    per: "per seat, per month",
    blurb: "For teams that want every event to include everyone.",
    features: [
      "Everything in Friends",
      "Company sign-in and admin page",
      "Meetings and action items, automatically",
      "Tone check before sending",
      "Manager review (opt-in)",
    ],
    cta: { label: "Request a pilot", href: "#pilot" },
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    per: "annual",
    blurb: "For organizations with policy and compliance needs.",
    features: [
      "Everything in Team",
      "SSO (Microsoft 365, Google Workspace)",
      "Retention and audit controls",
      "Slack and Teams apps",
      "People team dashboard (counts only)",
    ],
    cta: { label: "Talk to us", href: "#pilot" },
  },
];

export function Pricing() {
  return (
    <section data-theme-section="light" id="pricing" className="scroll-mt-10 py-28 sm:py-40" aria-label="Pricing">
      <div className="mx-auto max-w-[1100px] px-5 sm:px-6">
        <SectionHeading
          center
          eyebrow="Pricing"
          title="Start with friends. Bring it to work."
          sub="Free for your personal life. Team pricing is being set with our first pilot partners."
        />
        <div className="mt-14 grid gap-3 lg:grid-cols-3">
          {PLANS.map((p, i) => (
            <TileIn key={p.name} index={i}>
              <div
                className={`relative flex h-full flex-col rounded-tile p-8 ${
                  p.featured ? "theme-dark bg-black text-porcelain" : "bg-obsidian text-porcelain"
                }`}
              >
                {p.featured && (
                  <span className="absolute right-8 top-8 text-micro font-semibold text-amber">Now booking</span>
                )}
                <p className={`text-product text-ash`}>{p.name}</p>
                <p className="mt-4 text-display-sm leading-none">{p.price}</p>
                <p className={`mt-2 text-body-sm text-ash`}>{p.per}</p>
                <p className={`mt-5 text-lead text-ash`}>{p.blurb}</p>
                <ul className="mt-6 flex flex-col gap-3 text-[15px]">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check size={17} className={`mt-0.5 shrink-0 text-porcelain`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-8">
                  <a href={p.cta.href} className={`${pillClass(p.featured ? "blue" : "outline")} w-full`}>
                    {p.cta.label} <ArrowRight size={17} />
                  </a>
                </div>
              </div>
            </TileIn>
          ))}
        </div>
      </div>
    </section>
  );
}

type TeamSize = (typeof TEAM_SIZES)[number];

export function PilotForm() {
  const [form, setForm] = useState({ name: "", email: "", company: "", size: "" as TeamSize | "" });
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const err: Record<string, string> = {};
    if (!form.name.trim()) err.name = "Add your name";
    if (!EMAIL_RE.test(form.email.trim())) err.email = "Enter a work email like you@company.com";
    if (!form.company.trim()) err.company = "Add your company";
    if (!form.size) err.size = "Pick a team size";
    setErrors(err);
    if (Object.keys(err).length || !form.size) return;
    setSending(true);
    const failed = await submitLead({
      kind: "PILOT",
      name: form.name.trim(),
      email: form.email.trim(),
      company: form.company.trim(),
      teamSize: form.size,
      source: "teams",
      website,
    });
    setSending(false);
    if (failed) {
      setErrors({ form: failed });
      return;
    }
    setDone(true);
  };

  const input = (k: keyof typeof form, label: string, type = "text", autoComplete?: string) => (
    <div>
      <label htmlFor={`p-${k}`} className="text-body-sm font-medium text-porcelain">
        {label}
      </label>
      <input
        id={`p-${k}`}
        type={type}
        autoComplete={autoComplete}
        value={form[k]}
        onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
        aria-invalid={!!errors[k]}
        aria-describedby={errors[k] ? `p-${k}-err` : undefined}
        className="mt-1.5 h-12 w-full rounded-media bg-porcelain/[.04] px-4 text-lead text-porcelain shadow-[inset_0_0_0_1px_#6e6e73] outline-offset-1 transition placeholder:text-slate focus:outline focus:outline-1 focus:outline-galaxy"
      />
      {errors[k] && (
        <p id={`p-${k}-err`} className="mt-1.5 text-micro text-[#ff6961]">
          {errors[k]}
        </p>
      )}
    </div>
  );

  return (
    <section
      data-theme-section="dark"
      id="pilot"
      className="relative scroll-mt-10 overflow-hidden py-28 text-porcelain sm:py-36"
      aria-label="Request a pilot"
    >
      <div className="relative mx-auto grid max-w-[1100px] gap-14 px-5 sm:px-6 lg:grid-cols-2">
        <SectionHeading
          eyebrow="Pilot program"
          title={
            <>
              Bring Hush to your team. <Muted>Shape it with us.</Muted>
            </>
          }
          sub="We're partnering with People teams, employee resource groups and campus orgs to shape Hush for Teams. Tell us a little about yours."
        />
        <Reveal delay={0.1}>
          <div className="rounded-tile bg-carbon p-6 sm:p-8">
            <AnimatePresence mode="wait" initial={false}>
              {done ? (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex min-h-[360px] flex-col items-center justify-center text-center"
                  role="status"
                >
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-[#30d158] text-black"
                  >
                    <Check size={30} />
                  </motion.span>
                  <p className="mt-5 text-stat text-porcelain">Thanks, {form.name.split(" ")[0]}.</p>
                  <p className="mt-2 max-w-[320px] text-lead text-ash">
                    We&apos;ll reach out to {form.email} about a pilot for {form.company}.
                  </p>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  onSubmit={submit}
                  noValidate
                  exit={{ opacity: 0 }}
                  className="relative flex flex-col gap-4"
                  aria-busy={sending}
                >
                  <Honeypot value={website} onChange={setWebsite} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    {input("name", "Your name", "text", "name")}
                    {input("company", "Company", "text", "organization")}
                  </div>
                  {input("email", "Work email", "email", "email")}
                  <fieldset>
                    <legend className="text-body-sm font-medium text-porcelain">Team size</legend>
                    <div
                      className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4"
                      role="radiogroup"
                      aria-label="Team size"
                    >
                      {TEAM_SIZES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          role="radio"
                          aria-checked={form.size === s}
                          onClick={() => setForm((f) => ({ ...f, size: s }))}
                          className={`h-11 cursor-pointer rounded-full text-body-sm font-medium transition ${
                            form.size === s
                              ? "bg-porcelain text-obsidian"
                              : "text-porcelain shadow-[inset_0_0_0_1px_#6e6e73] hover:bg-porcelain/[.08]"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    {errors.size && <p className="mt-1.5 text-micro text-[#ff6961]">{errors.size}</p>}
                  </fieldset>
                  {errors.form && (
                    <p className="text-body-sm text-[#ff6961]" role="alert">
                      {errors.form}
                    </p>
                  )}
                  <button type="submit" disabled={sending} className={`${pillClass("blue")} mt-2 w-full`}>
                    {sending ? (
                      <>
                        <Spinner /> Sending
                      </>
                    ) : (
                      <>
                        Request a pilot <ArrowRight size={17} />
                      </>
                    )}
                  </button>
                  <p className="text-center text-micro text-ash">
                    We&apos;ll only use this to contact you about the pilot.
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
