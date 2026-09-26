const TZ = "America/New_York";

export function dateLabel(start: Date, area: string) {
  const d = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(start);
  return `${d} · ${area}`;
}

export function timeLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(date);
}

export function weekdayName(date: Date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long" }).format(date);
}

/** Wall-clock time in ET → Date. Handles EDT/EST by probing the offset. */
export function etDate(y: number, m: number, d: number, hh: number, mm = 0) {
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const asET = new Date(guess.toLocaleString("en-US", { timeZone: TZ }));
  const asUTC = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess.getTime() + (asUTC.getTime() - asET.getTime()));
}

/** Next occurrence (today counts) of weekday 0-6 in ET, as {y,m,d}. */
export function nextWeekday(weekday: number, from = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(from)
    .split("-")
    .map(Number);
  const today = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const delta = (weekday - today.getUTCDay() + 7) % 7;
  const t = new Date(today.getTime() + delta * 86400000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}
