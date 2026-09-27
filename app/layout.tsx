import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import { ThemeProvider, themeBootScript } from "@/lib/theme";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-geist",
});

export const metadata: Metadata = {
  title: "Quiet Consensus",
  description: "Plans everyone can say yes to.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#111113" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme is set before hydration by themeBootScript.
    <html lang="en" className={geist.variable} suppressHydrationWarning>
      <body className="font-sans">
        <Script id="theme-boot" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <ThemeProvider>
          <div className="relative mx-auto min-h-dvh w-full max-w-app bg-surface">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}
