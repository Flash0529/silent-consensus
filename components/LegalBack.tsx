"use client";

import { useRouter } from "next/navigation";

// Back from a policy page: to wherever you came from (Settings, sign-up, the texting page…), not
// always the landing page. Opened directly from a link elsewhere: back to the app (or the site).
export function LegalBack() {
  const router = useRouter();
  const back = () => {
    // Anywhere you came from in this tab (Settings, sign-up, the texting page…): go back there.
    if (window.history.length > 1) router.back();
    else router.push("/start");
  };
  return (
    <button type="button" onClick={back} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-secondary font-semibold text-link hover:bg-bubble">
      <span aria-hidden>←</span> Back
    </button>
  );
}
