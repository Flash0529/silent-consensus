> **Historical document (HackGT 13).** The product has since been renamed **Silent Consensus** and rebuilt messaging-first (accounts, chats, a private Hush chat, real places and events, Stripe chip-in, business admin). See [`README.md`](README.md) for how it works today and [`docs/HANDOFF.md`](docs/HANDOFF.md) for status.

# Quiet Consensus: Product and Build Spec

Plans everyone can say yes to.

HackGT 13 project (Sep 26 to 27, 2026). Social Good track and the Meta challenge ("Bringing People Closer Together with AI"). This doc captures everything decided so far about where the product is going: messaging, the web app, the business side, security, and the roadmap. Pair it with the original README (tech stack, planner pipeline, chip in math, data model) and PLAN.md.

---

## 1. What we're building

Quiet Consensus is an AI planner named **Hush** that lives in a group chat. Hush quietly notices when a plan isn't working for everyone, checks in with each person privately, then proposes one plan the whole group can accept. It never reveals whose limit was whose. If a plan runs over someone's budget, friends can cover the gap through an anonymous chip in.

Two modes:
- **Plan mode:** hangouts, dinners, team events.
- **Mediation mode:** roommate or coworker friction. Hush hears each side privately and proposes a fair way forward with no quotes.

Two audiences:
- **Friends** (free): friend groups, roommates, clubs.
- **Teams** (paid): workplaces, where the same quiet limits keep coworkers out of team events.

---

## 2. Messaging architecture (Twilio Conversations)

Decision: use **Twilio Conversations** for all texting. (See the decisions log for what we ruled out.)

### 2.1 Threads

| Thread | Who is in it | What happens there |
|---|---|---|
| **Group thread** | Everyone in the group plus Hush's own phone number (group MMS) | Normal group chat. Hush reads along, posts neutral check in messages, and posts the final plan. |
| **Private thread** (one per person) | One person and Hush's number (1:1 SMS) | The private interview. Anyone can DM Hush here at any time, not only when Hush reaches out. |

- Every group message hits our webhook, so Hush can watch for disparities.
- Web app users join the same conversations as **chat participants**, so people on the web and people texting share one thread.
- The web chat and the SMS thread for a person feed the **same interview state**. It doesn't matter which one they use.

### 2.2 Identity across web and text

- A person joins on the web by verifying their phone with a one time text code (Twilio Verify).
- That phone maps to one **User**, and that User maps to their **Member** row in each group. So web chat and texts are the same person.
- Phone numbers are PII: store a hash for lookup plus an encrypted copy for sending. Never store them in plain text.

### 2.3 Proactive check ins (disparity detection)

Hush reaches out on its own when it senses the group plan isn't working for someone.

**Step 1: cheap rules pass on every group message.** Triggers:
- Hedges: "maybe", "I'll see", "idk", "busy", "can't this week", "we'll see"
- Price or venue mentions (steakhouse, bar, a dollar amount) that could exceed common budgets
- Clashing suggestions (two different times or places on the table)
- Silence: someone hasn't replied after everyone else has, within a time window

**Step 2: LLM judge on the last N messages** (only if a rule fired). Output schema:

```ts
{ disparity: boolean, kind: "budget" | "diet" | "drinks" | "access" | "timing" | "conflict" | "unclear", confidence: number }
```

**Step 3: act, if confidence clears the threshold and the cooldown has passed.**

**The privacy rule (important):** Hush **DMs everyone in the group, never just the person who hesitated.** If only Maya gets a DM right after she says "busy", she feels singled out and anyone watching can guess why. So Hush:
1. Posts a neutral message in the group, for example: "Want me to find something that works for everyone? I'll check in with each of you privately."
2. Starts a private check in with every member.

Guardrails:
- Cooldown per group (starting point: 30 minutes) and a daily cap on proactive check ins.
- Anyone can mute proactive check ins for a group.
- Disparity events are logged as counts and types only, never message text.

### 2.4 Consent

