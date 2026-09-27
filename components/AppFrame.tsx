"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { DesktopShell } from "@/components/DesktopShell";
import { HushMascot } from "@/components/HushMascot";

// Every page in the app works on phones AND computers:
// - Pages that already use DesktopShell (chats, settings, people, admin, Hush…) lay themselves out.
// - Sign-in style pages (login, forgot password, welcome, invites, joining, the demo) get a split
//   screen on computers: the brand on the left, the page on the right.
// - The older plan pages get the desktop shell (rail + chat list) around them.
const AUTH = /^\/(login|forgot|welcome|new)(\/|$)|^\/(invite|j)\//;
const LEGACY = /^\/c\/[^/]+(\/(chat|share))?$/;

export function AppFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "";
  if (AUTH.test(path))
    return (
      <div className="lg:fixed lg:inset-0 lg:z-20 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)] lg:bg-surface xl:grid-cols-[minmax(0,1fr)_560px]">
        <aside className="relative hidden overflow-hidden border-r border-divider bg-surface-2 p-12 lg:flex lg:flex-col">
          <BrandLogo size={30} href="/" />
          <div className="my-auto max-w-[520px]">
            <HushMascot size={96} animated />
            <h2 className="mt-6 text-[44px] font-bold leading-[1.05] tracking-[-0.02em]">Group chats that actually make plans.</h2>
            <ul className="mt-6 flex flex-col gap-2.5 text-body text-ink-2">
              <li>✓ Hush checks with everyone privately, then brings back one plan</li>
              <li>✓ Real places and events, booking links, and a quiet chip-in</li>
              <li>✓ Nobody sees anyone&apos;s private answers, ever</li>
            </ul>
          </div>
          <p className="flex gap-5 text-caption text-muted">
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
            <Link href="/teams" className="hover:text-ink">For teams</Link>
          </p>
        </aside>
        <div className="relative lg:overflow-y-auto">{children}</div>
      </div>
    );
  if (LEGACY.test(path)) return <DesktopShell active={path.split("/")[2]}>{children}</DesktopShell>;
  return <>{children}</>;
}
