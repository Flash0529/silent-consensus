// Only Hush gets the verified check. People's names and chat titles can't contain check marks (or
// look-alikes), and can't be "Hush" / the app's name, so nobody can pass themselves off as Hush.

const CHECKS = /[✓✔☑✅√☐☒\u{1F5F8}\u{1F5F9}\u{1F5F3}\u{2714}️\u{1F7E2}\u{1F535}\u{2611}]/gu;
const RESERVED = /^(hush|hush ai|silent consensus|quiet consensus|silentconsensus)$/i;

/** Remove check marks and tidy spacing. */
export function cleanName(raw: string) {
  return raw.replace(CHECKS, "").replace(/\s+/g, " ").trim();
}

/** Clean a person's display name; returns an error message if it can't be used. */
export function personName(raw: string): { name: string; error?: undefined } | { name?: undefined; error: string } {
  const name = cleanName(raw);
  if (!name) return { error: "Enter your name (check marks aren't allowed)." };
  if (RESERVED.test(name.replace(/[^a-z ]/gi, "").trim())) return { error: "That name is reserved. Pick another one." };
  return { name };
}

import { z } from "zod";

/** Zod field for a person's name (check marks removed; "Hush" etc. reserved). */
export const zPersonName = (max = 30) =>
  z
    .string()
    .trim()
    .max(max)
    .transform(cleanName)
    .refine((v) => v.length > 0, "Enter a name (check marks aren't allowed).")
    .refine((v) => !RESERVED.test(v.replace(/[^a-z ]/gi, "").trim()), "That name is reserved. Pick another one.");

/** Zod field for a chat / company title (check marks removed). */
export const zTitle = (max = 60) =>
  z
    .string()
    .trim()
    .max(max)
    .transform(cleanName)
    .refine((v) => v.length > 0, "Enter a name (check marks aren't allowed).");
