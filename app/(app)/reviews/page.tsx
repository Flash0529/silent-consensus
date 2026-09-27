"use client";

import { useState } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/lib/client";
import { DesktopShell } from "@/components/DesktopShell";
import { Avatar } from "@/components/AvatarStack";

// Manager / HR reviews (business, when the company turns manager review on). Each review holds only
// the messages someone sent as written after Hush flagged them, and why. Never private Hush chats.
type Review = {
  id: string;
  route: string;
  severity: string;
  status: string;
  note: string | null;
  createdAt: string;
  reviewedAt: string | null;
  person: { name: string; email: string; photo: string | null };
  messages: { text: string; issue: string | null; severity: string; chat: string; at: string }[];
};

export default function ReviewsPage() {
  const { data, mutate } = useSWR<{ reviews: Review[] }>("/api/reviews", fetcher, { refreshInterval: 15_000 });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const close = async (id: string, status: "REVIEWED" | "DISMISSED" | "OPEN") => {
    await api(`/api/reviews/${id}`, { method: "POST", body: JSON.stringify({ status, note: notes[id] }) }).catch(() => {});
    mutate();
  };
  const list = data?.reviews ?? [];
  return (
    <DesktopShell>
      <main className="flex min-h-dvh flex-col px-5 pb-16 pt-6 lg:mx-auto lg:max-w-3xl lg:pt-10">
        <h1 className="text-title">Reviews</h1>
        <p className="mt-1 text-secondary text-muted">
          When your company has manager review on, someone who sends messages as written after Hush flagged them (3 times in a week) shows up here for
          their manager, or HR for serious content. They were warned first. You see only those messages and why Hush flagged them.
        </p>
        {data && !list.length && <p className="mt-8 text-center text-secondary text-muted">Nothing to review.</p>}
        <div className="mt-6 flex flex-col gap-4">
          {list.map((r) => (
            <section key={r.id} className={`rounded-2xl bg-bubble p-4 ${r.status !== "OPEN" ? "opacity-70" : ""}`}>
              <div className="flex items-center gap-3">
                <Avatar m={{ id: r.id, name: r.person.name, avatarColor: "blue", photo: r.person.photo }} size={40} />
                <div className="min-w-0 grow">
                  <p className="text-body font-semibold">{r.person.name}</p>
                  <p className="truncate text-caption text-muted">
                    {r.person.email} · {new Date(r.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase ${r.severity === "serious" ? "bg-danger/20 text-danger" : "bg-hush/20 text-hush"}`}>
                  {r.route === "HR" ? "HR" : "Manager"} · {r.severity}
                </span>
              </div>
              <ul className="mt-3 flex flex-col gap-2">
                {r.messages.map((m, i) => (
                  <li key={i} className="rounded-xl bg-surface p-3">
                    <p className="text-caption text-muted">
                      In {m.chat} · {new Date(m.at).toLocaleString()}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-body">“{m.text}”</p>
                    {m.issue && <p className="mt-1 text-caption text-ink-2">Hush flagged: {m.issue}</p>}
                  </li>
                ))}
              </ul>
              {r.status === "OPEN" ? (
                <>
                  <textarea
                    value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                    rows={2}
                    placeholder="Private note (optional)"
                    className="mt-3 w-full rounded-xl bg-surface p-3 text-secondary text-ink outline-none focus:outline-1 focus:outline-galaxy"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => close(r.id, "REVIEWED")} className="h-10 rounded-full bg-galaxy px-4 text-secondary font-semibold text-white">
                      Mark reviewed
                    </button>
                    <button type="button" onClick={() => close(r.id, "DISMISSED")} className="h-10 rounded-full bg-surface px-4 text-secondary font-semibold">
                      Dismiss (Hush was wrong)
                    </button>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-caption text-muted">
                  {r.status === "REVIEWED" ? "Reviewed" : "Dismissed"}
                  {r.reviewedAt ? ` ${new Date(r.reviewedAt).toLocaleDateString()}` : ""}
                  {r.note ? ` · Note: ${r.note}` : ""}
                  {" · "}
                  <button type="button" onClick={() => close(r.id, "OPEN")} className="underline">
                    Reopen
                  </button>
                </p>
              )}
            </section>
          ))}
        </div>
      </main>
    </DesktopShell>
  );
}
