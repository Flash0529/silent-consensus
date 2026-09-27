import type { z } from "zod";
import type { PerspectiveUpdates, PlanConstraintUpdates } from "@/lib/ai/schemas";

// Pure merge helpers: arrays are unioned (case-insensitive), explicit null clears,
// undefined keeps the current value.

type PlanUpdates = z.infer<typeof PlanConstraintUpdates>;
type PerspUpdates = z.infer<typeof PerspectiveUpdates>;

export type VaultShape = {
  budgetCapCents: number | null;
  dietary: string[];
  alcohol: string | null;
  stepFreeRequired: boolean | null;
  availableWindows: unknown;
  noise: string | null;
  vibe: string[];
  maxTravelMinutes: number | null;
  privateNote: string | null;
};

export type PerspectiveShape = {
  story: string | null;
  feelings: string[];
  needs: string[];
  hopes: string[];
  offers: string[];
  offLimits: string[];
  gist: string | null;
};

export function union(a: string[], b: string[] | undefined) {
  if (!b?.length) return a;
  const seen = new Set(a.map((x) => x.toLowerCase().trim()));
  const out = [...a];
  for (const x of b) {
    const k = x.toLowerCase().trim();
    if (k && !seen.has(k) && !/^(none|anything|no restrictions?)$/.test(k)) {
      seen.add(k);
      out.push(x.trim());
    }
  }
  return out;
}

const pick = <T,>(next: T | undefined, cur: T) => (next === undefined ? cur : next);

export function mergeVault(cur: VaultShape, u: PlanUpdates): VaultShape {
  return {
    budgetCapCents: pick(u.budgetCapCents, cur.budgetCapCents),
    dietary: union(cur.dietary, u.dietary?.map((d) => d.toLowerCase().replace(/[\s-]+/g, "_"))),
    alcohol: pick(u.alcohol, cur.alcohol),
    stepFreeRequired: pick(u.stepFreeRequired, cur.stepFreeRequired),
    availableWindows: u.availableWindows?.length ? u.availableWindows : cur.availableWindows,
    noise: pick(u.noise, cur.noise),
    vibe: union(cur.vibe, u.vibe),
    maxTravelMinutes: pick(u.maxTravelMinutes, cur.maxTravelMinutes),
    privateNote:
      u.privateNote === undefined || u.privateNote === null || (cur.privateNote ?? "").includes(u.privateNote.trim())
        ? cur.privateNote
        : [cur.privateNote, u.privateNote.trim()].filter(Boolean).join(" ").slice(0, 400),
  };
}

export function mergePerspective(cur: PerspectiveShape, u: PerspUpdates): PerspectiveShape {
  return {
    story:
      u.story === undefined || u.story === null ? cur.story : [cur.story, u.story].filter(Boolean).join(" ").slice(0, 1200),
    feelings: union(cur.feelings, u.feelings),
    needs: union(cur.needs, u.needs),
    hopes: union(cur.hopes, u.hopes),
    offers: union(cur.offers, u.offers),
    offLimits: union(cur.offLimits, u.offLimits),
    gist: pick(u.gist, cur.gist),
  };
}
