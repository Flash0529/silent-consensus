"use client";

import { AnimatePresence, motion, useMotionValueEvent } from "framer-motion";
import { useRef, useState } from "react";
import { HushMascot } from "@/components/HushMascot";
import { Check, Lock } from "../icons";
import { EASE, useElementProgress } from "../motion";
import { FitPhone } from "../PhoneFrame";
import { Avatar, FRIENDS } from "../ui";

const STEPS = [
  {
    k: "01",
    title: "Hush checks in. Privately.",
    body: "Each friend gets a short one-on-one chat. Tap an answer, type, or send a voice note. Budget, food, drinks, getting around, timing. Hush never asks why.",
  },
  {
    k: "02",
    title: "Then plans around everyone.",
    body: "A hybrid pipeline filters real places against every limit, composes the plan, and runs a leak check so nothing anyone said shows up in the group.",
  },
  {
    k: "03",
    title: "And quietly evens out the cost.",
    body: "Friends with room to spare can chip in anonymously. Whoever needed it just sees a lower share. Nobody learns who gave or who was helped.",
  },
];

export function HowItWorks() {
  const ref = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);
  const scrollYProgress = useElementProgress(ref, 0, 1);
  useMotionValueEvent(scrollYProgress, "change", (v) => setStep(Math.min(2, Math.floor(v * 3))));

  return (
    <section data-theme-section="dark" id="how" ref={ref} className="relative h-[330vh]" aria-label="How it works">
      <div className="sticky top-0 flex h-svh items-center overflow-hidden pt-16">
        <div className="mx-auto grid w-full max-w-[1200px] items-center gap-6 px-5 sm:px-8 lg:grid-cols-[1fr_auto] lg:gap-20">
          <div>
            <p className="text-product text-ash">How it works</p>
            {/* Desktop: all steps, active one lit. Mobile: only the active step. */}
            <ol className="mt-4 hidden flex-col gap-8 lg:flex">
              {STEPS.map((s, i) => (
                <li key={s.k}>
                  <motion.div
                    animate={{ opacity: i === step ? 1 : 0.28 }}
                    transition={{ duration: 0.5, ease: EASE }}
                    className="flex gap-5"
                  >
                    <span className="mt-2 text-body-sm font-semibold tabular-nums text-ash">{s.k}</span>
                    <div>
                      <h3 className="text-headline text-porcelain xl:text-display-sm">{s.title}</h3>
                      <motion.p
                        initial={false}
                        animate={{ height: i === step ? "auto" : 0, opacity: i === step ? 1 : 0 }}
                        transition={{ duration: 0.5, ease: EASE }}
                        className="max-w-[480px] overflow-hidden text-label font-normal text-ash"
                      >
                        <span className="block pt-3">{s.body}</span>
                      </motion.p>
                    </div>
                  </motion.div>
                </li>
              ))}
            </ol>
            <div className="relative mt-3 min-h-[150px] lg:hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.35, ease: EASE }}
                >
                  <h3 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.3px] text-porcelain sm:text-headline">
                    {STEPS[step].title}
                  </h3>
                  <p className="mt-2 text-lead text-ash sm:text-[19px]">{STEPS[step].body}</p>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="mt-4 flex gap-2 lg:mt-10" aria-hidden>
              {STEPS.map((s, i) => (
                <span key={s.k} className="h-1 w-10 overflow-hidden rounded-full bg-steel">
                  <motion.span
                    className="block h-full rounded-full bg-porcelain"
                    animate={{ width: i <= step ? "100%" : "0%" }}
                    transition={{ duration: 0.5, ease: EASE }}
                  />
                </span>
              ))}
            </div>
          </div>

          <div className="relative flex justify-center">
            <div
              aria-hidden
              className="spotlight pointer-events-none absolute left-1/2 top-1/2 h-[120%] w-[160%] -translate-x-1/2 -translate-y-1/2"
            />
            <FitPhone className="h-[min(640px,50svh)] lg:h-[min(676px,78svh)]">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={step}
                  className="absolute inset-0 flex flex-col px-4 pb-5 pt-12"
                  initial={{ opacity: 0, x: 40, filter: "blur(6px)" }}
                  animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, x: -40, filter: "blur(6px)" }}
                  transition={{ duration: 0.5, ease: EASE }}
                >
                  {step === 0 && <ScreenInterview />}
                  {step === 1 && <ScreenPlanning />}
                  {step === 2 && <ScreenShare />}
                </motion.div>
              </AnimatePresence>
            </FitPhone>
          </div>
        </div>
      </div>
    </section>
  );
}

function PhoneHeader() {
  return (
    <div className="mx-auto flex items-center gap-2 rounded-full bg-carbon px-2 py-1 pr-3 shadow-[inset_0_0_0_1px_var(--c-steel)]">
      <HushMascot size={24} />
      <span className="text-[14px] font-semibold">Hush</span>
      <span className="flex items-center gap-1 text-[11px] font-medium text-ash">
        <Lock size={11} /> Private
      </span>
    </div>
  );
}

