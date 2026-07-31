# GOV-425 / GOV-426 — UI Design-System + Accessible Color-Scheme Spec

**Issue:** GOV-426 (Child A) — design spec, docs only, **no production CSS in this issue**.
**Parent:** GOV-425. **Implementer:** GOV-427 (Child B, FrontendTimelineEngineer), blocked by this spec.
**Author:** UXProductDesigner. **Stage:** Stage 3.x reviewer-internal Alpine app. **Scope:** reviewer-internal only — **no public-launch scope** (public deploy stays gated on Isaac via GOV-420).

This spec is the **single source of truth** Child B implements. It names a design-token layer, a deliberate WCAG 2.1 AA palette, a type/spacing/radius scale, the trust-tone mapping, per-surface application notes, and the floors Child B must not regress. The recommendation (refined light theme) is routed to Isaac for the theme-direction decision before implementation; see §10.

---

## 0. Grounded diagnosis (what is actually wrong)

The reviewer-internal app is a **light** theme today. Verified by inventory of the three `STYLE` constants:

| Surface | Constant | File:line |
|---|---|---|
| Timeline + card-feed + gap card + topic-tree chips inside app | `STYLE` | `src/ui/render.ts:657` |
| Preview-launch landing + gated-beta entry | `LANDING_STYLE` | `src/ui/landing.ts:134` |
| Civic topic-tree view | `TREE_STYLE` | `src/ui/topic-tree-view.ts:165` |

**Measured drift (this is the "ugly / hard to read"):**

- **34 unique hex values**, ~140 occurrences, re-declared per file with **no token layer / no single palette source of truth**.
- **Four near-identical pale surfaces** drift apart: `#eef2f8` (8×), `#f7f9fc` (3×), `#eef0f2` (2×), `#e8f0ff` (1×).
- **Four-step grey text scale** re-declared inconsistently: `#666` (5×), `#555` (1×), `#444` (4×), `#333` (3×).
- **Border drift:** `#ddd`, `#bbb`, `#ccc`, `#eee`, `#d7dee8`, `#c2cedd`, `#e3e3e3`, `#999`, `#e0c98a`, `#f0e2c0` — ten different border colors doing three jobs.
- No deliberate **type scale, spacing scale, or radius scale**; `system-ui` only.

**Conclusion:** the existing palette is *substantially already accessible* (see §2 — body text 17.4:1, accent 8.4:1, all trust tones ≥ 5.7:1). The problem is **inconsistency, not bad colors**. The fix is a **token layer + consolidation**, applied uniformly — **not** a dark mode, and not a from-scratch repalette. Isaac's "dark color scheme" remark is treated as "the current look reads poorly," answered by the cohesive refined-light recommendation plus his visual review (§10).

---

## 1. Design-token layer (the source of truth)

Child B declares these CSS custom properties **once** on `:root` (injected in a shared style block that all three surfaces import), then replaces every raw hex/size/radius literal in the three `STYLE` constants with `var(--gw-*)`. After this, **zero raw hex values** should remain in the three constants except inside the token definitions themselves.

### 1.1 Color tokens

| Token | Value | Replaces (current literals) | Role |
|---|---|---|---|
| `--gw-surface` | `#ffffff` | `#fff` | Page / card background |
| `--gw-surface-subtle` | `#f7f9fc` | `#f7f9fc`, `#f3f8f3`* | Panels, legend, timenav, provenance bg |
| `--gw-surface-accent-tint` | `#eef2f8` | `#eef2f8`, `#eef0f2`, `#e8f0ff` | Accent-tinted chips / neutral badge / rollup highlight |
| `--gw-text` | `#1a1a1a` | `#1a1a1a` | Body / primary text |
| `--gw-text-secondary` | `#333333` | `#333`, `#444` | Secondary text, dense metadata |
| `--gw-text-muted` | `#5b6470` | `#666`, `#555`, `#5a6b82` | Muted captions, dates, kickers |
| `--gw-accent` | `#1a4d8f` | `#1a4d8f` | Links, focus ring, primary button, accent chips/borders |
| `--gw-accent-text-on` | `#ffffff` | `#fff` (on accent) | Text on `--gw-accent` fill |
| `--gw-border` | `#d0d7e0` | `#ddd`, `#bbb`, `#ccc`, `#e3e3e3`, `#d7dee8`, `#c2cedd` | Default **decorative** container/hairline border |
| `--gw-border-subtle` | `#e7ebf1` | `#eee`, `#f0e2c0` | Faint internal separators |
| `--gw-border-strong` | `#767676` | `#999` | **State/UI-bearing** border (≥ 3:1) |
| **Trust tones** (see §3) | | | |
| `--gw-ok-text` | `#1e4620` | `#1e4620` | ok text + border |
| `--gw-ok-bg` | `#e8f0e8` | `#e8f0e8` | ok fill |
| `--gw-caution-text` | `#7a5b00` | `#7a5b00` | caution badge text + border |
| `--gw-caution-text-strong` | `#5c4500` | `#5c4500` | caution banner body text |
| `--gw-caution-bg` | `#fff3cd` | `#fff3cd` | caution fill |
| `--gw-caution-bg-soft` | `#fffaf0` | `#fffaf0` | caution soft fill (analysis/gap frame) |
| `--gw-caution-line` | `#d9a400` | `#d9a400`, `#e0c98a` | caution divider/border accent |
| `--gw-stop-text` | `#7b241c` | `#7b241c` | stop text |
| `--gw-stop-bg` | `#fdecea` | `#fdecea` | stop fill |
| `--gw-stop-border` | `#c0392b` | `#c0392b` | stop border |
| `--gw-neutral-border` | `#767676` | `#999` | neutral badge border (≥ 3:1) |

\* `#f3f8f3` (topic-tree provenance) is a green-tinted subtle surface; map to `--gw-surface-subtle` for cohesion, OR keep a dedicated `--gw-ok-bg-soft: #f3f8f3` if Child B finds the green cue load-bearing for the provenance panel. Designer preference: consolidate to `--gw-surface-subtle` unless it weakens the provenance read.

