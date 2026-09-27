// End-to-end: full hangout story (seed → 4 simulated interviews → plan → votes → chip-in → share → mock pay).
// Needs the dev server running with DEMO_MODE=true and a working AI key. Run: npm run test:e2e:hangout
const B = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const j = async (path, init = {}, as) => {
  const r = await fetch(B + path, { ...init, headers: { "Content-Type": "application/json", ...(as ? { "x-demo-as": as } : {}), ...(init.headers || {}) } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${path} ${r.status} ${JSON.stringify(body)}`);
  return body;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const assert = (cond, msg) => { if (!cond) { console.log("  ✗ FAIL:", msg); process.exitCode = 1; } else console.log("  ✓", msg); };

const seed = await j("/api/demo/seed", { method: "POST", body: JSON.stringify({ story: "hangout" }) });
console.log("seeded", seed.slug);
const byName = Object.fromEntries(seed.members.map((m) => [m.name, m.id]));

// Interviews in parallel, one turn at a time per persona.
await Promise.all(seed.members.map(async (m) => {
  for (let t = 0; t < 18; t++) {
    const r = await j("/api/demo/simulate", { method: "POST", body: JSON.stringify({ memberId: m.id }) });
    if (r.error) console.log(`  ${m.name} turn error: ${r.error}`);
    if (r.done) { console.log(`  ${m.name} done after ${t + 1} turns`); return; }
  }
  console.log(`  ${m.name} NOT done after 14 turns`);
}));

// Print each member's transcript
for (const m of seed.members) {
  const chat = await j(`/api/me/chat?c=${seed.slug}`, {}, m.id);
  console.log(`\n--- ${m.name}'s private chat`);
  for (const x of chat.messages) console.log(`  ${x.role === "HUSH" ? "Hush" : m.name}: ${x.content.replace(/\n/g, " / ")}${x.options ? `  [${x.options.join(" | ")}]` : ""}${x.chips ? `  {${x.chips.join(" | ")}}` : ""}`);
}

// Wait for planning
let g;
for (let i = 0; i < 90; i++) {
  g = await j(`/api/circles/${seed.slug}`);
  if (g.status === "PROPOSED" || g.planningStage === "FAILED") break;
  if (i % 5 === 0) console.log(`  status ${g.status} stage ${g.planningStage} found ${g.foundCount}`);
  await sleep(2000);
}
console.log("\n--- group view:", JSON.stringify(g, null, 1));
const trace = await j(`/api/demo/trace?c=${seed.slug}`);
console.log("\n--- trace"); for (const t of trace.traces) console.log(`  [${t.providerLabel}${t.model ? " " + t.model : ""}] ${t.label} ${t.ms}ms ${t.ok ? "" : "FAIL"}`);

assert(g.status === "PROPOSED", "plan proposed");
assert(g.foundCount === 9, `hard filter found 9 (got ${g.foundCount})`);
assert(g.plan?.leakCheckPassed === true, "leak check passed");
const groupJson = JSON.stringify(g);
for (const bad of ["1500", "4000", "3000", "3500", "$15", "wheelchair", "sober", "drink", "skipping", "halal food", "budgetCap", "privateNote"])
  assert(!groupJson.includes(bad), `group view has no "${bad}"`);

// Everyone votes IN
for (const n of ["Omar", "Maya", "Priya", "Jordan"]) await j(`/api/me/vote?c=${seed.slug}`, { method: "POST", body: JSON.stringify({ choice: "IN" }) }, byName[n]);
const shares = {};
for (const n of ["Omar", "Maya", "Priya", "Jordan"]) shares[n] = (await j(`/api/me/share?c=${seed.slug}`, {}, byName[n])).share;
console.log("\n--- shares before chip-in", Object.fromEntries(Object.entries(shares).map(([n, s]) => [n, s.money])));
const per = g.plan.perPersonCents;
console.log("per person", per);

const chatO = await j(`/api/me/chat?c=${seed.slug}`, {}, byName.Omar);
console.log("Omar chipIn state", chatO.chipIn);
const chatM = await j(`/api/me/chat?c=${seed.slug}`, {}, byName.Maya);
assert(chatM.chipIn === null, "Maya (shortfall) sees no chip-in card");

if (per > 1500) {
  const need = per - 1500;
  // Omar and Priya chip in the suggestion
  const a1 = await j(`/api/me/chipin?c=${seed.slug}`, { method: "POST", body: JSON.stringify({ amountCents: chatO.chipIn.suggestCents }) }, byName.Omar);
  console.log("Omar chip-in →", a1);
  const chatP = await j(`/api/me/chat?c=${seed.slug}`, {}, byName.Priya);
  console.log("Priya chipIn state", chatP.chipIn);
  if (chatP.chipIn?.open) {
    const a2 = await j(`/api/me/chipin?c=${seed.slug}`, { method: "POST", body: JSON.stringify({ amountCents: chatP.chipIn.suggestCents }) }, byName.Priya);
    console.log("Priya chip-in →", a2);
  }
  const chatJ = await j(`/api/me/chat?c=${seed.slug}`, {}, byName.Jordan);
  if (chatJ.chipIn?.open) {
    const a3 = await j(`/api/me/chipin?c=${seed.slug}`, { method: "POST", body: JSON.stringify({ amountCents: chatJ.chipIn.suggestCents }) }, byName.Jordan);
    console.log("Jordan chip-in →", a3);
  }
  for (const n of ["Omar", "Maya", "Priya", "Jordan"]) shares[n] = (await j(`/api/me/share?c=${seed.slug}`, {}, byName[n])).share;
  console.log("\n--- shares after chip-in", Object.fromEntries(Object.entries(shares).map(([n, s]) => [n, s.money])));
  assert(shares.Maya.money.finalCents === 1500, `Maya pays exactly $15 (got ${shares.Maya.money.finalCents})`);
  assert(shares.Maya.money.coveredCents === need, `Maya covered ${need}`);
  const total = Object.values(shares).reduce((s, x) => s + x.money.finalCents, 0);
  assert(total === per * 4, `total collected equals plan cost (${total} vs ${per * 4})`);
  const mayaJson = JSON.stringify(shares.Maya);
  assert(!/Omar|Priya|Jordan|fromMember/.test(mayaJson), "Maya's share names no helper");
}
g = await j(`/api/circles/${seed.slug}`);
assert(g.status === "CONFIRMED", `circle confirmed (got ${g.status})`);
assert(!JSON.stringify(g).includes("pool"), "group view says nothing about the pool");
await j(`/api/me/pay?c=${seed.slug}`, { method: "POST" }, byName.Maya);
assert((await j(`/api/me/share?c=${seed.slug}`, {}, byName.Maya)).share.paid, "mock pay recorded");
console.log("\nslug:", seed.slug);

console.log(process.exitCode ? "\nE2E FAILED" : "\nE2E PASSED");
