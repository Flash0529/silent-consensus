"use client";

import { useState } from "react";
import { Sheet } from "./Sheet";
import { BackIcon, CloseIcon } from "./Icons";
import { useTheme, type ThemePref } from "@/lib/theme";
import { api } from "@/lib/client";
import { version } from "@/package.json";

const THEMES: { id: ThemePref; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

type View = "main" | "about" | "forget";

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { theme, setTheme } = useTheme();
  const [view, setView] = useState<View>("main");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const close = () => {
    onClose();
    // Reset after the exit animation so the sheet doesn't visibly jump.
    setTimeout(() => {
      setView("main");
      setResult(null);
    }, 250);
  };

  const forget = async () => {
    setBusy(true);
    try {
      const res = await api<{ forgotten: number; profileDeleted: boolean }>("/api/me/forget", { method: "POST" });
      const plans = res.forgotten - (res.profileDeleted ? 1 : 0);
      const parts = [
        plans > 0 ? `no longer remembers ${plans === 1 ? "your plan" : `your ${plans} plans`}` : "",
        res.profileDeleted ? "your saved preferences are deleted" : "",
      ].filter(Boolean);
      setResult(parts.length ? `Done. This device ${parts.join(", and ")}.` : "This device wasn't remembering anything.");
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={close} label="Settings">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          {view !== "main" && (
            <button
              type="button"
              aria-label="Back to settings"
              onClick={() => {
                setView("main");
                setResult(null);
              }}
              className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full active:bg-control"
            >
              <BackIcon />
            </button>
          )}
          <h2 className="grow text-card-title">
            {view === "main" ? "Settings" : view === "about" ? "About & privacy" : "Forget this device"}
          </h2>
          <button
            type="button"
            aria-label="Close settings"
            onClick={close}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-control"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {view === "main" && (
          <>
            <section className="flex flex-col gap-2">
              <h3 className="px-1 text-caption font-medium text-muted">Appearance</h3>
              <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-btn bg-control p-1">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={theme === t.id}
                    onClick={() => setTheme(t.id)}
                    className={`h-10 rounded-[10px] text-secondary font-medium transition ${
                      theme === t.id ? "bg-surface shadow-float" : "text-muted"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </section>

            <ul className="flex flex-col overflow-hidden rounded-list border border-hairline bg-surface">
              <li className="border-b border-divider">
                <button
                  type="button"
                  onClick={() => setView("about")}
                  className="flex min-h-row w-full items-center justify-between px-4 text-left text-body active:bg-surface-2"
                >
                  About & privacy
                  <BackIcon size={18} className="rotate-180 text-muted" />
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setView("forget")}
                  className="flex min-h-row w-full items-center justify-between px-4 text-left text-body text-danger active:bg-surface-2"
                >
                  Forget this device
                  <BackIcon size={18} className="rotate-180 text-muted" />
                </button>
              </li>
            </ul>
          </>
        )}

        {view === "about" && (
          <div className="flex flex-col gap-4">
            <p className="text-body text-ink-2">
              Hush checks in with each friend privately, then plans something the whole group can actually do.
            </p>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-body text-ink-2">
              <li>Your chat with Hush is private, even from the organizer.</li>
              <li>The group sees the plan and who has finished, never what anyone said.</li>
              <li>Every group message is checked so no one's reasons show.</li>
              <li>No account. A cookie on this device remembers you for each plan you join.</li>
            </ul>
            <p className="text-caption text-muted">Silent Consensus v{version}</p>
          </div>
        )}

        {view === "forget" && (
          <div className="flex flex-col gap-4">
            {result ? (
              <>
                <p className="text-body" role="status">
                  {result}
                </p>
                <button type="button" onClick={close} className="h-row rounded-btn bg-ink text-body font-medium text-on-ink">
                  Done
                </button>
              </>
            ) : (
              <>
                <p className="text-body text-ink-2">
                  This signs this device out of every plan it has joined and deletes any preferences Hush remembered here.
                  Answers in current plans stay with Hush and the group still counts you, but you won't be able to reopen
                  those chats here.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setView("main")}
                    className="h-row rounded-btn bg-hairline text-body font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={forget}
                    disabled={busy}
                    className="h-row rounded-btn bg-danger text-body font-medium text-on-ink disabled:opacity-40"
                  >
                    {busy ? "Forgetting…" : "Forget"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
