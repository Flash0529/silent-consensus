> **Historical document (HackGT 13).** The product has since been renamed **Silent Consensus** and rebuilt messaging-first (accounts, chats, a private Hush chat, real places and events, Stripe chip-in, business admin). See [`README.md`](../README.md) for how it works today and [`docs/HANDOFF.md`](HANDOFF.md) for status.

# Claude Code brief: Quiet Consensus (HackGT 13)

Paste this whole file into Claude Code from the root of an empty repo. Put the `design/` folder from this handoff in the repo root first.

---

## 0. How to work (read first)

You are the lead engineer on a 2-person hackathon build. Hacking ends **Sunday Sep 27, 2026 at 8:00 AM ET**; we submit by **6:00 AM**. It is Saturday early morning now. Optimize for a reliable, impressive 2–3 minute demo, not for scale.

1. **Plan first.** Before writing app code, create `PLAN.md` with: architecture diagram (mermaid), file tree, Prisma schema, API routes, AI prompts and JSON schemas, the chip-in math, the privacy model, milestone checklist with time boxes, risks with fallbacks, and the demo script. Then **stop and wait for me to reply "go"**.
2. Ask at most 3 questions, and only if something truly blocks you. Otherwise use the defaults in this brief.
3. After "go", build milestone by milestone (section 10). After each milestone: run it, fix errors, commit with a clear message, and give me a 3-line status (done, what's next, anything I must do by hand, like adding an API key).
4. Anything not in "Must have" is a stretch. Do not start a stretch until every Must is demo-ready.
5. Hackathon rules: all project code is written during the event. List every library you use in the README.

---

## 1. What we're building

**Quiet Consensus** is a web app where an AI planner named **Hush** privately asks each friend in a group what they can't say in the group chat (budget, food, drinks, getting around, timing), then proposes one plan everyone can accept, explains it without revealing anyone's reasons, and quietly balances the cost with an anonymous chip-in.

Tagline: **Plans everyone can say yes to.**

### The problem (use these in the README and write-up, with links)

- 67% of Americans declined social events in the past two years primarily because of cost, and 56% never told loved ones that money was the reason ([CFP Board, survey Jan 2026, n=1,138](https://www.cfp.net/news/2026/03/financial-fomo-quietly-straining-american-relationships)).
- 69% of Americans have declined a social outing because it was too expensive, and 36% have had a friendship end over money ([LendingTree, July 2025, n=2,000](https://www.lendingtree.com/credit-cards/study/friends-money-report/)).
- Loneliness affects 1 in 6 people worldwide and is linked to more than 871,000 deaths a year ([WHO, June 2025](https://who.int/news/item/30-06-2025-social-connection-linked-to-improved-heath-and-reduced-risk-of-early-death)).
- 12% of Americans reported no close friends in 2021, up from 3% in 1990 ([Survey Center on American Life](https://www.americansurveycenter.org/research/the-state-of-american-friendship-change-challenges-and-loss/)).

Group chats plan for the loudest person. People with a quiet limit (money above all, but also a religious diet, sobriety, or a disability) just say "I'm busy" and slowly drop out. Quiet Consensus lets them stay in without explaining themselves.

### Demo story (seed this exact group)

| Friend | Role | Private limit (only Hush knows) |
|---|---|---|
| Omar | Organizer | Eats halal; budget up to $40 |
| Maya | **Hero** | Budget under $15; has skipped the last few dinners |
| Priya | Friend | Doesn't drink; budget up to $30 |
| Jordan | Friend | Uses a wheelchair, needs step-free places; free after 6 PM; budget up to $35 |

Target outcome: a Saturday plan like "Picnic + food truck night" (food truck dinner $16, dessert $5, picnic supplies $4) with a $25 base share. Maya's share drops to exactly her $15 limit because a quiet pool covered her $10 shortfall (Omar $5, Priya $5), and nobody learns who needed what.

### How we're judged (design every feature against this)

We enter the **Social Good track** ("A Marina's Mission", Aramco) and the **Meta challenge** ("Bringing People Closer Together with AI"). Our team rubric: **originality, technical ability, social good, connection.**

Meta judges on:
1. How meaningfully it strengthens human connection
2. How essential and well integrated AI is
3. Originality
4. Strength of the working demo

Meta also requires: a working prototype, a 2–3 minute demo video, a **public** repo, and a short write-up covering who it's for, how it strengthens connection, and why AI is essential.

How each feature scores:

- **Connection:** private interviews get quiet people back into plans; the chip-in lets friends help without anyone losing face.
- **AI essential:** natural-language and voice elicitation, constraint extraction, plan composition, and the privacy leak check are impossible without models.
- **Originality:** the privacy-preserving explanation plus the anonymous chip-in. Group planners exist; none plan around what people can't say out loud.
- **Technical ability:** a hybrid pipeline (deterministic constraint filter + LLM composer + LLM leak judge), provider fallback, voice, and a live AI trace panel.
- **Social good:** financial exclusion from social life, plus dietary, sobriety, and accessibility needs.

---

## 2. Must have (the demo path)

Each item lists its acceptance check.

1. **Start a plan (organizer).** A chat-style flow where Hush asks what (dinner, hangout, and so on), when (date window), and area. Creates a Circle and shows an invite link plus QR code.
   - Check: Omar creates "Saturday night" and gets a link and QR in under 30 seconds.
2. **Join by link.** No accounts. A join sheet (design screen 2) asks for a first name and sets an httpOnly device cookie tied to a Member.
   - Check: 4 phones join the same circle from the QR code.
3. **Private interview chat.** Per member, Hush runs an adaptive 4–6 question interview: budget, food, drinks, getting around, timing, vibe. Every question offers 3–5 lettered quick replies (A–E, design screen 3) plus free text. Hush confirms what it heard in the member's words ("Here's what I'll plan around"), then marks the member done.
   - Check: Maya taps "Under $15", types one sentence, sees a warm reply, and the vault stores `budgetCapCents: 1500`.
4. **Voice replies.** The mic button records a voice note, transcribes it, shows the transcript in the bubble, and feeds it into the same extraction (design screen 4).
   - Check: Jordan says "I use a wheelchair, so step-free places only, and I'm free after six," and gets chips for "Step-free places only" and "Free after 6 PM".
5. **Group status.** Shows who has finished, never what they said, then a "Hush is planning" stepper (design screen 5) that reflects real pipeline stages.
6. **Planner.** Runs automatically when everyone is done, or when the organizer taps "Plan now". Hybrid pipeline in section 5. Produces a plan card (design screen 6) with stops, times, a group-safe "Why this works" list, and a "Checked: nothing anyone told Hush shows here" line that is only shown when the leak check passed.
7. **Privacy guard.** Group endpoints never return vault data or private messages (tested). Every group-facing string passes the leak check in section 5.4.
8. **Quiet chip-in.** Members with room in their budget privately see "Want to quietly help?" with $0 / $5 / $10 / Other (design screen 7). The pool is applied to shortfalls. Nobody sees who gave or who was helped.
9. **Your share + mock pay.** Each member sees only their own share, line items, and pool coverage (design screen 8). "Pay $X" opens a mock success sheet labelled "Demo payment. No real money moves."
10. **Vote.** Lettered options: A "I'm in", B "Different time", C "Tweak something". B and C trigger one private follow-up from Hush and one replan (max one iteration for the demo).
11. **Demo mode** (section 8): seed, reset, simulate personas, presenter view with 4 phones side by side, and an AI trace panel.

### Stretch (only after all Musts work on real phones)

- Share the final plan to WhatsApp or Messages with a prefilled text link.
- Web search for extra venue ideas through Meta's Responses API, labelled "unverified".
- Multilingual interviews (each friend chats in their own language; the plan stays in one shared language).
- "Delete my answers" button, plus auto-delete of the vault 24 hours after a plan is confirmed.

---

## 3. Stack (defaults; do not re-litigate)

- **Next.js 14+ App Router, TypeScript, Tailwind CSS, Framer Motion.** No component library needed; build the small set of components in section 7.
- **Postgres on Neon (free) + Prisma.** Deploy on **Vercel**. Local dev can use the same Neon database.
- **Live updates: SWR polling every 2 seconds** on group status and chat. No websockets.
- **Identity:** a signed device token in an httpOnly cookie per circle; no auth provider.
- **QR codes:** the `qrcode` package.
- **Validation:** Zod everywhere AI output or user input enters the system.
- **Tests:** Vitest for the chip-in math, the privacy serializer, and the leak-guard rules.

### Environment variables (`.env.example`)

```
DATABASE_URL=
APP_URL=http://localhost:3000
DEMO_MODE=true
COOKIE_SECRET=

# Meta Model API (primary)
MODEL_API_KEY=
META_BASE_URL=https://api.meta.ai/v1
META_MODEL=muse-spark-1.3
META_STT_MODEL=muse-voice-transcribe-1.0

# SpaceXAI / Grok (fallback; HackGT gives every hacker Grok credits)
XAI_API_KEY=
XAI_BASE_URL=https://api.x.ai/v1
XAI_MODEL=grok-4.7
XAI_STT_MODEL=grok-voice-transcribe-2.0
```

Keys stay server-side. Never ship a key to the client.

---

## 4. AI integration details (verified against the docs on Sep 26, 2026)

### 4.1 One LLM client, two providers

Both providers speak the OpenAI format, so use the `openai` npm SDK with a custom `baseURL`.

- **Meta Model API (primary):** base URL `https://api.meta.ai/v1`, `Authorization: Bearer $MODEL_API_KEY`, model `muse-spark-1.3`. Chat Completions at `POST /v1/chat/completions` supports `response_format` (structured output), `tools`, `stream`, and `reasoning_effort` (`minimal` | `low` | `medium` | `high` | `xhigh`). Web search is only on the Responses API, not Chat Completions. Docs: [quickstart](https://dev.meta.ai/docs/quickstart), [chat completions](https://dev.meta.ai/docs/protocols/chat-completions).
- **SpaceXAI Grok (fallback):** base URL `https://api.x.ai/v1`, `Authorization: Bearer $XAI_API_KEY`, model from `XAI_MODEL` (flagship is `grok-4.7`; call `GET /v1/models` once and switch to a faster model if one is listed). Structured outputs are supported. Docs: [overview](https://docs.x.ai/overview).

Write `lib/ai/client.ts` exporting:

```ts
callLLM<T>({ task, messages, schema, reasoningEffort, temperature }): Promise<{ data: T; provider: 'meta' | 'xai'; ms: number }>
```

Behavior:
- Try Meta first with a 20-second timeout. On a timeout, a 5xx, a 429, or output that fails Zod validation, retry once with a repair message, then fall back to Grok.
- Prefer `response_format: { type: 'json_schema', json_schema: {...} }` built from the Zod schema (use `zod-to-json-schema`). If a provider rejects `json_schema`, fall back to `{ type: 'json_object' }` plus Zod parsing.
- Log every call to an `AiTrace` row (task, provider, latency, ok, and for the planner the candidate counts). The presenter view shows these.
- Use `reasoningEffort: 'low'` for interview turns (speed) and `'medium'` for planning and the leak check.

### 4.2 Voice

- **Record WAV in the browser.** Meta's transcription endpoint accepts WAV only. Capture 16 kHz mono PCM with the Web Audio API (an AudioWorklet or `extendable-media-recorder` + `extendable-media-recorder-wav-encoder`) and encode WAV client-side. Test on iPhone Safari and Android Chrome.
- **Primary: Meta Muse Voice Transcribe.** `POST https://api.meta.ai/v1/asr/transcribe`, multipart form with two parts: `request` (JSON, content type `application/json`) = `{"model":"muse-voice-transcribe-1.0","audioEncoding":"WAV","mode":"PUSH_TO_TALK"}` and `audio` = the WAV file. Limits: 10 minutes, 32 MB. Docs: [transcribe](https://dev.meta.ai/docs/api-reference/voice/transcribe).
- **Fallback: Grok speech-to-text.** `POST https://api.x.ai/v1/stt`, multipart fields `model=grok-voice-transcribe-2.0` and `file`, optionally `language=en`. Not OpenAI-compatible. Accepts WAV, MP3, OGG, Opus, FLAC, AAC, MP4, M4A, MKV. Docs: [speech to text](https://docs.x.ai/developers/model-capabilities/audio/speech-to-text).
- **Last resort:** the browser Web Speech API, where available.
- Route: `POST /api/me/voice` (multipart) returns `{ transcript }`, then posts it to the chat pipeline as the member's message with `kind: VOICE`.

---

## 5. The AI pipeline (the part judges care about)

### 5.1 Interview agent (`lib/ai/interview.ts`)

System prompt essentials (write the full prompt in `lib/ai/prompts/interview.md`):
- Hush is warm, brief, and never judgmental. One question at a time, 1–2 short sentences per turn.
- Promise privacy in the first message: "This chat is just between us."
- Topic order: budget → food → drinks → getting around → timing → vibe → confirm. Skip anything already answered. Adapt follow-ups; never ask *why* someone has a limit.
- Every turn returns 3–5 lettered quick replies. The last option is usually an open one ("I'd rather explain", "Something else").
- If a member shares something serious that is beyond planning (for example a crisis), respond with care, point to 988 in the US, and do not store it in the vault.

Structured output (Zod) per turn:

```ts
{
  reply: string,                 // what Hush says next
  options: string[],             // 0–5 quick replies, rendered A–E
  topic: 'budget'|'food'|'drinks'|'access'|'timing'|'vibe'|'confirm'|'done',
  constraintUpdates: {
    budgetCapCents?: number | null,
    dietary?: string[],                          // e.g. ['halal','vegetarian','nut_allergy']
    alcohol?: 'fine' | 'prefer_none' | 'none' | null,
    stepFreeRequired?: boolean | null,
    availableWindows?: { day: string, start: string, end: string }[],
    noise?: 'quiet' | 'any' | null,
    maxTravelMinutes?: number | null,
    privateNote?: string | null                  // never shown to anyone
  },
  confirmChips?: string[],       // "Step-free places only", "Free after 6 PM"
  done: boolean
}
```

Merge `constraintUpdates` into the member's vault row on every turn.

### 5.2 Planner (`lib/ai/planner.ts`), hybrid by design

1. **Hard filter (deterministic code).** From `data/venues.json`, keep venues that satisfy every member's hard constraints: dietary coverage, alcohol (for anyone with `none`, exclude venues where drinking is the focus), step-free entry and accessible restroom if anyone needs it, open during the intersection of everyone's time windows, and within travel limits. Record counts for the trace (for example, 23 → 9).
2. **Compose (LLM).** Pass only the filtered venues (IDs and attributes) plus an anonymized, aggregated constraint summary: the lowest budget cap, the set of needs, and the time window, **with no names attached**. Ask for 2 candidate plans (2–3 stops, times, estimated cost per person). The model may only use venue IDs from the list; reject and retry if it invents one.
3. **Cost and chip-in (deterministic code, `lib/money/allocate.ts`).** See 5.3. A candidate is feasible when its total shortfall is covered by the group's headroom, capped at $10 suggested per helper. Among feasible candidates, pick the one that best fits the group's stated vibe and food preferences; break ties by lower total shortfall. A candidate with zero shortfall wins only if it fits the group about as well.
4. **Explain (LLM).** Generate the group-facing title and up to 3 "Why this works" bullets, plus a private note per member ("Fits what you told Hush").
5. **Leak check** (5.4). Regenerate the explanation up to 2 times with the judge's feedback. If it still fails, fall back to a safe template.
6. **Persist** the plan and each member's share. Update circle status to PROPOSED.

### 5.3 Quiet chip-in math (pure function with Vitest tests)

- Base share `s_i` = equal split of the plan's per-person cost (or per-item costs if you have them).
- Cap `c_i` from the vault (null means no stated cap).
- Shortfall `d_i = max(0, s_i − c_i)`; total need `D = Σ d_i`.
- Headroom `h_j = c_j == null ? Infinity : max(0, c_j − s_j)`.
- Members with `h_j > 0` privately see the chip-in card with a suggested amount of `min(h_j, D / helpers rounded up to the nearest $5)`. Cap each contribution so the pool never exceeds `D`, and close the card for everyone once the pool reaches `D`.
- When contributions total `P`, cover each shortfall proportionally: `cover_i = min(d_i, P · d_i / D)`.
- Final: `final_i = s_i − cover_i + chipIn_i`.
- If `P < D` when the organizer confirms, replan with a lower cost ceiling.
- Visibility rules: a recipient sees only their own coverage line ("A quiet group pool covered $10"). Contributors see the pool progress only as an aggregate. The group view shows nothing about the pool. Never store or show who covered whom.
- Tests: on a $25 base with caps Omar $40, Maya $15, Priya $30, Jordan $35, the shortfall is $10 (Maya only). When Omar and Priya each give $5, finals must be Maya $15, Omar $30, Priya $30, Jordan $25 (sum $100). Also test: no caps, zero contributions, and contributions larger than the need (refund the excess to contributors).

### 5.4 Leak guard (`lib/ai/guard.ts`)

Group-facing text (plan title, stop notes, "Why this works", vote follow-ups, status messages) must never reveal or attribute a private constraint.

- **Rule layer:** build a per-circle blocklist from vault data and names: budget numbers, sensitive words (money limits, alcohol or sobriety, health, disability, religion as a reason), and phrases from `privateNote`. Reject any sentence that names a member together with a need, or states a sensitive need as a reason. Venues may list neutral amenities (for example "Paved, step-free paths" or "Halal, veggie and dessert trucks").
- **LLM judge layer:** give the judge each member's private facts and the candidate group text, and ask: "Could any group member infer a specific person's private constraint from this text?" It returns `{ pass: boolean, leaks: { text, reason }[] }`.
- Both layers must pass. Show "Checked: nothing anyone told Hush shows here" only when they do. Log the result to the trace.
- Tests: "Since Priya doesn't drink, we skipped bars" must fail. "Picked to fit everyone's budget, food, and getting around" must pass.

---

## 6. Data model and routes

### Prisma (adjust names in PLAN.md if needed)

- `Circle` { id, slug, title, organizerId, area, windowStart, windowEnd, status: COLLECTING | PLANNING | PROPOSED | CONFIRMED, createdAt }
- `Member` { id, circleId, name, avatarColor, tokenHash, role: ORGANIZER | MEMBER, interviewStatus: NOT_STARTED | IN_PROGRESS | DONE, persona? (demo only) }
- `Message` { id, memberId, role: HUSH | MEMBER, kind: TEXT | OPTIONS | VOICE | CONFIRM | CHIPIN, content, options Json?, transcript?, createdAt } (private to one member)
- `Vault` { memberId (unique), budgetCapCents?, dietary String[], alcohol?, stepFreeRequired?, availableWindows Json?, noise?, maxTravelMinutes?, privateNote?, updatedAt } (private)
- `Plan` { id, circleId, version, title, stops Json, whyItWorks String[], leakCheckPassed Boolean, status, createdAt }
- `MemberShare` { id, planId, memberId, baseCents, coveredCents, chipInCents, finalCents, privateNote } (private to that member)
- `ChipIn` { id, planId, fromMemberId, amountCents } (never exposed through any API)
- `Vote` { id, planId, memberId, choice }
- `AiTrace` { id, circleId, task, provider, ms, ok, meta Json }

### Pages

| Design screen | Route |
|---|---|
| 1 · Welcome | `/` |
| Start a plan (reuses chat components) | `/new` |
| 2 · Join from a link | `/j/[slug]` |
| 3 · Private chat, 4 · Voice reply, 7 · Quiet chip-in | `/c/[slug]/chat` |
| 5 · Hush is planning, 6 · The plan | `/c/[slug]` |
| 8 · Your share | `/c/[slug]/share` |
| Presenter view | `/demo` |

### API

- `POST /api/circles` → `{ slug }`, sets the organizer cookie
- `POST /api/circles/[slug]/join` `{ name }` → sets the member cookie
- `GET /api/circles/[slug]` → group-safe view only (members, statuses, current plan's group fields)
- `GET | POST /api/me/chat` → the caller's own messages; POST sends text or an option, returns Hush's reply
- `POST /api/me/voice` → `{ transcript }`
- `POST /api/circles/[slug]/plan` → runs the planner (organizer only, or auto when all are done)
- `GET /api/me/share`, `POST /api/me/chipin`, `POST /api/me/vote`, `POST /api/me/pay` (mock)
- Demo only (require `DEMO_MODE=true`): `POST /api/demo/seed`, `POST /api/demo/reset`, `POST /api/demo/simulate`

**Privacy rule:** every group route serializes through one allowlist function, `toGroupSafe()`. Write a Vitest test that seeds a circle with vault data and private messages, serializes it, and asserts none of those strings appear in the output.

---

## 7. UI spec (from the design canvas; files in `design/`)

The `design/*.dc.html` files are the visual source of truth: 8 phone screens at 390×844. Treat them as reference markup. The `<x-dc>`, `<helmet>`, and script wrappers are design-tool markup; ignore those and copy the inline styles into Tailwind classes and components. The visual language is a clean, monochrome chat UI with floating round buttons, gray bubbles, and lettered option lists. The Hush mascot is original to us.

### Tokens (put these in `tailwind.config.ts`)

- **Font:** Geist 400/500/600/700 via `next/font/google`.
- **Colors:** ink `#0B0B0C`, ink-2 `#3A3A3C`, muted `#6E6E73`, hairline `#E5E5EA`, divider `#EDEDF0`, surface `#FFFFFF`, bubble `#F2F2F3`, surface-2 `#F7F7F8`, control `#EDEDF0`, backdrop `#BDBDC2`, hush (accent) `#5B3DF5`.
- **Avatar pairs (background/text):** peach `#FFE3D3`/`#7A2E0E`, blue `#DCE9FF`/`#0B3D91`, green `#DDF3DC`/`#1E5B24`, lilac `#EDE4FF`/`#4B1FA6`.
- **Radii:** bubbles and cards 26px, inner option list 20px, sheet top corners 34px, sheet buttons 14px, pills 9999px, letter badge 8px.
- **Shadow for floating controls:** `0 6px 24px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.05)`.
- **Sizes:** floating buttons 52px, option rows 52px, primary pill 58px, composer input 56px, letter badge 28px, touch targets at least 44px.
- **Type:** titles 30–32px/700 with −0.02em tracking; card titles 22px/700; questions 18px/600; body 17px/1.45; secondary 15px; captions 13px.

### Components (`components/`)

`FloatingIconButton`, `BotPill` (mascot + "Hush" + lock "Private"), `GroupPill` (avatar stack + circle title), `HushBubble`, `MemberBubble`, `OptionCard` (question + lettered A–E rows with a selected state: black badge, check icon), `Composer` (+ button, input, mic button with an active state), `VoiceNoteBubble` (play, waveform, duration, transcript), `ConfirmChips`, `AvatarStack`, `MemberStatusGrid`, `PlanningStepper`, `PlanCard` (timeline + "Why this works" + leak-check line), `ChipInCard`, `ShareCard`, `PrimaryPill`, `Sheet`, `ScrollFade` (the white fade under the floating header).

### Hush mascot (an SVG component; viewBox `0 0 120 120`)

```html
<path d="M60 12c26.5 0 48 18.8 48 42s-21.5 42-48 42c-5.9 0-11.6-.9-16.8-2.6L22 104l5.6-18.2C18.1 78.1 12 66.7 12 54 12 30.8 33.5 12 60 12z" fill="#5B3DF5"/>
<path d="M40 55c3.4 4.8 11.6 4.8 15 0" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
<path d="M65 55c3.4 4.8 11.6 4.8 15 0" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
```

Use a thicker stroke (8) below 40px.

### Motion and layout

- Bubbles fade in and rise 8px over 180ms; options stagger by 40ms; a 3-dot typing indicator shows while Hush thinks; the plan card reveals with a small scale-up.
- Mobile first at 390px. On desktop, center a 430px column.
- Chat screens are bottom-anchored, with the floating header over a white scroll fade.
- Accessibility: real buttons and labels, aria-labels on icon buttons, WCAG AA contrast (the muted color is only for 13px and up on white or `#F7F7F8`).

---

## 8. Demo mode (this makes or breaks the video)

- **Seed** (`/api/demo/seed`): creates the Saturday-night circle with Omar, Maya, Priya, and Jordan, plus `data/personas.json` describing each persona's private limits from section 1.
- **Simulate** (`/api/demo/simulate`): for personas nobody is driving live, an LLM plays the persona and answers Hush turn by turn with 1.5–3 second delays, so the chats visibly fill in during the recording. Persona answers must stay consistent with `personas.json`.
- **Presenter view** (`/demo`): four phone frames side by side (iframes at 390×844, scaled to fit) for Omar, Maya, Priya, and Jordan, using `?as=<memberId>` (allowed only when `DEMO_MODE=true`), plus the group view and an **AI trace** side panel. The trace lists each step with provider, latency, and counts: "4 private chats read", "23 → 9 venues after hard filter", "2 candidates composed", "Cost balanced: shortfall $10", "Leak check: pass".
- **Reset** button, and a "Run the whole story" button that plays the script end to end.
- **Venues:** create `data/venues.json` with about 20 places around Midtown Atlanta and Georgia Tech. Fields: id, name, kind, area, lat, lng, costPerPersonCents, halal, vegetarian, alcoholFocus (`none` | `optional` | `bar`), stepFreeEntry, accessibleRestroom, noise, hours, sourceUrl, verified. Leave `verified: false` and tell me which attributes to confirm by phone or website before the demo. **Never let the model invent venue facts.** If we can't verify real places in time, label them as demo venues in the UI.

---

## 9. Deliverables (generate these; I'll edit)

- `README.md`: what it is, a screenshot row, setup, env vars, the architecture diagram, the privacy model, how AI is used, how to run the demo, and a list of libraries used.
- `WRITEUP.md` (Meta's short write-up, under 400 words): **who it's for** (friend groups, above all the person who keeps saying "I'm busy" because of money), **how it strengthens connection** (private interviews bring quiet people back; the anonymous chip-in lets friends help without anyone losing face), **why AI is essential** (open-ended and voice elicitation, extraction, composing plans under many constraints, and judging privacy leaks cannot be done with forms or rules alone). Add a Social Good paragraph with the cited stats from section 1.
- `DEMO_SCRIPT.md`, timed for 2:30:
  - 0:00–0:20: Hook. "Two in three Americans have skipped plans because of cost, and most never said why." Introduce Maya.
  - 0:20–0:45: Omar starts a plan; 4 phones join from the QR code.
  - 0:45–1:30: Private chats in the presenter view. Maya taps "Under $15"; Jordan sends a voice note; each person gets a private confirmation.
  - 1:30–2:05: The planning stepper and AI trace, then the plan reveal. Point at "Why this works" and the leak-check line: "No one had to say it."
  - 2:05–2:30: Priya quietly chips in $5; Maya's share lands at $15, exactly what she said she could do; everyone taps "I'm in". Close on the tagline.
- `DEVPOST.md`: inspiration, what it does, how we built it, challenges, accomplishments, what we learned, what's next.
- A public GitHub repo with an MIT license.

---

## 10. Milestones (times are ET; adjust in PLAN.md)

| By | Milestone | Done means |
|---|---|---|
| Sat 6:00 AM | M0 scaffold | Next.js, Tailwind tokens, Prisma + Neon, `.env.example`, deployed hello page on Vercel |
| Sat 8:30 AM | M1 circles | Create, join by link and QR, cookies, group status polling, UI shell components |
| Sat 12:00 PM | M2 interview | LLM client with fallback, interview agent, vault extraction, chat UI with options |
| Sat 1:30 PM | M3 voice | WAV recording, Meta transcription, Grok fallback, voice bubble, confirm chips |
| Sat 5:00 PM | M4 planner | Hard filter, compose, explain, leak guard, plan card, votes, one replan |
| Sat 6:30 PM | M5 money | Chip-in math + tests, chip-in card, share screen, mock pay |
| Sat 8:30 PM | M6 demo mode | Seed, simulate, presenter view, AI trace, reset |
| Sat 11:00 PM | M7 polish | Tested on 2+ real phones, motion, empty and error states, README, WRITEUP, DEMO_SCRIPT, DEVPOST |
| Sun 2:00 AM | Video | 2–3 minute video recorded and uploaded |
| Sun 6:00 AM | Submit | Devpost submitted with repo link, video, write-up |

If we fall behind, cut in this order: vote replanning, voice fallback chain (keep Meta only), simulate (drive all 4 phones by hand), organizer chat flow (use a simple form).

---

## 11. Guardrails

- No real payments, ever. Mock only.
- Never fabricate venue facts or statistics; cite sources in the write-up.
- Store the minimum; private data never leaves the member's own endpoints.
- Keep keys server-side; rate-limit AI routes per device token.
- Friendly error states: if both providers fail, Hush says "I'm having trouble thinking right now. Try again in a moment." and the UI never breaks.
- Before each milestone commit, run `npm run build` and the tests.

**Start now: write `PLAN.md`, then wait for "go".**
