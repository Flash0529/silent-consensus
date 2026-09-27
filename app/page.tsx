"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HushMascot } from "@/components/HushMascot";
import { PrimaryPill } from "@/components/PrimaryPill";
import { Sheet } from "@/components/Sheet";
import { FloatingIconButton } from "@/components/FloatingIconButton";
import { DotsIcon } from "@/components/Icons";
import { SettingsSheet } from "@/components/SettingsSheet";

export default function Welcome() {
  const router = useRouter();
  const [joinOpen, setJoinOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [code, setCode] = useState("");

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = code.trim();
    const slug = raw.split("/j/").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (slug) router.push(`/j/${slug}`);
  };

  return (
    <main className="relative flex min-h-dvh flex-col items-center px-7 pb-[34px] pt-[116px]">
      <div className="absolute right-5 top-6">
        <FloatingIconButton label="Settings" onClick={() => setSettingsOpen(true)}>
          <DotsIcon />
        </FloatingIconButton>
      </div>
      <h1 className="max-w-[300px] text-center text-title">Plans everyone can say yes to</h1>
      <div className="flex grow items-center justify-center py-6">
        <HushMascot size={196} label="Hush, the planner that checks in with each friend privately" animated />
      </div>
      <div className="mb-9 flex flex-col items-center gap-[10px]">
        <p className="text-[26px] font-bold tracking-[-0.01em]">Hush</p>
        <p className="max-w-[310px] text-center text-body text-muted">
          Checks in with each friend privately, then plans something the whole group can actually do. No one has to
          explain why.
        </p>
      </div>
      <PrimaryPill href="/new">Start a plan</PrimaryPill>
      <button
        type="button"
        onClick={() => setJoinOpen(true)}
        className="mt-[14px] px-4 py-[10px] text-body font-medium text-muted"
      >
        Join with a code
      </button>

      <Sheet open={joinOpen} onClose={() => setJoinOpen(false)} label="Join with a code">
        <form onSubmit={go} className="flex flex-col gap-4">
          <h2 className="text-card-title">Join with a code</h2>
          <label className="flex flex-col gap-1 rounded-[18px] border border-hairline bg-surface px-[18px] py-4">
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
            <button
              type="button"
              onClick={() => setJoinOpen(false)}
              className="h-row rounded-btn bg-hairline text-body font-medium"
            >
              Cancel
            </button>
            <button type="submit" className="h-row rounded-btn bg-ink text-body font-medium text-on-ink">
              Join
            </button>
          </div>
          <Link href="/demo" className="text-center text-caption text-muted underline">
            Presenter view
          </Link>
        </form>
      </Sheet>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  );
}
