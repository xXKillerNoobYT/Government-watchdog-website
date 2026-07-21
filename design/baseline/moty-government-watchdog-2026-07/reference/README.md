# Handoff: Government Watchdog — Civic Transparency Frontend

## Overview
Government Watchdog is an AI-powered civic-transparency web app for the Town of Alpine, Wyoming (and, by design, any US town/county/state). Motto: **"We Watch. We Report. You Decide."** It ingests public records (agendas, packets, minutes, videos), archives + hashes them, diffs changed documents, and publishes plain-English AI analysis with receipts: a live next-meeting board, a cross-government timeline, a promise-vs-action tracker for officials, a source vault with third-party verification, a two-sided (pre/post-meeting) newsletter with a synthesized 4-voice debate, alerts, and a location picker.

Every page ships **two complete skins** with a persistent Simple ⇄ Advanced toggle in the header:
- **Simple** = light "broadsheet newspaper" (senior-friendly, big serif type, print button, 90-day history window).
- **Advanced** = dark dashboard (dense, filterable, full archive back to 2019).

The demo is populated with the town's real **July 21, 2026 council agenda** (from municode) plus fixture history. A FIXTURE-MODE banner with per-level freshness timestamps sits atop every page.

## About the Design Files
The files in this bundle are **design references created in HTML** — working prototypes showing intended look, copy, and behavior. They are NOT production code to copy directly. The task is to **recreate these designs in the target codebase's existing environment** using its established patterns and libraries. The owner has a companion repo (`Government-watchdog-website`, TypeScript + Vite, with `docs/ui-design-system.md` defining a `--gw-*` CSS-token layer) — prefer implementing there, mapping the values below onto its token system. If starting fresh, a React + TypeScript SPA with CSS custom properties is the natural fit.

`support.js` is the prototype's runtime — ignore it entirely. Each `*.dc.html` file contains (1) an HTML template with `{{ hole }}` bindings and (2) a plain JS `Component` class at the bottom whose `renderVals()` holds all fixture data and interaction logic. Both are meant to be read, not shipped.

## Fidelity
**High-fidelity.** Colors, typography, spacing, copy, and interactions are final design intent. Recreate pixel-perfectly with the codebase's component library. (Two exceptions, marked lofi: `Wireframes.dc.html` — a storyboard — and `Explainer Video.dc.html` + `sidewalk-demo.jsx`/`animations.jsx`, a looping ~73s promo animation; treat those as concept references.)

## Screens / Views
Each page = one route, two skins. Shared dark chrome on every page: fixture banner → header (GW logomark 38px/10px-radius, GOVERNMENT / WATCHDOG / "AI-POWERED ANALYSIS" tagline; location pill; search box ⌘K; account chip "J. Citizen ✓ ID · manage"; Alerts chip with red badge → Alerts page; Simple/Advanced pill toggle) → nav row (active tab mint underline) → content (max-width 1200–1460px, 28px gutters) → footer (motto · "data refreshed …" mono · utility links). Shared light chrome: yellow fixture banner, date/place + account row, double-ruled masthead "Government Watchdog Updates", centered nav, double-rule footer.

### 1. Home (`Home.dc.html`)
- **Purpose**: Orientation + today's stakes. **Signed-out beta gate** (paper card: GW mark, "IN BETA", Sign in button, waiting-list note, location-locked-to-ID policy) gates BOTH skins; `gw_auth` in localStorage unlocks.
- **Advanced**: Civic Weather strip (status dot, week label, level filter pills All/Town/County/State); hero headline + live board for the July 21 meeting; issue cards; LATEST VERDICT card (red, R. Roe broken promise); **⚠ LANGUAGE WATCH — JUL 21 PACKET** card (3 tricky-phrase tiles: "…with ____________", "accounted for separately", "engagement agreement"); ▶ Demo button → Explainer Video.
- **Simple**: front-page broadsheet: lead story, "What they'll decide", sources/receipts card (reprocessed ✓ chips), history card with **edition-versions dropdown**, honesty tracker, search field with 90-day window note + "$25/yr Local Data Geek" upsell (price is being A/B tested — copy may change).

