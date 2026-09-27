import { HushMascot } from "./HushMascot";
import { CheckIcon } from "./Icons";

const PLAN_ORDER = ["READING", "FILTERING", "COMPOSING", "BALANCING", "CHECKING", "DONE"];
const MEDIATE_ORDER = ["READING", "MAPPING", "DRAFTING", "CHECKING", "DONE"];

type Props = { stage: string; memberCount: number; venueCount?: number | null; kind?: "PLAN" | "MEDIATE" };

export function PlanningStepper({ stage, memberCount, venueCount, kind = "PLAN" }: Props) {
  const mediate = kind === "MEDIATE";
  const at = (mediate ? MEDIATE_ORDER : PLAN_ORDER).indexOf(stage);
  const steps = mediate
    ? [
        { label: `Heard ${memberCount} sides privately`, until: 1 },
        { label: "Found common ground", until: 2 },
        { label: "Drafted a way forward", until: 3 },
        { label: "Checking nothing private shows", until: 4 },
      ]
    : [
        { label: `Read ${memberCount} private chats`, until: 1 },
        { label: venueCount ? `Found ${venueCount} places that fit everyone` : "Finding places that fit everyone", until: 3 },
        { label: "Balancing everyone's costs", until: 4 },
        { label: "Checking nothing private shows", until: 5 },
      ];
  const starts = mediate ? [0, 1, 2, 3] : [0, 1, 3, 4];

  return (
    <div className="flex flex-col gap-[18px] rounded-card bg-bubble p-5">
      <div className="flex items-center gap-[10px]">
        <HushMascot size={36} />
        <p className="text-question">
          {stage === "FAILED" ? "Hush got stuck" : mediate ? "Hush is finding a way forward" : stage === "DONE" ? "Hush made a plan" : "Hush is planning"}
        </p>
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
                  <CheckIcon size={14} stroke={3} className="text-on-ink" />
                </span>
              ) : active ? (
                <svg width="26" height="26" viewBox="0 0 26 26" className="shrink-0 animate-spin" aria-hidden="true">
                  <circle cx="13" cy="13" r="10" fill="none" strokeWidth="3" className="stroke-track" />
                  <path d="M13 3a10 10 0 0 1 10 10" fill="none" strokeWidth="3" strokeLinecap="round" className="stroke-hush" />
                </svg>
              ) : (
                <span className="h-[26px] w-[26px] shrink-0 rounded-full border-2 border-track" />
              )}
              {s.label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
