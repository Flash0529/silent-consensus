"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import useSWR, { mutate as globalMutate } from "swr";
import { Avatar } from "@/components/AvatarStack";
import { HushMascot } from "@/components/HushMascot";
import { Verified } from "@/components/Verified";
import { coarsePointer, useArmed } from "@/components/useArmed";
import { api, fetcher } from "@/lib/client";
import type { ChatSummary } from "@/lib/useAccount";

// One chat in a chat list (phone home screen and the desktop chat pane).
// Press and hold (right-click on a computer): a preview of the latest messages, plus Delete.
export function ChatRow({ c, active = false }: { c: ChatSummary; active?: boolean }) {
  const [peek, setPeek] = useState(false);
  const [peekTouch, setPeekTouch] = useState(false);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const cancel = () => {
    if (hold.current) clearTimeout(hold.current);
    hold.current = null;
  };
  const handlers = {
    onTouchStart: () => {
      held.current = false;
      cancel();
      hold.current = setTimeout(() => {
        held.current = true;
        navigator.vibrate?.(8);
        setPeekTouch(true);
        setPeek(true);
      }, 450);
    },
    onTouchMove: cancel,
    onTouchEnd: (e: React.TouchEvent) => {
      cancel();
      if (held.current) e.preventDefault(); // no tap (and no navigation) after a long press
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      if (held.current) return; // Android long press: the hold timer already opened it
      setPeekTouch(coarsePointer());
      setPeek(true);
    },
    onClick: (e: React.MouseEvent) => {
      // The long press already opened the preview; don't also open the chat.
      if (held.current) {
        e.preventDefault();
        held.current = false;
      }
    },
  };
  return (
    <>
      <ChatRowLink c={c} active={active} handlers={handlers} onDelete={() => setPeek(true)} />
      {peek && typeof document !== "undefined" && createPortal(<ChatPeek c={c} active={active} viaTouch={peekTouch} onClose={() => setPeek(false)} />, document.body)}
    </>
  );
}

/** Hush's own chat, always pinned at the top (verified ✓). A dot when it's waiting on you. */
export function HushWaitingRows({ chats, active = false }: { chats: ChatSummary[]; active?: boolean }) {
  const waiting = chats.filter((c) => c.hushWaiting);
  const first = waiting[0];
  return (
    <li>
      <Link
        href={first ? `/hush?c=${first.slug}` : "/hush"}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-bubble ${first ? "bg-hush/10" : ""} ${active ? "bg-bubble" : ""}`}
      >
        <span className="relative shrink-0">
          <HushMascot size={52} />
          {first && <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface bg-galaxy" />}
        </span>
        <span className="min-w-0 grow">
          <span className="flex items-center gap-1.5">
            <span className={`truncate text-[17px] ${first ? "font-bold" : "font-semibold"}`}>Hush</span>
            <Verified size={16} />
            <span className="ml-auto shrink-0 text-caption text-muted">private</span>
          </span>
          <span className={`block truncate text-secondary ${first ? "text-ink" : "text-muted"}`}>
            {first
              ? `Waiting on you: “${first.hushWaiting}”${waiting.length > 1 ? ` +${waiting.length - 1} more` : ""}`
              : "Your private planning chat"}
          </span>
        </span>
      </Link>
    </li>
  );
}

function ChatRowLink({
  c,
  active,
  handlers,
  onDelete,
}: {
  c: ChatSummary;
  active: boolean;
  handlers: Record<string, (e: never) => void>;
  onDelete: () => void;
}) {
  const last = c.last;
  const preview = last
    ? last.kind === "EVENT"
      ? last.body
      : last.kind === "PLAN"
        ? `Hush shared a plan: ${last.body}`
        : `${last.from ? `${last.from}: ` : ""}${last.body}`
    : "No messages yet";
  const when = last ? relTime(last.at) : "";
  const status =
    c.status === "PROPOSED" ? "Plan ready · vote" : c.status === "PLANNING" ? "Hush is planning…" : c.status === "CONFIRMED" ? "Plan confirmed" : null;
  const first = c.faces[0];
  return (
    <li className="group/row relative">
      {/* Delete (computers: shows on hover; phones: press and hold the chat). */}
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete or leave ${c.title}`}
        title="Delete chat"
        className="absolute bottom-2.5 right-2 z-[1] hidden h-8 w-8 items-center justify-center rounded-full bg-surface text-muted shadow-sm hover:text-danger focus:flex group-hover/row:flex"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
        </svg>
      </button>
      <Link
        href={`/c/${c.slug}/group`}
        aria-current={active ? "page" : undefined}
        {...handlers}
        className={`flex items-center gap-3 rounded-2xl px-3 py-3 [-webkit-touch-callout:none] hover:bg-bubble max-md:select-none ${active ? "bg-bubble" : ""}`}
      >
        <div className="relative shrink-0">
          {first ? (
            <Avatar m={{ id: c.slug, name: c.title, avatarColor: first.avatarColor, photo: c.photo }} size={52} />
          ) : (
            <span className="block h-[52px] w-[52px] rounded-full bg-bubble" />
          )}
        </div>
        <div className="min-w-0 grow">
          <div className="flex items-baseline gap-2">
            <span className={`truncate text-[17px] ${c.unread ? "font-bold" : "font-semibold"}`}>{c.title}</span>
            <span className="ml-auto shrink-0 text-caption text-muted">{when}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`truncate text-secondary ${c.unread ? "text-ink" : "text-muted"}`}>{preview}</span>
            {c.unread > 0 && (
              <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-galaxy px-1.5 text-[12px] font-bold text-white">
                {c.unread > 99 ? "99+" : c.unread}
              </span>
            )}
          </div>
          {status && <span className="text-caption font-medium text-galaxy">{status}</span>}
        </div>
      </Link>
    </li>
  );
}

