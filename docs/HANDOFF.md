# Silent Consensus (formerly Quiet Consensus) — Handoff

> **Start here.** This is the living record of what exists, what was decided, and what is left.
> **Humans:** start at §0. **AI assistants (Claude):** start at "For AI assistants" just below.
> Claude Code loads this file automatically (via `CLAUDE.md`). Keep §7 (log) and §8 (to-do) current.
> Deeper references: `QUIET_CONSENSUS_SPEC.md` (product + business spec), `README.md` (architecture, AI pipeline,
> privacy model, route list), `PLAN.md` (original build plan with full planner/guard/chip-in specs),
> `docs/BRIEF.md` (hackathon brief and judging).

_Last updated: 2026-09-27 (evening): the 28-item overhaul. See §7 for the latest entry and README.md for the current product._

---

## For AI assistants (Claude): start here

You are picking up **Quiet Consensus** mid-hackathon from a previous Claude session. The owner's partner is now
driving. Do this, in order, before writing any code:

1. **Read this whole file.** Then skim `README.md` §3–§5 (stack, architecture, privacy model) and `AGENTS.md`
   (this Next.js 16 has breaking changes: read the relevant guide in `node_modules/next/dist/docs/` before writing
   Next code).
2. **Check the environment with the human.** There must be a `.env` in the project root (it is *not* in the zip;
   the owner shares it privately). Never ask the human to paste secret values into the chat; ask them to put the
   file in place, then check only whether variables are set (e.g. `grep -o '^[A-Z_]*=.' .env`).
3. **Verify the baseline:** `npm install`, then `npm test` (expect 83 passing; see §0 step 4 if the native-binding
   error appears) and `npx next build`. Report anything red before changing code.
4. **Ask which P0 items (§8) are done** (AI key, Twilio). Help with them first if not: they are config, no code.
5. **Then work §8 top to bottom**, starting at **P1 item 3, the planner**, unless the human says otherwise.
   For each item: propose a short plan, implement, add/keep tests green, verify in the browser, then **update §7
   (log) and §8 (to-do) in this file** so the next session isn't lost.

Rules you must not break:
- **Git:** do not commit, push, or `git init` without asking. The marketing site must not go into the same repo
  as the app (§2).
