"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HushMascot } from "@/components/HushMascot";
import { PrimaryPill } from "@/components/PrimaryPill";
import { FloatingIconButton } from "@/components/FloatingIconButton";
import { BackIcon } from "@/components/Icons";
import { api } from "@/lib/client";
import { safeNext, useAccount } from "@/lib/useAccount";

const field = "flex flex-col gap-1 rounded-[18px] border border-hairline bg-surface px-[18px] py-3 focus-within:border-galaxy";
const input = "bg-transparent text-[17px] font-medium text-ink outline-none placeholder:text-muted";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const signedUp = useRef(false);
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState<"login" | "signup">(params.get("mode") === "signup" ? "signup" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [codeFor, setCodeFor] = useState<string | null>(null); // two-step login: masked phone
  // Business: the work sign-in opens under the normal one, on this same page.
  const [biz, setBiz] = useState(params.get("business") === "1");
  const [bizMode, setBizMode] = useState<"login" | "signup">("login");
  const [company, setCompany] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const { data, mutate } = useAccount();

  // Already logged in: go straight on.
  useEffect(() => {
    if (data?.account && !signedUp.current) router.replace(next);
  }, [data?.account, next, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (codeFor) {
        await api("/api/auth/login/code", { method: "POST", body: JSON.stringify({ code }) });
      } else {
        if (mode === "signup") signedUp.current = true;
        const r = await api<{ needsCode?: boolean; masked?: string }>(`/api/auth/${mode}`, {
          method: "POST",
          body: JSON.stringify(mode === "signup" ? { name, email, password } : { email, password }),
        });
        if (r.needsCode) {
          setCodeFor(r.masked ?? "your phone");
          setBusy(false);
          return;
        }
      }
      await mutate();
      // New account: nudge them to link a phone first (password reset, two-step login, finding friends).
      router.replace(signedUp.current ? `/welcome?next=${encodeURIComponent(next)}` : next);
    } catch (err) {
      signedUp.current = false;
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  };

  const submitBiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (bizMode === "signup") signedUp.current = true;
      const r = await api<{ needsCode?: boolean; masked?: string }>(
        bizMode === "login" ? "/api/auth/business" : "/api/auth/signup",
        {
          method: "POST",
          body: JSON.stringify(bizMode === "login" ? { email, password } : { name, email, password, company }),
        },
      );
      if (r.needsCode) {
        setCodeFor(r.masked ?? "your phone");
        setBusy(false);
        return;
      }
      await mutate();
      router.replace(bizMode === "signup" ? `/welcome?next=${encodeURIComponent(next)}` : next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  };

  const signup = mode === "signup";
  return (
    <main className="relative flex min-h-dvh flex-col px-7 pb-[34px] pt-6">
      <div className="mb-6">
        <FloatingIconButton label="Back" href="/start">
          <BackIcon />
        </FloatingIconButton>
      </div>
      <div className="flex flex-col items-center gap-3 pb-8 pt-4 text-center">
        <HushMascot size={72} label="Hush" animated />
        <h1 className="text-title">{signup ? "Create your account" : "Welcome back"}</h1>
        <p className="max-w-[300px] text-body text-muted">
          {signup
            ? "Your chats and plans are saved to your account, on any device."
            : "Log in to get back to your chats and plans."}
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 rounded-full bg-bubble p-1" role="tablist">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError("");
            }}
            className={`h-11 rounded-full text-secondary font-semibold transition ${mode === m ? "bg-ink text-on-ink" : "text-muted"}`}
          >
            {m === "login" ? "Log in" : "Create account"}
          </button>
        ))}
      </div>

      {codeFor ? (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <p className="text-body text-ink-2">Two-step login is on. We texted a code to {codeFor}.</p>
          <label className={field}>
            <span className="text-caption text-muted">Code</span>
            <input
              className={input}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </label>
          {error && (
            <p className="text-secondary text-danger" role="alert">
              {error}
            </p>
          )}
          <div className="mt-3">
            <PrimaryPill type="submit" disabled={busy || code.trim().length < 4}>
              {busy ? "Checking…" : "Log in"}
            </PrimaryPill>
          </div>
          <button type="button" onClick={() => { setCodeFor(null); setCode(""); }} className="py-2 text-secondary text-muted">
            Start over
          </button>
        </form>
      ) : (
      <form onSubmit={submit} className="flex flex-col gap-3">
        {signup && (
          <label className={field}>
            <span className="text-caption text-muted">Your first name</span>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={30} required />
          </label>
        )}
        <label className={field}>
          <span className="text-caption text-muted">Email</span>
          <input
            className={input}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className={field}>
          <span className="text-caption text-muted">Password{signup ? " (8+ characters)" : ""}</span>
          <input
            className={input}
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            minLength={signup ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && !biz && (
          <p className="text-secondary text-danger" role="alert">
            {error}
          </p>
        )}
        <div className="mt-3">
          <PrimaryPill type="submit" disabled={busy}>{busy ? "One sec…" : signup ? "Create account" : "Log in"}</PrimaryPill>
        </div>
        {!signup && (
          <a href={`/forgot${email ? `?email=${encodeURIComponent(email)}` : ""}`} className="py-2 text-center text-secondary font-medium text-galaxy">
            Forgot password?
          </a>
        )}
      </form>
      )}
      {!codeFor && (
        <div className="mt-6">
          <div className="flex items-center gap-3 text-caption text-muted">
            <span className="h-px grow bg-divider" /> or <span className="h-px grow bg-divider" />
          </div>
          {!biz ? (
            <button
              type="button"
              onClick={() => {
                setBiz(true);
                setError("");
              }}
              className="mt-4 flex h-pill w-full items-center justify-center gap-2 rounded-full border border-hairline text-body font-semibold hover:bg-bubble"
            >
              <span aria-hidden>🏢</span> Sign in with your work account
            </button>
          ) : (
            <form onSubmit={submitBiz} className="mt-4 flex flex-col gap-3 rounded-[22px] border border-hairline bg-surface-2 p-4">
              <div className="flex items-center gap-2">
                <p className="grow text-question">{bizMode === "login" ? "Work sign-in" : "Create a work account"}</p>
                <button type="button" onClick={() => setBiz(false)} className="text-caption text-muted hover:text-ink">
                  Close
                </button>
              </div>
              <p className="text-secondary text-muted">
                {bizMode === "login"
                  ? "Use your company email. You'll land in your company's workspace."
                  : "Set up your company, or join it if your coworkers are already here."}
              </p>
              {bizMode === "signup" && (
                <>
                  <label className={field}>
                    <span className="text-caption text-muted">Your name</span>
                    <input className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={30} required />
                  </label>
                  <label className={field}>
                    <span className="text-caption text-muted">Company name (if you&apos;re the first one here)</span>
                    <input className={input} value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="organization" maxLength={80} required />
                  </label>
                </>
              )}
              <label className={field}>
                <span className="text-caption text-muted">Work email</span>
                <input className={input} type="email" inputMode="email" autoCapitalize="none" autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <label className={field}>
                <span className="text-caption text-muted">Password{bizMode === "signup" ? " (8+ characters)" : ""}</span>
                <input className={input} type="password" autoComplete={bizMode === "signup" ? "new-password" : "current-password"} minLength={bizMode === "signup" ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} required />
              </label>
              {error && (
                <p className="text-secondary text-danger" role="alert">
                  {error}
                </p>
              )}
              <PrimaryPill type="submit" disabled={busy}>
                {busy ? "One sec…" : bizMode === "login" ? "Sign in to work" : "Create work account"}
              </PrimaryPill>
              <div className="flex flex-wrap justify-between gap-2 text-secondary">
                <button type="button" onClick={() => setBizMode(bizMode === "login" ? "signup" : "login")} className="font-semibold text-galaxy">
                  {bizMode === "login" ? "New company? Create a work account" : "Already set up? Sign in"}
                </button>
                {bizMode === "login" && (
                  <button
                    type="button"
                    onClick={() => {
                      setEmail("priya@northwind.test");
                      setPassword("northwind-demo");
                    }}
                    className="text-muted underline hover:text-ink"
                  >
                    Use the demo company
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      )}
      <p className="mt-6 text-center text-caption text-muted">
        By continuing you agree to our{" "}
        <a href="/terms" className="underline">
          Terms
        </a>{" "}
        and{" "}
        <a href="/privacy" className="underline">
          Privacy Policy
        </a>
        .
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
