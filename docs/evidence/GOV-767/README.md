# GOV-767 — landing dark-token washout after visiting the gated app

Defect (pre-existing on `main` @ `e8aa7b6`, found in the GOV-760 UX review): the
shell's Advanced reading-mode default applies `data-theme="dark"` without
persisting; hash-navigating back to `#/` left the attribute on the root, so the
landing hero rendered the dark light-text token (`#ECF1F7`) over the unpainted
white canvas — nearly invisible.

Fix (two defenses, `src/ui/landing.ts`):
1. `renderLanding` re-applies the STORED theme preference (mirror of the
   `mountThemeToggle` boot path): an unpersisted mode leak is undone (unset →
   `system`); an explicit System/Dark/Light pin is re-applied verbatim, never
   overridden (GOV-654 §1.4).
2. `LANDING_STYLE` paints the page canvas from the active token set
   (`html{background:var(--gw-page-bg)}` — the same token the shell paints), so
   a real dark palette (explicit pin / OS-dark) is fully dark and AA-readable.

Capture: Playwright (chromium headless-shell 1228) against `npm run dev`
@ branch `GOV-767-landing-theme-washout`, 2026-07-16. Flow per scenario:
open `#/app?reviewer=1` (shell applies Advanced-dark; verified
`data-theme="dark"` before nav — no regression), then SPA hash-nav to `#/`.

| # | file | scenario | probe |
|---|------|----------|-------|
| 00 | `00-desktop-1440-app-shell-dark-default.png` | shell before nav | `data-theme="dark"` (Advanced default intact) |
| 01 | `01-{desktop-1440,tablet-768,mobile-390}-landing-after-app-default.png` | no pin, back to `#/` | attribute removed; h1 `rgb(30,28,23)` on `rgb(243,237,221)` — contrast **14.57:1** |
| 02 | `02-{desktop-1440,tablet-768,mobile-390}-landing-after-app-dark-pin.png` | explicit dark pin, back to `#/` | `data-theme="dark"` kept; h1 `rgb(236,241,247)` on `rgb(11,15,20)` — contrast **16.92:1** |

AA floor is 4.5:1; both flows clear it at desktop 1440×900, tablet 768×1024,
and mobile 390×844 (COMPANY.md viewport floor). Regression tests:
`test/gov767-landing-theme.test.ts` (suite 419/419 green, `tsc --noEmit` clean).
