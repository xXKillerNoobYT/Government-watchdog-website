# GOV-654 / GOV-657 — App-Wide Design Language + Home Dashboard UX Spec

**Issue:** GOV-657 (chain head 1/5 of GOV-654 look-and-layout). **Author:** UXProductDesigner.
**Scope:** spec/docs only — no production CSS/TS in this issue. Implementation is the blocked leg 2/5.
**Stage:** reviewer-internal Alpine app only. Public launch stays gated on Isaac via GOV-420. `noindex` posture unchanged.
**Design source of record:** the 10 `.dc.html` wireframes attached to GOV-655 (owner-locked set, card `confirmation:GOV-655:pages:v1`, Option A accepted 2026-07-07). Primary file: `Home.dc.html` — Isaac: *"this is the Look Im after and the Design"* (small changes expected in some areas).
**Prior design-system baseline this spec extends:** `docs/ui-design-system.md` §1–§11 and `src/ui/tokens.ts` (`--gw-*` custom properties, light + dark, floors).

---

## 0. What this spec is (and is not)

Isaac's wireframe set defines a **new visual language** (two audience modes, a mint-accent dark dashboard, a serif light "broadsheet") and a **major IA expansion** (10 pages). This chain (GOV-654) delivers only:

1. The **design language**, expressed as token values and component patterns over the existing `--gw-*` token layer (§1–§4).
2. A **persistent app shell + navigation** for the shipped surfaces (§5).
3. The **new Home dashboard** with a strict data-honesty map (§6).
4. **Restyle application map** for the 6 existing routed surfaces (§7).

Everything else in the wireframes — new IA pages and risk-gated features — is **named and routed, not built** (§9). Cards remain presentation nodes over the concept graph; no trust semantics, source-trail behavior, or publication states change anywhere in this chain.

### 0.1 Wireframe fingerprint table (evidence)

Attachment IDs on GOV-655 (list API returns `filename: null`; fingerprinted by content):

| Attachment ID | File | Page |
|---|---|---|
| `3f9bcf6a-3944-48ad-b1d9-68196289dff1` | Home.dc.html | **Home dashboard (PRIMARY)** |
| `1f19a030-c97a-489d-a220-28217497f57e` | Fast_Agenda.dc.html | Fast Agenda |
| `b9ec4ff4-0a2a-4a4f-916e-bd73ba9b32cd` | Timeline.dc.html | All-government timeline |
| `2bfe03ad-d0a7-4987-a84e-868f9e348471` | Boards.dc.html | Boards directory/detail |
| `29c294aa-d5d8-4251-88cf-ef5eac739d1e` | Power_Tracker.dc.html | Power Tracker |
| `ff346bf9-df88-446b-b1b3-3212566b19be` | Source_Vault.dc.html | Source Vault |
| `982bfc98-6481-48bc-8272-bb29d15ec0d2` | Newsletter.dc.html | Newsletter |
| `ad6429b2-3cd9-4496-a49a-47331f368cce` | Watchlist.dc.html | Watchlist |
| `6003e3c9-98e9-4624-a6ad-59661046cda1` | Location.dc.html | Location onboarding |
| `fdd0ad9a-81e3-461c-85c0-037b5ce62a8a` | Wireframes.dc.html | MASTER CANVAS (7 families / 20 layouts; Issue Detail frames `2d` + `3b` per Option A) |

**Precedence rule:** the 9 per-page `.dc.html` exports are the refined, authoritative visual values (real fonts, final hex). The master canvas is a round-1 hand-sketch (placeholder cursive fonts; its own annotation says *"Real serif in hi-fi"*) — it is authoritative only for what the page exports don't cover: the **Simple/Advanced mode rules**, the **mobile navigation pattern**, the **Issue Detail frames** (Option A), and the designer's stated principles. Where hex values differ slightly (canvas `#4dd6c1` vs export `#4ED8C3`), the page exports win. Notably the canvas annotates its dark frames as *"dark tokens from your repo's GOV-438 spec — mint accent, level colors teal/amber/blue"* — the wireframes were deliberately built on our shipped design system.

**Designer principles recorded on the canvas (verbatim, binding):**
- *"the 'what happens next' box is the loudest thing on the page — per your accessibility rule"*
- *"evidence outranks narrative — nothing is claimed above the receipts"*
- *"every verdict shows its receipts before the label — 'no broken-promise badge without a saved quote + a recorded action + sources'"* (UI enforcement of the safety rule — and §9.2 still gates the feature itself)
- *"grandma and the data nerd read the same truth — just dressed differently"* (the two-mode doctrine)
- *"reads like a bank statement for public records — boring on purpose, trustworthy by design"* (vault/ledger surfaces)

---

## 1. The two-mode model (the core design decision)

Every wireframe page contains **two complete render trees**:

- **Advanced mode** — a dense, dark, mint-accent dashboard (Public Sans, data-forward, for power users/reviewers).
- **Simple mode** — a light, serif "weekly newspaper" broadsheet (Newsreader, plain-English-first, printable, for ordinary residents).

The toggle is persisted in `localStorage` (`gw_home_mode`) and is shared across pages. Newsletter defaults to Simple; all other pages default to Advanced.

The master canvas states the mode rules verbatim (frame 2c — binding):

> *"the toggle lives top-right on every page · Simple = light paper, serif, plain English, big type, few controls · Advanced = dark panels, dense data, filters & scores · both share ONE url per record, mode is remembered per user"*

Consequences: the mode toggle sits top-right in the shell on every page; **mode never forks routes** (one URL per record — Simple and Advanced render the same route, same data, same receipts); mode persists per user. The canvas also sketches a "Big Print" Simple extreme (*"for the 75+ crowd: nothing smaller than newspaper body type, max 3 cards, giant buttons"*) — recorded as a future accessibility variant, not in this chain.

**How this maps onto the shipped theme system.** The app already has a System/Dark/Light theme toggle (`theme-toggle.ts`, `data-theme` on root, GOV-438/440). Simple/Advanced is **not the same axis** — it is an audience/density mode that *implies* a palette. Decision for this chain:

