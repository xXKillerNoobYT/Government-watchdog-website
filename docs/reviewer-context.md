# Shared reviewer context

Status: private-beta implementation contract
Scope: Alpine, Wyoming reviewer-internal routes
Security boundary: same-origin server authorization; browser state is presentation only

## Why this exists

The private-beta application previously mixed several captured projections with
independent live reads. That was useful for visual review, but it allowed two
canonical pages in the same tab to show different record populations. It also
made a browser query such as `access=...` look more authoritative than it was.

The application now creates one `ReviewerContextStore` for an app boot. Its
first live route requests `/api/reviewer-internal`, normalizes the response once,
and reuses the same frozen `ReadApiResponse` object for every later live route.

Simple and Advanced are therefore reading modes over one authorized record set.
They are not plans, entitlements, publication lanes, geography grants, or
authentication decisions.

## Request contract

The browser sends one request:

```http
GET /api/reviewer-internal
Accept: application/json
Credentials: same-origin
Redirect mode: error
```

Only a root-relative API base is accepted. Absolute URLs, network-path
references, backslashes, query/fragment additions, control characters, and
encoded slash or backslash sequences fall back to `/api`. Redirect following is
disabled, so a same-origin endpoint cannot redirect this authorization-bearing
read to another origin.

The current Alpine-only response has exactly one top-level field:

```json
{
  "reviewer_internal_records": []
}
```

Normalization requires:

- a plain top-level object and that exact field;
- an array of plain record objects;
- a non-empty, unique `statement_id` for each record;
- an `evidence` array for every record;
- recognized trust, verification, provenance, publication, and producer values;
- JSON-safe values only;
- no raw path or forbidden private locator anywhere in the raw response or
  normalized object.

The raw response is swept before projection. The normalizer then preserves
server order and documented values, discards every unknown record or evidence
property, deep-clones the web-safe allowlist, and deep-freezes the resulting
model:

```ts
{
  scope: 'alpine',
  access: 'reviewer_internal',
  records: [...]
}
```

`scope` is the versioned contract of this Alpine-only endpoint. It is never read
from a URL, saved location, Simple/Advanced mode, or browser gate. It identifies
the endpoint context; it does not assign every record to Town, County, or State
government.

## State machine

Only `ready` contains civic data.

| State | Meaning | Civic rows |
| --- | --- | --- |
| `loading` | One same-origin request is in progress. | None |
| `ready` | The response passed transport, schema, and web-safety checks. | Exact normalized response |
| `denied` | The server returned 401 or 403. | None |
| `unavailable` | Network, timeout, missing route, rate limit, or service failure. | None |
| `invalid` | JSON, schema, enum, identity, or web-safety validation failed. | None |

A valid response with zero records is `ready`. Each page then renders its own
honest empty state. Failures stay cached for the app boot so navigation cannot
trigger a request storm or silently switch to a capture. Only an explicit
future retry control may call `ReviewerContextStore.retry()`.
When a retry supersedes an in-flight request, all older callers resolve to the
newest request state and cannot repaint stale data.

The request timeout covers both the HTTP request and response-body read.
Failure panels contain safe fixed copy; response bodies and record text are not
echoed into the interface.

## Route composition

Every normal private-beta route passes through the same store.

| Route | Live behavior |
| --- | --- |
| `/home` | Direct record cards, receipt count, trust/provenance, and detailed missing-projection slots |
| `/timeline`, `/timeline-legacy`, `/cards` | Direct statement records from the shared model; Timeline keeps government level unavailable until explicitly projected |
| `/issue` | Requested ID selected only from the shared model |
| `/vault`, `/sources` | Evidence metadata collected only from shared records |
| `/power` | Record-backed facts; roster, score, relationship, and verdict gaps remain unavailable |
| `/watchlist` | Device keys may select a subset of shared record IDs; unknown IDs never appear |
| `/location` | Saved place is a display/narrowing choice; the server model remains Alpine |
| `/alerts` | Device keys may be diagnosed against shared IDs; statements are never converted into alerts |
| `/boards` | Uses a server topic tree only if one is supplied; body-directory gaps remain explicit |
| `/topics` | Shared records plus a detailed topic-tree gap when the endpoint supplies no tree |
| `/body`, `/meeting` | Detailed missing-relationship contract plus direct records explicitly marked unassigned; no independent fetch or inferred relationship |
| `/app`, `/agenda`, `/agenda-boards` | Detailed agenda-board placeholder until that server projection exists |
| `/newsletter` | Detailed digest placeholder until that server projection exists |

The existing MOTY design preview and labeled samples remain explicit demo paths.
They are not a fallback for live failure and are never imported by the isolated
public Free build.

## Narrowing rules

Browser-controlled values can reduce or rearrange what the user sees, but they
cannot add records or change the server lane.

- `access=public` is retained as a QA hook and narrows to an empty public model.
- Any other `access` value is ignored.
- Simple/Advanced changes layout density only.
- `gw_location` changes the displayed place and may hide Alpine rows when the
  saved label is elsewhere.
- watch/tracked storage intersects local IDs with server-returned IDs.
- search, topic, and record IDs select only from the authorized response.

Plan and exact-geography decisions require the separate server-authoritative
access-decision projection. Until supplied, the interface says they are not
available instead of inferring Free, Pro, team, state, global, or town rights.

## Public asset boundary

The public Free build starts from `public-entry/index.html` and an allowlisted
module graph. It does not import `src/main.ts`, the reviewer context, private
fixtures, reviewer gates, or `/api/reviewer-internal`.

Both boundaries must pass before review:

```sh
npm run build:public
npm run check:public-bundle
```

The private-beta build is live by default. Fixture mode in the legacy data
client now requires an explicit true value; it is not the production default.

## Verification expectations

The automated contract covers:

- one request for concurrent and sequential route consumers;
- exact normalized object identity and explicit retry behavior;
- cross-origin redirect rejection and unknown-field removal;
- 401/403, 404, 500, timeout, network, invalid JSON, duplicate ID, invalid enum,
  and unsafe-path failure handling;
- sentinel server records rendered through canonical pages;
- zero captured-row substitution on every failure;
- mode parity for record IDs, receipts, trust, provenance, and AI disclosure;
- primary and compatibility-route coverage, including body/meeting relationship gaps;
- location, URL, mode, and device-state non-widening;
- detailed agenda, newsletter, plan, geography, roster, alert, and topic gaps;
- public module-graph and emitted-bundle isolation.

This slice does not deploy. Merge, authenticated live verification, and Sites
deployment remain separate owner/release gates.
