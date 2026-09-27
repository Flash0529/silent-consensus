"use client";

import { AnimatePresence, motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { HushMascot } from "@/components/HushMascot";
import {
  Calendar,
  Chat,
  Check,
  Coins,
  EyeOff,
  Heart,
  Lock,
  MapPin,
  Mic,
  Scale,
  Users,
  Utensils,
  Wheelchair,
} from "../icons";
import { EASE, Reveal, SplitWords, TileIn, useIntroDone } from "../motion";
import { Avatar, Capsule, FRIENDS, Muted, Panel, PillLink, SectionHeading, TextLink } from "../ui";

const GROUP_CHAT = [
  { who: 0, text: "Steakhouse Saturday? 🥩" },
  { who: 3, text: "I'm down" },
  { who: 1, text: "maybe, I'll see" },
  { who: -1, text: "Want me to find something that works for everyone? I'll check in with each of you privately." },
  { who: 2, text: "yes please 🙏" },
];

export function FriendsHero() {
  const ready = useIntroDone();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!ready || shown >= GROUP_CHAT.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 900 : shown === 3 ? 1500 : 1000);
    return () => clearTimeout(t);
  }, [shown, ready]);

  return (
    <section
      data-theme-section="dark"
      className="relative overflow-hidden pb-24 pt-40 sm:pt-48"
      aria-label="Hush for Friends"
    >
      <div
        aria-hidden
        className="spotlight pointer-events-none absolute right-[-10%] top-[20%] h-[80vmin] w-[80vmin]"
      />
      <div className="relative mx-auto grid max-w-[1100px] items-center gap-14 px-5 sm:px-6 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={ready ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.7, ease: EASE }}
            className="flex items-center gap-2 text-product text-ash"
          >
            <Users size={18} /> Hush for Friends · Free
          </motion.p>
          <h1 className="mt-4 text-balance text-[52px] font-semibold leading-[1.04] tracking-[-0.9px] text-porcelain sm:text-display">
            <SplitWords text="Your group chat, minus the awkward." delay={0.1} play={ready} />
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={ready ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.8, ease: EASE, delay: 0.6 }}
            className="mt-6 max-w-[520px] text-pretty text-[19px] leading-[1.42] text-ash sm:text-label sm:font-normal"
          >
            Dinners, hangouts, roommates. Hush notices when a plan isn&apos;t working for someone, checks in with
            everyone privately, and finds the version the whole group can say yes to.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={ready ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.8, ease: EASE, delay: 0.75 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Capsule>Free for friend groups</Capsule>
            <PillLink href="/start">Log in / Sign up</PillLink>
            <TextLink href="#studio">Make Hush yours</TextLink>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40, rotate: 2 }}
          animate={ready ? { opacity: 1, y: 0, rotate: 0 } : undefined}
          transition={{ duration: 1, ease: EASE, delay: 0.3 }}
          className="relative mx-auto w-full max-w-[440px]"
        >
          <div className="rounded-tile bg-carbon p-4 shadow-[inset_0_0_0_1px_var(--c-steel)] sm:p-5">
            <div className="flex items-center gap-3 border-b border-steel pb-3">
              <div className="flex -space-x-2">
                {FRIENDS.map((f) => (
                  <Avatar key={f.name} {...f} size={30} ring />
                ))}
              </div>
              <div>
                <p className="text-[15px] font-semibold text-porcelain">Saturday crew</p>
                <p className="text-micro text-ash">Omar, Maya, Priya, Jordan and Hush</p>
              </div>
            </div>
            <div className="flex min-h-[340px] flex-col justify-end gap-2 pt-4" aria-live="polite">
              <AnimatePresence initial={false}>
                {GROUP_CHAT.slice(0, shown).map((m, i) => {
                  const f = FRIENDS[m.who];
                  const hush = m.who === -1;
                  return (
                    <motion.div
                      key={i}
                      layout
                      initial={{ opacity: 0, y: 14, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.4, ease: EASE }}
                      className="flex items-end gap-2"
                    >
                      {hush ? <HushMascot size={28} /> : <Avatar {...f} size={28} />}
                      <div
                        className={`max-w-[80%] rounded-[18px] px-3.5 py-2.5 text-[14.5px] leading-snug ${
                          hush ? "bg-hush text-white" : "bg-steel text-porcelain"
                        }`}
                      >
                        {!hush && <span className="block text-[11px] font-semibold text-ash">{f.name}</span>}
                        {m.text}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
          <AnimatePresence>
            {shown >= GROUP_CHAT.length && (
              <motion.div
                initial={{ opacity: 0, x: 30, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.4 }}
                className="absolute -right-2 -top-6 flex items-center gap-2 rounded-full bg-[rgba(66,66,69,0.72)] px-3.5 py-2 text-micro font-medium text-white/80 glass sm:-right-8"
              >
                <Lock size={14} /> 4 private check-ins started
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}

const TOPICS = [
  { icon: Coins, label: "Budget" },
  { icon: Utensils, label: "Food" },
  { icon: Heart, label: "Drinks" },
  { icon: Wheelchair, label: "Getting around" },
  { icon: Calendar, label: "Timing" },
  { icon: MapPin, label: "Vibe" },
];

const AGREEMENT = [
  "A shared chore chart",
  "Kitchen quiet after 11:30 PM on weeknights, with a late-cook routine",
  "Guest heads-up by 6 PM",
  "A 15-minute check-in in two weeks",
];

export function Modes() {
  return (
    <section
      data-theme-section="dark"
      id="modes"
      className="scroll-mt-28 py-28 sm:py-36"
      aria-label="Plan and mediation modes"
    >
      <div className="mx-auto max-w-[1100px] px-5 sm:px-6">
        <SectionHeading
          eyebrow="Two modes"
          title={
            <>
              Plan the night. <Muted>Or clear the air.</Muted>
            </>
          }
          sub="The same quiet check-ins work for picking a place, and for the stuff roommates don’t know how to bring up."
        />
        <Panel className="mt-14">
          <div className="grid gap-3 lg:grid-cols-2">
            <Reveal>
              <div className="flex h-full flex-col rounded-tile bg-obsidian p-8 sm:p-10">
                <p className="flex items-center gap-2 text-body-sm font-semibold text-ash">
                  <Calendar size={18} /> Plan mode
                </p>
                <h3 className="mt-3 text-title-lg text-porcelain sm:text-headline">
                  One question at a time. Never “why.”
                </h3>
                <p className="mt-3 max-w-[480px] text-lead text-ash">
                  Tap a lettered answer, type, or send a voice note. Hush skips anything it already knows from your
                  profile.
                </p>
                <ul className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {TOPICS.map((t, i) => (
                    <motion.li
                      key={t.label}
                      initial={{ opacity: 0, y: 12 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.1 + i * 0.07, duration: 0.5, ease: EASE }}
                      className="flex items-center gap-2 rounded-media bg-carbon px-3.5 py-3 text-[15px] font-medium text-porcelain"
                    >
                      <t.icon size={18} className="text-ash" /> {t.label}
                    </motion.li>
                  ))}
                </ul>
                <div className="mt-auto pt-8">
                  <div className="flex items-center gap-3 rounded-media bg-carbon p-3.5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-porcelain text-obsidian">
                      <Mic size={18} />
                    </span>
                    <div className="flex h-8 flex-1 items-center gap-[3px]" aria-hidden>
                      {Array.from({ length: 36 }).map((_, i) => (
                        <motion.span
                          key={i}
                          className="w-[3px] flex-1 rounded-full bg-porcelain/70"
                          animate={{ height: [6, 8 + ((i * 37) % 22), 6] }}
                          transition={{ duration: 1.1, repeat: Infinity, delay: (i % 9) * 0.08, ease: "easeInOut" }}
                        />
                      ))}
                    </div>
                    <span className="text-micro tabular-nums text-ash">0:06</span>
                  </div>
                  <p className="mt-2 px-1 text-micro text-ash">“Step-free places only, and I&apos;m free after six.”</p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="flex h-full flex-col rounded-tile bg-obsidian p-8 text-porcelain sm:p-10">
                <p className="flex items-center gap-2 text-body-sm font-semibold text-ash">
                  <Scale size={18} /> Mediation mode
                </p>
                <h3 className="mt-3 text-title-lg text-porcelain sm:text-headline">
                  Everyone&apos;s heard. Nobody&apos;s quoted.
                </h3>
                <p className="mt-3 max-w-[480px] text-lead text-ash">
                  Hush hears each side privately, and only brings what you agree to share, without your name on it.
                </p>
                <div className="mt-8 rounded-media bg-carbon p-5">
                  <p className="text-micro font-medium text-ash">The apartment · proposed agreement</p>
                  <ol className="mt-3 flex flex-col gap-3">
                    {AGREEMENT.map((a, i) => (
                      <motion.li
                        key={a}
                        initial={{ opacity: 0, x: -12 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 + i * 0.12, duration: 0.5, ease: EASE }}
                        className="flex gap-3 text-[16px] leading-snug text-porcelain"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-steel text-[12px] font-semibold tabular-nums">
                          {i + 1}
                        </span>
                        {a}
                      </motion.li>
                    ))}
                  </ol>
                </div>
                <div className="mt-auto flex flex-wrap gap-2 pt-8 text-micro">
                  {["No quotes", "Nothing you keep private", "Private safety resources if needed"].map((t) => (
                    <span
                      key={t}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-porcelain shadow-[inset_0_0_0_1px_#6e6e73]"
                    >
                      <Check size={13} /> {t}
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </Panel>
      </div>
    </section>
  );
}

const AMOUNTS = [0, 5, 10];

/** Interactive version of the $25 → $15 demo story. */
export function ChipIn() {
  const [omar, setOmar] = useState(5);
  const [priya, setPriya] = useState(5);
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -20% 0px" });
  const need = 10;
  const pool = Math.min(need, omar + priya);
  const maya = 25 - pool;

  return (
    <section
      data-theme-section="carbon"
      id="chip-in"
      className="scroll-mt-28 py-36 sm:py-44"
      aria-label="The quiet chip-in"
    >
      <div className="mx-auto max-w-[1100px] px-5 sm:px-6">
        <SectionHeading
          eyebrow="The quiet chip-in"
          title={
            <>
              Help a friend. <Muted>Without anyone knowing.</Muted>
            </>
          }
          sub="When a plan costs more than someone’s limit, friends with room can quietly cover the gap. Try it: you’re Omar and Priya."
        />
        <div ref={ref} className="mt-14 grid gap-3 lg:grid-cols-[1fr_1fr]">
          <div className="flex flex-col gap-3">
            {[
              { f: FRIENDS[0], v: omar, set: setOmar },
              { f: FRIENDS[2], v: priya, set: setPriya },
            ].map(({ f, v, set }) => (
              <Reveal key={f.name}>
                <div className="rounded-tile bg-obsidian p-6 sm:p-7">
                  <div className="flex items-center gap-3">
                    <Avatar {...f} size={40} />
                    <div>
                      <p className="text-micro text-ash">{f.name} sees, privately</p>
                      <p className="text-product text-porcelain">Want to quietly help?</p>
                    </div>
                  </div>
                  <div role="radiogroup" aria-label={`${f.name}'s chip-in`} className="mt-5 grid grid-cols-3 gap-2">
                    {AMOUNTS.map((a) => (
                      <button
                        key={a}
                        type="button"
                        role="radio"
                        aria-checked={v === a}
                        onClick={() => set(a)}
                        className={`h-12 cursor-pointer rounded-full text-lead font-semibold tabular-nums transition-colors ${
                          v === a ? "bg-porcelain text-obsidian" : "bg-carbon text-porcelain hover:bg-steel"
                        }`}
                      >
                        ${a}
                      </button>
                    ))}
                  </div>
                  <div className="mt-5">
                    <div className="flex justify-between text-micro text-ash">
                      <span>Group pool</span>
                      <span className="tabular-nums">
                        ${pool} of ${need}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-steel">
                      <motion.div
                        className="h-full rounded-full bg-porcelain"
                        animate={{ width: seen ? `${(pool / need) * 100}%` : "0%" }}
                        transition={{ type: "spring", stiffness: 120, damping: 20 }}
                      />
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.1}>
            <div className="flex h-full flex-col items-center justify-center rounded-tile bg-obsidian p-8 text-center sm:p-10">
              <Avatar {...FRIENDS[1]} size={56} />
              <p className="mt-3 text-[15px] text-ash">Maya&apos;s share</p>
              <div className="relative mt-2 h-[96px] overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.p
                    key={maya}
                    initial={{ y: 60, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -60, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 24 }}
                    className="text-[88px] font-semibold leading-none tracking-[-1.44px] tabular-nums text-porcelain"
                  >
                    ${maya}
                  </motion.p>
                </AnimatePresence>
              </div>
              <p className="mt-2 text-[15px] text-ash">
                {pool > 0 ? (
                  <>
                    <span className="line-through">$25</span> · A quiet group pool covered ${pool}
                  </>
                ) : (
                  "Base share for Picnic + food truck night"
                )}
              </p>
              <AnimatePresence>
                {maya <= 15 && (
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-5 flex items-center gap-2 rounded-full bg-carbon px-4 py-2 text-body-sm font-medium text-porcelain"
                  >
                    <Check size={15} /> Maya&apos;s in, and nobody knows why it worked
                  </motion.p>
                )}
              </AnimatePresence>
              <div className="mt-8 grid w-full max-w-[360px] gap-2 text-left text-body-sm">
                {[
                  [EyeOff, "Maya never sees who gave"],
                  [Chat, "The group sees nothing about the pool"],
                  [Coins, "Anything extra is refunded"],
                ].map(([Icon, t]) => {
                  const I = Icon as typeof EyeOff;
                  return (
                    <p key={t as string} className="flex items-center gap-2.5 text-ash">
                      <I size={16} className="text-porcelain" /> {t as string}
                    </p>
                  );
                })}
              </div>
              <p className="mt-6 text-micro text-slate">Demo. No real money moves.</p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

const NEVER = [
  { t: "Never asks why", b: "A limit is a limit. Hush doesn't need the story." },
  { t: "Never names names", b: "The plan explains itself without pointing at anyone." },
  { t: "Never singles you out", b: "When Hush senses a problem, it checks in with everyone, not just you." },
  { t: "Never keeps what you delete", b: "Your profile is yours to edit or erase, anytime." },
];

export function Promises() {
  return (
    <section data-theme-section="light" className="py-28 sm:py-40" aria-label="Hush promises">
      <div className="mx-auto max-w-[1100px] px-5 sm:px-6">
        <SectionHeading center eyebrow="Hush promises" title="What your Hush will never do." />
        <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {NEVER.map((n, i) => (
            <TileIn key={n.t} index={i % 4} innerClassName="rounded-tile bg-obsidian p-7 sm:p-8">
              <span className="text-micro font-semibold tabular-nums text-ash">0{i + 1}</span>
              <h3 className="mt-3 text-label text-porcelain">{n.t}</h3>
              <p className="mt-2 text-lead text-ash">{n.b}</p>
            </TileIn>
          ))}
        </div>
      </div>
    </section>
  );
}
