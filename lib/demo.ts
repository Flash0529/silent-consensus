import personas from "@/data/personas.json";
import { db } from "@/lib/db";
import { newDeviceToken } from "@/lib/identity";
import { newSlug } from "@/lib/slug";
import { avatarFor } from "@/lib/avatars";
import { etDate, nextWeekday } from "@/lib/dates";

export type SavedPrefs = {
  budgetCapCents: number | null;
  dietary: string[];
  alcohol: string | null;
  stepFreeRequired: boolean | null;
  noise: string | null;
  vibe: string[];
};
export type Persona = {
  key: string;
  name: string;
  organizer?: boolean;
  facts: string[];
  style: string;
  script?: Record<string, string>;
  returning?: SavedPrefs; // demo: preferences this persona saved on a previous plan
};
export type Story = "hangout" | "mediation";

export function personaFor(story: Story, key: string): Persona | undefined {
  return (personas[story].members as Persona[]).find((p) => p.key === key);
}

/** Create a fresh demo circle for a story. Members get unusable device tokens (driven via ?as=). */
export async function seedStory(story: Story) {
  const cfg = personas[story];
  const members = cfg.members as Persona[];
  let start: Date;
  let end: Date;
  if (story === "hangout") {
    const c = personas.hangout.circle;
    const { y, m, d } = nextWeekday(c.weekday, new Date(Date.now() + 86400000));
    start = etDate(y, m, d, c.start);
    end = etDate(y, m, d, c.end);
  } else {
    const t = new Date(Date.now() + personas.mediation.circle.days * 86400000);
    const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" })
      .format(t)
      .split("-")
      .map(Number);
    start = etDate(y, m, d, 19);
    end = etDate(y, m, d, 21);
  }
  const circle = await db.circle.create({
    data: {
      slug: newSlug(),
      kind: story === "hangout" ? "PLAN" : "MEDIATE",
      title: cfg.circle.title,
      topic: story === "mediation" ? personas.mediation.circle.topic : null,
      activity: story === "hangout" ? personas.hangout.circle.activity : "conversation",
      area: story === "hangout" ? personas.hangout.circle.area : "",
      windowStart: start,
      windowEnd: end,
      isDemo: true,
    },
  });
  const created = [];
  for (const [i, p] of members.entries()) {
    // Returning personas get a saved profile (no cookie: presenter iframes drive them).
    const profile = p.returning
      ? await db.profile.create({ data: { name: p.name, tokenHash: newDeviceToken().tokenHash, ...p.returning } })
      : null;
    const m = await db.member.create({
      data: {
        profileId: profile?.id ?? null,
        circleId: circle.id,
        name: p.name,
        avatarColor: story === "hangout" ? avatarFor(i) : avatarFor(["omar", "maya", "priya", "jordan"].indexOf(p.key)),
        tokenHash: newDeviceToken().tokenHash,
        role: p.organizer ? "ORGANIZER" : "MEMBER",
        persona: `${story}:${p.key}`,
        createdAt: new Date(Date.now() + i),
      },
    });
    created.push(m);
    if (p.organizer) await db.circle.update({ where: { id: circle.id }, data: { organizerId: m.id } });
  }
  return { slug: circle.slug, circleId: circle.id, members: created.map((m) => ({ id: m.id, name: m.name, persona: m.persona })) };
}
