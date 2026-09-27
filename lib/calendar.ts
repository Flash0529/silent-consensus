import { createHmac, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import ICAL from "ical.js";
import { db } from "@/lib/db";
import { decryptPhone as decrypt, encryptPhone as encrypt } from "@/lib/phone";
import { SITE_URL } from "@/lib/twilio/consent";

// Calendars people link so Hush can find times that work for the whole group.
// - Apple (iCloud public calendar link), Google (secret iCal address) and Outlook (published ICS link)
//   all work as a calendar link; Google can also be connected by signing in (needs GOOGLE_CLIENT_ID /
//   GOOGLE_CLIENT_SECRET).
// - Only free/busy is ever used. Event titles, places and notes are never stored or shown; the busy
//   times live in memory for a few minutes and are never sent to anyone else.
// - The link / token is encrypted at rest (same AES-GCM key as phone numbers).

export type Busy = { start: number; end: number };

// ---------- Calendar links (ICS) ----------

// Only fetch from the big calendar hosts (the server must never be pointed at arbitrary URLs).
const ICS_HOSTS = [/^p\d+-caldav\.icloud\.com$/, /^(www\.)?icloud\.com$/, /^calendar\.google\.com$/, /^outlook\.(office365|live|office)\.com$/];

export function normalizeIcsUrl(raw: string): string | null {
  let s = raw.trim();
  if (s.startsWith("webcal://")) s = `https://${s.slice(9)}`;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.port || u.username || u.password) return null;
  if (!ICS_HOSTS.some((h) => h.test(u.hostname))) return null;
  return u.toString();
}

const PRIVATE_IP = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|::1$|f[cd][0-9a-f]{2}:|fe80:)/i;

async function safeFetchText(url: string, redirects = 3): Promise<string> {
  const u = new URL(url);
  if (!ICS_HOSTS.some((h) => h.test(u.hostname)) || u.protocol !== "https:") throw new Error("That calendar host isn't supported.");
  const addrs = await lookup(u.hostname, { all: true });
  if (addrs.some((a) => PRIVATE_IP.test(a.address))) throw new Error("That calendar host isn't supported.");
  const r = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(8_000), headers: { "User-Agent": "SilentConsensus/1.0" } });
  if (r.status >= 300 && r.status < 400 && r.headers.get("location") && redirects > 0)
    return safeFetchText(new URL(r.headers.get("location")!, url).toString(), redirects - 1);
  if (!r.ok) throw new Error(`The calendar link returned ${r.status}. Check that the calendar is shared publicly.`);
  const len = Number(r.headers.get("content-length") ?? 0);
  if (len > 8_000_000) throw new Error("That calendar is too big.");
  const text = await r.text();
  if (text.length > 8_000_000) throw new Error("That calendar is too big.");
  if (!text.includes("BEGIN:VCALENDAR")) throw new Error("That link isn't a calendar (it should end in .ics or start with webcal://).");
  return text;
}

/** Busy times from an ICS file between from and to. All-day and "free" (transparent) events don't count. */
export function parseIcsBusy(text: string, from: Date, to: Date): Busy[] {
  const root = new ICAL.Component(ICAL.parse(text));
  for (const tz of root.getAllSubcomponents("vtimezone")) {
    try {
      ICAL.TimezoneService.register(tz);
    } catch {
      /* unknown zone: times are read as floating */
    }
  }
  const byUid = new Map<string, { base?: InstanceType<typeof ICAL.Component>; exceptions: InstanceType<typeof ICAL.Component>[] }>();
  for (const ve of root.getAllSubcomponents("vevent")) {
    const uid = String(ve.getFirstPropertyValue("uid") ?? Math.random());
    const g = byUid.get(uid) ?? { exceptions: [] };
    if (ve.hasProperty("recurrence-id")) g.exceptions.push(ve);
    else g.base = ve;
    byUid.set(uid, g);
  }
  const out: Busy[] = [];
  const f = +from;
  const t = +to;
  const add = (ve: InstanceType<typeof ICAL.Component> | null, s: InstanceType<typeof ICAL.Time>, e: InstanceType<typeof ICAL.Time>) => {
    if (s.isDate) return; // all-day
    if (ve && String(ve.getFirstPropertyValue("transp") ?? "").toUpperCase() === "TRANSPARENT") return;
    if (ve && String(ve.getFirstPropertyValue("status") ?? "").toUpperCase() === "CANCELLED") return;
    const a = +s.toJSDate();
    const b = +e.toJSDate();
    if (b > f && a < t) out.push({ start: Math.max(a, f), end: Math.min(b, t) });
  };
  for (const { base, exceptions } of byUid.values()) {
    const comp = base ?? exceptions[0];
    if (!comp) continue;
    const ev = new ICAL.Event(comp);
    if (base) for (const x of exceptions) ev.relateException(x);
    if (!ev.startDate) continue;
    if (!base || !ev.isRecurring()) {
      add(comp, ev.startDate, ev.endDate ?? ev.startDate);
      continue;
    }
    const it = ev.iterator();
    for (let i = 0; i < 6000; i++) {
      const next = it.next();
      if (!next) break;
      if (+next.toJSDate() > t) break;
      const d = ev.getOccurrenceDetails(next);
      add(d.item.component, d.startDate, d.endDate);
    }
  }
  return out;
}

