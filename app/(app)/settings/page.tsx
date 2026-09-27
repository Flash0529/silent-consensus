"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR, { mutate as globalMutate } from "swr";
import { api, fetcher } from "@/lib/client";
import { useTheme, type ThemePref } from "@/lib/theme";
import { DesktopShell } from "@/components/DesktopShell";
import { FloatingIconButton } from "@/components/FloatingIconButton";
import { BackIcon } from "@/components/Icons";
import { Avatar } from "@/components/AvatarStack";
import { HushStudio } from "@/components/HushStudio";
import { toJpegDataUrl } from "@/lib/image";
import { useRef } from "react";

type Acct = { name: string; email: string; phone: string | null; twoFactor: boolean; createdAt: string; photo: string | null; bio: string | null };

const card = "overflow-hidden rounded-2xl bg-bubble";
const row = "flex items-center gap-3 border-b border-divider px-4 py-3.5 last:border-0";
const input =
  "h-11 w-full rounded-xl bg-surface px-3.5 text-body text-ink outline-none placeholder:text-muted focus:outline-1 focus:outline-galaxy";
const btn = "h-10 shrink-0 rounded-full bg-galaxy px-4 text-secondary font-semibold text-white disabled:opacity-40";
const ghost = "text-secondary font-semibold text-galaxy";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-2 px-1 text-caption font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className={card}>{children}</div>
    </section>
  );
}

function useAction() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setMsg(null);
    try {
      const ok = await fn();
      if (ok) setMsg({ ok: true, text: ok });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  };
  const note = msg && <p className={`px-4 pb-3 text-secondary ${msg.ok ? "text-galaxy" : "text-danger"}`}>{msg.text}</p>;
  return { busy, run, note };
}

export default function SettingsPage() {
  const router = useRouter();
  const { data, error, mutate } = useSWR<Acct>("/api/account", fetcher);
  useEffect(() => {
    if (error) router.replace("/login?next=/settings");
  }, [error, router]);

  const done = async () => {
    await mutate();
    await globalMutate("/api/auth/me");
  };

  return (
    <DesktopShell>
      <main className="flex min-h-dvh flex-col px-5 pb-16 pt-6 lg:mx-auto lg:max-w-2xl lg:pt-10">
        <div className="mb-2 flex items-center gap-3 lg:hidden">
          <FloatingIconButton label="Back" href="/start">
            <BackIcon />
          </FloatingIconButton>
        </div>
        <h1 className="text-title">Settings</h1>
        <CompanyLink />
        {!data ? (
          <p className="mt-6 text-secondary text-muted">Loading…</p>
        ) : (
          <>
            <Profile a={data} onSaved={done} />
            <AccountBits a={data} onSaved={done} />
            <PhoneSecurity a={data} onSaved={done} />
            <section className="mt-7" id="make-hush-yours">
              <h2 className="mb-2 px-1 text-caption font-semibold uppercase tracking-wide text-muted">Make Hush yours</h2>
              <div className={card}>
                <HushStudio />
              </div>
            </section>
            <Calendars />
            <HushProfile />
            <Appearance />
            <Privacy />
            <Sessions />
            <DangerZone />
          </>
        )}
      </main>
    </DesktopShell>
  );
}

function CompanyLink() {
  const { data } = useSWR<{ account: { org?: { name: string; role: string } | null } | null }>("/api/auth/me", fetcher);
  const org = data?.account?.org;
  if (!org) return null;
  return (
    <Link href="/admin" className="mt-4 flex items-center gap-3 rounded-2xl bg-bubble px-4 py-3.5 hover:bg-hairline/60">
      <span aria-hidden className="text-[22px]">🏢</span>
      <span className="grow">
        <span className="block text-body font-medium">{org.name}</span>
        <span className="block text-caption text-muted">{org.role === "ADMIN" ? "Manage your company" : "Your company"}</span>
      </span>
      <span className="text-muted">›</span>
    </Link>
  );
}