1. **Advanced mode = the app's dark theme, restyled.** The dark `--gw-*` values are re-pointed at the wireframe Advanced palette (§2.1). Every existing surface inherits it via the token layer — that is the app-wide part of "the look."
2. **Light theme = refreshed with broadsheet-derived paper values (§2.2)** so light mode belongs to the same family. Existing surfaces keep their layouts and their sans-serif UI type in light mode; the full serif broadsheet *treatment* (masthead, columns, print) ships only on Home Simple mode in this chain.
3. **The Simple/Advanced toggle appears in the app shell** (§5) and, in this chain, switches **Home** between its two wireframe layouts and sets the theme (Advanced→dark, Simple→light). Per-page Simple treatments for other surfaces are follow-up chain work (§9), so on non-Home surfaces the toggle behaves as the theme switch with the mode label — no dead layouts, no fake density switch.
4. The existing three-way theme control collapses into this model: mode picks the palette; a user's explicit theme override (`data-theme`) still wins (specificity model in `tokens.ts` is unchanged).

This keeps one token layer, one source of truth, zero forked stylesheets — the same "value swap, names stay" doctrine that shipped GOV-427/GOV-440.

---

## 2. Design language → token mapping

Token **names and structure** in `src/ui/tokens.ts` survive. This chain re-points **values** and adds a small set of new tokens the wireframes require. Zero raw hex outside the token block (grep-verifiable, same as GOV-427).

### 2.1 Dark (Advanced) color tokens — new values

| Token | Current dark | **New dark value (wireframe)** | Role |
|---|---|---|---|
| `--gw-page-bg` *(new)* | — | `#0B0F14` | App page background behind cards |
| `--gw-surface` | `#15181d` | `#12181F` | Card/panel background |
| `--gw-surface-subtle` | `#1e232b` | `#141B23` | Inner cards, inputs, list rows |
| `--gw-surface-well` *(new)* | — | `#10161D` | Segmented-control wells, column wells |
| `--gw-header-bg` *(new)* | — | `#0D1218` | App shell header |
| `--gw-text` | `#f2f4f7` | `#ECF1F7` | Primary text |
| `--gw-text-secondary` | `#ced5de` | `#C3CDD9` | Secondary text |
| `--gw-text-muted` | `#a4adba` | `#8D99A7` | Muted captions, dates |
| `--gw-accent` | `#8ab4f8` | `#4ED8C3` | **Mint** — brand accent, active nav, kickers, focus ring |
| `--gw-accent-text-on` | `#0b1b30` | `#062019` | Text on mint fill |
| `--gw-border` | `#333a44` | `#232C37` | Decorative container border |
| `--gw-border-subtle` | `#262c34` | `#1F2833` | Faint separators |
| `--gw-border-strong` | `#8a93a0` | `#8D99A7` | State-bearing border (5.99:1 on `#141B23` ✅) |
| `--gw-ok-text` | `#8fe6a8` | `#63D68F` | verified / kept / posted |
| `--gw-ok-bg` | `#14241a` | `#101820` | ok tint |
| `--gw-caution-text` | `#f5cf6a` | `#ECC35C` | AI / vote-possible / partial |
| `--gw-caution-bg` | `#2a2410` | `#201A0E` | caution tint (also fixture banner) |
| `--gw-stop-text` | `#f6a39a` | `#EE7A6D` | changed / deadline / disputed |
| `--gw-stop-bg` | `#2a1512` | `#1D1412` | stop tint |
| `--gw-stop-border` | `#e57368` | `#EE7A6D` | stop border (6.50:1 ✅ UI) |

