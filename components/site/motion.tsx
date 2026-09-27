"use client";

import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { createContext, useContext, useEffect, useRef, useState } from "react";

export const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Reduced-motion preference that is false on the server and first client render,
 * so components can swap layouts on it without a hydration mismatch.
 */
export function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

/**
 * 0→1 progress of an element through the viewport, computed in JS.
 * `start` is where the element's top sits (fraction of viewport height) at 0,
 * `end` is where its bottom sits at 1. (0, 1) = pinned section, (1, 0) = full pass.
 * We avoid framer's useScroll({ target }) because v13 hands it to native
 * ViewTimeline, whose offsets don't line up with sticky sections.
 */
export function useElementProgress(ref: React.RefObject<HTMLElement | null>, start = 0, end = 1) {
  const p = useMotionValue(0);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const span = start * vh - end * vh + r.height;
      p.set(span > 0 ? Math.min(1, Math.max(0, (start * vh - r.top) / span)) : 0);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ref, start, end, p]);
  return p;
}

declare global {
  interface Window {
    __qcIntroDone?: boolean;
  }
}

/**
 * True once the startup animation (components/site/Intro.tsx) has started to lift, so hero entrances
 * play on screen instead of underneath it. True immediately when there is no intro.
 */
export function useIntroDone() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (window.__qcIntroDone) {
      setDone(true);
      return;
    }
    const on = () => setDone(true);
    window.addEventListener("qc:intro-done", on);
    return () => window.removeEventListener("qc:intro-done", on);
  }, []);
  return done;
}

/** 0→1 as v goes from a to b (clamped), eased in-out. */
export function ramp(v: number, a: number, b: number) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export const mix = (from: number, to: number, t: number) => from + (to - from) * t;

/**
 * A motion value computed from scroll progress `p` by `fn`, recomputed when `deps` change (for
 * layout-dependent numbers). Never re-renders React.
 */
export function useDerived<T extends string | number>(p: MotionValue<number>, fn: (v: number) => T, deps: unknown[]) {
  const out = useMotionValue<T>(fn(p.get()));
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
    out.set(fn(p.get()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => p.on("change", (v) => out.set(fnRef.current(v))), [p, out]);
  return out;
}

/** Fade + rise + unblur when the block scrolls into view (once). */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "li" | "section" | "p";
}) {
  const M = motion[as];
  return (
    <M
      className={className}
      initial={{ opacity: 0, y, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.9, ease: EASE, delay }}
    >
      {children}
    </M>
  );
}