function Profile({ a, onSaved }: { a: Acct; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(a.name);
  const [bio, setBio] = useState(a.bio ?? "");
  const file = useRef<HTMLInputElement>(null);
  const { busy, run, note } = useAction();
  return (
    <Section title="Profile">
      <div className={row}>
        <Avatar m={{ id: "me", name: a.name, avatarColor: "blue", photo: a.photo }} size={64} ring="" />
        <div className="flex grow flex-col items-start gap-1">
          <button type="button" className={ghost} disabled={busy} onClick={() => file.current?.click()}>
            {a.photo ? "Change photo" : "Add a profile photo"}
          </button>
          {a.photo && (
            <button
              type="button"
              className="text-secondary text-muted"
              onClick={() =>
                run(async () => {
                  await api("/api/account", { method: "PATCH", body: JSON.stringify({ photo: null }) });
                  await onSaved();
                  return "Photo removed.";
                })
              }
            >
              Remove photo
            </button>
          )}
          <input
            ref={file}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              run(async () => {
                const photo = await toJpegDataUrl(f, 256, { square: true });
                await api("/api/account", { method: "PATCH", body: JSON.stringify({ photo }) });
                await onSaved();
                return "Photo updated. Your friends see it in chats.";
              });
            }}
          />
        </div>
      </div>
      <form
        className={row}
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await api("/api/account", { method: "PATCH", body: JSON.stringify({ bio }) });
            await onSaved();
            return "Bio saved.";
          });
        }}
      >
        <label className="grow">
          <span className="mb-1 block text-caption text-muted">Bio ({140 - bio.length} left)</span>
          <input className={input} value={bio} maxLength={140} placeholder="A line about you" onChange={(e) => setBio(e.target.value)} />
        </label>
        <button className={`${btn} self-end`} disabled={busy || bio === (a.bio ?? "")}>
          Save
        </button>
      </form>
      <form
        className={row}
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await api("/api/account", { method: "PATCH", body: JSON.stringify({ name }) });
            await onSaved();
            return "Name saved. It's updated in all your groups.";
          });
        }}
      >
        <label className="grow">
          <span className="mb-1 block text-caption text-muted">Name</span>
          <input className={input} value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
        </label>
        <button className={`${btn} self-end`} disabled={busy || !name.trim() || name.trim() === a.name}>
          Save
        </button>
      </form>
      {note}
    </Section>
  );
}

function AccountBits({ a, onSaved }: { a: Acct; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState<"email" | "password" | null>(null);
  const [email, setEmail] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const { busy, run, note } = useAction();
  const reset = () => {
    setOpen(null);
    setEmail("");
    setCurrent("");
    setNext("");
  };
  return (
    <Section title="Account">
      <div className={row}>
        <div className="grow">
          <p className="text-caption text-muted">Email</p>
          <p className="text-body">{a.email}</p>
        </div>
        <button type="button" className={ghost} onClick={() => setOpen(open === "email" ? null : "email")}>
          Change
        </button>
      </div>
      {open === "email" && (
        <form
          className="flex flex-col gap-2 border-b border-divider px-4 pb-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api("/api/account", { method: "PATCH", body: JSON.stringify({ email, currentPassword: current }) });
              await onSaved();
              reset();
              return "Email updated.";
            });
          }}
        >
          <input className={input} type="email" placeholder="New email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className={input} type="password" placeholder="Current password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          <button className={`${btn} self-start`} disabled={busy}>
            Save email
          </button>
        </form>
      )}
      <div className={row}>
        <div className="grow">
          <p className="text-caption text-muted">Password</p>
          <p className="text-body">••••••••</p>
        </div>
        <button type="button" className={ghost} onClick={() => setOpen(open === "password" ? null : "password")}>
          Change
        </button>
      </div>
      {open === "password" && (
        <form
          className="flex flex-col gap-2 px-4 pb-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api("/api/account", { method: "PATCH", body: JSON.stringify({ newPassword: next, currentPassword: current }) });
              reset();
              return "Password changed. Other devices were signed out.";
            });
          }}
        >
          <input className={input} type="password" placeholder="Current password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          <input className={input} type="password" placeholder="New password (8+ characters)" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required />
          <button className={`${btn} self-start`} disabled={busy}>
            Save password
          </button>
        </form>
      )}
      {note}
    </Section>
  );
}

