# Silent Consensus

**Group chats that actually make plans.** Live at **https://silentconsensus.world**.

Silent Consensus is a messaging app with an AI planner, **Hush**, built in. You chat with your friends (or your
team) like any group chat. When a plan starts to form, Hush takes it private: it asks each person, in their own
private **Hush chat**, whether they can make it and what works for them. Then it finds real places and events and
builds one plan everyone confirms before it's posted back to the group. Nobody sees anyone else's answers, ever.

It started at **HackGT 13** (Social Good track, Meta challenge "Bringing People Closer Together with AI") as
*Quiet Consensus*. It has since been rebuilt messaging-first and renamed to match its domain.

---

## The problem

Group chats plan for the loudest person. People with a quiet limit, like money, a religious diet, sobriety, a
disability or a packed week, just say "I'm busy" and slowly drop out.

- 67% of Americans declined social events in the past two years mainly because of cost, and 56% never told loved ones money was the reason ([CFP Board, Jan 2026, n=1,138](https://www.cfp.net/news/2026/03/financial-fomo-quietly-straining-american-relationships)).
- 69% have declined a social outing because it was too expensive; 36% have had a friendship end over money ([LendingTree, July 2025, n=2,000](https://www.lendingtree.com/credit-cards/study/friends-money-report/)).
- Loneliness affects 1 in 6 people worldwide and is linked to more than 871,000 deaths a year ([WHO, June 2025](https://who.int/news/item/30-06-2025-social-connection-linked-to-improved-heath-and-reduced-risk-of-early-death)).

Silent Consensus lets people stay in without explaining themselves.

---

## What it does

### Messaging (the app first)

- **Accounts:** email and password, plus an optional phone. You're nudged to add a phone right after sign-up; it's used for password reset, two-step login, and letting friends find you.
- **Chats:**
  - group chats and DMs, with invite links and QR codes
  - add friends from contacts (Android Chrome) or by phone or email
  - a **friend-invite link** when someone isn't on the app yet: they sign up with it and you're connected automatically
- **Messages:**
  - iMessage-style **tapbacks**: one per person; press and hold on phones, right-click or hover on computers
  - **reply threads** like iOS: a side panel on desktop, full screen on phones
  - **search** across every chat's messages
- **Files:** photos, PDFs, text and Office files up to 15 MB.
  - They're **deleted after 7 days**.
  - Hush can't read a file unless its sender answers "Yes" to a fixed question: *"Would you like this to be seen by Hush AI?"* (see Privacy below).
- **Chat settings:** name, color, background, photo, and "Hush in this chat" (what the group calls Hush, its personality, and how proactive it is).
- **Groups:**
  - **Admins** add and remove people and promote others.
  - Removed people can't rejoin with the link until an admin adds them back.
  - When the last admin leaves, the longest-standing member takes over.
- **Deleting chats:** Delete for me (iMessage-style: the chat comes back only with new messages), Leave group, or Delete for everyone (admins).
  - These are in chat settings.
  - Also: press and hold a chat in the list (or right-click it) for a preview and these options, or use the trash icon on hover.
- **Devices** (Settings): every browser you're logged in on, when it was last active, **remember this device** (skip two-step codes there), and **remove** a device (logs it out).
- **Desktop and phone:** every page has both.
  - On computers the layout is Teams-like: an app rail, the chat list, and the open chat.
  - Sign-in pages get a split screen.
  - Phones get a single column with a ☰ menu.

### Hush, the planner (the AI second)

- **Hush is its own chat,** pinned at the top of your chat list with a **verified ✓**.
  - It's one private chat across all your groups, labeled by group.
  - Nobody can put a check mark in their name or call themselves "Hush".
- **It starts on its own:**
  - Hush reads the group chat and notices when a plan is forming ("concert this month, then food after?"), or when a plan is getting stuck ("maybe not, I'm busy").
  - You can also ask it ("hey Hush, help us out") or tap **Plan event**.
- **Plan event:**
  - Whoever taps it describes the plan to Hush in a normal chat, with suggestions above the box you type in.
  - Hush then checks with everyone else privately.
- **Everything happens in the Hush chat, and you stay there until the end:**
  1. **Can you make it?** Asked once, at the start. "Can't" gets a gentle "would another time work?" and never a "why".
  2. **A few details, only what's needed:**
     - times, and preferences for each part (genre, cuisine…)
     - where you're coming from: share your location or type a city or ZIP; it's rounded to about 1 km
     - what's comfortable to spend, only if it costs money and Hush doesn't already know
  3. **"Stay here."** Once everyone has answered, Hush builds the plan:
     - It uses everyone's answers with names hidden, plus linked calendars (busy/free only).
     - It finds **real places and events** near the middle of where everyone's coming from, with Resy, OpenTable, Ticketmaster and Map links.
     - Plans can have **several parts** (e.g. a concert, then dinner after).
     - "Anything works" counts as flexible: a specific choice from someone else wins.
  4. **"Does this look right?"** Asked once, at the end. "Change something" lets you say what, and Hush revises it for everyone (up to twice).
  5. When everyone has confirmed, **the plan is posted to the group** and you're taken back to the chat.
- **The group** only ever sees one line ("I'll work out the details with each of you privately"), a progress card ("2 of 3 answered"), and the final plan card.
- **The quiet chip-in:**
  - If the plan costs more than someone said they're comfortable with, friends with room are asked privately: *"Want to quietly help?"*
  - Payments go through **Stripe Checkout in test mode**; use card `4242 4242 4242 4242`, any future date, any CVC. No real money moves, ever.
  - Whoever was helped sees their share go down, and never learns who gave.
  - Everyone can pay their own share the same way.
- **Make Hush yours** (Settings, same as the Friends page studio):
  - how your Hush talks to you: name, color, warm/playful/direct, length, how proactive, emoji, quiet hours
  - what it plans around: diet, allergies, cuisines, spice, drinks, budget, step-free access, travel time, vibe, when you're usually free
- **What Hush knows about you:** every person has a small **Markdown profile**, which Hush reads before talking to them. You can see, edit, clear or download it (`.md`) in Settings.
- **Calendars:**
  - Link Apple (iCloud public link), Google (secret iCal address or Google sign-in) or Outlook (published link).
  - Hush only reads busy/free and never shows your schedule to anyone.
- **Work groups:**
  - Hush tracks meetings, action items (with owner and due date) and decisions.
  - A **tone check** reads each message before coworkers do and privately suggests a calmer rewrite.

### Business (Hush for Teams)

- **Work sign-in** with a company email. The first person creates the company and becomes its admin; others join automatically by email domain.
- **Management page** (`/admin`):
  - people and roles
  - each person's manager and an HR flag
  - policies: tone check, auto-detect, and **manager review**
  - company name and work groups
- **Manager review** (off by default):
  - Someone who sends a flagged message as written ("Send mine anyway") 3 times in 7 days gets a review by their manager (HR for serious content, or if no manager is set).
  - The warning is shown before every send.
  - The person is told when it happens.
  - Reviews contain only those messages and Hush's reason, never private Hush chats.
  - Managers and HR see them at `/reviews`.
- **Demo company:** Northwind Studio.
  - Log in → *Sign in with your work account* → *Use the demo company*.
  - Accounts: `priya@northwind.test` (admin and manager), `jordan@`, `sam@`, `alex@`, `morgan@` (HR). Password `northwind-demo` for all.

---

## Privacy model (the core promise)

- **Group-facing data** only comes from explicit allowlists (`lib/serialize.ts#toGroupSafe`, guarded by `tests/serialize.test.ts`), or from messages people posted to the group themselves.
- **Private answers:**
  - Answers in the Hush chat, RSVPs, budgets and locations are stored per person and never shown to anyone else, not even as a breakdown.
  - The group sees only counts ("2 of 3 answered") and the final result.
  - Group-level prompts see everyone's profile **with names replaced by P1, P2…**, and results are checked for names before posting.
- **Profiles in prompts:** prompts whose output the whole group sees get only the public part of people's profiles (name, time zone). Private chats get the whole profile for that one person only.
- **Files:**
  - `lib/files.ts#aiFileLines` is the only code that puts file contents into a prompt, and it only reads files whose sender answered "Yes".
  - Only the sender can answer, and group prompts never include FILE messages otherwise.
- **Storage:**
  - Phones are stored only hashed and encrypted.
  - Calendar links and Google tokens are encrypted.
  - Locations are rounded to about 1 km and never displayed.
- **Money:** payments are Stripe test mode only. A live key is treated as "not configured".

---

## Tech stack

- **App:** Next.js 16 (App Router, Turbopack), React 19, Tailwind 3.4, Framer Motion, SWR polling.
- **Data:** Prisma 6 on Supabase Postgres, with row-level security on every table.
- **Validation:** Zod 4 for every input and every AI output.
- **AI:** `lib/ai/client.ts#callLLM`, OpenAI-compatible with provider fallback (Meta Model API, xAI, OpenRouter) and schema-validated JSON with repair.
- **Places and events:**
  - Google Places API (New) when a key is set; OpenStreetMap (Nominatim, Overpass) as the free fallback.
  - Ticketmaster Discovery for events.
  - Resy, OpenTable and Google Maps deep links.
- **Calendars:** `ical.js` for ICS links (allowlisted hosts, SSRF-guarded) and Google OAuth free/busy.
- **Payments:** Stripe Checkout over REST (no SDK), test mode only.
- **Texting:** Twilio Verify for phone codes. Twilio Conversations group texting is built, pending A2P approval.

## Getting started

```bash
npm install
cp .env.example .env        # then fill it in (never commit it)
npx prisma db push          # schema → your Postgres
npm run dev                 # http://localhost:3000
```

Environment variables (see `.env.example` for all of them):

| Variable | What for |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | Postgres (Supabase pooler + direct) |
| `COOKIE_SECRET`, `PHONE_ENC_KEY` | Signing cookies; encrypting phones, calendar links and tokens (set once; don't change) |
| `MODEL_API_KEY`, `XAI_API_KEY`, `OPENROUTER_API_KEY`, `LLM_PROVIDERS` | AI providers, in fallback order |
| `STRIPE_SECRET_KEY` | **Test** key only (`sk_test_…`) for chip-in and paying shares |
| `GOOGLE_MAPS_API_KEY` | Google Places for restaurants and activities (optional; OpenStreetMap otherwise) |
| `TICKETMASTER_API_KEY` | Real concerts, games and shows (optional; nearby venues otherwise) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | "Connect Google Calendar" (optional; redirect `…/api/calendar/google/callback`, scope `calendar.freebusy`) |
| `TWILIO_*` | Phone codes (Verify) and group texting |
| `OWNER_EMAILS` | Who can open `/owner` (Android waitlist and Teams pilot sign-ups, CSV export) |
| `UPLOAD_DIR` | Where chat files are kept (default `/home/pi/quiet-consensus/uploads`) |

### Tests

```bash
npm test          # 156 unit tests (privacy allowlist, chip-in math, calendar parsing, names, …)
npx next build    # type-check + production build
```

## Project layout

| Path | What's there |
|---|---|
| `app/(site)` | Landing pages: `/`, `/friends`, `/teams` |
| `app/(legal)` | `/privacy`, `/terms`, `/sms` |
| `app/(app)` | The app: `/start` (chats), `/c/[slug]/group` (a chat), `/hush` (Hush chat), `/settings`, `/people`, `/admin`, `/reviews`, `/login`, `/welcome`, `/invite/[token]` |
| `app/api` | Route handlers (auth, circles, messages, files, hush, pay/chip-in, calendars, invites, search, org, reviews, owner) |
| `lib/checkin.ts` | The planning engine: sessions, private Hush chat turns, building the plan, confirming, posting |
| `lib/findplaces.ts`, `lib/places.ts` | Real places and events; booking and map links |
| `lib/chipin.ts`, `lib/money/allocate.ts` | Shares and quiet chip-in (with Stripe) |
| `lib/personmd.ts`, `lib/hushstyle.ts` | Per-person Markdown profile; "Make Hush yours" |
| `lib/calendar.ts` | ICS/Google free-busy, time zones, finding free slots |
| `lib/files.ts` | Attachments, 7-day cleanup (`instrumentation.ts`), the AI consent gate |
| `lib/review.ts` | Manager review (business) |
| `lib/members.ts`, `lib/names.ts` | Group admins; names without check marks |
| `lib/ai/*` | Detection, group replies, tone check, the original planner pipeline |
| `components/*` | UI (chat list, Hush studio, reactions, verified badge, …) |
| `prisma/schema.prisma` | Data model |
| `docs/HANDOFF.md` | Living record: status log and what's left |

## Deployment (how it runs today)

Self-hosted on a Raspberry Pi 5:
- **Service:** the systemd service `quiet-consensus-app` runs `next start` on :3020.
- **Proxy:** Nginx Proxy Manager, host 14, behind Cloudflare.
- **Deploy:** `./scripts/deploy.sh`. It builds with a fresh deployment id (so open tabs reload instead of breaking) and keeps the previous build's files for a few days, then restarts the service.
- **Keys:** added through the private *keydrop* page on the owner's homelab; never pasted into chats or committed.

## Libraries used

| Library | Use |
|---|---|
| [next](https://nextjs.org), [react](https://react.dev) | App framework and UI |
| [typescript](https://www.typescriptlang.org) | Types |
| [tailwindcss](https://tailwindcss.com), [framer-motion](https://www.framer.com/motion/) | Styling and animation |
| [prisma](https://www.prisma.io) | Database ORM (Postgres on Supabase) |
| [zod](https://zod.dev) | Validation of all AI output and user input |
| [openai](https://github.com/openai/openai-node) | OpenAI-compatible client for Meta, xAI and OpenRouter |
| [swr](https://swr.vercel.app) | Live updates |
| [ical.js](https://github.com/kewisch/ical.js) | Reading calendar links (free/busy only) |
| [qrcode](https://github.com/soldair/node-qrcode), [nanoid](https://github.com/ai/nanoid) | Invite QR codes and codes |
| [vitest](https://vitest.dev), [puppeteer-core](https://pptr.dev) | Tests (unit; the 200-point browser check) |

Data: © OpenStreetMap contributors (ODbL) via Nominatim/Overpass; Google Places and Ticketmaster when keys are set.

## License

[MIT](LICENSE)
