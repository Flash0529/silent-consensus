"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FloatingIconButton } from "@/components/FloatingIconButton";
import { CloseIcon, LockIcon } from "@/components/Icons";
import { HushMascot } from "@/components/HushMascot";
import { AvatarStack } from "@/components/AvatarStack";
import { Sheet } from "@/components/Sheet";
import { api } from "@/lib/client";
import { avatarStyle, avatarFor } from "@/lib/avatars";
import type { GroupSafeCircle } from "@/lib/serialize";

function joinedLine(names: string[]) {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} is in`;
  if (names.length <= 3) return `${names.slice(0, -1).join(", ")} and ${names.at(-1)} are in`;
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} others are in`;
}

export function JoinSheet({ circle }: { circle: GroupSafeCircle }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const organizer = circle.members.find((m) => m.isOrganizer)?.name ?? "A friend";
  const closed = circle.status !== "COLLECTING";
  const mediate = circle.kind === "MEDIATE";
  const nextColor = avatarStyle(avatarFor(circle.members.length));

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/circles/${circle.slug}/join`, { method: "POST", body: JSON.stringify({ name: name.trim() }) });
      router.replace(`/c/${circle.slug}/chat`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't join");
      setBusy(false);
    }
  };

  return (
    <main className="relative min-h-dvh bg-backdrop">
      <form
        onSubmit={join}
        className="absolute inset-x-0 bottom-0 top-[54px] flex flex-col rounded-t-sheet bg-surface-2 px-6 pb-[34px] pt-5"
      >
        <div className="flex items-center justify-between">
          <FloatingIconButton label="Close" href="/">
            <CloseIcon />
          </FloatingIconButton>
          <span className="text-[18px] font-semibold">Quiet Consensus</span>
          <FloatingIconButton label="How your privacy works" onClick={() => setPrivacyOpen(true)}>
            <LockIcon size={20} stroke={2.2} />
          </FloatingIconButton>
        </div>

        <div className="mt-11 flex flex-col items-start gap-[14px]">
          <HushMascot size={60} />
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em]">
            {mediate ? `Talk it through: ${circle.title}` : `Join ${organizer}'s plan`}
          </h1>
          <p className="text-body text-muted">
            {mediate
              ? `${organizer} asked Hush to help everyone find a way forward. Hush will hear your side privately and never quote you.`
              : `${organizer} invited you to ${circle.title}. Hush will ask you a few quick questions, just between the two of you.`}
          </p>
          {circle.members.length > 0 && (
            <div className="flex items-center gap-[10px]">
              <AvatarStack members={circle.members} size={32} ring="rgb(var(--surface-2))" />
              <span className="text-secondary text-ink-2">{joinedLine(circle.members.map((m) => m.name))}</span>
            </div>
          )}
        </div>

        {closed ? (
          <p className="mt-7 rounded-[18px] border border-hairline bg-surface p-4 text-body">
            This plan is already being made, so it can't take new people.
          </p>
        ) : (
          <>
            <div className="mt-7 flex items-center gap-[14px] rounded-[18px] border border-hairline bg-surface px-[18px] py-4">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[18px] font-semibold"
                style={{ background: nextColor.bg, color: nextColor.fg }}
                aria-hidden="true"
              >
                {name.trim().slice(0, 1).toUpperCase() || "?"}
              </span>
              <div className="flex grow flex-col gap-0.5">
                <label htmlFor="first-name" className="text-caption text-muted">
                  Your first name
                </label>
                <input
                  id="first-name"
                  autoFocus
                  autoComplete="given-name"
                  maxLength={30}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent text-[18px] font-medium outline-none"
                />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <a href="/" className="flex h-row items-center justify-center rounded-btn bg-hairline text-body font-medium">
                Cancel
              </a>
              <button
                type="submit"
                disabled={!name.trim() || busy}
                className="h-row rounded-btn bg-ink text-body font-medium text-on-ink disabled:opacity-40"
              >
                {busy ? "Joining…" : "Join"}
              </button>
            </div>
            {error && <p className="mt-3 text-secondary text-danger">{error}</p>}
          </>
        )}
        <p className="mt-[22px] text-secondary text-muted">
          {mediate
            ? "Only continue if someone involved sent you this link. Your answers go to Hush only. The group sees a way forward, never your words."
            : "Only continue if a friend sent you this link. Your answers go to Hush only. Friends see the plan, never your reasons."}
        </p>
      </form>

      <Sheet open={privacyOpen} onClose={() => setPrivacyOpen(false)} label="How your privacy works">
        <div className="flex flex-col gap-3">
          <h2 className="text-card-title">How your privacy works</h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-body text-ink-2">
            <li>Your chat with Hush is private, even from the organizer.</li>
            <li>The group sees the plan and who has finished, never what anyone said.</li>
            <li>Every group message is checked so no one's reasons show.</li>
            <li>No account. A cookie on this phone remembers you for this plan.</li>
          </ul>
          <button type="button" onClick={() => setPrivacyOpen(false)} className="mt-2 h-row rounded-btn bg-ink text-body font-medium text-on-ink">
            Got it
          </button>
        </div>
      </Sheet>
    </main>
  );
}
