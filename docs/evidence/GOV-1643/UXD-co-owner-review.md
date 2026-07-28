# GOV-1643 — UXProductDesigner co-owner review (accessibility sweep + hidden-lock adjudication)

**Reviewer:** UXProductDesigner (co-owner, named on the lane per the GOV-1641 owner directive).
**Primary owner:** FrontendTimelineEngineer (walkthrough author).
**Method:** independently drove the real running app at `http://localhost:5173`
(`xXKillerNoobYT/Government-watchdog-website` @ `main` `ac79d48`, fixture mode, reviewer bypass
`?reviewer=1` in the hash query) with a real Chromium (playwright-core 1.55, cached
`chromium_headless_shell-1187`). Reviewer bypass and public-lane behavior confirmed against source.
Evidence set: `docs/evidence/GOV-1643/*.png` (this directory) + machine reports
`00-sweep-report.json`, `00b-recon2.json`.

> This is the co-owner **review** contribution — an independent accessibility sweep and hidden-lock
> adjudication of the current `main` baseline. It is not a verification verdict (VSR owns
> `observed → verified`) and it does not close the lane. Per-shipped-item capture against auto-go's
> first website PR remains FTE's deliverable and is pending auto-go production.

## Adjudication: Severity-1 hidden locks — NONE (confirms FTE), now source-verified

I independently drove the two surfaces that *could* structurally trap a keyboard/AT user and confirm
both are enterable, exitable, and completable:

- **Notification panel** (`src/ui/notification-panel.ts`) — **exemplary, no lock.** Verified at
  source + behavior level: `open()` moves focus into the drawer (`closeBtn.focus()`, line 305),
  `close()` restores focus to the bell (`bell.focus()`, line 311), an **Escape** handler closes it
  (lines 317–322), outside-click closes it (line 292), the bell toggles and tracks `aria-expanded`,
  and the close control carries `aria-label="Close notifications"`. Bell tap target is a full 44px;
  the unread count is redundantly exposed in the bell's `aria-label` ("Notifications, N unread"), so
  colour/badge is never the sole carrier. Captured at all three viewports (`04-*-notif-open.png`).
  *(My first automated probe reported `escapeClosed:false` — that was a false negative: the panel
  toggles via the `hidden` attribute on an always-present `role="dialog"` node, and my selector keyed
  on a non-existent "open" class. Source read + focus trace corrects it. Not a defect.)*
- **Source Vault** (`renderSourceVault`, `src/ui/pages-program.ts`) — **no lock, by construction.**
  The vault "drawer" is an **inline** contract-diff workbench (`.gw-vault-contract-diff` is a
  two-pane grid; `.gw-vault-contract-tool` are inline toolbar buttons), not a modal dialog. There is
  no `role="dialog"`/`aria-modal` on this surface, so no focus trap is structurally possible; the
  shell nav stays present and reachable throughout. Captured `05-*-vault.png`.

All flows enterable/exitable/completable across 1440/768/390, Simple + Advanced, and print. No forced
choice, no data lock-in, no trapped state. **This corroborates FTE's finding of 0 Severity-1 locks.**

## Accessibility sweep (deeper than the unit suite) — findings

Positives (verified this run):
- **0 unnamed interactive controls** at all three viewports — every `a`/`button`/role=button
  resolves to a non-empty accessible name (aria-label, text, or title). Icon-only controls (bell,
  close ✕) are labelled.
- **Contrast** — all sampled status/label text passes WCAG 2.1 AA: mode buttons 9.7–11.3:1, level
  chips 9.9:1, notification count 6.2:1. No pair below 4.5:1 observed.
- **Focus management** on the one modal-ish surface (notifications) is correct (move-in + restore).
- **Public lane** (no bypass): 0 cards, gate panel shown, **no civic leak** (no `$`, "ordinance",
  "resolution", vote language in body) — corroborates GOV-1644. `08-1440-public-home-nobypass.png`.

