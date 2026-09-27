"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HushMascot } from "@/components/HushMascot";
import { PrimaryPill } from "@/components/PrimaryPill";
import { Sheet } from "@/components/Sheet";
import { FloatingIconButton } from "@/components/FloatingIconButton";
import { DotsIcon, PlusIcon } from "@/components/Icons";
import { SettingsSheet } from "@/components/SettingsSheet";
import { api } from "@/lib/client";
import { useAccount } from "@/lib/useAccount";
import { ChatRow, HushWaitingRows } from "@/components/ChatList";
import { DesktopShell } from "@/components/DesktopShell";
import { BrandLogo } from "@/components/BrandLogo";
import { MessageResults } from "@/components/ChatSearch";

// Home. Logged out: the welcome. Logged in: your chats, like any messenger.

export default function Home() {
  const router = useRouter();
  const { data, mutate } = useAccount({ poll: true });
  const [joinOpen, setJoinOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [code, setCode] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [q, setQ] = useState("");

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = code.trim();
    const slug = raw.split("/j/").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (slug) router.push(`/j/${slug}`);
  };

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    await mutate();
  };

  const joinSheet = (
    <Sheet open={joinOpen} onClose={() => setJoinOpen(false)} label="Join with a code">
      <form onSubmit={go} className="flex flex-col gap-4">
        <h2 className="text-card-title">Join with a code</h2>
        <label className="flex flex-col gap-1 rounded-[18px] border border-hairline bg-surface px-[18px] py-4 focus-within:border-galaxy">
          <span className="text-caption text-muted">Code or link from your friend</span>
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="bg-transparent text-[18px] font-medium outline-none"
            placeholder="e.g. k7m2qx9a"
            autoCapitalize="none"
            autoCorrect="off"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setJoinOpen(false)} className="h-row rounded-btn bg-hairline text-body font-medium">
            Cancel
          </button>
          <button type="submit" className="h-row rounded-btn bg-galaxy text-body font-medium text-white">
            Join
          </button>
        </div>
      </form>
    </Sheet>
  );

  if (!data) return <main className="min-h-dvh" />;

  // ---------- Logged out ----------
  if (!data.account)
    return (
      <main className="relative flex min-h-dvh flex-col items-center px-7 pb-[34px] pt-[96px]">
        <div className="absolute right-5 top-6">
          <FloatingIconButton label="Settings" onClick={() => setSettingsOpen(true)}>
            <DotsIcon />
          </FloatingIconButton>
        </div>
        <h1 className="max-w-[300px] text-center text-title">Group chats that actually make plans</h1>
        <div className="flex grow items-center justify-center py-6">
          <HushMascot size={176} label="Hush, the Silent Consensus planner" animated />
        </div>
        <div className="mb-8 flex flex-col items-center gap-[10px]">
          <p className="text-[26px] font-bold tracking-[-0.01em]">Silent Consensus</p>
          <p className="max-w-[320px] text-center text-body text-muted">
            Chat with your friends. When it&apos;s time to decide, Hush asks everyone privately and finds the plan
            the whole group can say yes to.
          </p>
        </div>
        <PrimaryPill href="/login?mode=signup">Create account</PrimaryPill>
        <Link href="/login" className="mt-[14px] px-4 py-[10px] text-body font-medium text-ink">
          Log in
        </Link>
        <button type="button" onClick={() => setJoinOpen(true)} className="px-4 py-2 text-secondary text-muted">
          Have an invite code?
        </button>
        {joinSheet}
        <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </main>
    );

  // ---------- Logged in: chat list ----------
  const chats = data.plans;
  const shown = q.trim() ? chats.filter((c) => c.title.toLowerCase().includes(q.trim().toLowerCase())) : chats;
  return (
    <DesktopShell>
      {/* Desktop: the rail + chat list come from the shell; the main area invites you to pick a chat. */}
      <div className="hidden h-dvh flex-col items-center justify-center gap-4 px-10 text-center lg:flex">
        <HushMascot size={96} animated />
        <h1 className="text-title">Welcome, {data.account.name}</h1>
        <p className="max-w-[420px] text-body text-muted">
          Pick a chat on the left, or start a new group and add your friends. To plan something, just talk about it
          (Hush takes it from there privately) or tap Plan event in any chat.
        </p>
        <div className="flex gap-3">
          <Link href="/group/new" className="rounded-full bg-galaxy px-6 py-3 text-body font-medium text-white hover:bg-galaxy-hover">
            New group
          </Link>
          <button type="button" onClick={() => setJoinOpen(true)} className="rounded-full bg-bubble px-6 py-3 text-body font-medium hover:bg-hairline">
            Join with a code
          </button>
        </div>
      </div>
    <main className="relative flex min-h-dvh flex-col pb-[110px] lg:hidden">
      <div className="px-5 pt-[max(16px,env(safe-area-inset-top))]">
        <BrandLogo size={24} />
      </div>
      <header className="flex items-center gap-3 px-5 pb-3 pt-3">
        <div className="grow">
          <h1 className="text-title">Chats</h1>
          <p className="text-caption text-muted">Signed in as {data.account.name}</p>
        </div>
        {/* Your profile picture opens Settings; everything else is in the menu. */}
        <Link href="/settings" aria-label="Settings" className="rounded-full ring-offset-2 ring-offset-surface hover:ring-2 hover:ring-galaxy">
          {data.account.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.account.photo} alt="" className="h-11 w-11 rounded-full object-cover" />
          ) : (
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-galaxy text-body font-bold text-white">{data.account.name.slice(0, 1).toUpperCase()}</span>
          )}
        </Link>
        <button type="button" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-full bg-bubble hover:bg-hairline">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </header>
      <div className="px-4 pb-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search chats and messages"
          aria-label="Search chats and messages"
          className="h-10 w-full rounded-full bg-bubble px-4 text-secondary text-ink outline-none placeholder:text-muted focus:outline-1 focus:outline-galaxy"
        />
      </div>

      <FindFriendsCard />
      {chats.length === 0 ? (
        <div className="flex grow flex-col items-center justify-center gap-4 px-8 text-center">
          <HushMascot size={96} animated />
          <p className="text-question">No chats yet</p>
          <p className="text-body text-muted">Start a group and add your friends, or join one with a code.</p>
        </div>
      ) : (
        <ul className="flex flex-col px-2">
          {!q && <HushWaitingRows chats={chats} />}
          {shown.map((c) => (
            <ChatRow key={c.slug} c={c} />
          ))}
          {q.trim().length >= 2 && <MessageResults q={q} />}
        </ul>
      )}

      <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-app flex-col gap-2 bg-gradient-to-t from-surface via-surface to-surface/0 px-[22px] pb-[max(24px,env(safe-area-inset-bottom))] pt-6">
        <PrimaryPill href="/group/new">
          <span className="flex items-center gap-2">
            <PlusIcon size={20} /> New group
          </span>
        </PrimaryPill>
      </div>
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} label="Menu">
        <nav className="flex flex-col" aria-label="Menu">
          {[
            ["/hush", "Hush (your private planning chat)"],
            ["/people", "People and find friends"],
            ["/settings", "Settings"],
            ["/settings#make-hush-yours", "Make Hush yours"],
            ...(data.account.org ? [["/admin", data.account.org.role === "ADMIN" ? "Company admin" : "Company"]] : []),
            ...(data.account.reviews ? [["/reviews", `Reviews (${data.account.reviews})`]] : []),
            ["/new", "Try the Hush demo"],
          ].map(([href, label]) => (
            <Link key={href} href={href} onClick={() => setMenuOpen(false)} className="flex items-center justify-between border-b border-divider py-3.5 text-body">
              {label} <span className="text-muted">›</span>
            </Link>
          ))}
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setJoinOpen(true);
            }}
            className="flex items-center justify-between border-b border-divider py-3.5 text-left text-body"
          >
            Join with a code <span className="text-muted">›</span>
          </button>
          <button type="button" onClick={logout} className="py-3.5 text-left text-body font-semibold text-danger">
            Log out
          </button>
        </nav>
      </Sheet>
    </main>
      {joinSheet}
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </DesktopShell>
  );
}

