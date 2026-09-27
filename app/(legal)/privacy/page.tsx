import type { Metadata } from "next";
import { LegalMail } from "@/components/LegalMail";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="updated">Last updated September 27, 2026</p>

      <p>
        Silent Consensus (the &quot;App&quot;) is operated by SB Venture Solutions (&quot;we&quot;, &quot;us&quot;). This
        Privacy Policy explains what information we collect when you use the App on the web or by text message, how
        we use it, and the choices you have.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Phone number.</strong> If you choose to get texts from Hush, we use your mobile number to send you a
          one-time verification code and, once you opt in, texts about your group plans.
        </li>
        <li>
          <strong>Profile.</strong> The name you choose and the name you give your bot.
        </li>
        <li>
          <strong>Contacts you choose to add.</strong> If you add friends by phone number or by QR code, we store those
          names and phone numbers to show which of your contacts use the App and to let you message them.
        </li>
        <li>
          <strong>Messages.</strong> Messages you send in chats, and what you tell your private bot, so the App can
          deliver them and plan with your group.
        </li>
        <li>
          <strong>Technical data.</strong> Basic logs (such as IP address and device type) needed to run and secure the
          service, and the time and IP address of your SMS opt-in, kept as a record of your consent.
        </li>
      </ul>

      <h2>How we use information</h2>
      <ul>
        <li>To create and secure your account, including sending SMS verification codes.</li>
        <li>To connect you with contacts and deliver your messages.</li>
        <li>
          To run private check-ins: what you tell your bot is used to find a plan the group can agree on. Other members
          never see what you said; only the resulting plan is shared.
        </li>
        <li>To prevent abuse, fix problems and improve the App.</li>
      </ul>

      <h2>SMS</h2>
      <p>
        We text you only after you opt in on silentconsensus.world by entering your own number, checking the consent
        box and verifying the number. We then send texts about your group plans: a one-time verification code, private
        check-ins from Hush, and plan updates in group texts you are part of. Hush joins a group text only when
        everyone in it has opted in. Message frequency varies with your group&apos;s plans. Message and data rates may
        apply. Reply STOP to opt out or HELP for help.
      </p>
      <p className="mt-4">
        <strong>
          We do not sell or share your SMS opt-in data or personal information with third parties for marketing
          purposes.
        </strong>{" "}
        Mobile opt-in data and consent are never shared with third parties or affiliates for marketing.
      </p>

      <h2>Service providers</h2>
      <p>
        We use trusted providers to run the App, including Twilio (sending verification codes and text messages), our
        hosting and database providers, and AI model providers that process bot conversations to produce plans. They
        may only use your information to provide their service to us.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        We keep your information while your account is active. You can remove contacts, and you can ask us to delete
        your account and its data at any time by emailing <LegalMail />.
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit. Phone numbers are stored only in hashed and encrypted form, and sign-in codes and
        session tokens are stored only as secure hashes. No method of storage is perfectly secure, but we work to
        protect your information.
      </p>

      <h2>Children</h2>
      <p>The App is not intended for children under 13, and we do not knowingly collect their information.</p>

      <h2>Changes</h2>
      <p>We may update this policy. We will change the date above and, for material changes, let you know in the App.</p>

      <h2>Contact</h2>
      <p>
        SB Venture Solutions, operator of Silent Consensus: <LegalMail />
      </p>
    </>
  );
}
