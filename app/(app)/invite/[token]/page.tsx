"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { api, fetcher } from "@/lib/client";
import { useAccount } from "@/lib/useAccount";
import { HushMascot } from "@/components/HushMascot";
import { BrandLogo } from "@/components/BrandLogo";
import { PrimaryPill } from "@/components/PrimaryPill";

// A friend's invite link: set up an account (or log in) and you're connected with them.
export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const { data: acct } = useAccount();
  const { data, error } = useSWR<{ from: { name: string; photo: string | null }; used: boolean }>(`/api/invites/${token}`, fetcher);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const accept = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ slug: string }>(`/api/invites/${token}`, { method: "POST" });
      router.replace(`/c/${r.slug}/group`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't accept this invite.");
      setBusy(false);
    }
  };
  // Logged in already (e.g. just signed up with this link): connect right away.
  useEffect(() => {
    if (acct?.account && data && !data.used && !busy && !err) accept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acct?.account, data]);

  const next = encodeURIComponent(`/invite/${token}`);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center px-7 pb-10 pt-10 text-center">
      <BrandLogo size={26} href="/" />
      <div className="flex grow flex-col items-center justify-center gap-4">
        {data?.from.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.from.photo} alt="" className="h-24 w-24 rounded-full object-cover" />
        ) : (
          <HushMascot size={96} animated />
        )}
        {error ? (
          <>
            <h1 className="text-title">This invite link doesn&apos;t work</h1>
            <p className="text-body text-muted">Ask your friend to send a new one.</p>
          </>
        ) : !data ? (
          <p className="text-muted">Loading…</p>
        ) : (
          <>
            <h1 className="text-title">{data.from.name} invited you to Silent Consensus</h1>
            <p className="max-w-[320px] text-body text-muted">
              Group chats that actually make plans. Set up your account and you&apos;ll be connected with {data.from.name} right away.
            </p>
          </>
        )}
        {err && <p className="text-secondary text-danger">{err}</p>}
      </div>
      {data && !acct?.account && (
        <div className="flex w-full flex-col items-center gap-2">
          <PrimaryPill href={`/login?mode=signup&next=${next}`}>Create your account</PrimaryPill>
          <Link href={`/login?next=${next}`} className="py-2 text-body font-medium">
            I already have an account
          </Link>
        </div>
      )}
      {data && acct?.account && busy && <p className="text-muted">Connecting you with {data.from.name}…</p>}
    </main>
  );
}
