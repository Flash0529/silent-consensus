import { describe, expect, it } from "vitest";
import { normalizeIcsUrl, parseIcsBusy, slotLabel, zoned } from "@/lib/calendar";
import { venueKindOf } from "@/lib/findplaces";
import { middle } from "@/lib/places";

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:test
BEGIN:VEVENT
UID:once
DTSTART:20261001T230000Z
DTEND:20261002T000000Z
SUMMARY:Secret dentist appointment
END:VEVENT
BEGIN:VEVENT
UID:weekly
DTSTART:20260929T140000Z
DTEND:20260929T150000Z
RRULE:FREQ=WEEKLY;COUNT=4
SUMMARY:Standup
END:VEVENT
BEGIN:VEVENT
UID:weekly
RECURRENCE-ID:20261006T140000Z
DTSTART:20261006T180000Z
DTEND:20261006T190000Z
SUMMARY:Standup (moved)
END:VEVENT
BEGIN:VEVENT
UID:allday
DTSTART;VALUE=DATE:20261003
DTEND;VALUE=DATE:20261004
SUMMARY:Birthday
END:VEVENT
BEGIN:VEVENT
UID:free
DTSTART:20261002T120000Z
DTEND:20261002T130000Z
TRANSP:TRANSPARENT
SUMMARY:Maybe lunch
END:VEVENT
END:VCALENDAR`;

describe("calendar free/busy", () => {
  const busy = parseIcsBusy(ICS, new Date("2026-09-28T00:00:00Z"), new Date("2026-10-10T00:00:00Z"));
  const iso = busy.map((b) => new Date(b.start).toISOString()).sort();

  it("reads one-off and recurring events, with a moved occurrence", () => {
    expect(iso).toEqual([
      "2026-09-29T14:00:00.000Z",
      "2026-10-01T23:00:00.000Z",
      "2026-10-06T18:00:00.000Z", // the moved one, not 14:00
      "2026-10-13T14:00:00.000Z",
    ].filter((d) => d < "2026-10-10"));
  });
  it("skips all-day and 'free' events, and keeps no titles", () => {
    expect(JSON.stringify(busy)).not.toMatch(/dentist|Birthday|lunch/i);
    expect(busy.every((b) => Object.keys(b).sort().join() === "end,start")).toBe(true);
  });
});

describe("calendar links", () => {
  it("only accepts the big calendar hosts over https", () => {
    expect(normalizeIcsUrl("webcal://p42-caldav.icloud.com/published/2/abc")).toBe("https://p42-caldav.icloud.com/published/2/abc");
    expect(normalizeIcsUrl("https://calendar.google.com/calendar/ical/x/private-y/basic.ics")).toMatch(/^https:\/\/calendar\.google\.com/);
    expect(normalizeIcsUrl("http://calendar.google.com/x.ics")).toBeNull();
    expect(normalizeIcsUrl("https://127.0.0.1/x.ics")).toBeNull();
    expect(normalizeIcsUrl("https://localhost:8080/x.ics")).toBeNull();
    expect(normalizeIcsUrl("https://evil.example.com/x.ics")).toBeNull();
  });
});

describe("time zones", () => {
  it("turns a wall-clock time in a zone into the right instant (with DST)", () => {
    expect(zoned(2026, 10, 1, 19, 0, "America/New_York").toISOString()).toBe("2026-10-01T23:00:00.000Z"); // EDT
    expect(zoned(2026, 12, 1, 19, 0, "America/New_York").toISOString()).toBe("2026-12-02T00:00:00.000Z"); // EST
    expect(slotLabel(new Date("2026-10-01T23:00:00Z"), "America/New_York")).toBe("Thu, Oct 1 · 7 PM");
  });
});

describe("places", () => {
  it("knows what kind of place a plan needs", () => {
    expect(venueKindOf("Get tacos Friday")).toBe("food");
    expect(venueKindOf("Hawks game")).toBe("event");
    expect(venueKindOf("Bowling night")).toBe("activity");
    expect(venueKindOf("Study session")).toBeNull();
  });
  it("finds the middle, rounded to ~1 km", () => {
    expect(middle([{ lat: 33.7, lng: -84.4 }, { lat: 33.9, lng: -84.2 }])).toEqual({ lat: 33.8, lng: -84.3 });
  });
});
