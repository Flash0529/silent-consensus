import type { Metadata } from "next";
import { EarlyAccess } from "@/components/site/EarlyAccess";
import { Hero } from "@/components/site/home/Hero";
import { HowItWorks } from "@/components/site/home/HowItWorks";
import { Privacy, Problem, Roadmap, Stats, TwoPaths } from "@/components/site/home/Sections";

export const metadata: Metadata = {
  title: "Silent Consensus · Plans everyone can say yes to",
  description:
    "Hush checks in with each friend privately, then proposes one plan the whole group can actually do. Nobody has to explain why.",
};

export default function Home() {
  return (
    <>
      <Hero />
      <Problem />
      <Stats />
      <HowItWorks />
      <Privacy />
      <TwoPaths />
      <Roadmap />
      <EarlyAccess />
    </>
  );
}
