"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/client";

export type ChatSummary = {
  slug: string;
  title: string;
  kind: string;
  status: string;
  members: number;
  faces: { name: string; avatarColor: string }[];
  isDirect?: boolean;
  photo?: string | null;
  organizer: boolean;
  myChatDone: boolean;
  isAdmin?: boolean;
  // Hush is waiting on you in your private chat about this group (the title of the plan it's about).
  hushWaiting?: string | null;
  canDeleteForEveryone?: boolean;
  unread: number;
  last: { body: string; kind: string; from: string | null; at: string } | null;
  activeAt: string;
};
export type AccountRes = {
  account: { name: string; email: string; photo?: string | null; timeZone?: string | null; quiet?: boolean; reviews?: number; org?: { name: string; role: string } | null } | null;
  plans: ChatSummary[];
};

export function useAccount(opts: { poll?: boolean } = {}) {
  return useSWR<AccountRes>("/api/auth/me", fetcher, {
    refreshInterval: opts.poll ? 4000 : 0,
    revalidateOnFocus: true,
  });
}

/** Only same-site paths are allowed as a post-login destination. */
export const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/start");
