"use client";

import { motion } from "framer-motion";

export const bubbleMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.18, ease: "easeOut" as const },
};

export function HushBubble({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      {...bubbleMotion}
      className="max-w-[300px] self-start whitespace-pre-wrap rounded-bubble bg-bubble px-[18px] py-[14px] text-body"
    >
      {children}
    </motion.div>
  );
}

export function MemberBubble({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      {...bubbleMotion}
      className="max-w-[280px] self-end whitespace-pre-wrap rounded-bubble bg-ink px-[18px] py-[14px] text-body text-on-ink"
    >
      {children}
    </motion.div>
  );
}

export function TypingDots() {
  return (
    <motion.div
      {...bubbleMotion}
      className="flex items-center gap-1.5 self-start rounded-bubble bg-bubble px-5 py-[18px]"
      role="status"
      aria-label="Hush is typing"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-2 w-2 rounded-full bg-muted"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </motion.div>
  );
}