- **Privacy invariants (the product's core promise):** group-facing data only ever comes from `toGroupSafe()` in
  `lib/serialize.ts` (explicit allowlist; `tests/serialize.test.ts` guards it); `/api/me/*` routes read/write only
  the caller's own rows; nothing ever lists `ChipIn` rows; group text messages are read transiently and never
  stored; when Hush senses a problem it checks in with **every** member, never only the hesitant one; phone
  numbers are stored only hashed + encrypted (`lib/phone.ts`); anything posted to the group text must pass the
  leak check (`announcePlanToGroup` enforces `leakCheckPassed`); no real payments, ever.
- **Look and feel:** follow §5. Restyles change appearance only, never flows or copy intent.
- Keep API keys server-side; keep the Galaxy palette tokens instead of hard-coded colours.

Where things plug in (for P1):
| Need | File |
|---|---|
| Kick off planning when everyone is done | `lib/pipeline.ts` → `onMemberDone()` (returns `allDone`) |
| LLM calls (provider fallback, Zod-validated JSON) | `lib/ai/client.ts` → `callLLM()`; schemas in `lib/ai/schemas.ts` |
| A member's private constraints | `Vault` rows (`lib/vault.ts` merge helpers) / `Perspective` for mediation |
| What the group may see | `lib/serialize.ts` → `toGroupSafe()`; group page `app/(app)/c/[slug]/page.tsx` |
| Planning progress UI | `Circle.planningStage` + `components/PlanningStepper.tsx` |
| Post the plan to the group text | `lib/twilio/hush.ts` → `announcePlanToGroup(circleId)` |
| Data models (Plan, MemberShare, ChipIn, Vote) | `prisma/schema.prisma` (already created in the database) |
| Full specs | README §4.3 (planner), §4.4 (leak guard), §6 (chip-in math); PLAN.md §6.3, §6.4, §7, §14 |

## 0. Picking this up (partner checklist)

**Deadline (from `docs/BRIEF.md`):** hacking ends Sun Sep 27, 2026, 8:00 AM ET; submit by **6:00 AM ET**. Meta
requires a working prototype, a 2–3 min demo video, a **public** repo, and a short write-up.

1. **Get the code.** You were sent a zip of the project folder. If you use Claude, paste the prompt in
   `START_HERE.md` ("Prompt to paste into Claude") to get it oriented. The zip does **not** contain `node_modules/`, `.next/`
   or `.env`. The folder is not a git repo yet (see ground rules in §2 before pushing anywhere).
2. **Get the secrets separately.** Ask for the `.env` file over a private channel (it holds the database
   password and app secrets). Put it in the project root. What's in it today:

   | Variable | State | Notes |
   |---|---|---|
   | `DATABASE_URL`, `DIRECT_URL` | **set** | Supabase Postgres (see §3). |
   | `COOKIE_SECRET` | **set** | Signs device cookies. Don't change it mid-demo (logs everyone out). |
   | `PHONE_ENC_KEY` | **set** | Keys phone hashing/encryption. Changing it orphans stored phones. |
   | `APP_URL`, `DEMO_MODE`, `LLM_PROVIDERS`, `*_BASE_URL`, `*_MODEL`, `DISPARITY_COOLDOWN_MIN` | **set** | Defaults. |
   | `MODEL_API_KEY` (Meta), `XAI_API_KEY` (Grok), `OPENROUTER_API_KEY` | **empty** | Need **at least one** (step 5). |
   | `TWILIO_*` | **empty** | Needed for texting (step 6). |

3. **Install and run.** Node **22+** (tests need it; the app runs on 20 too).
   `npm install` → `npm run dev` → http://localhost:3000. Marketing site is `/`, `/friends`, `/teams`; the web app
   starts at `/start`.
4. **Tests/build.** `npm test` (83 tests) and `npx next build`. If `npm test` fails with *"Cannot find native
   binding"*, npm skipped rolldown's platform binary: on Apple Silicon run
   `npm i --no-save @rolldown/binding-darwin-arm64@1.2.11` (other platforms: the matching
   `@rolldown/binding-*` package, same version).
5. **Turn on Hush's brain (AI key).** Put a key in `.env` — HackGT gives Grok credits, so `XAI_API_KEY` is the
   quickest; `OPENROUTER_API_KEY` or Meta's `MODEL_API_KEY` also work. `LLM_PROVIDERS` sets the fallback order and
   providers without a key are skipped. Restart `npm run dev`.
   **Check:** `/start` → Start a plan → create it → open the invite link in a second browser/incognito → both
   people finish the private chat with Hush → the group page shows everyone "done".
6. **Turn on texting (Twilio).** Follow §6 "Setup to go live". **Check:** on `/c/<slug>`, each person links their
   phone (code by SMS) → organizer taps **Start group text** → everyone gets Hush's intro in a group text → someone
   texts "hey hush" in the group → every member gets a private check-in by SMS, and replies advance the same
   interview as the web chat.
7. **Then build what's missing, in the order of §8.** The big one is the **planner**: today, once everyone
   finishes, nothing produces a plan.
8. **Deploying:** Vercel is the target (`README.md`). Add the same env vars in Vercel, and point the Twilio
   webhook + `TWILIO_WEBHOOK_URL` at `https://<your-domain>/api/twilio/conversations`.

## 1. What this is

Quiet Consensus is a HackGT 13 project (Social Good track + Meta "Bringing People Closer Together with AI"). An AI
planner named **Hush** lives in a group chat, notices when a plan isn't working for someone, checks in with
**every** member privately (never just the one who hesitated), and proposes one plan the whole group can say yes
to — without revealing whose limit was whose. An anonymous **chip-in** covers budget gaps. A second mode,
**mediation**, handles roommate/coworker friction ("no quotes, nothing you keep private"). Audiences: **Friends**
(free) and **Teams** (paid). Tagline: _Plans everyone can say yes to._

## 2. Ground rules from the project owner (do not violate)

- **Git:** the owner asked that the **marketing site** (`app/(site)`, `components/site/`) **not be committed to the
  same repo as the app**. Agree with them where each part lives **before** any `git init`/push. Ask before any git
  action.
- Redesigns change **look and feel only** — never the product goal, copy intent, flows, or functionality.
- Visual style: **Galaxy S26 Ultra "midnight hardware gallery"** reference (§5). Background colour changes must be
  real, smooth theme transitions — never hard cuts or painted gradient bands.
- Keep this file updated so a fresh chat (or person) can resume without losing context.

## 3. Stack, running, database

- Next.js **16.3** (App Router; breaking changes vs older Next — read `node_modules/next/dist/docs/` before writing
  Next code), React 19.3, TypeScript 5.9, Tailwind **3.4**, framer-motion **13**, Prisma 6.19, Zod 4.
- Dev: `npm run dev` → http://localhost:3000 (`.claude/launch.json` has a `web` config for Claude's preview pane).
- Build: `npx next build` (or `npm run build`, which also runs `prisma generate`).

**Database (Supabase)**
- Project **quiet-consensus**, ref `llrzqwlsxlshgfrodgub`, us-east-1, free plan, in the owner's Supabase org. To
  manage it yourself, ask the owner to invite you (Supabase dashboard → Organization → Team).
- The app connects as a dedicated `prisma` role (bypassrls) through the Supavisor pooler
  `aws-0-us-east-1.pooler.supabase.com`: `DATABASE_URL` on 6543 (`pgbouncer=true&connection_limit=1`),
  `DIRECT_URL` on 5432.
- Schema changes: edit `prisma/schema.prisma` → `npm run db:push`. Then enable RLS on any **new** table (all public
  tables have RLS on with no policies, and `anon`/`authenticated` have no grants, so the Supabase Data API can't
  read them): Supabase SQL editor → `alter table public."NewTable" enable row level security;`.
- Tables: Circle, Member, Message, Vault, Perspective, Plan, MemberShare, ChipIn, Vote, AiTrace (app) · Lead
  (waitlist/pilot sign-ups) · User, DisparityEvent (texting).

## 4. Route map

| Route | What |
|---|---|
| `/` | Marketing landing: startup animation, hero scroll story, problem, stats, how it works, privacy, two paths, roadmap, waitlist |
| `/friends` | Social: hero chat, plan/mediation modes, chip-in demo, **"Make Hush yours"** preference studio (localStorage `qc.profile.v1`), promises, waitlist |
| `/teams` | Business: use cases, benefits, admin view, work-friendly filter demo, policy controls, pricing, pilot form |
| `/start` | Web app welcome (start a plan / join with a code) |
| `/new`, `/j/[slug]`, `/c/[slug]`, `/c/[slug]/chat` | Web app: create plan, join, group view (+ texting card), private chat |
| `POST /api/leads` | Waitlist + pilot sign-ups → `Lead` (zod, honeypot `website`, 5/min/IP, upsert on kind+email) |
| `/api/circles/*`, `/api/me`, `/api/me/chat` | Web app APIs (README §8) |
| `POST /api/twilio/conversations` | Twilio Conversations webhook (signature-checked; work runs in `after()`) |
| `GET/POST/PUT/DELETE /api/me/phone?c=slug` | Link / verify / unlink the caller's own phone (Twilio Verify) |
| `POST /api/circles/[slug]/group` | Organizer starts the group text (linked phones + invited `{name, phone}`), Hush joins |

Route groups: `app/(site)` = full-width marketing layout; `app/(app)` = 430px phone column.

## 5. Design system

Galaxy S26 Ultra reference ("midnight hardware gallery"), dark museum-plinth sections.
- Colours: Obsidian `#000`, Graphite `#0e0e0e`, Carbon `#1d1d1f`, Steel `#333336`, Slate `#6e6e73`, Ash `#86868b`,
  Porcelain `#f5f5f7`, **Galaxy Blue `#0381fe`** (filled CTA pills only), Electric Link `#2997ff` (links on dark),
  Cobalt Link `#0066cc` (links on light), Amber New `#d95c14` (text-only "New"/status markers).
- Type: Inter as the Galaxy Sans substitute. Radii: tiles 24px, media 16px, inputs 16px, local nav 20px, pills
  9999px. No shadows on media/cards — separation via surfaces and 1px keylines.
- Hush's purple (`#5B3DF5`) is the **product finish** (mascot, device back, in-device UI), never a CTA colour.
- **Theme transitions:** each marketing section declares `data-theme-section="dark" | "carbon" | "light"`;
  `components/site/ThemeController.tsx` sets `data-theme` on the `.site` root from whichever section crosses the
  middle of the viewport. Theme colours are registered CSS custom properties (`@property --c-*` in
  `app/globals.css`) with 0.9s transitions, so the whole page animates black ↔ charcoal ↔ white. Sections never
  paint their own background. Tailwind roles are variable-backed (`obsidian`=tile, `carbon`=panel,
  `porcelain`=foreground, `ash`, `slate`, `steel`, `keyline`, `graphite`, `link`). `.theme-dark` pins dark values
  for things that must stay dark (device screens, nav/menu, the black Teams card, featured pricing card).
- **Startup animation** (`components/site/Intro.tsx`, `.intro*` CSS): bubble mark draws, fills, eyes close, "Hush"
  + loading line; lifts after ~2s; CSS-driven (plays before hydration), skippable, 6s failsafe, off under reduced
  motion; full loads only. `useIntroDone()` gates hero entrances.
- **Hero** (`components/site/home/Hero.tsx`): chrome "HUSH" letters; "Hush" + statement bottom-left; capsule + blue
  pill bottom-right. The 3D handset isn't mounted until the first scroll, then swoops in and lies across the
  letters; a pinned 430vh scroll story tumbles it upright (screen: group chat → planning → plan) flanked by
  "Heard privately" / "What the group sees". Reduced motion renders both compositions statically.
- **3D handset** (`components/site/GalaxyPhone.tsx`): CSS 3D Galaxy Ultra-style body; walls follow the exact
  rounded outline so the back never overhangs. Flat mockups: `PhoneFrame` / `FitPhone`.
- **Box transitions:** `TileIn` + `useTileProgress()` (`components/site/motion.tsx`): boxes assemble with scroll;
  their contents animate in step (Stats, Privacy, Teams benefits/pricing, Friends promises).
- **Web app** (`app/(app)`, `components/*.tsx`): same palette through remapped tokens in `tailwind.config.ts`
  (`ink`=porcelain text, `surface`=black, `bubble`=carbon, `muted`=ash, `hairline`=steel). Primary buttons = Galaxy
  Blue pills. The invite QR stays on white so it scans.

## 6. Twilio group texting (built; needs credentials)

Code: `lib/twilio/` (`client.ts` REST over fetch, `signature.ts`, `sms.ts`, `disparity.ts`, `hush.ts`
orchestrator), `lib/phone.ts`, routes in §4, UI `components/TextingCard.tsx`. Tests: `tests/twilio.test.ts`.
Everything no-ops safely until the Twilio env vars are set.

How it behaves (spec §2):
- **Web + SMS share one interview.** SMS replies run the same `handleTurn()` on the same `Member` row. Options render
  as "A) … Reply A, B or C"; a bare letter maps back to the option.
- **Identity.** `User` = one phone (keyed HMAC hash + AES-GCM ciphertext; never plain). `Member.userId` links a
  membership to a phone; web members link via Verify code (`/api/me/phone`).
- **One private thread per phone** (Twilio allows one conversation per address+proxy pair): `User.dmConversationSid`;
  `User.activeMemberId` says which circle's interview it feeds.
- **Two ways Hush joins a group text:** (1) organizer taps **Start group text** (all linked phones + invited
  numbers, ≤ 9 people + Hush, US/Canada only); (2) someone adds Hush's number to an existing group text → Twilio
  autocreates a conversation → the webhook creates a circle ("Group plan"). Hush posts the intro only if **every**
  number in it has opted in; otherwise it stays silent there and privately tells the opted-in members.
- **Disparity loop** on every group message: rules pass (hedges, pricey/bar/food/access mentions, clashing times,
  "hey hush") → LLM judge on the last 12 lines (names → P1..Pn; rules score if no model) → gate (0.6 threshold,
  `DISPARITY_COOLDOWN_MIN`, 3/day, MUTE; a direct ask overrides mute but not the cooldown) → one neutral group
  message, then a private check-in for **every** unfinished member. `DisparityEvent` stores kind + confidence
  only; group text is read transiently from Twilio and never stored.
- **Keywords:** STOP/START, HELP, MUTE/UNMUTE, JOIN <code>. New texters are asked their name first.
- **Group notifications:** `lib/pipeline.ts#onMemberDone` posts "Everyone's checked in privately…" when the last
  member finishes. `announcePlanToGroup(circleId)` (in `lib/twilio/hush.ts`) posts a PROPOSED plan using **only**
  `toGroupSafe()` output and only if `leakCheckPassed` — the planner should call it.

**Setup to go live**
1. Twilio account + a **+1 number**. Trial accounts can only text numbers you verify in the console (fine for the
   demo: verify the team's phones). Real US traffic needs A2P 10DLC registration (takes days; post-hackathon).
2. **Conversations → Services:** create one → copy the SID (`IS…`) to `TWILIO_CONVERSATIONS_SERVICE_SID`. In that
   service's **Webhooks**: Post-event URL `https://<public-host>/api/twilio/conversations`, method POST, event
   `onMessageAdded`.
3. **Conversations → Addresses (or the number's messaging config):** attach the number to that service with
   **autocreate** on (and group texting on), so texts to Hush and group MMS including Hush create conversations.
4. **Verify → Services:** create one → `TWILIO_VERIFY_SERVICE_SID` (`VA…`).
5. `.env`: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (E.164, e.g. `+14045550123`) plus the
   two service SIDs. **Locally:** expose the dev server (e.g. `npx cloudflared tunnel --url http://localhost:3000`
   or ngrok), use that URL in step 2, and set `TWILIO_WEBHOOK_URL` to the exact webhook URL (signature checks
   depend on it). `TWILIO_SKIP_SIGNATURE=true` skips the check in dev only.
6. Group MMS is **US/Canada only** and caps at 10 participants including Hush. Confirm in Twilio's docs that a
   group MMS and a 1:1 thread on the same numbers coexist (the spec flags this as unverified).

## 7. Status log

- [x] Web app core (from before this session): create/join circles, signed cookies, private interview for plan +
      mediation (LLM client with provider fallback, fast paths, safety screen), group status page, privacy
      serializer + tests.
- [x] Marketing site `/`, `/friends`, `/teams` with the hamburger menu (Social / Business), waitlist + pilot forms
      → `Lead` table.
- [x] Supabase database wired (Prisma via the `prisma` role, RLS on every table).
- [x] Galaxy redesign of the site and the web app; real whole-page theme transitions; Apple-layout hero with the 3D
      Galaxy handset (appears on first scroll); startup animation; scroll-assembled boxes.
- [x] Twilio group texting (§6): schema pushed, 83 tests passing, `next build` clean.
- [x] 2026-09-27 (messaging round 3). How it works, in reading order:
  - **Reactions and threads:** `components/Reactions.tsx`; thread panel and long-press preview in `app/(app)/c/[slug]/group/page.tsx`; `api/circles/[slug]/messages/[id]/react`.
  - **Chat list:** preview, delete and leave in `components/ChatList.tsx`; routes `api/circles/[slug]/{delete,leave}`. `Member.clearedAt` implements "delete for me".
  - **Roles:** `lib/members.ts` handles admins, removal (`CircleRemoval` blocks rejoining by link) and the last-admin handover; route `api/circles/[slug]/members/[id]`. The Add route is admin-only.
  - **Private check-ins:** `lib/checkin.ts` runs the DM turns, the anonymous analysis (P1..Pn) and "find another day". The DM page is `app/(app)/c/[slug]/hush` with API `api/circles/[slug]/dm`, and messages are stored in `Message` with topic `ci:<id>` or `dm`.
  - **Asks:** `lib/hushask.ts` handles the question kinds `when` / `place` / `location` / `decide` / `other`, with `meta` per option.
  - **Personal profile:** `lib/personmd.ts` builds the Markdown profile from `Account.hushMd`. Group-facing prompts get **only** the About section; private chats get the whole profile.
  - **Calendars:** `lib/calendar.ts` reads ICS via ical.js, with an allowlist and SSRF guard, plus Google OAuth free/busy, time zones and `freeSlots`.
  - **Places:** `lib/findplaces.ts` covers Google Places, Ticketmaster, the model's pick and website peeks. `lib/places.ts` covers Nominatim, Overpass and booking links.
  - **Tests:** `tests/calendar.test.ts`. The privacy allowlist in `tests/serialize.test.ts` now includes `isAdmin`.
- [x] Fixed a pre-existing crash on `/new` in current Chromium (effects must not return `scrollIntoView()`'s
      Promise).

- [x] **SMS opt-in (A2P 10DLC)** (2026-09-27, Claude on the Pi): unchecked consent box on the phone-link step
      (`components/TextingCard.tsx`, wording in `lib/twilio/consent.ts`), "Agree & send code" blocked until ticked;
      consent time + IP + wording version on `User` (`smsConsentAt/Ip/Version`, pushed); confirmation text after
      verify. **Opt-in is a condition of every text** (`canText()`): Start group text includes only opted-in people;
      a group text Hush is added to stays silent (`Circle.smsHeldAt`) until everyone has opted in, and only the
      opted-in members are told privately; unknown 1:1 texters get only a HELP reply. HUSH_INTRO/HUSH_HELP carry
      "Msg & data rates may apply" + support contact. `/privacy` + `/terms` now live in the app (`app/(legal)`).
      Deployed on the owner's Pi at https://silentconsensus.world (systemd `quiet-consensus-app`, port 3020).
      83 tests pass, `next build` clean. Public opt-in page (no plan needed) at **/sms**
      (`app/(legal)/sms`, `components/SmsOptInForm.tsx`, `POST/PUT /api/sms/optin`), the URL given to Twilio as proof.

- [x] **Merged with the GitHub repo (Dinofish32/hackgt-2026)** (2026-09-27 ~01:55 ET, Claude on the Pi). Base = the repo
      (planner, leak guard, votes, chip-in/share/pay, mediation, demo tools, "remember me" Profile, chat-based setup).
      Brought in from the owner's zip: marketing site `app/(site)` + `components/site` + waitlist (`/api/leads`, Lead),
      all Twilio texting (`lib/twilio`, `lib/phone`, `/api/twilio/conversations`, `/api/me/phone`, group route,
      TextingCard on `/c/[slug]`), the SMS opt-in (`/sms`, `(legal)` Privacy/Terms). App screens moved to the `(app)`
      route group with the app home at **/start** (the site owns `/`). Look: the repo's theme-variable components with
      the tokens set to the **Galaxy palette** (dark default, Galaxy light via Settings), Inter, Galaxy-blue
      PrimaryPill, blurred sheet backdrop. `lib/pipeline.ts`: repo planner trigger + group-text "everyone's checked
      in" + `announcePlanToGroup()` after the planner. Schema = union; pushed additively to Supabase (Profile,
      Circle.foundCount, Member.profileId; RLS enabled on Profile). 147 tests pass; demo hangout story ran end to end
      (4 members → plan PROPOSED, leak check passed, 85s). **The repo on GitHub does not have these merged changes yet**
      (nothing was pushed). Its README says Neon; this deployment uses the Supabase database.

- [x] **Messaging-first rebuild** (2026-09-27 ~02:25 ET, Claude on the Pi). **Accounts**: email + password
      (`/login`, `lib/account.ts`, `/api/auth/{signup,login,logout,me}`; scrypt hashes, session token only as sha256,
      httpOnly `qc_account`). `Member.accountId` links memberships to accounts; `getMember()` falls back to the account,
      so plans/chats follow you across devices; logging in claims plans joined on that browser. Creating/joining a plan
      requires login. **Group chat** per plan at `/c/[slug]/group` (`GroupMessage`, `/api/circles/[slug]/messages`,
      `/read`), 1.5s polling, unread badges, replies (hover Reply on desktop; tap → Reply or swipe right on phones;
      tap a quote to jump), full window on desktop. **Home** `/start` = chat list when logged in. **Hush in the chat**
      (`lib/groupchat.ts`): intro on create, "X joined", listens for "Hush…" or stuck plans (rules + anonymised judge
      + cooldown) → asks everyone to talk to it privately; posts "everyone's checked in" and the plan (group-safe,
      leak check passed). Twilio texting UI removed from the plan page (texts blocked until A2P approval); invite by
      link. Schema additions pushed (Account, AccountSession, GroupMessage, Member.accountId/lastReadAt,
      GroupMessage.replyToId; RLS on). Stripe Checkout (test mode only) wired to "Pay my share" (needs a valid
      `STRIPE_SECRET_KEY`).

- [x] **Hush works on its own + business version + DMs** (2026-09-27 ~03:10 ET, Claude on the Pi).
      **Auto-detect** (`lib/ai/detect.ts`): after a chat goes quiet (3s, at most every 8s) Hush reads the group chat
      and pins EVENT / TASK / DECISION cards (`ChatItem`, `GroupMessage.kind=ITEM`), updates them when plans change,
      "Hush is reading" indicator; RSVP / Mark done / dismiss / Add to Google or Outlook calendar
      (`components/ChatItemCard.tsx`, `/api/circles/[slug]/items`). Press-and-hold (right-click) empty chat space →
      bring Hush in / talk privately / scan now (`/api/circles/[slug]/hush`). **Work groups** (`Circle.mode=WORK`):
      meetings/action items, and a **tone check before delivery** (`lib/ai/tone.ts`): unprofessional messages come back
      to the sender only with a rewrite (Use Hush's / Send mine / Edit); fails open after 7s. **Business**
      (`Organization`, `Account.orgId/orgRole`, `lib/org.ts`): work sign-in under the normal login
      (`/api/auth/business`), work sign-up joins by email domain (first account creates the company as ADMIN),
      management page `/admin` (stats, people + roles, invite link, tone/auto-detect policies, work groups).
      **Demo company: Northwind Studio, priya@northwind.test (admin) / jordan / sam / alex, password `northwind-demo`**
      (`node scripts/seed-demo-company.mjs` resets it). **DMs** (`Circle.isDirect`, `lib/dm.ts`, `/api/dm`) with people
      you share a chat with or found via contacts; `/people` + contact matching (`/api/contacts/match`: phones hashed,
      compared to verified linked phones, not stored; Contact Picker on Android Chrome). **Chat settings**
      (`/c/[slug]/settings`: name, color, background, photo). **Accounts**: forgot password via linked-phone code,
      two-step login, Settings page (profile photo + bio, email, password, phone, log out everywhere, delete
      account). Marketing "Get early access" → "Log in / Sign up". NOTE: `.env` DATABASE_URL now uses
      `connection_limit=10` (was 1, a serverless setting that timed out under a long-running server).

## 8. What's left (in priority order)

**Needs the owner (keys and accounts, via keydrop, never pasted into chat)**
1. **Stripe test key** (`sk_test_…`): the current one is rejected (401). Chip-in and "Pay with Stripe" show "Payments aren't set up" until it's replaced.
2. **AI keys:** the Meta key (`MODEL_API_KEY`) returns 401 and xAI says "Incorrect API key". Only OpenRouter works, so there's no fallback.
3. **Places and events:** `GOOGLE_MAPS_API_KEY` (Places API (New)) and `TICKETMASTER_API_KEY`. Without them, OpenStreetMap is used for places, and nearby venues plus a ticket search link stand in for events.
4. **Google Calendar sign-in (optional):** `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. ICS links already work for Apple, Google and Outlook.
5. **Twilio A2P campaign:** texts from the Twilio number are blocked (30034) until it's approved. The brand on the site and in legal pages is now *Silent Consensus*, so update the campaign's brand/description to match.

**Product**
6. **Business security:** email isn't verified at sign-up, so anyone can join a company by claiming its domain. Add email verification or Microsoft/Google SSO before real pilots.
7. **Friction detection:** tension between people (friends: private nudges; work: private help, optional escalation) was discussed, not built.
8. **Zoom/Teams meeting links on work meeting cards;** company billing.
9. **The old planner pipeline** (`/c/[slug]` plan page, `/c/[slug]/chat` interview, share page) still works but isn't linked from the new flow. Remove it or fold it in.
