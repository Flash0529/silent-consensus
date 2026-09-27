"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { HushMascot } from "@/components/HushMascot";
import { ArrowRight, Check } from "./icons";
import { EASE, Reveal, SplitWords } from "./motion";
import { EMAIL_RE, Honeypot, submitLead } from "./submitLead";

const KEY = "qc.waitlist.v1";

export function EarlyAccess({
  title = "Be first to say yes.",
  sub = "Silent Consensus works in your browser today, and the Android app is coming soon. Leave your email and we’ll let you know the day it lands.",
  source = "home",
}: {
  title?: string;
  sub?: string;
  source?: string;
}) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) setDone(true);
    } catch {}
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter an email like you@example.com");
      return;
    }
    setError("");
    setSending(true);
    const err = await submitLead({ kind: "WAITLIST", email: email.trim(), source, website });
    setSending(false);
    if (err) {
      setError(err);
      return;
    }
    try {
      // Only remember that this browser signed up, not the address.
      localStorage.setItem(KEY, "1");
    } catch {}
    setDone(true);
  };

  return (
    <section
      data-theme-section="carbon"
      id="early-access"
      className="relative overflow-hidden py-36 text-porcelain sm:py-48"
      aria-label="Get early access"
    >
      <div
        aria-hidden
        className="spotlight pointer-events-none absolute left-1/2 top-[28%] h-[60vmin] w-[60vmin] -translate-x-1/2 -translate-y-1/2"
      />
      <div className="relative mx-auto flex max-w-[760px] flex-col items-center px-5 text-center">
        <Reveal>
          <div className="animate-bob">
            <HushMascot size={72} />
          </div>
        </Reveal>
        <h2 className="mt-8 text-balance text-[48px] font-semibold leading-[1.05] tracking-[-0.6px] text-porcelain sm:text-display">
          <SplitWords text={title} inView />
        </h2>
        <Reveal delay={0.2}>
          <p className="mt-6 max-w-[540px] text-pretty text-[19px] leading-[1.42] text-ash sm:text-label sm:font-normal">
            {sub}
          </p>
        </Reveal>

        <Reveal delay={0.3} className="mt-10 w-full max-w-[480px]">
          <AnimatePresence mode="wait" initial={false}>
            {done ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="flex items-center justify-center gap-3 rounded-media bg-obsidian px-6 py-4 text-lead text-porcelain"
                role="status"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#30d158] text-black">
                  <Check size={16} />
                </span>
                You&apos;re on the list. We&apos;ll be in touch.
              </motion.div>
            ) : (
              <motion.form
                key="form"
                onSubmit={submit}
                noValidate
                exit={{ opacity: 0, scale: 0.97 }}
                className="relative"
                aria-busy={sending}
              >
                <Honeypot value={website} onChange={setWebsite} />
                <label htmlFor="ea-email" className="sr-only">
                  Email address
                </label>
                <div className="flex rounded-media bg-porcelain/[.04] p-1.5 shadow-[inset_0_0_0_1px_#6e6e73] outline-offset-1 transition focus-within:outline focus-within:outline-1 focus-within:outline-galaxy">
                  <input
                    id="ea-email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError("");
                    }}
                    aria-invalid={!!error}
                    aria-describedby={error ? "ea-err" : undefined}
                    placeholder="you@example.com"
                    className="min-w-0 flex-1 bg-transparent pl-4 text-lead text-porcelain placeholder:text-slate focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={sending}
                    className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-galaxy px-5 text-lead text-white transition-colors hover:bg-galaxy-hover active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
                  >
                    {sending ? (
                      <>
                        <Spinner /> Sending
                      </>
                    ) : (
                      <>
                        Notify me <ArrowRight size={17} />
                      </>
                    )}
                  </button>
                </div>
                {error && (
                  <p id="ea-err" className="mt-3 text-left text-body-sm text-[#ff6961]" role="alert">
                    {error}
                  </p>
                )}
              </motion.form>
            )}
          </AnimatePresence>
        </Reveal>

        <Reveal delay={0.4} className="mt-10 flex flex-wrap justify-center gap-3">
          <span className="rounded-media px-5 py-2.5 text-left shadow-[inset_0_0_0_1px_var(--c-steel)]">
            <span className="block text-micro font-semibold text-amber">Coming soon to</span>
            <span className="text-lead font-medium text-porcelain">Android</span>
          </span>
        </Reveal>
      </div>
    </section>
  );
}

export function Spinner() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" className="animate-spin" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".2" strokeWidth="3" />
      <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
