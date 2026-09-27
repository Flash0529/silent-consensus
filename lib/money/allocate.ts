// Quiet chip-in math. Pure, integer cents, no rounding drift.
//
//   d_i = max(0, s_i − c_i)               shortfall (0 when no cap)
//   D   = Σ d_i                           total need
//   h_j = c_j null ? ∞ : max(0, c_j − s_j) headroom
//   helpers: h_j > 0 and d_j = 0
//   suggest_j = min(h_j, $10, ceil5(D / |helpers|))
//   contributions are accepted in order, each clamped to min(amount, h_j, D − pool);
//   the clamped excess is refunded (never charged)
//   cover_i = P · d_i / D, largest remainder, so Σ cover = P exactly
//   final_i = s_i − cover_i + chipIn_i

export const MAX_SUGGEST_CENTS = 1000;

export type AllocMember = { id: string; baseCents: number; capCents: number | null };
export type Contribution = { memberId: string; amountCents: number };

export type AllocLine = {
  id: string;
  baseCents: number;
  capCents: number | null;
  shortfallCents: number;
  headroomCents: number | null; // null = unlimited
  isHelper: boolean;
  suggestCents: number;
  coveredCents: number;
  chipInCents: number;
  refundCents: number;
  finalCents: number;
};

export type Allocation = {
  lines: AllocLine[];
  needCents: number;
  poolCents: number;
  cardOpen: boolean;
  helperCount: number;
};

const ceilTo = (n: number, step: number) => Math.ceil(n / step) * step;

export function shortfall(m: AllocMember) {
  return m.capCents === null ? 0 : Math.max(0, m.baseCents - m.capCents);
}

export function headroom(m: AllocMember): number | null {
  return m.capCents === null ? null : Math.max(0, m.capCents - m.baseCents);
}

/** Sum of what helpers could give, each capped at the $10 suggestion ceiling. */
export function helperCapacity(members: AllocMember[]) {
  return members
    .filter((m) => shortfall(m) === 0)
    .reduce((sum, m) => {
      const h = headroom(m);
      return sum + (h === null ? MAX_SUGGEST_CENTS : Math.min(h, MAX_SUGGEST_CENTS));
    }, 0);
}

export function allocate(members: AllocMember[], contributions: Contribution[] = []): Allocation {
  const need = members.reduce((s, m) => s + shortfall(m), 0);
  const helpers = members.filter((m) => shortfall(m) === 0 && (headroom(m) === null || headroom(m)! > 0));
  const perHelper = helpers.length && need > 0 ? ceilTo(need / helpers.length, 500) : 0;

  // Accept contributions in order, clamped to headroom and the remaining need.
  const accepted = new Map<string, number>();
  const refunded = new Map<string, number>();
  let pool = 0;
  for (const c of contributions) {
    const m = members.find((x) => x.id === c.memberId);
    const amount = Math.max(0, Math.round(c.amountCents));
    if (!m || shortfall(m) > 0) {
      if (m) refunded.set(m.id, (refunded.get(m.id) ?? 0) + amount);
      continue;
    }
    const h = headroom(m);
    const already = accepted.get(m.id) ?? 0;
    const room = Math.min(h === null ? Infinity : h - already, need - pool);
    const take = Math.max(0, Math.min(amount, room));
    accepted.set(m.id, already + take);
    refunded.set(m.id, (refunded.get(m.id) ?? 0) + (amount - take));
    pool += take;
  }

  // Proportional cover with largest-remainder rounding.
  const shorts = members.map((m) => shortfall(m));
  const raw = shorts.map((d) => (need > 0 ? (pool * d) / need : 0));
  const cover = raw.map((r) => Math.floor(r));
  let left = pool - cover.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .filter(({ i }) => shorts[i] > 0)
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    if (cover[i] < shorts[i]) {
      cover[i]++;
      left--;
    }
  }

  const lines: AllocLine[] = members.map((m, i) => {
    const h = headroom(m);
    const isHelper = helpers.includes(m);
    const chipIn = accepted.get(m.id) ?? 0;
    return {
      id: m.id,
      baseCents: m.baseCents,
      capCents: m.capCents,
      shortfallCents: shorts[i],
      headroomCents: h,
      isHelper,
      suggestCents: isHelper ? Math.min(h ?? Infinity, MAX_SUGGEST_CENTS, perHelper) : 0,
      coveredCents: cover[i],
      chipInCents: chipIn,
      refundCents: refunded.get(m.id) ?? 0,
      finalCents: m.baseCents - cover[i] + chipIn,
    };
  });

  return { lines, needCents: need, poolCents: pool, cardOpen: pool < need, helperCount: helpers.length };
}
