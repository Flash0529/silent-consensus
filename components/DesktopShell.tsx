"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { HushMascot } from "@/components/HushMascot";
import { BrandLogo } from "@/components/BrandLogo";
import { SettingsSheet } from "@/components/SettingsSheet";
import { ChatRow, HushWaitingRows } from "@/components/ChatList";
import { MessageResults } from "@/components/ChatSearch";
import { DotsIcon, PlusIcon } from "@/components/Icons";
import { api } from "@/lib/client";
import { useAccount } from "@/lib/useAccount";

// Desktop (lg and up) layout, modelled on Microsoft Teams' structure: an app rail on the far left,
// the chat list next to it, and the open conversation filling the rest. Phones get `children` only
// (the single-screen layout). Inside an iframe (the desktop Plan / Hush / Add people tabs) the shell
// steps aside so it never nests.

const ChatIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z" />
  </svg>
);

export function DesktopShell({ active, children }: { active?: string; children: React.ReactNode }) {
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => setEmbedded(window.self !== window.top), []);
  useTimeZoneSync();
  if (embedded) return <>{children}</>;
  return (
    <div className="lg:fixed lg:inset-0 lg:z-20 lg:flex lg:bg-surface">
      <Rail />
      <ChatPane active={active} />
      <div className="lg:relative lg:min-w-0 lg:flex-1 lg:overflow-y-auto">{children}</div>
    </div>
  );
}

/** Tell the server this browser's time zone (so Hush's suggested times are right for you). */
function useTimeZoneSync() {
  const { data, mutate } = useAccount();
  const saved = data?.account?.timeZone;
  const has = !!data?.account;
  useEffect(() => {
    if (!has) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz !== saved) api("/api/account", { method: "PATCH", body: JSON.stringify({ timeZone: tz }) }).then(() => mutate()).catch(() => {});
  }, [has, saved, mutate]);
}

function Rail() {
  const pathname = usePathname();
  const router = useRouter();
  const { data, mutate } = useAccount();
  const [settings, setSettings] = useState(false);
  const item = (on: boolean) =>
    `flex w-full flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition ${on ? "bg-bubble text-ink" : "text-muted hover:bg-bubble/60 hover:text-ink"}`;
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    await mutate();
    router.replace("/start");
  };
  const initial = data?.account?.name?.slice(0, 1).toUpperCase() ?? "?";
  return (
    <nav aria-label="App" className="hidden w-[72px] shrink-0 flex-col items-center gap-1 border-r border-divider bg-surface-2 px-2 py-3 lg:flex">
      <Link href="/start" aria-label="Silent Consensus home" title="Silent Consensus" className="mb-3">
        <HushMascot size={34} />
      </Link>
      <Link href="/start" className={item(pathname === "/start" || pathname.endsWith("/group"))}>
        <ChatIcon />
        Chat
      </Link>
      <Link href="/people" className={item(pathname === "/people")}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" />
        </svg>
        People
      </Link>
      <Link href="/group/new" className={item(pathname === "/group/new")}>
        <PlusIcon size={22} />
        New
      </Link>
      <Link href="/hush" className={item(pathname === "/hush")}>
        <span className="flex h-[22px] items-center">
          <HushMascot size={20} />
        </span>
        Hush
      </Link>
      {!!data?.account?.reviews && (
        <Link href="/reviews" className={item(pathname === "/reviews")} title="Reviews waiting on you">
          <span className="relative">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{data.account.reviews}</span>
          </span>
          Reviews
        </Link>
      )}
      {data?.account?.org && (
        <Link href="/admin" className={item(pathname === "/admin")} title={data.account.org.name}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3" />
          </svg>
          {data.account.org.role === "ADMIN" ? "Admin" : "Company"}
        </Link>
      )}
      <div className="mt-auto flex flex-col items-center gap-2">
        {/* Your profile picture opens Settings. */}
        <Link
          href="/settings"
          aria-label="Settings"
          title={data?.account ? `Settings · ${data.account.name}` : "Settings"}
          className={`relative rounded-full ring-offset-2 ring-offset-surface-2 hover:ring-2 hover:ring-galaxy ${pathname === "/settings" ? "ring-2 ring-galaxy" : ""}`}
        >
          {data?.account?.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.account.photo} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-galaxy text-secondary font-bold text-white">{initial}</span>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-surface-2 bg-bubble text-muted">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </span>
        </Link>
        <button type="button" onClick={logout} className="text-[11px] font-medium text-muted hover:text-ink">
          Log out
        </button>
      </div>
      <SettingsSheet open={settings} onClose={() => setSettings(false)} />
    </nav>
  );
}

function ChatPane({ active }: { active?: string }) {
  const { data } = useAccount({ poll: true });
  const [q, setQ] = useState("");
  const chats = useMemo(
    () => (data?.plans ?? []).filter((c) => c.title.toLowerCase().includes(q.trim().toLowerCase())),
    [data, q],
  );
  return (
    <aside aria-label="Chats" className="hidden w-[320px] shrink-0 flex-col border-r border-divider lg:flex">
      <div className="px-4 pt-4">
        <BrandLogo size={22} className="text-muted hover:text-ink" />
      </div>
      <div className="flex items-center gap-2 px-4 pb-2 pt-2">
        <h2 className="grow text-[22px] font-bold">Chat</h2>
        <Link
          href="/group/new"
          aria-label="New group"
          title="New group"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-bubble hover:bg-hairline"
        >
          <PlusIcon size={18} />
        </Link>
      </div>
      <div className="px-4 pb-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search chats and messages"
          aria-label="Search chats and messages"
          className="h-9 w-full rounded-full bg-bubble px-4 text-secondary text-ink outline-none placeholder:text-muted focus:outline-1 focus:outline-galaxy"
        />
      </div>
      <ul className="flex grow flex-col overflow-y-auto px-2 pb-4">
        {data && chats.length === 0 && (
          <li className="px-3 py-3 text-center text-secondary text-muted">{q ? "No chat names match." : "No chats yet."}</li>
        )}
        {!q && data?.account && <HushWaitingRows chats={data?.plans ?? []} active={active === "hush"} />}
        {chats.map((c) => (
          <ChatRow key={c.slug} c={c} active={c.slug === active} />
        ))}
        {q.trim().length >= 2 && <MessageResults q={q} />}
      </ul>
    </aside>
  );
}
