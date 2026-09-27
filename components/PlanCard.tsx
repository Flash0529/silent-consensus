"use client";

import { motion } from "framer-motion";
import { CalendarIcon, CheckIcon, LockIcon } from "./Icons";
import type { GroupStop } from "@/lib/serialize";

type Props = {
  title: string;
  dateLabel: string;
  stops: GroupStop[];
  whyItWorks: string[];
  leakCheckPassed: boolean;
};

export function PlanCard({ title, dateLabel, stops, whyItWorks, leakCheckPassed }: Props) {
  const anyDemo = stops.some((s) => s.demoVenue);
  return (
    <motion.article
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="flex flex-col gap-[14px] rounded-card bg-bubble p-[18px]"
    >
      <div className="flex flex-col gap-1.5 px-1">
        <h2 className="text-card-title">{title}</h2>
        <p className="flex items-center gap-1.5 text-secondary text-ink-2">
          <CalendarIcon />
          {dateLabel}
        </p>
      </div>
      <ol className="overflow-hidden rounded-list border border-hairline bg-surface">
        {stops.map((s, i) => (
          <li key={i} className={`flex gap-[14px] px-4 py-3 ${i < stops.length - 1 ? "border-b border-divider" : ""}`}>
            <span className="w-[62px] shrink-0 pt-0.5 text-[14px] font-semibold">{s.time}</span>
            <div className="flex flex-col gap-0.5">
              <span className="text-[16px] font-semibold">{s.name}</span>
              <span className="text-[14px] text-muted">{s.note}</span>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-2 px-1">
        <p className="text-secondary font-semibold">Why this works</p>
        <ul className="flex flex-col gap-1.5">
          {whyItWorks.map((w, i) => (
            <li key={i} className="flex items-center gap-2 text-secondary text-ink-2">
              <CheckIcon size={16} stroke={2.6} />
              {w}
            </li>
          ))}
        </ul>
        {leakCheckPassed && (
          <p className="mt-0.5 flex items-center gap-1.5 text-caption text-muted">
            <LockIcon />
            Checked: nothing anyone told Hush shows here
          </p>
        )}
        {anyDemo && <p className="text-caption text-muted">Demo venues: details not yet verified.</p>}
      </div>
    </motion.article>
  );
}
