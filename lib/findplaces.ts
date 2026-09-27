import { lookup } from "node:dns/promises";
import { z } from "zod";
import { db } from "@/lib/db";
import { callLLM, LLMUnavailableError } from "@/lib/ai/client";
import { cuisineFor, nominatimPlaces, restaurantsNear, type Place } from "@/lib/places";
import { groupZone, slotLabel } from "@/lib/calendar";
import { anonymousMd } from "@/lib/personmd";

// Finding real things to do for a plan, near the middle of where everyone's coming from:
//   food      restaurants, bars, cafés      Google Places (or OpenStreetMap without a key)
//   activity  bowling, museums, hikes, …    Google Places
//   event     concerts, games, shows, …     Ticketmaster
// Hush turns the plan + what the group said into a search, pulls candidates (with ratings, reviews
// and a peek at each website), then has the model pick the best few for this group. What anyone told
// Hush privately can steer the pick, but the reasons shown to the group only cite public things
// (reviews, ratings, distance, what was said in the group chat).
//
// Keys: GOOGLE_MAPS_API_KEY (Places API (New)), TICKETMASTER_API_KEY (Discovery API).

export type VenueKind = "food" | "activity" | "event";
export type Venue = Place & {
  kind: VenueKind;
  rating?: number | null;
  ratingCount?: number | null;
  price?: string | null;
  website?: string | null;
  mapsUrl?: string | null;
  ticketUrl?: string | null;
  startsAt?: string | null; // events
  why?: string | null; // one short public reason Hush picked it
};

export const googlePlacesConfigured = () => !!process.env.GOOGLE_MAPS_API_KEY;
export const ticketmasterConfigured = () => !!process.env.TICKETMASTER_API_KEY;

const FOOD = /\b(food|eat|eating|dinner|lunch|brunch|breakfast|restaurants?|sushi|pizza|tacos?|burgers?|bbq|barbecue|ramen|thai|indian|chinese|mexican|italian|pho|wings|steak|seafood|korean|mediterranean|cafe|coffee|dessert|ice cream|boba|brewery|bar|bars|drinks|happy hour)\b/i;
const EVENT = /\b(concert|show|game|match|tickets?|festival|comedy|standup|stand-up|musical|broadway|theat(er|re)|gig|tour|playoffs?|hawks|braves|falcons|united|nba|nfl|mlb|nhl|mls)\b/i;
const ACTIVITY = /\b(bowling|escape room|museum|hike|hiking|park|arcade|karaoke|movies?|cinema|mini ?golf|golf|topgolf|climbing|bouldering|skating|zoo|aquarium|axe throwing|laser tag|go[- ]?karts?|trivia|pool|billiards|spa|beach|picnic)\b/i;

/** What kind of place a plan needs, from its title/details (null = not something to look up). */
export function venueKindOf(text: string): VenueKind | null {
  if (EVENT.test(text)) return "event";
  if (FOOD.test(text)) return "food";
  if (ACTIVITY.test(text)) return "activity";
  return null;
}

// ---------- Google Places (New) ----------

