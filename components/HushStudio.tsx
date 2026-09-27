"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/lib/client";
import { HushMascot } from "@/components/HushMascot";
import { Verified } from "@/components/Verified";
import {
  ALLERGIES,
  BOT_COLORS,
  CUISINES,
  DEFAULT_PROFILE,
  DIETS,
  SPICE,
  TIMES,
  VIBES,
  behaviorLine,
  previewMessages,
  standingChips,
  type Profile,
} from "@/components/site/friends/profile";

// "Make Hush yours" (the same studio as the Friends page, saved to your account): how your Hush talks
// to you, and what it plans around. Only you see this. Hush uses it, without your name, when it plans.

const TABS = [
  { key: "personality", label: "Personality" },
  { key: "food", label: "Food & drink" },
  { key: "plans", label: "Plans & privacy" },
] as const;

export function HushStudio() {
  const { data, mutate } = useSWR<{ style: Profile; saved: boolean }>("/api/account/style", fetcher);
  const [p, setP] = useState<Profile>(DEFAULT_PROFILE);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("personality");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data?.style) setP(data.style);
  }, [data?.style]);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((prev) => ({ ...prev, [k]: v }));
  type ListKey = { [K in keyof Profile]: Profile[K] extends string[] ? K : never }[keyof Profile];
  const toggle = (k: ListKey, item: string) => setP((prev) => ({ ...prev, [k]: prev[k].includes(item) ? prev[k].filter((x) => x !== item) : [...prev[k], item] }));
  const preview = useMemo(() => previewMessages(p), [p]);
  const chips = useMemo(() => standingChips(p), [p]);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/account/style", { method: "PUT", body: JSON.stringify(p) });
      await mutate();
      setMsg({ ok: true, text: "Saved. Hush will talk and plan this way from now on." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't save." });
    }
    setBusy(false);
  };
  const reset = async () => {
    await api("/api/account/style", { method: "DELETE" }).catch(() => {});
    setP(DEFAULT_PROFILE);
    await mutate();
    setMsg({ ok: true, text: "Reset. Hush forgot your preferences." });
  };

  return (
    <div className="grid gap-5 p-4 lg:grid-cols-[1fr_260px]">
      <div className="min-w-0">
        <div role="tablist" className="grid grid-cols-3 gap-1 rounded-full bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`h-9 rounded-full text-caption font-semibold sm:text-secondary ${tab === t.key ? "bg-bubble text-ink shadow-sm" : "text-muted"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "personality" && (
          <div className="mt-4 flex flex-col gap-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Text label="Name your Hush" hint="What it's called in your private chat" value={p.botName} max={20} onChange={(v) => set("botName", v)} />
              <Text label="What should it call you?" hint="Only used in your private chat" value={p.you} max={30} onChange={(v) => set("you", v)} />
            </div>
            <Row label="Color">
              <div className="flex flex-wrap gap-2.5">
                {BOT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    aria-label={c.name}
                    aria-pressed={p.color === c.value}
                    onClick={() => set("color", c.value)}
                    className={`h-9 w-9 rounded-full ring-offset-2 ring-offset-bubble ${p.color === c.value ? "ring-2 ring-ink" : ""}`}
                    style={{ background: c.value }}
                  />
                ))}
              </div>
            </Row>
            <Row label="Personality" hint="How it sounds when it talks to you">
              <Seg value={p.tone} onChange={(v) => set("tone", v)} options={[["warm", "Warm"], ["playful", "Playful"], ["direct", "Direct"]]} />
            </Row>
            <Row label="Message length">
              <Seg value={p.length} onChange={(v) => set("length", v)} options={[["brief", "Brief"], ["balanced", "Balanced"], ["chatty", "Chatty"]]} />
            </Row>
            <Row label="How proactive?" hint="When it's allowed to check in with you first">
              <Seg value={p.proactivity} onChange={(v) => set("proactivity", v)} options={[["ask", "When asked"], ["gentle", "Gentle"], ["proactive", "Proactive"]]} />
            </Row>
            <Switch label="Use emoji" sub="A little extra personality" on={p.emoji} onChange={(v) => set("emoji", v)} />
            <Switch label="Quiet hours" sub="Hush won't pull you into its chat during these hours" on={p.quietHours} onChange={(v) => set("quietHours", v)} />
            {p.quietHours && (
              <div className="flex items-center gap-2 text-secondary">
                From <input type="time" value={p.quietFrom} onChange={(e) => set("quietFrom", e.target.value)} className="rounded-lg bg-surface px-2 py-1" />
                to <input type="time" value={p.quietTo} onChange={(e) => set("quietTo", e.target.value)} className="rounded-lg bg-surface px-2 py-1" />
              </div>
            )}
          </div>
        )}

        {tab === "food" && (
          <div className="mt-4 flex flex-col gap-5">
            <Row label="Diet">
              <Chips all={DIETS} on={p.diet} toggle={(x) => toggle("diet", x)} />
            </Row>
            <Row label="Allergies">
              <Chips all={ALLERGIES} on={p.allergies} toggle={(x) => toggle("allergies", x)} />
            </Row>
            <Row label="Favorite cuisines">
              <Chips all={CUISINES} on={p.cuisines} toggle={(x) => toggle("cuisines", x)} />
            </Row>
            <Row label="Spice">
              <Seg value={String(p.spice)} onChange={(v) => set("spice", Number(v))} options={SPICE.map((s, i) => [String(i), s] as [string, string])} />
            </Row>
            <Row label="Drinks">
              <Seg value={p.drinks} onChange={(v) => set("drinks", v)} options={[["yes", "Yes"], ["sometimes", "Sometimes"], ["no", "I don't drink"]]} />
            </Row>
          </div>
        )}

        {tab === "plans" && (
          <div className="mt-4 flex flex-col gap-5">
            <Row label="Comfortable spend" hint="Per plan, all in. Private: it's how Hush knows when to quietly chip in.">
              <Slider value={p.budget} min={0} max={150} step={5} fmt={(v) => (v ? `$${v}` : "No set limit")} onChange={(v) => set("budget", v)} />
            </Row>
            <Switch label="Step-free places only" sub="Hush only suggests places with step-free entry" on={p.stepFree} onChange={(v) => set("stepFree", v)} />
            <Row label="How far will you travel?">
              <Slider value={p.travel} min={5} max={90} step={5} fmt={(v) => `${v} min`} onChange={(v) => set("travel", v)} />
            </Row>
            <Row label="Your vibe">
              <Chips all={VIBES} on={p.vibe} toggle={(x) => toggle("vibe", x)} />
            </Row>
            <Row label="When you're usually free">
              <Chips all={TIMES} on={p.times} toggle={(x) => toggle("times", x)} />
            </Row>
          </div>
        )}

        {msg && <p className={`mt-4 text-secondary ${msg.ok ? "text-galaxy" : "text-danger"}`}>{msg.text}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={busy} className="h-10 rounded-full bg-galaxy px-5 text-secondary font-semibold text-white disabled:opacity-50">
            {busy ? "Saving…" : "Save"}
          </button>
          {data?.saved && (
            <button type="button" onClick={reset} className="text-secondary font-semibold text-danger">
              Reset to default
            </button>
          )}
        </div>
      </div>

      {/* Live preview, like your private chat */}
      <aside aria-label="Live preview" className="rounded-[22px] border border-hairline bg-surface p-3">
        <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">Live preview</p>
        <div className="flex flex-col items-center gap-1 border-b border-divider pb-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: p.color }}>
            <HushMascot size={26} />
          </span>
          <span className="flex items-center gap-1 text-secondary font-semibold">
            {p.botName.trim() || "Hush"} <Verified size={13} />
          </span>
        </div>
        <div className="mt-2 flex flex-col gap-1.5">
          {preview.map((m, i) => (
            <p key={i} className="rounded-2xl bg-bubble px-3 py-2 text-caption">
              {m}
            </p>
          ))}
          <div className="rounded-2xl bg-bubble px-3 py-2">
            <p className="text-caption font-semibold">Here&apos;s what I&apos;ll plan around</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {chips.slice(0, 6).map((c) => (
                <span key={c} className="rounded-full px-2 py-0.5 text-[11px] text-white" style={{ background: p.color }}>
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted">{behaviorLine(p)}</p>
      </aside>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-secondary font-semibold">{label}</p>
      {hint && <p className="text-caption text-muted">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Text({ label, hint, value, max, onChange }: { label: string; hint: string; value: string; max: number; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-secondary font-semibold">{label}</span>
      <span className="block text-caption text-muted">{hint}</span>
      <input value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} className="mt-2 h-11 w-full rounded-xl bg-surface px-3.5 text-body text-ink outline-none focus:outline-1 focus:outline-galaxy" />
    </label>
  );
}

function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-surface p-1">
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)} className={`min-h-9 rounded-full px-2 text-caption font-semibold sm:text-secondary ${value === v ? "bg-bubble text-ink shadow-sm" : "text-muted"}`}>
          {l}
        </button>
      ))}
    </div>
  );
}

function Chips({ all, on, toggle }: { all: string[]; on: string[]; toggle: (x: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map((x) => (
        <button key={x} type="button" aria-pressed={on.includes(x)} onClick={() => toggle(x)} className={`h-8 rounded-full border px-3 text-caption font-semibold ${on.includes(x) ? "border-galaxy bg-galaxy/15 text-ink" : "border-hairline text-muted hover:text-ink"}`}>
          {x}
        </button>
      ))}
    </div>
  );
}

function Switch({ label, sub, on, onChange }: { label: string; sub: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-4 text-left">
      <span>
        <span className="block text-secondary font-semibold">{label}</span>
        <span className="block text-caption text-muted">{sub}</span>
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-[#30d158]" : "bg-hairline"}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-6" : "left-1"}`} />
      </span>
    </button>
  );
}

function Slider({ value, min, max, step, fmt, onChange }: { value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="text-[20px] font-bold tabular-nums">{fmt(value)}</p>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-galaxy" />
    </div>
  );
}
