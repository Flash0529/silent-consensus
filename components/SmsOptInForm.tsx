"use client";

import { useState } from "react";
import { SMS_CONSENT_TEXT } from "@/lib/twilio/consent";

const input =
  "h-12 w-full rounded-media border border-slate bg-white/[.04] px-4 text-body text-ink outline-none outline-offset-1 placeholder:text-muted focus:outline-1 focus:outline-galaxy";
const pill =
  "h-12 shrink-0 rounded-full bg-galaxy px-5 text-body text-white transition-colors hover:bg-galaxy-hover disabled:opacity-40";

async function send(method: string, body: unknown) {
  const res = await fetch("/api/sms/optin", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data;
}

/** Public SMS opt-in (/sms). The consent box is never pre-checked; no code is sent until it's ticked. */
export function SmsOptInForm() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [stage, setStage] = useState<"phone" | "code" | "done">("phone");
  const [masked, setMasked] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

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

  if (stage === "done")
    return (
      <div className="rounded-card bg-bubble p-5" role="status">
        <p className="text-question">You&apos;re subscribed ✓</p>
        <p className="mt-2 text-secondary text-ink-2">
          Hush will text {masked} about your group plans. We just sent you a confirmation text. Message frequency varies.
          Msg &amp; data rates may apply. Reply HELP for help, STOP to opt out.
        </p>
      </div>
    );

  return (
    <form
      className="flex flex-col gap-4 rounded-card bg-bubble p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (stage === "phone")
          run(async () => {
            const r = await send("POST", { phone, consent });
            setMasked(r.masked);
            setStage("code");
          });
        else
          run(async () => {
            const r = await send("PUT", { phone, code, consent });
            setMasked(r.masked);
            setStage("done");
          });
      }}
    >
      <label htmlFor="optin-phone" className="text-secondary text-ink-2">
        Mobile number
      </label>
      <input
        id="optin-phone"
        name="phone"
        inputMode="tel"
        autoComplete="tel"
        placeholder="(404) 555-0123"
        value={phone}
        disabled={stage === "code"}
        onChange={(e) => setPhone(e.target.value)}
        className={input}
      />

      <label htmlFor="optin-consent" className="flex cursor-pointer items-start gap-3 text-secondary text-ink-2">
        <input
          id="optin-consent"
          name="consent"
          type="checkbox"
          checked={consent}
          disabled={stage === "code"}
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

      {stage === "code" && (
        <>
          <label htmlFor="optin-code" className="text-secondary text-ink-2">
            Enter the code we texted to {masked}
          </label>
          <input
            id="optin-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={input}
          />
        </>
      )}

      <button
        type="submit"
        className={pill}
        disabled={busy || !consent || phone.trim().length < 7 || (stage === "code" && code.trim().length < 4)}
      >
        {stage === "phone" ? "Agree & send code" : "Verify & subscribe"}
      </button>

      {err && (
        <p className="text-secondary text-[#ff6961]" role="alert">
          {err}
        </p>
      )}
    </form>
  );
}