function PhoneSecurity({ a, onSaved }: { a: Acct; onSaved: () => Promise<void> }) {
  const [stage, setStage] = useState<"idle" | "enter" | "code" | "unlink" | "off2fa">("idle");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [current, setCurrent] = useState("");
  const { busy, run, note } = useAction();
  return (
    <Section title="Phone & security">
      <div className={row}>
        <div className="grow">
          <p className="text-caption text-muted">Phone</p>
          <p className="text-body">{a.phone ?? "Not linked"}</p>
          <p className="text-caption text-muted">Used to reset your password and for two-step login. We never show it to anyone.</p>
        </div>
        {a.phone ? (
          <button type="button" className={ghost} onClick={() => setStage(stage === "unlink" ? "idle" : "unlink")}>
            Remove
          </button>
        ) : (
          <button type="button" className={ghost} onClick={() => setStage(stage === "enter" ? "idle" : "enter")}>
            Link
          </button>
        )}
      </div>
      {stage === "enter" && (
        <form
          className="flex gap-2 border-b border-divider px-4 pb-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api("/api/account/phone", { method: "POST", body: JSON.stringify({ phone }) });
              setStage("code");
              return "We texted you a code.";
            });
          }}
        >
          <input className={input} inputMode="tel" autoComplete="tel" placeholder="Mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          <button className={btn} disabled={busy}>
            Send code
          </button>
        </form>
      )}
      {stage === "code" && (
        <form
          className="flex gap-2 border-b border-divider px-4 pb-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api("/api/account/phone", { method: "PUT", body: JSON.stringify({ phone, code }) });
              await onSaved();
              setStage("idle");
              setCode("");
              return "Phone linked.";
            });
          }}
        >
          <input className={input} inputMode="numeric" autoComplete="one-time-code" placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} required />
          <button className={btn} disabled={busy}>
            Verify
          </button>
        </form>
      )}
      {stage === "unlink" && (
        <form
          className="flex gap-2 border-b border-divider px-4 pb-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api("/api/account/phone", { method: "DELETE", body: JSON.stringify({ currentPassword: current }) });
              await onSaved();
              setStage("idle");
              setCurrent("");
              return "Phone removed. Two-step login is off.";
            });
          }}
        >
          <input className={input} type="password" placeholder="Current password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          <button className={btn} disabled={busy}>
            Remove
          </button>
        </form>
      )}
      <div className={row}>
        <div className="grow">
          <p className="text-body">Two-step login</p>
          <p className="text-caption text-muted">
            {a.phone ? "Ask for a code texted to your phone every time you log in." : "Link a phone to turn this on."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={a.twoFactor}
          disabled={!a.phone || busy}
          onClick={() => {
            if (a.twoFactor) setStage(stage === "off2fa" ? "idle" : "off2fa");
            else
              run(async () => {
                await api("/api/account", { method: "PATCH", body: JSON.stringify({ twoFactor: true }) });
                await onSaved();
                return "Two-step login is on.";
              });
          }}
          className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40 ${a.twoFactor ? "bg-galaxy" : "bg-hairline"}`}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${a.twoFactor ? "left-6" : "left-1"}`} />
        </button>
      </div>
      {stage === "off2fa" && (
        <form
          className="flex gap-2 px-4 pb-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api("/api/account", { method: "PATCH", body: JSON.stringify({ twoFactor: false, currentPassword: current }) });
              await onSaved();
              setStage("idle");
              setCurrent("");
              return "Two-step login is off.";
            });
          }}
        >
          <input className={input} type="password" placeholder="Current password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          <button className={btn} disabled={busy}>
            Turn off
          </button>
        </form>
      )}
      {note}
    </Section>
  );
}

