# Canonical Civic Card and Issue Detail Contract

> **Status:** adopted 2026-07-24 as a supporting product spec. Where this document
> disagrees with [`docs/design-handoff-integration.md`](../design-handoff-integration.md)
> or [`docs/design-information-type-matrix.md`](../design-information-type-matrix.md),
> those binding docs win.

## Purpose

This contract makes all government-facing cards truthful, consistent, and reusable. It applies to issue cards, agenda cards, meeting cards, timeline events, source receipts, transparency alerts, watch items, and any future official/person analysis cards.

The visual system may be Simple or Advanced; the evidence contract is one system.

## Card anatomy

| Region | Required content | Rules |
|---|---|---|
| Identity | canonical type, stable ID, official identifier/title | Never substitute a generated headline for official identity without retaining the official label/ID. |
| Context | jurisdiction, public body, meeting, date/time, agenda position if provided | Display only web-safe fields; distinguish event date from archive/update time. |
| Status row | lifecycle status, trust/review state, source/gap/change labels | Backend-authoritative labels; text + icon + color; no frontend score inference. |
| Resident explanation | plain-English summary, why it matters, affected people, next public action | Each block requires supported data and its own label; omit/mark unavailable when absent. |
| Evidence | source receipts and original/archive links | Every claim-oriented card exposes source path or explicit no-source/gap state. |
| Activity | key timeline events, revision/change record, deadlines | Event type and time basis must be named. |
| Actions | open issue, agenda, packet, original source, archive, compare versions, watch/share | Must work or be absent. Account/notification actions stay labeled local-only/unavailable until approved. |

## Required presentation types

### `IssuePresentation`

```ts
interface IssuePresentation {
  id: string;
  officialTitle?: string;
  displayTitle: string;
  jurisdiction?: string;
  body?: string;
  meeting?: { id?: string; title?: string; date?: string; location?: string };
  agenda?: { itemId?: string; title?: string; order?: string };
  lifecycle: LifecycleState;
  trust: TrustPresentation;
  summary?: LabeledText;
  whyItMatters?: LabeledText;
  affected?: LabeledList;
  nextAction?: NextAction;
  events: TimelineEventPresentation[];
  sources: SourceReceiptPresentation[];
  changes: SourceChangePresentation[];
  access: AccessPresentation;
}
```

`displayTitle` may fall back to a bounded verbatim statement/record ID but cannot imply that an issue exists when the source only supports a statement. The production adapter must document the fallback.

### `SourceReceiptPresentation`

| Field | Requirement |
|---|---|
| `sourceId` | stable web-safe reference |
| `title` / `sourceType` / `publishedBy` | render when provided; do not invent document names |
| `sourceDate`, `validatedAt`, `capturedAt` | labeled by time meaning |
| `locator` | page, section, agenda item, or video timestamp when present |
| `originalUrl`, `archiveUrl` | safe external link; omit if absent/unsafe |
| `version` / `changeState` | only when deterministic projection exists |
| `integrity` / `trust` | backend-provided term only |

### `TrustPresentation`

| State | Required user-facing text |
|---|---|
| verified/source linked | source-linked or backend-provided equivalent |
| reviewed | reviewed; do not imply publication approval |
| AI assisted | AI-assisted explanation/presentation, with source evidence retained |
| pending review | pending review; not a verified fact |
| gap / no primary source | clearly name missing artifact and scope of uncertainty |
| reviewer internal | reviewer-internal/local snapshot; not a public live read |

## Required card variants

| Variant | Minimum content | Advanced additions |
|---|---|---|
| Issue summary | identity, context, lifecycle, trust, one summary/action/source | impact/area metadata, evidence count, related threads/changes |
| Issue detail | all IssuePresentation sections | proof rail, event spine, revisions/diff, connected records |
| Agenda item | meeting/date/body, official agenda item, status, source receipt | lifecycle lane and related reviewed records |
| Meeting | date/body/location, official availability status, agenda/packet links | filters, item groups, deadline panel, saved view placeholder |
| Timeline event | event type, date/time basis, title, receipt | event grouping/filter tags and source relation |
| Source receipt | title/type/date/locator/link/trust | validation, archive, version, diff/ledger when projected |
| Transparency alert | deterministic trigger, why flagged, evidence, timestamp | compare/diff, remediation/history only when supported |
| Gap card | missing artifact, impacted surface, status | tracking/detection context; no invented completion date |
| Watch item | local record identity, source, open/remove | account/history/settings only after approval |
| Person/power item | methodology and cited facts | never show score/verdict until an approved, reproducible methodology and reviewed roster exist |

## Micro-interaction contract

- **Mode toggle:** changes layout/density; cannot change record truth, access, or source availability.
- **Card click:** opens a stable issue/detail route; card-level nested actions remain keyboard reachable.
- **Drawers/details:** use native semantic controls or fully equivalent ARIA; preserve summary focus/tap target ≥44px.
- **Filters:** write a valid URL/query state; default, cleared, and no-results states are visible.
- **External source links:** `target=_blank`, `rel=noopener noreferrer`; explicit text says Original/Archive/Source rather than a vague icon.
- **Diff:** render only from a deterministic source-version comparison; name the compared versions/times.
- **Watch:** local-only label until persistence, authentication, notification policy, and user consent are complete.

## Prohibited content

- guessed speaker/official names or roles
- calculated impact, confidence, conflict, promise, or outcome claims without approved backend fields/methodology
- misleading current timestamps on frozen data
- source/receipt links that expose local paths, raw vault paths, internal review notes, or inaccessible storage
- decorative empty cards filled with fake civic activity

## Test matrix per card component

1. full data
2. minimum legal data
3. no source / known gap
4. pending expected artifact
5. deterministic changed/revision state
6. reviewer-internal and denied access
7. fixture/frozen capture disclosure
8. keyboard/focus and screen-reader labels
9. 320px, tablet, desktop, and 200% zoom
10. web-safe link/path rejection
