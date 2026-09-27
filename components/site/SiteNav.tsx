"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { HushMascot } from "@/components/HushMascot";
import { ArrowRight, Briefcase, Users } from "./icons";
import { EASE } from "./motion";
import { pillClass } from "./ui";

const SECTIONS = [
  {
    key: "social",
    eyebrow: "Social",
    title: "For Friends",
    blurb: "Group chats where Hush plans privately with everyone, finds real places, and handles the money quietly.",
    href: "/friends",
    icon: Users,
    links: [
      { label: "How Hush plans privately", href: "/friends#modes" },
      { label: "The quiet chip-in", href: "/friends#chip-in" },
      { label: "Make Hush yours", href: "/friends#studio" },
    ],
  },
  {
    key: "business",
    eyebrow: "Business",
    title: "For Teams",
    blurb: "Work chats with meetings and action items tracked for you, a tone check before sending, and admin controls.",
    href: "/teams",
    icon: Briefcase,
    links: [
      { label: "What works today", href: "/teams#capabilities" },
      { label: "What admins see", href: "/teams#dashboard" },
      { label: "Try the demo company", href: "/login?business=1" },
      { label: "Pricing", href: "/teams#pricing" },
    ],
  },
] as const;

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close on navigation.
  useEffect(() => setOpen(false), [pathname]);

  // Lock scroll, handle Escape, move focus in and back out.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab" && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>("a,button");
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => panelRef.current?.querySelector<HTMLElement>("a")?.focus(), 250);
    const btn = btnRef.current;
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
      btn?.focus();
    };
  }, [open]);

  // Global utility bar: black, blurred once content scrolls under it, 1px keyline.
  const bar = open ? "bg-black" : scrolled ? "bg-black/80 glass shadow-[0_1px_0_#282828]" : "bg-black/0";

  return (
    <>
      <header className={`theme-dark fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${bar}`}>
        <nav className="mx-auto flex h-12 max-w-[1100px] items-center justify-between px-4 sm:px-6" aria-label="Main">
          <Link
            href="/"
            className="flex items-center gap-2 text-white/80 transition-colors hover:text-white"
            aria-label="Silent Consensus home"
          >
            <HushMascot size={22} color="#cccccc" />
            <span className="text-micro font-normal">Silent Consensus</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/login"
              className={`${pillClass("blue", "sm")} ${open ? "pointer-events-none opacity-0" : ""}`}
            >
              Log in / Sign up
            </Link>
            <button
              ref={btnRef}
              type="button"
              aria-expanded={open}
              aria-controls="site-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((o) => !o)}
              className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-[#cccccc] transition-colors hover:text-white"
            >
              <motion.span
                className="absolute h-[1.5px] w-[17px] rounded-full bg-current"
                animate={open ? { rotate: 45, y: 0 } : { rotate: 0, y: -3.5 }}
                transition={{ duration: 0.35, ease: EASE }}
              />
              <motion.span
                className="absolute h-[1.5px] w-[17px] rounded-full bg-current"
                animate={open ? { rotate: -45, y: 0 } : { rotate: 0, y: 3.5 }}
                transition={{ duration: 0.35, ease: EASE }}
              />
            </button>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="site-menu"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            className="theme-dark fixed inset-0 z-40 overflow-y-auto bg-black/[.94] glass"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="mx-auto flex min-h-full max-w-[1100px] flex-col px-5 pb-10 pt-20 sm:px-6"
              initial="hide"
              animate="show"
              exit="hide"
              variants={{ show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } }, hide: {} }}
            >
              <MenuItem>
                <Link
                  href="/"
                  aria-current={pathname === "/" ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className="group inline-flex items-center gap-3 text-headline text-porcelain sm:text-display-md"
                >
                  Overview
                  <ArrowRight
                    size={30}
                    className="-translate-x-2 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                  />
                </Link>
              </MenuItem>

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {SECTIONS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <MenuItem key={s.key}>
                      <div className="relative h-full overflow-hidden rounded-tile bg-graphite p-6 shadow-[inset_0_0_0_1px_var(--c-keyline)] sm:p-8">
                        <p className="flex items-center gap-2 text-micro font-semibold uppercase tracking-[0.12em] text-ash">
                          <Icon size={15} /> {s.eyebrow}
                        </p>
                        <Link
                          href={s.href}
                          aria-current={pathname === s.href ? "page" : undefined}
                          onClick={() => setOpen(false)}
                          className="group mt-3 flex items-center gap-2 text-title-lg text-porcelain sm:text-headline"
                        >
                          {s.title}
                          <ArrowRight
                            size={28}
                            className="transition-transform duration-300 group-hover:translate-x-1.5"
                          />
                        </Link>
                        <p className="mt-2 max-w-[360px] text-lead text-ash">{s.blurb}</p>
                        <ul className="mt-6 flex flex-col border-t border-keyline">
                          {s.links.map((l) => (
                            <li key={l.href} className="border-b border-keyline">
                              <Link
                                href={l.href}
                                onClick={() => setOpen(false)}
                                className="flex min-h-12 items-center justify-between py-3 text-lead font-medium text-porcelain transition-colors hover:text-link"
                              >
                                {l.label}
                                <ArrowRight size={18} />
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </MenuItem>
                  );
                })}
              </div>

              <MenuItem className="mt-auto pt-10">
                <div className="flex flex-col gap-3 text-body-sm text-ash sm:flex-row sm:items-center sm:justify-between">
                  <span>Works in your browser today. Coming soon to Android.</span>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center gap-1.5 text-link hover:underline"
                  >
                    Log in / Sign up <ArrowRight size={16} />
                  </Link>
                </div>
              </MenuItem>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function MenuItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hide: { opacity: 0, y: 24, filter: "blur(6px)" },
        show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: EASE } },
      }}
    >
      {children}
    </motion.div>
  );
}
