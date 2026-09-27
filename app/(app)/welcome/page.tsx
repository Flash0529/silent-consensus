"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { safeNext } from "@/lib/useAccount";
import { BrandLogo } from "@/components/BrandLogo";
import { HushMascot } from "@/components/HushMascot";

// Right after signing up: link your phone (verified by a texted code). Skippable, but it's how you
// reset a forgotten password, turn on two-step login, and let friends find you.
export default function Welcome() {
  return (
    <Suspense fallback={<main className="min-h-dvh" />}>
      <LinkPhone />
    </Suspense>
  );
}

function LinkPhone() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ masked: string }>("/api/account/phone", { method: "POST", body: JSON.stringify({ phone }) });
      setSent(r.masked);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Couldn't send a code.");
    }
    setBusy(false);
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await api("/api/account/phone", { method: "PUT", body: JSON.stringify({ phone, code }) });
      router.replace(next);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "That code didn't work.");
      setBusy(false);
    }
  };
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-7 pb-10 pt-10 lg:justify-center">
      <BrandLogo size={26} href={null} />
      <div className="mt-10 flex flex-col items-center text-center">
        <HushMascot size={80} animated />
        <h1 className="mt-4 text-title">Add your phone</h1>
        <p className="mt-2 text-body text-muted">We&apos;ll text you a code to confirm it. Your number is encrypted and never shown to anyone.</p>
        <ul className="mt-4 flex flex-col gap-1.5 text-left text-secondary text-ink-2">
          <li>✓ Reset your password if you forget it</li>
          <li>✓ Turn on two-step login</li>
          <li>✓ Friends who have your number can find you</li>
        </ul>
      </div>
      {!sent ? (
        <form onSubmit={send} className="mt-8 flex flex-col gap-3">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="Mobile number"
            className="h-12 rounded-2xl bg-bubble px-4 text-body text-ink outline-none focus:outline-1 focus:outline-galaxy"
          />
          <button disabled={busy || phone.trim().length < 7} className="h-12 rounded-full bg-galaxy text-body font-semibold text-white disabled:opacity-50">
            {busy ? "Sending…" : "Text me a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-8 flex flex-col gap-3">
          <p className="text-center text-secondary text-muted">We texted a code to {sent}.</p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            className="h-12 rounded-2xl bg-bubble px-4 text-center text-[20px] tracking-[0.3em] text-ink outline-none focus:outline-1 focus:outline-galaxy"
          />
          <button disabled={busy || code.trim().length < 4} className="h-12 rounded-full bg-galaxy text-body font-semibold text-white disabled:opacity-50">
            {busy ? "Checking…" : "Confirm"}
          </button>
        </form>
      )}
      {err && <p className="mt-3 text-center text-secondary text-danger">{err}</p>}
      <Link href={next} className="mt-4 py-2 text-center text-secondary text-muted">
        Skip for now
      </Link>
    </main>
  );
}
