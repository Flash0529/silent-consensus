# What changed since the handoff

This covers everything added or changed on the `messaging-hush` branch since Akarsh's last commit on `main`
(`9473a1d` "Rename the product to Hush", Sep 27 2026, 3:34 AM). Compared with `main` it's **208 files changed,
~22,500 lines added**: 170 new files and 31 modified. Six pages were moved into route groups, and the old root
page was replaced by the marketing site.

The short version: the hackathon prototype (a planner you open by link) became **Silent Consensus**, a full
messaging app with Hush built in. It's live at **https://silentconsensus.world**.

---

## 1. How we use Meta (Muse) and Grok

Every AI feature goes through **one client**, `lib/ai/client.ts#callLLM`. We kept Akarsh's design; the only change
to that file is the OpenRouter app title. The client tries **three OpenAI-compatible providers in order**
(`LLM_PROVIDERS`, default `meta,xai,openrouter`):

| Order | Provider | Model (overridable in `.env`) | Role |
|---|---|---|---|
| 1 | **Meta Model API** | **Muse Spark** (`muse-spark-1.3`, `META_MODEL`) at `api.meta.ai/v1` | Primary: every Hush feature asks Muse first |
| 2 | **xAI Grok** | `grok-4.7` (`XAI_MODEL`) at `api.x.ai/v1` | First fallback: if Meta errors, times out, rate-limits or returns bad JSON |
| 3 | **OpenRouter** | TypeSafe **Jev** router (`OPENROUTER_MODEL`) | Second fallback |

**How a call works:**
- Every call asks for **JSON that matches a Zod schema**, so the output is always structured, never free text we have to parse.
- **Bad output:** if a model returns invalid JSON or doesn't match the schema, it gets one "repair" retry.
- **Transient errors** (timeouts, 429s, 5xx) get up to two backoff retries, then the client moves to the next provider.
- **Tracing:** every call writes an `AiTrace` row with the provider, model, time and success. Private text is never stored in it.
- **Newer features** (`lib/checkin.ts`) also retry once with lower reasoning effort, because some models occasionally answer in prose.

**Current status (honest):** the Meta and xAI keys in `.env` are rejected by their APIs (Meta: 401; xAI:
"Incorrect API key"). Right now every live call succeeds through the OpenRouter fallback. Once valid Meta and
Grok keys are in `.env`, Muse is primary again and Grok is the backup, with no code change.

**What the models do** (every place `callLLM` is used):

