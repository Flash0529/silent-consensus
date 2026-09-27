// "Your Hush" standing preferences, kept in this browser until accounts ship (spec §3.2).

export type Tone = "warm" | "playful" | "direct";
export type Length = "brief" | "balanced" | "chatty";
export type Proactivity = "ask" | "gentle" | "proactive";
export type Drinks = "yes" | "sometimes" | "no";

export type Profile = {
  you: string;
  botName: string;
  color: string;
  tone: Tone;
  length: Length;
  proactivity: Proactivity;
  emoji: boolean;
  quietHours: boolean;
  quietFrom: string;
  quietTo: string;
  diet: string[];
  allergies: string[];
  cuisines: string[];
  spice: number;
  drinks: Drinks;
  budget: number; // dollars; 0 means no set limit
  stepFree: boolean;
  travel: number; // minutes
  vibe: string[];
  times: string[];
  workShare: string[];
};

export const DEFAULT_PROFILE: Profile = {
  you: "",
  botName: "Hush",
  color: "#5B3DF5",
  tone: "warm",
  length: "balanced",
  proactivity: "gentle",
  emoji: false,
  quietHours: true,
  quietFrom: "22:00",
  quietTo: "08:00",
  diet: [],
  allergies: [],
  cuisines: [],
  spice: 1,
  drinks: "yes",
  budget: 30,
  stepFree: false,
  travel: 30,
  vibe: [],
  times: [],
  workShare: ["diet", "allergies", "access"],
};

export const BOT_COLORS = [
  { name: "Violet", value: "#5B3DF5" },
  { name: "Ember", value: "#F0643C" },
  { name: "Ocean", value: "#1F7AE0" },
  { name: "Fern", value: "#2E9D5B" },
  { name: "Rose", value: "#E0457B" },
  { name: "Silver", value: "#AEAEB2" },
];

export const DIETS = [
  "Vegetarian",
  "Vegan",
  "Pescatarian",
  "Halal",
  "Kosher",
  "Gluten-free",
  "Dairy-free",
  "No pork",
  "No beef",
  "Low sodium",
];
export const ALLERGIES = ["Peanuts", "Tree nuts", "Shellfish", "Fish", "Eggs", "Soy", "Sesame", "Wheat"];
export const CUISINES = [
  "Mexican",
  "Thai",
  "Indian",
  "Japanese",
  "Korean",
  "Chinese",
  "Vietnamese",
  "Italian",
  "Mediterranean",
  "Middle Eastern",
  "Ethiopian",
  "Soul food",
  "BBQ",
  "Caribbean",
  "Pizza",
  "Burgers",
];
export const VIBES = ["Chill", "Lively", "Outdoors", "Cozy", "Adventurous", "Artsy", "Active", "Late night"];
export const TIMES = ["Weekday evenings", "Weekend days", "Weekend nights", "Mornings", "Last minute is fine"];
export const SPICE = ["No heat", "Mild", "Medium", "Bring the fire"];
export const WORK_FIELDS = [
  { key: "budget", label: "Budget" },
  { key: "diet", label: "Diet" },
  { key: "allergies", label: "Allergies" },
  { key: "drinks", label: "Drinking" },
  { key: "access", label: "Access needs" },
  { key: "times", label: "Availability" },
];

export const STORAGE_KEY = "qc.profile.v1";

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_PROFILE, ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}

export function clearProfile() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

const list = (xs: string[], max = 3) => {
  const a = xs.slice(0, max);
  if (a.length <= 1) return a.join("");
  return `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
};

function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return m ? `${hh}:${String(m).padStart(2, "0")} ${ampm}` : `${hh} ${ampm}`;
}

/** The bot's side of a sample chat, written from the profile. */
export function previewMessages(p: Profile): string[] {
  const name = p.botName.trim() || "Hush";
  const you = p.you.trim();
  const hi = you ? ` ${you}` : "";
  const e = (s: string) => (p.emoji ? ` ${s}` : "");
  const out: string[] = [];

  const greet = {
    warm: `Hi${hi}! I'm ${name}. Anything you tell me stays between us.${e("🤍")}`,
    playful: `Hey${hi}! ${name} here, your group's secret planning sidekick.${e("🕵️")}`,
    direct: `${name} here. I plan around your limits and keep them private.`,
  }[p.tone];
  const extra = {
    warm: " No need to explain anything. I just want Saturday to work for you.",
    playful: " Think of me as the friend who handles the awkward parts.",
    direct: " Two quick checks and you're done.",
  }[p.tone];
  out.push(p.length === "chatty" ? greet + extra : p.length === "brief" ? greet.split(".")[0] + "." : greet);

  const budget = p.budget > 0 ? `under $${p.budget}` : "no set limit";
  out.push(
    {
      warm: `Omar's planning Saturday. Still comfortable with ${budget}?`,
      playful: `Saturday's brewing. Still ${budget}, or feeling fancy?${e("✨")}`,
      direct: `Saturday plan. Budget still ${budget}?`,
    }[p.tone],
  );

  const food: string[] = [];
  if (p.cuisines.length) food.push(`${list(p.cuisines)} spots`);
  const needs = [...p.diet, ...p.allergies.map((a) => `no ${a.toLowerCase()}`)];
  if (needs.length)
    food.push(
      `${food.length ? "that are " : "places that are "}${list(
        needs.map((n) => n.toLowerCase()),
        4,
      )}`,
    );
  if (food.length) {
    out.push(
      {
        warm: `I'll lean toward ${food.join(" ")}.${p.drinks === "no" ? " And somewhere that isn't built around drinks." : ""}`,
        playful: `Noted: ${food.join(" ")}.${p.spice >= 3 ? " Extra spicy, obviously." : ""}${e("🌶️")}`,
        direct: `Filtering for ${food.join(" ")}.`,
      }[p.tone],
    );
  } else if (p.length !== "brief") {
    out.push(p.tone === "direct" ? "Food: open to anything." : "Open to any food? Easy, I'll keep options wide.");
  }

  if (p.length === "chatty" && p.stepFree) {
    out.push(p.tone === "direct" ? "Step-free only. Got it." : "And I'll only pick places with step-free entry.");
  }
  return out;
}

/** The chips shown on the "Here's what I'll plan around" card. */
export function standingChips(p: Profile): string[] {
  const c: string[] = [];
  c.push(p.budget > 0 ? `Under $${p.budget}` : "No set budget");
  c.push(...p.diet);
  c.push(...p.allergies.map((a) => `No ${a.toLowerCase()}`));
  if (p.drinks === "no") c.push("Doesn't drink");
  if (p.drinks === "sometimes") c.push("Light on drinks");
  if (p.stepFree) c.push("Step-free places only");
  c.push(`Within ${p.travel} min`);
  c.push(...p.vibe.slice(0, 2));
  c.push(...p.times.slice(0, 2));
  return c;
}

export function behaviorLine(p: Profile) {
  const pro = { ask: "Only when you ask", gentle: "Gentle check-ins", proactive: "Checks in whenever plans shift" }[
    p.proactivity
  ];
  const q = p.quietHours ? `Quiet ${fmtTime(p.quietFrom)} to ${fmtTime(p.quietTo)}` : "No quiet hours";
  return `${pro} · ${q}`;
}
