// #218: this repository is PUBLIC. Playwright is not a dependency of this repo, so
// this dev-only screenshot helper borrows an installation from elsewhere on the
// machine — but WHERE is a property of that machine, not of the source. Both
// locations come from the environment and the script says exactly what to set.
const CORE = process.env.GW_PLAYWRIGHT_CORE;
const EXEC = process.env.GW_CHROME_HEADLESS_SHELL;
if (!CORE || !EXEC) {
  console.error(
    'gov1569-shot: set GW_PLAYWRIGHT_CORE to a playwright-core entry point '
    + '(…/node_modules/playwright-core/index.js) and GW_CHROME_HEADLESS_SHELL to a '
    + 'chrome-headless-shell binary. Neither is tracked here — see issue #218.',
  );
  process.exit(2);
}
const pkg = await import(CORE);
const { chromium } = pkg.default ?? pkg;
const OUT = process.env.SHOT_DIR || '/tmp';
const BASE = process.env.SHOT_BASE || 'http://127.0.0.1:4212';

const browser = await chromium.launch({ executablePath: EXEC });
const page = await browser.newPage({ viewport: { width: 1200, height: 1400 } });

const bodies = [];
page.on('response', async (res) => {
  const url = res.url();
  if (url.endsWith('.js') || url.endsWith('.css') || /\.(woff2?|png|svg|ico)$/.test(url)) return;
  try { bodies.push({ url, text: await res.text() }); } catch {}
});

// state key → [hash suffix, selector to wait for]
const STATES = [
  ['gated-out', 'upload?gate=denied', '[data-test="gated-app"]'],
  ['idle', 'upload?reviewer=1', '[data-test="upload-form"]'],
  ['validating', 'upload?reviewer=1&ustate=validating', '[data-test="upload-error-file"]'],
  ['uploading', 'upload?reviewer=1&ustate=uploading', '[data-test="upload-inprogress"]'],
  ['received', 'upload?reviewer=1&ustate=received&rstatus=received', '[data-test="upload-success-pending"]'],
  ['held', 'upload?reviewer=1&ustate=held', '[data-test="upload-held"]'],
  ['error', 'upload?reviewer=1&ustate=error', '[data-test="upload-error"]'],
];

const captured = {};
for (const [key, hash, sel] of STATES) {
  await page.goto(`${BASE}/#/${hash}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(sel, { timeout: 15000 });
  await page.screenshot({ path: `${OUT}/gov1569-${key}.png`, fullPage: true });
  captured[key] = await page.$eval(sel, (e) => ({
    phase: e.getAttribute('data-phase'),
    chip: e.querySelector('[data-test="review-state-chip"]')?.textContent || null,
    placeholder: !!e.querySelector('[data-test="review-pending-placeholder"]'),
    state: e.getAttribute('data-state'),
    text: (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160),
  }));
}

// Network raw-path / PII / verified-language scan across every non-asset body.
const MARKERS = ['/Users/', '/home/', '/var/', '/private/', 'Obsidian Vault', '.sha256', '"review_state"', 'raw_local', 'transcript_path'];
const leaks = [];
for (const b of bodies) {
  for (const m of MARKERS) if (b.text.includes(m)) leaks.push({ url: b.url, marker: m });
}

console.log(JSON.stringify({ captured, networkBodies: bodies.length, leaks }, null, 2));
await browser.close();
