"use client";

// Client fetch helpers. In demo presenter iframes, ?as=<memberId> is forwarded
// as x-demo-as; the server only honors it when DEMO_MODE=true on demo circles.

function demoAs(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("as");
}

export function withAs(path: string) {
  const as = demoAs();
  if (!as) return path;
  return `${path}${path.includes("?") ? "&" : "?"}as=${encodeURIComponent(as)}`;
}

export async function api<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const as = demoAs();
  if (as) headers.set("x-demo-as", as);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const res = await fetch(url, { ...init, headers, cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Something went wrong");
  return data as T;
}

export const fetcher = <T,>(url: string) => api<T>(url);

export const money = (cents: number) =>
  cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
