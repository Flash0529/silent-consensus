"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { bubbleMotion } from "./HushBubble";
import { money } from "@/lib/format";

export type ChipInState = {
  open: boolean;
  responded: boolean;
  suggestCents: number;
  maxCents: number;
  poolCents: number;
  needCents: number;
  myChipInCents: number;
};

type Props = { state: ChipInState; baseCents: number; onSubmit: (cents: number) => Promise<void> | void; busy?: boolean };

export function ChipInCard({ state, baseCents, onSubmit, busy }: Props) {
  // $0 / $5 / $10 by default; when less is needed, offer exactly what's left.
  const presets = state.maxCents >= 1000 ? [0, 500, 1000] : state.maxCents >= 500 ? [0, 500, state.maxCents] : [0, state.maxCents];
  const uniquePresets = [...new Set(presets)];
  const [amount, setAmount] = useState(Math.min(state.suggestCents, state.maxCents));
  const [other, setOther] = useState(false);
  const [otherText, setOtherText] = useState("");
  const pct = state.needCents ? Math.min(100, Math.round((state.poolCents / state.needCents) * 100)) : 100;
  const chosen = other ? Math.min(Math.round((Number(otherText) || 0) * 100), state.maxCents) : amount;

  return (
    <motion.div {...bubbleMotion} className="mr-[22px] flex flex-col gap-[14px] self-stretch rounded-card bg-bubble p-[18px]">
      <div className="flex flex-col gap-1.5">
        <p className="text-question">Want to quietly help?</p>
        <p className="text-secondary text-ink-2">
          Someone in the group needs a little room to make this work. Add any amount and Hush applies it. No one sees who
          gave or who it helped.
        </p>
      </div>
      <div className={`grid gap-2 ${uniquePresets.length === 3 ? "grid-cols-4" : "grid-cols-3"}`} role="radiogroup" aria-label="Amount">
        {uniquePresets.map((c) => {
          const disabled = c > state.maxCents;
          const sel = !other && amount === c;
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={sel}
              disabled={disabled || busy}
              onClick={() => {
                setOther(false);
                setAmount(c);
              }}
              className={`h-row rounded-btn text-body font-semibold disabled:opacity-35 ${
                sel ? "bg-ink text-white" : "border border-hairline bg-surface"
              }`}
            >
              {money(c)}
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={other}
          disabled={busy}
          onClick={() => setOther(true)}
          className={`h-row rounded-btn text-body font-semibold ${other ? "bg-ink text-white" : "border border-hairline bg-surface"}`}
        >
          Other
        </button>
      </div>
      {other && (
        <label className="flex items-center gap-2 rounded-btn border border-hairline bg-surface px-4">
          <span className="text-body text-muted">$</span>
          <input
            inputMode="decimal"
            autoFocus
            aria-label="Other amount in dollars"
            value={otherText}
            onChange={(e) => setOtherText(e.target.value.replace(/[^0-9.]/g, ""))}
            className="h-row w-full bg-transparent text-body outline-none"
            placeholder={`Up to ${money(state.maxCents)}`}
          />
        </label>
      )}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-secondary">
          <span className="font-medium">Group pool</span>
          <span className="text-ink-2">
            {money(state.poolCents)} of {money(state.needCents)}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-control" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <motion.div className="h-full rounded-full bg-hush" initial={{ width: 0 }} animate={{ width: `${pct}%` }} />
        </div>
      </div>
      <p className="text-secondary text-ink-2">
        {chosen > 0
          ? `Your total would be ${money(baseCents + chosen)}: your ${money(baseCents)} share plus ${money(chosen)}.`
          : `Your total stays ${money(baseCents)}.`}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => onSubmit(0)}
          className="h-row rounded-btn bg-hairline text-body font-medium disabled:opacity-50"
        >
          Not this time
        </button>
        <button
          type="button"
          disabled={busy || chosen <= 0}
          onClick={() => onSubmit(chosen)}
          className="h-row rounded-btn bg-ink text-body font-medium text-white disabled:opacity-40"
        >
          {chosen > 0 ? `Chip in ${money(chosen)}` : "Chip in"}
        </button>
      </div>
    </motion.div>
  );
}
