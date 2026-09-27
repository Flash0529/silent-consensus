import type { Metadata } from "next";
import {
  Benefits,
  Capabilities,
  Dashboard,
  PilotForm,
  Policy,
  Pricing,
  TeamsHero,
  UseCases,
  WorkFilter,
} from "@/components/site/teams/TeamsSections";
import { LocalNav } from "@/components/site/LocalNav";

export const metadata: Metadata = {
  title: "Hush for Teams · Silent Consensus",
  description:
    "Work chats where Hush tracks meetings and action items, checks tone before sending, and schedules privately with everyone. Admins see participation, never answers.",
};

export default function TeamsPage() {
  return (
    <>
      <LocalNav
        name="Hush for Teams"
        links={[
          { id: "capabilities", label: "Live today" },
          { id: "use-cases", label: "Use cases" },
          { id: "dashboard", label: "Admin view" },
          { id: "filter", label: "Filter" },
          { id: "pricing", label: "Pricing" },
        ]}
        cta={{ label: "Request a pilot", href: "#pilot" }}
      />
      <TeamsHero />
      <Capabilities />
      <UseCases />
      <Benefits />
      <Dashboard />
      <WorkFilter />
      <Policy />
      <Pricing />
      <PilotForm />
    </>
  );
}
