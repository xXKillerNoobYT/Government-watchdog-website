# Prompt: Issue/Card Contract Implementer

Implement or modify a Government Watchdog card only through `docs/product/issue-card-contract.md`.

## Required review checklist

1. Stable identity plus official ID when present.
2. Context labels distinguish meeting/source/update/detection time.
3. Trust/review/gap state is backend-authoritative and has text + icon + color.
4. Any resident-facing explanation has a labeled supported-data path.
5. Source receipt includes safe original/archive link and locator/version when present.
6. Unsupported card regions render an honest state or are omitted.
7. Same record produces parity of identity/context/evidence/trust in Simple and Advanced.
8. No raw paths, private notes, speaker guesses, fake currentness, or made-up source count.

Add tests for all ten states listed under the contract's Test Matrix before calling work complete.