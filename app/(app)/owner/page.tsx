"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/client";
import { DesktopShell } from "@/components/DesktopShell";

// Owner only: the Android waitlist and Teams pilot requests from the landing pages.
type Lead = { id: string; kind: string; email: string; name: string | null; company: string | null; teamSize: string | null; source: string; createdAt: string };

export default function OwnerPage() {
  const { data, error } = useSWR<{ leads: Lead[] }>("/api/owner/leads", fetcher);
  const leads = data?.leads ?? [];
  return (
    <DesktopShell>
      <main className="flex min-h-dvh flex-col px-5 pb-16 pt-6 lg:mx-auto lg:max-w-4xl lg:pt-10">
        <h1 className="text-title">Sign-ups</h1>
        {error && <p className="mt-4 text-muted">Only the app owner can see this page.</p>}
        {data && (
          <>
            <p className="mt-1 text-secondary text-muted">
              {leads.filter((l) => l.kind === "WAITLIST").length} on the Android waitlist · {leads.filter((l) => l.kind === "PILOT").length} Teams pilot requests
            </p>
            <a href="/api/owner/leads?format=csv" className="mt-3 inline-flex h-10 w-fit items-center rounded-full bg-galaxy px-4 text-secondary font-semibold text-white">
              Download CSV
            </a>
            <div className="mt-5 overflow-x-auto rounded-2xl bg-bubble">
              <table className="w-full text-left text-secondary">
                <thead className="text-caption uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Name / company</th>
                    <th className="px-4 py-3">From</th>
                    <th className="px-4 py-3">When</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id} className="border-t border-divider">
                      <td className="px-4 py-2.5">{l.kind === "WAITLIST" ? "Android waitlist" : `Pilot (${l.teamSize ?? "?"})`}</td>
                      <td className="px-4 py-2.5">{l.email}</td>
                      <td className="px-4 py-2.5">{[l.name, l.company].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="px-4 py-2.5 text-muted">{l.source}</td>
                      <td className="px-4 py-2.5 text-muted">{new Date(l.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                  {!leads.length && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted">No sign-ups yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </DesktopShell>
  );
}
