"use client";

import { useEffect } from "react";

// Shown if a page crashes. A page that failed because the app was just updated (old files) reloads
// itself once, automatically. Anything else is reported to the server log, with a Reload button.
const STALE = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

export function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset?: () => void }) {
  useEffect(() => {
    const msg = `${error?.name ?? ""} ${error?.message ?? ""}`;
    let reloadedRecently = false;
    try {
      reloadedRecently = Date.now() - Number(sessionStorage.getItem("qc-auto-reload") ?? 0) < 30_000;
    } catch {}
    if (STALE.test(msg) && !reloadedRecently) {
      try {
        sessionStorage.setItem("qc-auto-reload", String(Date.now()));
      } catch {}
      window.location.reload();
      return;
    }
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg.slice(0, 500), digest: error?.digest, path: window.location.pathname, stack: error?.stack?.slice(0, 2000) }),
    }).catch(() => {});
  }, [error]);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-surface px-8 text-center text-ink">
      <p className="text-[20px] font-semibold">Something went wrong on this page</p>
      <p className="max-w-[320px] text-secondary text-muted">It&apos;s been reported. Reloading usually fixes it.</p>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={() => window.location.reload()} className="h-10 rounded-full bg-galaxy px-5 text-secondary font-semibold text-white">
          Reload
        </button>
        {reset && (
          <button type="button" onClick={() => reset()} className="h-10 rounded-full bg-bubble px-5 text-secondary font-semibold">
            Try again
          </button>
        )}
        <a href="/start" className="flex h-10 items-center rounded-full bg-bubble px-5 text-secondary font-semibold">
          Your chats
        </a>
      </div>
    </div>
  );
}

/** Also catch old-file failures that happen outside React (e.g. loading a page's code on navigation). */
export function installStaleReload() {
  if (typeof window === "undefined") return;
  const handler = (e: ErrorEvent | PromiseRejectionEvent) => {
    const r = (e as PromiseRejectionEvent).reason ?? (e as ErrorEvent).error ?? (e as ErrorEvent).message;
    const msg = typeof r === "string" ? r : `${r?.name ?? ""} ${r?.message ?? ""}`;
    if (!STALE.test(msg)) return;
    try {
      if (Date.now() - Number(sessionStorage.getItem("qc-auto-reload") ?? 0) < 30_000) return;
      sessionStorage.setItem("qc-auto-reload", String(Date.now()));
    } catch {}
    window.location.reload();
  };
  window.addEventListener("error", handler);
  window.addEventListener("unhandledrejection", handler);
}