/** Phones only: invite to find friends from contacts (dismissible, remembered on this device). */
function FindFriendsCard() {
  const [show, setShow] = useState(false);
  const [canImport, setCanImport] = useState(false);
  useEffect(() => {
    const phone = window.matchMedia("(max-width: 1023px)").matches && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    let dismissed = false;
    try {
      dismissed = localStorage.getItem("qc.findFriendsDismissed") === "1";
    } catch {}
    setShow(phone && !dismissed);
    setCanImport(!!(navigator as Navigator & { contacts?: unknown }).contacts);
  }, []);
  if (!show) return null;
  const dismiss = () => {
    try {
      localStorage.setItem("qc.findFriendsDismissed", "1");
    } catch {}
    setShow(false);
  };
  return (
    <div className="mx-4 mb-3 flex items-start gap-3 rounded-2xl bg-bubble p-4 lg:hidden">
      <HushMascot size={36} />
      <div className="grow">
        <p className="text-body font-semibold">Find your friends</p>
        <p className="mt-0.5 text-secondary text-muted">
          {canImport ? "Import your contacts to see who's already here. Numbers aren't saved." : "Search by phone number to see who's already here."}
        </p>
        <div className="mt-3 flex gap-4">
          <Link href="/people" className="text-secondary font-semibold text-galaxy">
            {canImport ? "Import contacts" : "Find friends"}
          </Link>
          <button type="button" onClick={dismiss} className="text-secondary text-muted">
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
