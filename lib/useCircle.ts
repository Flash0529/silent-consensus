"use client";

import useSWR from "swr";
import { fetcher, withAs } from "@/lib/client";
import type { GroupSafeCircle } from "@/lib/serialize";

export type Me = {
  member: null | { id: string; name: string; avatarColor: string; isOrganizer: boolean; interviewStatus: string };
};

const poll = { refreshInterval: 2000, revalidateOnFocus: false, dedupingInterval: 1000 };

export function useCircle(slug: string) {
  return useSWR<GroupSafeCircle>(`/api/circles/${slug}`, fetcher, poll);
}

export function useMe(slug: string) {
  return useSWR<Me>(`/api/me?c=${slug}`, fetcher, { ...poll, refreshInterval: 5000 });
}

export { withAs };
