import { SUPPORT_EMAIL, SITE_URL } from "@/lib/twilio/consent";

// Real places for plans that involve food: when a group plans to eat out, Hush asks each person
// privately roughly where they're coming from (their location or a city / ZIP), finds the middle, and
// looks up real restaurants near it (OpenStreetMap), then links straight to Resy / OpenTable / Maps
// to book. Nobody's location is ever shown to anyone; only the middle area is.
//
// OpenStreetMap's services are free but ask for a real User-Agent, light use and caching.

const UA = `SilentConsensus/1.0 (${SITE_URL}; ${SUPPORT_EMAIL})`;

export type Place = {
  name: string;
  cuisine: string | null;
  address: string | null;
  lat: number;
  lng: number;
  city: string | null;
  state: string | null;
};

const FOOD = /\b(food|eat|eating|dinner|lunch|brunch|breakfast|restaurants?|sushi|pizza|tacos?|burgers?|bbq|barbecue|ramen|thai|indian|chinese|mexican|italian|pho|wings|steak|seafood|korean|mediterranean|cafe|coffee|dessert|ice cream|boba|brewery|bar|drinks)\b/i;
export const isFoodPlan = (t: string | null | undefined) => !!t && FOOD.test(t);

// OSM cuisine tags for words people use.
const CUISINES: [RegExp, string][] = [
  [/sushi|japanese|ramen/i, "sushi|japanese|ramen"],
  [/pizza/i, "pizza"],
  [/taco|mexican/i, "mexican|tex-mex|tacos"],
  [/burger/i, "burger"],
  [/bbq|barbecue/i, "barbecue|bbq"],
  [/thai/i, "thai"],
  [/indian/i, "indian"],
  [/chinese/i, "chinese"],
  [/italian|pasta/i, "italian|pizza"],
  [/pho|vietnam/i, "vietnamese"],
  [/korean/i, "korean"],
  [/wings/i, "chicken|wings|american"],
  [/steak/i, "steak_house"],
  [/seafood/i, "seafood"],
  [/mediterranean|greek/i, "mediterranean|greek|lebanese"],
  [/brunch|breakfast/i, "breakfast|brunch|american"],
];
export const cuisineFor = (t: string) => CUISINES.find(([re]) => re.test(t))?.[1] ?? null;

// ---------- rate limiting + caching (OSM asks for at most ~1 request a second) ----------

let lastCall = 0;
async function politely<T>(fn: () => Promise<T>) {
  const wait = lastCall + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  return fn();
}
const cache = new Map<string, { at: number; v: unknown }>();
async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const c = cache.get(key);
  if (c && Date.now() - c.at < 6 * 3600_000) return c.v as T;
  const v = await fn();
  // Don't remember failures or empty answers (they're often a busy server, not a real "nothing").
  if (v !== null && !(Array.isArray(v) && !v.length)) cache.set(key, { at: Date.now(), v });
  return v;
}

type NomAddr = { city?: string; town?: string; village?: string; suburb?: string; neighbourhood?: string; state?: string; postcode?: string; "ISO3166-2-lvl4"?: string };
const stateCode = (a: NomAddr) => a["ISO3166-2-lvl4"]?.split("-")[1] ?? null;
const cityOf = (a: NomAddr) => a.city ?? a.town ?? a.village ?? null;

type NomHit = { lat: string; lon: string; addresstype?: string; address?: NomAddr };

async function nominatim(params: URLSearchParams): Promise<NomHit | null> {
  return politely(async () => {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8_000) });
    const j = (await r.json().catch(() => [])) as NomHit[];
    // A county or state is too big to be "where I'm coming from".
    return j.find((h) => !["county", "state", "country"].includes(h.addresstype ?? "")) ?? null;
  });
}

