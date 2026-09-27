"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { api, fetcher } from "@/lib/client";
import { DesktopShell } from "@/components/DesktopShell";
import { FloatingIconButton } from "@/components/FloatingIconButton";
import { BackIcon, CopyIcon } from "@/components/Icons";
import { Avatar } from "@/components/AvatarStack";
import { relTime } from "@/components/ChatList";

type Org = {
  org: { name: string; domain: string; toneCheck: boolean; autoDetect: boolean; managerReview: boolean; isDemo: boolean };
  admin: boolean;
  you: string;
  stats: { people: number; groups: number; messages7d: number; meetings: number; actionOpen: number; actionDone: number; decisions: number };
  people: { id: string; name: string; email: string | null; role: string; managerId: string | null; isHr: boolean; joined: string; lastActive: string | null; groups: number; photo: string | null }[];
  groups: { slug: string; title: string; members: number; lastActive: string }[];
};

const card = "rounded-2xl bg-bubble";

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40 ${on ? "bg-galaxy" : "bg-hairline"}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-6" : "left-1"}`} />
    </button>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { data, error, mutate } = useSWR<Org>("/api/org", fetcher, { refreshInterval: 10_000 });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState("");
  useEffect(() => {
    if (error) router.replace("/settings");
  }, [error, router]);
  useEffect(() => {
    if (data) setName(data.org.name);
  }, [data?.org.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg(null);
    try {
      await fn();
      await mutate();
      setMsg({ ok: true, text: ok });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Something went wrong." });
    }
  };
  const invite = typeof window !== "undefined" ? `${window.location.origin}/login?business=1` : "";

  if (!data) return <DesktopShell><main className="p-8 text-secondary text-muted">Loading…</main></DesktopShell>;
  const { org, stats, admin } = data;
  const tiles: [string, number | string][] = [
    ["People", stats.people],
    ["Work groups", stats.groups],
    ["Messages this week", stats.messages7d],
    ["Meetings Hush pinned", stats.meetings],
    ["Action items open", stats.actionOpen],
    ["Action items done", stats.actionDone],
    ["Decisions logged", stats.decisions],
  ];

  return (
    <DesktopShell>
      <main className="flex min-h-dvh flex-col px-5 pb-16 pt-6 lg:mx-auto lg:max-w-5xl lg:px-8 lg:pt-10">
        <div className="mb-2 lg:hidden">
          <FloatingIconButton label="Back" href="/start">
            <BackIcon />
          </FloatingIconButton>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="grow">
            <p className="text-caption font-semibold uppercase tracking-wide text-muted">{admin ? "Admin" : "Company"}</p>
            <h1 className="text-title">{org.name}</h1>
            <p className="text-secondary text-muted">
              @{org.domain}
              {org.isDemo && <span className="ml-2 rounded-md bg-hush/20 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-ink">Demo company</span>}
            </p>
          </div>
        </div>
        {msg && <p className={`mt-3 text-secondary ${msg.ok ? "text-galaxy" : "text-danger"}`}>{msg.text}</p>}

        {/* Stats */}
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {tiles.map(([label, value]) => (
            <div key={label} className={`${card} p-4`}>
              <p className="text-[28px] font-bold leading-none">{value}</p>
              <p className="mt-1.5 text-caption text-muted">{label}</p>
            </div>
          ))}
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          {/* People */}
          <section>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="grow text-question">People</h2>
            </div>
            <div className={`${card} overflow-hidden`}>
              {data.people.map((p) => (
                <div key={p.id} className="flex items-center gap-3 border-b border-divider px-4 py-3 last:border-0">
                  <Avatar m={{ id: p.id, name: p.name, avatarColor: "blue" }} size={36} />
                  <div className="min-w-0 grow">
                    <p className="truncate text-body font-medium">
                      {p.name}
                      {p.id === data.you && <span className="text-muted"> (you)</span>}
                    </p>
                    <p className="truncate text-caption text-muted">
                      {p.email ?? ""}
                      {p.email ? " · " : ""}
                      {p.groups} {p.groups === 1 ? "group" : "groups"} · {p.lastActive ? `active ${relTime(p.lastActive)}` : "not signed in yet"}
                    </p>
                  </div>
                  {admin ? (
                    <>
                      <select
                        value={p.managerId ?? ""}
                        aria-label={`Manager for ${p.name}`}
                        title="Reports to"
                        onChange={(e) => act(() => api(`/api/org/members/${p.id}`, { method: "PATCH", body: JSON.stringify({ managerId: e.target.value || null }) }), "Manager updated.")}
                        className="hidden h-9 max-w-[140px] rounded-full bg-surface px-3 text-secondary text-ink outline-none sm:block"
                      >
                        <option value="">No manager</option>
                        {data.people
                          .filter((x) => x.id !== p.id)
                          .map((x) => (
                            <option key={x.id} value={x.id}>
                              Reports to {x.name}
                            </option>
                          ))}
                      </select>
                      <label className="flex items-center gap-1 text-caption text-muted" title="On the HR team (sees serious reviews)">
                        <input
                          type="checkbox"
                          checked={p.isHr}
                          onChange={(e) => act(() => api(`/api/org/members/${p.id}`, { method: "PATCH", body: JSON.stringify({ isHr: e.target.checked }) }), "Updated.")}
                        />
                        HR
                      </label>
                      <select
                        value={p.role}
                        aria-label={`Role for ${p.name}`}
                        onChange={(e) => act(() => api(`/api/org/members/${p.id}`, { method: "PATCH", body: JSON.stringify({ role: e.target.value }) }), "Role updated.")}
                        className="h-9 rounded-full bg-surface px-3 text-secondary text-ink outline-none"
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="MEMBER">Member</option>
                      </select>
                      {p.id !== data.you && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Remove ${p.name} from ${org.name}? Their account stays; they just leave the company.`))
                              act(() => api(`/api/org/members/${p.id}`, { method: "DELETE" }), `${p.name} was removed.`);
                          }}
                          className="text-secondary font-semibold text-danger"
                        >
                          Remove
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-caption text-muted">{p.role === "ADMIN" ? "Admin" : "Member"}</span>
                  )}
                </div>
              ))}
            </div>
            {admin && (
              <div className={`${card} mt-3 p-4`}>
                <p className="text-body font-medium">Invite people</p>
                <p className="mt-1 text-secondary text-muted">
                  Anyone who signs up with an @{org.domain} email joins {org.name} automatically. Send them this link:
                </p>
                <div className="mt-3 flex gap-2">
                  <p className="min-w-0 grow truncate rounded-xl bg-surface px-3 py-2.5 text-secondary">{invite}</p>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(invite).catch(() => {});
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-galaxy px-4 text-secondary font-semibold text-white"
                  >
                    <CopyIcon size={16} /> {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            )}
          </section>

          <div className="flex flex-col gap-8">
            {/* Policies */}
            <section>
              <div className="mb-2 flex items-center">
                <h2 className="grow text-question">Policies</h2>
                <Link href="/reviews" className="text-secondary font-semibold text-galaxy">Reviews →</Link>
              </div>
              <div className={`${card} overflow-hidden`}>
                <div className="flex items-center gap-3 border-b border-divider px-4 py-3.5">
                  <div className="grow">
                    <p className="text-body">Professional tone check</p>
                    <p className="text-caption text-muted">Hush reviews work messages before they&apos;re delivered and suggests a cordial rewrite when needed.</p>
                  </div>
                  <Toggle on={org.toneCheck} disabled={!admin} onChange={(v) => act(() => api("/api/org", { method: "PATCH", body: JSON.stringify({ toneCheck: v }) }), v ? "Tone check is on." : "Tone check is off.")} />
                </div>
                <div className="flex items-center gap-3 border-b border-divider px-4 py-3.5">
                  <div className="grow">
                    <p className="text-body">Manager review</p>
                    <p className="text-caption text-muted">
                      Off by default. When on, someone who sends messages as written after Hush flagged them 3 times in a week is reviewed by their manager (HR for
                      serious content). They&apos;re warned every time before sending. Private Hush chats are never shared.
                    </p>
                  </div>
                  <Toggle on={org.managerReview} disabled={!admin} onChange={(v) => act(() => api("/api/org", { method: "PATCH", body: JSON.stringify({ managerReview: v }) }), v ? "Manager review is on." : "Manager review is off.")} />
                </div>
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="grow">
                    <p className="text-body">Auto-detect meetings &amp; action items</p>
                    <p className="text-caption text-muted">Hush pins meetings, action items and decisions from work chats on its own.</p>
                  </div>
                  <Toggle on={org.autoDetect} disabled={!admin} onChange={(v) => act(() => api("/api/org", { method: "PATCH", body: JSON.stringify({ autoDetect: v }) }), v ? "Auto-detect is on." : "Auto-detect is off.")} />
                </div>
              </div>
            </section>

            {admin && (
              <section>
                <h2 className="mb-2 text-question">Company</h2>
                <form
                  className={`${card} flex gap-2 p-4`}
                  onSubmit={(e) => {
                    e.preventDefault();
                    act(() => api("/api/org", { method: "PATCH", body: JSON.stringify({ name }) }), "Company name saved.");
                  }}
                >
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label="Company name" className="h-10 min-w-0 grow rounded-xl bg-surface px-3 text-body text-ink outline-none focus:outline-1 focus:outline-galaxy" />
                  <button className="h-10 rounded-full bg-galaxy px-4 text-secondary font-semibold text-white" disabled={!name.trim() || name === org.name}>
                    Save
                  </button>
                </form>
              </section>
            )}

            {/* Groups */}
            <section>
              <h2 className="mb-2 text-question">Work groups</h2>
              <div className={`${card} overflow-hidden`}>
                {data.groups.length === 0 && <p className="px-4 py-4 text-secondary text-muted">No work groups yet. Create one with New → Work.</p>}
                {data.groups.map((g) => (
                  <Link key={g.slug} href={`/c/${g.slug}/group`} className="flex items-center gap-3 border-b border-divider px-4 py-3 last:border-0 hover:bg-hairline/40">
                    <span className="grow">
                      <span className="block text-body">{g.title}</span>
                      <span className="block text-caption text-muted">
                        {g.members} people · active {relTime(g.lastActive)}
                      </span>
                    </span>
                    <span className="text-muted">›</span>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </DesktopShell>
  );
}
