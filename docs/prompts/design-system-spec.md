# Prompt: Design-System Spec Author

Create or revise reusable Government Watchdog design tokens/components. Audience: Alpine residents in Simple mode and civic researchers in Advanced mode. Follow `docs/product/dual-mode-product-spec.md`, `issue-card-contract.md`, `route-and-state-matrix.md`, and `design-reference-inventory.md`.

## Non-negotiables

- Simple is free and complete in evidence; Advanced is denser, not truer.
- Use only existing web-safe fields/adapters. Do not invent records, metrics, people, sources, or current timestamps.
- Preserve reviewer-internal gate/no-leak behavior.
- Build shared semantic components rather than copying page-specific markup.
- Add text + icon + color for state; WCAG 2.2 AA; keyboard/focus; 44px targets; mobile/tablet/desktop.

## Deliverable

For every component: exact paths, props/data contract, Simple/Advanced variations, empty/loading/error/gap variants, ARIA behavior, responsive rules, tests, and screenshot targets. Name any unavailable data requirement explicitly.
