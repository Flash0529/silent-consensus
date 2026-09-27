import raw from "@/data/venues.json";

export type Venue = {
  id: string;
  label: string;
  name: string;
  kind: string;
  area: string;
  lat: number;
  lng: number;
  servesMeal: boolean;
  diets: string[];
  alcoholFocus: "none" | "optional" | "bar";
  stepFreeEntry: boolean;
  accessibleRestroom: boolean;
  noise: "quiet" | "moderate" | "loud";
  outdoor: boolean;
  hours: { open: string; close: string };
  items: { label: string; cents: number }[];
  note: string;
  sourceUrl: string | null;
  verified: boolean;
};

export const VENUES = raw as Venue[];
export const venueById = (id: string) => VENUES.find((v) => v.id === id);
export const venueCost = (v: Venue) => v.items.reduce((s, i) => s + i.cents, 0);