### 2. Fast Agenda (`Fast Agenda.dc.html`) — the core screen
- **Advanced, two boards** (isaac4alpine.com pattern):
  - **NEXT MEETING · LIVE BOARD** (left 430px col): title, "Tuesday, July 21, 2026 · 6:30 PM", venue + "streamed live on YouTube (@townofalpine)"; status tiles 2×2 (✓ Agenda posted Jul 17 9:04 AM · ▲ Attachment replaced (consultant eval → V2, Jul 18) · ! Votes possible (9 motions + 1 hearing) · ◌ Video ~2 days / analysis ~4 days); stat tiles (10 SECTIONS · 9 MOTIONS · 1 HEARING · 21 ATTACHMENTS · 1 ▲); LAST MEETING — JUL 7 row; buttons (Official agenda ↗ / Packet ↗ / Remind me); public-comment rules card. Below: ALSO COMING UP (P&Z Jul 28 ◌ agenda due Jul 24; County Commission Aug 3 ✓; next council Aug 4 ◌).
  - **WHAT'S ON THE AGENDA — JULY 21** (right): 8 item rows, numbers matching the official municode agenda (4.a hearing, 6 consent, 8.a–8.i actions). Each row: mono item number (mint), bold title, action chip (colored outline: PUBLIC HEARING red / FINAL VOTE gold / ONE MOTION grey…), **highlighted AI-analysis block** (gold-tinted `#1B1708`, 1px `#4a3c14` border, 3px `#ECC35C` left bar, radius 0 8px 8px 0, text `#EDE4C8`, prefixed by the gold **AI ANALYSIS badge**), **⚠ watch-the-language line** (salmon `#E8A99E`, bold `#EE7A6D` lead), flag chips, **PROCESS ladder** (mono chips: ✓ done green / ● tonight gold / ▲ flagged red / ◌ ahead grey — e.g. "1st — Jun 23 ✓ · 2nd — Jul 7 ✓ · 3rd — tonight ●"), right button column (⊕ Track toggle · Analysis › · Attachments (n) ↗ · Timeline ›).
  - **Analysis popup** (click title/Analysis): 800px modal — action chip, Follow pill + split-rule note, gold "What's really being decided" block, red **⚠ LANGUAGE WATCH** block, PAST MEETINGS & ANALYSES (newest first; per-row ▶ video-timestamp chips like "▶ 2nd reading · 0:41:20" or vidNote "document event — no video"), CONNECTED ISSUES pill links, WHO DECIDES, RECEIPTS list, footer buttons.
  - **ISSUE TRACKER kanban** (full width): 7 stage columns (CAPTURED → AGENDA POSTED → PACKET AVAILABLE → PUBLIC COMMENT → VOTE SOON → VOTED → FOLLOW-UP), 252px cards with level color left-bar, last:/next: meeting lines, flags, ⊕ Track + "Open card ›" (opens issue-card modal: last/next tiles, flags, follow pill, links).
- **Simple**: numbered plain-English list (34px navy number discs), same highlighted AI-analysis blocks in light colors (`#FFF8E4` bg, `#D9A400` bar), two-column "where things stand" digest.

### 3. Timeline (`Timeline.dc.html`)
- 3 lanes (TOWN mint / COUNTY amber / STATE blue) across a Jul 6 → Aug 5 axis; 13-px dots (type-colored: green posted/passed, red changed/deadline, gold vote, blue meeting) with label chips. **Hover a dot** = that issue's whole run highlights (others dim to 0.22) and dashed mint SVG connector lines draw across lanes; **click** = filter to that issue. Filter suite: search, issue dropdown (incl. `ludc`, `ami`), event-type dropdown, level toggles, zoning-thread preset, WINDOW pills (Next 3 weeks default · 90 days · year · All records → 2019; Simple shows only the first two), sort toggle, clear. Event list below groups by day with PR-style clickable `#issue` tags; deep links `Timeline.dc.html?issue=<slug>`.

### 4. Boards, 5. Power Tracker, 6. Source Vault, 7. Watchlist
- **Boards**: directory of tracked bodies (meeting cadence, members, links).
- **Power Tracker**: officials list (placeholder names) sorted broken-first; profile with score donut, kept/broken/partial bars; PROMISE vs ACTION verdict card **gated behind an "AI-GENERATED ANALYSIS — READ FIRST" interstitial**; QUOTE LEDGER with "FOUND BY AI — VERIFY SOURCE FIRST" chip + verify-source links; VOTE/ACTION table — Kept/Broken rows click open a detail modal (AI-hallucination disclaimer first, then promise/action/how-it-lines-up + receipts + challenge link).
- **Source Vault**: header stat chips (1,248 sources / 98.6% hash verified / 6 open flags) with hover explainer cards + click-to-pin detail panels; TRANSPARENCY ALERTS · 6 (incl. Cedar St property-notice flag, "if it can happen to your neighbor…" line, Browse-all button); DOCUMENT VERSION COMPARE (paper-styled v1/v2 diff, word-level toggle, "100% CODE — NO AI WAIT" chip, "View our copy — v1/v2" buttons); VAULT LEDGER (sha hashes, video status ladder "pending release 0–2d → pending transcript 2–7d → missing 7d+", sample-browser expander); VERIFICATION DETAILS (Wayback 3rd-party snapshot + original .gov URL).
- **Watchlist**: user's tracked issues/officials digest.

