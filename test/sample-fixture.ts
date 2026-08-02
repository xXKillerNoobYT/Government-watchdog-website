// Shared test access to the labeled sample. NOT a test file — vite.config.ts includes only
// `test/**/*.test.ts`.
//
// GOV-49 step 1b: production code must hold NO static reference to this JSON, or the bytes
// cannot leave the entry chunk (measured — see docs/plans/gov49-bundle-code-split.md). Tests
// import it from here so `src/data/client.ts` can reach it through `await import(...)` only.
import type { ReadApiResponse } from '../src/types/read-api';
import { assertWebSafe } from '../src/data/web-safe';
import sampleData from '../src/fixtures/alpine-sample.json';

/** The labeled sample, swept once at import. Treated as read-only by every consumer. */
export const FIXTURE: ReadApiResponse = assertWebSafe(sampleData as unknown as ReadApiResponse);
