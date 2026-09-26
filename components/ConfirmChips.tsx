"use client";

import { motion } from "framer-motion";
import { bubbleMotion } from "./HushBubble";
import { CheckIcon } from "./Icons";

export function ConfirmChips({ chips }: { chips: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="What Hush heard">
      {chips.map((c, i) => (
        <motion.li
          key={i}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 * i, duration: 0.18 }}
          className="flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-2 text-secondary font-medium"
        >
          <CheckIcon size={14} stroke={2.8} />
          {c}
        </motion.li>
      ))}
    </ul>
  );
}

/** Hush's "here's what I heard" card: lead line, chips, then the lettered options. */
export function ConfirmCard({ lead, chips, children }: { lead?: string; chips: string[]; children?: React.ReactNode }) {
  return (
    <motion.div {...bubbleMotion} className="mr-[22px] flex flex-col gap-3 self-stretch rounded-card bg-bubble p-[18px]">
      {lead && <p className="text-body">{lead}</p>}
      <ConfirmChips chips={chips} />
      {children}
    </motion.div>
  );
}