New **jurisdiction level** tokens (the wireframes' Town/County/State color code — used by chips, filter pills, lane labels):

| Token | Dark value | Light value | Role |
|---|---|---|---|
| `--gw-level-town` | `#4ED8C3` | `#0E7A6E` | TOWN |
| `--gw-level-county` | `#E5A83B` | `#8F5D0E` *(AA fix, see §8)* | COUNTY |
| `--gw-level-state` | `#7DB1FB` | `#274F9B` | STATE |
| `--gw-info-text` *(new)* | `#7DB1FB` | `#1A4D8F` | in-body evidence/"receipts" links, info chips |

Tinted wells + their decorative borders (mint `#0F1E1B`/`#2E6B60`, red `#1D1412`/`#52302B`, gold `#201A0E`/`#4a3c14`, green `#101820`/`#1F3A2C`, blue `#101A2B`/`#31527e`) enter as `--gw-tone-*-well` / `--gw-tone-*-line` tokens. **Classification rule (WCAG 1.4.11):** these chip/well borders are *decorative reinforcement* — every state they accompany is carried by a word + glyph + tone text at AA contrast (§3 doctrine of `ui-design-system.md` is unchanged). Any border that is the *sole* state carrier must use the tone **text** color (≥ 4.5:1, so ≥ 3:1 UI) or `--gw-border-strong`.

### 2.2 Light (Simple/broadsheet-derived) color tokens — new values

| Token | Current light | **New light value** | Role |
|---|---|---|---|
| `--gw-page-bg` *(new)* | — | `#F3EDDD` | Canvas behind the paper column |
| `--gw-surface` | `#ffffff` | `#FBF7EB` | Paper background |
| `--gw-surface-subtle` | `#f7f9fc` | `#FDFAF1` | Boxed panels |
| `--gw-text` | `#1a1a1a` | `#1E1C17` | Ink |
| `--gw-text-secondary` | `#333333` | `#4A463C` | Secondary ink |
| `--gw-text-muted` | `#5b6470` | `#6E685B` | Muted ink (5.17:1 ✅) |
| `--gw-accent` | `#1a4d8f` | `#1A4D8F` | **Unchanged** — wireframe light uses the shipped GW blue verbatim |
| `--gw-border` | `#d0d7e0` | `#D8D0BC` | Paper rules |
| `--gw-border-subtle` | `#e7ebf1` | `#E2D9C2` | Faint paper rules |
| `--gw-rule-strong` *(new)* | — | `#1E1C17` | Broadsheet 1.5–2.5px black rules (masthead, section heads) |

The light **trust tones are unchanged** — the wireframe's Simple mode reuses the shipped palette verbatim: ok `#1E4620`/`#E8F0E8`, caution `#7A5B00`·`#5C4500`/`#FFF3CD`/`#D9A400`, stop `#7B241C`/`#FDECEA`/`#C0392B`. This is strong evidence the wireframes were built on our design system; the restyle risk is much lower than a from-scratch repalette.

### 2.3 Typography tokens + font strategy

Wireframes load **Newsreader** (serif; Simple body/headlines), **Public Sans** (sans; all Advanced UI + light-mode UI labels), **IBM Plex Mono** (mono; fixture banner, dates, hashes, timeline axis, agenda numbering) from `fonts.googleapis.com`.

**Font strategy — self-host, no third-party runtime beacons (hard requirement):**

- Vendor WOFF2 subsets (latin) via `@fontsource/newsreader`, `@fontsource/public-sans`, `@fontsource/ibm-plex-mono` (all SIL OFL 1.1 — license-compatible). Served from our origin as static assets through the Vite build; **zero requests to Google/other third parties at runtime** (privacy + reviewer-internal `noindex` posture; a gated app must not leak reviewer traffic to font CDNs).
- Weights budget (keep total ≤ ~350KB): Public Sans 400/600/700/800; Newsreader 400/600/700 (+400 italic); IBM Plex Mono 400/500.
- `font-display: swap` + preload the two above-the-fold families per mode.
- New tokens: `--gw-font` → `'Public Sans', system-ui, sans-serif`; `--gw-font-serif` *(new)* → `'Newsreader', Georgia, 'Times New Roman', serif`; `--gw-font-mono` *(new)* → `'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace`. If webfonts fail to load, the fallback stacks keep every layout legible — no FOIT.

**Type scale:** the existing `--gw-text-*` rem scale survives; add `--gw-text-kicker` (11px/800/letter-spacing 1.4px — the section-kicker style) and `--gw-text-display` (clamp-based broadsheet masthead/headline size). **Floors:** `BADGE_MIN_FONT_PX = 13` and `DRAWER_TAP_MIN_PX = 44` are unchanged and win over the wireframe. The wireframes draw many 9.5–11px chips; **implementation must snap all state-bearing chips/badges up to ≥ 13px** (`--gw-text-badge`). Non-interactive decorative section kickers may use 11–11.5px (they are headings, not state chips). All tap targets ≥ 44×44px regardless of wireframe visual size.

### 2.4 Spacing, radii, elevation

- Radii: add `--gw-radius-lg: 14px` (outer cards) alongside existing `4px/8px/999px`; inner cards use `--gw-radius` 8–10px range snapped to 8px (wireframe 9–11px drift consolidates to the token, same doctrine as GOV-427).
- Spacing: existing `--gw-space-1..6` scale holds; the wireframes' 16px card gap / 18px card padding snap to `--gw-space-5`/`--gw-space-6`.
- Elevation: the language is **essentially shadow-free** — hierarchy comes from surface steps (`page-bg < surface < surface-subtle`) and the border ladder, exactly like the GOV-600 board-chrome ladder. Only two glows exist: timeline event dots (`0 0 0 2px <color>55`) and selection rings. No new box-shadow system.
- Max-widths: app shell content `1460px` (Advanced), broadsheet column `1150px` (Simple Home).

### 2.5 Component inventory (the shared language)

Patterns every restyled/new surface draws from (all state labels verbatim from the wireframes; **icon + word, never color alone** — §3 doctrine unchanged):

| Component | Description | Status language (verbatim) |
|---|---|---|
| **Level chip** | Bordered text chip in level color, 4px radius | `TOWN` / `COUNTY` / `STATE` |
| **Level filter** | Segmented pill group; selected = solid level color + dark tinted text | `All · Town · County · State` |
| **Verification badges** | Tone chip w/ glyph + word | `✓ verified`, `✓ archived`, `✓ saved · AI-read text`, `▲ Packet changed`, `▲ changed after posting`, `⚠ late`, `missing`, `! Vote possible`, `✓ Agenda posted` |
| **AI disclosure chip** | Gold/caution chip, always adjacent to the AI-derived text. Master-canvas legend makes AI the **only filled chip** in the status set — visually distinct on purpose; keep that distinction | `AI`, `AI summary`, `AI — scripted from the record` |
| **Correction/unverified chips** | The canvas legend's full trust set maps 1:1 onto our backend-driven states | `✓ VERIFIED`, `AI`, `⚠ UNVERIFIED`, `↺ CORRECTED`, `▲ HIDDEN CHANGE` |
| **Receipts link** | Info-blue link to source evidence; external `↗`, internal `›` | `receipts (N)`, `sources (N)`, `Official agenda ↗`, `Timeline ›` |
| **Deadline chip** | Red/gold urgency chip | `3 DAYS`, `IN 1 DAY`, `COMMENT CLOSES JUL 10` |
| **Status-dot legend** | 4-color dot legend | green `posted/passed` · red `changed/deadline` · gold `vote possible` · blue `hearing/meeting` |
| **Widget card** | 14px-radius surface card; kicker header row + "View all" link | kicker in mint (dark) / black-ruled (light) |
| **Timeline rail** | Mono date gutter + dot column + event text; dashed dot = future | `✓ archived`, `vote possible` |
| **Fixture/DEV banner** | Mono, full-width, caution tones, top of page | `FIXTURE MODE — sample Town of Alpine records · not a live read · every label comes from the archive, never recomputed` |
| **Empty state** | Plain-language line + recovery action | e.g. "Nothing matches those filters in this window. Clear the filters…" |
| **Broadsheet furniture** (Simple) | Masthead, kicker rules, numbered "things to know", story card with `PLAIN-ENGLISH SUMMARY (AI)` / `WHY IT MATTERS` / `NEXT ACTION` columns | `✓ N sources verified` |

Editorial voice strings that recur and should be treated as brand copy (not restyled away): *"We Watch. We Report. You Decide."*, *"Holding power accountable. Amplifying transparency."*, *"plain English first · official text one tap away"*, *"nothing is cited without a receipt"*.

---

## 3. Hard invariants (restated — the restyle must not touch these)

1. **Verbatim trust/status labels** — `ui_status`/`provenance_status`/`confidence_label` values render backend-driven words exactly; the new chip visuals are paint only.
2. **AI-content labels** always visible, adjacent to the AI-derived content, outside any blur region.
3. **Fixture/DEV banners** keep text + `role=status`; the wireframes themselves carry a FIXTURE MODE banner — adopt its mono styling, never its removal. Real-data surfaces keep the honest-empty + `?demo=sample` DEV-banner pattern (GOV-606).
4. **Gated access fail-closed** — `#/` landing gate runs before any app DOM; public lane renders zero cards; unauthenticated users never see civic dashboards.
5. **Public-lane zero-leak + `noindex,nofollow`** unchanged. Self-hosted fonts are part of this posture (§2.3).
6. **Click-to-reveal blur**, `prefers-reduced-motion`, badge ≥ 13px, tap ≥ 44px floors all hold.
7. **No fabricated civic data, ever** — every Home widget obeys the data-honesty map (§6.3); gated features are **absent from the DOM**, not CSS-hidden (SecPriv doctrine from GOV-357).

---

## 4. Responsive rules (viewport floor: desktop 1440×900 · tablet 768×1024 · mobile 390×844)

The wireframes are desktop-drawn (1460px). This spec defines the collapse:

- **Home Advanced 3-col grid** (`400px | 1fr | 352px`): tablet → 2 columns (left column full-width row on top, center+right side-by-side); mobile → single column in priority order: Civic Weather → Fast Agenda → Active Issues → Timeline preview → Transparency alerts → Source Vault (gated modules absent).
- **App shell nav**: desktop/tablet = full tab row (tablet may scroll horizontally with edge-fade). **Mobile = bottom tab bar** per the master canvas G-family frames (fixed, 5 slots, each ≥ 44px): `Home · Boards · Timeline · Cards · More` — `More` opens Topics + Newsletter (+ theme/mode controls). Active tab bold + accent. The canvas draws this pattern explicitly (`🏠 Home / ⚡ Agenda / ═ Timeline / 👁 Power / ≡ More`); our slot contents substitute the shipped surfaces.
- **Broadsheet Simple**: single column under 768px; masthead scales via clamp; Print button hidden on mobile.
- **Level filter pills** wrap, never truncate.
- All three viewport classes must appear in the implementation leg's screenshot evidence (company viewport floor).

---

## 5. App shell + navigation spec

**Today:** each surface renders its own ad-hoc header; navigation is by hash-links inside pages. **Target:** one persistent shell around all gated surfaces.

### 5.1 Shell anatomy (Advanced)

Top bar (header bg token, bottom border), content max 1460px:
1. **GW logo block** (38×38 rounded square + stacked wordmark) → links `#/home`.
2. **Jurisdiction pill**: mint dot + `Alpine, WY`. In this chain it is a **static label** (Alpine-only stage; Location onboarding is a follow-up chain §9). No dropdown affordance is rendered — no `▾`, no dead control.
3. **Search**: NOT in this chain (no search index exists; a disabled fake search violates honesty). Reserved slot documented; follow-up in §9.
4. **Alerts**: NOT in this chain (no alert pipeline). §9.
5. **Mode toggle**: `Simple | Advanced` segmented pill (§1). Replaces the standalone theme toggle *position*; explicit theme override remains available (System/Dark/Light) inside the toggle's expanded control or settings row — final placement is the impl leg's call, but the mode toggle is the primary affordance.

Tab row (second header row): only **shipped** surfaces, in wireframe order where they exist:

| Tab | Route | Notes |
|---|---|---|
| `Home` | `#/home` *(new)* | New dashboard (§6) |
| `Boards` | `#/app` | Agenda Kanban boards (GOV-600/606); `/boards` alias exists |
| `Timeline` | `#/timeline` | |
| `Cards` | `#/cards` | Card feed |
| `Topics` | `#/topics` | Concept graph |
| `Newsletter` | `#/newsletter` | |

Wireframe tabs `Fast Agenda`, `Power Tracker`, `Source Vault`, `Watchlist` are **not rendered** (their pages don't exist; dead nav is dishonest UI). The tab row is built data-driven so follow-up chains add tabs without shell rework. Active tab = mint underline (dark) / black underline (light). Context pages (`#/body`, `#/meeting`) highlight their parent tab.

### 5.2 Shell behavior

- Shell renders **only inside the gate** — `#/` gated landing keeps its own standalone layout and never shows app nav to unauthenticated visitors (fail-closed, §3.4).
- Fixture/DEV banner slot sits **above** the header (topmost, full-width), exactly as the wireframes draw it.
- Footer: tagline `◆ Holding power accountable. Amplifying transparency.` + mono `data refreshed <timestamp>` (timestamp = real projection generation time from the read API — never a fake clock) + `About · Help` links (existing pages only).
- Simple mode shell = broadsheet strip + masthead + uppercase center nav (`FRONT PAGE · TIMELINE · …`), same six routes, same rules.

---

## 6. Home dashboard spec (`#/home`, new route)

### 6.1 Layout (Advanced, per `Home.dc.html`)

Top-to-bottom: fixture/DEV banner slot → shell header + tabs → **level filter** (`All | Town | County | State` — in Alpine-only stage, County/State pills render but filter real data, which yields honest-empty states for county/state lanes; they must not be hidden, because the jurisdiction model is real) → **Civic Weather strip** → 3-column widget grid → footer.

Widget grid (desktop `400px | 1fr | 352px`):

| Column | Widgets (top→bottom) |
|---|---|
| Left | **Fast Agenda** (next-meeting card + ALSO COMING UP list), **Transparency Alerts** *(gated-data module — see honesty map)* |
| Center | **Active Issues** (issue rows w/ level chip, board, area, stage), **Timeline Preview** (mono date rail, 4 latest events, lane toggle) |
| Right | **Promise Conflicts** *(GATED — absent)*, **Source Vault stats** |

### 6.2 Layout (Simple, light broadsheet)

Masthead (`Government Watchdog Weekly`, John Adams quote, dateline) → uppercase nav → **3 THINGS TO KNOW** ruled box → 3-col: LOCAL rail (AGENDA / NEWS / AREAS OF INTEREST) · FEATURED STORY (headline, dek, photo slot, `PLAIN-ENGLISH SUMMARY [AI]` / `WHY IT MATTERS` / `NEXT ACTION` columns) · right rail (SOURCES/RECEIPTS · HISTORY LOOKS BACK · PUBLICATION HONESTY TRACKER) → COUNTY + STATE section boxes → *(political lens boxes — GATED, absent)* → double-rule footer with Advanced upsell.

### 6.3 Data-honesty map (every widget, both modes — acceptance-critical)

Legend: **REAL** = wired to the reviewed-Alpine read-API projection; **HONEST-EMPTY** = module renders with a plain-language empty state naming what's missing; **FIXTURE-DEMO** = sample content allowed **only** under `?demo=sample` with the DEV banner (GOV-606 pattern); **GATED-ABSENT** = feature behind an owner/risk gate — module absent from DOM until its gate passes.

| Widget | Data it wants | What exists today | Ship state |
|---|---|---|---|
| Civic Weather strip | Weekly activity aggregate (meetings, new docs, changes, votes) | No aggregate endpoint; reviewed corpus has records but no weekly rollup | **HONEST-EMPTY** ("No reviewed activity summary yet — the archive is still filling in") + FIXTURE-DEMO. Backend follow-up: weekly-rollup projection (§9.3) |
| Fast Agenda widget | Next meeting + agenda status tiles + deadlines | Real corpus: **0 agenda threads; card-feed lacks `meeting_id`** (GOV-599 finding); GOV-605 projection powers boards but is honestly empty | **HONEST-EMPTY** ("No upcoming reviewed meeting records") + FIXTURE-DEMO |
| ALSO COMING UP list | Future meetings/deadlines | Same gap | Same as Fast Agenda (one module, one state) |
| Transparency Alerts ("Hidden Things") | Packet-diff/lateness/missing-video pipeline | No diff/lateness detection pipeline exists | **HONEST-EMPTY** with explainer ("Transparency alerts will appear when document-change tracking is live") + FIXTURE-DEMO. Pipeline = backend follow-up (§9.3); the *claims* it makes (quiet edits, lateness) also need VSR review before real alerts ship |
| Active Issues | Issue rows w/ stage + flags | Real reviewed topic threads/cards exist (topic_tree real; card feed real). **Impact score + confidence % do NOT exist** — impact scoring is an unbuilt AI-adjacent metric | **REAL** for issue rows derived from reviewed topics/cards (title, level, area, source-backed stage); **impact/conf meters OMITTED** until a scoring contract passes the AI-overclaim gate (§9.2). No meter is rendered — not a placeholder meter |
| Timeline Preview | Latest N reviewed events | **Real timeline records exist** (reviewed Alpine projection drives `#/timeline` today) | **REAL** — latest 4 reviewed events, mono date rail, links to `#/timeline`. Honest-empty if projection returns none |
| Promise Conflicts + LATEST VERDICT | Promise kept/broken/partial verdicts per official | Feature is **risk-gated** (defamation/accusation class) — never authorized | **GATED-ABSENT** (§9.2). Not rendered, not CSS-hidden, no fixture |
| Source Vault stats | Source counts, hash-verified %, latest source | Backend has a real source registry w/ hashes, but no frontend stats endpoint | **HONEST-EMPTY** ("Source statistics will appear when the vault projection is live") + FIXTURE-DEMO. Numbers are never hardcoded (§9.3) |
| **Simple: 3 THINGS TO KNOW** | 3 editorial items | Stage 4.08 reviewer-internal weekly briefing exists (real, verified section-2 items) | **REAL** when sourced verbatim from the reviewed briefing/digest; HONEST-EMPTY otherwise |
| **Simple: FEATURED STORY** | One sourced story w/ AI summary + receipts | 4.05 digest / 4.08 briefing items exist with source trails | **REAL** (render a briefing item verbatim w/ its labels — the newsletter pattern, GOV-462); AI-summary column keeps its `AI` chip |
| **Simple: SOURCES/RECEIPTS rail** | Source list for the featured story | Source records exist per briefing item | **REAL** (links into existing source evidence), else honest-empty |
| **Simple: HISTORY LOOKS BACK** | Historical echo item | Verified historical briefing items exist (GOV-492) | **REAL** from reviewed historical items; honest-empty otherwise |
| **Simple: PUBLICATION HONESTY TRACKER** | Sourced/balanced/clear/updated self-metrics | Derivable from digest metadata only in part | **HONEST-EMPTY** until metrics are computable from real digest metadata; never self-asserted numbers (§9.3). "BALANCED — N lenses" is additionally gated with the lens feature |
| **Simple: political lens boxes** (Conservative/Progressive/Libertarian) | AI-written partisan perspectives | Risk-gated (AI political content — same family as the 4-voice roundtable) | **GATED-ABSENT** (§9.2) |
| Alerts button (badge `3`) | Alert pipeline | None | **NOT RENDERED** (§5.1) |
| Search / `⌘K` | Search index | None | **NOT RENDERED** (§5.1) |
| Location pill | Multi-jurisdiction onboarding | Alpine-only stage | **Static label** `Alpine, WY` (§5.1) |
| Footer `data refreshed` stamp | Projection generation time | Read API serves projection metadata | **REAL** timestamp or the stamp is omitted — never a fake time |

**Comprehension rule for empty modules:** every honest-empty state says, in resident language, (a) what will appear here, (b) why it's empty now, (c) where the data will come from. Empty ≠ broken.

### 6.4 Resident comprehension check (30-second test)

A non-technical Alpine resident opening Home should be able to say: *"This is a dashboard about Alpine's government. The next meeting and recent activity would show here — some sections say the archive is still filling in. The colored chips tell me town vs county vs state. Anything written by AI says AI on it. Every claim has a receipts link. Nothing here is pretending to be live data."* Isaac, as designer, should recognize his wireframe's look immediately.

---

## 7. Page-by-page application map (6 existing surfaces)

| Surface | Route | What changes visually | Intentionally untouched |
|---|---|---|---|
| Gated landing | `#/` | Token value refresh only (new palette inherits via tokens). **No shell/nav** (§5.2). Layout, gate states (anonymous/pending/denied/approved with distinct tones), copy — unchanged | Gate logic, fail-closed order, four state tones, `noindex` |
| Agenda boards | `#/app` (+`/boards`) | Wrapped in shell; board chrome ladder tokens re-pointed to new dark values (board `#0B0F14`-family well < lane < card); level chips adopt §2.5; honest-EMPTY + `?demo=sample` DEV banner pattern kept verbatim | Real GOV-605 projection wiring, empty-state copy, lane semantics |
| Timeline | `#/timeline` | Wrapped in shell; token refresh; date gutter/axis adopts `--gw-font-mono`; event dots adopt status-dot legend colors (§2.5) — dot color remains reinforcement, word+glyph carry state | Known-then vs later separation, correction chains, source drawers, time-navigator behavior |
| Card feed | `#/cards` | Wrapped in shell; cards adopt 14px-radius widget-card look, chip restyle (≥13px floor), receipts-link styling | §5 public-lane zero-cards, click-to-reveal blur + badges-outside-blur, trust-label words, gap cards |
| Topics | `#/topics` | Wrapped in shell; token refresh; chips/tree adopt new palette | Concept graph structure, provenance panels, degrade-path loudness |
| Newsletter | `#/newsletter` | Wrapped in shell; archive/detail adopts broadsheet type treatment in light mode (`--gw-font-serif` headings) — closest existing surface to the wireframe's Simple language | 4.05 digest rendered verbatim, editorial-contract labels (GOV-470), zero-new-label rule |
| Context pages | `#/body`, `#/meeting` | Shell + token inheritance only | Everything else |

Restyle sequencing inside the impl legs: **shell + tokens first** (everything inherits), then Home, then per-surface polish — one PR wave each, keeping diffs reviewable (CTO sequencing owns the exact split across legs 2–5).

---

## 8. WCAG 2.1 AA — recomputed contrast for all new/changed pairs

Computed with the WCAG relative-luminance formula (sRGB), same method as `ui-design-system.md` §2/§11.2. Targets: text ≥ 4.5:1; large/bold text and state-bearing UI ≥ 3:1. (Script: standard relative-luminance; reproducible — see GOV-657 thread.)

### 8.1 Advanced dark (new values)

| Foreground | Background | Ratio | Verdict |
|---|---|---|---|
| text `#ECF1F7` | page `#0B0F14` | **16.92** | ✅ body |
| text `#ECF1F7` | surface `#12181F` | **15.72** | ✅ body |
| text `#ECF1F7` | subtle `#141B23` | **15.27** | ✅ body |
| secondary `#C3CDD9` | `#12181F` | **11.10** | ✅ body |
| secondary `#C3CDD9` | `#141B23` | **10.78** | ✅ body |
| muted `#8D99A7` | `#12181F` | **6.16** | ✅ body |
| muted `#8D99A7` | `#141B23` | **5.99** | ✅ body |
| mint accent `#4ED8C3` | `#0B0F14` | **10.92** | ✅ body+UI (focus ring) |
| mint accent `#4ED8C3` | `#12181F` | **10.15** | ✅ body |
| mint `#4ED8C3` | mint well `#0F1E1B` | **9.77** | ✅ body |
| on-mint `#062019` | mint fill `#4ED8C3` | **9.72** | ✅ button |
| ok `#63D68F` | `#12181F` | **9.82** | ✅ |
| ok `#63D68F` | ok well `#101820` | **9.84** | ✅ |
| stop `#EE7A6D` | `#12181F` | **6.50** | ✅ |
| stop `#EE7A6D` | stop well `#1D1412` | **6.58** | ✅ |
| caution `#ECC35C` | `#12181F` | **10.65** | ✅ |
| caution `#ECC35C` | banner bg `#201A0E` | **10.31** | ✅ banner |
| county amber `#E5A83B` | `#12181F` | **8.50** | ✅ |
| state blue `#7DB1FB` | `#12181F` | **8.12** | ✅ |
| info link `#7DB1FB` | `#141B23` | **7.89** | ✅ body |
| alert-badge text `#160B09` | `#EE7A6D` | **7.04** | ✅ (future use) |
| selected pill text `#0B0F14` | `#ECF1F7` | **16.92** | ✅ |
| on-amber `#201302` | `#E5A83B` | **8.65** | ✅ pill |
| on-blue `#0A1A33` | `#7DB1FB` | **7.91** | ✅ pill |
| state border `#8D99A7` (strong) | `#141B23` | **5.99** | ✅ UI |
| stop border `#EE7A6D` | `#12181F` | **6.50** | ✅ UI |

**Failing-as-drawn (reclassified, not shipped as state carriers):** wireframe chip borders `#29564E` (2.16), `#2E6B60` (2.88), `#52302B` (1.54), `#4a3c14` (1.60) are **decorative reinforcement only** (§2.1 classification rule); the state is carried by tone text + word + glyph at ≥ 6.5:1. Container borders `#232C37`/`#1F2833` (1.26/1.16) are decorative — exempt (same reasoning as design-system §2 note ¹).

### 8.2 Simple light / broadsheet (new values)

| Foreground | Background | Ratio | Verdict |
|---|---|---|---|
| ink `#1E1C17` | paper `#FBF7EB` | **15.89** | ✅ body |
| ink `#1E1C17` | canvas `#F3EDDD` | **14.57** | ✅ body |
| ink `#1E1C17` | panel `#FDFAF1` | **16.31** | ✅ body |
| secondary `#4A463C` | `#FBF7EB` | **8.78** | ✅ body |
| muted `#6E685B` | `#FBF7EB` | **5.17** | ✅ body |
| muted `#6E685B` | `#FDFAF1` | **5.30** | ✅ body |
| link `#1A4D8F` | `#FBF7EB` | **7.84** | ✅ body+UI |
| town teal `#0E7A6E` | `#FBF7EB` | **4.87** | ✅ body |
| town teal `#0E7A6E` | `#FDFAF1` | **5.00** | ✅ body |
| **county amber `#A36A10`** | `#FBF7EB` | **4.24** | ❌ **FAILS 4.5** |
| **county amber FIX → `#8F5D0E`** | `#FBF7EB` | **5.24** | ✅ **fix adopted (§2.1)** |
| county fix `#8F5D0E` | `#FDFAF1` | **5.38** | ✅ |
| state blue `#274F9B` | `#FDFAF1` | **7.51** | ✅ |
| featured red `#A33327` | `#FDFAF1` | **6.58** | ✅ |
| paper `#FBF7EB` | accent `#1A4D8F` (masthead block) | **7.84** | ✅ |
| ok `#1E4620` | `#E8F0E8` | **9.25** | ✅ unchanged pair |
| stop `#7B241C` | `#FDECEA` | **8.70** | ✅ unchanged pair |
| caution `#5C4500` | `#FFF3CD` | **8.22** | ✅ unchanged pair |
| caution tag `#7A5B00` | `#FFF3CD` | **5.70** | ✅ unchanged pair |

**The one compliance fix in the whole language:** wireframe county label `#A36A10` → **`#8F5D0E`** on paper surfaces (5.24/5.38, margin not the line). Everything else passes as drawn. Trust-tone pairs are the shipped, already-verified values.

Color-blind safety: level colors (mint/amber/blue dark; teal/amber/blue light) are always accompanied by the level **word** (`TOWN/COUNTY/STATE`); status dots always sit beside status words; verdict/AI chips lead with glyph+word. No state is color-alone (§3 doctrine holds).

---

## 9. Out of scope — named and routed, NOT authorized here

### 9.1 New IA surfaces (follow-up staged chains, spec-first each)

Per the master canvas and page set, each is its own future chain (UX spec → CTO sequencing → impl → VSR/SecPriv → CTO merge), Alpine-first, reviewer-internal:

1. **Fast Agenda page** (`Fast_Agenda.dc.html`) — needs agenda-thread + `meeting_id` backend contract first (the GOV-599 gap).
2. **Power Tracker** (`Power_Tracker.dc.html`) — additionally blocked by the promise-verdict risk gate (§9.2.1).
3. **Source Vault** (`Source_Vault.dc.html`) — needs source-registry projection + version-diff pipeline.
4. **Watchlist** (`Watchlist.dc.html`) — needs accounts/alerting model (also §9.2.4).
5. **Location onboarding** (`Location.dc.html`) — expansion-shaped; additionally carries the voting-pattern lens gate (§9.2.2). Alpine-only stage makes this planning-only.
6. **Issue Detail as a routed page** — wireframe of record = master-canvas frames `2d Simple Issue Page dossier` + `3b Advanced Issue Detail` (Option A owner decision).
7. **Search + ⌘K**, **Alerts UI** — shell slots reserved (§5.1).

### 9.2 Risk-gated features (routed to gates; no implementation in any GOV-654 leg)

| Feature | Risk class | Gate route |
|---|---|---|
| 1. Promise kept/broken/partial verdicts, keeping-promises scores, LATEST VERDICT, challenge flow | Defamation/accusation (RISK_ASSESSMENT №4) | Owner + VSR gate before any spec leg; per wireframe's own rule *"no verdict without a saved quote, a recorded action, a topic match, and sources"* — but the gate decides IF, not just how |
| 2. Voting-pattern lens (partisan color-coding of jurisdictions) | Campaign-messaging adjacency | Owner gate; wireframe marks it `sample data` everywhere — real data version needs Isaac + VSR |
| 3. 4-voice AI roundtable + political lens boxes | AI political content / AI-overclaim | Owner + AI-labeling policy gate (AI_GATEWAY lanes; `AI — scripted from the record` labeling is necessary but not sufficient) |
| 4. Email alerts + delivery SLAs ("within 1 day") | Official-contact/publication + operational promise | Owner gate (GATED_BETA + publication boundary); no email surface exists reviewer-internal |
| 5. Impact scores + confidence % on issues | AI-overclaim (invented metric) | Needs a scoring contract with source-grounded definition through VSR before any meter renders (§6.3) |
| 6. Transparency-alert *claims* (quiet edits, lateness accusations) | Evidence/defamation-adjacent | Pipeline (§9.3) + VSR review of claim language before real alerts ship |
| 7. "Tip us something" / contact affordances | Intake/moderation | Owner gate; not rendered in this chain |

### 9.3 Backend dependencies surfaced by Home (for CTO routing — no frontend fabrication meanwhile)

Weekly activity rollup projection (Civic Weather) · agenda-thread/`meeting_id` contract (Fast Agenda) · source-registry stats projection (Vault widget) · document version-diff pipeline (Transparency Alerts) · digest-metadata metrics (honesty tracker). Until each exists, the honesty map's HONEST-EMPTY states apply.

---

## 10. Premium success criteria (framework applied)

**Stage:** reviewer-internal Alpine app (Stage-3/4-class frontend work) · **Scope:** design language + shell + Home + restyle of 6 surfaces; Alpine-first; no public launch · **Project/repo:** `Government-watchdog-website` (`78066972-…`) · **Owner role:** UXProductDesigner (this spec) → impl legs 2/5+ (FrontendTimelineEngineer) · **Reviewer path:** spec (this) → impl → VSR + SecPriv legs → CTO non-author merge → **Isaac visual review (terminal owner gate — he judges real pixels)** · **Blockers/unlock:** legs 2–5 blocked on this issue; §9 items excluded.

**Success:** the app reads as Isaac's wireframe look — mint-accent dark Advanced + paper broadsheet Simple — via token value swaps + shell + Home; every §6.3 honesty state is honest; every §8 pair holds; every §3 invariant survives; Isaac recognizes his design at the visual gate. **Evidence:** this spec file + issue document, impl PRs + green CI, 3-viewport × 2-mode screenshots, §8 tables, Isaac sign-off.

**Failure:** any widget shows fabricated civic data or a fake meter; a gated feature renders (even hidden); a trust/AI label is restyled away or moved off-adjacent; text under 4.5:1 or state UI under 3:1 ships; fonts load from a third-party at runtime; the gate order weakens; dead nav tabs ship. **Stop/escalation:** any of the above, or Isaac redirects the look → back to this spec, patch, re-gate.

**Workability:** actors = Alpine resident (Simple), reviewer/Isaac (Advanced). Start = gated login → Home; end = resident understands town/county/state state-of-play and can reach any receipt in ≤ 2 clicks. Inputs = reviewed-Alpine projections only. Missing/stale/disputed → honest-empty/dispute labels per §6.3. Resume: tokens are additive; a half-applied restyle still renders (var fallback).

**Ease of use:** §6.4 comprehension check; plain-language empty states; labels ≥ floors; both modes pass the 65-year-old-resident test — Simple mode exists precisely for this.

**Comparable research:** DocumentCloud (evidence-forward light surfaces; receipts-first), GovTrack (restrained accent + status words at scale), Open States (typed civic data → our level/status chip system), Granicus/govMeetings (institutional meeting portals; older-audience legibility) — carried over from `ui-design-system.md` §6 and still governing. New for this chain: the **two-mode audience split** follows the newspaper/dashboard duality (print-first civic journalism vs. data dashboard); the wireframes' own honesty furniture (fixture banner, honesty tracker, "nothing cited without a receipt") is the pattern to preserve, not invent.

**Tradeoffs:** dark-Advanced-first vs institutional-light-first — resolved by owner: Isaac drew Advanced as default and Simple as the resident lane; the light lane is not lost, it is the Simple mode. Mint accent vs shipped blue — mint adopted on dark (10.15:1, better than the old blue's 8.44), blue kept on light (wireframe agrees). Full broadsheet everywhere vs Home-first — Home-first keeps legs reviewable and lets Isaac correct course early. Self-host fonts vs CDN — self-host chosen (privacy/no-beacon; ~350KB one-time cost).

**Plan before implementation:** concept/data model unchanged (presentation + one new route + honesty states). UI behavior = §5–§7. Verification = §8 recompute in CI-reviewable form, floor regression tests, 3-viewport × 2-mode screenshots, honest-empty states demonstrated against the real (empty) projection + `?demo=sample` demo. Artifacts = this file, issue document `spec`, impl PRs. Failure handling = §10 failure list. Pass-up = Isaac visual gate; any §9 item attempting to enter scope → CEO/CTO.

**Source/auditability & timeline integrity:** no changes to source-trail, known-then/later separation, corrections, or concept links; Home widgets only *project* already-reviewed records and always link to their receipts. No new public claim class is introduced by this chain.

---

## 11. Acceptance criteria for the implementation legs (checklist)

- [ ] Token value swap per §2 (names preserved; new tokens added; zero raw hex outside `tokens.ts`; dimensional/floor tokens untouched by theme blocks).
- [ ] Fonts self-hosted per §2.3; **zero third-party font/network requests at runtime** (verifiable in devtools/network log evidence).
- [ ] App shell per §5: gate-inside-only, six real tabs, no dead nav, static Alpine pill, banner slot topmost.
- [ ] `#/home` route per §6; **every widget in the §6.3 state specified** — real projections wired where REAL, honest-empty copy where HONEST-EMPTY, fixture only under `?demo=sample` + DEV banner, gated modules absent from DOM.
- [ ] Six existing surfaces restyled per §7 with their untouched lists verifiably untouched.
- [ ] §8 contrast table re-verified against final values, both themes, including the `#8F5D0E` county fix.
- [ ] All §3 invariants + §5 floors of `ui-design-system.md` hold; existing regression tests pass; `tsc` + suite + build `rc=0`.
- [ ] Screenshots: desktop 1440×900 + tablet 768×1024 + mobile 390×844, × Advanced/dark + Simple/light, for Home + shell + at least timeline/cards/newsletter.
- [ ] Merge gates: VSR + SecPriv legs + CTO non-author merge → Isaac visual review (terminal owner gate).

---

## Appendix A — Issue Detail wireframe of record (for the follow-up chain, NOT this chain)

Owner decision (GOV-655 card `confirmation:GOV-655:pages:v1`, Option A): Issue Detail is the 10th page; its wireframes of record are the master-canvas frames below. Recorded here so the follow-up chain has its anchor without re-mining the canvas.

**Frame `2d` — Simple Issue Page ("the dossier as a newspaper article",** paper bg, single column): kicker line (`GOVERNMENT WATCHDOG · TOWN · Zoning & Land Use`) → centered headline → byline/meta + `▲ packet changed` chip → plain-English lede → **"➜ WHAT HAPPENS NEXT" box — the loudest element on the page** (amber highlight, comment/vote time+place, `Remind me` / `How to comment` buttons) → **"THE STORY SO FAR"** numbered narrative timeline (each step with a `source` link; hidden change step in red with "see the difference") → WHO'S INVOLVED line → SOURCES line + `✓ all archived` chip → footer (`Print this page · Challenge or correct` · `switch to Advanced view`). Designer note: *"numbered 'story so far' replaces the timeline widget — same data, article voice."*

**Frame `3b` — Advanced Issue Detail** (dark, `1.5fr 1fr` grid): breadcrumb (`Issues › …`) + `☆ Follow issue` + `ACTIVE` chip → title + level chip + record ID/updated stamp → **metadata pill bar** (Level · Board · Area · Stage · Impact · Confidence — each drillable `›`; impact/confidence are §9.2-gated metrics) → LEFT: ISSUE OVERVIEW 2×2 panel (`Plain-English Summary [AI]` / `Why It Matters` / `Who Is Affected` / `Next Action` + Take-action button), ISSUE TIMELINE panel (dot rows; hidden-change row gets the inset red alert treatment; dashed hollow dots = pending) → RIGHT proof rail: PEOPLE INVOLVED & PROMISES (§9.2-gated), SOURCES & DOCUMENTS (per-doc `✓ hash / View ↗` rows + `⚖ Compare versions ›`), ⚠ TRANSPARENCY ALERT panel. Related light frame `1h` adds: *"evidence outranks narrative — nothing is claimed above the receipts."*

When the Issue Detail chain starts, it must re-apply §6.3-style data honesty (impact/confidence/promise modules gated) and route `#/issue?id=…` — one URL per record, both modes.
