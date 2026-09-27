> These are the original HackGT 13 design references (the app was called Quiet Consensus then; it is now **Silent Consensus**). The live app follows them for look and feel; flows have since changed (see the main README).

# Quiet Consensus design reference

Eight phone screens (390×844), exported from the design canvas. Open them as reference only: the `<x-dc>`, `<helmet>` and `data-dc-script` wrappers are design-tool markup, and the inline styles hold the real values.

| File | Screen | Route |
|---|---|---|
| Main.dc.html | 1 · Welcome | `/` |
| Join.dc.html | 2 · Join from a link | `/j/[slug]` |
| Interview.dc.html | 3 · Private chat (Maya) | `/c/[slug]/chat` |
| Voice.dc.html | 4 · Voice reply (Jordan) | `/c/[slug]/chat` |
| Planning.dc.html | 5 · Hush is planning (group) | `/c/[slug]` |
| Plan.dc.html | 6 · The plan (group) | `/c/[slug]` |
| ChipIn.dc.html | 7 · Quiet chip-in (Priya) | `/c/[slug]/chat` |
| Share.dc.html | 8 · Your share (Maya) | `/c/[slug]/share` |

Demo numbers used across screens: $25 base share; Maya's limit $15; a $10 quiet pool (Omar $5, Priya $5) brings Maya to $15.
