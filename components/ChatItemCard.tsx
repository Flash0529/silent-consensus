"use client";

import { CalendarIcon, CheckIcon, CloseIcon } from "@/components/Icons";

// Cards for things Hush noticed in the group chat on its own: events (meetings in work groups),
// to-dos (action items) and decisions. One-tap responses; Add to calendar needs no sign-in.

export type ChatItem = {
  id: string;
  kind: "EVENT" | "TASK" | "DECISION";
  title: string;
  startsAt: string | null;
  whenText: string | null;
  place: string | null;
  owner: string | null;
  details: string | null;
  status: "OPEN" | "DONE" | "DISMISSED";
  mine: "IN" | "MAYBE" | "OUT" | null;
  // Answers are private: only a count is ever shown, never who answered what.
  answered: number;
  total: number;
  outcome: "ALL_IN" | "NOT_ALL" | null;
  // Hush is checking in with everyone privately about this plan right now.
  checking?: boolean;
  // A real place / event Hush found: where to book it, get tickets, or see it on a map.
  book?: { resy: string | null; opentable: string | null; tickets: string | null; website: string | null; maps: string } | null;
  // Planned with Hush: every part in order (concert, then food), and your own share (only yours).
  parts?: PlanPart[] | null;
  costCents?: number | null;
  myShare?: { finalCents: number; paid: boolean } | null;
};

type Links = { resy: string | null; opentable: string | null; tickets: string | null; website: string | null; maps: string };
export type PlanPart = { label: string; whenText: string | null; place: string | null; address: string | null; why: string | null; links: Links | null };
const money = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;

const fmtWhen = (i: ChatItem) =>
  i.startsAt
    ? new Date(i.startsAt).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : i.whenText;

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function calendarLinks(i: ChatItem, work: boolean) {
  if (!i.startsAt) return null;
  const start = new Date(i.startsAt);
  const end = new Date(start.getTime() + (work ? 60 : 120) * 60_000);
  const details = `${i.details ? i.details + "\n\n" : ""}Planned in Silent Consensus`;
  const google =
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    `&text=${encodeURIComponent(i.title)}&dates=${stamp(start)}/${stamp(end)}` +
    `&location=${encodeURIComponent(i.place ?? "")}&details=${encodeURIComponent(details)}`;
  const outlookBase = work ? "https://outlook.office.com" : "https://outlook.live.com";
  const outlook =
    `${outlookBase}/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent` +
    `&subject=${encodeURIComponent(i.title)}&startdt=${encodeURIComponent(start.toISOString())}&enddt=${encodeURIComponent(end.toISOString())}` +
    `&location=${encodeURIComponent(i.place ?? "")}&body=${encodeURIComponent(details)}`;
  return { google, outlook };
}

export function kindLabel(kind: ChatItem["kind"], work: boolean) {
  if (kind === "EVENT") return work ? "Meeting" : "Plan";
  if (kind === "TASK") return work ? "Action item" : "To-do";
  return "Decision";
}