### 1.2 Type scale (rem, root 16px)

| Token | Value | Use |
|---|---|---|
| `--gw-text-xs` | `0.72rem` | kicker, captions, gap counts |
| `--gw-text-sm` | `0.8rem` | dense metadata, field labels |
| `--gw-text-badge` | `var(--gw-badge-min)` | badges/chips (**px floor — see §5**) |
| `--gw-text-body` | `0.95rem` | card title, body |
| `--gw-text-md` | `1.05rem` | landing mission, section lead |
| `--gw-text-lg` | `1.15rem` | gate title, card section h2 |
| `--gw-text-xl` | `1.8rem` | landing h1 |
| `--gw-font` | `system-ui, sans-serif` | single family token |
| `--gw-leading` | `1.5` | body line-height |
| `--gw-leading-tight` | `1.2` | headings |

### 1.3 Spacing scale (rem)

`--gw-space-1: .25rem` · `--gw-space-2: .4rem` · `--gw-space-3: .6rem` · `--gw-space-4: .8rem` · `--gw-space-5: 1rem` · `--gw-space-6: 1.25rem`. Replace ad-hoc `.3rem/.35rem/.45rem/.55rem/.7rem/.9rem` paddings by snapping to the nearest step (designer tolerance: ±0.05rem is fine; the goal is consistency, not pixel-perfection).

### 1.4 Radius + border-width

`--gw-radius-sm: 4px` · `--gw-radius: 8px` (default card/panel) · `--gw-radius-pill: 999px` (badges/chips). `--gw-border-w: 1px`. Consolidates the current `4px/6px/8px/10px/999px` drift to **sm / default / pill**.

---

## 2. WCAG 2.1 AA contrast table (verified)

Computed with the WCAG relative-luminance formula (sRGB). **Targets:** ≥ 4.5:1 normal body text (1.4.3), ≥ 3:1 large/bold text and UI component boundaries (1.4.3 / 1.4.11). Numbers are reproducible from the `gw_contrast` script logic recorded in the GOV-426 thread.

| Foreground | Background | Ratio | Target | Verdict |
|---|---|---|---|---|
| `--gw-text` `#1a1a1a` | `--gw-surface` `#fff` | **17.40** | 4.5 | ✅ body |
| `--gw-text-secondary` `#333` | `#fff` | **12.63** | 4.5 | ✅ body |
| `--gw-text-muted` `#5b6470` | `#fff` | **6.00** | 4.5 | ✅ body |
| `--gw-accent` `#1a4d8f` (link) | `#fff` | **8.39** | 4.5 | ✅ body |
| `--gw-accent` on accent-tint | `#eef2f8` | **7.47** | 4.5 | ✅ body |
| `--gw-accent-text-on` `#fff` | `--gw-accent` `#1a4d8f` | **8.39** | 4.5 | ✅ button |
| ok text `#1e4620` | ok bg `#e8f0e8` | **9.25** | 4.5 | ✅ |
| caution text `#7a5b00` | caution bg `#fff3cd` | **5.70** | 4.5 | ✅ |
| caution banner `#5c4500` | caution bg `#fff3cd` | **8.22** | 4.5 | ✅ |
| stop text `#7b241c` | stop bg `#fdecea` | **8.70** | 4.5 | ✅ |
| neutral text `#1a4d8f` | tint `#eef2f8` | **7.47** | 4.5 | ✅ |
| **Focus ring** `#1a4d8f` | `#fff` | **8.39** | 3.0 | ✅ UI |
| ok border `#1e4620` | `#fff` | **10.76** | 3.0 | ✅ UI |
| caution border `#7a5b00` | `#fff` | **6.32** | 3.0 | ✅ UI |
| stop border `#c0392b` | `#fff` | **5.44** | 3.0 | ✅ UI |
| accent border `#1a4d8f` | `#fff` | **8.39** | 3.0 | ✅ UI |
| `--gw-border-strong` `#767676` | `#fff` | **4.54** | 3.0 | ✅ UI |
| **`--gw-neutral-border` `#767676`** (was `#999`=2.85 ❌) | `#fff` | **4.54** | 3.0 | ✅ **fix** |
| `--gw-border` `#d0d7e0` (decorative) | `#fff` | 1.45 | n/a | ⓘ exempt¹ |

¹ **Decorative-border exemption (WCAG 1.4.11):** `--gw-border` outlines containers (cards, panels) whose presence is *also* conveyed by layout, padding, and content. The border is not the sole means of identifying the component or its state, so the 3:1 requirement does not apply. Any border that **carries state** (focus, active, selected, a trust verdict) must use a token that meets 3:1 (`--gw-accent`, the tone borders, or `--gw-border-strong`). This is why `#999` → `#767676`: the neutral badge border is reinforcement and we hold it to 3:1 for crispness even though icon+text already carry the state (§3).

**Result:** the palette is **AA-clean** for all text and all state-bearing UI. The only change required for compliance is `#999 → #767676` on the neutral border. Everything else is a cohesion/consolidation move, not a contrast fix.

---

## 3. Trust-tone mapping (icon + text, never color alone, color-blind-safe)

Trust meaning is **backend-driven** — `ui_status` / `provenance_status` / completeness decide the tone; the UI never invents it (preserves the `assertWebSafe` contract). Each state maps to tokens **and** a leading glyph + word, so the state survives grayscale and the three common color-blindness types.

| State | Tone tokens | Glyph + word (carries state w/o color) | Backend driver |
|---|---|---|---|
| ok / verified | `--gw-ok-text` / `--gw-ok-bg` | ✓ + status word | `ui_status` |
| caution / unverified | `--gw-caution-text` / `--gw-caution-bg` | ⚠ + status word | `ui_status` |
| stop / disputed-blocked | `--gw-stop-text` / `--gw-stop-bg` / `--gw-stop-border` | ✕ / ⚠ + status word | `ui_status` |
| neutral / informational | `--gw-accent` / `--gw-surface-accent-tint` / `--gw-neutral-border` | • + label word | `ui_status` |
| AI-presented | `--gw-caution-text` / `--gw-caution-bg` (`.gw-badge-ai`) | "AI" + label text | per-record AI flag |
| provenance audit (`.gw-prov`) | reuses ok/caution tones + inset ring | ✓ / ⚠ glyph (`--gw-prov-icon`) | `provenance_status` |
| completeness: complete | `--gw-ok-*` | word "complete" | completeness summary |
| completeness: gaps | `--gw-stop-*` | word "gaps" + count | completeness summary |
| completeness: unknown | `--gw-border-strong` + `--gw-text-secondary` | word "unknown" | completeness summary |

