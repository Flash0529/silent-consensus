"use client";

import { AnimatePresence, motion, useMotionValue, useMotionValueEvent, type MotionValue } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { HushMascot } from "@/components/HushMascot";
import { GalaxyPhone } from "../GalaxyPhone";
import { Check, Lock, Shield } from "../icons";
import {
  EASE,
  mix,
  ramp,
  SplitWords,
  useDerived,
  useElementProgress,
  useIntroDone,
  usePrefersReducedMotion,
} from "../motion";
import { Avatar, FRIENDS, Muted, NewMarker, PillLink, TextLink } from "../ui";

// Hero: a black product stage in the reference's layout. Chrome "HUSH" letters with a Galaxy
// Ultra-style handset lying across them, product name + statement bottom-left, pricing capsule
// and blue pill bottom-right. Scrolling stands the phone up to show Hush at work, flanked by what
// Hush heard privately (left) and what the group actually sees (right).

const HEARD = [
  { friend: 1, text: "Under $15, please" },
  { friend: 2, text: "I don't drink" },
  { friend: 3, text: "Step-free places only" },
  { friend: 0, text: "I eat halal" },
];

const SEES = [
  { title: "Picnic + food truck night", sub: "Saturday · Piedmont Park · 6:30" },
  { title: "Fits everyone's budget", sub: "A quiet pool evened out the cost" },
  { title: "Step-free paths · Halal options", sub: "No bar on the itinerary" },
  { title: "4 of 4 are in", sub: "Nobody explained a thing", ok: true },
];

type ScreenState = "group" | "planning" | "plan";

export function Hero() {
  // Reduced motion: the same two compositions, stacked and static.
  return usePrefersReducedMotion() ? <StaticHero /> : <ScrollHero />;
}

function ScrollHero() {
  const ref = useRef<HTMLElement>(null);
  const p = useElementProgress(ref, 0, 1);
  return (
    <section data-theme-section="dark" ref={ref} className="relative h-[430vh]" aria-label="Introducing Hush">
      <div className="sticky top-0 h-svh overflow-hidden">
        <HeroStage p={p} />
      </div>
    </section>
  );
}

