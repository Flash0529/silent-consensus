import type { Metadata } from "next";
import Link from "next/link";
import { SmsOptInForm } from "@/components/SmsOptInForm";
import { LegalMail } from "@/components/LegalMail";

export const metadata: Metadata = { title: "Get texts from Hush" };

// Public SMS opt-in page (linked from the A2P 10DLC registration). Anyone can opt in here without a plan;
// the same consent step also appears in each plan's "Text with Hush" card.
export default function SmsOptInPage() {
  return (
    <>
      <h1>Get texts from Hush</h1>
      <p className="updated">Silent Consensus · SB Venture Solutions</p>

      <p>
        Hush is the planning assistant in Silent Consensus. If you opt in, Hush texts you about your group plans: a
        one-time code to verify your number, private check-ins about what works for you, and plan updates in group texts
        you&apos;re part of. Hush only joins a group text when everyone in it has opted in.
      </p>
      <ul className="mt-4">
        <li>Message frequency varies with your group&apos;s plans.</li>
        <li>Msg &amp; data rates may apply.</li>
        <li>
          <strong>Reply HELP</strong> for help, or email <LegalMail />.
        </li>
        <li>
          <strong>Reply STOP</strong> to opt out at any time.
        </li>
        <li>Consent is not a condition of any purchase.</li>
      </ul>

      <div className="mt-8">
        <SmsOptInForm />
      </div>

      <p className="mt-6 text-sm">
        Read our{" "}
        <Link href="/terms" className="text-link underline">
          Terms &amp; Conditions
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-link underline">
          Privacy Policy
        </Link>
        . We do not sell or share your SMS opt-in data with third parties for marketing.
      </p>
    </>
  );
}