| Task | Where | What it does |
|---|---|---|
| `detect_chat_items` | `lib/ai/detect.ts` | Reads the group chat and notices plans, to-dos and decisions, **and starts private planning automatically** |
| `hush_group_reply` | `lib/ai/hushchat.ts` | Answers when someone talks to Hush in a group ("hey Hush…"), and decides whether to start planning |
| `disparity` | `lib/twilio/disparity.ts` | Judges (names hidden) whether a plan is quietly not working for someone ("maybe not, I'm busy") |
| `plan_intake` | `lib/checkin.ts` | "Plan event": the organizer describes the plan to Hush in a normal chat |
| `plan_details` | `lib/checkin.ts` | Each person's private questions: only what's still needed, using their profile and calendar |
| `plan_build` | `lib/checkin.ts` | Builds one multi-part plan from everyone's answers (names hidden as P1, P2…); treats "anything works" as flexible |
| `venue_search_plan`, `venue_pick` | `lib/findplaces.ts` | Turns a plan into a place/event search, then picks the best real options (reviews, website, the group's asks) |
| `hush_private_chat` | `lib/checkin.ts` | Free private chat with Hush; remembers lasting facts in your profile |
| `work_tone_review` | `lib/ai/tone.ts` | Work chats: reviews a message before coworkers see it; suggests a rewrite and rates severity |
| `setup`, `interview`, `persona`, `map`, `judge`, `compose`, `explain`, `plan`, `draft`, `brief` | `lib/ai/*` | Akarsh's original planner and mediation pipeline (still in the code, see §6) |

**Privacy rules for all prompts:**
- Group-facing prompts only get people's public profile (name, time zone).
- Private chats get only that one person's profile.
- Group-level decisions see everyone **without names**, and outputs are checked for names before anyone sees them.
- Files are never included unless their sender said yes.

---

## 2. Timeline

1. **Hosting.** The app moved to a Raspberry Pi 5 behind Nginx Proxy Manager and Cloudflare, at `silentconsensus.world`, as systemd service `quiet-consensus-app` (`next start` on :3020). Keys are added through a private "keydrop" page and never committed.
2. **Twilio.** Privacy and Terms pages were added for the A2P 10DLC registration, plus a public SMS opt-in (`/sms`) and consent rules. Group texting (Twilio Conversations) and phone codes (Twilio Verify) were wired up. Texts from our number wait on A2P approval; Verify codes work.
3. **Merge.** Akarsh's repo was merged with the owner's live version (marketing site, texting, waitlist). All of Akarsh's code was kept; his top-level pages moved into route groups (see §6).
4. **Messaging-first rebuild.** Accounts, chat list, group chat, replies, a Teams-like desktop layout, DMs, contacts, chat settings, and the business side.
5. **Private planning and the 28-item overhaul.** Everything moved into a private Hush chat, plus chip-in with Stripe, tailoring, the rebrand, devices, files, search, admin tools and the landing page rewrite.
6. **Fixes.** A valid Stripe key, protection against broken tabs after deploys, reliable Android long-press, and the Hush chat list with Clear history.

---

## 3. What was added

### Accounts and security
- **Accounts:**
  - email and password (scrypt), with sessions stored as sha256 hashes
  - log in, sign up, forgot password (by text code), two-step login, log out everywhere, delete account
- **A phone step right after sign-up** (`/welcome`). Phones are stored only hashed and encrypted.
- **Devices** (Settings): every browser you're logged in on, last active time, *remember this device* (skip two-step codes), and remove a device (logs it out).
- **Names:** check marks and "Hush" aren't allowed in names or chat titles, so only Hush gets the verified ✓.

### Messaging
- **Chats:**
  - chat list (with a Hush row pinned at the top), group chats and DMs
  - invite links and QR codes, add people from contacts, phone or email
  - **friend-invite links** for people who aren't on the app yet: they sign up with it and you're connected
- **Messages:**
  - replies in iOS-style **threads**
  - iMessage-style **tapbacks** (press and hold, right-click, or hover)
  - **search** across all your chats
- **Files:** photos, PDFs, text and Office files up to 15 MB, **deleted after 7 days**. Hush can't see a file unless its sender answers *"Would you like this to be seen by Hush AI?"*. This is enforced on the server in `lib/files.ts#aiFileLines`.
- **Chat settings:** name, color, background, photo.
- **Group admins:** add, remove, promote. Removed people can't rejoin by link; the last admin leaving hands over to the longest-standing member.
- **Deleting and leaving:** Delete for me, Leave group, Delete for everyone.
- **Chat list:** press and hold (or right-click) a chat for a preview.
- **Layouts:**
  - Desktop is Teams-like (rail, chat list, chat).
  - Phones get a single column with a ☰ menu.
  - Every page has both; sign-in pages get a split screen on desktop.

### Hush, the planner
- **A separate verified Hush chat** (`/hush`):
  - one private conversation per group
  - a chat list that slides in from the right on phones, and sits as a right column on desktop
  - **Clear history**, which also deletes a plan in progress; the group sees "<name> deleted the plan"
- **Planning starts on its own:**
  - when Hush notices a plan in the chat, when a plan gets stuck, or when someone asks Hush
  - or with the **Plan event** button, where the organizer describes it first
- **Everything happens in each person's Hush chat:**
  1. "Can you make it?" is asked once, at the start.
  2. Only the needed details are asked: times, preferences, where you're coming from (location or city/ZIP, rounded to about 1 km), and budget.
  3. You're told to stay while the others answer.
  4. You see the full plan. "Does this look right?" is asked once, at the end, and changes are allowed up to twice.
  5. When everyone confirms, it's posted to the group and you're taken back.
- **The group** only sees one line, a progress card and the final plan. There are no public polls.
- **Multi-part plans with real places and events:**
  - Google Places, with OpenStreetMap as the free fallback; Ticketmaster for events.
  - Resy, OpenTable, Ticketmaster and Map links on the plan.
- **Quiet chip-in and paying shares with Stripe Checkout** (test mode only, card 4242 4242 4242 4242):
  - People over their comfortable budget are covered quietly by friends with room.
  - Nobody learns who gave or who was helped.
- **Make Hush yours:** the Friends-page studio, saved to your account and per chat. It covers name, color, tone, length, how proactive, emoji, quiet hours, diet, allergies, cuisines, budget, access, travel, vibe and times.
- **A Markdown profile per person** that Hush reads before talking to them. You can view, edit, clear or download it (`.md`).
- **Calendars** (free/busy only): Apple, Google or Outlook calendar links, plus optional Google sign-in.

### Business (Hush for Teams)
- **Sign-in and company:** work sign-in with a company email, domain-based company join, and a management page (`/admin`).
- **In work chats:** Hush tracks meetings, action items and decisions, and runs a **tone check before sending** (only the sender sees the suggestion).
- **Manager review** (opt-in):
  - Someone who sends flagged messages as written 3 times in a week is reviewed by their manager, or HR for serious content.
  - They're always warned first, and reviews never include private Hush chats.
  - Reviews are at `/reviews`.
- **Demo company "Northwind Studio":**
  - `priya@northwind.test` (admin and manager), `jordan@`, `sam@`, `alex@`, `morgan@` (HR)
  - Password `northwind-demo`

### Site
- **Marketing site:** `/`, `/friends`, `/teams`, rewritten to match what works today ("Live today" section on Teams).
- **Copy:** "Coming soon to Android"; the "Try the web preview" link is removed.
- **Waitlist:** saved to the database, viewable and exportable at `/owner` (owner only).
- **Legal pages:** a desktop layout, and Back returns where you came from.
- **Brand:** the logo and favicon.

---

## 4. Data model additions (`prisma/schema.prisma`)

**New models:**
- Accounts and sessions: `Account`, `AccountSession`, `TrustedDevice`, `FriendInvite`
- Chat and cards: `GroupMessage`, `GroupReaction`, `Attachment`, `ChatItem`, `ChatItemResponse`, `HushAsk`, `HushAnswer`
- Planning and money: `HushCheckIn`, `HushCheckInReply`, `ItemShare`, `ItemChipIn`
- Calendars and groups: `CalendarLink`, `CircleRemoval`
- Business: `Organization`, `ToneOverride`, `Escalation`
- From the live-version merge (texting and waitlist): `Lead`, `User`, `DisparityEvent`

**Changes to existing models:** new columns on `Circle` and `Member` (chat look, DMs, org, admin roles, "delete for me"), and `Role.ADMIN`.

All changes were **additive**: nothing of Akarsh's was dropped, and RLS is on for every table.

## 5. New routes

- **Pages:**
  - the app: `/start`, `/c/[slug]/group`, `/c/[slug]/settings`, `/c/[slug]/add`, `/hush`, `/settings`, `/people`, `/group/new`
  - accounts: `/login`, `/forgot`, `/welcome`, `/invite/[token]`
  - business and owner: `/admin`, `/reviews`, `/owner`
  - legal: `/privacy`, `/terms`, `/sms`
- **API:**
  - accounts: `auth/*`, `account/*` (profile, phone, devices, notes, style, calendars)
  - chats: `circles/[slug]/*` (messages, reactions, files, items, settings, members, delete/leave, plan-event, check-in)
  - Hush and money: `hush` (chat, pay, chip-in, clear)
  - everything else: `search`, `invites`, `files`, `org`, `reviews`, `owner/leads`, `calendar/google/*`, `twilio/*`, `sms/optin`, `leads`, `client-error`

## 6. Changed from Akarsh's version

- **Route groups.** `app/c/[slug]/*`, `app/j/[slug]/*` and `app/new` moved into `app/(app)/…` (same URLs). `app/page.tsx` was replaced by the marketing site `app/(site)/page.tsx`.
- **Identity.** `lib/identity.ts#getMember` also recognizes a logged-in account, not only the per-link cookie.
- **Privacy serializer.** `lib/serialize.ts` exposes photos, admin flags, chat look and Hush settings. `tests/serialize.test.ts` was updated deliberately for each new key.
- **Pipeline and prompts.** `lib/pipeline.ts` and the interview/setup prompts only got the rename and account support. **The original planner, mediation pipeline, share page and mock pay are all still in the code.** They're no longer linked from the new flow; deciding whether to keep, fold in or remove them is listed in HANDOFF §8.
- **Rename.** *Hush* / *Quiet Consensus* became **Silent Consensus** (the app is still called Hush inside).

## 7. Testing

- **Unit tests:** `npm test` runs 156 tests (Akarsh's 83 privacy/chip-in/vault tests, plus calendar parsing, time zones, places and names).
- **Browser/API check:** a 206-point check of every menu, button and feature on desktop and phone, run against the live site. **206/206 passing.**
- **Live tests:** every feature was tested on the real site with throwaway accounts, then the test data was deleted.

## 8. Running and deploying

- **Run locally:** `npm install`, `cp .env.example .env` (fill it in), `npx prisma db push`, `npm run dev`.
- **Deploy on the Pi:** `./scripts/deploy.sh`. It builds with a fresh deployment id, so tabs open during a deploy reload instead of breaking, keeps the previous build's files, and restarts the service.

## 9. Still open

- **Keys needed:**
  - valid **Meta (Muse)** and **xAI (Grok)** keys, so they're primary again (OpenRouter is carrying everything right now)
  - `GOOGLE_MAPS_API_KEY` and `TICKETMASTER_API_KEY` for the best place and event results
- **Twilio:** the A2P campaign still needs approval before group texts from our number go out. The campaign's brand should say Silent Consensus.
- **Business sign-up:** add email verification or SSO before real business pilots; today anyone can claim a company domain.
- **Not built yet:** friction detection (people getting tense), Zoom/Teams meeting links, and company billing.
