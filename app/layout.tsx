import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { ThemeProvider, themeBootScript } from "@/lib/theme";
import { StaleReload } from "@/components/StaleReload";
import "./globals.css";

// Inter substitutes for Galaxy Sans (the home page's style reference, docs/HANDOFF.md §5).
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Silent Consensus",
  description: "Plans everyone can say yes to.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

// The marketing site (app/(site)) and legal pages (app/(legal)) are full width; the web app
// (app/(app)) is a 430px phone column (its own layout).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-theme (the app's Light/Dark setting) is set before hydration by themeBootScript.
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="font-sans">
        <Script id="theme-boot" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <StaleReload />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
