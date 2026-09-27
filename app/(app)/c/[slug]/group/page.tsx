"use client";

import { use, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR, { mutate as globalMutate } from "swr";
import { api, fetcher } from "@/lib/client";
import { useCircle, useMe } from "@/lib/useCircle";
import { useAccount } from "@/lib/useAccount";
import { Avatar, AvatarStack } from "@/components/AvatarStack";
import { HushMascot } from "@/components/HushMascot";
import { BackIcon, CloseIcon, LockIcon, SendIcon, ShareIcon } from "@/components/Icons";
import { Sheet } from "@/components/Sheet";
import { InviteCard } from "@/components/InviteCard";
import { DesktopShell } from "@/components/DesktopShell";
import { ChatItemCard, ItemsList, type ChatItem } from "@/components/ChatItemCard";
import { CalendarIcon, DotsIcon } from "@/components/Icons";
import { bgStyle } from "@/lib/chatLook";
import { applyReaction, ReactionBar, ReactionChips, type Reaction } from "@/components/Reactions";
import { Verified } from "@/components/Verified";
import { coarsePointer, useArmed } from "@/components/useArmed";

// The group chat: the main screen of a plan. People message each other here; Hush posts in it too.
// Full window on desktop, phone-sized on phones.
// - Reply to any message (hover → Reply on desktop, swipe right or press and hold on phones): replies
//   live in a thread, like iOS Messages. "2 replies" under a message opens it.
// - Tapbacks: press and hold a message (right-click on a computer), or hover → 🙂.

type Msg = {
  id: string;
  kind: "TEXT" | "HUSH" | "EVENT" | "PLAN" | "ITEM" | "ASK" | "CHECKIN" | "FILE";
  file?: { id: string; name: string; mime: string; size: number; url: string; aiVisible: boolean; needsAnswer: boolean; expiresAt: string } | null;
  checkIn?: { id: string; title: string | null; status: string; stage: string; deletedBy?: string | null; startedAt: string; done: number; total: number; mine: string | null } | null;
  ask?: {
    id: string;
    field?: string;
    question: string;
    options: string[];
    status: string;
    result: string | null;
    answered: number;
    total: number;
    mine: { choice: number | null; text: string | null } | null;
  } | null;
  itemId?: string | null;
  body: string;
  createdAt: string;
  mine: boolean;
  sender: { id: string; name: string; color: string; photo?: string | null } | null;
  replyTo: { id: string; body: string; from: string | null } | null;
  replyToId?: string | null;
  reactions?: Reaction[];
  pending?: boolean;
};

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
};

