"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

// Old per-group Hush page: everything lives in the one Hush chat now.
export default function OldHushDm({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  useEffect(() => router.replace(`/hush?c=${slug}`), [router, slug]);
  return <main className="min-h-dvh" />;
}
