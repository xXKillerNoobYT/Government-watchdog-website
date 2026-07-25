# GOV-53 contextual information notes

## Outcome

GOV-53 adds a compact, keyboard- and touch-operable `?` explanation to the
shared shell and every major public, reviewed, designed-gap, and explicit
synthetic-preview surface. The implementation preserves the MOTY Simple and
Advanced layouts while keeping authorization server-authoritative.

Each explanation answers:

- what the control, value, or module is;
- which approved source or future backend projection fills it;
- where the information is filed;
- how review and updates work;
- the current lifecycle state;
- limits and non-claims;
- the expected end result;
- method version, inputs, exclusions, denominator, cadence, and missing-data
  behavior when the surface presents a score or measurement.

## Safety and access boundary

- Public-safe definitions live in `src/ui/info-note.ts`.
- Reviewer/private definitions live in
  `src/ui/private-info-note-definitions.ts`, outside the anonymous production
  module graph.
- A display-mode toggle does not grant a plan, geography, team, or data
  entitlement.
- Pre-admission loading, denied, unavailable, and invalid reviewer-context
  states render no private note trigger or private explanatory copy.
- Synthetic design fixtures remain explicit and visibly labelled; they are not
  substituted for unavailable reviewed civic data.
- Open panels are portalled to `document.body`, positioned against the
  viewport, and returned to their wrapper when closed. This prevents clipping
  by route overflow, transform, or backdrop-filter ancestors.

## Route and module coverage

| Area | Covered surfaces |
| --- | --- |
| Anonymous Free | plan, location scope, service coverage, feed status, meetings, decisions, sources/corrections, AI safety, Advanced preview |
| Shared shell | AI disclosure, location, search, account, notifications, navigation, data origin, Simple print, Simple/Advanced display preference |
| Home | route overview, jurisdiction filters, metrics, everyday briefing, edition history, designed gaps |
| Agenda and research | Fast Agenda, agenda filters, timeline map and levels, Boards, Issue threads, Source Vault |
| Designed tool routes | Power Tracker, Watchlist, Location, Civic Alerts |
| Records and context | Topics, Cards, legacy Timeline, Government Body, Meeting, record trust and receipts |
| Publishing | newsletter overview, trust/method, archive, and missing projection slots |
| Access states | beta entry and all six account-access states, with no pre-admission private copy |

Simple and Advanced use the same authorized facts, source language, lifecycle,
and limitations. Their differences are presentation density and tool layout
only.

## Interaction and accessibility contract

- Native `button` triggers with unique `aria-controls`, `aria-expanded`, and
  purpose-specific accessible names.
- Repeated definitions receive contextual labels; every design-route trigger
  has a unique accessible name within that rendered page.
- Hover/focus previews; click/touch pinning; one pinned panel per document.
- A 120 ms hover bridge lets a pointer enter and scroll the panel.
- Outside press, close button, or document-level Escape dismisses a pinned
  panel; keyboard dismissal restores trigger focus without reopening.
- Trigger and close targets are 44 by 44 CSS pixels through tablet and phone
  widths.
- Every route owns one descriptive `h1`; embedded Topics/Card Feed surfaces
  begin at `h2`.
- Grouped fixture explanations show a visible per-note label beside each
  control.

## Responsive visual evidence

These images use the explicit `demo=design` synthetic fixture. They verify
layout and interaction only; they are not evidence of live or reviewed civic
facts.

| Mode | 1440 × 900 | 768 × 1024 | 390 × 844 |
| --- | --- | --- | --- |
| Advanced | [desktop](gov53-home-advanced-1440x900.png) | [tablet](gov53-home-advanced-768x1024.png) | [phone](gov53-home-advanced-390x844.png) |
| Simple | [desktop](gov53-home-simple-1440x900.png) | [tablet](gov53-home-simple-768x1024.png) | [phone](gov53-home-simple-390x844.png) |

Open-panel evidence:

- [Simple tablet viewport-clamped panel](gov53-home-simple-note-768x1024.png)
- [Simple phone bottom sheet](gov53-home-simple-note-390x844.png)

Measured browser evidence:

- tablet panel parent: `BODY`;
- tablet panel bounds: left 10 px, right 430 px, top 89 px, bottom 598.5 px
  within a 768 × 1024 viewport;
- phone panel bounds: left 10 px, right 365 px, top 286.8 px, bottom 834 px
  within a 390 × 844 viewport;
- trigger and close targets: 44 × 44 px at both required touch widths;
- Simple and Advanced phone document overflow: 0 px;
- Simple tablet navigation begins at Home and remains horizontally scrollable.

## Verification

Final evidence recorded on 2026-07-24:

- `npm run typecheck` — passed.
- `npm test -- --no-cache --reporter=dot` — 46 files, 698 tests passed.
- `npm run build:all` — passed.
  - public JS: 36.73 kB, 11.74 kB gzip;
  - private-beta JS: 797.58 kB, 169.36 kB gzip;
  - direct-exposure check passed;
  - public protected-marker scan passed.
- `npm run e2e:local` against backend commit
  `0597802db7df12eec604ec6b4bab42b449398683` — passed.
  - 18 backend deny-list/service tests passed;
  - non-loopback bind refused;
  - anonymous landing 200, reviewer API 403, disabled notifications 404;
  - approved session received 34,696 service-only reviewer rows;
  - no gated static asset or populated local/vault path;
  - gated beta magic-link, Strict cookie, sign-out, hash-only logs, and empty
    public lane passed.

The private bundle remains above the existing optimization threshold and is
tracked by #49. No production deployment is part of GOV-53.

## Review findings tracked

- #61 — pre-admission reviewer states exposed private help copy; fixed and
  regression-tested in this slice.
- #62 — viewport-safe and fully operable note overlays; fixed and
  regression-tested in this slice.
- #63 — Simple tablet/mobile header collision and overflow; fixed and
  visually verified in this slice.
- #64 — unique contextual names, headings, and grouped-note placement; fixed
  and regression-tested in this slice.