**Color-blind safety rationale:** the four tones are distinguished today by (a) a distinct **word**, (b) a leading **glyph** for AI/provenance, and (c) hue+lightness pairs that remain separable in deuteranopia/protanopia/tritanopia simulation because they differ in **lightness** (green ok bg is light-green, caution is yellow, stop is pink-red, neutral is blue-grey) — not hue alone. Child B **must not** introduce any state that relies on color alone, and must keep the glyph+word pattern. This is a hard floor (§5).

---

## 4. Per-surface application notes

All three surfaces consume the **same** `:root` token block (one shared injected `<style>` or a shared token string imported by each constant). The per-surface classes keep their names; only their *values* change to `var(--gw-*)`.

### 4.1 Landing / gated-beta entry (`landing.ts` `LANDING_STYLE`)
- `.gw-landing-root` → `--gw-font`, `--gw-text`, `--gw-leading`. Keep the 42rem measure.
- Kicker → `--gw-text-muted` + `--gw-text-xs`. Mission → `--gw-text-md`.
- `.gw-landing-scope` → `--gw-surface-accent-tint` bg, `--gw-accent` border, `--gw-text-secondary` text.
- `.gw-landing-gated` → caution tokens. **Four gate states keep visibly distinct tones** (anonymous = neutral/accent, pending = caution, denied = stop, approved = ok) — preserve acceptance #4 of GOV-419. Each must keep its word, not rely on the tone color.
- Primary action button → `--gw-accent` fill + `--gw-accent-text-on`; ghost variant → accent text on `--gw-surface`. Keep `min-height:44px` (§5).

### 4.2 Timeline + card-feed (`render.ts` `STYLE`)
- `.gw-root` → font/text/leading tokens, 48rem measure unchanged.
- `.gw-fixture-banner` → caution tokens (`--gw-caution-bg`, `--gw-caution-line` border, `--gw-caution-text-strong` text). **Banner text content unchanged** (§5).
- `.gw-card` border → `--gw-border` (decorative). `.gw-card-type` / `.gw-confidence` → accent-tint chip tokens. `.gw-card-date` → `--gw-text-muted`, keep `tabular-nums`.
- `.gw-badge` + tone classes → tone tokens per §3; **badge font stays `--gw-badge-min` px floor** (§5).
- `.gw-legend`, `.gw-timenav`, `.gw-thread`, `.gw-thread-instance` → `--gw-surface-subtle` + `--gw-border`/`--gw-accent` accents.
- `.gw-gapcard` → caution-soft frame (`--gw-caution-bg-soft`, `--gw-caution-line`).
- **Click-to-reveal blur** (`.gw-card-info`), reveal button min-height, `prefers-reduced-motion`, and the rule that **trust/AI badges live OUTSIDE the blurred region** — all preserved verbatim (§5).

### 4.3 Topic-tree (`topic-tree-view.ts` `TREE_STYLE`)
- `.tt-item` left border → `--gw-border`. Rollup highlight `.tt-item[data-in-rollup]` bg → `--gw-surface-accent-tint`.
- `.tt-chip` / `.tt-alias summary` → accent tokens + pill radius; **keep `min-height:44px` and the `Math.max(BADGE_MIN_FONT_PX,14)px` label floor** (§5).
- `.tt-degraded` / `.tt-warning` → stop tokens (degrade path must stay loud).
- `.tt-provenance` → ok tokens / `--gw-surface-subtle`.

---

## 5. Floors to preserve (Child B must not regress — hard stops)

These are existing tested safety/legibility floors. The token migration is **value-substitution only**; it must not weaken any of these:

1. **`BADGE_MIN_FONT_PX = 13`** (`render.ts:653`) — badge/chip text ≥ 13px at the 390px mobile floor. Token `--gw-badge-min` **must resolve to ≥ 13px**; the legibility regression test treats `STYLE` as source of truth.
2. **`DRAWER_TAP_MIN_PX = 44`** (`render.ts:654`) — drawer/legend/chip/reveal tap targets ≥ 44×44px (WCAG 2.5.5).
3. **Fixture banner** — text + role=status unchanged; reviewer-internal offline-snapshot wording preserved.
4. **`noindex,nofollow`** posture — reviewer-internal; no public-launch scope.
5. **Click-to-reveal blur** (`.gw-card-info` `filter:blur`) with trust/AI badges rendered **outside** the blurred, inert region.
6. **`prefers-reduced-motion: reduce`** — disables the blur transition; keep the media query.
7. **Trust semantics backend-driven + icon+text, never color alone** (§3); `assertWebSafe` web-safety contract unaffected (tokens are presentation only).
8. **Reviewer-internal-only** lane behavior: public lane renders zero cards (`render.ts:602`); unchanged.

Child B's CI must stay green: `tsc` + full unit/integration suite + build `rc=0`, and the existing badge-font / tap-floor regression tests must pass against the tokenized `STYLE`.

---

## 5b. Deviation ledger — MOTY baseline values below the accessibility floor (GOV-74)

The owner-approved MOTY baseline specifies state-bearing type **below** this system's
floor. Those values are deliberately **not** implemented as written. The matrix reviewer
checklist requires each deliberate baseline omission to be recorded with its reason, so
this is that record — without it, a later fidelity pass reading the baseline literally can
reintroduce a 9.5px trust chip and pass review.

