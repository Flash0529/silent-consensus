"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR, { mutate as globalMutate } from "swr";
import { api, fetcher } from "@/lib/client";
import { DesktopShell } from "@/components/DesktopShell";
import { HushMascot } from "@/components/HushMascot";
import { Verified } from "@/components/Verified";
import { BackIcon, LockIcon, SendIcon } from "@/components/Icons";
import type { Card, Proposal } from "@/lib/checkin";

// Your Hush chat: one private chat with Hush (verified ✓) across all your groups. When a group plans
// something, Hush asks you here, shows you the plan, and sends you back once it's final.

type Msg = { id: string; role: "HUSH" | "MEMBER"; content: string; options: string[] | null; card: Card | null; createdAt: string; slug: string; group: string };
type Thread = { messages: Msg[]; groups: { slug: string; title: string }[]; pending: string[]; bot?: { name: string; color: string } };

const money = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;

export default function HushPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh" />}>
      <HushChat />
    </Suspense>
  );
}

function HushChat() {
  const router = useRouter();
  const params = useSearchParams();
  const want = params.get("c");
  const [busy, setBusy] = useState(false);
  const { data, error, mutate } = useSWR<Thread>(`/api/hush${want ? `?c=${want}` : ""}`, fetcher, { refreshInterval: busy ? 0 : 2500 });
  const [text, setText] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [pick, setPick] = useState<string | null>(null);
  const [stay, setStay] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const status = (error as { status?: number } | undefined)?.status;
    if (status === 401) router.replace("/login?next=/hush");
  }, [error, router]);

  // Back from Stripe: confirm the payment with the server (which checks it with Stripe).
  const paid = params.get("paid");
  useEffect(() => {
    if (!paid) return;
    api<{ note: string }>("/api/hush/pay", { method: "PUT", body: JSON.stringify({ sessionId: paid }) })
      .then((r) => setNote(r.note))
      .catch((e) => setErr(e instanceof Error ? e.message : "Couldn't check that payment."))
      .finally(() => {
        mutate();
        router.replace("/hush");
      });
  }, [paid, mutate, router]);

  const msgs = data?.messages ?? [];
  useEffect(() => bottom.current?.scrollIntoView({ block: "end" }), [msgs.length, pending, busy]);

  // Which group you're answering about: the one waiting on you, else the one you picked / came from.
  const last = msgs[msgs.length - 1];
  const slug = pick ?? data?.pending[0] ?? want ?? last?.slug ?? data?.groups[0]?.slug ?? null;
  const groupTitle = data?.groups.find((g) => g.slug === slug)?.title ?? "";
  const lastForSlug = [...msgs].reverse().find((m) => m.slug === slug);
  const lastHush = lastForSlug?.role === "HUSH" ? lastForSlug : null;
  const quick = lastHush && !busy ? (lastHush.options ?? []) : [];
  const askingLocation = lastHush?.card?.card === "location";

  // Plan is final: back to the group (unless you choose to stay).
  const final = last?.role === "HUSH" && last.card?.card === "final" && Date.now() - +new Date(last.createdAt) < 2 * 60_000 ? last.card : null;
  useEffect(() => {
    if (!final || stay) return;
    const t = setTimeout(() => router.push(`/c/${final.slug}/group`), 2800);
    return () => clearTimeout(t);
  }, [final, stay, router]);

  const send = async (body: { text?: string; optionIndex?: number; lat?: number; lng?: number }, preview: string) => {
    if (busy || !slug) return;
    setBusy(true);
    setPending(preview);
    setErr("");
    try {
      const r = await api<Thread>("/api/hush", { method: "POST", body: JSON.stringify({ slug, ...body }) });
      await mutate(r, { revalidate: false });
      globalMutate("/api/auth/me");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hush couldn't answer right now.");
      if (body.text) setText(body.text);
    } finally {
      setPending(null);
      setBusy(false);
    }
  };
  const shareLocation = () => {
    if (!navigator.geolocation) return setErr("Your browser can't share location. Type a city or ZIP instead.");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setBusy(false);
        send({ lat: p.coords.latitude, lng: p.coords.longitude }, "📍 Shared my location");
      },
      () => {
        setBusy(false);
        setErr("Location is off. Type a city or ZIP instead.");
      },
      { timeout: 10_000, maximumAge: 600_000 },
    );
  };
  const checkout = async (path: string, body: object) => {
    setErr("");
    try {
      const r = await api<{ url?: string }>(path, { method: "POST", body: JSON.stringify(body) });
      if (r.url) window.location.href = r.url;
      else mutate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't start the payment.");
    }
  };

  let prevSlug: string | null = null;
  return (
    <DesktopShell active="hush">
      <div className="fixed inset-0 z-10 flex justify-center bg-surface lg:absolute lg:z-auto">
        <div className="flex h-dvh w-full max-w-3xl flex-col md:border-x md:border-divider lg:h-full lg:max-w-none lg:border-x-0">
          <header className="flex items-center gap-3 border-b border-divider px-3 py-2.5 pt-[max(10px,env(safe-area-inset-top))]">
            <Link href="/start" aria-label="All chats" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-bubble lg:hidden">
              <BackIcon />
            </Link>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: data?.bot?.color ?? "#5B3DF5" }}>
              <HushMascot size={30} />
            </span>
            <span className="min-w-0 grow">
              <span className="flex items-center gap-1.5 text-[17px] font-semibold">
                {data?.bot?.name ?? "Hush"} <Verified size={17} />
                <span className="ml-1 flex items-center gap-1 rounded-md bg-bubble px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  <LockIcon size={10} /> Private
                </span>
              </span>
              <span className="block truncate text-caption text-muted">Only you can see this chat. Your groups only ever see the final plan.</span>
            </span>
          </header>

          <div className="flex grow flex-col gap-2 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5 lg:px-8">
            {!data && !error && <p className="m-auto text-secondary text-muted">Loading…</p>}
            {data && !msgs.length && (
              <p className="m-auto max-w-[320px] text-center text-secondary text-muted">
                When one of your groups plans something, Hush asks you here, privately, and shows you the plan before anyone else sees it.
              </p>
            )}
            {msgs.map((m) => {
              const sep = m.slug !== prevSlug;
              prevSlug = m.slug;
              return (
                <div key={m.id} className="flex flex-col gap-2">
                  {sep && (
                    <p className="mt-3 text-center text-caption font-semibold text-muted">
                      About <Link href={`/c/${m.slug}/group`} className="text-ink-2 hover:underline">{m.group}</Link>
                    </p>
                  )}
                  {m.role === "HUSH" ? (
                    <div className="flex items-end gap-2">
                      <HushMascot size={26} />
                      <div className="flex max-w-[82%] flex-col gap-2">
                        <p className="whitespace-pre-wrap break-words rounded-[20px] border border-hush/25 bg-hush/15 px-4 py-2.5 text-body [overflow-wrap:anywhere]">{m.content}</p>
                        {m.card && "proposal" in m.card && <PlanCard p={m.card.proposal} />}
                        {m.card?.card === "chipin" && <ChipInCard suggest={m.card.suggestCents} onPick={(c) => checkout("/api/hush/chipin", { itemId: (m.card as { itemId: string }).itemId, amountCents: c })} />}
                        {m.card?.card === "pay" && <PayCard cents={m.card.cents} onPay={() => checkout("/api/hush/pay", { itemId: (m.card as { itemId: string }).itemId })} />}
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <p className="max-w-[78%] whitespace-pre-wrap break-words rounded-[20px] bg-galaxy px-4 py-2.5 text-body text-white [overflow-wrap:anywhere]">{m.content}</p>
                    </div>
                  )}
                </div>
              );
            })}
            {pending && (
              <div className="flex justify-end">
                <p className="max-w-[78%] rounded-[20px] bg-galaxy px-4 py-2.5 text-body text-white opacity-70">{pending}</p>
              </div>
            )}
            {busy && (
              <div className="flex items-center gap-2" aria-live="polite">
                <HushMascot size={24} />
                <span className="flex items-center gap-1 rounded-full bg-hush/15 px-3 py-2">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-hush [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-hush [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-hush" />
                </span>
              </div>
            )}
            {final && (
              <div className="mx-auto mt-2 flex flex-col items-center gap-1.5 rounded-2xl bg-bubble px-5 py-3 text-center">
                <span className="text-secondary font-semibold">{stay ? "Plan posted." : "Plan posted. Taking you back to the group…"}</span>
                {stay ? (
                  <Link href={`/c/${final.slug}/group`} className="text-caption font-semibold text-galaxy">
                    Go to the group →
                  </Link>
                ) : (
                  <button type="button" onClick={() => setStay(true)} className="text-caption text-muted underline">
                    Stay here
                  </button>
                )}
              </div>
            )}
            <div ref={bottom} />
          </div>

          <div className="border-t border-divider px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 sm:px-5 lg:px-8">
            {note && <p className="mb-2 rounded-xl bg-galaxy/10 px-3 py-2 text-caption text-ink">{note}</p>}
            {err && <p className="mb-2 text-caption text-danger">{err}</p>}
            {/* Suggestions sit on top of the box you type in (tap one, or just type). */}
            {(quick.length > 0 || askingLocation) && (
              <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label="Suggestions">
                {askingLocation && (
                  <button type="button" onClick={shareLocation} className="rounded-full bg-galaxy px-4 py-2 text-secondary font-semibold text-white">
                    📍 Share my location
                  </button>
                )}
                {quick.map((o, i) => (
                  <button key={o} type="button" onClick={() => send({ optionIndex: i }, o)} className="rounded-full border border-galaxy/40 bg-surface px-4 py-2 text-secondary font-semibold text-galaxy hover:bg-galaxy/10">
                    {o}
                  </button>
                ))}
              </div>
            )}
            {data && data.groups.length > 1 && (
              <label className="mb-1.5 flex items-center gap-2 text-caption text-muted">
                About
                <select value={slug ?? ""} onChange={(e) => setPick(e.target.value)} className="rounded-full bg-bubble px-2 py-1 text-caption font-semibold text-ink outline-none">
                  {data.groups.map((g) => (
                    <option key={g.slug} value={g.slug}>
                      {g.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const t = text.trim();
                if (!t) return;
                setText("");
                send({ text: t }, t);
              }}
              className="flex items-end gap-2"
            >
              <textarea
                rows={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                  }
                }}
                placeholder={askingLocation ? "Or type a city or ZIP" : groupTitle ? `Message Hush about ${groupTitle}` : "Message Hush"}
                aria-label="Message Hush privately"
                disabled={!data || !slug}
                className="max-h-[140px] min-h-[44px] grow resize-none rounded-[22px] bg-bubble px-4 py-[11px] text-body text-ink outline-none placeholder:text-muted focus:outline-1 focus:outline-galaxy"
              />
              <button type="submit" aria-label="Send" disabled={!text.trim() || busy} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-galaxy text-white disabled:bg-hairline disabled:text-muted">
                <SendIcon size={19} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </DesktopShell>
  );
}

/** The plan, part by part: when, where, why, and links to book / get tickets / map. */
export function PlanCard({ p }: { p: Proposal }) {
  return (
    <div className="rounded-[18px] border border-hairline bg-surface p-4">
      <p className="text-caption font-semibold uppercase tracking-wide text-hush">The plan</p>
      <p className="mt-0.5 text-[17px] font-semibold leading-snug">{p.title}</p>
      {p.summary && <p className="mt-1 text-secondary text-ink-2">{p.summary}</p>}
      <ol className="mt-3 flex flex-col gap-3">
        {p.parts.map((x, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-galaxy/15 text-caption font-bold text-galaxy">{i + 1}</span>
            <span className="min-w-0">
              <span className="block text-body font-semibold">{x.label}</span>
              {x.whenText && <span className="block text-secondary text-ink-2">{x.whenText}</span>}
              {x.place && (
                <span className="block text-secondary text-ink-2">
                  {x.place}
                  {x.address ? ` · ${x.address}` : ""}
                </span>
              )}
              {x.why && <span className="block text-caption text-muted">{x.why}</span>}
              {x.links && (
                <span className="mt-1.5 flex flex-wrap gap-1.5">
                  {x.links.tickets && <Ext href={x.links.tickets} strong>Get tickets</Ext>}
                  {x.links.resy && <Ext href={x.links.resy} strong>Book on Resy</Ext>}
                  {x.links.opentable && <Ext href={x.links.opentable}>OpenTable</Ext>}
                  {x.links.website && <Ext href={x.links.website}>Website</Ext>}
                  <Ext href={x.links.maps}>{x.place ? "Map" : "Find on Maps"}</Ext>
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
      {p.costCents ? <p className="mt-3 text-caption text-muted">About {money(p.costCents)} per person</p> : null}
    </div>
  );
}

function Ext({ href, strong = false, children }: { href: string; strong?: boolean; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className={`inline-flex h-7 items-center rounded-full px-2.5 text-caption font-semibold ${strong ? "bg-galaxy text-white" : "bg-bubble text-ink hover:bg-hairline"}`}>
      {children}
    </a>
  );
}

function ChipInCard({ suggest, onPick }: { suggest: number; onPick: (cents: number) => void }) {
  const amounts = [...new Set([0, 500, Math.max(suggest, 500), 1000])].sort((a, b) => a - b);
  return (
    <div className="rounded-[18px] border border-hairline bg-surface p-4">
      <p className="text-caption font-semibold uppercase tracking-wide text-hush">Quiet chip-in</p>
      <p className="mt-1 text-secondary text-ink-2">Nobody will know who gave, or who it helped. Anything the pool doesn&apos;t need isn&apos;t charged.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {amounts.map((a) => (
          <button key={a} type="button" onClick={() => onPick(a)} className={`h-10 rounded-full px-4 text-secondary font-semibold ${a === suggest ? "bg-galaxy text-white" : "bg-bubble hover:bg-hairline"}`}>
            {a === 0 ? "Not this time" : money(a)}
          </button>
        ))}
      </div>
      <p className="mt-2 text-caption text-muted">Opens Stripe (test mode): use card 4242 4242 4242 4242, any future date, any CVC.</p>
    </div>
  );
}

function PayCard({ cents, onPay }: { cents: number; onPay: () => void }) {
  return (
    <div className="rounded-[18px] border border-hairline bg-surface p-4">
      <p className="text-caption font-semibold uppercase tracking-wide text-hush">Your share</p>
      <p className="mt-0.5 text-[22px] font-bold">{money(cents)}</p>
      <button type="button" onClick={onPay} className="mt-2 h-10 rounded-full bg-galaxy px-5 text-secondary font-semibold text-white hover:bg-galaxy-hover">
        Pay with Stripe
      </button>
      <p className="mt-2 text-caption text-muted">Test mode: use card 4242 4242 4242 4242, any future date, any CVC. No real money moves.</p>
    </div>
  );
}
