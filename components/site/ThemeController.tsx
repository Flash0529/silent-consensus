"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export type SiteTheme = "dark" | "carbon" | "light";

/**
 * Whichever `[data-theme-section]` crosses the middle of the viewport sets `data-theme` on the
 * `.site` root. The theme colours are registered CSS properties with transitions, so the entire
 * page (not just one section) animates from black to charcoal to white and back as you scroll.
 */
export function ThemeController() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".site");
    if (!root) return;
    const sections = [...document.querySelectorAll<HTMLElement>("[data-theme-section]")];
    const apply = (el: HTMLElement) => {
      const t = (el.dataset.themeSection as SiteTheme) || "dark";
      if (root.dataset.theme !== t) root.dataset.theme = t;
    };
    // A thin band across the middle of the viewport.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) apply(e.target as HTMLElement);
      },
      { rootMargin: "-49% 0px -49% 0px", threshold: 0 },
    );
    sections.forEach((s) => io.observe(s));
    // Initial state (e.g. reload halfway down the page).
    const mid = window.innerHeight / 2;
    const current = sections.find((s) => {
      const r = s.getBoundingClientRect();
      return r.top <= mid && r.bottom >= mid;
    });
    root.dataset.theme = (current?.dataset.themeSection as SiteTheme) || "dark";
    return () => io.disconnect();
  }, [pathname]);

  return null;
}
