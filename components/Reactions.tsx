"use client";

import { useState } from "react";

// Tapbacks, like iMessage: press and hold a message (right-click on a computer) or hover → 🙂.
// One reaction per person per message; picking another replaces it, picking the same one removes it.

export type Reaction = { emoji: string; count: number; mine: boolean; names: string[] };

export const TAPBACKS = ["❤️", "👍", "👎", "😂", "‼️", "❓"];
const MORE = ["😮", "😢", "🔥", "🎉", "🙏", "👀", "💯", "😍", "🤔", "😭", "👏", "✅"];

export function ReactionBar({ current, onPick }: { current: string | null; onPick: (emoji: string) => void }) {
  const [more, setMore] = useState(false);
  const list = more ? [...TAPBACKS, ...MORE] : TAPBACKS;
  return (
    <div
      role="toolbar"
      aria-label="React"
      className={`flex flex-wrap items-center gap-0.5 rounded-[26px] border border-hairline bg-surface p-1.5 shadow-float ${more ? "max-w-[292px]" : ""}`}
    >
      {list.map((e) => (
        <button
          key={e}
          type="button"
          aria-label={`React ${e}`}
          aria-pressed={current === e}
          onClick={() => onPick(e)}
          className={`flex h-10 w-10 items-center justify-center rounded-full text-[22px] transition hover:scale-110 hover:bg-bubble ${current === e ? "bg-galaxy/15 ring-1 ring-galaxy" : ""}`}
        >
          {e}
        </button>
      ))}
      {!more && (
        <button
          type="button"
          aria-label="More reactions"
          onClick={() => setMore(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-[18px] font-bold text-muted hover:bg-bubble"
        >
          +
        </button>
      )}
    </div>
  );
}

/** The little reaction pills under a bubble. Tap one to add or remove yours. */
export function ReactionChips({
  reactions,
  mine,
  onToggle,
}: {
  reactions: Reaction[];
  mine: boolean;
  onToggle: (emoji: string) => void;
}) {
  if (!reactions.length) return null;
  return (
    <div className={`relative z-[1] -mt-2 flex flex-wrap gap-1 px-2 ${mine ? "justify-end" : "justify-start"}`}>
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => onToggle(r.emoji)}
          title={r.names.join(", ")}
          aria-label={`${r.emoji} from ${r.names.join(", ")}`}
          className={`flex h-6 items-center gap-1 rounded-full border px-1.5 text-[13px] leading-none shadow-sm ${
            r.mine ? "border-galaxy/60 bg-galaxy/10" : "border-hairline bg-surface"
          }`}
        >
          <span className="text-[14px]">{r.emoji}</span>
          {r.count > 1 && <span className="font-semibold text-ink-2">{r.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Apply my tapback to a reaction list locally (so it shows instantly, before the server answers). */
export function applyReaction(list: Reaction[], emoji: string): Reaction[] {
  const prev = list.find((r) => r.mine)?.emoji ?? null;
  let out = list
    .map((r) => (r.mine ? { ...r, count: r.count - 1, mine: false, names: r.names.filter((n) => n !== "You") } : r))
    .filter((r) => r.count > 0);
  if (prev !== emoji) {
    const hit = out.find((r) => r.emoji === emoji);
    out = hit
      ? out.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true, names: ["You", ...r.names] } : r))
      : [...out, { emoji, count: 1, mine: true, names: ["You"] }];
  }
  return out;
}
