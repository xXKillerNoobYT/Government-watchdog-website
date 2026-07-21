# MOTY Government Watchdog design baseline — July 2026

Status: **owner-approved baseline design reference**

This directory preserves the MOTY Government Watchdog frontend handoff supplied
by the project owner on July 20, 2026. It is the baseline for the app's:

- page layout and information hierarchy;
- spacing, density, typography, color, and responsive behavior;
- shared navigation and placement of tools;
- Simple newspaper and Advanced workbench modes; and
- interaction intent, especially Fast Agenda and the hybrid Timeline.

The handoff was created with a small amount of prototype functionality and a
strong emphasis on layout, look, and spacing. Treat its behavior as an
interaction illustration, not as production business logic. Production
behavior must use this repository's access gate, web-safe backend contracts,
review labels, and source/provenance rules.

## Preserved source

- Original archive: `MOTY Government Watchdog Frontend Design.zip`
- Original archive SHA-256:
  `c2da1ae0af48c9f6753fccb4bcc1f0794677545c7262f673e7743e64718b6d8e`
- Original archive size: 186,933 bytes
- `reference/`: byte-for-byte extracted files from the archive's single
  `design_handoff_government_watchdog/` directory
- `reference/README.md`: the handoff author's original implementation notes
- `MANIFEST.sha256`: integrity hashes for the archive and extracted files

The raw archive is kept so the received handoff can always be recovered exactly.
The extracted copy is kept so designers and implementers can inspect and diff
individual screens without unpacking the archive.

## Safety and publication boundary

These files are internal design references. They are intentionally outside
`src/`, `public/`, and `dist/`, so the production build does not publish them.
The prototype contains synthetic civic content and must not be treated as a
reviewed data source.

Do not execute or port `reference/support.js`. The original handoff explicitly
identifies it as prototype runtime support; it loads browser tooling from public
CDNs and is not part of the production architecture. The app continues to use
its vendored fonts and TypeScript/Vite implementation.

The supplied archive contains no standalone license or redistribution grant.
It is retained in this private repository at the project owner's direction for
internal project use. Confirm publication rights before redistributing the raw
handoff outside the project.

## Baseline change rule

Do not silently edit these preserved files. If the owner approves a replacement
baseline, add a new dated sibling directory, preserve the new source archive and
hashes, and document what superseded this version. Product code may evolve, but
intentional departures from this baseline should be recorded in the pull
request with the accessibility, data-integrity, or usability reason.

Implementation mapping and backend boundaries live in
[`docs/design-handoff-integration.md`](../../../docs/design-handoff-integration.md).
Minimum content-quality and fail-closed release rules live in
[`docs/content-quality-baseline.md`](../../../docs/content-quality-baseline.md).
Build, deployment, site identity, and public-release gates live in
[`docs/deployment-sites.md`](../../../docs/deployment-sites.md).
