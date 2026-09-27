"use client";

import "./globals.css";
import { ErrorScreen } from "@/components/ErrorScreen";

// Errors in the root layout itself (it replaces the whole page, so it brings its own html/body).
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <ErrorScreen error={error} />
      </body>
    </html>
  );
}
