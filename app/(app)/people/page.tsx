"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { api, fetcher } from "@/lib/client";
import { DesktopShell } from "@/components/DesktopShell";
import { FloatingIconButton } from "@/components/FloatingIconButton";
import { BackIcon } from "@/components/Icons";
import { Avatar } from "@/components/AvatarStack";

// People: your friends (anyone you share a chat with) and finding more, from your phone's contacts
// (where the browser allows it) or by phone number / email. Numbers are only compared, never stored.

type Contact = { id: string; name: string; avatarColor: string; inGroup: boolean };
type Found = { id: string; name: string; photo: string | null; bio: string | null; token: string };

type PickerContact = { name?: string[]; tel?: string[] };
type ContactsNav = Navigator & { contacts?: { select: (props: string[], opts: { multiple: boolean }) => Promise<PickerContact[]> } };

export default function PeoplePage() {
  const router = useRouter();
  const { data, error } = useSWR<{ contacts: Contact[] }>("/api/contacts", fetcher);
  const [pickerOk, setPickerOk] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (error) router.replace("/login?next=/people");
  }, [error, router]);
  useEffect(() => setPickerOk(!!(navigator as ContactsNav).contacts?.select), []);

  const match = async (payload: { phones?: string[]; email?: string }) => {
    setBusy(true);
    setNote("");
    try {
      const r = await api<{ checked: number; found: Found[] }>("/api/contacts/match", { method: "POST", body: JSON.stringify(payload) });
      setFound(r.found);
      if (!r.found.length)
        setNote(payload.phones?.length && payload.phones.length > 1
          ? `Checked ${r.checked} numbers. None of them are on Silent Consensus yet. Invite them with a group link!`
          : "No one found. They may not have an account yet, or haven't linked their phone.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const importContacts = async () => {
    try {
      const picked = await (navigator as ContactsNav).contacts!.select(["name", "tel"], { multiple: true });
      const phones = picked.flatMap((c) => c.tel ?? []);
      if (phones.length) await match({ phones });
    } catch {
      /* the person closed the picker */
    }
  };

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    if (v.includes("@")) match({ email: v });
    else match({ phones: [v] });
  };

  const dm = async (accountId: string, token?: string) => {
    try {
      const r = await api<{ slug: string }>("/api/dm", { method: "POST", body: JSON.stringify({ accountId, token }) });
      router.push(`/c/${r.slug}/group`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't open the chat.");
    }
  };

  const btn = "h-9 shrink-0 rounded-full bg-galaxy px-4 text-secondary font-semibold text-white hover:bg-galaxy-hover";

  return (
    <DesktopShell>
      <main className="flex min-h-dvh flex-col px-5 pb-16 pt-6 lg:mx-auto lg:max-w-2xl lg:pt-10">
        <div className="mb-2 lg:hidden">
          <FloatingIconButton label="Back" href="/start">
            <BackIcon />
          </FloatingIconButton>
        </div>
        <h1 className="text-title">People</h1>

        <section className="mt-6 rounded-2xl bg-bubble p-4">
          <h2 className="text-question">Find friends</h2>
          <p className="mt-1 text-secondary text-muted">
            See who you know is already here. Numbers are only compared, never saved.
          </p>
          {pickerOk && (
            <button type="button" onClick={importContacts} disabled={busy} className="mt-3 h-11 w-full rounded-full bg-galaxy text-body font-semibold text-white disabled:opacity-40">
              Import contacts from this phone
            </button>
          )}
          <form onSubmit={search} className="mt-3 flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Phone number or email"
              autoCapitalize="none"
              className="h-11 min-w-0 grow rounded-full bg-surface px-4 text-body text-ink outline-none placeholder:text-muted focus:outline-1 focus:outline-galaxy"
            />
            <button className={btn} disabled={busy || !q.trim()}>
              Search
            </button>
          </form>
          {!pickerOk && (
            <p className="mt-2 text-caption text-muted">
              Importing contacts works in Chrome on Android. On iPhone, search by number or share a group&apos;s invite link.
            </p>
          )}
          {note && <p className="mt-3 text-secondary text-muted">{note}</p>}
          {found && found.length === 0 && <InviteFriend searched={q.trim()} />}
          {found && found.length > 0 && (
            <ul className="mt-3 overflow-hidden rounded-xl bg-surface">
              {found.map((f) => (
                <li key={f.id} className="flex items-center gap-3 border-b border-divider px-3 py-2.5 last:border-0">
                  <Avatar m={{ id: f.id, name: f.name, avatarColor: "lilac", photo: f.photo }} size={36} />
                  <span className="min-w-0 grow">
                    <span className="block text-body">{f.name}</span>
                    {f.bio && <span className="block truncate text-caption text-muted">{f.bio}</span>}
                  </span>
                  <button type="button" className={btn} onClick={() => dm(f.id, f.token)}>
                    Message
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-7">
          <h2 className="mb-2 px-1 text-caption font-semibold uppercase tracking-wide text-muted">Your friends</h2>
          {!data ? (
            <p className="text-secondary text-muted">Loading…</p>
          ) : data.contacts.length === 0 ? (
            <p className="rounded-2xl bg-bubble px-4 py-3 text-secondary text-muted">
              Anyone you share a chat with shows up here, ready to message.
            </p>
          ) : (
            <ul className="overflow-hidden rounded-2xl bg-bubble">
              {data.contacts.map((c) => (
                <li key={c.id} className="flex items-center gap-3 border-b border-divider px-4 py-3 last:border-0">
                  <Avatar m={{ id: c.id, name: c.name, avatarColor: c.avatarColor }} size={38} />
                  <span className="grow text-body">{c.name}</span>
                  <button type="button" className={btn} onClick={() => dm(c.id)}>
                    Message
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </DesktopShell>
  );
}

/** Nobody found: a friend-invite link. When they sign up with it, you're connected (a DM opens). */
function InviteFriend({ searched }: { searched: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const make = async () => {
    setErr("");
    try {
      const r = await api<{ url: string; from: string }>("/api/invites", { method: "POST" });
      setUrl(r.url);
      setFrom(r.from);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't make a link.");
    }
  };
  const text = url ? `${from} invited you to Silent Consensus, group chats that actually make plans. Set up your account here and we'll be connected: ${url}` : "";
  const phone = /^[\d\s()+-]{7,}$/.test(searched) ? searched.replace(/[^\d+]/g, "") : null;
  return (
    <div className="mt-3 rounded-xl bg-surface p-4">
      <p className="text-body font-semibold">Invite them</p>
      <p className="mt-0.5 text-secondary text-muted">Send a friend-request link. When they set up their account with it, you&apos;ll be connected automatically.</p>
      {!url ? (
        <button type="button" onClick={make} className="mt-3 h-10 rounded-full bg-galaxy px-4 text-secondary font-semibold text-white">
          Create invite link
        </button>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <p className="truncate rounded-xl bg-bubble px-3 py-2 text-secondary">{url}</p>
          <div className="flex flex-wrap gap-2">
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button type="button" onClick={() => navigator.share({ title: "Join me on Silent Consensus", text, url }).catch(() => {})} className="h-10 rounded-full bg-galaxy px-4 text-secondary font-semibold text-white">
                Share
              </button>
            )}
            {phone && (
              <a href={`sms:${phone}?&body=${encodeURIComponent(text)}`} className="flex h-10 items-center rounded-full bg-bubble px-4 text-secondary font-semibold">
                Text it
              </a>
            )}
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(text).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="h-10 rounded-full bg-bubble px-4 text-secondary font-semibold"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
      {err && <p className="mt-2 text-caption text-danger">{err}</p>}
    </div>
  );
}
