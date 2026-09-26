"use client";

import { use } from "react";
import { FloatingHeader } from "@/components/ScrollFade";
import { FloatingIconButton } from "@/components/FloatingIconButton";
import { BotPill } from "@/components/BotPill";
import { BackIcon, GroupIcon } from "@/components/Icons";
import { HushBubble } from "@/components/HushBubble";
import { withAs } from "@/lib/client";

// M1 placeholder; the interview lands in M2.
export default function ChatPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return (
    <main className="relative flex h-dvh flex-col">
      <FloatingHeader>
        <FloatingIconButton label="Home" href="/">
          <BackIcon />
        </FloatingIconButton>
        <BotPill />
        <div className="grow" />
        <FloatingIconButton label="Group status" href={withAs(`/c/${slug}`)}>
          <GroupIcon />
        </FloatingIconButton>
      </FloatingHeader>
      <div className="flex grow flex-col justify-end gap-3 px-[18px] pb-8 pt-24">
        <HushBubble>This chat is just between us. I'll be ready in a moment.</HushBubble>
      </div>
    </main>
  );
}