function ScreenInterview() {
  const opts = ["Under $15", "$15 to $30", "$30 to $50", "Whatever works"];
  return (
    <>
      <PhoneHeader />
      <div className="mt-4 flex flex-col gap-2.5 text-[13.5px] leading-snug">
        <Bubble>Hey Maya! Omar&apos;s planning Saturday. Quick one, just between us.</Bubble>
        <div className="mr-3 rounded-[20px] bg-carbon p-2.5 pt-3">
          <p className="px-1.5 text-[14px] font-semibold">What&apos;s a comfortable spend?</p>
          <div className="mt-2 overflow-hidden rounded-2xl bg-obsidian shadow-[inset_0_0_0_1px_var(--c-steel)]">
            {opts.map((o, i) => (
              <motion.div
                key={o}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.07 }}
                className={`flex items-center gap-2.5 px-3 py-2.5 ${i < opts.length - 1 ? "border-b border-keyline" : ""} ${
                  i === 0 ? "bg-white/[.06]" : ""
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-medium ${
                    i === 0 ? "bg-porcelain text-obsidian" : "bg-steel text-ash"
                  }`}
                >
                  {"ABCD"[i]}
                </span>
                <span className="grow">{o}</span>
                {i === 0 && <Check size={14} />}
              </motion.div>
            ))}
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="self-end rounded-[20px] bg-porcelain px-3.5 py-2.5 text-obsidian"
        >
          Under $15
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
          <Bubble>Got it. That stays with me. Anything about food?</Bubble>
        </motion.div>
      </div>
      <p className="mt-auto flex items-center justify-center gap-1.5 text-[11px] text-ash">
        <Lock size={11} /> Only Hush sees this chat
      </p>
    </>
  );
}

function ScreenPlanning() {
  const rows = [
    "Read 4 private chats",
    "Found 9 places that fit everyone",
    "Balancing everyone's costs",
    "Checking nothing private shows",
  ];
  return (
    <>
      <p className="text-center text-[13px] font-medium text-ash">Saturday night · Group</p>
      <div className="mt-3 flex justify-center -space-x-2">
        {FRIENDS.map((f, i) => (
          <motion.span
            key={f.name}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.08, type: "spring" }}
          >
            <Avatar {...f} size={34} ring />
          </motion.span>
        ))}
      </div>
      <div className="mt-4 rounded-[22px] bg-carbon p-4">
        <div className="flex items-center gap-2">
          <HushMascot size={26} />
          <p className="text-[15px] font-semibold">Hush is planning</p>
        </div>
        <ol className="mt-3 flex flex-col gap-2.5 text-[13px]">
          {rows.map((r, i) => (
            <motion.li
              key={r}
              initial={{ opacity: 0.35 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.45 }}
              className="flex items-center gap-2.5"
            >
              <motion.span
                initial={{ backgroundColor: "#333336", color: "#86868b" }}
                animate={{ backgroundColor: "#f5f5f7", color: "#000000" }}
                transition={{ delay: 0.5 + i * 0.45 }}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
              >
                <Check size={11} />
              </motion.span>
              {r}
            </motion.li>
          ))}
        </ol>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.3, duration: 0.5, ease: EASE }}
        className="mt-3 rounded-[22px] bg-carbon p-4 shadow-[inset_0_0_0_1px_var(--c-steel)]"
      >
        <p className="text-[16px] font-semibold tracking-[-0.01em]">Picnic + food truck night</p>
        <p className="mt-1 text-[12.5px] text-ash">Step-free paths · Halal options · No bar</p>
        <p className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-[#30d158]">
          <Check size={13} /> Checked: nothing anyone told Hush shows here
        </p>
      </motion.div>
    </>
  );
}

function ScreenShare() {
  return (
    <>
      <p className="text-center text-[13px] font-medium text-ash">Your share · Maya</p>
      <div className="mt-6 text-center">
        <motion.p
          initial={{ opacity: 1 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 0.6 }}
          className="text-[18px] font-medium text-ash line-through"
        >
          $25
        </motion.p>
        <motion.p
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.9, type: "spring", stiffness: 200, damping: 16 }}
          className="text-[64px] font-semibold leading-none tracking-[-0.04em]"
        >
          $15
        </motion.p>
        <p className="mt-2 text-[13px] text-ash">Exactly your limit</p>
      </div>
      <div className="mt-6 rounded-[22px] bg-carbon p-4 text-[13px]">
        {[
          ["Food truck dinner", "$16"],
          ["Dessert", "$5"],
          ["Picnic supplies", "$4"],
        ].map(([a, b]) => (
          <div key={a} className="flex justify-between py-1">
            <span>{a}</span>
            <span className="tabular-nums">{b}</span>
          </div>
        ))}
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ delay: 1.3, duration: 0.5 }}
          className="mt-1 flex justify-between border-t border-steel pt-2 font-medium text-porcelain"
        >
          <span>A quiet group pool covered</span>
          <span className="tabular-nums">−$10</span>
        </motion.div>
      </div>
      <div className="mt-auto flex h-12 items-center justify-center rounded-full bg-galaxy text-[15px] font-medium text-white">
        Pay $15
      </div>
      <p className="mt-2 text-center text-[10.5px] text-ash">Demo payment. No real money moves.</p>
    </>
  );
}

function Bubble({ children }: { children: React.ReactNode }) {
  return <div className="mr-8 self-start rounded-[20px] bg-carbon px-3.5 py-2.5">{children}</div>;
}
