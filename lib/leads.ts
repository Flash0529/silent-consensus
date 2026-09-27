import { z } from "zod";
import { TEAM_SIZES } from "./teamSizes";

const email = z.string().trim().toLowerCase().max(254).pipe(z.email());

export const LeadBody = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("WAITLIST"),
    email,
    source: z.string().trim().max(40).default("site"),
    // Honeypot: real visitors never see or fill this field.
    website: z.string().max(200).optional(),
  }),
  z.object({
    kind: z.literal("PILOT"),
    email,
    name: z.string().trim().min(1).max(80),
    company: z.string().trim().min(1).max(120),
    teamSize: z.enum(TEAM_SIZES),
    source: z.string().trim().max(40).default("teams"),
    website: z.string().max(200).optional(),
  }),
]);

export type LeadInput = z.infer<typeof LeadBody>;

/** Shape the Prisma upsert data; the honeypot never reaches the database. */
export function leadData(input: LeadInput) {
  const { website: _honeypot, ...rest } = input;
  return rest;
}
