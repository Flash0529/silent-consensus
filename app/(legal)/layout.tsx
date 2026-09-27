import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/twilio/consent";
import { BrandLogo } from "@/components/BrandLogo";
import { LegalBack } from "@/components/LegalBack";

// Privacy Policy and Terms (linked from the SMS consent box and the Twilio A2P registration).
// Phones: one column. Computers: a side menu for the policies and a wider reading column.
// Back returns you to where you came from.
const LINKS = [
  ["/privacy", "Privacy Policy"],
  ["/terms", "Terms & Conditions"],
  ["/sms", "Get texts from Hush"],
] as const;

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface text-ink">
      <header className="sticky top-0 z-10 border-b border-divider bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 lg:px-8">
          <LegalBack />
          <span className="grow" />
          <BrandLogo size={24} href="/" />
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl gap-12 px-5 pb-16 pt-8 lg:px-8 lg:pt-12">
        <nav aria-label="Policies" className="sticky top-24 hidden h-fit w-56 shrink-0 flex-col gap-1 lg:flex">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className="rounded-xl px-3 py-2 text-secondary font-medium text-muted hover:bg-bubble hover:text-ink">
              {label}
            </Link>
          ))}
          <Link href="/start" className="mt-3 rounded-xl px-3 py-2 text-secondary font-semibold text-link hover:bg-bubble">
            Open Silent Consensus →
          </Link>
        </nav>
        <main className="min-w-0 max-w-3xl grow">
          <article className="legal">{children}</article>
        </main>
      </div>
      <footer className="border-t border-divider">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-x-7 gap-y-3 px-5 py-8 text-secondary lg:px-8">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className="text-muted hover:text-ink">
              {label}
            </Link>
          ))}
          <Link href="/start" className="font-semibold text-link hover:underline">
            Open Silent Consensus
          </Link>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-muted hover:text-ink sm:ml-auto">
            {SUPPORT_EMAIL}
          </a>
        </div>
      </footer>
    </div>
  );
}
