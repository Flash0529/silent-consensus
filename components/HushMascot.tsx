"use client";

import { useEffect, useRef } from "react";

// Blink choreography, in ms. Each step is [time, openness 0..1, easing into the next step].
type Step = [number, number, string?];

const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const EASE_IN_OUT = "cubic-bezier(0.45, 0, 0.55, 1)";

// One slow open on arrival, a beat of looking around, and back to sleep.
const WAKE: Step[] = [
  [0, 0, EASE_OUT],
  [560, 1.04, EASE_IN_OUT],
  [700, 1, "linear"],
  [1500, 1, EASE_IN_OUT],
  [1850, 0],
];

// Idle: a single, unhurried peek.
const PEEK: Step[] = [
  [0, 0, EASE_OUT],
  [420, 1, "linear"],
  [950, 1, EASE_IN_OUT],
  [1300, 0],
];

// Closed pose for the open eye: squashed flat onto the lid line and hidden.
const SHUT_SCALE = 0.12;
// Where the eyes close to: 72% down the oval, on the lid curve.
const EYE_PIVOT_Y = 45 + 17 * 0.72;

function eyeFrames(steps: Step[]) {
  const total = steps[steps.length - 1][0];
  return steps.map(([t, o, easing]) => ({
    offset: t / total,
    easing: easing ?? "linear",
    transform: `scaleY(${SHUT_SCALE + (1 - SHUT_SCALE) * o})`,
    opacity: Math.min(1, o * 4),
  }));
}

function lidFrames(steps: Step[]) {
  const total = steps[steps.length - 1][0];
  return steps.map(([t, o, easing]) => ({
    offset: t / total,
    easing: easing ?? "linear",
    opacity: Math.max(0, 1 - o * 4),
  }));
}

export function HushMascot({
  size = 36,
  label,
  animated = false,
  color = "#5B3DF5",
}: {
  size?: number;
  label?: string;
  /** Body colour (the marketing site uses other finishes). */
  color?: string;
  /** Wake-up blink on mount, then an occasional idle peek. */
  animated?: boolean;
}) {
  const stroke = size < 40 ? 8 : size < 80 ? 6.5 : 5.5;
  const eyes = useRef<SVGGElement>(null);
  const lids = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!animated || !eyes.current || !lids.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const eyeEls = Array.from(eyes.current.children) as SVGElement[];
    const lidEls = Array.from(lids.current.children) as SVGElement[];
    let timer: ReturnType<typeof setTimeout>;
    let running: Animation[] = [];

    const play = (steps: Step[], onDone?: () => void) => {
      const duration = steps[steps.length - 1][0];
      running = [
        ...eyeEls.map((el) => el.animate(eyeFrames(steps), { duration })),
        ...lidEls.map((el) => el.animate(lidFrames(steps), { duration })),
      ];
      if (onDone) running[0].onfinish = onDone;
    };

    const idle = () => {
      timer = setTimeout(
        () => {
          if (document.hidden) return idle();
          play(PEEK, idle);
        },
        5000 + Math.random() * 3000,
      );
    };

    timer = setTimeout(() => play(WAKE, idle), 350);
    return () => {
      clearTimeout(timer);
      running.forEach((a) => a.cancel());
    };
  }, [animated]);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="shrink-0"
    >
      <path
        d="M60 12c26.5 0 48 18.8 48 42s-21.5 42-48 42c-5.9 0-11.6-.9-16.8-2.6L22 104l5.6-18.2C18.1 78.1 12 66.7 12 54 12 30.8 33.5 12 60 12z"
        fill={color}
      />
      <g ref={lids} fill="none" stroke="#fff" strokeWidth={stroke} strokeLinecap="round">
        <path d="M40 55c3.4 4.8 11.6 4.8 15 0" />
        <path d="M65 55c3.4 4.8 11.6 4.8 15 0" />
      </g>
      {animated && (
        // Pivot sits on the lid curve so the ovals close down onto it. The origin is given in
        // viewBox units rather than via transform-box: fill-box, which older iOS Safari
        // ignores for animated transforms (the eyes would scale from the SVG's corner).
        <g ref={eyes} fill="#fff">
          {[47.5, 72.5].map((cx) => (
            <ellipse
              key={cx}
              cx={cx}
              cy={53.5}
              rx={6.5}
              ry={8.5}
              style={{
                transformBox: "view-box",
                transformOrigin: `${cx}px ${EYE_PIVOT_Y}px`,
                transform: `scaleY(${SHUT_SCALE})`,
                opacity: 0,
                willChange: "transform, opacity",
              }}
            />
          ))}
        </g>
      )}
    </svg>
  );
}
