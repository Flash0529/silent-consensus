"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A press-and-hold menu shouldn't react to the finger that opened it. On Android, lifting that finger
 * "taps" whatever is under it (an emoji, Reply, Open chat…). So after a touch opens the menu, it
 * ignores touches until the finger is up (plus a beat for the tap Android fires after it).
 */
export function useArmed() {
  const [armed, setArmed] = useState(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clear, []);
  const open = useCallback((viaTouch: boolean) => {
    clear();
    if (!viaTouch) return setArmed(true);
    setArmed(false);
    const arm = () => {
      clear();
      timers.current.push(setTimeout(() => setArmed(true), 380));
      for (const ev of ["touchend", "touchcancel", "pointerup", "pointercancel"]) window.removeEventListener(ev, arm, true);
    };
    for (const ev of ["touchend", "touchcancel", "pointerup", "pointercancel"]) window.addEventListener(ev, arm, { capture: true, once: true });
    timers.current.push(setTimeout(() => setArmed(true), 1600)); // fallback
  }, []);
  return { armed, open };
}

export const coarsePointer = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
