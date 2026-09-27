"use client";

import { useEffect, useState } from "react";

// Startup animation for the marketing site (docs/HANDOFF.md §5). The sequence itself is pure CSS
// (app/globals.css, `.intro*`) so it plays from the very first paint, before hydration. JS only
// decides when to lift it: after a minimum beat and the fonts, or at once if the visitor clicks,
// scrolls or presses a key. It lives in the (site) layout, so it plays on a full load, not on
// client-side navigation between pages. Reduced motion skips it (CSS hides it, JS finishes at once).

const BUBBLE =
  "M60 12c26.5 0 48 18.8 48 42s-21.5 42-48 42c-5.9 0-11.6-.9-16.8-2.6L22 104l5.6-18.2C18.1 78.1 12 66.7 12 54 12 30.8 33.5 12 60 12z";

const MIN_MS = 2000;

export function Intro() {
  const [phase, setPhase] = useState<"show" | "leave" | "gone">("show");

  useEffect(() => {
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    let left = false;

    const announce = () => {
      window.__qcIntroDone = true;
      window.dispatchEvent(new Event("qc:intro-done"));
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      announce();
      setPhase("gone");
      return;
    }

    html.style.overflow = "hidden";
    const leave = () => {
      if (left) return;
      left = true;
      html.style.overflow = prevOverflow;
      setPhase("leave");
      announce();
    };

    const wait = Math.max(0, MIN_MS - performance.now());
    const timer = setTimeout(() => {
      Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 1200))]).then(leave);
    }, wait);
    const events = ["keydown", "pointerdown", "wheel", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, leave, { passive: true }));

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, leave));
      html.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    if (phase !== "leave") return;
    const t = setTimeout(() => setPhase("gone"), 900);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "gone") return null;

  return (
    <div className={`intro ${phase === "leave" ? "intro-leave" : ""}`} aria-hidden>
      <div className="intro-stage">
        <span className="intro-glow" />
        <svg className="intro-mark" viewBox="0 0 120 120" width="104" height="104">
          <path className="intro-fill" d={BUBBLE} fill="#5B3DF5" />
          <path className="intro-outline" d={BUBBLE} fill="none" stroke="#8F7BFF" strokeWidth="2" pathLength={1} />
          <path
            className="intro-eye"
            d="M40 55c3.4 4.8 11.6 4.8 15 0"
            fill="none"
            stroke="#ffffff"
            strokeWidth="5.5"
            strokeLinecap="round"
            pathLength={1}
          />
          <path
            className="intro-eye intro-eye-2"
            d="M65 55c3.4 4.8 11.6 4.8 15 0"
            fill="none"
            stroke="#ffffff"
            strokeWidth="5.5"
            strokeLinecap="round"
            pathLength={1}
          />
        </svg>
        <p className="intro-word">Hush</p>
        <span className="intro-line">
          <span />
        </span>
      </div>
    </div>
  );
}