function Appearance() {
  const { theme, setTheme } = useTheme();
  const opts: { id: ThemePref; label: string }[] = [
    { id: "system", label: "Automatic" },
    { id: "dark", label: "Dark" },
    { id: "light", label: "Light" },
  ];
  return (
    <Section title="Appearance">
      <div className="grid grid-cols-3 gap-1 p-1">
        {opts.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setTheme(o.id)}
            className={`h-10 rounded-xl text-secondary font-semibold ${theme === o.id ? "bg-surface text-ink" : "text-muted"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </Section>
  );
}

type Cal = { id: string; provider: string; label: string; lastOkAt: string | null; lastError: string | null };

/** Linked calendars: Hush reads only free/busy to find times that work for the whole group. */
function Calendars() {
  const { data, mutate } = useSWR<{ calendars: Cal[]; google: boolean }>("/api/account/calendars", fetcher);
  const { busy, run, note } = useAction();
  const [url, setUrl] = useState("");
  const [how, setHow] = useState<null | "apple" | "google" | "outlook">(null);
  const [flash, setFlash] = useState("");
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("calendar");
    if (c)
      setFlash(
        c === "google-connected"
          ? "Google Calendar connected."
          : c === "google-not-set-up"
            ? "Google sign-in isn't set up yet. Use your Google calendar's secret iCal link below instead."
            : c === "cancelled"
              ? "Google connection cancelled."
              : "Couldn't connect Google Calendar. Try again.",
      );
  }, []);
  const steps = {
    apple: "iPhone/Mac Calendar → tap ⓘ next to a calendar → turn on Public Calendar → Share Link → Copy. Paste the webcal:// link here.",
    google: "calendar.google.com → Settings → pick your calendar → Integrate calendar → copy \"Secret address in iCal format\".",
    outlook: "outlook.com → Settings → Calendar → Shared calendars → Publish a calendar → \"Can view when I'm busy\" → copy the ICS link.",
  } as const;
  return (
    <Section title="Calendars">
      <div className="px-4 pt-3 text-caption text-muted">
        Link a calendar and Hush can find times that work for everyone in your groups. It only ever sees when you&apos;re busy, never what the
        event is, and never shows your schedule to anyone.
      </div>
      {flash && <p className="px-4 pt-2 text-secondary text-galaxy">{flash}</p>}
      {(data?.calendars ?? []).map((c) => (
        <div key={c.id} className={row}>
          <div className="min-w-0 grow">
            <p className="text-body">{c.label}</p>
            <p className={`truncate text-caption ${c.lastError ? "text-danger" : "text-muted"}`}>
              {c.lastError ?? (c.provider === "google" ? "Connected with Google · free/busy only" : "Calendar link · free/busy only")}
            </p>
          </div>
          <button
            type="button"
            className="text-secondary font-semibold text-danger"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api(`/api/account/calendars/${c.id}`, { method: "DELETE" });
                await mutate();
                return "Calendar unlinked.";
              })
            }
          >
            Unlink
          </button>
        </div>
      ))}
      {data?.google && (
        <a href="/api/calendar/google/start" className={`${row} hover:bg-hairline/40`}>
          <span className="grow text-body font-medium">Connect Google Calendar</span>
          <span className="text-muted">›</span>
        </a>
      )}
      <form
        className="flex gap-2 px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!url.trim()) return;
          run(async () => {
            await api("/api/account/calendars", { method: "POST", body: JSON.stringify({ url: url.trim() }) });
            setUrl("");
            await mutate();
            return "Calendar linked. Hush can now find times that work for you.";
          });
        }}
      >
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste an Apple, Google or Outlook calendar link" className={input} aria-label="Calendar link" />
        <button className={btn} disabled={busy || !url.trim()}>
          {busy ? "Checking…" : "Link"}
        </button>
      </form>
      <div className="flex flex-wrap gap-3 px-4 pb-3 text-caption">
        <span className="text-muted">How to get the link:</span>
        {(["apple", "google", "outlook"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setHow(how === k ? null : k)} className="font-semibold text-galaxy">
            {k === "apple" ? "Apple" : k === "google" ? "Google" : "Outlook"}
          </button>
        ))}
      </div>
      {how && <p className="px-4 pb-3 text-caption text-ink-2">{steps[how]}</p>}
      {note}
    </Section>
  );
}

/** Your Hush profile: the Markdown Hush reads before it talks to you. Yours to see, edit and clear. */
function HushProfile() {
  const { data, mutate } = useSWR<{ md: string; notes: string }>("/api/account/notes", fetcher);
  const { busy, run, note } = useAction();
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <Section title="What Hush knows about you">
      <div className="px-4 pt-3 text-caption text-muted">
        Hush reads this before it talks to you, so it doesn&apos;t have to ask the same things twice. The private notes are only for Hush: they
        can shape a plan, but they&apos;re never shown or quoted to anyone.
      </div>
      {editing === null ? (
        <pre className="mx-4 my-3 max-h-[260px] overflow-auto whitespace-pre-wrap rounded-xl bg-surface p-3 font-mono text-[12.5px] leading-relaxed text-ink-2">
          {data?.md ?? "Loading…"}
        </pre>
      ) : (
        <div className="px-4 py-3">
          <p className="mb-1 text-caption text-muted">Private notes (one per line, e.g. &quot;- Weeknights are hard for me&quot;)</p>
          <textarea
            value={editing}
            onChange={(e) => setEditing(e.target.value)}
            rows={6}
            maxLength={2500}
            className="w-full rounded-xl bg-surface p-3 font-mono text-[13px] text-ink outline-none focus:outline-1 focus:outline-galaxy"
          />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4 px-4 pb-3">
        {editing === null ? (
          <>
            <button type="button" className={ghost} onClick={() => setEditing(data?.notes ?? "")}>
              Edit notes
            </button>
            <a href="/api/account/notes?download=1" className={ghost}>
              Download .md
            </a>
            <button
              type="button"
              className="text-secondary font-semibold text-danger"
              disabled={busy || !data?.notes}
              onClick={() =>
                run(async () => {
                  await api("/api/account/notes", { method: "PATCH", body: JSON.stringify({ notes: "" }) });
                  await mutate();
                  return "Hush's notes about you are cleared.";
                })
              }
            >
              Clear notes
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={btn}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api("/api/account/notes", { method: "PATCH", body: JSON.stringify({ notes: editing }) });
                  setEditing(null);
                  await mutate();
                  return "Saved.";
                })
              }
            >
              Save
            </button>
            <button type="button" className={ghost} onClick={() => setEditing(null)}>
              Cancel
            </button>
          </>
        )}
      </div>
      {note}
    </Section>
  );
}

function Privacy() {
  const { busy, run, note } = useAction();
  return (
    <Section title="Privacy">
      <div className={row}>
        <div className="grow">
          <p className="text-body">Hush&apos;s memory on this device</p>
          <p className="text-caption text-muted">Forget the preferences Hush remembered here (budget, food, pace).</p>
        </div>
        <button
          type="button"
          className={ghost}
          disabled={busy}
          onClick={() =>
            run(async () => {
              await api("/api/me/forget", { method: "POST" });
              return "Hush forgot what it remembered on this device.";
            })
          }
        >
          Forget
        </button>
      </div>
      <Link href="/privacy" className={`${row} hover:bg-hairline/40`}>
        <span className="grow text-body">Privacy Policy</span>
        <span className="text-muted">›</span>
      </Link>
      <Link href="/terms" className={`${row} hover:bg-hairline/40`}>
        <span className="grow text-body">Terms &amp; Conditions</span>
        <span className="text-muted">›</span>
      </Link>
      {note}
    </Section>
  );
}

type Device = { id: string; label: string; lastSeenAt: string; firstSeenAt: string; current: boolean; remembered: boolean };
const ago = (iso: string) => {
  const m = Math.round((Date.now() - +new Date(iso)) / 60_000);
  if (m < 2) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} days ago`;
};

function Sessions() {
  const router = useRouter();
  const { busy, run, note } = useAction();
  const out = async (path: string) => {
    await api(path, { method: "POST" });
    await globalMutate("/api/auth/me");
    router.replace("/start");
  };
  const { data: dev, mutate: reload } = useSWR<{ devices: Device[] }>("/api/account/devices", fetcher);
  const current = dev?.devices.find((d) => d.current);
  return (
    <Section title="Devices">
      {(dev?.devices ?? []).map((d) => (
        <div key={d.id} className={row}>
          <span className="grow">
            <span className="block text-body">
              {d.label}
              {d.current && <span className="ml-2 rounded-md bg-galaxy/15 px-1.5 py-0.5 text-[11px] font-semibold text-galaxy">This device</span>}
              {d.remembered && <span className="ml-2 rounded-md bg-bubble px-1.5 py-0.5 text-[11px] font-semibold text-muted">Remembered</span>}
            </span>
            <span className="block text-caption text-muted">
              {d.current ? "Active now" : `Last active ${ago(d.lastSeenAt)}`} · first signed in {new Date(d.firstSeenAt).toLocaleDateString()}
            </span>
          </span>
          {!d.current && (
            <button
              type="button"
              className="text-secondary font-semibold text-danger"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await api(`/api/account/devices/${encodeURIComponent(d.id)}`, { method: "DELETE" });
                  await reload();
                  return `${d.label} was removed and logged out.`;
                })
              }
            >
              Remove
            </button>
          )}
        </div>
      ))}
      {current && (
        <button
          type="button"
          role="switch"
          aria-checked={current.remembered}
          disabled={busy}
          onClick={() =>
            run(async () => {
              await api("/api/account/devices", { method: "POST", body: JSON.stringify({ remember: !current.remembered }) });
              await reload();
              return current.remembered ? "This device is no longer remembered." : "This device is remembered: no two-step codes here.";
            })
          }
          className={`${row} w-full text-left hover:bg-hairline/40`}
        >
          <span className="grow">
            <span className="block text-body">Remember this device</span>
            <span className="block text-caption text-muted">Skip two-step login codes on this browser. Remove it anytime above.</span>
          </span>
          <span className={`relative h-7 w-12 shrink-0 rounded-full ${current.remembered ? "bg-[#30d158]" : "bg-hairline"}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${current.remembered ? "left-6" : "left-1"}`} />
          </span>
        </button>
      )}
      <button type="button" disabled={busy} onClick={() => run(() => out("/api/auth/logout"))} className={`${row} w-full text-left hover:bg-hairline/40`}>
        <span className="grow text-body">Log out</span>
      </button>
      <button type="button" disabled={busy} onClick={() => run(() => out("/api/account/logout-all"))} className={`${row} w-full text-left hover:bg-hairline/40`}>
        <span className="grow">
          <span className="block text-body">Log out everywhere</span>
          <span className="block text-caption text-muted">Signs you out on every phone and computer, including this one.</span>
        </span>
      </button>
      {note}
    </Section>
  );
}

function DangerZone() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [confirm, setConfirm] = useState("");
  const { busy, run, note } = useAction();
  return (
    <Section title="Delete account">
      <div className={row}>
        <div className="grow">
          <p className="text-body text-danger">Delete my account</p>
          <p className="text-caption text-muted">
            Removes your account, your private chats with Hush and the messages you sent. Groups keep working and show
            you as &quot;Deleted user&quot;. This can&apos;t be undone.
          </p>
        </div>
        <button type="button" className="text-secondary font-semibold text-danger" onClick={() => setOpen(!open)}>
          Delete
        </button>
      </div>
      {open && (
        <form
          className="flex flex-col gap-2 px-4 pb-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api("/api/account/delete", { method: "POST", body: JSON.stringify({ currentPassword: current, confirm }) });
              await globalMutate("/api/auth/me");
              router.replace("/start");
            });
          }}
        >
          <input className={input} type="password" placeholder="Your password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          <input className={input} placeholder='Type DELETE to confirm' value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          <button className="h-10 self-start rounded-full bg-danger px-4 text-secondary font-semibold text-white disabled:opacity-40" disabled={busy || confirm !== "DELETE"}>
            Delete forever
          </button>
        </form>
      )}
      {note}
    </Section>
  );
}