### 8. Newsletter (`Newsletter.dc.html`) — richest page
- Dark digest, Issue No. 21 (Jul 20): NEWS BY MEETING board (Pre ⇄ Post toggle; per-meeting cards with pair-jump links "‹ its pre-meeting brief" / "post side ◌ pending"; PENDING MEETING state); THE ROUNDTABLE — 17-line 4-voice AI debate (speechSynthesis, per-voice pitch/rate, transcript collapsed by default behind "Show transcript ▾", ≈15-MIN LISTEN chip, position persisted); FEATURED story with level switcher (Town/County/State preview cards) + Pre/Post edition toggle — the pre edition is the **whole Jul 21 agenda in municode format** (numbered sections 1–10, lettered items, quoted suggested motions, attachment links, and per-item: gold AI ANALYSIS badge, "Changed since last meeting", eval **v1 vs V2 side-by-side diff**, "Public comment so far", red "⚠ Watch the language" callout, "Did they ask? ◻ …" checklist that gets ✓/✗ in the post edition); 6-lens grid — light/dark pairs per ideology (Conservative/Progressive: TODAY'S WY PARTY LENS vs FOUNDING LENS · DRIFT CHECK; Libertarian light; Constitutional dark) with the drift legend; MEETING LEDGER card (agenda ✓ · pre ✓ · post ◌ per date); references list; ARCHIVE bar (Simple = 90 days, Advanced → 2019). Light skin mirrors the boards/lenses in broadsheet styling (its featured story still shows the Jul 7 edition — port pending).

### 9. Location (`Location.dc.html`)
- Breadcrumb State › County › Region › Town; quick selects; STEP 1 coverage board (✓ today processed, backlog % per level, "speed = demand + funding · fund your area ›"); USA 11-col tile grid + WY 23-county grid + Star Valley town list (sample vote-lean coloring, selection ring); persists `gw_location`.

### 10. Alerts (`Alerts.dc.html`)
- UNREAD cards (tinted by severity: ▲ red attachment-replaced, gold meeting-eve, green agenda-posted) with "✓ read" buttons + Mark-all; EARLIER feed (reverse-chronological, dimmed); DELIVERY settings (email ≤1 day of agenda ON, ▲ text alerts ON, meeting-eve reminder ON, daily digest OFF); WHAT TRIGGERS AN ALERT rules + live tracked-issue count. Light skin = "New since you last looked" list.

## Interactions & Behavior
- **Mode toggle** on every page persists to `gw_home_mode` and swaps the entire skin.
- **Tracking**: ⊕ Track / ✓ Tracking toggles (agenda items, kanban cards, popups) share one store; copy promises alerts on future agendas and "if an issue splits you follow both halves."
- **Modals** (agenda analysis, issue card, vote detail): fixed overlay `rgba(3,6,10,.74)`, centered card ≤88vh scroll, close on ✕ / backdrop / Escape.
- **AI gating**: Power-Tracker verdict + vote details render an amber consent interstitial before showing AI conclusions; quote ledger and all AI text carry the gold badge; disclaimers mention hallucination risk explicitly.
- **Hover tooltips** (Source Vault stats): show on mouseenter, suppressed while pinned; click toggles pinned panel.
- **Timeline hover-runs**: see §3; transitions `opacity .15s`.
- **Debate player**: play/pause/prev/next/restart, per-voice `speechSynthesis` (Narrator 1.0/1.0, Conservative 0.72/0.97, Progressive 1.28/1.06, Libertarian 0.9/1.1 pitch/rate), clicking a transcript line jumps; position saved.
- **Print**: light skins expose a Print button (`window.print()`).
- **Auth**: signed-out → beta gate; Sign in sets `gw_auth`; location "change my place 🔒" explains ID-lock policy (driver's-license address; support to change; paid/beta exempt).
- **Video status ladder** everywhere video is referenced: pending release (0–2d) → pending transcript (2–7d) → missing (7d+, flagged).

## State Management
localStorage keys (all JSON unless noted):
- `gw_home_mode` — `"simple" | "advanced"` (string)
- `gw_location` — `{state, county, region, town}`
- `gw_tracked` — `{ [issueSlug]: true }`
- `gw_auth` — display name string; absence = signed out
- `gw_alerts_read` — `string[]` of alert ids
- `gw_debate_pos` — line index (string int)
URL param: `?issue=<slug>` pre-filters the Timeline (slugs: all, thread, moratorium, fees, str, landuse, annexation, water, permits, council, ludc, ami).
Data fetching (production): agendas/packets/minutes/videos per municode + town site; nightly re-fetch + sha-256 re-verify; diffs are **deterministic code** (no AI in the loop) — AI writes summaries/labels only, with claimStatus verified vs AI-presented per the repo's editorial contract. **No person-naming in AI analyses** — real names appear only in verbatim agenda text; scored officials in the tracker are placeholders by policy.

## Design Tokens
**Typography**: Public Sans (UI, dark skin; weights 400–800) · Newsreader (serif, light skin; 400–700 + italic) · IBM Plex Mono (dates, hashes, item numbers; 400–500). Google Fonts. Body 14px/1.5 dark, 16–17px/1.55 light. Section labels: 11px/800/letter-spacing 1.4px.
**Dark palette**: bg `#0B0F14`, surface `#12181F`, inset `#141B23`/`#0E1319`, borders `#232C37`/`#1F2833`/hover `#33404E`, text `#ECF1F7`/`#C3CDD9`/muted `#8D99A7`; header bg `#0D1218`, hairline `#1B232D`.
**Light palette**: desk `#F3EDDD`, paper `#FBF7EB`, card `#FDFAF1`, ink `#1E1C17`, secondary `#4A463C`/`#6E685B`, rules `#D8D0BC`/`#E2D9C2`, navy accent `#1A4D8F` (hover `#0F3568`).
**Level colors** — dark: town `#4ED8C3`, county `#E5A83B`, state `#7DB1FB`; light: `#0E7A6E` / `#A36A10` / `#274F9B`.
**Trust tones** — dark: alert `#EE7A6D` (bg `#1D1412`, border `#52302B`), ok `#63D68F` (bg `#101820`, border `#1F3A2C`/`#2C5A3E`), caution `#ECC35C` (bg `#201A0E`, border `#4a3c14`); light: red `#A33327`/`#7B241C` (bg `#FDECEA`, border `#C0392B`), ok `#1E4620` (bg `#E8F0E8`), caution `#7A5B00`/`#5C4500` (bg `#FFF3CD`, line `#D9A400`).
**Lens colors (6)**: con-today `#EE7A6D`, con-founding `#8a4438` (bg `#140A08`), prog-today `#7DB1FB`, prog-founding `#4a6da8` (bg `#0B1220`), libertarian `#ECC35C` (bg `#2A2310`), constitutional `#c9a94f` (bg `#151005`); light-mode equivalents in the Newsletter lens grid.
**AI badge**: dark `background:#ECC35C; color:#062019; 9.5px/800; letter-spacing .6px; radius 3px; padding 0 6px`; AI-analysis block: bg `#1B1708`, border `#4a3c14`, left bar 3px `#ECC35C`, text `#EDE4C8`. Language-watch: `#EE7A6D` bar, bg `#1D1412`, text `#F0D9D4`, badge bg `#EE7A6D`/text `#160B09`.
**Radii**: cards 14px, inner tiles/rows 9–11px, buttons 7–9px, pills 999px, chips 4–5px. **Selection**: mint bg, `#062019` text. Shadows: modals `0 28px 90px rgba(0,0,0,.6)`; tiles flat.
**Spacing**: 4/6/8/10/12/14/16/18/20/28 px scale; card padding 16–20px; grid gaps 8–16px.

## Assets
No raster/SVG assets — Google Fonts + unicode glyphs (✓ ▲ ◌ ◻ ⚠ ▸ ▶ ⌕ ⟳ ◆ ★) only. The GW logomark is typographic (white rounded square + "GW"). Meeting videos link to the town's YouTube (@townofalpine); documents link to municode/mccmeetings blob URLs in production.

## Files
- `Home.dc.html`, `Fast Agenda.dc.html`, `Timeline.dc.html`, `Boards.dc.html`, `Power Tracker.dc.html`, `Source Vault.dc.html`, `Newsletter.dc.html`, `Watchlist.dc.html`, `Location.dc.html`, `Alerts.dc.html` — the ten routes, each with both skins and all fixture data in the bottom `<script>`.
- `Explainer Video.dc.html` + `sidewalk-demo.jsx` + `animations.jsx` — looping promo animation (lofi reference).
- `Wireframes.dc.html` — storyboard sketches (lofi reference).
- `support.js` — prototype runtime; do not port.
