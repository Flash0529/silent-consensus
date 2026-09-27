"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { HushMascot } from "@/components/HushMascot";
import { Check, Lock, Moon } from "../icons";
import { EASE } from "../motion";
import { FitPhone } from "../PhoneFrame";
import { Muted, SectionHeading, pillClass } from "../ui";
import { ChipGroup, Field, Segmented, Slider, Switch, TextInput } from "./controls";
import {
  ALLERGIES,
  BOT_COLORS,
  CUISINES,
  DEFAULT_PROFILE,
  DIETS,
  SPICE,
  TIMES,
  VIBES,
  WORK_FIELDS,
  behaviorLine,
  clearProfile,
  loadProfile,
  previewMessages,
  saveProfile,
  standingChips,
  type Profile,
} from "./profile";

const TABS = [
  { key: "personality", label: "Personality" },
  { key: "food", label: "Food & drink" },
  { key: "plans", label: "Plans & privacy" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export function Studio() {
  const [p, setP] = useState<Profile>(DEFAULT_PROFILE);
  const [tab, setTab] = useState<TabKey>("personality");
  const [toast, setToast] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const saved = loadProfile();
    if (saved) setP(saved);
  }, []);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => update((prev) => ({ ...prev, [k]: v }));

  type ListKey = { [K in keyof Profile]: Profile[K] extends string[] ? K : never }[keyof Profile];
  const toggle = (k: ListKey, item: string) =>
    update((prev) => ({
      ...prev,
      [k]: prev[k].includes(item) ? prev[k].filter((x) => x !== item) : [...prev[k], item],
    }));

  function update(fn: (prev: Profile) => Profile) {
    setP(fn);
    setTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), 650);
  }

  const flash = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  const onSave = () => flash(saveProfile(p) ? "Saved on this device" : "Couldn't save in this browser");
  const onDelete = () => {
    clearProfile();
    setP(DEFAULT_PROFILE);
    flash("Deleted. Hush forgot everything.");
  };

  const messages = useMemo(() => previewMessages(p), [p]);
  const chips = useMemo(() => standingChips(p), [p]);
  const name = p.botName.trim() || "Hush";

  return (
    <section data-theme-section="dark" id="studio" className="scroll-mt-28 py-28 sm:py-36" aria-label="Make Hush yours">
      <div className="mx-auto max-w-[1100px] px-5 sm:px-6">
        <SectionHeading
          eyebrow="Your Hush"
          title={
            <>
              Make Hush yours. <Muted>Tell it once.</Muted>
            </>
          }
          sub="What you eat, what you love, how you like to be talked to. Hush confirms instead of re-asking, so every plan gets faster. Never shown to any group."
        />

        <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16">
          {/* Controls */}
          <div className="min-w-0">
            <div
              role="tablist"
              aria-label="Preference sections"
              className="flex gap-1 overflow-x-auto rounded-full bg-carbon p-1 no-scrollbar"
            >
              {TABS.map((t) => {
                const on = tab === t.key;
                return (
                  <button
                    key={t.key}
                    role="tab"
                    id={`tab-${t.key}`}
                    aria-selected={on}
                    aria-controls={`panel-${t.key}`}
                    onClick={() => setTab(t.key)}
                    className="relative min-h-11 flex-1 cursor-pointer whitespace-nowrap rounded-full px-4 text-[15px] font-medium"
                  >
                    {on && (
                      <motion.span
                        layoutId="studio-tab"
                        className="absolute inset-0 rounded-full bg-porcelain"
                        transition={{ type: "spring", stiffness: 420, damping: 36 }}
                      />
                    )}
                    <span
                      className={`relative transition-colors ${on ? "text-obsidian" : "text-ash hover:text-porcelain"}`}
                    >
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                role="tabpanel"
                id={`panel-${tab}`}
                aria-labelledby={`tab-${tab}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="mt-8 flex flex-col gap-9"
              >
                {tab === "personality" && (
                  <>
                    <div className="grid gap-6 sm:grid-cols-2">
                      <Field label="Name your planner" htmlFor="bot-name" hint="What your group sees in chats.">
                        <TextInput
                          id="bot-name"
                          value={p.botName}
                          onChange={(v) => set("botName", v)}
                          placeholder="Hush"
                        />
                      </Field>
                      <Field label="What should it call you?" htmlFor="you-name" hint="Only used in your private chat.">
                        <TextInput
                          id="you-name"
                          value={p.you}
                          onChange={(v) => set("you", v)}
                          placeholder="Your first name"
                        />
                      </Field>
                    </div>
                    <Field label="Color">
                      <div role="radiogroup" aria-label="Planner color" className="flex flex-wrap gap-3">
                        {BOT_COLORS.map((c) => {
                          const on = p.color === c.value;
                          return (
                            <button
                              key={c.value}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              aria-label={c.name}
                              onClick={() => set("color", c.value)}
                              className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-110"
                              style={{ background: c.value }}
                            >
                              {on && (
                                <motion.span
                                  layoutId="swatch-ring"
                                  className="absolute -inset-[5px] rounded-full border-2"
                                  style={{ borderColor: c.value }}
                                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                />
                              )}
                              {on && <Check size={18} className="text-white" />}
                            </button>
                          );
                        })}
                      </div>
                    </Field>
                    <Field label="Personality" hint="How it sounds when it talks to you.">
                      <Segmented
                        label="Personality"
                        value={p.tone}
                        onChange={(v) => set("tone", v)}
                        options={[
                          { value: "warm", label: "Warm" },
                          { value: "playful", label: "Playful" },
                          { value: "direct", label: "Direct" },
                        ]}
                      />
                    </Field>
                    <Field label="Message length">
                      <Segmented
                        label="Message length"
                        value={p.length}
                        onChange={(v) => set("length", v)}
                        options={[
                          { value: "brief", label: "Brief" },
                          { value: "balanced", label: "Balanced" },
                          { value: "chatty", label: "Chatty" },
                        ]}
                      />
                    </Field>
                    <Field label="How proactive?" hint="When it's allowed to check in with you first.">
                      <Segmented
                        label="Proactivity"
                        value={p.proactivity}
                        onChange={(v) => set("proactivity", v)}
                        options={[
                          { value: "ask", label: "When asked" },
                          { value: "gentle", label: "Gentle" },
                          { value: "proactive", label: "Proactive" },
                        ]}
                      />
                    </Field>
                    <div className="divide-y divide-steel rounded-tile bg-carbon px-5">
                      <div className="py-2">
                        <Switch
                          checked={p.emoji}
                          onChange={(v) => set("emoji", v)}
                          label="Use emoji"
                          sub="A little extra personality."
                        />
                      </div>
                      <div className="py-2">
                        <Switch
                          checked={p.quietHours}
                          onChange={(v) => set("quietHours", v)}
                          label="Quiet hours"
                          sub="No private check-ins while you're offline."
                        />
                        <AnimatePresence initial={false}>
                          {p.quietHours && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-3 pt-1 text-[15px]">
                                <label className="flex items-center gap-2">
                                  From
                                  <input
                                    type="time"
                                    value={p.quietFrom}
                                    onChange={(e) => set("quietFrom", e.target.value)}
                                    className="rounded-xl bg-obsidian px-3 py-2 text-porcelain [color-scheme:dark] focus:outline-none focus:ring-1 focus:ring-galaxy"
                                  />
                                </label>
                                <label className="flex items-center gap-2">
                                  to
                                  <input
                                    type="time"
                                    value={p.quietTo}
                                    onChange={(e) => set("quietTo", e.target.value)}
                                    className="rounded-xl bg-obsidian px-3 py-2 text-porcelain [color-scheme:dark] focus:outline-none focus:ring-1 focus:ring-galaxy"
                                  />
                                </label>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </>
                )}

                {tab === "food" && (
                  <>
                    <Field label="Dietary needs" hint="Hush only picks places that cover these.">
                      <ChipGroup
                        label="Dietary needs"
                        options={DIETS}
                        value={p.diet}
                        onToggle={(o) => toggle("diet", o)}
                      />
                    </Field>
                    <Field label="Allergies">
                      <ChipGroup
                        label="Allergies"
                        options={ALLERGIES}
                        value={p.allergies}
                        onToggle={(o) => toggle("allergies", o)}
                      />
                    </Field>
                    <Field label="Cuisines you love" hint="Pick as many as you like. Hush leans toward these.">
                      <ChipGroup
                        label="Favorite cuisines"
                        options={CUISINES}
                        value={p.cuisines}
                        onToggle={(o) => toggle("cuisines", o)}
                      />
                    </Field>
                    <Field label="Spice level">
                      <Slider
                        id="spice"
                        label="Spice level"
                        min={0}
                        max={3}
                        step={1}
                        value={p.spice}
                        onChange={(v) => set("spice", v)}
                        format={(v) => SPICE[v]}
                      />
                    </Field>
                    <Field label="Drinks">
                      <Segmented
                        label="Drinks"
                        value={p.drinks}
                        onChange={(v) => set("drinks", v)}
                        options={[
                          { value: "yes", label: "Drinks are fine" },
                          { value: "sometimes", label: "Sometimes" },
                          { value: "no", label: "I don't drink" },
                        ]}
                      />
                    </Field>
                  </>
                )}

                {tab === "plans" && (
                  <>
                    <Field label="Usual budget per plan" hint="Hush confirms this each time instead of asking.">
                      <Slider
                        id="budget"
                        label="Usual budget"
                        min={0}
                        max={100}
                        step={5}
                        value={p.budget}
                        onChange={(v) => set("budget", v)}
                        format={(v) => (v === 0 ? "No limit" : `$${v}`)}
                      />
                    </Field>
                    <Field label="How far will you travel?">
                      <Segmented
                        label="Travel limit"
                        value={String(p.travel) as "15" | "30" | "45" | "60"}
                        onChange={(v) => set("travel", Number(v))}
                        options={[
                          { value: "15", label: "15 min" },
                          { value: "30", label: "30 min" },
                          { value: "45", label: "45 min" },
                          { value: "60", label: "1 hr" },
                        ]}
                      />
                    </Field>
                    <div className="rounded-tile bg-carbon px-5 py-2">
                      <Switch
                        checked={p.stepFree}
                        onChange={(v) => set("stepFree", v)}
                        label="Step-free places only"
                        sub="Step-free entry and an accessible restroom."
                      />
                    </div>
                    <Field label="Your vibe">
                      <ChipGroup label="Vibe" options={VIBES} value={p.vibe} onToggle={(o) => toggle("vibe", o)} />
                    </Field>
                    <Field label="Usually free">
                      <ChipGroup
                        label="Availability"
                        options={TIMES}
                        value={p.times}
                        onToggle={(o) => toggle("times", o)}
                      />
                    </Field>
                    <Field
                      label="Use in work groups"
                      hint="Personal and work stay separate. Your employer never sees your personal profile."
                    >
                      <ChipGroup
                        label="Fields shared with work groups"
                        options={WORK_FIELDS.map((f) => f.label)}
                        value={WORK_FIELDS.filter((f) => p.workShare.includes(f.key)).map((f) => f.label)}
                        onToggle={(label) => toggle("workShare", WORK_FIELDS.find((f) => f.label === label)!.key)}
                      />
                    </Field>
                  </>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Mobile: the full preview is above, so keep a mini one in reach while editing. */}
            <div className="pointer-events-none sticky bottom-4 z-10 mt-8 lg:hidden" aria-hidden>
              <div className="flex items-center gap-3 rounded-full bg-graphite/90 py-2 pl-2 pr-4 shadow-[inset_0_0_0_1px_var(--c-steel)] glass">
                <HushMascot size={34} color={p.color} />
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-porcelain">{name}</p>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.p
                      key={messages[0]}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="truncate text-[13px] text-ash"
                    >
                      {messages[0]}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-steel pt-8">
              <button type="button" onClick={onSave} className={pillClass("blue")}>
                Save preferences
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex h-11 cursor-pointer items-center rounded-full px-5 text-lead text-[#ff6961] transition hover:bg-[#ff6961]/10"
              >
                Delete everything
              </button>
              <p className="flex items-center gap-1.5 text-body-sm text-ash">
                <Lock size={14} /> Stays in this browser until the app launches.
              </p>
            </div>
          </div>

          {/* Live preview */}
          <div className="order-first lg:sticky lg:top-24 lg:order-none lg:self-start">
            <p className="mb-4 text-center text-micro font-semibold uppercase tracking-[0.14em] text-ash">
              Live preview
            </p>
            <div className="flex justify-center">
              <FitPhone className="h-[min(600px,72svh)] lg:h-[min(676px,calc(100svh-9rem))]">
                <div className="flex h-full flex-col pt-12">
                  <div className="flex flex-col items-center gap-1.5 border-b border-keyline pb-3">
                    <motion.div
                      key={p.color}
                      initial={{ scale: 0.6, rotate: -15 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 15 }}
                    >
                      <HushMascot size={44} color={p.color} />
                    </motion.div>
                    <p className="flex items-center gap-1.5 text-[15px] font-semibold text-porcelain">
                      {name}
                      <span className="flex items-center gap-1 text-[11px] font-medium text-ash">
                        <Lock size={11} /> Private
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 overflow-hidden px-3.5 pt-4 text-[13.5px] leading-snug">
                    <LayoutGroup>
                      <AnimatePresence initial={false} mode="popLayout">
                        {messages.map((m, i) => (
                          <motion.div
                            key={`${i}-${m}`}
                            layout
                            initial={{ opacity: 0, y: 10, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.97 }}
                            transition={{ duration: 0.3, ease: EASE }}
                            className="mr-6 self-start rounded-[18px] bg-carbon px-3.5 py-2.5 text-porcelain"
                          >
                            {m}
                          </motion.div>
                        ))}
                        <motion.div
                          key="card"
                          layout
                          transition={{ duration: 0.3, ease: EASE }}
                          className="mr-3 self-stretch rounded-[18px] bg-carbon p-3 shadow-[inset_0_0_0_1px_var(--c-steel)]"
                        >
                          <p className="text-[13px] font-semibold">Here&apos;s what I&apos;ll plan around</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <AnimatePresence initial={false} mode="popLayout">
                              {chips.map((c) => (
                                <motion.span
                                  key={c}
                                  layout
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.8 }}
                                  className="rounded-full px-2.5 py-1 text-[12px] font-medium"
                                  style={{ background: `${p.color}40`, color: "#f5f5f7" }}
                                >
                                  {c}
                                </motion.span>
                              ))}
                            </AnimatePresence>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-1.5 text-[12.5px] font-medium">
                            <span className="flex h-8 items-center justify-center rounded-full bg-porcelain text-obsidian">
                              That&apos;s right
                            </span>
                            <span className="flex h-8 items-center justify-center rounded-full bg-steel text-porcelain">
                              Change something
                            </span>
                          </div>
                        </motion.div>
                        {typing && (
                          <motion.div
                            key="typing"
                            layout
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-1 self-start rounded-[18px] bg-carbon px-3.5 py-3"
                            aria-hidden
                          >
                            {[0, 1, 2].map((d) => (
                              <motion.span
                                key={d}
                                className="h-1.5 w-1.5 rounded-full bg-ash"
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }}
                              />
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </LayoutGroup>
                  </div>
                  <p className="flex items-center justify-center gap-1.5 border-t border-keyline px-3 py-3 text-[11px] text-ash">
                    <Moon size={12} /> {behaviorLine(p)}
                  </p>
                </div>
              </FitPhone>
            </div>
          </div>
        </div>
      </div>

      <div
        className="pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center"
        role="status"
        aria-live="polite"
      >
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast}
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="flex items-center gap-2 rounded-full bg-[rgba(66,66,69,0.9)] px-5 py-3 text-[15px] font-medium text-white glass"
            >
              <Check size={16} /> {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
