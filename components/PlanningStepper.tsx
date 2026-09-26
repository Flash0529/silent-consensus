import { HushMascot } from "./HushMascot";
import { CheckIcon } from "./Icons";

const ORDER = ["READING", "FILTERING", "COMPOSING", "BALANCING", "CHECKING", "DONE"];

type Props = { stage: string; memberCount: number; venueCount?: number | null };

export function PlanningStepper({ stage, memberCount, venueCount }: Props) {
  const at = ORDER.indexOf(stage);
  const steps = [
    { label: `Read ${memberCount} private chats`, until: 1 },
    { label: venueCount ? `Found ${venueCount} places that fit everyone` : "Finding places that fit everyone", until: 3 },
    { label: "Balancing everyone's costs", until: 4 },
    { label: "Checking nothing private shows", until: 5 },
  ];
  const starts = [0, 1, 3, 4];

  return (
    <div className="flex flex-col gap-[18px] rounded-card bg-bubble p-5">
      <div className="flex items-center gap-[10px]">
        <HushMascot size={36} />
        <p className="text-question">{stage === "DONE" ? "Hush made a plan" : "Hush is planning"}</p>
      </div>
      <ol className="flex flex-col gap-[14px]" aria-live="polite">
        {steps.map((s, i) => {
          const done = at >= s.until;
          const active = !done && at >= starts[i];
          return (
            <li
              key={i}
              className={`flex items-center gap-3 text-[16px] ${active ? "font-medium" : ""} ${!done && !active ? "text-muted" : ""}`}
            >
              {done ? (
                <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-ink">
                  <CheckIcon size={14} color="#FFFFFF" stroke={3} />
                </span>
              ) : active ? (
                <svg width="26" height="26" viewBox="0 0 26 26" className="shrink-0 animate-spin" aria-hidden="true">
                  <circle cx="13" cy="13" r="10" fill="none" stroke="#D1D1D6" strokeWidth="3" />
                  <path d="M13 3a10 10 0 0 1 10 10" fill="none" stroke="#5B3DF5" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : (
                <span className="h-[26px] w-[26px] shrink-0 rounded-full border-2 border-[#D1D1D6]" />
              )}
              {s.label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
