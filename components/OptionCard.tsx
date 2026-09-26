"use client";

import { motion } from "framer-motion";
import { CheckIcon } from "./Icons";
import { bubbleMotion } from "./HushBubble";

const LETTERS = "ABCDE";

type Props = {
  question?: string;
  options: string[];
  selected?: number | null;
  disabled?: boolean;
  onPick?: (index: number) => void;
};

export function OptionCard({ question, options, selected = null, disabled, onPick }: Props) {
  return (
    <motion.div
      {...bubbleMotion}
      className="mr-[22px] flex flex-col gap-[14px] self-stretch rounded-card bg-bubble px-3 pb-3 pt-[18px]"
    >
      {question && <p className="px-2 text-question">{question}</p>}
      <div className="flex flex-col overflow-hidden rounded-list border border-hairline bg-surface">
        {options.slice(0, 5).map((opt, i) => {
          const isSel = selected === i;
          return (
            <motion.button
              key={i}
              type="button"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i, duration: 0.18 }}
              aria-pressed={isSel}
              disabled={disabled}
              onClick={() => onPick?.(i)}
              className={`flex min-h-row w-full items-center gap-[14px] px-4 py-2 text-left text-body ${
                i < options.length - 1 ? "border-b border-divider" : ""
              } ${isSel ? "bg-surface-2" : "bg-surface"} ${disabled && !isSel ? "text-ink-2" : ""} active:bg-surface-2`}
            >
              <span
                className={`flex h-badge w-badge shrink-0 items-center justify-center rounded-badge text-[14px] font-medium ${
                  isSel ? "bg-ink text-white" : "bg-bubble text-muted"
                }`}
              >
                {LETTERS[i]}
              </span>
              <span className="grow">{opt}</span>
              {isSel && <CheckIcon />}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