| MOTY baseline value | Shipped substitute | Reason |
|---|---|---|
| AI badge `9.5px/800` (`reference/README.md:84`) | `--gw-text-badge` → `--gw-badge-min` → **13px** | 9.5px state-bearing text is unreadable at the 390px mobile floor and fails the legibility floor this system pins |
| Section labels `11px/800/ls 1.4px` (`reference/README.md:78`) | **13px** where state-bearing; `--gw-text-kicker` **11px** where decorative | The baseline does not distinguish decorative from state-bearing; this system does (below) |

### Decorative vs state-bearing — the distinction the baseline does not draw

**State-bearing (floor-bound, ≥ `BADGE_MIN_FONT_PX`).** Text a reviewer must read to know
what they are looking at. Enforced by `test/gov74-state-bearing-type-floor.test.ts`, which
fails on a raw sub-floor `px` in any of these classes:

- `.gw-shell-origin` — the `LIVE SERVER CONTEXT` / `SYNTHETIC DESIGN FIXTURE` banner
- `.gw-home-chip` — trust and claim chips (`.gw-badge-ai` composes onto it and adds only colour)
- `.gw-dp-ai-badge` — the AI disclosure in the design lane

**Decorative (kicker-exempt, may sit below the floor).** Brand and layout furniture that
carries no state: `.gw-shell-ai` (the wordmark's "AI-POWERED ANALYSIS" lockup tagline, 9px),
`.gw-shell-location-saved`, `.gw-info-row dt`, `.gw-dp-newspaper-rule`, and anything using
`--gw-text-kicker`. **A class moves out of this list the moment it starts carrying state.**

### Correction shipped with this ledger

`.gw-shell-origin` declared `font:500 11.5px` — a raw sub-floor value on the single most
trust-critical label in the shell, the one that distinguishes a live read from a synthetic
fixture. It now resolves to `--gw-text-badge`. The pre-existing tests asserted the *token
value* existed but never that any class used it, which is exactly how this survived.

## 6. GOV Premium Success Criteria (template applied)

**Stage:** Stage 3.x reviewer-internal Alpine app · **Scope:** reviewer-internal only, Alpine-first, no public launch · **Project/repo:** `Government-watchdog-website` (`78066972-…`) · **Owner role:** UXProductDesigner (spec) → FrontendTimelineEngineer (impl) · **Reviewer path:** spec → CEO/Isaac theme-direction (§10) → Child B impl → VSR + SecurityPrivacy legs → CTO non-author merge → Isaac visual review · **Blockers / unlock rule:** GOV-427 blocked by GOV-426; this spec unblocks it.

**Success definition:** A single CSS-custom-property token layer is the source of truth for color/type/spacing/radius/border; the three `STYLE` constants consume `var(--gw-*)` with zero stray hex; the documented palette meets WCAG 2.1 AA (§2 table); trust tones stay backend-driven, icon+text, color-blind-safe; all floors (§5) hold; CI green; 3-viewport before/after screenshots attached. **Evidence:** this spec, the §2 contrast table, Child B PR + green CI + screenshots, Isaac visual sign-off.

**Failure definition:** Ships a dark theme without Isaac's decision; any text < 4.5:1 or state-bearing border < 3:1; a trust state distinguishable by color alone; a badge below 13px or a tap target below 44px; banner/blur/noindex/reduced-motion regressed; raw hex left duplicated (drift not actually fixed). **Stop/escalation trigger:** any floor regression, or Isaac choosing a direction other than refined-light → re-spec token *values* (token *names* and structure are theme-agnostic and survive).

**Workability:** Actor = Isaac (designer review) + reviewer using the internal app. Inputs = current three `STYLE` constants + this spec. Outputs = tokenized constants + shared `:root` block. Missing/stale source behavior unaffected (presentation-only change; gap/completeness/AI states keep their labels). Resume: token layer is additive and reversible per-surface; a half-applied migration still renders (vars fall back to inherited values), so an interrupted impl is safe.

**Ease of use:** Resident/Isaac comprehension target — the app reads as **one cohesive, calm, high-trust surface** rather than three slightly-different ones; status is legible at the mobile floor; trust state is obvious without color vision. Labels/statuses/gaps stay visible (§3). Required evidence: 3-viewport before/after screenshots from Child B.

**Comparable research (light-vs-dont, government-transparency context):**
- **DocumentCloud** (https://www.documentcloud.org/) — primary-source document workspace; **light, neutral, document-forward**. Lesson: a transparency/evidence product earns trust with a quiet light surface that puts the *record* first; avoid heavy chrome. Fits Alpine local-records framing.
- **GovTrack** (https://substack.govtrack.us/about) — civic tracking; **light theme, restrained accent, strong status labeling**. Lesson: a single accent + clear status words scales across many record types — exactly our `--gw-accent` + tone-word model. Avoid: dense legislative density that doesn't fit a small town.
- **Open States** (https://docs.openstates.org/api-v3/) — structured civic data. Lesson: typed concept separation maps to our token semantics (tones encode backend state, not decoration). Model fits *data*, less so small-town presentation — borrow the structure, not the density.
- **Granicus/govMeetings** (https://granicus.com/solution/govmeetings) — government meeting portals; **light, institutional, accessibility-conscious**. Lesson: government audiences (incl. older residents) expect a light, high-contrast, low-novelty surface; dark themes are rare in official civic tools and can read as less authoritative. Confirms the refined-light recommendation.
- **Pattern note:** WCAG-leaning public-sector design systems (e.g., U.S. Web Design System; UK GOV.UK) default to **light, high-contrast, single-accent** palettes for exactly this trust+legibility+older-audience reason.

**Tradeoffs:** *Refined light vs dark* — light maximizes trust/legibility for a transparency product and an older Alpine audience, matches every comparable, and reuses the already-AA palette (lowest risk, fastest); dark would be a from-scratch repalette requiring a fresh full AA pass and reads as less institutional. *Consolidation vs preservation* — consolidating the four pale surfaces and grey scale risks flattening an intentional cue (mitigated by the `#f3f8f3` provenance note in §1.1). *Tokens-now vs theme-later* — tokenizing first makes any future theme (incl. a dark variant) a **one-file value swap**, so going light now does **not** foreclose dark later. **Chosen approach:** refined light + token layer, pending Isaac's §10 decision.

**Plan before implementation:** Concept/data model = presentation tokens only (no concept/source-model change; trust semantics stay backend-driven). UI/operator behavior = §4 per-surface. Verification = §5 floors + `tsc`/test/build + §2 contrast table + 3-viewport screenshots. Artifact paths = `docs/ui-design-system.md` (this), Child B PR. Failure handling = §6 failure list. Pass-up trigger = theme-direction (§10) and any floor regression → CEO/Isaac.

**Source & auditability / Timeline & concept integrity:** Out of scope for this spec — **no concept-map, source-trail, known-then/later-outcome, or correction behavior changes.** This is presentation-token work over the existing card/timeline/topic surfaces; all source-trail, AI-label, completeness, and provenance semantics are preserved exactly (§3, §5). No new public-facing claim is introduced.

**Acceptance evidence (required from Child B):** tokenized three `STYLE` constants (no stray hex); §2 contrast table holding; green `tsc`+test+build; desktop/tablet/mobile before+after screenshots; VSR + SecurityPrivacy + CTO merge legs; Isaac visual review.

---

## 7. Resident comprehension check (30-second test)

A non-technical Alpine resident (or Isaac) opening the internal app after Child B ships should be able to say, without explanation: *"This is one consistent, official-looking page. The blue is for links/navigation. The colored chips with words and check/warning marks tell me how trustworthy each item is. I can read the small labels on my phone."* If any of those fail, the redesign failed its ease-of-use bar.

---

## 8. What this spec deliberately does NOT do

- Does **not** change any production CSS (spec/docs only — implementation is GOV-427).
- Does **not** introduce a dark theme (recommendation is refined light; final call = Isaac, §10).
- Does **not** touch trust semantics, source trail, AI/provenance/completeness labels, or concept model.
- Does **not** expand scope beyond reviewer-internal Alpine; no public-launch surface.

---

## 9. Implementation acceptance criteria for GOV-427 (Child B checklist)

- [ ] `:root` token block from §1 declared once and shared by all three constants.
- [ ] Every raw hex / ad-hoc size / radius in the three `STYLE` constants replaced by `var(--gw-*)`; **zero stray hex** remains (grep-verifiable).
- [ ] `#999 → --gw-neutral-border (#767676)` applied (the one contrast fix).
- [ ] §2 contrast table re-verified against final values.
- [ ] All §5 floors preserved; badge-font + tap-floor regression tests pass.
- [ ] `tsc` + full suite + build `rc=0`.
- [ ] Desktop (1440×900) + tablet (768×1024) + mobile (390×844) before/after screenshots attached.
- [ ] Merge gates: VSR + SecurityPrivacy sign-off + CTO non-author squash-merge.

---

## 10. Theme-direction decision (owner gate)

Isaac's only direct color remark was *"like the dark color scheme… but needs to be fixed."* This spec **recommends a refined light theme** (rationale: §6 comparables, the already-AA light palette, trust/legibility for an older civic audience, and the fact that tokenizing makes a dark variant a later one-file swap).

**How the owner decision is handled (not silent):** Isaac is a visual owner who decides by looking, not by answering an abstract "light vs dark?" prompt. The parent plan (GOV-425) already designates **Isaac's visual review as the terminal owner gate** before this is "done to spec." Therefore Child B implements the recommended refined-light token layer, and Isaac judges the **real pixels** at that gate — a far better artifact for a designer than a prose question. This is explicitly *not* silent: the recommendation and rationale are stated here, the surface is reviewer-internal only (public stays gated on Isaac via GOV-420), and **the token structure is theme-agnostic** — if Isaac wants dark after seeing it, switching is a one-file value swap (token *names* and per-surface wiring don't change). GOV-426 is therefore closed `done` to unblock Child B (GOV-427); the theme-direction call is preserved for Isaac at the visual-review gate, where it belongs.

---

## 11. Dark theme (GOV-438)

**Owner decision came in.** After seeing the refined-light token layer ship (merged @ `0e7d63f`), Isaac said **"now the dark theme."** §10 anticipated exactly this: tokenizing first made a dark variant *"a later one-file value swap."* That swap is what this section specs. It is **docs/spec only — no production CSS in this issue**; implementation is the blocked child **GOV-440**.

**What does and does not change.** The dark theme reuses **every `--gw-*` token name** and **every per-surface class wiring** from §1–§4 unchanged. A dark theme is a **re-declaration of the *color* tokens' values under a dark selector** — nothing else. Critically, the **dimensional tokens are NOT overridden in the dark block**: `--gw-badge-min`, `--gw-tap-min`, the type scale, spacing scale, radius, and border-width stay shared from the base `:root`. This is what keeps the §5 floors and their regression tests valid for free (the floor tests assert the *token* carries the px floor; dark never touches those tokens — see §11.5).

### 11.1 Dark token value set

Same names as §1.1; dark-mode values only. Surfaces go dark (not pure black — an elevated dark slate avoids halation/smear for older eyes and OLED black-smear), text goes light, tone backgrounds become **dark tints** carrying **light tone text**, the accent lifts to a light blue, and state-bearing borders lighten to clear the 3:1 floor against the dark surface.

| Token | Light (§1.1) | **Dark value** | Role in dark |
|---|---|---|---|
| `--gw-surface` | `#ffffff` | `#15181d` | Page / card background (elevated dark slate, not `#000`) |
| `--gw-surface-subtle` | `#f7f9fc` | `#1e232b` | Panels, legend, timenav, provenance bg (one step up) |
| `--gw-surface-accent-tint` | `#eef2f8` | `#1b2942` | Accent-tinted chips / neutral badge / rollup highlight |
| `--gw-text` | `#1a1a1a` | `#f2f4f7` | Body / primary text (off-white, not `#fff`, to cut glare) |
| `--gw-text-secondary` | `#333333` | `#ced5de` | Secondary text, dense metadata |
| `--gw-text-muted` | `#5b6470` | `#a4adba` | Muted captions, dates, kickers |
| `--gw-accent` | `#1a4d8f` | `#8ab4f8` | Links, focus ring, accent chips/borders (lifted for dark) |
| `--gw-accent-text-on` | `#ffffff` | `#0b1b30` | **Dark** text on the light-blue accent *fill* (button) |
| `--gw-border` | `#d0d7e0` | `#333a44` | Default **decorative** container/hairline border |
| `--gw-border-subtle` | `#e7ebf1` | `#262c34` | Faint internal separators |
| `--gw-border-strong` | `#767676` | `#8a93a0` | **State/UI-bearing** border (≥ 3:1 on dark) |
| `--gw-ok-text` | `#1e4620` | `#8fe6a8` | ok text + border (light green) |
| `--gw-ok-bg` | `#e8f0e8` | `#14241a` | ok fill (dark green tint) |
| `--gw-ok-bg-soft` | `#f3f8f3` | `#172b1d` | ok soft fill (provenance panel) |
| `--gw-caution-text` | `#7a5b00` | `#f5cf6a` | caution badge text + border (light amber) |
| `--gw-caution-text-strong` | `#5c4500` | `#f8d98a` | caution banner body text |
| `--gw-caution-bg` | `#fff3cd` | `#2a2410` | caution fill (dark amber tint) |
| `--gw-caution-bg-soft` | `#fffaf0` | `#211d12` | caution soft fill (analysis/gap frame) |
| `--gw-caution-line` | `#d9a400` | `#d9a400` | caution divider/border accent (unchanged — clears 3:1 on dark) |
| `--gw-stop-text` | `#7b241c` | `#f6a39a` | stop text (light red) |
| `--gw-stop-bg` | `#fdecea` | `#2a1512` | stop fill (dark red tint) |
| `--gw-stop-border` | `#c0392b` | `#e57368` | stop border (lifted red) |
| `--gw-neutral-border` | `#767676` | `#8a93a0` | neutral badge border (≥ 3:1 on dark) |

**Dimensional tokens (NOT re-declared in the dark block):** `--gw-badge-min`, `--gw-tap-min`, `--gw-text-*`, `--gw-space-*`, `--gw-radius*`, `--gw-border-w`, `--gw-font`, `--gw-leading*` — inherited from base `:root` unchanged.

### 11.2 WCAG 2.1 AA contrast table for dark (verified — the riskiest part)

Computed with the same WCAG relative-luminance formula (sRGB) used in §2, against the **dark** surfaces. **Targets:** ≥ 4.5:1 normal body text (1.4.3); ≥ 3:1 large/bold text and UI component / state-bearing boundaries (1.4.3 / 1.4.11). Ratios are reproducible from the script recorded in the GOV-438 thread.

| Foreground | Background | Ratio | Target | Verdict |
|---|---|---|---|---|
| `--gw-text` `#f2f4f7` | `--gw-surface` `#15181d` | **16.15** | 4.5 | ✅ body |
| `--gw-text-secondary` `#ced5de` | `#15181d` | **12.03** | 4.5 | ✅ body |
| `--gw-text-muted` `#a4adba` | `#15181d` | **7.85** | 4.5 | ✅ body |
| `--gw-text-secondary` `#ced5de` | `--gw-surface-subtle` `#1e232b` | **10.67** | 4.5 | ✅ body |
| `--gw-text-muted` `#a4adba` | `#1e232b` | **6.96** | 4.5 | ✅ body |
| `--gw-accent` `#8ab4f8` (link) | `#15181d` | **8.44** | 4.5 | ✅ body |
| `--gw-accent` `#8ab4f8` | accent-tint `#1b2942` | **6.91** | 4.5 | ✅ body |
| `--gw-accent-text-on` `#0b1b30` | `--gw-accent` `#8ab4f8` (button) | **8.21** | 4.5 | ✅ button |
| ok text `#8fe6a8` | ok bg `#14241a` | **10.83** | 4.5 | ✅ |
| ok text `#8fe6a8` | ok-bg-soft `#172b1d` | **10.04** | 4.5 | ✅ |
| caution text `#f5cf6a` | caution bg `#2a2410` | **10.32** | 4.5 | ✅ |
| caution banner `#f8d98a` | caution bg `#2a2410` | **11.25** | 4.5 | ✅ |
| caution text `#f5cf6a` | caution-bg-soft `#211d12` | **11.22** | 4.5 | ✅ |
| stop text `#f6a39a` | stop bg `#2a1512` | **8.75** | 4.5 | ✅ |
| **Focus ring** `#8ab4f8` | `#15181d` | **8.44** | 3.0 | ✅ UI |
| ok border `#8fe6a8` | `#15181d` | **11.91** | 3.0 | ✅ UI |
| caution-line border `#d9a400` | `#15181d` | **7.85** | 3.0 | ✅ UI |
| stop border `#e57368` | `#15181d` | **5.92** | 3.0 | ✅ UI |
| accent border `#8ab4f8` | accent-tint `#1b2942` | **6.91** | 3.0 | ✅ UI |
| `--gw-border-strong` `#8a93a0` | `#15181d` | **5.73** | 3.0 | ✅ UI |
| **`--gw-neutral-border` `#8a93a0`** | `#15181d` | **5.73** | 3.0 | ✅ UI |
| `--gw-border` `#333a44` (decorative) | `#15181d` | 1.55 | n/a | ⓘ exempt¹ |
| `--gw-surface-subtle` `#1e232b` vs `--gw-surface` (elevation) | `#15181d` | 1.13 | n/a | ⓘ exempt² |

¹ **Decorative-border exemption** — identical reasoning to §2 note ¹: `--gw-border` outlines containers whose presence is also conveyed by layout/padding/content; it is not the sole means of identifying the component or its state, so 1.4.11's 3:1 does not apply. Every **state-bearing** border (focus, tone verdict, neutral/strong) uses a token meeting ≥ 3:1.
² **Elevation exemption** — the subtle surface-to-surface lightness step (1.13:1) is intentionally low (standard dark-mode elevation); panel boundaries are reinforced by `--gw-border` + content, never relied on as the sole state signal.

**Result:** the dark palette is **AA-clean** for all text (every pairing ≥ 6.96:1) and all state-bearing UI (every such border ≥ 5.73:1) — comfortable margins above the 4.5 / 3.0 floors, with no value sitting on the line. Self-consistent with the §11.1 token table.

### 11.3 Trust-tone dark treatments (icon + text, never color alone, color-blind-safe)

Trust meaning stays **backend-driven** (`ui_status` / `provenance_status` / completeness) — the dark theme changes only the *paint*, never the semantics or the `assertWebSafe` contract. The light pastel tone *backgrounds* do not carry to dark, so each tone inverts to a **dark-tinted background + light tone text/glyph**; the **glyph + word** that carry the state without color are **unchanged from §3**.

| State | Dark tone tokens | Glyph + word (carries state w/o color) | Backend driver |
|---|---|---|---|
| ok / verified | text `#8fe6a8` on bg `#14241a` | ✓ + status word | `ui_status` |
| caution / unverified | text `#f5cf6a` on bg `#2a2410` | ⚠ + status word | `ui_status` |
| stop / disputed-blocked | text `#f6a39a` on bg `#2a1512`, border `#e57368` | ✕ / ⚠ + status word | `ui_status` |
| neutral / informational | accent `#8ab4f8` on tint `#1b2942`, border `#8a93a0` | • + label word | `ui_status` |
| AI-presented | caution tokens (`.gw-badge-ai`): `#f5cf6a` on `#2a2410` | "AI" + label text | per-record AI flag |
| provenance audit (`.gw-prov`) | reuses ok/caution dark tones + inset ring | ✓ / ⚠ glyph | `provenance_status` |
| completeness: complete | ok dark tokens | word "complete" | completeness summary |
| completeness: gaps | stop dark tokens | word "gaps" + count | completeness summary |
| completeness: unknown | border `#8a93a0` + text `#ced5de` | word "unknown" | completeness summary |

**Color-blind safety on dark (re-validated for the new hues).** The four tones remain separable under deuteranopia / protanopia / tritanopia because, exactly as in §3, they differ in **lightness AND word/glyph**, not hue alone:
- The **text** tones span a wide lightness/hue set — green `#8fe6a8` (L≈0.64), amber `#f5cf6a` (L≈0.65), red `#f6a39a` (L≈0.46), blue `#8ab4f8` (L≈0.46). The red/blue pair shares luminance but is split by the **word + glyph** (`✕/⚠ stop` vs `• neutral`) and by red-vs-blue hue, which is the *most* preserved axis across all three CB types (the deutan/protan confusion axis is red↔green, the tritan axis is blue↔yellow — neither collapses red↔blue).
- Every tone still leads with its **distinct word** (`verified / unverified / disputed / gaps / unknown / AI`) and, for AI/provenance/verdicts, a **glyph** (✓ ⚠ ✕ •). A grayscale or fully color-blind reviewer reads the state from the word+glyph with zero reliance on the paint. **Hard floor (§5/§11.5): no dark state may rely on color alone; the glyph+word pattern is mandatory.**

### 11.4 Trigger model recommendation

**Recommended: `prefers-color-scheme` honoring + an explicit in-app toggle (override), light remaining the default when no preference is expressed.** Mechanism, fully inside the token layer:

1. Base `:root` keeps the §1 **light** values (default; honors users/OS with no dark preference and is the safe institutional default per §6 comparables).
2. A `@media (prefers-color-scheme: dark)` block re-declares **only the color tokens** with §11.1 dark values — auto-dark for users whose OS is dark.
3. An explicit toggle sets `data-theme="dark"` / `data-theme="light"` on the root element; a `:root[data-theme="dark"]` selector carries the same dark color block and a `:root[data-theme="light"]` selector pins light. Because an attribute selector outranks the media query, the **toggle always wins** over the OS preference — reversible, explicit, standard.

**Why this over dark-as-default:** (a) keeps the already-shipped, Isaac-reviewed light theme as the default — zero regression risk to the institutional/older-resident trust posture established in §6; (b) reversible and explicit — Isaac and reviewers flip it live at the visual-review gate; (c) it is the conventional pattern (USWDS/GOV.UK-adjacent products, OS-level expectation). Dark-as-default would override Isaac's just-approved light surface for every reviewer without their consent and read as less institutional for light-preferring users. **Isaac confirms by looking** at the visual-review gate (GOV-425 terminal owner gate) — he toggles real pixels rather than answering an abstract prompt, consistent with §10.

**Focus-ring / blur / banner legibility in dark (verified):**
- **Focus ring** — `--gw-accent` `#8ab4f8` at **8.44:1** on the dark surface (§11.2); well above the 3:1 UI floor, clearly visible.
- **Click-to-reveal blur** — `filter:blur` is color-agnostic; the inert blurred `.gw-card-info` region uses surface tokens, and trust/AI badges remain **outside** the blurred region (§4.2 / §5.5) and render in the §11.3 dark tones — legible while content is hidden.
- **Fixture banner** — dark caution tokens give amber `#f8d98a`/`#f5cf6a` on `#2a2410` at **11.25 / 10.32:1**; banner text + `role=status` unchanged, clearly legible on dark.
- **`prefers-reduced-motion: reduce`** — still disables the blur transition; the media query is orthogonal to theme and untouched.

### 11.5 Floors preserved (dark must not regress — hard stops)

The dark theme is a **color-value swap only**; every §5 floor holds, and most hold *automatically* because dark never touches the relevant token:

1. **`BADGE_MIN_FONT_PX = 13` / `--gw-badge-min`** — **not** re-declared in the dark block; badge font px is inherited from base `:root`. The existing legibility regression test still guards the real floor unchanged.
2. **`DRAWER_TAP_MIN_PX = 44` / `--gw-tap-min`** — same: dimensional token, untouched by dark.
3. **Fixture banner** — text + `role=status` unchanged; dark only repaints it in caution tones (legibility verified §11.4).
4. **`noindex,nofollow`** — reviewer-internal posture unchanged; **no public-launch scope** (public stays gated on Isaac via GOV-420).
5. **Click-to-reveal blur** — preserved; trust/AI badges stay outside the blurred inert region (§11.4).
6. **`prefers-reduced-motion: reduce`** — media query untouched; orthogonal to theme.
7. **Trust semantics backend-driven + icon+text, never color alone** (§11.3); `assertWebSafe` unaffected (tokens are presentation only — dark adds no markup, no data, no new key).
8. **Reviewer-internal-only** lane behavior: public lane renders zero cards; unchanged.

Implementation (GOV-440) CI must stay green: `tsc` + full unit/integration suite + build `rc=0`, badge-font / tap-floor regression tests pass, and **no override of the dimensional tokens** in the dark block (grep-verifiable: the dark selector sets only `--gw-*` *color* properties).

### 11.6 Premium success-criteria (template applied)

**Stage:** Stage 3.x reviewer-internal Alpine app · **Scope:** reviewer-internal only, Alpine-first, **no public launch** · **Repo:** `Government-watchdog-website` · **Owner role:** UXProductDesigner (this spec) → FrontendTimelineEngineer (impl GOV-440) · **Reviewer path:** spec (this) → Child impl GOV-440 → VSR + SecurityPrivacy legs → CTO non-author merge → **Isaac visual review (terminal owner gate, toggles real pixels)**.

**Success definition:** §11.1 dark token table + §11.2 dark AA table present and self-consistent; dark is a color-value swap under a dark selector reusing every token name + per-surface wiring; all text ≥ 4.5:1 and state-bearing borders ≥ 3:1 on dark; trust tones stay backend-driven, icon+text, color-blind-safe (§11.3); trigger model recommended with rationale (§11.4); every §5 floor preserved (§11.5); no production CSS changed in *this* issue. **Evidence:** this section, the §11.2 contrast script in the GOV-438 thread, GOV-440 PR + green CI + 3-viewport dark screenshots, Isaac visual sign-off.

**Failure definition:** dark text < 4.5:1 or a state-bearing border < 3:1; a trust state distinguishable by color alone; the dark block overriding a dimensional token (badge/tap/type/spacing/radius) and regressing a floor; banner/blur/noindex/reduced-motion regressed; dark shipped as default without Isaac's look; any public-launch surface introduced. **Stop/escalation:** any floor regression or a contrast miss → re-spec the offending dark *value* (names/structure survive); any scope creep beyond reviewer-internal Alpine → CEO/Isaac.

**Comparable research (dark in civic/transparency + accessibility context):**
- **Material Design dark theme guidance** (m2.material.io/design/color/dark-theme) — recommends a **desaturated, elevated dark surface (`#121212`-class), not pure black**, and *desaturated* accent/state colors to avoid vibration/halation on dark. Our `#15181d` surface + lifted-but-not-neon tones (`#8ab4f8`, `#8fe6a8`) follow this directly.
- **GitHub / VS Code dark themes** — mature dark surfaces for dense, status-bearing technical UIs; status colors carry **icons + text**, never hue alone — exactly our glyph+word floor. Lesson: state survives on dark only if reinforced non-chromatically.
- **WebAIM contrast guidance + USWDS** — same AA thresholds apply regardless of theme; dark-mode failures cluster on muted text and state borders going *too dark*, which is why §11.2 holds muted text to 7.85:1 and every state border ≥ 5.73:1 (margin, not the line).
- **Pattern note:** public-sector systems default light (§6); offering dark as an **opt-in** (not default) keeps the institutional default while serving low-light/eye-strain reviewers — the §11.4 recommendation.

**Tradeoffs:** *Opt-in dark vs dark-default* — opt-in preserves the just-approved light default and institutional trust posture at zero regression risk; dark-default would override every reviewer's surface unasked (chosen: opt-in, §11.4). *Elevated dark slate vs pure black* — slate avoids OLED smear/halation and reads softer for older eyes; pure black maximizes contrast but increases vibration (chosen: `#15181d`). *Desaturated tones vs vivid* — desaturated light tones keep AA margins and reduce dark-mode vibration while staying CB-separable (chosen: desaturated).

**Plan / verification / auditability:** Concept/data model unchanged — presentation color tokens only; **no concept-map, source-trail, AI/provenance/completeness, or correction-behavior change**; no new public claim. Verification = §11.2 contrast (scripted), §11.5 floors, GOV-440 `tsc`/test/build + dark screenshots, Isaac visual gate. Pass-up triggers = contrast miss, floor regression, theme-default direction → CEO/Isaac.

### 11.7 Implementation acceptance criteria for GOV-440 (impl child checklist)

- [ ] Dark color block declared as (a) `@media (prefers-color-scheme: dark)` and (b) `:root[data-theme="dark"]`, plus a `:root[data-theme="light"]` pin; an explicit toggle sets `data-theme` on root (toggle outranks OS).
- [ ] Dark block re-declares **only** the §11.1 *color* tokens; **no** override of `--gw-badge-min` / `--gw-tap-min` / type / spacing / radius / border-width (grep-verifiable).
- [ ] §11.2 contrast table re-verified against final dark values (all text ≥ 4.5, state borders ≥ 3.0).
- [ ] Trust tones render icon+text in dark; no color-alone state (§11.3).
- [ ] All §11.5 floors preserved; badge-font + tap-floor regression tests pass; banner/blur/reduced-motion/noindex intact.
- [ ] `tsc` + full suite + build `rc=0`.
- [ ] Desktop (1440×900) + tablet (768×1024) + mobile (390×844) **dark** screenshots attached (+ light, to prove the toggle).
- [ ] Merge gates: VSR + SecurityPrivacy sign-off + CTO non-author squash-merge → then Isaac visual review (terminal owner gate; he toggles real pixels).

### 11.8 What §11 deliberately does NOT do

- Does **not** change any production CSS (spec/docs only — implementation is GOV-440).
- Does **not** override the dimensional/floor tokens (color values only).
- Does **not** touch trust semantics, source trail, AI/provenance/completeness labels, or the concept model.
- Does **not** make dark the default (recommendation is opt-in; final look = Isaac at the visual gate).
- Does **not** expand scope beyond reviewer-internal Alpine; no public-launch surface (GOV-420, Isaac-gated).
