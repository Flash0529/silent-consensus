"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { pillClass } from "./ui";

/**
 * Sticky, contained product-section bar (Galaxy "Product Section Navigation"): product name,
 * in-page section links with the current one lit, and one compact blue pill.
 */
export function LocalNav({
  name,
  links,
  cta,
}: {
  name: string;
  links: { id: string; label: string }[];
  cta: { label: string; href: string };
}) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const els = links.map((l) => document.getElementById(l.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.25, 0.5] },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [links]);

  return (
    <div className="pointer-events-none sticky top-[56px] z-40 -mb-[60px] px-3 sm:px-6">
      <nav
        aria-label={`${name} sections`}
        className="pointer-events-auto mx-auto flex h-[52px] max-w-[1100px] items-center gap-4 rounded-nav bg-graphite/80 pl-5 pr-2 shadow-[inset_0_0_0_1px_var(--c-keyline)] glass"
      >
        <span className="shrink-0 text-product text-porcelain">{name}</span>
        <ul className="no-scrollbar flex min-w-0 flex-1 items-center justify-end gap-5 overflow-x-auto">
          {links.map((l) => (
            <li key={l.id} className="shrink-0">
              <a
                href={`#${l.id}`}
                aria-current={active === l.id ? "true" : undefined}
                className={`text-body-sm font-medium transition-colors sm:text-[15px] ${
                  active === l.id ? "text-porcelain" : "text-ash hover:text-porcelain"
                }`}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <Link href={cta.href} className={`${pillClass("blue", "sm")} hidden shrink-0 sm:inline-flex`}>
          {cta.label}
        </Link>
      </nav>
    </div>
  );
}
