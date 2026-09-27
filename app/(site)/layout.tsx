import { MotionRoot } from "@/components/site/MotionRoot";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ThemeController } from "@/components/site/ThemeController";
import { Intro } from "@/components/site/Intro";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <MotionRoot>
      <div className="site min-h-dvh overflow-x-clip" data-theme="dark">
        <ThemeController />
        <Intro />
        <a
          href="#main"
          className="fixed left-4 top-2 z-[60] -translate-y-20 rounded-full bg-galaxy px-4 py-2 text-body-sm text-white transition-transform focus:translate-y-0"
        >
          Skip to content
        </a>
        <SiteNav />
        <main id="main">{children}</main>
        <SiteFooter />
      </div>
    </MotionRoot>
  );
}
