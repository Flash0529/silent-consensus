# Start here

This is **Silent Consensus** (formerly Quiet Consensus, HackGT 13): a messaging app with an AI planner, Hush, that
checks with everyone privately and brings back one plan the whole group can say yes to. Live at
https://silentconsensus.world.

- **What it is and how it works:** [`README.md`](README.md) (features, privacy model, setup, env keys, layout).
- **What's been done and what's left:** [`docs/HANDOFF.md`](docs/HANDOFF.md) (§7 status log, §8 what's left).
- **AI assistants (Claude, etc.):** read the whole of `docs/HANDOFF.md`, starting with "For AI assistants", before
  changing code.

The `.env` file (database password and app secrets) is never committed. Get it from the project owner privately.
Keys are added through the owner's private keydrop page, never pasted into a chat.

## Prompt to paste into Claude

```text
I'm working on Silent Consensus. Before changing any code, read START_HERE.md, README.md and docs/HANDOFF.md
(starting with "For AI assistants"). Then tell me briefly what's built, what's left (HANDOFF §8), and what you
need from me. Don't commit or push without asking; never ask me to paste secrets into the chat; keep the privacy
rules in README "Privacy model" intact; update docs/HANDOFF.md §7 and §8 when something lands.
```
