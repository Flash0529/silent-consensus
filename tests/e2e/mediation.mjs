// End-to-end: full mediation story (seed → 4 simulated interviews → way forward → tweak vote → follow-up → replan → agree).
// Needs the dev server running with DEMO_MODE=true and a working AI key. Run: npm run test:e2e:mediation
const B = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const j = async (path, init = {}, as) => {
  const r = await fetch(B + path, { ...init, headers: { "Content-Type": "application/json", ...(as ? { "x-demo-as": as } : {}) } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${path} ${r.status} ${JSON.stringify(body)}`);
  return body;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const assert = (c, m) => { if (!c) { console.log("  ✗ FAIL:", m); process.exitCode = 1; } else console.log("  ✓", m); };

const seed = await j("/api/demo/seed", { method: "POST", body: JSON.stringify({ story: "mediation" }) });
console.log("seeded", seed.slug);
const byName = Object.fromEntries(seed.members.map((m) => [m.name, m.id]));
await Promise.all(seed.members.map(async (m) => {
  for (let t = 0; t < 18; t++) {
    const r = await j("/api/demo/simulate", { method: "POST", body: JSON.stringify({ memberId: m.id }) });
    if (r.error) console.log(`  ${m.name} error: ${r.error}`);
    if (r.done) { console.log(`  ${m.name} done after ${t + 1} turns`); return; }
  }
  console.log(`  ${m.name} NOT done`);
}));
for (const m of seed.members) {
  const chat = await j(`/api/me/chat?c=${seed.slug}`, {}, m.id);
  console.log(`\n--- ${m.name}`);
  for (const x of chat.messages) console.log(`  ${x.role === "HUSH" ? "H" : m.name[0]}: ${x.content.replace(/\n/g, " / ")}${x.chips ? `  {${x.chips.join(" | ")}}` : ""}`);
}
let g;
for (let i = 0; i < 90; i++) {
  g = await j(`/api/circles/${seed.slug}`);
  if (g.status === "PROPOSED" || g.planningStage === "FAILED" || g.status === "PAUSED") break;
  await sleep(2000);
}
console.log("\n--- card", JSON.stringify(g.plan?.card, null, 1));
const tr = await j(`/api/demo/trace?c=${seed.slug}`);
for (const t of tr.traces.filter((t) => t.task !== "interview" && t.task !== "persona")) console.log(`  [${t.providerLabel}] ${t.label} ${t.ms}ms`);
assert(g.status === "PROPOSED", `way forward proposed (${g.status}/${g.planningStage})`);
assert(g.plan?.leakCheckPassed, "leak check passed");
const card = JSON.stringify(g.plan?.card ?? {}).toLowerCase();
for (const bad of ["second job", "money", "anxiety", "anxious", "keeping score", "embarrass", "resent", "omar", "maya", "priya", "jordan", "shift"])
  assert(!card.includes(bad), `card has no "${bad}"`);
const notes = {};
for (const n of Object.keys(byName)) notes[n] = (await j(`/api/me/share?c=${seed.slug}`, {}, byName[n])).share;
console.log("\n--- Maya's private brief", JSON.stringify(notes.Maya.brief, null, 1));
for (const n of Object.keys(byName)) {
  const others = Object.keys(byName).filter((x) => x !== n);
  assert(!others.some((o) => JSON.stringify(notes[n].brief).includes(o)), `${n}'s brief names no one else`);
}
// Tweak vote → private follow-up, then replan by organizer
await j(`/api/me/vote?c=${seed.slug}`, { method: "POST", body: JSON.stringify({ choice: "TWEAK" }) }, byName.Omar);
let chat = await j(`/api/me/chat?c=${seed.slug}`, {}, byName.Omar);
const last = chat.messages.at(-1);
assert(last.topic === "followup" && last.options?.length, "Omar gets a private follow-up with options");
const fr = await j(`/api/me/chat?c=${seed.slug}`, { method: "POST", body: JSON.stringify({ text: "Could the dishes rotate daily instead of weekly?" }) }, byName.Omar);
assert(fr.messages.at(-1).topic === "followup-done", "follow-up reply acknowledged");
g = await j(`/api/circles/${seed.slug}`);
assert(g.plan.voteCounts.tweak === 1 && !JSON.stringify(g).includes("daily"), "group sees a count, not the reason");
await j(`/api/circles/${seed.slug}/plan`, { method: "POST", body: JSON.stringify({ replan: true }) }, byName.Jordan);
for (let i = 0; i < 90; i++) { g = await j(`/api/circles/${seed.slug}`); if (g.status === "PROPOSED" && g.plan.version === 2) break; await sleep(2000); }
assert(g.plan.version === 2 && g.plan.voteCounts.in === 0, "second draft replaces the first and resets votes");
let second;
try { await j(`/api/circles/${seed.slug}/plan`, { method: "POST", body: JSON.stringify({ replan: true }) }, byName.Jordan); second = "allowed"; } catch (e) { second = e.message; }
assert(second.includes("409"), "only one replan allowed");
try { await j(`/api/circles/${seed.slug}/plan`, { method: "POST", body: JSON.stringify({}) }, byName.Maya); } catch (e) { assert(e.message.includes("403"), "non-organizer can't trigger planning"); }
for (const n of Object.keys(byName)) await j(`/api/me/vote?c=${seed.slug}`, { method: "POST", body: JSON.stringify({ choice: "IN" }) }, byName[n]);
g = await j(`/api/circles/${seed.slug}`);
assert(g.status === "CONFIRMED", "everyone agreed → confirmed");
console.log("slug", seed.slug);

console.log(process.exitCode ? "\nE2E FAILED" : "\nE2E PASSED");