- When Hush is added to a group, it introduces itself and explains that it reads the group to help plan.
- Anyone can reply STOP to remove themselves from Hush messages. HELP returns a short explainer.

### 2.5 Twilio limits to design around

- Group MMS is **US and Canada only**, on +1 long code numbers.
- **Max 10 participants** in a group MMS conversation, Hush included.
- Web users posting into the group appear to texters as coming from Hush's number, with the sender's name prefixed ("Omar: ..."), unless each web user gets their own Twilio number. Fine for the demo.
- A group MMS thread and a 1:1 thread with the same numbers should be able to coexist. **Confirm against Twilio's docs while building.**
- Trial accounts can only text numbers verified in the Twilio console. Add team phones ahead of the demo.
- Real US app texting needs A2P 10DLC registration (or toll free verification). That takes days, so it's post hackathon.

---

## 3. The web app

The web app is the hub. Texting is the lightweight way in for people who don't want an app. Three areas:

### 3.1 Chats (the messaging service)

- All your group threads and your private Hush thread in one place.
- Synced two ways with SMS through Twilio Conversations.
- Web users get the richer UI: lettered option cards, the plan card, votes, the chip in card, the share screen, and mock pay.
- Texters get the same content in plain text ("Reply A, B or C").

### 3.2 Your Hush (customization)

Where you teach Hush about yourself so it asks less.

**Standing info** (a persistent private vault):
- Usual budget, diet, drinking, access needs, schedule and availability, vibe preferences, travel limits

**How Hush behaves with you:**
- Tone: chatty or brief
- Quiet hours for DMs
- How proactive Hush can be in your groups

**How it's used:**
- For each new plan, Hush confirms standing info instead of re-asking ("Still under $15?"). Interviews get much shorter.
- **Personal vs work separation:** each person chooses which standing limits apply in work groups. An employer never sees the personal profile.

**Privacy model changes this requires:**
- **Real accounts.** Today identity is a per group device cookie. The phone verification code doubles as login.
- **Persistent vault.** Encrypted at rest, editable and deletable anytime, never shown to any group, never included in admin views.

### 3.3 Teams (the business side, sideloaded into the web app)

- Workspace spaces where an admin creates team groups.
- **Policy controls:** per event spend caps, approved venue lists, work friendly filter locked on.
- **Admin dashboard:** participation and plan counts only. Never answers, limits, budgets, or who chipped in.
- Mediation mode for coworker friction.

---

## 4. Business case

### 4.1 Why workplaces

The same quiet limits show up at work: budgets, diets, faith, sobriety, accessibility, caregiving schedules. Most people just skip the team event.

Use cases:
- **Team lunches and offsites:** one plan that fits every budget, diet and access need. Nobody has to email HR to explain.
- **New hire onboarding:** Hush asks new teammates what works for them, then plans their first team hangout around it.
- **Hybrid and remote meetups:** finds the time and place that work across schedules and commutes.
- **Coworker friction:** mediation catches small conflicts before they become escalations.

### 4.2 Professional benefits

- **Higher turnout:** events built around real limits mean fewer quiet no shows.
- **Inclusion without paperwork:** diet, faith, sobriety and access needs handled privately. No form needed for a team lunch.
- **Stronger ties across teams:** easier plans mean more of the casual time where trust actually gets built.
- **Less friction, earlier:** mediation catches small conflicts early.
- **Hours back for organizers:** no more polls, spreadsheets, and dietary reply all threads.
- **Privacy employees trust:** admins see participation, never personal answers.

Pilot metrics to track: event turnout, repeat attendance, organizer hours saved, conflicts resolved early.

### 4.3 Business model

| Plan | Price | Includes |
|---|---|---|
| **Friends** | Free | Friend groups and roommates, plan and mediation modes, quiet chip in |
| **Team** | [PRICE] per seat per month | Slack and Teams app, calendar sync and spend caps, work friendly filter |
| **Enterprise** | Custom | SSO, retention and audit controls, org wide policy, People team dashboard (counts only) |

