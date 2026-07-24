# Government Watchdog Dual-Mode Product Specification

> **Status:** adopted 2026-07-24 as a supporting product spec. Where this document
> disagrees with [`docs/design-handoff-integration.md`](../design-handoff-integration.md)
> or [`docs/design-information-type-matrix.md`](../design-information-type-matrix.md),
> those binding docs win.

## Product promise

Government Watchdog helps an Alpine resident answer: **What is government doing, what evidence supports that, what happens next, and where can I read the original record?** It is nonpartisan, source-linked, and explicit about what is unknown.

It is not a generic political dashboard, a replacement for official records, or an engine for unsupported official/issue scoring.

## Modes

### Simple — free resident experience

Simple is the full accessible baseline. It uses an editorial reading model:

- Weekly/Home front page
- plain-English issue story
- agenda/meeting digest
- timeline river
- source receipts
- newsletter/archive
- coverage/location explanation
- concise, supported next-public-action guidance

Simple retains official identifiers, sources, trust/gap labels, and access to original records. It may show fewer filters and less dense metadata than Advanced.

### Advanced — future member/research experience

Advanced adds research depth over the same approved facts:

- dashboard widgets backed by actual projections
- issue dossier with metadata, event spine, and evidence/proof rail
- fast-agenda filters and meeting groupings
- lifecycle boards using backend-provided lanes
- source vault with versions/ledger/diff only when projected
- saved views/watchlist after a separate account/privacy decision
- Power Tracker only after methodology, public-record roster, and evidence rules are approved

**No paywall, billing, login, or entitlement enforcement is in this phase.** Future access tiers must be designed in a separate privacy/entitlement decision record; Simple must not become an evidence-poor teaser.

## Component system

| Component | Simple expression | Advanced expression | Shared data contract |
|---|---|---|---|
| App shell | broadsheet masthead and reading navigation | operational dark header and tabs | route, mode, Alpine coverage, real refresh only |
| Issue card | story card with key action and receipts | dense issue row with lifecycle/trust metadata | IssuePresentation |
| Issue detail | article narrative + timeline + sources | dossier + proof rail + revisions | IssuePresentation |
| Meeting card | readable meeting digest | workbench/grouped meeting card | MeetingPresentation |
| Source receipt | linked citation | evidence row with locator/version | SourceReceiptPresentation |
| Trust/gap state | plain-language explanation | badge plus evidence/context | TrustPresentation |
| Timeline event | river entry | grouped/lane/event row | TimelineEventPresentation |

## Quality bar

### Content and source quality

- No claim reaches a view without either a source receipt or a visible gap/pending state.
- Distinguish official material, plain-English explanation, automated assistance, and Watchdog status note.
- Preserve backend labels rather than translating them into more dramatic claims.
- Use real source/record/update time labels; never display decorative “freshness.”

### Design quality

- Simple: warm paper, Newsreader story hierarchy, readable scan paths.
- Advanced: dark surface ladder, mint accent, constrained semantic status colors, data density without noise.
- All interactions use one language of cards, chips, receipts, drawers, filters, and empty states.
- No fake search, alerts, map, scores, dead nav, print button, or data-widget count.

### Accessibility and responsive quality

- WCAG 2.2 AA target; text/icon/color state representation; focus-visible controls.
- keyboard-only completion for every route and drawer.
- 44px interactive target floor; badge text floor retained from token tests.
- 320px, 390px, tablet, desktop, and 200% zoom validation.
- motion respects reduced-motion; animations never carry meaning alone.

## Delivery sequence

1. **Phase 0 (this delivery):** inventory, route/state matrix, card contract, prompts.
2. **Phase 1:** canonical presentation types/adapters and no-leak contract tests.
3. **Phase 2:** shared token/component implementation plus card-state test fixtures.
4. **Phase 3:** one complete vertical slice—Simple Issue Story and Advanced Issue Detail for the same permitted record; prove data parity.
5. **Phase 4:** Home, Agenda, Timeline, Boards, Vault, Watchlist, Newsletter, Location route families.
6. **Phase 5:** advanced-only projections that actually have approved data; visual/accessibility/security release gates.

## Completion definition

Completion means every uploaded reference surface is either:

1. implemented as a source-grounded route/component with all required states, **or**
2. marked unavailable/deferred with the specific missing contract, data, policy, or approval documented.

It does not mean copying all mockup widgets regardless of data readiness. A complete Watchdog is trustworthy precisely because it visibly refuses to fabricate the missing parts.
