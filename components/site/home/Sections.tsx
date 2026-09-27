"use client";

import Link from "next/link";
import { motion, type MotionValue } from "framer-motion";
import { ArrowRight, Briefcase, Chat, Check, Chevron, Coins, EyeOff, Phone, Shield, Users } from "../icons";
import {
  CountUp,
  EASE,
  mix,
  Parallax,
  ramp,
  Reveal,
  ScrollLitText,
  TileIn,
  useDerived,
  useTileProgress,
} from "../motion";
import { Avatar, FRIENDS, Muted, NewMarker, Panel, SectionHeading } from "../ui";

export function Problem() {
  return (
    <section data-theme-section="dark" className="py-28 sm:py-40" aria-label="The problem">
      <div className="mx-auto max-w-[980px] px-5 sm:px-6">
        <Reveal>
          <p className="text-product text-ash">The quiet problem</p>
        </Reveal>
        <ScrollLitText
          className="mt-5 text-[34px] font-semibold leading-[1.12] tracking-[-0.4px] text-porcelain sm:text-display-sm lg:text-display-md"
          text="Group chats plan for the loudest person. Everyone else just says “I’m busy.” It’s easier than admitting it’s too expensive, that they don’t drink, or that the place has stairs. So they quietly drift away."
        />
      </div>
    </section>
  );
}

type Viz =
  | { kind: "bar"; value: number }
  | { kind: "people"; total: number; lit: number }
  | { kind: "compare"; from: { label: string; value: number }; to: { label: string; value: number } };

const STATS: {
  n: number;
  prefix?: string;
  suffix?: string;
  label: string;
  src: string;
  href: string;
  viz: Viz;
}[] = [
  {
    n: 67,
    suffix: "%",
    label: "of Americans declined social events in the past two years mainly because of cost.",
    src: "CFP Board, 2026",
    href: "https://www.cfp.net/news/2026/03/financial-fomo-quietly-straining-american-relationships",
    viz: { kind: "bar", value: 67 },
  },
  {
    n: 56,
    suffix: "%",
    label: "of them never told the people they love that money was the reason.",
    src: "CFP Board, 2026",
    href: "https://www.cfp.net/news/2026/03/financial-fomo-quietly-straining-american-relationships",
    viz: { kind: "bar", value: 56 },
  },
  {
    n: 6,
    prefix: "1 in ",
    label: "people worldwide are affected by loneliness, linked to 871,000 deaths a year.",
    src: "WHO, 2025",
    href: "https://who.int/news/item/30-06-2025-social-connection-linked-to-improved-heath-and-reduced-risk-of-early-death",
    viz: { kind: "people", total: 6, lit: 1 },
  },
  {
    n: 12,
    suffix: "%",
    label: "of Americans reported having no close friends in 2021, up from 3% in 1990.",
    src: "Survey Center on American Life",
    href: "https://www.americansurveycenter.org/research/the-state-of-american-friendship-change-challenges-and-loss/",
    viz: { kind: "compare", from: { label: "1990", value: 3 }, to: { label: "2021", value: 12 } },
  },
];