**Go to market:** People and HR teams, employee resource groups, campus orgs and clubs. Land with free friend groups, then expand into the workplaces those friends work at.

---

## 5. Security and the rules layer

Three checks sit between what people type and what the group ever sees.

| Layer | Status | What it does |
|---|---|---|
| **1. Safety screen** | Built | Regex rules plus the model's own safety call; the stricter one wins. Threats and self harm get private support resources (988, the National DV Hotline, 911) and never enter the vault or the group pipeline. |
| **2. Work friendly filter** | Next | Handles explicit, violent, or harassing messages with a nudge, a rephrase, or a redirect (below). |
| **3. Leak guard** | In progress | A rule layer plus an AI judge block any group facing sentence that could reveal someone's private limit. Up to 2 regenerations, then a safe template. |

### 5.1 Work friendly filter behavior

| Message type | Hush's response |
|---|---|
| Clean | Pass through |
| Crude or heated, but with a real point underneath | Private **nudge** to keep it work friendly, plus a suggested **rephrase** with Use this / Edit / Keep private |
| Nothing to rephrase (explicit sexual content, gore, slurs) | Decline to use it and **redirect** back to the topic at hand |
| Real safety concern (threats, self harm) | Skip this filter entirely and use the safety screen's private resources path |

Example:
- User: "if someone takes my lunch from the fridge one more time I'm going to lose it"
- Hush: "Let's keep it work friendly. Want me to put it like this?"
- Suggested: "Food keeps going missing from the shared fridge. Could we try labels?"

Example of a redirect:
- User: [explicit message]
- Hush: "That one isn't something I can bring into a team plan. Back to Friday: lunch or after work?"

Rules:
- Nudges are always private. No public call outs.
- Filtered content never enters the vault, the planner, or the group.
- Moderation events are logged as counts and categories only.
- The filter is always on in Teams workspaces and optional in friend groups.

### 5.2 Platform security

Built:
- No accounts today: a signed httpOnly cookie per group; only a hash of the token is stored.
- One allowlisted group serializer (`toGroupSafe()`), with tests that seed private data and prove it never leaks.
- API keys stay server side; AI routes are rate limited per device.
- The AI trace logs counts, latency and labels, never private text.
- No route lists chip ins.

To add with Twilio and accounts:
- Verify Twilio's request signature on every webhook.
- Hash plus encrypt phone numbers.
- Rate limit per phone number.
- STOP and HELP keyword handling.
- Encrypted personal vault (Your Hush).

Enterprise roadmap: SSO, retention controls, audit logs.

---

## 6. Roadmap

| Stage | Channel | Notes |
|---|---|---|
| **Now** | Web app | Join by link or QR, no download. What we built at HackGT. |
| **Next** | SMS via Twilio Conversations; Slack and Teams | Group MMS plus private DMs; workspace groups, calendar sync, admin controls. |
| **Later** | iMessage and Google Messages overlay; RCS | An iMessage app and an Android overlay on Google Messages, so you tap Hush inside any group chat. Upgrade 1:1 threads to verified RCS through Twilio once the sender is approved (iPhone supports business RCS since iOS 18.1 on major US carriers). |

Note on RCS: business RCS is 1:1 only. A business sender can't join group chats, so the group thread stays on MMS or the web app while private interviews can move to RCS.

---

## 7. Build plan

### 7.1 Hackathon cut (for judging)

Build for real:
1. **Your Hush profile page** (plugs into the existing vault and interview fast paths)
2. **Twilio private DMs:** inbound webhook to interview agent to reply
3. **Twilio group thread:** create the group, Hush intro message, post the final plan

Mock and label as roadmap:
- Teams admin area (clickable mock)
- Full two way sync between web chat and SMS (show it in `/demo` instead)

Keep from the original plan if time allows: planner, leak guard, chip in math, `/demo` presenter view.

### 7.2 New API routes

