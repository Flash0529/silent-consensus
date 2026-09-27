"use client";

import { Suspense, use, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { api, fetcher } from "@/lib/client";
import { useCircle } from "@/lib/useCircle";
import { Avatar } from "@/components/AvatarStack";
import { FloatingIconButton } from "@/components/FloatingIconButton";
import { BackIcon, CheckIcon } from "@/components/Icons";
import { InviteCard } from "@/components/InviteCard";
import { PrimaryPill } from "@/components/PrimaryPill";
import { DesktopShell } from "@/components/DesktopShell";

type Contact = { id: string; name: string; avatarColor: string; inGroup: boolean };

// Add people: your contacts (people you already share a group with), anyone with an account by
// email, or anyone at all with the invite link.
function AddPeople({ slug }: { slug: string }) {
  const isNew = useSearchParams().get("new") === "1";
  const { data: circle } = useCircle(slug);
  const { data, mutate } = useSWR<{ contacts: Contact[] }>(`/api/contacts?c=${slug}`, fetcher);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const contacts = useMemo(
    () => (data?.contacts ?? []).filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase())),
    [data, query],
  );

  const add = async (payload: { accountIds?: string[]; email?: string }) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ added: string[] }>(`/api/circles/${slug}/add`, { method: "POST", body: JSON.stringify(payload) });
      setMsg({ ok: true, text: r.added.length ? `Added ${r.added.join(", ")}.` : "They're already in the group." });
      setPicked(new Set());
      setEmail("");
      await mutate();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't add them." });
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <DesktopShell active={slug}>
    <main className="flex min-h-dvh flex-col px-5 pb-[140px] pt-6 lg:mx-auto lg:max-w-xl lg:pb-8">
      <div className="mb-6 flex items-center gap-3">
        <FloatingIconButton label="Back to the chat" href={`/c/${slug}/group`}>
          <BackIcon />
        </FloatingIconButton>
      </div>
      <h1 className="text-title">{isNew ? `"${circle?.title ?? "Your group"}" is ready` : "Add people"}</h1>
      <p className="mt-2 text-body text-muted">Add people you know, or send anyone the invite link.</p>

      {/* Contacts */}
      <section className="mt-7">
        <h2 className="mb-2 text-caption font-semibold uppercase tracking-wide text-muted">Your contacts</h2>
        {!data ? (
          <p className="text-secondary text-muted">Loading…</p>
        ) : data.contacts.length === 0 ? (
          <p className="rounded-2xl bg-bubble px-4 py-3 text-secondary text-muted">
            People you share a group with show up here. Invite someone with the link below to get started.
          </p>
        ) : (
          <>
            {data.contacts.length > 6 && (
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search contacts"
                className="mb-2 h-11 w-full rounded-full bg-bubble px-4 text-body text-ink outline-none placeholder:text-muted focus:outline-1 focus:outline-galaxy"
              />
            )}
            <ul className="overflow-hidden rounded-2xl bg-bubble">
              {contacts.map((c) => {
                const on = picked.has(c.id);
                return (
                  <li key={c.id} className="border-b border-divider last:border-0">
                    <button
                      type="button"
                      disabled={c.inGroup}
                      onClick={() => toggle(c.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:opacity-60"
                    >
                      <Avatar m={{ id: c.id, name: c.name, avatarColor: c.avatarColor }} size={36} />
                      <span className="grow text-body">{c.name}</span>
                      {c.inGroup ? (
                        <span className="text-caption text-muted">In the group</span>
                      ) : (
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${on ? "border-galaxy bg-galaxy text-white" : "border-hairline"}`}
                        >
                          {on && <CheckIcon size={13} stroke={3.4} />}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            {picked.size > 0 && (
              <div className="mt-3">
                <PrimaryPill onClick={() => add({ accountIds: [...picked] })} disabled={busy}>
                  {busy ? "Adding…" : `Add ${picked.size} ${picked.size === 1 ? "person" : "people"}`}
                </PrimaryPill>
              </div>
            )}
          </>
        )}
      </section>

      {/* By email */}
      <section className="mt-7">
        <h2 className="mb-2 text-caption font-semibold uppercase tracking-wide text-muted">Add by email</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) add({ email: email.trim() });
          }}
          className="flex gap-2"
        >
          <input
            type="email"
            inputMode="email"
            autoCapitalize="none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@example.com"
            className="h-12 min-w-0 grow rounded-full bg-bubble px-4 text-body text-ink outline-none placeholder:text-muted focus:outline-1 focus:outline-galaxy"
          />
          <button type="submit" disabled={!email.trim() || busy} className="h-12 shrink-0 rounded-full bg-galaxy px-5 text-body font-medium text-white disabled:opacity-40">
            Add
          </button>
        </form>
        <p className="mt-1.5 px-2 text-caption text-muted">Works for anyone who already has a Silent Consensus account.</p>
      </section>

      {msg && (
        <p className={`mt-4 text-secondary ${msg.ok ? "text-galaxy" : "text-danger"}`} role="status">
          {msg.text}
        </p>
      )}

      {/* Link */}
      <section className="mt-7">
        <h2 className="mb-2 text-caption font-semibold uppercase tracking-wide text-muted">Invite with a link</h2>
        <p className="mb-3 text-secondary text-muted">
          Anyone can join with this. Tap Share to send it from Messages, WhatsApp or any app, straight to your phone&apos;s contacts.
        </p>
        {circle && <InviteCard slug={slug} title={circle.title} />}
      </section>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-app bg-gradient-to-t lg:sticky lg:mt-6 lg:max-w-none from-surface via-surface to-surface/0 px-[22px] pb-[max(24px,env(safe-area-inset-bottom))] pt-6">
        <Link
          href={`/c/${slug}/group`}
          className="flex h-pill w-full items-center justify-center rounded-full bg-ink text-[17px] font-medium text-on-ink"
        >
          {isNew ? "Go to the chat" : "Done"}
        </Link>
      </div>
    </main>
    </DesktopShell>
  );
}

export default function AddPeoplePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return (
    <Suspense>
      <AddPeople slug={slug} />
    </Suspense>
  );
}
