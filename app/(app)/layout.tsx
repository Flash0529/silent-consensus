import { AppFrame } from "@/components/AppFrame";
// The web app is a phone-width column; the marketing site in (site) is full width.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-app bg-surface">
      <AppFrame>{children}</AppFrame>
    </div>
  );
}
