"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { mutate } from "swr";
import { FloatingIconButton } from "@/components/FloatingIconButton";
import { BackIcon } from "@/components/Icons";
import { PrimaryPill } from "@/components/PrimaryPill";
import { api } from "@/lib/client";

const field = "flex flex-col gap-1 rounded-[18px] border border-hairline bg-surface px-[18px] py-3 focus-within:border-galaxy";
const input = "bg-transparent text-[17px] font-medium text-ink outline-none placeholder:text-muted";

// Forgot password: a code goes to the phone linked to the account (Settings → Phone), then you
// choose a new password. Reset by email isn't available yet (no email service is set up).
function Forgot() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [step, setStep] = useState<"email" | "code">("email");
  const [note, setNote] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col px-7 pb-[34px] pt-6 lg:mx-auto lg:max-w-md">
      <div className="mb-8">
        <FloatingIconButton label="Back to log in" href="/login">
          <BackIcon />
        </FloatingIconButton>
      </div>
      <h1 className="text-title">Reset your password</h1>
      {step === "email" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const r = await api<{ message: string }>("/api/auth/forgot", { method: "POST", body: JSON.stringify({ email }) });
              setNote(r.message);
              setStep("code");
            });
          }}
          className="mt-6 flex flex-col gap-3"
        >
          <p className="text-body text-muted">We&apos;ll text a code to the phone linked to your account.</p>
          <label className={field}>
            <span className="text-caption text-muted">Email</span>
            <input className={input} type="email" inputMode="email" autoCapitalize="none" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          {error && <p className="text-secondary text-danger">{error}</p>}
          <div className="mt-2">
            <PrimaryPill type="submit" disabled={busy || !email.trim()}>
              {busy ? "Sending…" : "Text me a code"}
            </PrimaryPill>
          </div>
          <p className="mt-4 rounded-2xl bg-bubble px-4 py-3 text-secondary text-muted">
            No phone linked? Password reset needs one for now. Once you&apos;re back in, add your phone in Settings so
            you can always recover your account.
          </p>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api("/api/auth/reset", { method: "POST", body: JSON.stringify({ email, code, password }) });
              await mutate("/api/auth/me");
              router.replace("/start");
            });
          }}
          className="mt-6 flex flex-col gap-3"
        >
          <p className="text-body text-ink-2">{note}</p>
          <label className={field}>
            <span className="text-caption text-muted">Code</span>
            <input className={input} inputMode="numeric" autoComplete="one-time-code" autoFocus value={code} onChange={(e) => setCode(e.target.value)} required />
          </label>
          <label className={field}>
            <span className="text-caption text-muted">New password (8+ characters)</span>
            <input className={input} type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <p className="text-secondary text-danger">{error}</p>}
          <div className="mt-2">
            <PrimaryPill type="submit" disabled={busy || code.trim().length < 4 || password.length < 8}>
              {busy ? "Saving…" : "Set new password"}
            </PrimaryPill>
          </div>
          <button type="button" onClick={() => setStep("email")} className="py-2 text-secondary text-muted">
            Send a new code
          </button>
        </form>
      )}
    </main>
  );
}

export default function ForgotPage() {
  return (
    <Suspense>
      <Forgot />
    </Suspense>
  );
}