function StaticHero() {
  const start = useMotionValue(0);
  const end = useMotionValue(1);
  return (
    <section data-theme-section="dark" aria-label="Introducing Hush">
      <div className="relative h-svh min-h-[640px] overflow-hidden">
        <HeroStage p={start} />
      </div>
      <div className="relative h-svh min-h-[720px] overflow-hidden">
        <HeroStage p={end} still />
      </div>
    </section>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function HeroStage({ p, still = false }: { p: MotionValue<number>; still?: boolean }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 1280, h: 800 });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- layout (all in px, from the stage size) ----
  const lg = box.w >= 1024;
  const titleH = lg ? 168 : 150;
  const pillsH = lg ? 0 : 96;
  const W = Math.round(
    lg ? clamp((box.h - titleH - 70) / 2.05, 170, 290) : clamp((box.h - titleH - pillsH - 84) / 2.05, 120, 210),
  );
  const H = W * 2.05;
  const fontSize = lg ? Math.min(box.w * 0.25, 380) : box.w * 0.3;
  const lettersCY = box.h * (lg ? 0.42 : 0.35);
  const phoneTop = titleH + pillsH + (lg ? (box.h - titleH - 40 - H) / 2 : 0);
  const phoneCY = phoneTop + H / 2;
  const lettersW = fontSize * 2.8;
  const sA = clamp((0.62 * lettersW) / H, 0.4, 1.25);

  // ---- choreography ----
  const phoneTransform = useDerived(
    p,
    (v) => {
      const t = ramp(v, 0.08, 0.36);
      const ty = mix(lettersCY - H / 2, phoneTop, t);
      return `translateY(${ty}px) scale(${mix(sA, 1, t)}) rotateX(${mix(62, 0, t)}deg) rotateZ(${mix(-90, 0, t)}deg) rotateY(${mix(180, 0, t)}deg)`;
    },
    [lettersCY, H, phoneTop, sA],
  );
  const copyOpacity = useDerived(p, (v) => 1 - ramp(v, 0.03, 0.12), []);
  const copyY = useDerived(p, (v) => -40 * ramp(v, 0.03, 0.12), []);
  const lettersOpacity = useDerived(p, (v) => 1 - ramp(v, 0.1, 0.27), []);
  const lettersScale = useDerived(p, (v) => mix(1, 1.32, ramp(v, 0.06, 0.3)), []);
  const glow = useDerived(p, (v) => mix(0.55, 1, ramp(v, 0.1, 0.4)), []);
  const glowY = useDerived(p, (v) => mix(lettersCY, phoneCY, ramp(v, 0.08, 0.36)), [lettersCY, phoneCY]);
  const titleOpacity = useDerived(p, (v) => ramp(v, 0.33, 0.42), []);
  const titleY = useDerived(p, (v) => 24 * (1 - ramp(v, 0.33, 0.42)), []);
  const footOpacity = useDerived(p, (v) => ramp(v, 0.8, 0.9), []);

  // Entrances wait for the startup animation to lift.
  const ready = useIntroDone();

  // The handset isn't rendered until the visitor starts scrolling; then it swoops in and the scroll
  // choreography below takes over. Scrolling all the way back to the top sends it back out
  // (fully gone, not left hovering behind the letters).
  const [phoneOn, setPhoneOn] = useState(still);
  useEffect(() => {
    if (still) return;
    const check = () => setPhoneOn(window.scrollY > 2);
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, [still]);

  const [screen, setScreen] = useState<ScreenState>(still ? "plan" : "group");
  useMotionValueEvent(p, "change", (v) => setScreen(v < 0.5 ? "group" : v < 0.6 ? "planning" : "plan"));
  useEffect(() => {
    const v = p.get();
    setScreen(v < 0.5 ? "group" : v < 0.6 ? "planning" : "plan");
  }, [p]);

  const gap = 64;
  const colW = Math.min(300, (box.w - W) / 2 - gap - 40);
  const itemH = 76;
  const listTop = phoneCY - (HEARD.length * itemH + (HEARD.length - 1) * 12) / 2;

  return (
    <div ref={stageRef} className="absolute inset-0 bg-transparent">
      {/* Rim light that follows the hardware */}
      <motion.div
        aria-hidden
        className="spotlight pointer-events-none absolute left-1/2 h-[min(90vmin,900px)] w-[min(90vmin,900px)] -translate-x-1/2 -translate-y-1/2"
        style={{ top: glowY, opacity: glow }}
      />

      {/* Chrome letters */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 select-none"
        style={{ top: lettersCY, opacity: lettersOpacity, scale: lettersScale, x: "-50%", y: "-50%" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
          animate={ready ? { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } } : undefined}
          transition={{ duration: 1.2, ease: EASE }}
          className="relative whitespace-nowrap font-extrabold leading-[0.8] tracking-[-0.055em]"
          style={{ fontSize }}
        >
          <span className="chrome-depth absolute inset-0">HUSH</span>
          <span className="chrome-text relative block">HUSH</span>
          <span className="chrome-glint absolute inset-0">HUSH</span>
        </motion.div>
      </motion.div>

      {/* The handset */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ perspective: 2200, perspectiveOrigin: `50% ${phoneCY}px` }}
      >
        <AnimatePresence>
          {phoneOn && (
            // Enters from off-stage right (and leaves the same way). Only transform animates here:
            // opacity would flatten the 3D.
            <motion.div
              key="phone"
              className="absolute left-1/2 top-0"
              style={{ marginLeft: -W / 2, transformStyle: "preserve-3d" }}
              initial={still ? false : { x: box.w / 2 + H, rotate: -14 }}
              animate={{ x: 0, rotate: 0 }}
              exit={{ x: box.w / 2 + H * 1.5, rotate: -14, transition: { duration: 0.45, ease: [0.4, 0, 1, 1] } }}
              transition={{ type: "spring", stiffness: 55, damping: 16 }}
            >
              <motion.div style={{ transform: phoneTransform, transformStyle: "preserve-3d" }}>
                <GalaxyPhone w={W} screen={<HushScreen state={screen} />} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Stage A copy: product name + statement bottom-left, purchase cluster bottom-right */}
      <motion.div
        className="absolute inset-x-0 bottom-0 z-10 mx-auto flex max-w-[1180px] flex-col gap-6 px-5 pb-[max(2rem,5svh)] sm:px-8 lg:flex-row lg:items-end lg:justify-between"
        style={{ opacity: copyOpacity, y: copyY }}
      >
        <div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={ready ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
          >
            <NewMarker>Coming soon to Android</NewMarker>
            <p className="mt-1 text-[26px] font-semibold leading-[1.13] tracking-[0.128px] text-porcelain sm:text-title-lg">
              Hush
            </p>
          </motion.div>
          <h1 className="mt-1 max-w-[640px] text-balance text-[42px] font-semibold leading-[1.04] tracking-[-0.6px] text-porcelain sm:text-display-sm lg:text-[72px] lg:tracking-[-1.1px]">
            <SplitWords text="Plans everyone can say yes to." delay={0.3} play={ready} />
          </h1>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={ready ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.9, ease: EASE, delay: 0.8 }}
          className="flex flex-col items-start gap-1 lg:items-end"
        >
          <div className="flex w-full items-center gap-4 rounded-capsule bg-[rgba(66,66,69,0.72)] py-2 pl-5 pr-2 text-body-sm text-white/80 glass sm:w-auto">
            <p className="leading-[1.35]">
              Free for friend groups.
              <br />
              Teams pilots booking now.
            </p>
            <PillLink href="/start" size="sm">
              Log in / Sign up
            </PillLink>
          </div>
          <TextLink href="#how">See how it works</TextLink>
        </motion.div>
      </motion.div>

      {/* Stage C: headline */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 z-10 px-5 text-center"
        style={{ top: lg ? 76 : 70, opacity: titleOpacity, y: titleY }}
      >
        <h2 className="mx-auto max-w-[760px] text-balance text-[24px] font-semibold leading-[1.12] tracking-[-0.2px] text-porcelain sm:text-headline">
          Four private check-ins. <Muted>One plan everyone can say yes to.</Muted>
        </h2>
      </motion.div>

      {/* Stage C: flanking columns (desktop) */}
      {lg && colW > 180 && (
        <>
          <ColumnLabel side="left" x={box.w / 2 - W / 2 - gap - colW} y={listTop - 34} w={colW} p={p}>
            <Lock size={13} /> Heard privately
          </ColumnLabel>
          {HEARD.map((h, i) => (
            <HeardItem
              key={h.text}
              {...h}
              i={i}
              p={p}
              style={{
                left: box.w / 2 - W / 2 - gap - colW,
                top: listTop + i * (itemH + 12),
                width: colW,
                height: itemH,
              }}
              line={{ left: colW, width: gap - 10 }}
            />
          ))}
          <ColumnLabel side="right" x={box.w / 2 + W / 2 + gap} y={listTop - 34} w={colW} p={p}>
            <Shield size={13} /> What the group sees
          </ColumnLabel>
          {SEES.map((s, i) => (
            <SeesItem
              key={s.title}
              {...s}
              i={i}
              p={p}
              style={{ left: box.w / 2 + W / 2 + gap, top: listTop + i * (itemH + 12), width: colW, height: itemH }}
              line={{ right: colW, width: gap - 10 }}
            />
          ))}
        </>
      )}

      {/* Stage C: compact version for narrow screens */}
      {!lg && (
        <div className="absolute inset-x-0 z-10 px-4" style={{ top: titleH + 6 }}>
          <div className="mx-auto grid max-w-[420px] grid-cols-2 gap-1.5">
            {HEARD.map((h, i) => (
              <CompactHeard key={h.text} {...h} i={i} p={p} />
            ))}
          </div>
        </div>
      )}

      {/* Stage C: footnote */}
      <motion.p
        className="absolute inset-x-0 bottom-[max(1.25rem,3svh)] z-10 flex items-center justify-center gap-2 px-5 text-center text-body-sm text-ash"
        style={{ opacity: footOpacity }}
      >
        <Check size={15} className="shrink-0 text-[#30d158]" /> Checked: nothing anyone told Hush shows up in the group.
      </motion.p>
    </div>
  );
}

function ColumnLabel({
  side,
  x,
  y,
  w,
  p,
  children,
}: {
  side: "left" | "right";
  x: number;
  y: number;
  w: number;
  p: MotionValue<number>;
  children: React.ReactNode;
}) {
  const opacity = useDerived(p, (v) => ramp(v, side === "left" ? 0.37 : 0.57, side === "left" ? 0.42 : 0.62), [side]);
  return (
    <motion.p
      className={`absolute z-10 flex items-center gap-1.5 text-micro font-semibold uppercase tracking-[0.12em] text-ash ${
        side === "left" ? "justify-end" : ""
      }`}
      style={{ left: x, top: y, width: w, opacity }}
    >
      {children}
    </motion.p>
  );
}

function HeardItem({
  friend,
  text,
  i,
  p,
  style,
  line,
}: {
  friend: number;
  text: string;
  i: number;
  p: MotionValue<number>;
  style: React.CSSProperties;
  line: { left: number; width: number };
}) {
  const f = FRIENDS[friend];
  const a = 0.4 + i * 0.045;
  const opacity = useDerived(p, (v) => ramp(v, a, a + 0.06), [a]);
  const x = useDerived(p, (v) => -28 * (1 - ramp(v, a, a + 0.06)), [a]);
  const draw = useDerived(p, (v) => ramp(v, a + 0.03, a + 0.09), [a]);
  return (
    <motion.div className="absolute z-10" style={{ ...style, opacity, x }}>
      <div className="flex h-full items-center gap-3 rounded-tile bg-carbon/90 px-4 shadow-[inset_0_0_0_1px_var(--c-steel)]">
        <Avatar {...f} size={40} />
        <div className="min-w-0">
          <p className="text-micro text-ash">{f.name} told Hush</p>
          <p className="truncate text-lead font-medium text-porcelain">{text}</p>
        </div>
        <Lock size={14} className="ml-auto shrink-0 text-ash" />
      </div>
      <Connector draw={draw} style={{ left: line.left + 6, width: line.width, top: "50%" }} />
    </motion.div>
  );
}

function SeesItem({
  title,
  sub,
  ok,
  i,
  p,
  style,
  line,
}: {
  title: string;
  sub: string;
  ok?: boolean;
  i: number;
  p: MotionValue<number>;
  style: React.CSSProperties;
  line: { right: number; width: number };
}) {
  const a = 0.6 + i * 0.045;
  const opacity = useDerived(p, (v) => ramp(v, a, a + 0.06), [a]);
  const x = useDerived(p, (v) => 28 * (1 - ramp(v, a, a + 0.06)), [a]);
  const draw = useDerived(p, (v) => ramp(v, a - 0.02, a + 0.04), [a]);
  return (
    <motion.div className="absolute z-10" style={{ ...style, opacity, x }}>
      <Connector draw={draw} style={{ right: line.right + 6, width: line.width, top: "50%" }} />
      <div className="flex h-full flex-col justify-center rounded-tile bg-carbon/90 px-5 shadow-[inset_0_0_0_1px_var(--c-steel)]">
        <p className="flex items-center gap-2 text-lead font-semibold text-porcelain">
          {ok && <Check size={16} className="text-[#30d158]" />}
          {title}
        </p>
        <p className="mt-0.5 text-body-sm text-ash">{sub}</p>
      </div>
    </motion.div>
  );
}

function Connector({ draw, style }: { draw: MotionValue<number>; style: React.CSSProperties }) {
  return (
    <div aria-hidden className="absolute h-px" style={style}>
      <motion.div className="h-px w-full origin-left bg-steel" style={{ scaleX: draw }} />
      <motion.span
        className="animate-travel absolute -top-[2px] left-0 block h-[5px] w-[5px] rounded-full bg-porcelain"
        style={{ opacity: draw, ["--travel" as string]: `${Number(style.width ?? 48) - 5}px` }}
      />
    </div>
  );
}

function CompactHeard({ friend, text, i, p }: { friend: number; text: string; i: number; p: MotionValue<number> }) {
  const f = FRIENDS[friend];
  const a = 0.4 + i * 0.045;
  const opacity = useDerived(p, (v) => ramp(v, a, a + 0.06), [a]);
  const y = useDerived(p, (v) => 10 * (1 - ramp(v, a, a + 0.06)), [a]);
  return (
    <motion.div
      style={{ opacity, y }}
      className="flex min-w-0 items-center gap-1.5 rounded-full bg-carbon/90 py-1 pl-1 pr-2.5 shadow-[inset_0_0_0_1px_var(--c-steel)]"
    >
      <Avatar {...f} size={20} />
      <span className="truncate text-[12px] font-medium text-porcelain">{text}</span>
    </motion.div>
  );
}

// ---------------- In-phone UI (authored at 300px wide, dark) ----------------

function HushScreen({ state }: { state: ScreenState }) {
  return (
    <div className="flex h-full flex-col bg-black px-4 pb-4 pt-3 text-porcelain">
      <div className="flex items-center justify-between px-1 text-[12px] font-semibold tabular-nums">
        <span>9:41</span>
        <span className="flex items-center gap-1.5 opacity-90">
          <span className="flex items-end gap-[2px]">
            {[4, 6, 8, 10].map((hh) => (
              <span key={hh} className="w-[3px] rounded-sm bg-porcelain" style={{ height: hh }} />
            ))}
          </span>
          <span className="block h-[10px] w-[20px] rounded-[3px] border border-porcelain/80 p-[1.5px]">
            <span className="block h-full w-3/4 rounded-[1px] bg-porcelain" />
          </span>
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2.5 border-b border-steel pb-3">
        <div className="flex -space-x-1.5">
          {FRIENDS.map((f) => (
            <Avatar key={f.name} {...f} size={24} ring />
          ))}
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold">Saturday crew</p>
          <p className="text-[11px] text-ash">Omar, Maya, Priya, Jordan and Hush</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-end gap-2 overflow-hidden pt-3">
        <p className="self-center py-1 text-[10.5px] font-medium text-ash">Today 4:12 PM</p>
        <Line who={2} text="ok who's around saturday?" />
        <Line who={0} text="me! let's do something fun" />
        {state !== "group" && (
          <div className="flex items-end gap-1.5 opacity-60">
            <HushMascot size={22} />
            <p className="max-w-[82%] rounded-[16px] bg-hush px-3 py-2 text-[13px] leading-snug text-white">
              I checked in with each of you privately.
            </p>
          </div>
        )}
        <AnimatePresence mode="popLayout" initial={false}>
          {state === "group" && (
            <motion.div
              key="group"
              className="flex flex-col gap-2"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <Line who={0} text="Steakhouse Saturday? 🥩" />
              <Line who={3} text="I'm down" />
              <Line who={1} text="maybe, I'll see" />
              <div className="flex items-end gap-1.5">
                <HushMascot size={22} />
                <p className="max-w-[82%] rounded-[16px] bg-hush px-3 py-2 text-[13px] leading-snug text-white">
                  Want me to find something that works for everyone? I&apos;ll check in with each of you privately.
                </p>
              </div>
            </motion.div>
          )}
          {state === "planning" && (
            <motion.div
              key="planning"
              className="rounded-[18px] bg-carbon p-4"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: EASE }}
            >
              <p className="flex items-center gap-2 text-[14px] font-semibold">
                <HushMascot size={22} /> Hush is planning
              </p>
              <ol className="mt-3 flex flex-col gap-2 text-[12.5px]">
                {[
                  "Read 4 private chats",
                  "Found 9 places that fit everyone",
                  "Balancing everyone's costs",
                  "Checking nothing private shows",
                ].map((r, i) => (
                  <motion.li
                    key={r}
                    className="flex items-center gap-2"
                    initial={{ opacity: 0.35 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 + i * 0.22 }}
                  >
                    <motion.span
                      className="flex h-[18px] w-[18px] items-center justify-center rounded-full"
                      initial={{ backgroundColor: "#333336", color: "#86868b" }}
                      animate={{ backgroundColor: "#f5f5f7", color: "#000000" }}
                      transition={{ delay: 0.25 + i * 0.22 }}
                    >
                      <Check size={10} />
                    </motion.span>
                    {r}
                  </motion.li>
                ))}
              </ol>
            </motion.div>
          )}
          {state === "plan" && (
            <motion.div
              key="plan"
              className="rounded-[18px] bg-carbon p-4"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              <p className="flex items-center gap-1.5 text-[11px] text-ash">
                <HushMascot size={16} /> Hush made a plan · Saturday
              </p>
              <p className="mt-1.5 text-[18px] font-semibold leading-tight">Picnic + food truck night</p>
              <ul className="mt-2.5 flex flex-col gap-1 text-[12.5px]">
                {[
                  ["6:30", "Food truck dinner"],
                  ["7:45", "Dessert on the lawn"],
                  ["8:30", "Sunset picnic"],
                ].map(([t, s]) => (
                  <li key={t} className="flex gap-2.5">
                    <span className="w-8 tabular-nums text-ash">{t}</span>
                    {s}
                  </li>
                ))}
              </ul>
              <p className="mt-2.5 text-[11.5px] leading-snug text-ash">
                Why this works: fits everyone&apos;s budget, food and getting around.
              </p>
              <div className="mt-3 flex items-center justify-between rounded-[12px] bg-black px-3 py-2 text-[11.5px]">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Check size={12} className="text-[#30d158]" /> 4 of 4 are in
                </span>
                <span className="text-ash">Nothing private shows</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-3 flex h-9 items-center rounded-full bg-carbon px-4 text-[12px] text-ash">Message</div>
    </div>
  );
}

function Line({ who, text }: { who: number; text: string }) {
  const f = FRIENDS[who];
  return (
    <div className="flex items-end gap-1.5">
      <Avatar {...f} size={22} />
      <p className="max-w-[80%] rounded-[16px] bg-steel px-3 py-2 text-[13px] leading-snug">
        <span className="block text-[10px] font-semibold text-ash">{f.name}</span>
        {text}
      </p>
    </div>
  );
}
