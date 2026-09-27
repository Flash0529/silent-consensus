import type { Metadata } from "next";
import { EarlyAccess } from "@/components/site/EarlyAccess";
import { ChipIn, FriendsHero, Modes, Promises } from "@/components/site/friends/FriendsSections";
import { Studio } from "@/components/site/friends/Studio";
import { LocalNav } from "@/components/site/LocalNav";

export const metadata: Metadata = {
  title: "Hush for Friends · Silent Consensus",
  description:
    "Plans your whole group can say yes to. Set your diet, favorite cuisines, budget and your planner's personality once.",
};

export default function FriendsPage() {
  return (
    <>
      <LocalNav
        name="Hush for Friends"
        links={[
          { id: "modes", label: "Modes" },
          { id: "chip-in", label: "Chip-in" },
          { id: "studio", label: "Make it yours" },
        ]}
        cta={{ label: "Log in / Sign up", href: "/start" }}
      />
      <FriendsHero />
      <Modes />
      <ChipIn />
      <Studio />
      <Promises />
      <EarlyAccess
        title="Bring everyone back."
        sub="Hush for Friends is free. Be first to try the Android app."
        source="friends"
      />
    </>
  );
}
