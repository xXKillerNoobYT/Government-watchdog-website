# Public and private-beta asset lanes

Government Watchdog produces two browser artifacts from separate entry points.
This is a data-safety boundary, not a theme or navigation choice.

| Lane | Entry | Output | Civic data rule |
|---|---|---|---|
| Anonymous Free | `src/public-main.ts` | `dist/public` | No private captures, samples, private admission code, or gated API route. Until a separately approved public projection exists, the designed civic slots render honest unavailable states. |
| Private beta | `src/main.ts` | `dist/client` | Protected by the hosting admission boundary. May contain clearly labelled review fixtures and private tools; it must never be served as the anonymous artifact. |

## Build commands

```sh
npm run build:public
npm run build:private-beta
npm run build:all
```

`npm run build:public` enforces an allowlist over Rollup's parsed local module
graph, then scans the completed `dist/public` artifact. The graph check rejects
any private application module even if tree-shaking or minification would remove
its recognizable strings. The completed-asset check separately rejects private
access markers, known captured record identifiers, sample markers, private API
paths, and local admission switches. Together they enforce both provenance and
compiled output rather than checking only rendered HTML.

The standalone public command removes the entire previous `dist` directory
before it builds. This prevents a stale `dist/client` private artifact from
surviving beside an otherwise safe public bundle. Public packaging must use
`dist/public`; `npm run build:all` intentionally produces both lanes for
verification and is not itself a public deployment artifact.

The lane is chosen by the build process (`vite --mode public` or
`vite --mode private-beta`). URL parameters, fragments, browser storage,
Simple/Advanced presentation, and client environment flags cannot switch lanes.

## Publication state

The first Anonymous Free artifact is intentionally civic-data empty. It explains:

- what each designed module will do;
- how approved public data will fill it;
- how the information will be filed and reviewed;
- what result a user should expect;
- why no private or synthetic replacement is shown.

Connecting real civic records requires a backend-produced public projection with
publication state, provenance, freshness, review status, and corrections. A
visual preview or private-beta capture is not that projection.