/** A city, "City, ST" or US ZIP → rough coordinates (rounded to ~1 km). */
export async function geocode(q: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const query = q.trim().replace(/\s+/g, " ").slice(0, 100);
  if (!query) return null;
  return cached(`geo:${query.toLowerCase()}`, async () => {
    const base = { format: "jsonv2", limit: "5", addressdetails: "1", countrycodes: "us" };
    let hit: NomHit | null = null;
    const zip = query.match(/^(\d{5})(-\d{4})?$/);
    const cityState = query.match(/^([^,]+),\s*([A-Za-z .]+)$/);
    if (zip) hit = await nominatim(new URLSearchParams({ ...base, postalcode: zip[1] }));
    else if (cityState) hit = await nominatim(new URLSearchParams({ ...base, city: cityState[1].trim(), state: cityState[2].trim() }));
    if (!hit) hit = await nominatim(new URLSearchParams({ ...base, q: query }));
    if (!hit) return null;
    const a = hit.address ?? {};
    return {
      lat: round(Number(hit.lat)),
      lng: round(Number(hit.lon)),
      label: [cityOf(a) ?? a.suburb, stateCode(a)].filter(Boolean).join(", ") || query,
    };
  });
}

/** Coordinates → "Midtown, Atlanta, GA"-style area name. */
export async function areaName(lat: number, lng: number) {
  return cached(`rev:${lat},${lng}`, () =>
    politely(async () => {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&addressdetails=1&lat=${lat}&lon=${lng}`, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(8_000),
      });
      const j = (await r.json().catch(() => ({}))) as { address?: NomAddr };
      const a = j.address ?? {};
      return { area: a.neighbourhood ?? a.suburb ?? null, city: cityOf(a), state: stateCode(a) };
    }),
  );
}

export const round = (n: number) => Math.round(n * 100) / 100;

export function middle(points: { lat: number; lng: number }[]) {
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  return { lat: round(lat), lng: round(lng) };
}

const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass-api.de/api/interpreter"];

type NomPlace = { name?: string; lat: string; lon: string; type?: string; address?: NomAddr & { road?: string; house_number?: string }; extratags?: { cuisine?: string } };

/**
 * Places near a point by name/kind (OpenStreetMap's search, bounded to ~4 km around it). Fast and
 * free; the fallback when there's no Google Places key and the Overpass server is busy.
 */
export async function nominatimPlaces(query: string, at: { lat: number; lng: number }, max = 8): Promise<Place[]> {
  const d = 0.04;
  const key = `nom:${query.toLowerCase()}:${at.lat},${at.lng}`;
  return cached(key, () =>
    politely(async () => {
      const q = new URLSearchParams({
        format: "jsonv2",
        limit: String(Math.min(max * 2, 20)),
        addressdetails: "1",
        extratags: "1",
        bounded: "1",
        viewbox: `${at.lng - d},${at.lat + d},${at.lng + d},${at.lat - d}`,
        q: query,
      });
      const r = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8_000) });
      const j = (await r.json().catch(() => [])) as NomPlace[];
      return j
        .filter((h) => h.name)
        .map((h) => {
          const a = h.address ?? {};
          const street = [a.house_number, a.road].filter(Boolean).join(" ");
          const place: Place = {
            name: h.name!,
            cuisine: h.extratags?.cuisine?.split(";")[0]?.replace(/_/g, " ") ?? null,
            address: street ? [street, cityOf(a)].filter(Boolean).join(", ") : null,
            lat: Number(h.lat),
            lng: Number(h.lon),
            city: cityOf(a),
            state: stateCode(a),
          };
          return place;
        })
        .slice(0, max);
    }),
  );
}

/** Real restaurants near a point (closest first), optionally of a cuisine. */
export async function restaurantsNear(at: { lat: number; lng: number }, cuisine: string | null, max = 3): Promise<Place[]> {
  const radius = 3500;
  const key = `rest:${at.lat},${at.lng}:${cuisine ?? "*"}`;
  const all = await cached(key, () =>
    politely(async () => {
      const q =
        `[out:json][timeout:25];(` +
        `node["amenity"="restaurant"]["name"](around:${radius},${at.lat},${at.lng});` +
        `way["amenity"="restaurant"]["name"](around:${radius},${at.lat},${at.lng});` +
        `);out center tags 80;`;
      type Resp = { elements?: { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] };
      // The public servers are sometimes busy: try the main one twice, then a mirror.
      let j: Resp = {};
      for (const [i, url] of OVERPASS.entries()) {
        if (i) await new Promise((res) => setTimeout(res, 1500));
        try {
          const r = await fetch(url, {
            method: "POST",
            headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ data: q }),
            signal: AbortSignal.timeout(30_000),
          });
          if (!r.ok) continue;
          const body = (await r.json().catch(() => null)) as Resp | null;
          if (body?.elements) {
            j = body;
            break;
          }
        } catch {
          /* next */
        }
      }
      return (j.elements ?? [])
        .map((e) => {
          const t = e.tags ?? {};
          const lat = e.lat ?? e.center?.lat;
          const lng = e.lon ?? e.center?.lon;
          if (!t.name || lat === undefined || lng === undefined) return null;
          const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
          const place: Place = {
            name: t.name,
            cuisine: t.cuisine?.split(";")[0]?.replace(/_/g, " ") ?? null,
            address: street ? [street, t["addr:city"]].filter(Boolean).join(", ") : null,
            lat,
            lng,
            city: t["addr:city"] ?? null,
            state: t["addr:state"] ?? null,
          };
          return place;
        })
        .filter((p): p is Place => !!p);
    }),
  );
  if (!all.length) {
    // Overpass busy: use OpenStreetMap's search instead (cuisine words first, then any restaurant).
    const words = cuisine ? cuisine.split("|").slice(0, 2) : [];
    const found: Place[] = [];
    for (const w of [...words, "restaurant"]) {
      found.push(...(await nominatimPlaces(w, at, 8).catch(() => [] as Place[])));
      if (found.length >= max) break;
    }
    return found.filter((p, i) => found.findIndex((x) => x.name === p.name) === i).slice(0, max);
  }
  const re = cuisine ? new RegExp(cuisine, "i") : null;
  const pick = (list: Place[]) =>
    list
      .filter((p) => !/mcdonald|burger king|wendy|taco bell|subway|kfc|popeyes|chick-fil-a|arby|sonic drive|domino|papa john|little caesars/i.test(p.name))
      .sort((a, b) => km(at, a) - km(at, b) + (a.address ? 0 : 0.8) - (b.address ? 0 : 0.8))
      .slice(0, max);
  const matching = re ? pick(all.filter((p) => p.cuisine && re.test(p.cuisine))) : [];
  return matching.length >= 2 ? matching : pick(all);
}

/** Links for a place Hush found: book (Resy / OpenTable), tickets (events), website, map. */
export function bookingLinks(
  p: Place & { kind?: string; website?: string | null; mapsUrl?: string | null; ticketUrl?: string | null },
  opts: { startsAt?: Date | null; party?: number; tz?: string },
) {
  const party = Math.max(1, Math.min(opts.party ?? 2, 20));
  const tz = opts.tz ?? "America/New_York";
  const d = opts.startsAt ?? null;
  const date = d ? new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d) : null;
  const hm = d ? new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d) : null;
  const citySlug = p.city && p.state ? `${p.city.toLowerCase().replace(/[^a-z]+/g, "-")}-${p.state.toLowerCase()}` : null;
  const resy = new URL(`https://resy.com/cities/${citySlug ?? "new-york-ny"}/search`);
  resy.searchParams.set("query", p.name);
  resy.searchParams.set("seats", String(party));
  if (date) resy.searchParams.set("date", date);
  const ot = new URL("https://www.opentable.com/s");
  ot.searchParams.set("term", p.name);
  ot.searchParams.set("covers", String(party));
  ot.searchParams.set("latitude", String(p.lat));
  ot.searchParams.set("longitude", String(p.lng));
  if (date && hm) ot.searchParams.set("dateTime", `${date}T${hm}`);
  const maps = p.mapsUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.name, p.address ?? p.city].filter(Boolean).join(" "))}`;
  const food = !p.kind || p.kind === "food";
  return {
    resy: food && citySlug ? resy.toString() : null,
    opentable: food ? ot.toString() : null,
    tickets: p.kind === "event" ? (p.ticketUrl ?? null) : null,
    website: p.website ?? null,
    maps,
  };
}
