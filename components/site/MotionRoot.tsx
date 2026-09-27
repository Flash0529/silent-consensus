"use client";

import { MotionConfig } from "framer-motion";

/** Honors the visitor's reduced-motion setting for every framer animation on the site. */
export function MotionRoot({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