export function Stats() {
  return (
    <section data-theme-section="carbon" className="py-32 sm:py-44" aria-label="Why it matters">
      <div className="mx-auto max-w-[1100px] px-5 sm:px-6">
        <SectionHeading
          eyebrow="Why it matters"
          title={
            <>
              Money is the reason. <Muted>Nobody says it out loud.</Muted>
            </>
          }
        />
        <div className="mt-14 grid gap-3 sm:grid-cols-2">
          {STATS.map((s, i) => (
            <TileIn key={s.label} index={i % 2} innerClassName="flex flex-col rounded-tile bg-obsidian p-7 sm:p-10">
              <p className="text-[56px] font-semibold leading-none tracking-[-0.84px] text-porcelain sm:text-display">
                <CountUp to={s.n} prefix={s.prefix} suffix={s.suffix} className="tabular-nums" />
              </p>
              <StatViz viz={s.viz} />
              <p className="mt-5 max-w-[440px] text-lead text-ash">{s.label}</p>
              <a
                href={s.href}
                target="_blank"
                rel="noreferrer"
                className="mt-auto inline-flex items-center gap-0.5 pt-4 text-micro text-link hover:underline"
              >
                Source: {s.src} <Chevron size={12} />
              </a>
            </TileIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Tiny chart inside each stat box, drawn as the box assembles. */
function StatViz({ viz }: { viz: Viz }) {
  const p = useTileProgress();
  const grow = useDerived(p, (v) => ramp(v, 0.35, 1), []);
  const width = useDerived(p, (v) => `${(viz.kind === "bar" ? viz.value : 0) * ramp(v, 0.35, 1)}%`, [viz]);

  if (viz.kind === "bar")
    return (
      <div className="mt-6" aria-hidden>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-steel">
          <motion.div className="h-full rounded-full bg-porcelain" style={{ width }} />
        </div>
      </div>
    );

  if (viz.kind === "people")
    return (
      <div className="mt-6 flex items-end gap-2.5" aria-hidden>
        {Array.from({ length: viz.total }).map((_, i) => (
          <Person key={i} i={i} lit={i < viz.lit} p={p} />
        ))}
      </div>
    );

  const max = Math.max(viz.from.value, viz.to.value);
  return (
    <div className="mt-6 flex flex-col gap-2" aria-hidden>
      {[viz.from, viz.to].map((row, i) => (
        <div key={row.label} className="flex items-center gap-3 text-micro text-ash">
          <span className="w-9 tabular-nums">{row.label}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-steel">
            <motion.div
              className={`h-full rounded-full ${i === 1 ? "bg-porcelain" : "bg-ash"}`}
              style={{ width: row.value === max ? "100%" : `${(row.value / max) * 100}%`, scaleX: grow, originX: 0 }}
            />
          </div>
          <span className="w-8 text-right tabular-nums">{row.value}%</span>
        </div>
      ))}
    </div>
  );
}

function Person({ i, lit, p }: { i: number; lit: boolean; p: MotionValue<number> }) {
  const a = 0.3 + i * 0.07;
  const opacity = useDerived(p, (v) => mix(0.15, lit ? 1 : 0.45, ramp(v, a, a + 0.15)), [a, lit]);
  const y = useDerived(p, (v) => 10 * (1 - ramp(v, a, a + 0.15)), [a]);
  return (
    <motion.svg
      width="22"
      height="30"
      viewBox="0 0 22 30"
      style={{ opacity, y }}
      className={lit ? "text-porcelain" : "text-ash"}
    >
      <circle cx="11" cy="7" r="5.5" fill="currentColor" />
      <path d="M2 30c0-7 4-11.5 9-11.5S20 23 20 30z" fill="currentColor" />
    </motion.svg>
  );
}

export function Privacy() {
  return (
    <section data-theme-section="dark" className="py-28 sm:py-36" aria-label="Privacy">
      <div className="mx-auto max-w-[1100px] px-5 sm:px-6">
        <SectionHeading
          eyebrow="Privacy"
          title={
            <>
              Private by design. <Muted>Not by promise.</Muted>
            </>
          }
          sub="Hush plans around what people can’t say out loud, so it was built from day one to never repeat it."
        />
        <Panel className="mt-14">
          <div className="grid gap-3 md:grid-cols-6">
            <TileIn index={0} className="md:col-span-4" innerClassName={TILE}>
              <TileHead icon={<EyeOff size={20} />} title="Never whose limit was whose.">
                The group sees one plan and a neutral reason it works. Nobody sees what anyone told Hush.
              </TileHead>
              <Converge />
            </TileIn>
            <TileIn index={1} className="md:col-span-2" innerClassName={TILE}>
              <TileHead icon={<Shield size={20} />} title="A leak guard reads every line.">
                Rules plus an AI judge check each sentence the group will see.
              </TileHead>
              <LeakGuard />
            </TileIn>
            <TileIn index={0} className="md:col-span-2" innerClassName={TILE}>
              <TileHead icon={<Coins size={20} />} title="Chip in without a trace.">
                Friends with room can cover a gap. No one sees who gave or who was helped.
              </TileHead>
              <QuietPool />
            </TileIn>
            <TileIn index={1} className="md:col-span-2" innerClassName={TILE}>
              <TileHead icon={<Chat size={20} />} title="No quotes. Ever.">
                In mediation, Hush proposes a way forward without repeating anyone&apos;s words.
              </TileHead>
              <Redaction />
            </TileIn>
            <TileIn index={2} className="md:col-span-2" innerClassName={TILE}>
              <TileHead icon={<Phone size={20} />} title="Join with a link. Leave anytime.">
                No sign-up to join a plan. Your standing preferences are yours to edit or delete.
              </TileHead>
              <JoinLink />
            </TileIn>
          </div>
        </Panel>
      </div>
    </section>
  );
}

const TILE = "flex flex-col rounded-tile bg-obsidian p-7 sm:p-8";

function TileHead({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  const p = useTileProgress();
  const scale = useDerived(p, (v) => mix(0.4, 1, ramp(v, 0.25, 0.6)), []);
  const rotate = useDerived(p, (v) => mix(-45, 0, ramp(v, 0.25, 0.6)), []);
  return (
    <>
      <motion.span
        className="flex h-10 w-10 items-center justify-center rounded-full bg-carbon text-porcelain"
        style={{ scale, rotate }}
      >
        {icon}
      </motion.span>
      <h3 className="mt-5 text-[24px] font-semibold leading-[1.15] tracking-[0.1px] text-porcelain sm:text-stat sm:leading-[1.1]">
        {title}
      </h3>
      <p className="mt-2 text-lead text-ash">{children}</p>
    </>
  );
}

/** Four friends' private answers come together into one neutral reason. */
function Converge() {
  const p = useTileProgress();
  const arrow = useDerived(p, (v) => ramp(v, 0.55, 0.8), []);
  const cardOpacity = useDerived(p, (v) => ramp(v, 0.65, 0.95), []);
  const cardX = useDerived(p, (v) => 36 * (1 - ramp(v, 0.65, 0.95)), []);
  return (
    <div className="mt-auto flex flex-col items-center gap-4 pt-8 sm:flex-row sm:justify-center">
      <div className="flex -space-x-3">
        {FRIENDS.map((f, i) => (
          <ConvergeAvatar key={f.name} i={i} f={f} p={p} />
        ))}
      </div>
      <motion.span style={{ opacity: arrow, scale: arrow }} className="text-slate">
        <ArrowRight size={22} className="rotate-90 sm:rotate-0" />
      </motion.span>
      <motion.div style={{ opacity: cardOpacity, x: cardX }} className="rounded-media bg-carbon px-5 py-4">
        <p className="text-body-sm font-semibold text-porcelain">Why this works</p>
        <p className="mt-1 text-body-sm text-ash">Fits everyone&apos;s budget, food and getting around.</p>
      </motion.div>
    </div>
  );
}

function ConvergeAvatar({ i, f, p }: { i: number; f: (typeof FRIENDS)[number]; p: MotionValue<number> }) {
  const spread = [
    [-34, -18, -14],
    [-10, 16, 8],
    [12, -20, -6],
    [36, 14, 12],
  ][i];
  const t = (v: number) => ramp(v, 0.2, 0.62);
  const x = useDerived(p, (v) => spread[0] * (1 - t(v)), [i]);
  const y = useDerived(p, (v) => spread[1] * (1 - t(v)), [i]);
  const rotate = useDerived(p, (v) => spread[2] * (1 - t(v)), [i]);
  return (
    <motion.span style={{ x, y, rotate }} className="block">
      <Avatar {...f} size={52} ring />
    </motion.span>
  );
}

/** The leaky sentence gets struck out; the safe one takes its place. */
function LeakGuard() {
  const p = useTileProgress();
  const strike = useDerived(p, (v) => `${100 * ramp(v, 0.4, 0.72)}% 1.5px`, []);
  const dim = useDerived(p, (v) => mix(1, 0.5, ramp(v, 0.55, 0.78)), []);
  const good = useDerived(p, (v) => ramp(v, 0.68, 0.98), []);
  const goodY = useDerived(p, (v) => 14 * (1 - ramp(v, 0.68, 0.98)), []);
  return (
    <div className="mt-auto flex flex-col gap-2 pt-6 text-body-sm">
      <motion.p className="rounded-xl bg-carbon px-3 py-2.5 text-ash" style={{ opacity: dim }}>
        <motion.span
          style={{
            backgroundImage: "linear-gradient(#ff453a, #ff453a)",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "0 58%",
            backgroundSize: strike,
          }}
        >
          Since Priya doesn&apos;t drink, we skipped bars
        </motion.span>
      </motion.p>
      <motion.p
        className="flex items-start gap-2 rounded-xl bg-carbon px-3 py-2.5 text-porcelain"
        style={{ opacity: good, y: goodY }}
      >
        <Check size={16} className="mt-0.5 shrink-0 text-[#30d158]" />
        Picked to fit everyone&apos;s budget, food, and getting around
      </motion.p>
    </div>
  );
}

/** The pool fills as the box comes in; the amount counts with it. */
function QuietPool() {
  const p = useTileProgress();
  const width = useDerived(p, (v) => `${100 * ramp(v, 0.35, 0.95)}%`, []);
  const amount = useDerived<string>(p, (v) => `$${Math.round(10 * ramp(v, 0.35, 0.95))} of $10`, []);
  return (
    <div className="mt-auto pt-6">
      <div className="flex justify-between text-micro text-ash">
        <span>Quiet pool</span>
        <motion.span className="tabular-nums">{amount}</motion.span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-steel">
        <motion.div className="h-full rounded-full bg-porcelain" style={{ width }} />
      </div>
    </div>
  );
}

/** A private sentence redacts itself word by word; only the neutral version survives. */
function Redaction() {
  const p = useTileProgress();
  const words = ["“I", "can’t", "afford", "the", "steakhouse.”"];
  const after = useDerived(p, (v) => ramp(v, 0.8, 1), []);
  return (
    <div className="mt-auto pt-6 text-body-sm">
      <p className="rounded-xl bg-carbon px-3 py-2.5 leading-[1.9] text-porcelain">
        {words.map((w, i) => (
          <RedactedWord key={w} word={w} i={i} p={p} />
        ))}
      </p>
      <motion.p className="mt-2 px-1 text-ash" style={{ opacity: after }}>
        The group hears: “Fits everyone&apos;s budget.”
      </motion.p>
    </div>
  );
}

function RedactedWord({ word, i, p }: { word: string; i: number; p: MotionValue<number> }) {
  const a = 0.4 + i * 0.07;
  const block = useDerived(p, (v) => ramp(v, a, a + 0.1), [a]);
  const text = useDerived(p, (v) => 1 - ramp(v, a, a + 0.1), [a]);
  return (
    <span className="relative mr-[0.3em] inline-block">
      <motion.span style={{ opacity: text }}>{word}</motion.span>
      <motion.span
        aria-hidden
        className="absolute inset-x-0 top-1/2 h-[1.05em] -translate-y-1/2 rounded-[4px] bg-steel"
        style={{ opacity: block, scaleX: block, originX: 0 }}
      />
    </span>
  );
}

/** A link is all it takes: no account, no app. */
function JoinLink() {
  const p = useTileProgress();
  const pill = useDerived(p, (v) => ramp(v, 0.4, 0.7), []);
  const pillX = useDerived(p, (v) => -24 * (1 - ramp(v, 0.4, 0.7)), []);
  const joined = useDerived(p, (v) => ramp(v, 0.72, 0.98), []);
  return (
    <div className="mt-auto flex flex-wrap items-center gap-2 pt-6 text-body-sm">
      <motion.span
        style={{ opacity: pill, x: pillX }}
        className="rounded-full bg-carbon px-3 py-2 font-medium tabular-nums text-link"
      >
        qc.app/j/k7m2qx9a
      </motion.span>
      <motion.span style={{ opacity: joined, scale: joined }} className="flex items-center gap-1.5 text-porcelain">
        <Check size={15} className="text-[#30d158]" /> Joined. No account.
      </motion.span>
    </div>
  );
}

/** The one deliberate pale "comparison" reset on the page: the whole page transitions to light here. */
export function TwoPaths() {
  return (
    <section data-theme-section="light" className="py-28 sm:py-40" aria-label="Choose your Hush">
      <div className="mx-auto max-w-[1100px] px-5 sm:px-6">
        <SectionHeading
          center
          eyebrow="Two ways to use Hush"
          title={
            <>
              For the people you love. <Muted>And the people you work with.</Muted>
            </>
          }
        />
        <div className="mt-14 grid gap-3 lg:grid-cols-2">
          <Reveal>
            <PathCard
              href="/friends"
              eyebrow="Social · Free"
              title="Hush for Friends"
              body="Hangouts, dinners, roommates. Teach Hush your diet, favorite cuisines and budget once, and give it a name and personality that feels like yours."
              icon={<Users size={18} />}
              art={
                <div className="flex -space-x-4">
                  {FRIENDS.map((f, i) => (
                    <Parallax key={f.name} offset={10 + i * 8}>
                      <span className="block rounded-full ring-[3px] ring-obsidian">
                        <Avatar {...f} size={72} />
                      </span>
                    </Parallax>
                  ))}
                </div>
              }
            />
          </Reveal>
          <Reveal delay={0.1}>
            <PathCard
              href="/teams"
              eyebrow="Business"
              title="Hush for Teams"
              body="Team lunches, offsites and onboarding that fit every budget, diet and access need. Admins see participation, never answers."
              icon={<Briefcase size={18} />}
              pinnedDark
              art={
                <div className="grid w-[260px] grid-cols-3 gap-2">
                  {[
                    ["14", "Plans"],
                    ["38", "Joined"],
                    ["0", "Answers shown"],
                  ].map(([n, l]) => (
                    <div key={l} className="rounded-media bg-carbon px-3 py-3 text-center">
                      <p className="text-stat tabular-nums text-porcelain">{n}</p>
                      <p className="mt-1 text-[11px] text-ash">{l}</p>
                    </div>
                  ))}
                </div>
              }
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function PathCard({
  href,
  eyebrow,
  title,
  body,
  icon,
  art,
  pinnedDark = false,
}: {
  href: string;
  eyebrow: string;
  title: string;
  body: string;
  icon: React.ReactNode;
  art: React.ReactNode;
  /** Keep this card black even in the light theme (the black/white pair). */
  pinnedDark?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group relative flex min-h-[520px] flex-col overflow-hidden rounded-tile p-8 sm:p-12 ${
        pinnedDark ? "theme-dark bg-black text-porcelain" : "bg-obsidian text-porcelain"
      }`}
    >
      <p className={`flex items-center gap-2 text-body-sm font-semibold text-ash`}>
        {icon} {eyebrow}
      </p>
      <h3 className="mt-3 text-headline sm:text-display-sm">{title}</h3>
      <p className={`mt-4 max-w-[460px] text-lead text-ash`}>{body}</p>
      <span className={`mt-5 inline-flex items-center gap-0.5 text-lead group-hover:underline text-link`}>
        Explore
        <Chevron size={17} className="transition-transform duration-300 group-hover:translate-x-0.5" />
      </span>
      <div className="mt-auto flex justify-center pt-10 transition-transform duration-700 ease-out group-hover:scale-[1.04]">
        {art}
      </div>
    </Link>
  );
}

const ROADMAP = [
  { when: "Now", title: "Web app", body: "Group chats with Hush built in, on any phone or computer. Join by link or QR code." },
  { when: "Next", title: "Android app", body: "Coming soon: Silent Consensus on Android, with Hush in your notifications." },
  { when: "Later", title: "Texting, Slack and Teams", body: "Hush joins your group text, and your team's workspace." },
];

export function Roadmap() {
  return (
    <section data-theme-section="dark" className="py-28 sm:py-36" aria-label="Where Hush lives">
      <div className="mx-auto max-w-[1100px] px-5 sm:px-6">
        <SectionHeading
          eyebrow="Wherever your group already talks"
          title={
            <>
              Start on the web. <Muted>Land in every chat.</Muted>
            </>
          }
          sub="No new app to convince your friends to download. Hush meets your group where it already is."
        />
        <ol className="relative mt-16 grid gap-10 md:grid-cols-3 md:gap-6">
          <span aria-hidden className="absolute left-0 top-[11px] hidden h-px w-full bg-steel md:block" />
          <motion.span
            aria-hidden
            className="absolute left-0 top-[11px] hidden h-px w-1/3 origin-left bg-porcelain md:block"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "0px 0px -20% 0px" }}
            transition={{ duration: 1.2, ease: EASE }}
          />
          {ROADMAP.map((r, i) => (
            <Reveal as="li" key={r.when} delay={0.2 + i * 0.2} className="relative">
              <span
                className={`relative z-10 block h-6 w-6 rounded-full border-[6px] border-obsidian ${
                  i === 0 ? "bg-porcelain" : "bg-steel"
                }`}
              />
              <p className="mt-5">
                {i === 0 ? (
                  <NewMarker>{r.when}</NewMarker>
                ) : (
                  <span className="text-micro font-semibold text-ash">{r.when}</span>
                )}
              </p>
              <h3 className="mt-1 text-stat text-porcelain">{r.title}</h3>
              <p className="mt-3 max-w-[320px] text-lead text-ash">{r.body}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