/** Headline where each word slides up from behind a mask, staggered. */
export function SplitWords({
  text,
  className,
  delay = 0,
  stagger = 0.06,
  inView = false,
  play = true,
  wordClassName,
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
  inView?: boolean;
  /** Hold the words hidden until true (e.g. until the startup animation finishes). */
  play?: boolean;
  wordClassName?: (word: string, i: number) => string | undefined;
}) {
  const words = text.split(" ");
  const trigger = inView
    ? { whileInView: "show", viewport: { once: true, margin: "0px 0px -10% 0px" } }
    : { animate: play ? "show" : "hide" };
  return (
    <motion.span
      className={className}
      initial="hide"
      {...trigger}
      transition={{ staggerChildren: stagger, delayChildren: delay }}
    >
      <span className="sr-only">{text}</span>
      {words.map((w, i) => (
        <span key={i} aria-hidden className="inline-block overflow-hidden pb-[0.12em] align-top">
          <motion.span
            className={`inline-block ${wordClassName?.(w, i) ?? ""}`}
            variants={{
              hide: { y: "110%", opacity: 0 },
              show: { y: "0%", opacity: 1, transition: { duration: 0.9, ease: EASE } },
            }}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}

function LitWord({ word, progress, range }: { word: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.16, 1]);
  return (
    <motion.span style={{ opacity }} className="inline">
      {word}{" "}
    </motion.span>
  );
}

/** Apple-style paragraph whose words light up one by one as you scroll through it. */
export function ScrollLitText({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduce = usePrefersReducedMotion();
  const scrollYProgress = useElementProgress(ref, 0.85, 0.45);
  const words = text.split(" ");
  if (reduce) return <p className={className}>{text}</p>;
  return (
    <p ref={ref} className={className} aria-label={text}>
      <span aria-hidden>
        {words.map((w, i) => {
          const start = i / words.length;
          return <LitWord key={i} word={w} progress={scrollYProgress} range={[start, start + 1 / words.length]} />;
        })}
      </span>
    </p>
  );
}

/** Number that counts up the first time it becomes visible. */
export function CountUp({
  to,
  prefix = "",
  suffix = "",
  duration = 1.8,
  className,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const reduce = useReducedMotion();
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!seen) return;
    if (reduce) {
      setVal(to);
      return;
    }
    const ctl = animate(0, to, {
      duration,
      ease: EASE,
      onUpdate: (v) => setVal(Math.round(v)),
      onComplete: () => setVal(to),
    });
    return () => ctl.stop();
  }, [seen, to, duration, reduce]);
  return (
    <span ref={ref} className={className}>
      {prefix}
      {val}
      {suffix}
    </span>
  );
}

/** Wraps children and applies a gentle parallax drift tied to page scroll. */
export function Parallax({
  children,
  offset = 80,
  className,
}: {
  children: React.ReactNode;
  offset?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const scrollYProgress = useElementProgress(ref, 1, 0);
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [offset, -offset]);
  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  );
}

/** 0 when the element's top sits at `from` × viewport height, 1 once it reaches `to` × viewport height. */
export function useEnterProgress(ref: React.RefObject<HTMLElement | null>, from = 1, to = 0.6) {
  const p = useMotionValue(0);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const vh = window.innerHeight;
      const top = el.getBoundingClientRect().top;
      p.set(Math.min(1, Math.max(0, (from * vh - top) / ((from - to) * vh))));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ref, from, to, p]);
  return p;
}

const TileProgressContext = createContext<MotionValue<number> | null>(null);

/** Scroll progress (0→1) of the enclosing <TileIn>, for content that animates as its box assembles. */
export function useTileProgress() {
  const fallback = useMotionValue(1);
  return useContext(TileProgressContext) ?? fallback;
}

/**
 * A box that assembles as it scrolls into view: it rises, un-tilts, scales up and fades in, tied to
 * scroll position (so it reverses when you scroll back). `index` staggers boxes in the same row.
 * On hover it tilts gently toward the pointer.
 */
export function TileIn({
  children,
  index = 0,
  className = "",
  innerClassName = "",
}: {
  children: React.ReactNode;
  index?: number;
  className?: string;
  innerClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();
  const shift = index * 0.07;
  const scrollP = useEnterProgress(ref, 1.02 - shift, 0.6 - shift);
  const done = useMotionValue(1);
  const p = reduce ? done : scrollP;

  const y = useDerived(p, (v) => 110 * (1 - ramp(v, 0, 1)), []);
  const scale = useDerived(p, (v) => mix(0.86, 1, ramp(v, 0, 1)), []);
  const rotateX = useDerived(p, (v) => mix(20, 0, ramp(v, 0, 1)), []);
  const opacity = useDerived(p, (v) => ramp(v, 0, 0.55), []);

  const tiltX = useSpring(0, { stiffness: 180, damping: 18 });
  const tiltY = useSpring(0, { stiffness: 180, damping: 18 });
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    tiltY.set(((e.clientX - r.left) / r.width - 0.5) * 7);
    tiltX.set(-((e.clientY - r.top) / r.height - 0.5) * 7);
  };
  const onLeave = () => {
    tiltX.set(0);
    tiltY.set(0);
  };

  return (
    // The measured wrapper never transforms, so progress doesn't feed back on itself.
    <div ref={ref} className={className}>
      <motion.div className="h-full" style={{ y, scale, rotateX, opacity, transformPerspective: 1200 }}>
        <motion.div
          className={`h-full ${innerClassName}`}
          style={{ rotateX: tiltX, rotateY: tiltY, transformPerspective: 900 }}
          onPointerMove={onMove}
          onPointerLeave={onLeave}
        >
          <TileProgressContext.Provider value={p}>{children}</TileProgressContext.Provider>
        </motion.div>
      </motion.div>
    </div>
  );
}
