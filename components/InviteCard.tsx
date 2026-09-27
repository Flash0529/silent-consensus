"use client";

import { useEffect, useState } from "react";
import { CopyIcon, ShareIcon } from "./Icons";

export function InviteCard({ slug, title }: { slug: string; title: string }) {
  const [link, setLink] = useState(`/j/${slug}`);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setLink(`${window.location.origin}/j/${slug}`);
  }, [slug]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; the link is visible to copy by hand */
    }
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `Join "${title}" on Quiet Consensus`, url: link });
      } catch {
        /* dismissed */
      }
    } else copy();
  };

  return (
    <div className="flex flex-col items-center gap-4 rounded-card bg-bubble p-5">
      <p className="self-start text-question">Invite your friends</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/circles/${slug}/qr`}
        alt={`QR code to join ${title}`}
        width={220}
        height={220}
        className="rounded-list border border-hairline bg-white p-3"
      />
      <p className="w-full break-all rounded-list border border-hairline bg-surface px-4 py-3 text-secondary text-ink-2">
        {link}
      </p>
      <div className="grid w-full grid-cols-2 gap-3">
        <button type="button" onClick={copy} className="flex h-row items-center justify-center gap-2 rounded-btn bg-hairline text-body font-medium">
          <CopyIcon size={18} />
          {copied ? "Copied" : "Copy link"}
        </button>
        <button type="button" onClick={share} className="flex h-row items-center justify-center gap-2 rounded-btn bg-ink text-body font-medium text-on-ink">
          <ShareIcon size={18} />
          Share
        </button>
      </div>
      <p className="text-caption text-muted">Code: <span className="font-semibold tracking-wider text-ink-2">{slug}</span></p>
    </div>
  );
}
