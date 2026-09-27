"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetcher } from "@/lib/client";
import { relTime } from "@/components/ChatList";

type Result = { slug: string; title: string; messageId: string; snippet: string; from: string; at: string };

/** Message results for a search (the chat list filters chat names itself). */
export function MessageResults({ q }: { q: string }) {
  const [results, setResults] = useState<Result[] | null>(null);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return setResults(null);
    const t = setTimeout(() => {
      fetcher<{ results: Result[] }>(`/api/search?q=${encodeURIComponent(term)}`)
        .then((r) => setResults(r.results))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  if (!results) return null;
  return (
    <li className="mt-2">
      <p className="px-3 pb-1 text-caption font-semibold uppercase tracking-wide text-muted">Messages</p>
      {!results.length && <p className="px-3 py-2 text-secondary text-muted">No messages match.</p>}
      <ul>
        {results.map((r) => (
          <li key={r.messageId}>
            <Link href={`/c/${r.slug}/group#m-${r.messageId}`} className="block rounded-2xl px-3 py-2.5 hover:bg-bubble">
              <span className="flex items-baseline gap-2">
                <span className="truncate text-secondary font-semibold">{r.title}</span>
                <span className="ml-auto shrink-0 text-caption text-muted">{relTime(r.at)}</span>
              </span>
              <span className="line-clamp-2 text-caption text-ink-2">
                <span className="font-semibold">{r.from}: </span>
                {highlight(r.snippet, q.trim())}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </li>
  );
}

function highlight(text: string, q: string) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-galaxy/25 px-0.5 text-ink">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}