type GPlace = {
  displayName?: { text: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  editorialSummary?: { text: string };
  primaryTypeDisplayName?: { text: string };
  reviews?: { text?: { text: string }; rating?: number }[];
  businessStatus?: string;
  addressComponents?: { shortText: string; types: string[] }[];
};

async function googleSearch(query: string, at: { lat: number; lng: number }, kind: VenueKind) {
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY!,
      "X-Goog-FieldMask": [
        "places.displayName",
        "places.formattedAddress",
        "places.shortFormattedAddress",
        "places.location",
        "places.rating",
        "places.userRatingCount",
        "places.priceLevel",
        "places.websiteUri",
        "places.googleMapsUri",
        "places.editorialSummary",
        "places.primaryTypeDisplayName",
        "places.reviews",
        "places.businessStatus",
        "places.addressComponents",
      ].join(","),
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: 12,
      locationBias: { circle: { center: { latitude: at.lat, longitude: at.lng }, radius: 6000 } },
      ...(kind === "food" ? { includedType: /bar|drinks|brewery|happy hour/i.test(query) ? "bar" : "restaurant" } : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const j = (await r.json().catch(() => ({}))) as { places?: GPlace[]; error?: { message: string } };
  if (!r.ok) throw new Error(j.error?.message ?? `Google Places ${r.status}`);
  const priceWord: Record<string, string> = {
    PRICE_LEVEL_INEXPENSIVE: "$",
    PRICE_LEVEL_MODERATE: "$$",
    PRICE_LEVEL_EXPENSIVE: "$$$",
    PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
  };
  return (j.places ?? [])
    .filter((p) => p.displayName?.text && p.location && p.businessStatus !== "CLOSED_PERMANENTLY")
    .map((p) => {
      const comp = (t: string) => p.addressComponents?.find((c) => c.types.includes(t))?.shortText ?? null;
      const v: Venue & { reviews: string[]; summary: string | null } = {
        kind,
        name: p.displayName!.text,
        cuisine: p.primaryTypeDisplayName?.text ?? null,
        address: p.shortFormattedAddress ?? p.formattedAddress ?? null,
        lat: p.location!.latitude,
        lng: p.location!.longitude,
        city: comp("locality"),
        state: comp("administrative_area_level_1"),
        rating: p.rating ?? null,
        ratingCount: p.userRatingCount ?? null,
        price: p.priceLevel ? (priceWord[p.priceLevel] ?? null) : null,
        website: p.websiteUri ?? null,
        mapsUrl: p.googleMapsUri ?? null,
        reviews: (p.reviews ?? []).slice(0, 3).map((x) => `${x.rating ?? "?"}★ ${(x.text?.text ?? "").replace(/\s+/g, " ").slice(0, 280)}`),
        summary: p.editorialSummary?.text ?? null,
      };
      return v;
    });
}

// ---------- Ticketmaster (events) ----------

type TmEvent = {
  name: string;
  url?: string;
  dates?: { start?: { dateTime?: string; localDate?: string } };
  priceRanges?: { min?: number; max?: number; currency?: string }[];
  classifications?: { segment?: { name: string }; genre?: { name: string } }[];
  info?: string;
  _embedded?: {
    venues?: { name?: string; address?: { line1?: string }; city?: { name?: string }; state?: { stateCode?: string }; location?: { latitude?: string; longitude?: string } }[];
  };
};

async function ticketmasterSearch(keyword: string, at: { lat: number; lng: number }, from: Date, to: Date) {
  const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
  const q = new URLSearchParams({
    apikey: process.env.TICKETMASTER_API_KEY!,
    latlong: `${at.lat},${at.lng}`,
    radius: "30",
    unit: "miles",
    startDateTime: iso(from),
    endDateTime: iso(to),
    size: "20",
    sort: "relevance,desc",
    ...(keyword ? { keyword } : {}),
  });
  const r = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${q}`, { signal: AbortSignal.timeout(10_000) });
  const j = (await r.json().catch(() => ({}))) as { _embedded?: { events?: TmEvent[] }; fault?: { faultstring: string } };
  if (!r.ok) throw new Error(j.fault?.faultstring ?? `Ticketmaster ${r.status}`);
  return (j._embedded?.events ?? [])
    .map((e) => {
      const v0 = e._embedded?.venues?.[0];
      const lat = Number(v0?.location?.latitude);
      const lng = Number(v0?.location?.longitude);
      const start = e.dates?.start?.dateTime ?? null;
      if (!v0?.name || !start || isNaN(lat) || isNaN(lng)) return null;
      const price = e.priceRanges?.[0];
      const v: Venue & { reviews: string[]; summary: string | null } = {
        kind: "event",
        name: e.name,
        cuisine: [e.classifications?.[0]?.segment?.name, e.classifications?.[0]?.genre?.name].filter((x) => x && x !== "Undefined").join(" · ") || null,
        address: [v0.name, v0.address?.line1].filter(Boolean).join(", "),
        lat,
        lng,
        city: v0.city?.name ?? null,
        state: v0.state?.stateCode ?? null,
        price: price?.min ? `from $${Math.round(price.min)}` : null,
        ticketUrl: e.url ?? null,
        startsAt: start,
        reviews: [],
        summary: e.info?.slice(0, 300) ?? null,
      };
      return v;
    })
    .filter((v): v is NonNullable<typeof v> => !!v);
}

// ---------- A peek at a place's website (SSRF-safe) ----------

const PRIVATE_IP = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|::1$|::ffff:(10|127|192\.168)\.|f[cd][0-9a-f]{2}:|fe80:)/i;

async function siteSnippet(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol) || u.port || u.username) return null;
    const addrs = await lookup(u.hostname, { all: true });
    if (!addrs.length || addrs.some((a) => PRIVATE_IP.test(a.address))) return null;
    const r = await fetch(u, { redirect: "error", signal: AbortSignal.timeout(5_000), headers: { "User-Agent": "Mozilla/5.0 (SilentConsensus planner)" } });
    if (!r.ok || !(r.headers.get("content-type") ?? "").includes("text/html")) return null;
    const html = (await r.text()).slice(0, 200_000);
    const text = html
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&amp;|&#\d+;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 900) || null;
  } catch {
    return null;
  }
}

// ---------- Turning the plan into a search ----------

const Search = z.object({
  kind: z.enum(["food", "activity", "event"]),
  query: z.string().describe("What to search for, e.g. 'tacos', 'bowling alley', 'rooftop bar'; for events, a keyword like 'Hawks' or 'jazz' or '' for anything"),
  wants: z.string().describe("What the group said it wants (from the GROUP chat only): vibe, budget, must-haves. '' if nothing"),
});

async function planSearch(circleId: string, item: { title: string; details: string | null }, fallbackKind: VenueKind) {
  const rows = await db.groupMessage.findMany({ where: { circleId, kind: "TEXT" }, orderBy: { createdAt: "desc" }, take: 25, select: { body: true } });
  try {
    const { data } = await callLLM({
      task: "venue_search_plan",
      label: "Places: what to search for",
      circleId,
      schema: Search,
      reasoningEffort: "minimal",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: "Turn a group's plan into a place or event search. Use what the group chat says (cuisine, vibe, artist, team). Never include names of people.",
        },
        { role: "user", content: `Plan: ${item.title}${item.details ? ` (${item.details})` : ""}\nGroup chat (newest first):\n${rows.map((r) => r.body).join("\n")}` },
      ],
    });
    return data;
  } catch (e) {
    if (!(e instanceof LLMUnavailableError)) console.error("venue search plan failed", e);
    return { kind: fallbackKind, query: fallbackKind === "food" ? (cuisineFor(item.title) ?? "restaurant") : item.title, wants: "" };
  }
}

const Picks = z.object({
  picks: z
    .array(z.object({ index: z.number().int(), why: z.string().describe("One short public reason: reviews, rating, price, distance or what the GROUP chat asked for. Never private info, never names.") }))
    .max(3),
});

/**
 * Real options near `at` for this plan, best first (up to 3), each with a short public reason.
 * Returns [] if nothing could be found (or the needed key isn't set for activities / events).
 */
export async function findVenues(circleId: string, item: { title: string; details: string | null; startsAt: Date | null }, at: { lat: number; lng: number }, areaLabel: string) {
  const base = venueKindOf(`${item.title} ${item.details ?? ""}`) ?? "food";
  const plan = await planSearch(circleId, item, base);
  const kind = plan.kind;
  const query = plan.query;
  let cands: (Venue & { reviews: string[]; summary: string | null })[] = [];
  try {
    if (kind === "event" && !ticketmasterConfigured()) {
      // No Ticketmaster key: suggest real venues nearby, and link to their events.
      const found: Place[] = [];
      for (const q of ["concert hall", "theatre", "music venue", "amphitheatre", "arena"]) {
        found.push(...(await nominatimPlaces(q, at, 5).catch(() => [] as Place[])));
        if (found.length >= 6) break;
      }
      cands = found.map((p) => ({ ...p, kind, reviews: [], summary: null, ticketUrl: `https://www.ticketmaster.com/search?q=${encodeURIComponent(p.name)}` }));
    } else if (kind === "event") {
      const from = item.startsAt ? new Date(+item.startsAt - 12 * 3600_000) : new Date();
      const to = item.startsAt ? new Date(+item.startsAt + 36 * 3600_000) : new Date(Date.now() + 21 * 864e5);
      cands = await ticketmasterSearch(plan.query, at, from, to);
    } else if (googlePlacesConfigured()) {
      cands = await googleSearch(`${plan.query} near ${areaLabel}`, at, kind);
    } else if (kind === "food") {
      const words = plan.query && !/restaurant|food|dinner|lunch|eat/i.test(plan.query) ? await nominatimPlaces(plan.query, at, 8).catch(() => [] as Place[]) : [];
      const list = words.length >= 2 ? words : await restaurantsNear(at, cuisineFor(`${plan.query} ${item.title}`), 8);
      cands = list.map((p) => ({ ...p, kind, reviews: [], summary: null }));
    } else {
      // Try the search as written, then simpler words ("bowling alley" → "bowling").
      const tries = [...new Set([plan.query, plan.query.split(" ")[0], item.title.split(/[ (]/)[0]].map((t) => t?.trim()).filter((t): t is string => !!t && t.length > 2))];
      let found: Place[] = [];
      for (const t of tries) {
        found = await nominatimPlaces(t, at, 8).catch(() => [] as Place[]);
        if (found.length) break;
      }
      cands = found.map((p) => ({ ...p, kind, reviews: [], summary: null }));
    }
  } catch (e) {
    console.error("venue search failed", e);
    return { kind, query, venues: [] as Venue[] };
  }
  if (!cands.length) return { kind, query, venues: [] as Venue[] };
  if (cands.length <= 3 && !cands.some((c) => c.reviews.length || c.summary)) return { kind, query, venues: cands.map(strip) };

  // Peek at the top candidates' websites, then let the model pick for this group.
  const top = cands.slice(0, 8);
  const sites = await Promise.all(top.map((c) => (c.kind === "event" ? Promise.resolve(null) : siteSnippet(c.website))));
  const members = await db.member.findMany({ where: { circleId, accountId: { not: null } }, select: { accountId: true } });
  const notes = (await Promise.all(members.map((m, i) => anonymousMd(m.accountId!, `P${i + 1}`)))).join("\n");
  const tz = await groupZone(circleId);
  let picks: z.infer<typeof Picks>["picks"] = [];
  try {
    const { data } = await callLLM({
      task: "venue_pick",
      label: "Places: pick the best options for the group",
      circleId,
      schema: Picks,
      reasoningEffort: "low",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            `Pick the best 3 options for a group's plan "${item.title}" around ${areaLabel}. Weigh what the group chat asked for (${plan.wants || "nothing specific"}), ` +
            "ratings and review count, what reviews and the website say, price, and anything in people's private notes (like dietary needs or budget). " +
            "Skip anything that looks closed, chain fast food, or a poor fit. " +
            "PRIVACY: private notes may steer your pick, but `why` must only cite public things (reviews, rating, price, distance, the group chat), never private notes or names. " +
            "HONESTY: only mention ratings or reviews if they're listed for that option below. Never invent them; say what you actually know (type, distance, what the group asked for).",
        },
        {
          role: "user",
          content:
            `Private notes (names hidden):\n${notes}\n\nOptions:\n` +
            top
              .map(
                (c, i) =>
                  `[${i}] ${c.name}${c.cuisine ? ` (${c.cuisine})` : ""} · ${c.address ?? ""}` +
                  (c.startsAt ? ` · ${slotLabel(new Date(c.startsAt), tz)}` : "") +
                  (c.rating ? ` · ${c.rating}★ (${c.ratingCount ?? 0})` : "") +
                  (c.price ? ` · ${c.price}` : "") +
                  (c.summary ? `\n  About: ${c.summary}` : "") +
                  (c.reviews.length ? `\n  Reviews: ${c.reviews.join(" | ")}` : "") +
                  (sites[i] ? `\n  Website: ${sites[i]}` : ""),
              )
              .join("\n"),
        },
      ],
    });
    picks = data.picks.filter((p) => p.index >= 0 && p.index < top.length);
  } catch (e) {
    if (!(e instanceof LLMUnavailableError)) console.error("venue pick failed", e);
  }
  const chosen = picks.length ? picks.map((p) => ({ ...strip(top[p.index]), why: p.why.slice(0, 120) })) : top.slice(0, 3).map(strip);
  return { kind, query, venues: dedupe(chosen).slice(0, 3) };
}

function strip(v: Venue & { reviews?: string[]; summary?: string | null }): Venue {
  const { reviews: _r, summary: _s, ...rest } = v;
  void _r;
  void _s;
  return rest;
}
const dedupe = (list: Venue[]) => list.filter((v, i) => list.findIndex((x) => x.name === v.name && x.startsAt === v.startsAt) === i);
