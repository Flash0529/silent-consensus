import { dateLabel } from "@/lib/dates";

// THE ONLY serializer for group-facing routes. Explicit allowlist: nothing from
// Vault, Message, MemberShare, ChipIn or persona may ever be added here.

type CircleIn = {
  slug: string;
  kind?: string;
  title: string;
  activity: string;
  area: string;
  windowStart: Date;
  status: string;
  planningStage: string;
  organizerId: string | null;
  members: {
    id: string;
    name: string;
    avatarColor: string;
    role: string;
    interviewStatus: string;
  }[];
  plans?: {
    id: string;
    version: number;
    title: string;
    dateLabel: string;
    stops: unknown;
    perPersonCents: number;
    whyItWorks: string[];
    leakCheckPassed: boolean;
    status: string;
    votes?: { memberId: string; choice: string }[];
  }[];
};

export type GroupStop = { time: string; name: string; note: string; demoVenue: boolean };

export type GroupSafeCircle = ReturnType<typeof toGroupSafe>;

function safeStops(stops: unknown): GroupStop[] {
  if (!Array.isArray(stops)) return [];
  return stops.map((s) => {
    const o = (s ?? {}) as Record<string, unknown>;
    return {
      time: String(o.time ?? ""),
      name: String(o.name ?? ""),
      note: String(o.note ?? ""),
      demoVenue: o.verified !== true,
    };
  });
}

export function toGroupSafe(circle: CircleIn) {
  const current = [...(circle.plans ?? [])]
    .filter((p) => p.status !== "SUPERSEDED")
    .sort((a, b) => b.version - a.version)[0];
  const votes = current?.votes ?? [];
  const voteCounts = { in: 0, differentTime: 0, tweak: 0 };
  for (const v of votes) {
    if (v.choice === "IN") voteCounts.in++;
    else if (v.choice === "DIFFERENT_TIME") voteCounts.differentTime++;
    else if (v.choice === "TWEAK") voteCounts.tweak++;
  }
  const voted = new Set(votes.map((v) => v.memberId));

  return {
    slug: circle.slug,
    kind: (circle.kind ?? "PLAN") as "PLAN" | "MEDIATE",
    title: circle.title,
    activity: circle.activity,
    area: circle.area,
    dateLabel: dateLabel(circle.windowStart, circle.area),
    status: circle.status,
    planningStage: circle.planningStage,
    members: circle.members.map((m) => ({
      id: m.id,
      name: m.name,
      avatarColor: m.avatarColor,
      isOrganizer: m.id === circle.organizerId,
      interviewStatus: m.interviewStatus,
      hasVoted: voted.has(m.id),
    })),
    plan: current
      ? {
          id: current.id,
          version: current.version,
          title: current.title,
          dateLabel: current.dateLabel,
          stops: safeStops(current.stops),
          perPersonCents: current.perPersonCents,
          whyItWorks: current.whyItWorks,
          leakCheckPassed: current.leakCheckPassed,
          status: current.status,
          voteCounts,
        }
      : null,
  };
}

/** Prisma include for everything toGroupSafe needs (and nothing private). */
export const groupInclude = {
  members: {
    orderBy: { createdAt: "asc" as const },
    select: { id: true, name: true, avatarColor: true, role: true, interviewStatus: true },
  },
  plans: {
    orderBy: { version: "desc" as const },
    take: 1,
    select: {
      id: true,
      version: true,
      title: true,
      dateLabel: true,
      stops: true,
      perPersonCents: true,
      whyItWorks: true,
      leakCheckPassed: true,
      status: true,
      votes: { select: { memberId: true, choice: true } },
    },
  },
};
