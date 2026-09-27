"use client";

import { useEffect, useRef, useState } from "react";

/** A stylized phone shell. Children render inside the screen. */
export function PhoneFrame({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      // Galaxy Ultra front, matching GalaxyPhone: flat titanium edge, near-square corners, flat display.
      // No drop shadow; separation comes from the stage lighting.
      className={`relative aspect-[9/19] rounded-[20px] p-[3px] ${className}`}
      style={{
        background: "linear-gradient(145deg, #dcdce1 0%, #8e8e93 22%, #f2f2f5 44%, #6e6e73 68%, #c2c2c7 100%)",
        ...style,
      }}
    >
      <div className="h-full w-full rounded-[17px] bg-[#050505] p-[7px]">
        <div className="theme-dark relative h-full w-full overflow-hidden rounded-[11px] bg-black text-porcelain">
          <div className="absolute left-1/2 top-[9px] z-20 h-[11px] w-[11px] -translate-x-1/2 rounded-full bg-[#0a0a0a] shadow-[inset_0_0_0_1.5px_#1f1f23]" />
          {children}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-30"
            style={{ background: "linear-gradient(118deg, rgba(255,255,255,.07) 0%, rgba(255,255,255,0) 30%)" }}
          />
        </div>
      </div>
    </div>
  );
}

const BASE_W = 320;
const BASE_H = 676;

/**
 * Renders the phone at a fixed design size and scales it down to the height
 * of `className`, so the screen content never reflows on small viewports.
 */
export function FitPhone({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, e.contentRect.height / BASE_H)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className={`relative ${className}`} style={{ width: BASE_W * scale }}>
      <PhoneFrame
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: BASE_W, height: BASE_H, transform: `scale(${scale})` }}
      >
        {children}
      </PhoneFrame>
    </div>
  );
}
