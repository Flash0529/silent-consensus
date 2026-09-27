import type { Metadata } from "next";
import Link from "next/link";
import { LegalMail } from "@/components/LegalMail";

export const metadata: Metadata = { title: "Terms & Conditions" };

export default function TermsPage() {
  return (
    <>
      <h1>Terms &amp; Conditions</h1>
      <p className="updated">Last updated September 27, 2026</p>

      <p>
        These Terms &amp; Conditions govern your use of Silent Consensus (the &quot;App&quot;), operated by SB Venture
        Solutions (&quot;we&quot;, &quot;us&quot;). By creating an account or using the App, you agree to these terms.
      </p>

      <h2>Your account</h2>
      <p>
        If you link a mobile phone number, it must be one you own, and you verify it with a code we text you. Keep your
        phone secure; you are responsible for activity on your account. You must be at least 13 years old.
      </p>

      <h2>Using the App</h2>
      <ul>
        <li>Only add and message people you know, and only upload contacts you are allowed to share.</li>
        <li>Don&apos;t use the App to harass, spam, threaten or harm anyone, or for anything illegal.</li>
        <li>
          Plans and suggestions from the bot are informational. Check details (times, prices, access) before you rely on
          them.
        </li>
      </ul>

      <h2>SMS Terms</h2>
      <ul>
        <li>
          <strong>Program:</strong> SB Venture Solutions (Silent Consensus) sends texts from Hush, its group-planning
          assistant, to people who opt in: a one-time verification code, private check-ins about group plans, and plan
          updates in group texts.
        </li>
        <li>
          <strong>Consent:</strong> You opt in on silentconsensus.world by entering your own mobile number, checking the
          consent box, tapping &quot;Agree &amp; send code&quot; and entering the code we text you. Consent is not a
          condition of any purchase. Hush only texts numbers that completed this opt-in, and only joins a group text
          when everyone in it has opted in.
        </li>
        <li>
          <strong>Frequency:</strong> Message frequency varies with your group&apos;s plans.
        </li>
        <li>
          <strong>Message and data rates may apply.</strong>
        </li>
        <li>
          <strong>Opt out:</strong> <strong>Reply STOP</strong> to any message to stop receiving texts. You will get one
          confirmation message and no further texts. Reply START to opt back in.
        </li>
        <li>
          <strong>Help:</strong> <strong>Reply HELP</strong> for help, or email <LegalMail />.
        </li>
        <li>Carriers are not liable for delayed or undelivered messages.</li>
        <li>
          See our{" "}
          <Link href="/privacy" className="text-link underline">
            Privacy Policy
          </Link>{" "}
          for how we handle your information. We do not sell or share your SMS opt-in data with third parties for
          marketing.
        </li>
      </ul>

      <h2>Your content</h2>
      <p>
        You keep ownership of what you send. You give us permission to store, process and deliver it only to run the
        App, including private bot check-ins as described in the Privacy Policy.
      </p>

      <h2>Ending your use</h2>
      <p>
        You can stop using the App and ask us to delete your account at any time. We may suspend accounts that break
        these terms.
      </p>

      <h2>Disclaimers</h2>
      <p>
        The App is provided &quot;as is&quot; without warranties of any kind. To the extent allowed by law, SB Venture
        Solutions is not liable for indirect or consequential damages arising from your use of the App.
      </p>

      <h2>Changes</h2>
      <p>We may update these terms. We will change the date above, and continued use means you accept the updated terms.</p>

      <h2>Contact</h2>
      <p>
        SB Venture Solutions, operator of Silent Consensus: <LegalMail />
      </p>
    </>
  );
}