| Route | Purpose |
|---|---|
| `POST /api/twilio/conversations` | Conversations webhook (onMessageAdded). Verify signature, route group vs DM, run disparity check or interview turn. |
| `POST /api/auth/verify/start` | Send a phone verification code |
| `POST /api/auth/verify/check` | Check the code, create or load the User, set the session |
| `GET, PUT /api/me/profile` | Read and update Your Hush standing info and behavior settings |
| `DELETE /api/me/profile` | Delete the personal vault |
| `POST /api/circles/[slug]/group` | Create the Twilio group thread for a circle and add Hush |
| `/api/teams/*` | Workspace, policy, and dashboard (mock for the hackathon) |

### 7.3 Data model additions (Prisma)

- **User:** `phoneHash` (unique), `phoneEnc`, `displayName`, `createdAt`
- **Profile** (Your Hush, private, encrypted): standing budget, dietary[], alcohol, stepFreeRequired, availability, vibe[], maxTravelMinutes, tone, quietHours, proactivity, `workShareFields[]`
- **Member:** add `userId`, `dmConversationSid`, `proactiveMuted`
- **Circle:** add `groupConversationSid`, `workspaceId`, `lastDisparityAt`, `disparityCountToday`
- **Workspace:** name, admin user ids
- **WorkspacePolicy:** `spendCapCents`, `approvedVenueIds[]`, `workFriendlyLocked`
- **DisparityEvent:** circleId, kind, confidence, createdAt (no text)
- **ModerationEvent:** memberId, category, action (nudge, rephrase, redirect, safety), createdAt (no text)

### 7.4 New environment variables

```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_CONVERSATIONS_SERVICE_SID=
TWILIO_PHONE_NUMBER=            # Hush's number, +1
TWILIO_VERIFY_SERVICE_SID=
PHONE_ENC_KEY=                  # key for encrypting phone numbers and the vault
DISPARITY_COOLDOWN_MIN=30
```

---

## 8. Decisions log

| Decision | Why |
|---|---|
| **Use Twilio Conversations** for group and DM texting | Supports group MMS with a real number, 1:1 SMS, and web chat participants in the same thread. Fastest path to a working demo. |
| **Dropped:** our own RCS server | RCS only reaches real phones through carriers and Google. Self hosting would mean acting as a carrier. |
| **Dropped:** Android default SMS app as an RCS gateway | Android has no public RCS API for third party apps. A default SMS app only gets SMS and MMS. |
| **Dropped:** bridging Google Messages (mautrix-gmessages) | Unofficial and reverse engineered, could break or get the account flagged, needs a phone always online, AGPL licensed. |
| **DM everyone on a disparity**, never one person | Prevents singling out and stops the group from guessing whose limit caused the check in. |
| **Personal and work profiles stay separate** | Employees won't trust Hush at work if employers can see personal limits. |
| **Label unbuilt features honestly** in pitch materials | Safety screen: built. Leak guard: in progress. Work friendly filter: next. Integrations: roadmap. |

---

## 9. Open questions

- Pricing for the Team plan (currently [PRICE]).
- Exact disparity thresholds and cooldowns; tune on real group chats.
- Whether friend groups get the work friendly filter on by default or opt in.
- Whether each web user should get their own projected Twilio number so they don't appear as Hush in group MMS.
- Confirm group MMS plus 1:1 coexistence on the same numbers in Twilio Conversations.
- A2P 10DLC vs toll free verification for launch.

---

## 10. Pitch materials made so far

- **Tri-fold board** (48 x 36 in, black background, neon outlines) with interactive pieces: lift the flap, scan and join the live group, anonymous dot poll. Plus a closed board "ad" face, a cutouts sheet, and a table sign.
- **Business PowerPoint** (19 slides, Morph transitions, calm periwinkle, apricot and sage palette): problem, solution, demo story, teams, integrations, coworker mediation, work friendly filter, privacy, rules layer, architecture, benefits, business model, messaging overlay roadmap, why AI, close.
- **Pitch cheat sheet** with walk by lines, a 30 second pitch, and judge Q&A.

Placeholders still to fill: [TEAM NAMES], [QR TO LIVE DEMO], [PRICE].
