/**
 * GOV-658 sub-leg 2c — self-hosted webfonts (GOV-657 spec §2.3).
 *
 * WHY this module exists (and why it is a hard requirement, not polish):
 * §3.5 folds font serving into the public-lane zero-leak posture. A gated,
 * reviewer-internal, `noindex` app must not emit runtime beacons to a font CDN
 * (Google Fonts et al. would receive reviewer IP, timing, and `Referer` on every
 * page load). So the three families the wireframes call for are VENDORED as
 * WOFF2 subsets via `@fontsource/*` (all SIL OFL 1.1) and served from our own
 * origin through the Vite build — zero third-party font requests at runtime.
 *
 * These are side-effect CSS imports: each file declares its `@font-face` block,
 * and Vite rewrites the `url(...)` to a fingerprinted same-origin `/assets/*.woff2`.
 * Loaded once from the app-boot entry only (see `src/main.ts`) — never from a
 * per-surface style string, so the unit-test path (jsdom) stays hermetic.
 *
 * Weight budget (§2.3, keep total ≤ ~350KB — measured vendored latin subset ≈ 192KB):
 *   Public Sans    400 / 600 / 700 / 800  — all Advanced UI + light-mode labels
 *   Newsreader     400 / 600 / 700 + 400-italic — Simple/broadsheet body + headlines
 *   IBM Plex Mono  400 / 500              — fixture banner, dates, hashes, axis, numbering
 *
 * `latin-*` subsets only (the app is English, Alpine-WY reviewer-internal). If a
 * webfont fails to load, the token fallback stacks (tokens.ts §2.3) keep every
 * layout legible with no FOIT — the trust surface never blanks out.
 *
 * The token font-family values (`--gw-font`, `--gw-font-serif`, `--gw-font-mono`)
 * already name these families first (tokens.ts); this module makes the origin
 * actually serve them.
 */

/* Public Sans — sans, all Advanced UI + light-mode UI labels */
import '@fontsource/public-sans/latin-400.css';
import '@fontsource/public-sans/latin-600.css';
import '@fontsource/public-sans/latin-700.css';
import '@fontsource/public-sans/latin-800.css';

/* Newsreader — serif, Simple/broadsheet body + headlines (+ italic for pull quotes/dek) */
import '@fontsource/newsreader/latin-400.css';
import '@fontsource/newsreader/latin-600.css';
import '@fontsource/newsreader/latin-700.css';
import '@fontsource/newsreader/latin-400-italic.css';

/* IBM Plex Mono — fixture banner, dates, hashes, timeline axis, agenda numbering */
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';

/**
 * The three self-hosted family names, exported so a test can assert the token
 * font stacks lead with a vendored family (and never a third-party CDN URL).
 * These strings must match the `local()`/`font-family` names @fontsource declares.
 */
export const SELF_HOSTED_FONT_FAMILIES = [
  'Public Sans',
  'Newsreader',
  'IBM Plex Mono',
] as const;
