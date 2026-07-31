# GOV-668 responsive acceptance captures

Moved here from the **repo root** during the iteration-50 C11 pass on `ci-tooling`.

`docs/product/route-and-state-matrix.md` §Responsive acceptance matrix treats desktop,
tablet and mobile as three separate acceptance views, and this repo already had a
versioned `docs/evidence/<ticket>/` convention. These six captures (three here, three in
`GOV-671/`) bypassed it and sat loose in the root — the first half of what #92 reports.

**These are a static snapshot, not a reproducible set.** #92's actual ask — a capture
script covering all ten MOTY routes at three viewports in both modes — is **deferred**:
it needs browser automation (Playwright/Puppeteer), the repo has none, and adding a
dependency from this worktree is unsafe because `node_modules` resolves from the parent
checkout rather than here. That is a dependency decision for the owner, recorded on #92.

Regenerating these by hand is not currently possible from any documented command; that is
precisely the gap #92 exists to close.
