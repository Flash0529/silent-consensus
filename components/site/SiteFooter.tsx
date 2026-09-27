import Link from "next/link";
import { HushMascot } from "@/components/HushMascot";

const COLS = [
  {
    title: "Explore",
    links: [
      { label: "Overview", href: "/" },
      { label: "For Friends", href: "/friends" },
      { label: "For Teams", href: "/teams" },
    ],
  },
  {
    title: "Friends",
    links: [
      { label: "Make Hush yours", href: "/friends#studio" },
      { label: "Plan and mediation", href: "/friends#modes" },
      { label: "Quiet chip-in", href: "/friends#chip-in" },
    ],
  },
  {
    title: "Teams",
    links: [
      { label: "Use cases", href: "/teams#use-cases" },
      { label: "Admin view", href: "/teams#dashboard" },
      { label: "Pricing", href: "/teams#pricing" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer data-theme-section="dark" className="text-micro text-ash">
      <div className="mx-auto max-w-[1100px] px-5 py-14 sm:px-6">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-[320px]">
            <div className="flex items-center gap-2.5 text-porcelain">
              <HushMascot size={24} />
              <span className="text-body-sm font-semibold">Silent Consensus</span>
            </div>
            <p className="mt-3 leading-relaxed">
              Plans everyone can say yes to. Built at HackGT 13 for the Social Good track and Meta&apos;s
              &ldquo;Bringing People Closer Together with AI&rdquo; challenge.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-8 sm:gap-16">
            {COLS.map((c) => (
              <div key={c.title}>
                <p className="font-semibold text-porcelain">{c.title}</p>
                <ul className="mt-3 flex flex-col gap-2.5">
                  {c.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="transition-colors hover:text-porcelain hover:underline">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-keyline pt-6 sm:flex-row sm:justify-between">
          <span>MIT licensed. Payments shown on this site are demos. No real money moves.</span>
          <span>Hush never shares whose limit was whose.</span>
        </div>
      </div>
    </footer>
  );
}