// ---------- Google (sign in, free/busy only) ----------

export const googleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.freebusy";
const redirectUri = () => `${SITE_URL}/api/calendar/google/callback`;
const sign = (v: string) => createHmac("sha256", process.env.COOKIE_SECRET ?? "").update(`gcal:${v}`).digest("base64url");

export function googleAuthUrl(accountId: string) {
  const body = `${accountId}.${Date.now() + 10 * 60_000}`;
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: `${body}.${sign(body)}`,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export function checkGoogleState(state: string | null): string | null {
  const [id, exp, mac] = (state ?? "").split(".");
  if (!id || !exp || !mac) return null;
  const want = sign(`${id}.${exp}`);
  if (mac.length !== want.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(want)) || Number(exp) < Date.now()) return null;
  return id;
}

export async function googleExchange(code: string) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const j = (await r.json().catch(() => ({}))) as { refresh_token?: string; error?: string };
  if (!r.ok || !j.refresh_token) throw new Error(j.error ?? "Google didn't send a refresh token");
  return j.refresh_token;
}

async function googleBusy(refreshToken: string, from: Date, to: Date): Promise<Busy[]> {
  const tr = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const tok = (await tr.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!tok.access_token) throw new Error(tok.error === "invalid_grant" ? "Google access was removed. Connect it again." : "Couldn't reach Google Calendar.");
  const r = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{ id: "primary" }] }),
    signal: AbortSignal.timeout(10_000),
  });
  const j = (await r.json().catch(() => ({}))) as { calendars?: { primary?: { busy?: { start: string; end: string }[] } } };
  if (!r.ok) throw new Error("Couldn't read Google Calendar.");
  return (j.calendars?.primary?.busy ?? []).map((b) => ({ start: +new Date(b.start), end: +new Date(b.end) }));
}

// ---------- Linking ----------

export async function addIcsLink(accountId: string, rawUrl: string, label?: string) {
  const url = normalizeIcsUrl(rawUrl);
  if (!url) throw new Error("Paste an Apple (iCloud), Google or Outlook calendar link. It starts with webcal:// or https://.");
  const from = new Date();
  const text = await safeFetchText(url);
  parseIcsBusy(text, from, new Date(+from + 7 * 864e5)); // throws if it isn't a real calendar
  const host = new URL(url).hostname;
  const guess = host.includes("icloud") ? "Apple Calendar" : host.includes("google") ? "Google Calendar" : "Outlook Calendar";
  return db.calendarLink.create({
    data: { accountId, provider: "ics", label: (label?.trim() || guess).slice(0, 40), secretEnc: encrypt(url), lastOkAt: new Date() },
    select: { id: true, provider: true, label: true, lastOkAt: true, lastError: true, createdAt: true },
  });
}

export async function addGoogleLink(accountId: string, refreshToken: string) {
  await db.calendarLink.deleteMany({ where: { accountId, provider: "google" } });
  return db.calendarLink.create({ data: { accountId, provider: "google", label: "Google Calendar", secretEnc: encrypt(refreshToken), lastOkAt: new Date() } });
}

// ---------- Reading busy times ----------

const cache = new Map<string, { at: number; from: number; to: number; busy: Busy[] }>();
const CACHE_MS = 10 * 60_000;

/** Everyone's-calendar busy times for one account (all linked calendars merged). null = none linked. */
export async function busyFor(accountId: string, from: Date, to: Date): Promise<Busy[] | null> {
  const links = await db.calendarLink.findMany({ where: { accountId } });
  if (!links.length) return null;
  const all: Busy[] = [];
  let anyOk = false;
  for (const l of links) {
    const c = cache.get(l.id);
    if (c && Date.now() - c.at < CACHE_MS && c.from <= +from && c.to >= +to) {
      all.push(...c.busy);
      anyOk = true;
      continue;
    }
    try {
      const secret = decrypt(l.secretEnc);
      const busy = l.provider === "google" ? await googleBusy(secret, from, to) : parseIcsBusy(await safeFetchText(secret), from, to);
      cache.set(l.id, { at: Date.now(), from: +from, to: +to, busy });
      all.push(...busy);
      anyOk = true;
      await db.calendarLink.update({ where: { id: l.id }, data: { lastOkAt: new Date(), lastError: null } });
    } catch (e) {
      await db.calendarLink.update({ where: { id: l.id }, data: { lastError: (e instanceof Error ? e.message : "Couldn't read it").slice(0, 200) } }).catch(() => {});
    }
  }
  return anyOk ? all : null;
}

// ---------- Time zones (no library: Intl does the work) ----------

