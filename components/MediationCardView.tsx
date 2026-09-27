"use client";

import { motion } from "framer-motion";
import { CalendarIcon, CheckIcon, LockIcon } from "./Icons";

export type MediationCardData = {
  title: string;
  commonGround: string[];
  whatMatters: string[];
  proposal: { step: string; detail: string }[];
  conversationGuide: { groundRules: string[]; openers: string[] };
  checkIn: string;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-1">
      <p className="text-secondary font-semibold">{title}</p>
      {children}
    </div>
  );
}

function Checks({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((w, i) => (
        <li key={i} className="flex items-start gap-2 text-secondary text-ink-2">
          <span className="mt-0.5">
            <CheckIcon size={16} stroke={2.6} />
          </span>
          {w}
        </li>
      ))}
    </ul>
  );
}

export function MediationCardView({ card, leakCheckPassed }: { card: MediationCardData; leakCheckPassed: boolean }) {
  return (
    <motion.article
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="flex flex-col gap-4 rounded-card bg-bubble p-[18px]"
    >
      <div className="flex flex-col gap-1.5 px-1">
        <h2 className="text-card-title">{card.title}</h2>
        <p className="flex items-center gap-1.5 text-secondary text-ink-2">
          <CalendarIcon />
          {card.checkIn}
        </p>
      </div>
      <Section title="What you all share">
        <Checks items={card.commonGround} />
      </Section>
      <Section title="What matters to this group">
        <Checks items={card.whatMatters} />
      </Section>
      <ol className="overflow-hidden rounded-list border border-hairline bg-surface">
        <li className="border-b border-divider px-4 py-2.5 text-secondary font-semibold">A way forward</li>
        {card.proposal.map((p, i) => (
          <li key={i} className={`flex gap-3 px-4 py-3 ${i < card.proposal.length - 1 ? "border-b border-divider" : ""}`}>
            <span className="flex h-badge w-badge shrink-0 items-center justify-center rounded-badge bg-ink text-[14px] font-medium text-white">
              {i + 1}
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-[16px] font-semibold">{p.step}</span>
              <span className="text-[14px] text-ink-2">{p.detail}</span>
            </div>
          </li>
        ))}
      </ol>
      <Section title="How to talk about it">
        <Checks items={card.conversationGuide.groundRules} />
        {card.conversationGuide.openers.map((o, i) => (
          <p key={i} className="rounded-list border border-hairline bg-surface px-4 py-3 text-secondary italic text-ink-2">
            “{o}”
          </p>
        ))}
      </Section>
      {leakCheckPassed && (
        <p className="flex items-center gap-1.5 px-1 text-caption text-muted">
          <LockIcon />
          Checked: no one is quoted, and nothing private shows here
        </p>
      )}
    </motion.article>
  );
}
