// End-to-end: opt-in "remember me" on real device cookies (no demo impersonation): opt in, another phone typing
// the same name sees nothing, one-tap return, forget this device. Needs the dev server and an AI key. Run: npm run test:e2e:remember
const B = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const jar = () => ({ c: {} });
const call = async (J, path, init = {}) => {
  const cookie = Object.entries(J.c).map(([k, v]) => `${k}=${v}`).join("; ");
  const r = await fetch(B + path, { ...init, redirect: "manual", headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) } });
  for (const sc of r.headers.getSetCookie()) {
    const [kv, ...attrs] = sc.split(";");
    const [k, v] = kv.split("=");
    if (/max-age=0|expires=thu, 01 jan 1970/i.test(attrs.join(";")) || v === "") delete J.c[k.trim()];
    else J.c[k.trim()] = v;
  }
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; } catch { return { status: r.status, body: text }; }
};
const assert = (c, m) => { if (!c) { console.log("  ✗ FAIL:", m); process.exitCode = 1; } else console.log("  ✓", m); };
// A plan one week out, 6–11 PM.
const start = new Date(Date.now() + 7 * 86400000);
start.setUTCHours(22, 0, 0, 0);
const end = new Date(start.getTime() + 5 * 3600000);
const newCircle = async (J, name) =>
  (await call(J, "/api/circles", { method: "POST", body: JSON.stringify({ organizerName: name, title: "Saturday night", activity: "dinner", area: "Midtown Atlanta", windowStart: start.toISOString(), windowEnd: end.toISOString() }) })).body.slug;

const org = jar(), maya = jar();
// Plan 1: Maya is new.
const s1 = await newCircle(org, "Omar");
await call(maya, `/api/circles/${s1}/join`, { method: "POST", body: JSON.stringify({ name: "Maya" }) });
let chat = (await call(maya, `/api/me/chat?c=${s1}`)).body;
assert(chat.messages.at(-1).topic === "budget", "first-timer gets the budget question");
const answers = { budget: "Under 15 honestly.", food: "Anything's fine", drinks: "Drinks are fine", access: "No access needs", timing: "Free all evening", vibe: "Outdoors if it's nice" };
for (let t = 0; t < 12; t++) {
  const last = chat.messages.at(-1);
  if (last.topic === "confirm") break;
  const text = answers[last.topic] ?? (last.options?.[0] ?? "Sounds good");
  const r = (await call(maya, `/api/me/chat?c=${s1}`, { method: "POST", body: JSON.stringify({ text }) })).body;
  if (r.error) { console.log("  turn error", r.error); await call(maya, `/api/me/chat?c=${s1}`, { method: "POST", body: JSON.stringify({ retry: true }) }); }
  chat = (await call(maya, `/api/me/chat?c=${s1}`)).body;
}
const confirmMsg = chat.messages.at(-1);
console.log("  confirm chips:", confirmMsg.chips);
assert(confirmMsg.topic === "confirm", "reached the confirm step");
let r = (await call(maya, `/api/me/chat?c=${s1}`, { method: "POST", body: JSON.stringify({ optionIndex: 0 }) })).body;
assert(r.messages.at(-1).topic === "remember", "offered to remember after confirming");
assert(!maya.c.qc_profile, "nothing saved before opting in");
r = (await call(maya, `/api/me/chat?c=${s1}`, { method: "POST", body: JSON.stringify({ optionIndex: 0 }) })).body;
assert(r.messages.at(-1).topic === "remember-done", "opt-in acknowledged");
assert(!!maya.c.qc_profile, "profile cookie set on Maya's phone");

// Someone else typing "Maya" on another phone gets nothing.
const impostor = jar();
const s2 = await newCircle(org, "Omar");
const joinHtmlImpostor = (await call(impostor, `/j/${s2}`)).body;
assert(!String(joinHtmlImpostor).includes("Welcome back"), "another phone isn't welcomed back");
await call(impostor, `/api/circles/${s2}/join`, { method: "POST", body: JSON.stringify({ name: "Maya" }) });
chat = (await call(impostor, `/api/me/chat?c=${s2}`)).body;
assert(chat.messages.at(-1).topic === "budget" && !JSON.stringify(chat).includes("Up to $15"), "typing the name 'Maya' reveals nothing");

// Plan 2 on Maya's phone: one tap.
const s3 = await newCircle(org, "Omar");
const joinHtml = String((await call(maya, `/j/${s3}`)).body);
assert(joinHtml.includes("Welcome back") && joinHtml.includes('value="Maya"'), "join sheet pre-fills Maya and says welcome back");
await call(maya, `/api/circles/${s3}/join`, { method: "POST", body: JSON.stringify({ name: "Maya" }) });
chat = (await call(maya, `/api/me/chat?c=${s3}`)).body;
const ret = chat.messages.at(-1);
console.log("  returning card:", ret.content.replace(/\n/g, " / "), ret.chips);
assert(ret.topic === "returning" && ret.chips.includes("Up to $15"), "opens with 'Still right?' and saved chips");
r = (await call(maya, `/api/me/chat?c=${s3}`, { method: "POST", body: JSON.stringify({ optionIndex: 0 }) })).body;
chat = (await call(maya, `/api/me/chat?c=${s3}`)).body;
assert(chat.me.interviewStatus === "DONE", "one tap finishes the interview");
assert(!chat.messages.some((m) => m.topic === "remember"), "not asked to remember again");
const g = (await call(jar(), `/api/circles/${s3}`)).body;
assert(!JSON.stringify(g).includes("1500") && !JSON.stringify(g).includes("profile"), "group view shows nothing saved");

// Forget this device.
const f = (await call(maya, "/api/me/forget", { method: "POST" })).body;
console.log("  forget →", f);
assert(f.profileDeleted === true, "saved preferences deleted");
assert(!maya.c.qc_profile, "profile cookie cleared");
const s4 = await newCircle(org, "Omar");
assert(!String((await call(maya, `/j/${s4}`)).body).includes("Welcome back"), "after forgetting, no welcome back");

console.log(process.exitCode ? "\nE2E FAILED" : "\nE2E PASSED");