function offsetMs(t: number, tz: string) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(t));
  const g = (k: string) => Number(p.find((x) => x.type === k)?.value);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - t;
}

/** The instant when the wall clock in `tz` reads y-m-d hh:mm. */
export function zoned(y: number, m: number, d: number, hh: number, mm: number, tz: string) {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let t = guess - offsetMs(guess, tz);
  const o2 = offsetMs(t, tz);
  if (guess - o2 !== t) t = guess - o2;
  return new Date(t);
}

export function ymdIn(t: Date, tz: string) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
  const [y, m, d] = p.split("-").map(Number);
  return { y, m, d };
}

export function slotLabel(t: Date, tz: string) {
  const day = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(t);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(t).replace(":00", "");
  return `${day} · ${time}`;
}

// ---------- Finding times that work for everyone ----------

export type Slot = { start: string; label: string };

/** The group's time zone: the most common one among its members (default Eastern). */
export async function groupZone(circleId: string) {
  const rows = await db.member.findMany({ where: { circleId }, select: { account: { select: { timeZone: true } } } });
  const counts = new Map<string, number>();
  for (const r of rows) if (r.account?.timeZone) counts.set(r.account.timeZone, (counts.get(r.account.timeZone) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "America/New_York";
}

/**
 * Times in the next `days` days when EVERYONE who linked a calendar is free.
 * Returns how many people's calendars were checked; nothing about who is busy when.
 */
export async function freeSlots(circleId: string, opts: { days?: number; work?: boolean; max?: number } = {}) {
  const tz = await groupZone(circleId);
  const members = await db.member.findMany({ where: { circleId, accountId: { not: null } }, select: { accountId: true } });
  const now = new Date();
  const to = new Date(+now + (opts.days ?? 7) * 864e5);
  const busyLists = (await Promise.all(members.map((m) => busyFor(m.accountId!, now, to)))).filter((b): b is Busy[] => !!b);
  const checked = busyLists.length;
  if (!checked) return { tz, checked: 0, total: members.length, slots: [] as Slot[] };

  const work = !!opts.work;
  const dur = (work ? 60 : 120) * 60_000;
  const [startH, endH] = work ? [9, 17] : [11, 22];
  const scored: { t: Date; score: number; day: string }[] = [];
  for (let i = 0; i <= (opts.days ?? 7); i++) {
    const { y, m, d } = ymdIn(new Date(+now + i * 864e5), tz);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (work && (dow === 0 || dow === 6)) continue;
    for (let h = startH; h * 60 + dur / 60_000 <= endH * 60; h += 0.5) {
      const t = zoned(y, m, d, Math.floor(h), h % 1 ? 30 : 0, tz);
      if (+t < +now + 60 * 60_000) continue;
      const end = +t + dur;
      if (busyLists.some((list) => list.some((b) => b.start < end && b.end > +t))) continue;
      const weekend = dow === 0 || dow === 6;
      const score = work
        ? (h >= 10 && h <= 11 ? 3 : h >= 14 && h <= 15 ? 2 : 1) - i * 0.1
        : (h >= 18 && h <= 19.5 ? 3 : weekend && h >= 12 && h <= 15 ? 2.5 : h >= 17 ? 1.5 : 1) - i * 0.05;
      scored.push({ t, score, day: `${y}-${m}-${d}` });
    }
  }
  // Best slot per day, best days first.
  const perDay = new Map<string, { t: Date; score: number }>();
  for (const s of scored) if (!perDay.has(s.day) || perDay.get(s.day)!.score < s.score) perDay.set(s.day, s);
  const slots = [...perDay.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.max ?? 6)
    .sort((a, b) => +a.t - +b.t)
    .map((s) => ({ start: s.t.toISOString(), label: slotLabel(s.t, tz) }));
  return { tz, checked, total: members.length, slots };
}

/** One person's own free windows (for their private chat with Hush). */
export async function myFreeSummary(accountId: string, tz: string, days = 5) {
  const now = new Date();
  const busy = await busyFor(accountId, now, new Date(+now + days * 864e5));
  if (!busy) return null;
  const lines: string[] = [];
  for (let i = 0; i < days; i++) {
    const { y, m, d } = ymdIn(new Date(+now + i * 864e5), tz);
    const free: string[] = [];
    for (const [label, a, b] of [
      ["morning", 9, 12],
      ["afternoon", 12, 17],
      ["evening", 17, 22],
    ] as const) {
      const s = +zoned(y, m, d, a, 0, tz);
      const e = +zoned(y, m, d, b, 0, tz);
      if (e < +now) continue;
      const taken = busy.filter((x) => x.start < e && x.end > s).reduce((n, x) => n + (Math.min(x.end, e) - Math.max(x.start, s)), 0);
      if (taken < (e - s) * 0.5) free.push(label);
    }
    const day = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(zoned(y, m, d, 12, 0, tz));
    lines.push(`${day}: ${free.length ? `mostly free ${free.join(", ")}` : "mostly busy"}`);
  }
  return lines.join("\n");
}
