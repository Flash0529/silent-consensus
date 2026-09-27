import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { areaName, middle, round } from "@/lib/places";
import { findVenues, venueKindOf, type Venue } from "@/lib/findplaces";
import { slotLabel, groupZone } from "@/lib/calendar";
import { clip, clipOrNull } from "@/lib/text";

// Private answers, public outcomes: the core promise of Silent Consensus.
// - RSVPs on a plan card and answers to Hush's questions are stored per person but NEVER shown to the
//   group (not who, not a breakdown). The group sees "N of M answered" and, once everyone has
//   answered, only the outcome Hush announces.
// - Nothing in this file ever writes a person's name or a per-person answer into the group chat.
//
// Question kinds (HushAsk.field):
//   when      pick a time (meta.startsAt[i] = exact start for option i, when known)
//   place     pick a place (meta.places[i] = a real restaurant, when Hush found them)
//   location  "where are you coming from?" (answered with rough coordinates; Hush finds the middle)
//   decide    what to do next after a private check-in (meta.actions[i])
//   other

const SOMETHING_ELSE = "Something else";
const FLEX = /\b(any|anything|either|whatever|no preference|open to|all good|doesn'?t matter)\b/i;

type AskMeta = {
  startsAt?: (string | null)[];
  places?: Venue[];
  actions?: { label: string; action: "LOCK" | "FIND_DAY" | "GO_ANYWAY" | "SKIP"; startsAt: string | null }[];
};

export async function createAsk(
  circleId: string,
  opts: { itemId?: string | null; field: string; question: string; options: string[]; meta?: AskMeta; noSomethingElse?: boolean },
) {
  const options = [...new Set(opts.options.map((o) => o.trim()).filter(Boolean))].slice(0, 4);
  if (options.length < (opts.field === "location" ? 1 : 2)) return null;
  if (!opts.noSomethingElse && !options.some((o) => o.toLowerCase() === SOMETHING_ELSE.toLowerCase())) options.push(SOMETHING_ELSE);
  const ask = await db.hushAsk.create({
    data: {
      circleId,
      itemId: opts.itemId ?? null,
      field: opts.field,
      question: clip(opts.question, 200),
      options,
      meta: opts.meta ? (opts.meta as Prisma.InputJsonValue) : undefined,
    },
  });
  await db.groupMessage.create({ data: { circleId, kind: "ASK", body: ask.question, askId: ask.id } });
  if (opts.itemId) await db.chatItem.update({ where: { id: opts.itemId }, data: { askedAt: new Date() } });
  return ask;
}

const totalFor = (circleId: string) => db.member.count({ where: { circleId, accountId: { not: null } } });

/** Record one person's private answer. Returns whether everyone has now answered (then call resolveAsk). */
export async function answerAsk(askId: string, memberId: string, answer: { choice?: number; text?: string; lat?: number; lng?: number }) {
  const ask = await db.hushAsk.findUnique({ where: { id: askId } });
  if (!ask || ask.status !== "OPEN") return { closed: true, ready: false };
  const options = ask.options as string[];
  let data: { choice: number | null; text: string | null; lat: number | null; lng: number | null };
  if (ask.field === "location") {
    if (answer.lat === undefined || answer.lng === undefined) return { closed: false, ready: false };
    data = { choice: null, text: null, lat: round(answer.lat), lng: round(answer.lng) };
  } else {
    const choice = answer.choice !== undefined && answer.choice >= 0 && answer.choice < options.length ? answer.choice : null;
    const text = choice === null ? (answer.text ?? "").trim().slice(0, 200) || null : null;
    if (choice === null && !text) return { closed: false, ready: false };
    data = { choice, text, lat: null, lng: null };
  }
  await db.hushAnswer.upsert({
    where: { askId_memberId: { askId, memberId } },
    create: { askId, memberId, ...data },
    update: { ...data, at: new Date() },
  });
  const [answered, total] = await Promise.all([db.hushAnswer.count({ where: { askId } }), totalFor(ask.circleId)]);
  return { closed: false, ready: answered >= total };
}

export async function resolveIfEveryoneAnswered(askId: string) {
  const ask = await db.hushAsk.findUnique({ where: { id: askId }, select: { status: true, circleId: true, _count: { select: { answers: true } } } });
  if (!ask || ask.status !== "OPEN") return;
  if (ask._count.answers >= (await totalFor(ask.circleId))) await resolveAsk(askId);
}

const hush = (circleId: string, body: string) => db.groupMessage.create({ data: { circleId, kind: "HUSH", body } });
const cardUpdated = (circleId: string, itemId: string) => db.groupMessage.create({ data: { circleId, kind: "ITEM", body: "updated", itemId } });
const q = (t: string) => `“${t}”`;

export async function resolveAsk(askId: string) {
  // Claim it so two last answers at once can't both resolve it.
  const claimed = await db.hushAsk.updateMany({ where: { id: askId, status: "OPEN" }, data: { status: "CLOSED" } });
  if (!claimed.count) return;
  const ask = await db.hushAsk.findUniqueOrThrow({ where: { id: askId }, include: { answers: true, item: true } });
  const meta = (ask.meta ?? {}) as AskMeta;
  const what = ask.item?.title ?? ask.question.replace(/\?$/, "").toLowerCase();

  if (ask.field === "location") return resolveLocation(ask.circleId, ask.item, ask.answers);

  const options = ask.options as string[];
  // "Any genre" / "anything works" are FLEXIBLE: that person is happy with whatever the others pick,
  // so a flexible vote counts for every specific option, and a flexible option never beats a specific one.
  const flexible = options.map((o) => FLEX.test(o));
  const tally = options.map(() => 0);
  let own = 0;
  let flex = 0;
  for (const a of ask.answers) {
    if (a.choice === null || options[a.choice]?.toLowerCase() === SOMETHING_ELSE.toLowerCase()) own++;
    else if (flexible[a.choice]) flex++;
    else tally[a.choice]++;
  }
  const specific = tally.map((t, i) => (flexible[i] ? -1 : t + flex));
  const anySpecific = tally.some((t, i) => !flexible[i] && t > 0);
  const best = anySpecific ? specific.indexOf(Math.max(...specific)) : flexible.findIndex(Boolean);
  const bestVotes = anySpecific ? specific[best] : flex;
  const picked = best >= 0 && bestVotes > 0 && bestVotes >= own ? options[best] : null;
  await db.hushAsk.update({ where: { id: askId }, data: { result: picked } });

  if (!picked) {
    // Most people want something else: take it private.
    const { startCheckIn } = await import("@/lib/checkin");
    await hush(ask.circleId, `You've got other ideas for ${q(what)}. I'll check in with each of you privately and find what works.`);
    await startCheckIn(ask.circleId, ask.itemId, "Most people wanted something other than the options Hush offered");
    return;
  }
  const unanimous = bestVotes === ask.answers.length;

  if (ask.field === "decide") {
    const act = meta.actions?.[best];
    return decide(ask.circleId, ask.item, act ?? { label: picked, action: "GO_ANYWAY", startsAt: null });
  }

  if (ask.item) {
    const item = ask.item;
    if (ask.field === "when") {
      const start = meta.startsAt?.[best] ? new Date(meta.startsAt[best]!) : null;
      const dayWord = /\b(mon|tue|wed|thu|fri|sat|sun|today|tonight|tomorrow|\d{1,2}\/\d{1,2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
      const whenText = start || dayWord.test(picked) || !item.whenText ? picked : `${item.whenText} · ${picked}`;
      await db.chatItem.update({ where: { id: item.id }, data: { whenText: whenText.slice(0, 80), ...(start ? { startsAt: start } : {}) } });
    } else if (ask.field === "place") {
      const place = meta.places?.[best];
      const start = place?.startsAt ? new Date(place.startsAt) : null;
      await db.chatItem.update({
        where: { id: item.id },
        data: place
          ? {
              place: (place.kind === "event" ? (place.address ?? place.name) : [place.name, place.address].filter(Boolean).join(", ")).slice(0, 120),
              placeMeta: place as unknown as Prisma.InputJsonValue,
              // Picking an event also sets when it is.
              ...(start ? { startsAt: start, whenText: slotLabel(start, await groupZone(ask.circleId)), title: place.name.slice(0, 80) } : {}),
            }
          : { place: picked.slice(0, 120) },
      });
    }
  }
  await hush(ask.circleId, unanimous ? `Going with ${picked} for ${q(what)}. Everyone picked it.` : `Going with ${picked} for ${q(what)}. It works for the most people.`);
  if (ask.item) {
    await cardUpdated(ask.circleId, ask.item.id);
    // Eating out and no place yet: ask where everyone's coming from (privately) and find the middle.
    if (ask.field === "when") await askPlaceIfNeeded(ask.circleId, ask.item.id);
  }
}

type ItemRow = NonNullable<Awaited<ReturnType<typeof db.chatItem.findUnique>>>;

async function decide(circleId: string, item: ItemRow | null, act: NonNullable<AskMeta["actions"]>[number]) {
  const what = item?.title ?? "this";
  if (act.action === "LOCK" && item) {
    const start = act.startsAt ? new Date(act.startsAt) : null;
    const label = act.label.replace(/^lock( it)? in:?\s*/i, "").trim() || act.label;
    // New time: earlier RSVPs were for the old one, and any open "when?" question is settled.
    await db.chatItemResponse.deleteMany({ where: { itemId: item.id } });
    await closeOpenAsks(item.id, ["when"]);
    await db.chatItem.update({ where: { id: item.id }, data: { whenText: label.slice(0, 80), outcome: null, ...(start ? { startsAt: start } : {}) } });
    await hush(circleId, `Locked in: ${q(what)}, ${label} 🎉`);
    await cardUpdated(circleId, item.id);
    await askPlaceIfNeeded(circleId, item.id);
    return;
  }
  if (act.action === "FIND_DAY") {
    const { findTimesAsk } = await import("@/lib/checkin");
    await findTimesAsk(circleId, item?.id ?? null);
    return;
  }
  if (act.action === "SKIP") {
    if (item) await db.chatItem.update({ where: { id: item.id }, data: { status: "DISMISSED" } });
    await hush(circleId, `Okay, ${q(what)} is off for now. Say the word when you want to try again.`);
    return;
  }
  await hush(circleId, `Going ahead with ${q(what)} as planned. Whoever can make it, see you there!`);
}

// ---------- Places ----------

export async function askPlaceIfNeeded(circleId: string, itemId: string) {
  const item = await db.chatItem.findUnique({ where: { id: itemId } });
  if (!item || item.kind !== "EVENT" || item.status !== "OPEN" || item.place) return;
  if (await db.hushAsk.findFirst({ where: { itemId, status: "OPEN", field: { in: ["location", "place"] } } })) return;
  if (venueKindOf(`${item.title} ${item.details ?? ""}`)) return createLocationAsk(circleId, itemId);
}

/** Questions that no longer matter (e.g. "what time?" once a time is locked in). */
export function closeOpenAsks(itemId: string, fields: string[]) {
  return db.hushAsk.updateMany({ where: { itemId, status: "OPEN", field: { in: fields } }, data: { status: "CLOSED" } });
}

export function createLocationAsk(circleId: string, itemId: string | null) {
  return createAsk(circleId, {
    itemId,
    field: "location",
    question: "Where will you be coming from? Share your location or type a city or ZIP. Only Hush sees it, and I'll find something in the middle.",
    options: ["Share location"],
    noSomethingElse: true,
  });
}

async function resolveLocation(circleId: string, item: ItemRow | null, answers: { lat: number | null; lng: number | null }[]) {
  const pts = answers.filter((a): a is { lat: number; lng: number } => a.lat !== null && a.lng !== null);
  if (!pts.length) {
    await hush(circleId, "No one shared where they're coming from, so I'll leave the place open for now.");
    return;
  }
  const mid = middle(pts);
  const area = await areaName(mid.lat, mid.lng).catch(() => ({ area: null, city: null, state: null }));
  const areaLabel = [area.area, area.city, area.state].filter(Boolean).join(", ") || "the middle";
  const found = await findVenues(circleId, { title: item?.title ?? "a plan", details: item?.details ?? null, startsAt: item?.startsAt ?? null }, mid, areaLabel);
  const places = found.venues.map((p) => ({ ...p, city: p.city ?? area.city, state: p.state ?? area.state }));
  const middleOf = [area.area, area.city].filter(Boolean).join(", ");
  const near = middleOf ? `The middle for everyone is around ${middleOf}` : "I found the middle for everyone";
  if (!places.length && found.kind !== "event" && item && (area.city || area.area)) {
    // Couldn't list specific spots right now: pin the middle area, with booking / map searches there.
    const what = (found.query || "restaurants").trim();
    const areaPlace: Venue = { kind: found.kind, name: what, cuisine: null, address: [area.area, area.city].filter(Boolean).join(", "), lat: mid.lat, lng: mid.lng, city: area.city, state: area.state };
    await db.chatItem.update({ where: { id: item.id }, data: { place: `Around ${middleOf}`.slice(0, 120), placeMeta: areaPlace as unknown as Prisma.InputJsonValue } });
    await hush(circleId, `${near}. I pinned it to the plan with ${found.kind === "food" ? "Resy, OpenTable and map searches" : "a map search"} for ${what} there, so you can pick a spot.`);
    await cardUpdated(circleId, item.id);
    return;
  }
  if (!places.length) {
    await hush(
      circleId,
      found.kind === "event"
        ? `${near}, but I couldn't find events for that yet. Share one here and I'll pin it.`
        : `${near}, but I couldn't find good spots there right now. Suggest a place and I'll pin it.`,
    );
    return;
  }
  const tz = await groupZone(circleId);
  const labelOf = (p: Venue) =>
    p.kind === "event" && p.startsAt ? `${p.name} · ${slotLabel(new Date(p.startsAt), tz)}` : p.cuisine ? `${p.name} (${p.cuisine})` : p.name;
  await hush(
    circleId,
    `${near}. ${found.kind === "event" ? "Here's what's on nearby" : "Here are a few good spots there"}. Pick privately:`,
  );
  await createAsk(circleId, {
    itemId: item?.id ?? null,
    field: "place",
    question: found.kind === "event" ? "Which one should we go to?" : `Where should we go${item ? ` for ${q(item.title)}` : ""}?`,
    options: places.map(labelOf),
    meta: { places },
  });
}

// ---------- RSVPs ----------

/**
 * After someone RSVPs (or changes their RSVP): once everyone has answered, announce only the outcome.
 * Not everyone's in → Hush takes it to private check-ins. Announces again only if the outcome changes.
 */
export async function evaluateRsvps(itemId: string) {
  const item = await db.chatItem.findUnique({ where: { id: itemId }, include: { responses: true } });
  if (!item || item.kind !== "EVENT" || item.status !== "OPEN") return;
  const total = await totalFor(item.circleId);
  if (item.responses.length < total) return;
  const outcome = item.responses.every((r) => r.answer === "IN") ? "ALL_IN" : "NOT_ALL";
  if (outcome === item.outcome) return;
  await db.chatItem.update({ where: { id: itemId }, data: { outcome } });
  if (outcome === "ALL_IN") {
    await hush(item.circleId, `Everyone's in for ${q(item.title)}! 🎉`);
    // Fill in what's missing, privately.
    const open = await db.hushAsk.findFirst({ where: { itemId, status: "OPEN" } });
    if (open) return;
    if (!item.startsAt && !item.whenText) {
      await createAsk(item.circleId, { itemId, field: "when", question: `When works best for ${q(item.title)}?`, options: ["Morning", "Afternoon", "Evening"] });
    } else if (!item.place) {
      if (venueKindOf(`${item.title} ${item.details ?? ""}`)) await createLocationAsk(item.circleId, itemId);
      else
        await createAsk(item.circleId, {
          itemId,
          field: "place",
          question: `Where should we do ${q(item.title)}?`,
          options: ["Somewhere close by", "Somewhere new", "Someone's place"],
        });
    }
  } else {
    const { startCheckIn } = await import("@/lib/checkin");
    const running = await db.hushCheckIn.findFirst({ where: { itemId, status: "OPEN" } });
    await hush(
      item.circleId,
      running
        ? `Still working on ${q(item.title)} privately with everyone.`
        : `Not everyone can make ${q(item.title)} as it stands, and no one has to say why. I'm messaging each of you privately to find something that works.`,
    );
    if (!running) await startCheckIn(item.circleId, itemId, "Not everyone can make the plan as it stands");
  }
}
