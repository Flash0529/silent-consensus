import { SUPPORT_EMAIL } from "@/lib/twilio/consent";

/** Support email link used in the Privacy Policy and Terms. */
export function LegalMail() {
  return (
    <a href={`mailto:${SUPPORT_EMAIL}`} className="text-link underline">
      {SUPPORT_EMAIL}
    </a>
  );
}