### Finding F1 — Severity-2 — 24px horizontal body scroll at ALL three viewports
**Flow/where:** shell content wrapper on `#/home`, `#/timeline`, `#/vault` (reviewer lane), 1440 *and*
768 *and* 390. **Observed, user-real, not a screenshot artifact:** measured via DOM metrics AND a
programmatic scroll test — `documentElement.scrollWidth` (1464) exceeds `clientWidth` (1440) by 24px,
and `window.scrollTo(200,0)` lands at `scrollX = 24` (the body genuinely scrolls horizontally). The
overflow is **constant at 24px regardless of viewport width**, which rules out a per-breakpoint
blowout and points to a single shell-level cause. Widest offender is `main.gw-shell-content`
(measured `left:8 … right:1464`, i.e. `width:1456` on a 1440 viewport); its children fit inside it.
Global `box-sizing:border-box` is set (`shell.ts:552`), so this is *not* padding-on-100% — it is a
width/offset math issue in the shell root/content chain (`shell.ts:626`), not the info-panel
(`position:fixed`, 390px, ruled out).
**Why it matters:** violates my A5 responsive-integrity criterion and Stage-6 X6 ("no horizontal body
scroll at any of the three"). On mobile a 24px horizontal jiggle is user-noticeable.
**Severity:** 2 (responsive-integrity defect; not a Sev-1 trap — the user is not stuck).
**Caveat honored:** the lane directive warns headless can false-clip *screenshots*; this finding is
DOM-measured + scroll-confirmed, not screenshot-derived — but FTE should still reproduce in a headed
browser/simulator before fixing, since headless scrollbar handling can shift `clientWidth`.
**Routed to:** child issue → FTE (owns `src/ui/shell.ts`).

### Finding F2 — Severity-3 (note) — notification count badge below the 13px badge floor
`.gw-ntf-badge` renders the unread count at **11.52px** (`--gw-text-xs`), below `BADGE_MIN_FONT_PX = 13`
(`notification-panel.ts:343`). Contrast passes (6.2:1) and the count is redundantly in the bell's
`aria-label`, so it is not an AA failure and not colour-as-sole-carrier. **Adjudication (I own the
floor):** a numeric count *bubble* is a defensible documented exception to the status-badge floor
— but the exception must be written down. Recommend either raising to 13px or adding an explicit
count-bubble carve-out to `docs/ui-design-system.md §5 floors`. Non-blocking.

### Finding F3 — Severity-3 (note) — sub-44px controls (above WCAG AA min, below the aspirational floor)
Simple/Advanced mode buttons measure ~36px tall; the notification close ✕ is
`calc(--gw-tap-min − 8px)` ≈ 36px (`notification-panel.ts:350`). All are ≥ the WCAG 2.1 AA 2.5.8
minimum (24px) but below the 44px comfort target. The named floor `DRAWER_TAP_MIN_PX = 44` governs
*drawer tap targets*; these are header/topbar controls. Non-blocking; flagged for the ledger.

## RV/DG/GS binding contract
No "COMING SOON" on civic data; no lorem; no invented civic value observed. DEV SAMPLE / SYNTHETIC
DESIGN FIXTURE banners present on fixture content. Consistent with GOV-1644's standing note that GS
(unbuilt-feature) and DG (missing-data) are currently collapsed into one designed-gap affordance
rather than the three distinct RV/DG/GS states the contract names — I concur; tracked at the matrix
ledger, non-blocking here.

## Did Not Do
- Did not capture a 768-width print screenshot (captured print at 1440 + 390 — desktop and mobile
  print media; 768 print is the same `@media print` path).
- Did not exercise a specific vault inline control end-to-end (the reviewer-lane vault did not expose
  a `.gw-vault-contract-tool` at capture time); adjudicated structurally instead — no modal exists to
  trap the user.
- Did not verify `verified` status (VSR's job) and did not set the issue status (FTE is primary/closer;
  cross-agent status PATCH is out of my scope).
- Did not capture per-shipped-item evidence against an auto-go website PR — none has shipped yet.