export function ChatItemCard({
  item,
  work,
  updated = false,
  onRespond,
  onStatus,
}: {
  item: ChatItem;
  work: boolean;
  updated?: boolean;
  onRespond: (id: string, answer: "IN" | "MAYBE" | "OUT") => void;
  onStatus: (id: string, status: "OPEN" | "DONE" | "DISMISSED") => void;
}) {
  const when = fmtWhen(item);
  const cal = item.kind === "EVENT" ? calendarLinks(item, work) : null;
  const done = item.status === "DONE";

  const pick = (a: "IN" | "MAYBE" | "OUT", label: string) => (
    <button
      type="button"
      onClick={() => onRespond(item.id, a)}
      className={`h-9 rounded-full px-3.5 text-secondary font-semibold transition ${
        item.mine === a ? "bg-galaxy text-white" : "bg-surface text-ink hover:bg-hairline"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className={`w-full max-w-[420px] rounded-[20px] border border-hush/25 bg-hush/10 p-4 ${done ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-2">
        <span className="grow text-caption font-semibold uppercase tracking-wide text-hush">
          {updated ? "Updated · " : "Hush noticed · "}
          {kindLabel(item.kind, work)}
        </span>
        <button type="button" aria-label="Remove" title="Remove" onClick={() => onStatus(item.id, "DISMISSED")} className="-mr-1 -mt-1 rounded-full p-1 text-muted hover:text-ink">
          <CloseIcon size={16} />
        </button>
      </div>
      <p className={`mt-1 text-[18px] font-semibold leading-snug ${done ? "line-through" : ""}`}>{item.title}</p>
      {(when || item.place) && (
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-secondary text-ink-2">
          {when && (
            <span className="flex items-center gap-1.5">
              <CalendarIcon size={14} />
              {item.kind === "TASK" ? `Due ${when}` : when}
            </span>
          )}
          {item.place && <span>· {item.place}</span>}
        </p>
      )}
      {item.kind === "TASK" && item.owner && <p className="mt-0.5 text-secondary text-ink-2">Owner: {item.owner}</p>}
      {item.details && <p className="mt-1 text-secondary text-muted">{item.details}</p>}

      {item.kind === "EVENT" && item.parts && item.parts.length > 0 && item.outcome === "ALL_IN" && (
        <>
          <ol className="mt-3 flex flex-col gap-2.5">
            {item.parts.map((p, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-galaxy/15 text-[11px] font-bold text-galaxy">{i + 1}</span>
                <span className="min-w-0">
                  <span className="block text-secondary font-semibold">{p.label}</span>
                  {(p.whenText || p.place) && (
                    <span className="block text-caption text-ink-2">
                      {[p.whenText, p.place && [p.place, p.address].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
                    </span>
                  )}
                  {p.links && (
                    <span className="mt-1 flex flex-wrap gap-1.5 text-caption font-semibold">
                      {p.links.tickets && <ExtLink href={p.links.tickets} strong>Get tickets</ExtLink>}
                      {p.links.resy && <ExtLink href={p.links.resy} strong>Book on Resy</ExtLink>}
                      {p.links.opentable && <ExtLink href={p.links.opentable}>OpenTable</ExtLink>}
                      {p.links.website && <ExtLink href={p.links.website}>Website</ExtLink>}
                      <ExtLink href={p.links.maps}>{p.place ? "Map" : "Find on Maps"}</ExtLink>
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-2.5 flex items-center gap-1.5 text-caption text-muted">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            Confirmed privately with everyone
            {item.costCents ? ` · about ${money(item.costCents)} each` : ""}
          </p>
          {item.myShare && (
            <p className="mt-1.5 text-caption text-ink-2">
              Your share: <span className="font-semibold">{money(item.myShare.finalCents)}</span>
              {item.myShare.paid ? " · paid ✓" : (
                <>
                  {" · "}
                  <a href="/hush" className="font-semibold text-galaxy hover:underline">Pay in your Hush chat</a>
                </>
              )}
            </p>
          )}
        </>
      )}
      {item.kind === "EVENT" && item.checking && item.outcome !== "ALL_IN" && (
        <p className="mt-3 text-secondary text-ink-2">
          Hush is planning this with everyone privately.{" "}
          <a href="/hush" className="font-semibold text-galaxy hover:underline">Open your Hush chat</a>
        </p>
      )}
      {item.kind === "EVENT" && !item.checking && !(item.parts && item.parts.length > 0 && item.outcome === "ALL_IN") && (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {pick("IN", work ? "Attending" : "I'm in")}
            {pick("MAYBE", "Maybe")}
            {pick("OUT", work ? "Can't attend" : "Can't")}
          </div>
          <p className="mt-2.5 flex items-center gap-1.5 text-caption text-muted">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            {item.outcome === "ALL_IN"
              ? "Everyone's in"
              : item.checking
                ? "Hush is checking in with everyone privately"
                : item.outcome === "NOT_ALL"
                  ? "Hush is finding something that works for everyone"
                  : `Answers are private · ${item.answered} of ${item.total} answered`}
            {item.mine && <span className="text-ink-2">· you: {item.mine === "IN" ? (work ? "attending" : "in") : item.mine === "MAYBE" ? "maybe" : "can't"}</span>}
          </p>
          {item.book && (
            <div className="mt-3 flex flex-wrap gap-2 text-secondary font-semibold">
              {item.book.tickets && <ExtLink href={item.book.tickets} strong>Get tickets</ExtLink>}
              {item.book.resy && <ExtLink href={item.book.resy} strong>Book on Resy</ExtLink>}
              {item.book.opentable && <ExtLink href={item.book.opentable}>OpenTable</ExtLink>}
              {item.book.website && <ExtLink href={item.book.website}>Website</ExtLink>}
              <ExtLink href={item.book.maps}>Map</ExtLink>
            </div>
          )}
          {cal && (
            <div className="mt-3 flex flex-wrap gap-3 text-secondary font-semibold">
              {work ? (
                <>
                  <a href={cal.outlook} target="_blank" rel="noreferrer" className="text-galaxy hover:underline">Add to Outlook</a>
                  <a href={cal.google} target="_blank" rel="noreferrer" className="text-galaxy hover:underline">Google Calendar</a>
                </>
              ) : (
                <>
                  <a href={cal.google} target="_blank" rel="noreferrer" className="text-galaxy hover:underline">Add to Google Calendar</a>
                  <a href={cal.outlook} target="_blank" rel="noreferrer" className="text-galaxy hover:underline">Outlook</a>
                </>
              )}
            </div>
          )}
        </>
      )}
      {item.kind === "TASK" && (
        <button
          type="button"
          onClick={() => onStatus(item.id, done ? "OPEN" : "DONE")}
          className={`mt-3 flex h-9 items-center gap-2 rounded-full px-3.5 text-secondary font-semibold ${done ? "bg-galaxy text-white" : "bg-surface hover:bg-hairline"}`}
        >
          <CheckIcon size={14} stroke={3} /> {done ? "Done" : "Mark done"}
        </button>
      )}
    </div>
  );
}

function ExtLink({ href, strong = false, children }: { href: string; strong?: boolean; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={`inline-flex h-8 items-center rounded-full px-3 ${strong ? "bg-galaxy text-white hover:bg-galaxy-hover" : "bg-surface text-ink hover:bg-hairline"}`}
    >
      {children}
    </a>
  );
}

/** Everything Hush noticed in this chat (desktop tab / phone sheet). */
export function ItemsList({
  items,
  work,
  onRespond,
  onStatus,
}: {
  items: ChatItem[];
  work: boolean;
  onRespond: (id: string, answer: "IN" | "MAYBE" | "OUT") => void;
  onStatus: (id: string, status: "OPEN" | "DONE" | "DISMISSED") => void;
}) {
  if (!items.length)
    return (
      <p className="px-2 py-8 text-center text-secondary text-muted">
        Nothing yet. As you chat, Hush pins {work ? "meetings, action items and decisions" : "plans, to-dos and decisions"} here on its own.
      </p>
    );
  const groups: [string, ChatItem[]][] = [
    [work ? "Meetings" : "Plans", items.filter((i) => i.kind === "EVENT")],
    [work ? "Action items" : "To-dos", items.filter((i) => i.kind === "TASK")],
    ["Decisions", items.filter((i) => i.kind === "DECISION")],
  ];
  return (
    <div className="flex flex-col gap-6">
      {groups
        .filter(([, list]) => list.length)
        .map(([label, list]) => (
          <section key={label}>
            <h3 className="mb-2 text-caption font-semibold uppercase tracking-wide text-muted">{label}</h3>
            <div className="flex flex-col gap-3">
              {list.map((i) => (
                <ChatItemCard key={i.id} item={i} work={work} onRespond={onRespond} onStatus={onStatus} />
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
