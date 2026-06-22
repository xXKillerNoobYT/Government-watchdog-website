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