type PeekMsg = {
  id: string;
  kind: string;
  body: string;
  mine: boolean;
  createdAt: string;
  sender: { name: string } | null;
  ask?: { question: string } | null;
};

/** The press-and-hold preview: the last few messages and what you can do with the chat. */
function ChatPeek({ c, active, viaTouch, onClose }: { c: ChatSummary; active: boolean; viaTouch: boolean; onClose: () => void }) {
  const { armed, open } = useArmed();
  useEffect(() => open(viaTouch), [open, viaTouch]);
  const router = useRouter();
  const { data } = useSWR<{ messages: PeekMsg[] }>(`/api/circles/${c.slug}/messages?limit=8`, fetcher);
  const [confirm, setConfirm] = useState<null | "me" | "everyone" | "leave">(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [openedAt] = useState(() => Date.now());
  const first = c.faces[0];
  const msgs = (data?.messages ?? []).filter((m) => m.kind === "TEXT" || m.kind === "HUSH" || m.kind === "PLAN" || m.kind === "ASK");

  const del = async (scope: "me" | "everyone" | "leave") => {
    setBusy(true);
    setErr("");
    try {
      if (scope === "leave") await api(`/api/circles/${c.slug}/leave`, { method: "POST" });
      else await api(`/api/circles/${c.slug}/delete`, { method: "POST", body: JSON.stringify({ scope }) });
      await globalMutate("/api/auth/me");
      onClose();
      if (active) router.push("/start");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't delete this chat.");
      setBusy(false);
    }
  };
  const markRead = async () => {
    await api(`/api/circles/${c.slug}/read`, { method: "POST" }).catch(() => {});
    globalMutate("/api/auth/me");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/30 px-4 backdrop-blur-md"
      style={{ pointerEvents: armed ? "auto" : "none" }}
      onClick={() => {
        // Lifting the finger after the long press can arrive as a tap: don't let it close the preview.
        if (armed && Date.now() - openedAt > 450) onClose();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-[420px] flex-col gap-3" role="dialog" aria-label={`Preview of ${c.title}`}>
        <div className="overflow-hidden rounded-[24px] border border-hairline bg-surface shadow-float">
          <div className="flex items-center gap-3 border-b border-divider px-4 py-3">
            {first ? (
              <Avatar m={{ id: c.slug, name: c.title, avatarColor: first.avatarColor, photo: c.photo }} size={36} />
            ) : (
              <span className="block h-9 w-9 rounded-full bg-bubble" />
            )}
            <span className="min-w-0">
              <span className="block truncate text-[17px] font-semibold">{c.title}</span>
              <span className="block text-caption text-muted">{c.isDirect ? "Direct message" : `${c.members} ${c.members === 1 ? "person" : "people"}`}</span>
            </span>
          </div>
          <div className="flex max-h-[44vh] min-h-[120px] flex-col gap-1.5 overflow-y-auto px-3 py-3">
            {!data && <p className="m-auto text-secondary text-muted">Loading…</p>}
            {data && !msgs.length && <p className="m-auto text-secondary text-muted">No messages yet</p>}
            {msgs.map((m) => {
              const hush = m.kind !== "TEXT";
              return (
                <div key={m.id} className={`flex ${m.mine && !hush ? "justify-end" : "justify-start"}`}>
                  <span
                    className={`max-w-[80%] whitespace-pre-wrap break-words rounded-[18px] px-3 py-2 text-secondary [overflow-wrap:anywhere] ${
                      m.mine && !hush ? "bg-galaxy text-white" : hush ? "border border-hush/25 bg-hush/15" : "bg-bubble"
                    }`}
                  >
                    {!m.mine && (
                      <span className="flex items-center gap-1 text-caption font-semibold opacity-70">
                        {hush && <HushMascot size={12} />}
                        {hush ? "Hush" : m.sender?.name}
                      </span>
                    )}
                    <span className="line-clamp-4">{m.kind === "ASK" ? (m.ask?.question ?? m.body) : m.body.split("\n")[0]}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div role="menu" className="w-[260px] self-center overflow-hidden rounded-2xl border border-hairline bg-surface shadow-float">
          {confirm ? (
            <div className="p-4">
              <p className="text-body font-semibold">{confirm === "everyone" ? "Delete for everyone?" : confirm === "leave" ? "Leave this group?" : "Delete this chat?"}</p>
              <p className="mt-1 text-caption text-muted">
                {confirm === "everyone"
                  ? "The chat, its messages, cards and everyone's private answers are gone for everybody. This can't be undone."
                  : confirm === "leave"
                    ? "You'll stop getting its messages. Your messages stay in the chat. If you're the only admin, the person who's been here longest takes over."
                    : "Its messages disappear for you. If someone sends something new, the chat comes back with just that."}
              </p>
              {err && <p className="mt-2 text-caption text-danger">{err}</p>}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setConfirm(null)} className="h-10 rounded-full bg-bubble text-secondary font-semibold">
                  Cancel
                </button>
                <button type="button" disabled={busy} onClick={() => del(confirm)} className="h-10 rounded-full bg-danger text-secondary font-semibold text-white disabled:opacity-60">
                  {busy ? "One sec…" : confirm === "leave" ? "Leave" : "Delete"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <Link role="menuitem" href={`/c/${c.slug}/group`} onClick={onClose} className="flex items-center justify-between px-4 py-3 text-body hover:bg-bubble">
                Open chat <span aria-hidden>→</span>
              </Link>
              {c.unread > 0 && (
                <button role="menuitem" type="button" onClick={markRead} className="flex w-full items-center justify-between border-t border-divider px-4 py-3 text-left text-body hover:bg-bubble">
                  Mark as read <span aria-hidden>✓</span>
                </button>
              )}
              <button role="menuitem" type="button" onClick={() => setConfirm("me")} className="flex w-full items-center justify-between border-t border-divider px-4 py-3 text-left text-body text-danger hover:bg-bubble">
                {c.canDeleteForEveryone ? "Delete for me" : "Delete chat"} <span aria-hidden>🗑</span>
              </button>
              {!c.isDirect && (
                <button role="menuitem" type="button" onClick={() => setConfirm("leave")} className="flex w-full items-center justify-between border-t border-divider px-4 py-3 text-left text-body text-danger hover:bg-bubble">
                  Leave group <span aria-hidden>↪</span>
                </button>
              )}
              {c.canDeleteForEveryone && (
                <button role="menuitem" type="button" onClick={() => setConfirm("everyone")} className="flex w-full items-center justify-between border-t border-divider px-4 py-3 text-left text-body text-danger hover:bg-bubble">
                  Delete for everyone <span aria-hidden>🗑</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function relTime(iso: string) {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (d.toDateString() === new Date().toDateString()) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const days = Math.round(mins / 1440);
  if (days < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
