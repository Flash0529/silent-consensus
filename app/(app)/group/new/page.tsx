"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FloatingIconButton } from "@/components/FloatingIconButton";
import { BackIcon } from "@/components/Icons";
import { PrimaryPill } from "@/components/PrimaryPill";
import { api } from "@/lib/client";
import { useAccount } from "@/lib/useAccount";
import { DesktopShell } from "@/components/DesktopShell";

// New group chat: just a name. Next step is adding people. (The Hush planning conversation is the
// separate demo at /new.)
export default function NewGroup() {
  const router = useRouter();
  const { data } = useAccount();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"FRIENDS" | "WORK">("FRIENDS");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (data && !data.account) router.replace("/login?next=/group/new");
  }, [data, router]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = name.trim();
    if (!title || busy || !data?.account) return;
    setBusy(true);
    setError("");
    try {
      const now = new Date();
      const res = await api<{ slug: string }>("/api/circles", {
        method: "POST",
        body: JSON.stringify({
          organizerName: data.account.name.slice(0, 30),
          title: title.slice(0, 60),
          activity: "hangout",
          area: "",
          windowStart: now.toISOString(),
          windowEnd: new Date(now.getTime() + 14 * 86_400_000).toISOString(),
          mode,
        }),
      });
      router.replace(`/c/${res.slug}/add?new=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the group.");
      setBusy(false);
    }
  };

  return (
    <DesktopShell>
    <main className="flex min-h-dvh flex-col px-6 pb-[34px] pt-6 lg:mx-auto lg:max-w-lg lg:pt-16">
      <div className="mb-8 lg:hidden">
        <FloatingIconButton label="Back" href="/start">
          <BackIcon />
        </FloatingIconButton>
      </div>
      <h1 className="text-title">New group</h1>
      <p className="mt-2 text-body text-muted">Give it a name. You&apos;ll add people next.</p>
      <form onSubmit={create} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1 rounded-[18px] border border-hairline bg-surface px-[18px] py-4 focus-within:border-galaxy">
          <span className="text-caption text-muted">Group name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="e.g. Roommates, Saturday crew"
            className="bg-transparent text-[18px] font-medium text-ink outline-none placeholder:text-muted"
          />
        </label>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Group type">
          {(
            [
              ["FRIENDS", "Friends", "Plans, to-dos and a quiet helper for hanging out."],
              ["WORK", "Work", "Meetings, action items, and a professional-tone check before messages go out."],
            ] as const
          ).map(([id, label, sub]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={mode === id}
              onClick={() => setMode(id)}
              className={`rounded-[18px] border p-4 text-left transition ${mode === id ? "border-galaxy bg-galaxy/10" : "border-hairline hover:border-muted"}`}
            >
              <span className="block text-body font-semibold">{label}</span>
              <span className="mt-1 block text-caption text-muted">{sub}</span>
            </button>
          ))}
        </div>
        {error && <p className="text-secondary text-danger">{error}</p>}
        <PrimaryPill type="submit" disabled={!name.trim() || busy}>
          {busy ? "Creating…" : "Next: add people"}
        </PrimaryPill>
      </form>
    </main>
    </DesktopShell>
  );
}