export default function GroupChatPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const { data: circle } = useCircle(slug);
  const { data: me, error: meError } = useMe(slug);
  const { data: acct } = useAccount();
  const { data, error, mutate } = useSWR<{ messages: Msg[] }>(`/api/circles/${slug}/messages`, fetcher, {
    refreshInterval: 1500,
    revalidateOnFocus: true,
    dedupingInterval: 500,
  });

  const [text, setText] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  // Thread view (iOS-style replies): which thread is open and which message you're replying to.
  const [thread, setThread] = useState<{ rootId: string; target: Msg } | null>(null);
  const [threadText, setThreadText] = useState("");
  // Press and hold a message: the focused preview with tapbacks and actions.
  const [focus, setFocusState] = useState<Msg | null>(null);
  const focusAt = useRef(0);
  const { armed, open: armFocus } = useArmed();
  const setFocus = useCallback(
    (m: Msg | null, viaTouch = false) => {
      focusAt.current = Date.now();
      if (m) armFocus(viaTouch);
      setFocusState(m);
    },
    [armFocus],
  );
  const [flash, setFlash] = useState<string | null>(null);
  const [pending, setPending] = useState<Msg[]>([]);
  const [sendError, setSendError] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  // Desktop tabs (Teams-style). Plan / Hush / Add people open inside the pane.
  const [tab, setTab] = useState<"chat" | "items">("chat");
  const { data: itemsData, mutate: mutateItems } = useSWR<{ mode: string; busy?: boolean; items: ChatItem[] }>(`/api/circles/${slug}/items`, fetcher, {
    refreshInterval: 1500,
  });
  const hushReading = !!itemsData?.busy;
  const items = itemsData?.items ?? [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const work = (itemsData?.mode ?? circle?.mode) === "WORK";
  const upcoming = items.filter((i) => i.status === "OPEN").length;
  const [itemsOpen, setItemsOpen] = useState(false);
  // Work groups: Hush's tone suggestion for a message before it's delivered (only the sender sees it).
  type Policy = { next: number; threshold: number; to: string; willEscalate: boolean } | null;
  const [review, setReview] = useState<{ original: string; suggestion: string; issue: string | null; replyTo: Msg | null; policy?: Policy } | null>(null);
  // Press and hold (or right-click) an empty spot: bring Hush in by hand.
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [hushNote, setHushNote] = useState("");
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const respond = async (id: string, answer: "IN" | "MAYBE" | "OUT") => {
    await api(`/api/circles/${slug}/items/${id}`, { method: "POST", body: JSON.stringify({ answer }) }).catch(() => {});
    mutateItems();
  };
  const setStatus = async (id: string, status: "OPEN" | "DONE" | "DISMISSED") => {
    await api(`/api/circles/${slug}/items/${id}`, { method: "POST", body: JSON.stringify({ status }) }).catch(() => {});
    mutateItems();
    mutate();
  };
  const hushAction = async (action: "plan" | "scan") => {
    setMenu(null);
    setHushNote(action === "scan" ? "Hush is reading the chat…" : "Bringing Hush in…");
    try {
      const r = await api<{ found?: number; updated?: number }>(`/api/circles/${slug}/hush`, { method: "POST", body: JSON.stringify({ action }) });
      setHushNote(action === "scan" ? (r.found || r.updated ? "" : "Hush didn't find anything new to pin.") : "");
      mutate();
      mutateItems();
    } catch (e) {
      setHushNote(e instanceof Error ? e.message : "Hush couldn't do that right now.");
    }
    setTimeout(() => setHushNote(""), 4000);
  };
  const openMenuAt = (x: number, y: number, target: EventTarget | null) => {
    if ((target as HTMLElement | null)?.closest?.('[id^="m-"]')) return false; // that's a message, not empty space
    setMenu({ x: Math.min(x, window.innerWidth - 260), y: Math.min(y, window.innerHeight - 190) });
    return true;
  };
  // Files: upload, then the fixed question "Would you like this to be seen by Hush AI?" (sender only).
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const upload = async (f: File | undefined) => {
    if (!f) return;
    setSendError("");
    if (f.size > 15 * 1024 * 1024) return setSendError("Files can be up to 15 MB.");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", f);
      const r = await fetch(`/api/circles/${slug}/files`, { method: "POST", body: form });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Couldn't upload that file.");
      await mutate();
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Couldn't upload that file.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };
  const answerFile = async (id: string, visible: boolean) => {
    await api(`/api/circles/${slug}/files/${id}`, { method: "POST", body: JSON.stringify({ visible }) }).catch(() => {});
    mutate();
  };

  const planEvent = async () => {
    setMenu(null);
    setHushNote("Opening your Hush chat…");
    try {
      await api(`/api/circles/${slug}/plan-event`, { method: "POST" });
      router.push(`/hush?c=${slug}`);
    } catch (e) {
      setHushNote(e instanceof Error ? e.message : "Couldn't start planning.");
      setTimeout(() => setHushNote(""), 4000);
    }
  };
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nearBottom = useRef(true);
  const lastCount = useRef(0);

  // Not a member (or not logged in): send them to the join page for this plan.
  useEffect(() => {
    const status = (error as { status?: number } | undefined)?.status;
    if (error && (status === 401 || /member/i.test(String(error.message)))) router.replace(`/j/${slug}`);
  }, [error, router, slug]);
  void meError;

  const messages = [...(data?.messages ?? []), ...pending];

  // Hush just stepped in on a plan and wants to ask you something privately: go to your private chat
  // with Hush (once per check-in; if you're typing, the card in the chat waits for you instead).
  const waitingCheckIn = (data?.messages ?? []).find((m) => m.kind === "CHECKIN" && m.checkIn?.status === "OPEN" && m.checkIn.mine === "ASKING")?.checkIn;
  const waitingKey = waitingCheckIn ? `${waitingCheckIn.id}:${waitingCheckIn.stage}` : null;
  useEffect(() => {
    if (!waitingKey || text.trim() || acct?.account?.quiet) return;
    const k = `qc-ci-${waitingKey}`;
    try {
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, "1");
    } catch {
      return;
    }
    const t = setTimeout(() => router.push(`/hush?c=${slug}`), 1800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingKey]);

  // Stick to the bottom when new messages arrive (if you were already there, or it's your message).
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const grew = messages.length > lastCount.current;
    const minePending = pending.length > 0;
    if (lastCount.current === 0 || (grew && (nearBottom.current || minePending))) el.scrollTop = el.scrollHeight;
    lastCount.current = messages.length;
  });

  // Hush's cards load a moment after the messages: keep following the bottom while you're there.
  const itemCount = itemsData?.items.length ?? 0;
  useEffect(() => {
    const el = scroller.current;
    if (el && nearBottom.current) el.scrollTop = el.scrollHeight;
  }, [itemCount, hushReading]);

  // Opened from a search result (#m-<id>): scroll to that message once it's loaded, and flash it.
  const jumped = useRef(false);
  useEffect(() => {
    if (jumped.current || !data) return;
    const id = window.location.hash.match(/^#m-(.+)$/)?.[1];
    if (!id) return;
    jumped.current = true;
    setTimeout(() => {
      document.getElementById(`m-${id}`)?.scrollIntoView({ block: "center" });
      setFlash(id);
      setTimeout(() => setFlash(null), 1800);
    }, 150);
  }, [data]);

  // Mark read while the chat is open.
  const serverCount = data?.messages.length ?? 0;
  useEffect(() => {
    if (!serverCount) return;
    api(`/api/circles/${slug}/read`, { method: "POST" })
      .then(() => globalMutate("/api/auth/me"))
      .catch(() => {});
  }, [serverCount, slug]);

  const threadInputRef = useRef<HTMLTextAreaElement>(null);
  const openThread = useCallback((rootId: string, target: Msg) => {
    setThread({ rootId, target });
    setSelected(null);
    setFocus(null);
    requestAnimationFrame(() => threadInputRef.current?.focus());
  }, []);

  const react = async (m: Msg, emoji: string) => {
    setFocus(null);
    if (m.pending) return;
    await mutate(
      (cur) => (cur ? { messages: cur.messages.map((x) => (x.id === m.id ? { ...x, reactions: applyReaction(x.reactions ?? [], emoji) } : x)) } : cur),
      { revalidate: false },
    );
    await api(`/api/circles/${slug}/messages/${m.id}/react`, { method: "POST", body: JSON.stringify({ emoji }) }).catch(() => {});
    mutate();
  };

  const jumpTo = (id: string) => {
    document.getElementById(`m-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlash(id);
    setTimeout(() => setFlash(null), 1400);
  };

  /** Post a message (optionally as a reply). Work groups may hand back Hush's tone suggestion instead. */
  const post = async (body: string, rt: Msg | null, reviewed = false): Promise<"sent" | "review" | "error"> => {
    const temp: Msg = {
      id: `tmp-${Date.now()}`,
      kind: "TEXT",
      body,
      createdAt: new Date().toISOString(),
      mine: true,
      sender: me?.member ? { id: me.member.id, name: me.member.name, color: me.member.avatarColor } : null,
      replyTo: rt ? { id: rt.id, body: rt.body.split("\n")[0].slice(0, 140), from: whoSent(rt) } : null,
      replyToId: rt?.id ?? null,
      pending: true,
    };
    setPending((p) => [...p, temp]);
    setSendError("");
    try {
      const r = await api<{ review?: { issue: string | null; suggestion: string; policy?: Policy }; escalated?: boolean }>(`/api/circles/${slug}/messages`, {
        method: "POST",
        body: JSON.stringify({ body, ...(rt ? { replyToId: rt.id } : {}), ...(reviewed ? { reviewed: true } : {}) }),
      });
      if (r.review) {
        // Not delivered: show the sender Hush's suggestion and let them choose.
        setReview({ original: body, suggestion: r.review.suggestion, issue: r.review.issue, replyTo: rt, policy: r.review.policy ?? null });
        return "review";
      }
      setReview(null);
      if (r.escalated) {
        setHushNote("Shared with your manager (or HR) for review, per your company's policy.");
        setTimeout(() => setHushNote(""), 8000);
      }
      await mutate();
      globalMutate("/api/auth/me");
      return "sent";
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Couldn't send.");
      return "error";
    } finally {
      setPending((p) => p.filter((m) => m.id !== temp.id));
    }
  };

  const send = async (override?: { body: string; replyTo: Msg | null; reviewed: true }) => {
    const body = (override?.body ?? text).trim();
    if (!body) return;
    const rt = override ? override.replyTo : null;
    if (!override) setText("");
    const r = await post(body, rt, !!override);
    if (r === "error" && !override) setText(body);
  };

  const sendInThread = async (override?: { body: string; reviewed: true }) => {
    if (!thread) return;
    const body = (override?.body ?? threadText).trim();
    if (!body) return;
    if (!override) setThreadText("");
    const r = await post(body, thread.target, !!override);
    if (r === "error" && !override) setThreadText(body);
  };

  // Threads: every reply belongs to the thread of the first message in its reply chain.
  const parentOf = new Map(messages.map((m) => [m.id, m.replyToId ?? m.replyTo?.id ?? null]));
  const rootOf = (id: string) => {
    let cur = id;
    for (let i = 0; i < 60; i++) {
      const p = parentOf.get(cur);
      if (!p || !parentOf.has(p)) return cur;
      cur = p;
    }
    return cur;
  };
  const replyCount = new Map<string, number>();
  for (const m of messages) {
    if (!parentOf.get(m.id)) continue;
    const r = rootOf(m.id);
    if (r !== m.id) replyCount.set(r, (replyCount.get(r) ?? 0) + 1);
  }
  const threadRoot = thread ? messages.find((m) => m.id === thread.rootId) : undefined;
  const threadMsgs = thread ? messages.filter((m) => m.id !== thread.rootId && rootOf(m.id) === thread.rootId) : [];
  const threadScroller = useRef<HTMLDivElement>(null);
  const threadLen = threadMsgs.length;
  useEffect(() => {
    const el = threadScroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread?.rootId, threadLen]);

  // DMs show the other person; chat settings (color / background / photo) apply to everyone.
  const dm = !!circle?.isDirect;
  const other = dm ? circle?.members.find((m) => m.id !== me?.member?.id) : undefined;
  const chatTitle = dm ? (other?.name ?? "…") : (circle?.title ?? "…");
  const accent = circle?.color ?? "#0381fe";
  // Admins add people (and see the invite link); everyone else just chats.
  const amAdmin = !!circle?.members.find((m) => m.id === me?.member?.id)?.isAdmin;


  return (
    <DesktopShell active={slug}>
    <div className="fixed inset-0 z-10 flex justify-center bg-surface lg:absolute lg:z-auto">
      <div className="flex h-dvh w-full max-w-3xl flex-col md:border-x md:border-divider lg:h-full lg:max-w-none lg:border-x-0">
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-divider px-3 py-2.5 pt-[max(10px,env(safe-area-inset-top))]">
          <Link href="/start" aria-label="All chats" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-bubble lg:hidden">
            <BackIcon />
          </Link>
          <Link href={`/c/${slug}/settings`} title="Chat settings and people" className="flex min-w-0 grow items-center gap-3 rounded-full py-1 pr-2 hover:bg-bubble/60 lg:grow-0 lg:pl-2">
            {circle &&
              (dm && other ? (
                <Avatar m={other} size={34} />
              ) : circle.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={circle.photo} alt="" className="h-[34px] w-[34px] shrink-0 rounded-full object-cover" />
              ) : (
                <AvatarStack members={circle.members} size={30} max={3} />
              ))}
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="truncate text-[17px] font-semibold">{chatTitle}</span>
                {work && <span className="shrink-0 rounded-md bg-bubble px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Work</span>}
              </span>
              <span className="block truncate text-caption text-muted">
                {circle ? (
                  <>
                    {dm ? "Direct message" : `${circle.members.length} ${circle.members.length === 1 ? "person" : "people"}`}
                    {!dm && <span className="lg:hidden"> · tap for settings & people</span>}
                  </>
                ) : (
                  ""
                )}
              </span>
            </span>
          </Link>
          <nav aria-label="Group tabs" className="ml-2 hidden grow items-center gap-1 self-stretch lg:flex">
            {(
              [
                ["chat", "Chat"],
                ["items", work ? "Meetings & tasks" : "Events & to-dos"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={tab === id ? "page" : undefined}
                className={`relative flex h-full items-center px-3 text-secondary font-semibold transition ${tab === id ? "text-ink" : "text-muted hover:text-ink"}`}
              >
                {label}
                {id === "items" && upcoming > 0 && (
                  <span className="ml-1.5 rounded-full bg-hush/25 px-1.5 text-[11px] font-bold text-ink">{upcoming}</span>
                )}
                {tab === id && <span className="absolute inset-x-3 -bottom-[11px] h-[3px] rounded-full bg-galaxy" />}
              </button>
            ))}
          </nav>
          <button
            type="button"
            onClick={planEvent}
            title="Plan an event with Hush"
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-galaxy px-3.5 text-secondary font-semibold text-white hover:bg-galaxy-hover"
          >
            <CalendarIcon size={16} /> <span className="hidden sm:inline">Plan event</span>
          </button>
          {!dm && amAdmin && (
            <Link href={`/c/${slug}/add`} title="Add people" aria-label="Add people" className="hidden h-10 shrink-0 items-center rounded-full px-3 text-secondary font-semibold text-muted hover:bg-bubble hover:text-ink lg:flex">
              Add people
            </Link>
          )}
          {!dm && amAdmin && (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              aria-label="Invite friends"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-bubble"
            >
              <ShareIcon size={20} />
            </button>
          )}
          <Link href={`/c/${slug}/settings`} aria-label="Chat settings" title="Chat settings" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-bubble">
            <DotsIcon />
          </Link>
          <button
            type="button"
            onClick={() => setItemsOpen(true)}
            aria-label={work ? "Meetings and tasks" : "Events and to-dos"}
            className="relative flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-bubble px-3 text-secondary font-semibold hover:bg-hairline lg:hidden"
          >
            <CalendarIcon size={17} />
            {upcoming > 0 && <span>{upcoming}</span>}
          </button>
        </header>

        {tab === "items" && (
          <div className="hidden grow overflow-y-auto px-8 py-6 lg:block">
            <ItemsList items={items} work={work} onRespond={respond} onStatus={setStatus} />
          </div>
        )}

        {/* Messages */}
        <div
          ref={scroller}
          onContextMenu={(e) => {
            if (openMenuAt(e.clientX, e.clientY, e.target)) e.preventDefault();
          }}
          onTouchStart={(e) => {
            const t = e.touches[0];
            const target = e.target;
            holdTimer.current = setTimeout(() => openMenuAt(t.clientX, t.clientY, target), 550);
          }}
          onTouchMove={() => holdTimer.current && clearTimeout(holdTimer.current)}
          onTouchEnd={() => holdTimer.current && clearTimeout(holdTimer.current)}
          onScroll={(e) => {
            const el = e.currentTarget;
            nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
          }}
          className={`flex grow flex-col overflow-y-auto overscroll-contain px-3 py-4 sm:px-5 lg:px-8 ${tab !== "chat" ? "lg:hidden" : ""}`}
          style={bgStyle(circle?.bgImage)}
        >
          {!data && !error && <p className="m-auto text-secondary text-muted">Loading chat…</p>}
          {data && messages.length === 0 && (
            <p className="m-auto max-w-[260px] text-center text-secondary text-muted">
              No messages yet. Say hi, then invite friends with the share button.
            </p>
          )}
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
            const sameRun =
              !newDay && prev && prev.kind === m.kind && prev.sender?.id === m.sender?.id &&
              +new Date(m.createdAt) - +new Date(prev.createdAt) < 5 * 60_000;
            return (
              <div key={m.id}>
                {newDay && (
                  <p className="my-3 text-center text-caption font-medium text-muted">{dayLabel(m.createdAt)}</p>
                )}
                <Row
                  m={m}
                  item={m.itemId ? byId.get(m.itemId) : undefined}
                  work={work}
                  accent={accent}
                  onRespond={respond}
                  onStatus={setStatus}
                  slug={slug}
                  showHead={!sameRun}
                  selected={selected === m.id}
                  flash={flash === m.id}
                  onSelect={() => setSelected((s) => (s === m.id ? null : m.id))}
                  onReply={() => openThread(rootOf(m.id), m)}
                  onOpenThread={() => openThread(rootOf(m.id), messages.find((x) => x.id === rootOf(m.id)) ?? m)}
                  replies={replyCount.get(m.id) ?? 0}
                  onFocus={(viaTouch) => {
                    setSelected(null);
                    setFocus(m, viaTouch);
                  }}
                  onReact={(e) => react(m, e)}
                  hushName={circle?.hush?.botName}
                />
              </div>
            );
          })}
          {hushReading && (
            <div className="mt-3 flex items-center gap-2" aria-live="polite">
              <HushMascot size={24} />
              <span className="flex items-center gap-1 rounded-full bg-hush/15 px-3 py-2">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-hush [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-hush [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-hush" />
              </span>
              <span className="text-caption text-muted">Hush is reading the chat…</span>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className={`border-t border-divider px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 sm:px-5 lg:px-8 ${tab !== "chat" ? "lg:hidden" : ""}`}>
          {sendError && <p className="mb-2 text-caption text-danger">{sendError}</p>}
          {hushNote && <p className="mb-2 flex items-center gap-2 text-caption text-muted"><HushMascot size={16} /> {hushNote}</p>}
          {(() => {
            const ask = messages.find((m) => m.kind === "FILE" && m.file?.needsAnswer);
            if (!ask?.file) return null;
            return (
              <div className="mb-2 rounded-2xl border border-hush/30 bg-hush/10 p-3" role="dialog" aria-label="Should Hush see this file?">
                <p className="text-body font-semibold">Would you like this to be seen by Hush AI?</p>
                <p className="mt-0.5 text-caption text-muted">
                  “{ask.file.name}” · Hush can&apos;t open a file unless you say yes. Files are deleted after 7 days.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button type="button" onClick={() => answerFile(ask.file!.id, false)} className="h-9 rounded-full bg-galaxy px-4 text-secondary font-semibold text-white">
                    No, keep it private
                  </button>
                  <button type="button" onClick={() => answerFile(ask.file!.id, true)} className="h-9 rounded-full bg-bubble px-4 text-secondary font-semibold hover:bg-hairline">
                    Yes, Hush can see it
                  </button>
                </div>
              </div>
            );
          })()}
          {review && !thread && (
            <ReviewPanel
              review={review}
              onUse={() => send({ body: review.suggestion, replyTo: review.replyTo, reviewed: true })}
              onMine={() => send({ body: review.original, replyTo: review.replyTo, reviewed: true })}
              onEdit={() => {
                setText(review.original);
                setReview(null);
                inputRef.current?.focus();
              }}
            />
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-end gap-2"
          >
            <input ref={fileInput} type="file" hidden accept="image/*,.pdf,.txt,.csv,.md,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip" onChange={(e) => upload(e.target.files?.[0])} />
            <button
              type="button"
              aria-label="Attach a photo or file"
              title="Attach a photo or file (deleted after 7 days)"
              disabled={!data || uploading}
              onClick={() => fileInput.current?.click()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-bubble text-muted hover:text-ink disabled:opacity-50"
            >
              {uploading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-transparent" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M21 11.5 12.4 20a5 5 0 0 1-7.1-7.1l8.6-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.5a1.7 1.7 0 0 1-2.4-2.4l7.9-7.8" />
                </svg>
              )}
            </button>
            <textarea
              ref={inputRef}
              rows={1}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
              }}
              onKeyDown={(e) => {
                // Enter sends; Shift+Enter makes a new line.
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={data ? "Message" : "Loading…"}
              disabled={!data}
              aria-label="Message"
              className="max-h-[140px] min-h-[44px] grow resize-none rounded-[22px] bg-bubble px-4 py-[11px] text-body text-ink outline-none outline-offset-1 placeholder:text-muted focus:outline-1 focus:outline-galaxy"
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={!text.trim() || !data}
              style={text.trim() && data ? { background: accent } : undefined}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-galaxy text-white transition hover:opacity-90 disabled:bg-hairline disabled:text-muted"
            >
              <SendIcon size={19} />
            </button>
          </form>
        </div>
      </div>

      {thread && (
        <div
          role="dialog"
          aria-label="Thread"
          className="fixed inset-0 z-40 flex flex-col bg-surface/90 backdrop-blur-xl lg:absolute lg:inset-y-0 lg:left-auto lg:right-0 lg:w-[420px] lg:border-l lg:border-divider lg:bg-surface lg:shadow-float"
        >
          <header className="flex items-center gap-2 border-b border-divider px-3 py-2.5 pt-[max(10px,env(safe-area-inset-top))]">
            <span className="grow pl-2">
              <span className="block text-[17px] font-semibold">Thread</span>
              <span className="block text-caption text-muted">
                {threadMsgs.length ? `${threadMsgs.length} ${threadMsgs.length === 1 ? "reply" : "replies"}` : "No replies yet"}
              </span>
            </span>
            {threadRoot && (
              <button
                type="button"
                onClick={() => {
                  const id = thread.rootId;
                  setThread(null);
                  setTimeout(() => jumpTo(id), 60);
                }}
                className="rounded-full px-3 py-1.5 text-secondary font-semibold text-galaxy hover:bg-bubble"
              >
                Show in chat
              </button>
            )}
            <button type="button" aria-label="Close thread" onClick={() => setThread(null)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-bubble">
              <CloseIcon />
            </button>
          </header>
          <div ref={threadScroller} className="flex grow flex-col overflow-y-auto overscroll-contain px-3 py-4 sm:px-5">
            {[...(threadRoot ? [threadRoot] : []), ...threadMsgs].map((m, i) => (
              <div key={m.id} className={i === 0 ? "border-b border-divider pb-4" : ""}>
                <Row
                  m={m}
                  item={m.itemId ? byId.get(m.itemId) : undefined}
                  work={work}
                  accent={accent}
                  onRespond={respond}
                  onStatus={setStatus}
                  slug={slug}
                  showHead
                  selected={selected === m.id}
                  flash={false}
                  onSelect={() => setSelected((s) => (s === m.id ? null : m.id))}
                  onReply={() => {
                    setThread({ rootId: thread.rootId, target: m });
                    threadInputRef.current?.focus();
                  }}
                  onOpenThread={() => {}}
                  replies={0}
                  onFocus={(viaTouch) => setFocus(m, viaTouch)}
                  onReact={(e) => react(m, e)}
                  threadRootId={thread.rootId}
                />
              </div>
            ))}
            {!threadRoot && <p className="m-auto text-secondary text-muted">This message isn&apos;t loaded anymore.</p>}
          </div>
          <div className="border-t border-divider px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 sm:px-5">
            {thread.target.id !== thread.rootId && (
              <div className="mb-2 flex items-center gap-3 rounded-2xl bg-bubble px-3 py-2">
                <span className="w-1 self-stretch rounded-full bg-galaxy" />
                <span className="min-w-0 grow">
                  <span className="block text-caption font-semibold text-galaxy">Replying to {whoSent(thread.target) ?? "message"}</span>
                  <span className="block truncate text-secondary text-ink-2">{thread.target.body.split("\n")[0]}</span>
                </span>
                <button
                  type="button"
                  aria-label="Reply to the thread instead"
                  onClick={() => threadRoot && setThread({ rootId: thread.rootId, target: threadRoot })}
                  className="text-muted hover:text-ink"
                >
                  <CloseIcon size={18} />
                </button>
              </div>
            )}
            {sendError && <p className="mb-2 text-caption text-danger">{sendError}</p>}
            {review && (
              <ReviewPanel
                review={review}
                onUse={() => sendInThread({ body: review.suggestion, reviewed: true })}
                onMine={() => sendInThread({ body: review.original, reviewed: true })}
                onEdit={() => {
                  setThreadText(review.original);
                  setReview(null);
                  threadInputRef.current?.focus();
                }}
              />
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendInThread();
              }}
              className="flex items-end gap-2"
            >
              <textarea
                ref={threadInputRef}
                rows={1}
                value={threadText}
                onChange={(e) => {
                  setThreadText(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    sendInThread();
                  }
                  if (e.key === "Escape") setThread(null);
                }}
                placeholder="Reply in thread"
                aria-label="Reply in thread"
                className="max-h-[140px] min-h-[44px] grow resize-none rounded-[22px] bg-bubble px-4 py-[11px] text-body text-ink outline-none outline-offset-1 placeholder:text-muted focus:outline-1 focus:outline-galaxy"
              />
              <button
                type="submit"
                aria-label="Send reply"
                disabled={!threadText.trim()}
                style={threadText.trim() ? { background: accent } : undefined}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-galaxy text-white transition hover:opacity-90 disabled:bg-hairline disabled:text-muted"
              >
                <SendIcon size={19} />
              </button>
            </form>
          </div>
        </div>
      )}

      {focus && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/30 px-4 backdrop-blur-md"
          style={{ pointerEvents: armed ? "auto" : "none" }}
          onClick={() => {
            // Lifting the finger after a long press can arrive as a tap: don't let it close the preview.
            if (armed && Date.now() - focusAt.current > 450) setFocus(null);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setFocus(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`flex w-full max-w-[440px] flex-col gap-2.5 ${focus.mine && focus.kind === "TEXT" ? "items-end" : "items-start"}`}
          >
            <ReactionBar current={focus.reactions?.find((r) => r.mine)?.emoji ?? null} onPick={(e) => react(focus, e)} />
            <div
              style={focus.mine && focus.kind === "TEXT" ? { background: accent } : undefined}
              className={`max-h-[40vh] max-w-full overflow-y-auto whitespace-pre-wrap break-words rounded-[20px] px-4 py-2.5 text-body shadow-float [overflow-wrap:anywhere] ${
                focus.mine && focus.kind === "TEXT" ? "text-white" : focus.kind === "TEXT" ? "bg-bubble text-ink" : "border border-hush/25 bg-surface text-ink"
              }`}
            >
              {!(focus.mine && focus.kind === "TEXT") && <span className="block text-caption font-semibold text-muted">{whoSent(focus) ?? "Hush"}</span>}
              {focus.kind === "ITEM" ? (byId.get(focus.itemId ?? "")?.title ?? "Hush's card") : focus.kind === "ASK" ? (focus.ask?.question ?? focus.body) : focus.body}
            </div>
            <div role="menu" className="w-[250px] overflow-hidden rounded-2xl border border-hairline bg-surface shadow-float">
              <button role="menuitem" type="button" onClick={() => openThread(rootOf(focus.id), focus)} className="flex w-full items-center justify-between px-4 py-3 text-left text-body hover:bg-bubble">
                Reply <span aria-hidden>↩</span>
              </button>
              {(replyCount.get(rootOf(focus.id)) ?? 0) > 0 && (
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => openThread(rootOf(focus.id), messages.find((x) => x.id === rootOf(focus.id)) ?? focus)}
                  className="flex w-full items-center justify-between border-t border-divider px-4 py-3 text-left text-body hover:bg-bubble"
                >
                  View thread <span className="text-caption text-muted">{replyCount.get(rootOf(focus.id))}</span>
                </button>
              )}
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  const t = focus.kind === "ITEM" ? (byId.get(focus.itemId ?? "")?.title ?? "") : focus.kind === "ASK" ? (focus.ask?.question ?? "") : focus.body;
                  navigator.clipboard?.writeText(t).catch(() => {});
                  setFocus(null);
                }}
                className="flex w-full items-center justify-between border-t border-divider px-4 py-3 text-left text-body hover:bg-bubble"
              >
                Copy <span aria-hidden>⧉</span>
              </button>
              <p className="border-t border-divider px-4 py-2 text-caption text-muted">
                {dayLabel(focus.createdAt)} · {time(focus.createdAt)}
              </p>
            </div>
          </div>
        </div>
      )}

      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }} />
          <div
            role="menu"
            style={{ left: menu.x, top: menu.y }}
            className="fixed z-50 w-[250px] overflow-hidden rounded-2xl border border-hairline bg-bubble py-1 shadow-float"
          >
            <p className="flex items-center gap-2 px-4 py-2 text-caption font-semibold text-muted">
              <HushMascot size={16} /> Hush
            </p>
            <button role="menuitem" type="button" onClick={planEvent} className="block w-full px-4 py-2.5 text-left text-body hover:bg-hairline">
              Plan an event
              <span className="block text-caption text-muted">Tell Hush what you want; it checks with everyone privately</span>
            </button>
            <Link role="menuitem" href={`/hush?c=${slug}`} onClick={() => setMenu(null)} className="block px-4 py-2.5 text-body hover:bg-hairline">
              Talk to Hush privately
              <span className="block text-caption text-muted">Only you and Hush see it</span>
            </Link>
            <button role="menuitem" type="button" onClick={() => hushAction("scan")} className="block w-full px-4 py-2.5 text-left text-body hover:bg-hairline">
              Scan the chat now
              <span className="block text-caption text-muted">Pins {work ? "meetings and action items" : "plans and to-dos"}</span>
            </button>
          </div>
        </>
      )}
      <Sheet open={itemsOpen} onClose={() => setItemsOpen(false)} label={work ? "Meetings & tasks" : "Events & to-dos"}>
        <h2 className="mb-4 text-card-title">{work ? "Meetings & tasks" : "Events & to-dos"}</h2>
        <div className="max-h-[65vh] overflow-y-auto">
          <ItemsList items={items} work={work} onRespond={respond} onStatus={setStatus} />
        </div>
      </Sheet>
      <Sheet open={inviteOpen} onClose={() => setInviteOpen(false)} label="Invite friends">
        {circle && <InviteCard slug={slug} title={circle.title} />}
      </Sheet>
    </div>
    </DesktopShell>
  );
}

function whoSent(m: Msg) {
  if (m.kind === "TEXT") return m.mine ? "yourself" : (m.sender?.name ?? null);
  if (m.kind === "HUSH" || m.kind === "PLAN") return "Hush";
  return null;
}

function Row({
  m,
  item,
  work,
  accent,
  onRespond,
  onStatus,
  slug,
  showHead,
  selected,
  flash,
  onSelect,
  onReply,
  onOpenThread,
  replies,
  onFocus,
  onReact,
  threadRootId,
  hushName = "Hush",
}: {
  m: Msg;
  item?: ChatItem;
  work: boolean;
  accent: string;
  onRespond: (id: string, answer: "IN" | "MAYBE" | "OUT") => void;
  onStatus: (id: string, status: "OPEN" | "DONE" | "DISMISSED") => void;
  slug: string;
  showHead: boolean;
  selected: boolean;
  flash: boolean;
  onSelect: () => void;
  onReply: () => void;
  onOpenThread: () => void;
  replies: number;
  onFocus: (viaTouch?: boolean) => void;
  onReact: (emoji: string) => void;
  /** Set when shown inside a thread (no "N replies" link, no quote of the thread's first message). */
  threadRootId?: string;
  /** What this chat calls Hush (chat settings). */
  hushName?: string;
}) {
  // Swipe right to reply (phones).
  const start = useRef<{ x: number; y: number } | null>(null);
  const dxRef = useRef(0); // read on touchend (state can lag a render behind)
  const [dx, setDx] = useState(0);
  // Press and hold → the focused preview with tapbacks (phones); right-click does the same on computers.
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const cancelHold = () => {
    if (hold.current) clearTimeout(hold.current);
    hold.current = null;
  };
  const holdHandlers = m.pending
    ? {}
    : {
        onTouchStart: () => {
          held.current = false;
          cancelHold();
          hold.current = setTimeout(() => {
            held.current = true;
            navigator.vibrate?.(8);
            onFocus(true);
          }, 450);
        },
        onTouchMove: cancelHold,
        onTouchEnd: (e: React.TouchEvent) => {
          cancelHold();
          if (held.current) e.preventDefault(); // no tap after a long press
        },
        onContextMenu: (e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          // Android fires this on a long press too: already open from the hold timer.
          if (held.current) return;
          onFocus(coarsePointer());
        },
      };
  const extras = (alignEnd: boolean) => (
    <>
      <ReactionChips reactions={m.reactions ?? []} mine={alignEnd} onToggle={onReact} />
      {replies > 0 && !threadRootId && (
        <button type="button" onClick={onOpenThread} className="mt-1 px-3 text-caption font-semibold hover:underline" style={{ color: accent }}>
          {replies} {replies === 1 ? "reply" : "replies"}
        </button>
      )}
    </>
  );

  if (m.kind === "CHECKIN") {
    if (!m.checkIn) return null;
    return (
      <div id={`m-${m.id}`} className="mt-3 flex gap-2">
        <div className="w-8 shrink-0 self-end">
          <HushMascot size={32} />
        </div>
        <CheckInCard slug={slug} c={m.checkIn} />
      </div>
    );
  }
  if (m.kind === "ASK" && m.ask) {
    return (
      <div id={`m-${m.id}`} className="mt-3 flex gap-2" {...holdHandlers}>
        <div className="w-8 shrink-0 self-end">
          <HushMascot size={32} />
        </div>
        <div className="flex min-w-0 grow flex-col items-start">
          <AskCard slug={slug} ask={m.ask} />
          {extras(false)}
        </div>
      </div>
    );
  }
  if (m.kind === "ITEM") {
    if (!item) return null; // dismissed, or still loading
    return (
      <div id={`m-${m.id}`} className="mt-3 flex gap-2" {...holdHandlers}>
        <div className="w-8 shrink-0 self-end">
          <HushMascot size={32} />
        </div>
        <div className="flex min-w-0 grow flex-col items-start">
          <ChatItemCard item={item} work={work} updated={m.body === "updated"} onRespond={onRespond} onStatus={onStatus} />
          {extras(false)}
        </div>
      </div>
    );
  }
  if (m.kind === "EVENT")
    return <p id={`m-${m.id}`} className="my-2 text-center text-caption text-muted">{m.body}</p>;

  const isHush = m.kind === "HUSH" || m.kind === "PLAN";
  const mine = m.mine && !isHush;
  const bubble = mine
    ? "text-white"
    : isHush
      ? "bg-hush/15 text-ink border border-hush/25"
      : "bg-bubble text-ink";

  const touch = {
    onTouchStart: (e: React.TouchEvent) => {
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      holdHandlers.onTouchStart?.();
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (!start.current) return;
      const x = e.touches[0].clientX - start.current.x;
      const y = Math.abs(e.touches[0].clientY - start.current.y);
      if (Math.abs(x) > 8 || y > 8) cancelHold();
      if (y > 24) {
        start.current = null;
        dxRef.current = 0;
        setDx(0);
        return;
      }
      dxRef.current = Math.max(0, Math.min(x, 72));
      setDx(dxRef.current);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      cancelHold();
      if (held.current) e.preventDefault(); // no tap after a long press
      if (dxRef.current > 56) onReply();
      start.current = null;
      dxRef.current = 0;
      setDx(0);
    },
  };

  return (
    <div
      id={`m-${m.id}`}
      className={`group flex gap-2 ${mine ? "flex-row-reverse" : ""} ${showHead ? "mt-3" : "mt-0.5"} rounded-2xl transition-colors ${flash ? "bg-galaxy/15" : ""}`}
    >
      <div className="w-8 shrink-0 self-end">
        {!mine && showHead && (isHush ? <HushMascot size={32} /> : m.sender && <Avatar m={{ id: m.sender.id, name: m.sender.name, avatarColor: m.sender.color, photo: m.sender.photo }} size={32} />)}
      </div>
      <div className={`flex min-w-0 max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
        {showHead && !mine && (
          <span className="mb-0.5 flex items-center gap-1 px-3 text-caption font-medium text-muted">
            {isHush ? (
              <>
                {hushName} <Verified size={12} />
              </>
            ) : (
              m.sender?.name
            )}
          </span>
        )}
        <div className={`flex max-w-full items-center gap-1.5 ${mine ? "flex-row-reverse" : ""}`}>
          <button
            type="button"
            onClick={onSelect}
            {...touch}
            onContextMenu={holdHandlers.onContextMenu}
            style={{ transform: dx ? `translateX(${dx}px)` : undefined, touchAction: "pan-y", ...(mine ? { background: accent } : {}) }}
            title={time(m.createdAt)}
            className={`min-w-0 max-w-full whitespace-pre-wrap break-words rounded-[20px] px-4 py-2.5 text-left text-body transition-transform [overflow-wrap:anywhere] [-webkit-touch-callout:none] max-md:select-none ${bubble} ${m.pending ? "opacity-70" : ""}`}
          >
            {m.replyTo && m.replyTo.id !== threadRootId && (
              <span
                role="link"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!threadRootId) onOpenThread();
                }}
                className={`mb-1.5 block rounded-xl border-l-[3px] px-2.5 py-1 text-secondary ${mine ? "border-white/70 bg-white/15" : "border-galaxy bg-surface/60"}`}
              >
                <span className="block text-caption font-semibold opacity-90">{m.replyTo.from ?? "Message"}</span>
                <span className="line-clamp-2 break-words opacity-80">{m.replyTo.body}</span>
              </span>
            )}
            {m.kind === "PLAN" ? <PlanPost body={m.body} /> : m.kind === "FILE" && m.file ? <FileView f={m.file} /> : m.body}
          </button>
          {!m.pending && (
            <span className="hidden shrink-0 items-center opacity-0 transition focus-within:opacity-100 group-hover:opacity-100 md:flex">
              <button
                type="button"
                onClick={() => onFocus(false)}
                aria-label="React"
                title="React"
                className="rounded-full px-1.5 py-1 text-[15px] grayscale hover:bg-bubble hover:grayscale-0"
              >
                🙂
              </button>
              <button
                type="button"
                onClick={onReply}
                aria-label="Reply"
                title="Reply in thread"
                className="rounded-full px-2 py-1 text-caption font-medium text-muted hover:bg-bubble hover:text-ink"
              >
                ↩ Reply
              </button>
            </span>
          )}
        </div>
        {extras(mine)}
        {m.kind === "FILE" && m.file && (
          <span className={`mt-1 flex items-center gap-2 px-2 text-caption text-muted ${mine ? "flex-row-reverse" : ""}`}>
            <a href={m.file.url} target="_blank" rel="noreferrer" className="font-semibold text-galaxy hover:underline">
              {m.file.mime.startsWith("image/") ? "Open" : "Download"}
            </a>
            <span>{m.file.aiVisible ? "Hush can see this" : "🔒 Hush can't see this"}</span>
            <span>· deleted in {Math.max(0, Math.ceil((+new Date(m.file.expiresAt) - Date.now()) / 864e5))}d</span>
          </span>
        )}
        {m.kind === "PLAN" && (
          <Link href={`/c/${slug}`} className="mt-1.5 rounded-full bg-galaxy px-4 py-2 text-secondary font-semibold text-white hover:bg-galaxy-hover">
            See the plan & vote
          </Link>
        )}
        {selected && (
          <div className={`mt-1 flex items-center gap-3 px-2 text-caption text-muted ${mine ? "flex-row-reverse" : ""}`}>
            <span>{time(m.createdAt)}</span>
            {!m.pending && (
              <button type="button" onClick={onReply} className="font-semibold text-galaxy">
                Reply
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PlanPost({ body }: { body: string }) {
  const [title, date, ...stops] = body.split("\n");
  return (
    <span className="block min-w-[220px]">
      <span className="block text-caption font-semibold uppercase tracking-wide text-hush">Hush&apos;s plan</span>
      <span className="mt-0.5 block text-[18px] font-semibold">{title}</span>
      {date && <span className="block text-secondary text-ink-2">{date}</span>}
      {stops.length > 0 && (
        <span className="mt-2 block space-y-0.5 text-secondary">
          {stops.map((s, i) => (
            <span key={i} className="block">
              {s}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

/** Hush planning privately with everyone: progress only, and a way into your Hush chat. */
function CheckInCard({ slug, c }: { slug: string; c: NonNullable<Msg["checkIn"]> }) {
  const open = c.status === "OPEN";
  if (c.stage === "CANCELLED")
    return (
      <div className="w-full max-w-[420px] rounded-[20px] border border-hairline bg-bubble p-4 opacity-80">
        <p className="text-caption font-semibold uppercase tracking-wide text-muted">Plan deleted</p>
        <p className="mt-1 text-body">
          {c.deletedBy ?? "Someone"} deleted the plan{c.title ? ` “${c.title}”` : ""}.
        </p>
      </div>
    );
  const [note, setNote] = useState("");
  const stale = open && Date.now() - +new Date(c.startedAt) > 20 * 60_000 && c.done < c.total;
  const stageLine = !open
    ? "Done. Everyone confirmed privately; the plan is below."
    : c.stage === "INTAKE"
      ? "Getting the details from whoever started it…"
      : c.stage === "CONFIRMING"
        ? `Everyone's checking the plan privately · ${c.done} of ${c.total} confirmed`
        : c.stage === "PLANNING"
          ? "Putting the plan together…"
          : `${c.done} of ${c.total} have answered. Nobody sees anyone's answers.`;
  return (
    <div className="w-full max-w-[420px] rounded-[20px] border border-hush/25 bg-hush/10 p-4">
      <p className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-hush">
        <LockIcon size={11} /> Planning privately
      </p>
      <p className="mt-1 text-[17px] font-semibold leading-snug">
        {open ? "Hush is planning with each of you" : "Planned with everyone"}
        {c.title ? `: “${c.title}”` : ""}
      </p>
      <p className="mt-1 text-secondary text-ink-2">{stageLine}</p>
      {open && c.mine === "ASKING" && (
        <Link href={`/hush?c=${slug}`} className="mt-3 inline-flex h-10 items-center rounded-full bg-galaxy px-4 text-secondary font-semibold text-white hover:bg-galaxy-hover">
          Hush is waiting on you →
        </Link>
      )}
      {open && c.mine === "DONE" && <p className="mt-2 text-caption font-semibold text-galaxy">✓ You&apos;re done. The plan comes back here once everyone confirms.</p>}
      {stale && (
        <button
          type="button"
          onClick={async () => {
            try {
              await api(`/api/circles/${slug}/checkin/${c.id}`, { method: "POST" });
              setNote("OK, going ahead with the answers so far.");
            } catch (e) {
              setNote(e instanceof Error ? e.message : "Couldn't do that.");
            }
          }}
          className="mt-2 block text-caption font-semibold text-muted underline"
        >
          Someone's quiet? Continue without them
        </button>
      )}
      {note && <p className="mt-1 text-caption text-muted">{note}</p>}
    </div>
  );
}

/** "Where are you coming from?": share your location or type a city / ZIP. Only Hush sees it. */
function LocationAnswer({ slug, ask }: { slug: string; ask: NonNullable<Msg["ask"]> }) {
  const [where, setWhere] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(ask.mine ? "Shared" : null);
  const [err, setErr] = useState("");
  const submit = async (payload: { lat?: number; lng?: number; where?: string }) => {
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ label: string | null }>(`/api/circles/${slug}/ask/${ask.id}`, { method: "POST", body: JSON.stringify(payload) });
      setDone(r.label ? `Near ${r.label}` : "Your location");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't share that.");
    }
    setBusy(false);
  };
  const locate = () => {
    if (!navigator.geolocation) return setErr("Your browser can't share location. Type a city or ZIP instead.");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => submit({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {
        setBusy(false);
        setErr("Location is off. Type a city or ZIP instead.");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 },
    );
  };
  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={locate} className="h-9 rounded-full bg-galaxy px-3.5 text-secondary font-semibold text-white disabled:opacity-60">
          📍 Use my location
        </button>
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (where.trim()) submit({ where: where.trim() });
        }}
      >
        <input
          value={where}
          maxLength={100}
          onChange={(e) => setWhere(e.target.value)}
          placeholder="or a city or ZIP"
          aria-label="City or ZIP"
          className="h-9 min-w-0 grow rounded-full bg-surface px-3.5 text-secondary text-ink outline-none focus:outline-1 focus:outline-galaxy"
        />
        <button className="h-9 rounded-full bg-bubble px-3.5 text-secondary font-semibold hover:bg-hairline disabled:opacity-50" disabled={!where.trim() || busy}>
          Send
        </button>
      </form>
      {err && <p className="mt-2 text-caption text-danger">{err}</p>}
      <p className="mt-2.5 text-caption text-muted">
        Only Hush sees this, rounded to about 1 km · {ask.answered} of {ask.total} shared
        {done && <span className="text-ink-2"> · you: {done}</span>}
      </p>
    </>
  );
}

/** Hush's follow-up question. Your answer is private; the group only ever sees the result. */
function AskCard({ slug, ask }: { slug: string; ask: NonNullable<Msg["ask"]> }) {
  const [own, setOwn] = useState(false);
  const [text, setText] = useState(ask.mine?.text ?? "");
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<{ choice: number | null; text: string | null } | null>(null);
  const mine = local ?? ask.mine;
  const closed = ask.status !== "OPEN";
  const answer = async (payload: { choice?: number; text?: string }) => {
    setBusy(true);
    setLocal({ choice: payload.choice ?? null, text: payload.text ?? null });
    await api(`/api/circles/${slug}/ask/${ask.id}`, { method: "POST", body: JSON.stringify(payload) }).catch(() => setLocal(null));
    setBusy(false);
    setOwn(false);
  };
  return (
    <div className="w-full max-w-[420px] rounded-[20px] border border-hush/25 bg-hush/10 p-4">
      <p className="text-caption font-semibold uppercase tracking-wide text-hush">Hush asks · answer privately</p>
      <p className="mt-1 text-[17px] font-semibold leading-snug">{ask.question}</p>
      {closed ? (
        <p className="mt-2 text-secondary text-ink-2">
          {ask.field === "location" ? "Thanks! Hush found the middle." : ask.result ? `Hush went with: ${ask.result}` : "No longer needed"}
        </p>
      ) : ask.field === "location" ? (
        <LocationAnswer slug={slug} ask={ask} />
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {ask.options.map((o, i) =>
              /^something else$/i.test(o) ? (
                <button
                  key={i}
                  type="button"
                  disabled={busy}
                  onClick={() => setOwn(!own)}
                  className={`h-9 rounded-full px-3.5 text-secondary font-semibold ${mine?.text ? "bg-galaxy text-white" : "bg-surface hover:bg-hairline"}`}
                >
                  Something else…
                </button>
              ) : (
                <button
                  key={i}
                  type="button"
                  disabled={busy}
                  onClick={() => answer({ choice: i })}
                  className={`h-9 rounded-full px-3.5 text-secondary font-semibold ${mine?.choice === i ? "bg-galaxy text-white" : "bg-surface hover:bg-hairline"}`}
                >
                  {o}
                </button>
              ),
            )}
          </div>
          {own && (
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim()) answer({ text: text.trim() });
              }}
            >
              <input
                autoFocus
                value={text}
                maxLength={200}
                onChange={(e) => setText(e.target.value)}
                placeholder="Tell Hush privately"
                className="h-9 min-w-0 grow rounded-full bg-surface px-3.5 text-secondary text-ink outline-none focus:outline-1 focus:outline-galaxy"
              />
              <button className="h-9 rounded-full bg-galaxy px-3.5 text-secondary font-semibold text-white" disabled={!text.trim() || busy}>
                Send to Hush
              </button>
            </form>
          )}
          <p className="mt-2.5 text-caption text-muted">
            Only Hush sees your answer · {ask.answered} of {ask.total} answered
            {mine && <span className="text-ink-2"> · you answered</span>}
          </p>
        </>
      )}
    </div>
  );
}

/** Work groups: Hush's tone suggestion before a message goes out. Only the sender sees it. */
function ReviewPanel({
  review,
  onUse,
  onMine,
  onEdit,
}: {
  review: { suggestion: string; issue: string | null; policy?: { next: number; threshold: number; to: string; willEscalate: boolean } | null };
  onUse: () => void;
  onMine: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="mb-2 rounded-2xl border border-hush/30 bg-hush/10 p-3" role="dialog" aria-label="Hush's suggestion">
      <p className="flex items-center gap-2 text-caption font-semibold text-hush">
        <HushMascot size={18} /> Before this goes out: only you can see this
      </p>
      {review.issue && <p className="mt-1 text-secondary text-ink-2">{review.issue}</p>}
      <p className="mt-2 rounded-xl bg-surface/70 px-3 py-2 text-body">{review.suggestion}</p>
      {review.policy && (
        <p className={`mt-2 rounded-xl px-3 py-2 text-caption ${review.policy.willEscalate ? "bg-danger/15 text-ink" : "bg-surface/60 text-ink-2"}`}>
          {review.policy.willEscalate
            ? `If you send this as written, it'll be shared with ${review.policy.to} for review (your company's policy). Only flagged messages are shared, never private chats.`
            : `Your company reviews repeated overrides: sending this as written counts as ${review.policy.next} of ${review.policy.threshold} this week.`}
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button type="button" onClick={onUse} className="h-9 rounded-full bg-galaxy px-4 text-secondary font-semibold text-white">
          Use Hush&apos;s version
        </button>
        <button type="button" onClick={onMine} className="h-9 rounded-full bg-bubble px-4 text-secondary font-semibold hover:bg-hairline">
          Send mine anyway
        </button>
        <button type="button" onClick={onEdit} className="h-9 px-2 text-secondary font-semibold text-muted hover:text-ink">
          Edit
        </button>
      </div>
    </div>
  );
}

function FileView({ f }: { f: NonNullable<Msg["file"]> }) {
  if (/^image\/(jpeg|png|gif|webp)$/.test(f.mime))
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={f.url} alt={f.name} className="max-h-[320px] max-w-full rounded-xl object-contain" loading="lazy" />;
  const kb = f.size < 1024 * 1024 ? `${Math.max(1, Math.round(f.size / 1024))} KB` : `${(f.size / 1024 / 1024).toFixed(1)} MB`;
  return (
    <span className="flex min-w-[200px] items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface/40 text-[18px]">📄</span>
      <span className="min-w-0">
        <span className="block truncate font-semibold">{f.name}</span>
        <span className="block text-caption opacity-80">{kb}</span>
      </span>
    </span>
  );
}
