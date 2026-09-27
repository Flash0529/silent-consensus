"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/client";
import { CheckIcon, PlusIcon } from "./Icons";
import { SMS_CONSENT_TEXT } from "@/lib/twilio/consent";

type PhoneState = {
  linked: boolean;
  optedOut: boolean;
  masked: string | null;
  verifyEnabled: boolean;
  textingEnabled: boolean;
};

const input =
  "h-12 w-full rounded-media border border-slate bg-white/[.04] px-4 text-body text-ink outline-none outline-offset-1 placeholder:text-muted focus:outline-1 focus:outline-galaxy";

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data;
}

/**
 * "Text with Hush" (spec §3.1): link your own phone so Hush can check in by SMS, and, for the
 * organizer, start the group text that Hush joins. Never shows anyone else's number.
 */
export function TextingCard({
  slug,
  isOrganizer,
  groupText,
}: {
  slug: string;
  isOrganizer: boolean;
  groupText: boolean;
}) {
  const { data, mutate } = useSWR<PhoneState>(`/api/me/phone?c=${slug}`, fetcher);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"idle" | "code">("idle");
  // SMS opt-in: never pre-checked; no code is sent until it's ticked.
  const [consent, setConsent] = useState(false);
  const [justLinked, setJustLinked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [invites, setInvites] = useState<{ name: string; phone: string }[]>([]);
  const [groupMsg, setGroupMsg] = useState("");

  if (!data) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      await send(`/api/me/phone?c=${slug}`, "POST", { phone, consent });
      setStage("code");
    });
  const checkCode = () =>
    run(async () => {
      await send(`/api/me/phone?c=${slug}`, "PUT", { phone, code, consent });
      setStage("idle");
      setCode("");
      setJustLinked(true);
      await mutate();
    });
  const unlink = () =>
    run(async () => {
      await send(`/api/me/phone?c=${slug}`, "DELETE");
      setConsent(false);
      setJustLinked(false);
      await mutate();
    });
  const startGroup = () =>
    run(async () => {
      const r = await send(`/api/circles/${slug}/group`, "POST", { invite: invites.filter((i) => i.name && i.phone) });
      const left: string[] = r.notOptedIn ?? [];
      setGroupMsg(
        `Group text started with ${r.participants} people. Hush just said hi.` +
          (left.length
            ? ` ${left.join(", ")} ${left.length === 1 ? "wasn't" : "weren't"} added because they haven't agreed to texts yet. Send them this plan's invite link so they can opt in.`
            : ""),
      );
      setInvites([]);
    });

  return (
    <section className="flex flex-col gap-4 rounded-card bg-bubble p-5" aria-label="Text with Hush">
      <div>
        <p className="text-question">Text with Hush</p>
        <p className="mt-1 text-secondary text-muted">
          Hush can check in by text and join your group chat. Same private chat, no app needed.
        </p>
      </div>

      {!data.verifyEnabled ? (
        <p className="text-secondary text-muted">Texting isn&apos;t turned on for this server yet.</p>
      ) : data.linked ? (
        <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-secondary">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink">
              <CheckIcon size={12} color="#000000" stroke={3.2} />
            </span>
            Texts go to {data.masked}
          </p>
          <button type="button" onClick={unlink} disabled={busy} className="text-secondary text-link hover:underline">
            Remove
          </button>
        </div>
          {data.optedOut ? (
            <p className="text-secondary text-muted">You replied STOP, so Hush won&apos;t text you. Text START to Hush to turn texts back on.</p>
          ) : justLinked ? (
            <p className="text-secondary text-muted" role="status">
              You&apos;re subscribed. We just texted you a confirmation. Reply STOP anytime to opt out.
            </p>
          ) : null}
        </div>
      ) : stage === "idle" ? (
        <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="tc-phone">
            Your mobile number
          </label>
          <input
            id="tc-phone"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Your mobile number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={input}
          />
          <button
            type="button"
            onClick={sendCode}
            disabled={busy || !consent || phone.trim().length < 7}
            className="h-12 shrink-0 rounded-full bg-galaxy px-5 text-body text-white transition-colors hover:bg-galaxy-hover disabled:opacity-40"
          >
            Agree &amp; send code
          </button>
        </div>
          <label htmlFor="tc-consent" className="flex cursor-pointer items-start gap-3 text-secondary text-ink-2">
            <input
              id="tc-consent"
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-galaxy"
            />
            <span>
              {SMS_CONSENT_TEXT} See our{" "}
              <a href="/terms" target="_blank" className="text-link underline">
                Terms
              </a>{" "}
              and{" "}
              <a href="/privacy" target="_blank" className="text-link underline">
                Privacy Policy
              </a>
              .
            </span>
          </label>
        </div>
      ) : (
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="tc-code">
            Verification code
          </label>
          <input
            id="tc-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={input}
          />
          <button
            type="button"
            onClick={checkCode}
            disabled={busy || code.trim().length < 4}
            className="h-12 shrink-0 rounded-full bg-galaxy px-5 text-body text-white transition-colors hover:bg-galaxy-hover disabled:opacity-40"
          >
            Verify
          </button>
        </div>
      )}

      {isOrganizer && data.textingEnabled && !groupText && !groupMsg && (
        <div className="flex flex-col gap-3 border-t border-divider pt-4">
          <p className="text-secondary text-ink-2">
            Start a group text with everyone who linked a number and agreed to texts. Friends can only be added
            once they&apos;ve opted in themselves; anyone else is left out and gets no texts:
          </p>
          {invites.map((inv, i) => (
            <div key={i} className="grid grid-cols-[1fr_1.3fr] gap-2">
              <input
                aria-label={`Friend ${i + 1} name`}
                placeholder="Name"
                value={inv.name}
                onChange={(e) => setInvites((xs) => xs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                className={input}
              />
              <input
                aria-label={`Friend ${i + 1} number`}
                inputMode="tel"
                placeholder="Mobile number"
                value={inv.phone}
                onChange={(e) => setInvites((xs) => xs.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))}
                className={input}
              />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {invites.length < 8 && (
              <button
                type="button"
                onClick={() => setInvites((xs) => [...xs, { name: "", phone: "" }])}
                className="flex h-11 items-center gap-1.5 rounded-full px-4 text-secondary text-ink shadow-[inset_0_0_0_1px_#6e6e73]"
              >
                <PlusIcon size={16} /> Add a friend
              </button>
            )}
            <button
              type="button"
              onClick={startGroup}
              disabled={busy}
              className="h-11 rounded-full bg-galaxy px-5 text-secondary text-white transition-colors hover:bg-galaxy-hover disabled:opacity-40"
            >
              Start group text
            </button>
          </div>
        </div>
      )}

      {(groupText || groupMsg) && (
        <p className="border-t border-divider pt-4 text-secondary text-ink-2">
          {groupMsg || "Hush is in your group text. It reads along and checks in privately when a plan seems stuck."}
        </p>
      )}

      {err && (
        <p className="text-secondary text-[#ff6961]" role="alert">
          {err}
        </p>
      )}
    </section>
  );
}
