# Stage receipts

One file per stage exit (and per MOTY-level goal exit), named `<stage>-receipt.md`.
Required columns per stage-gates.md §1.3 — a receipt is itself a SPEC artifact:

| criterion | evidence kind | locator | producer | slot | verified-by | verified-at |

Rules: the receipt header records any §3.5 reviewer substitution **before entry**, not at
exit. The producer of a criterion never appears in its own verified-by column. A criterion
with no locator is not evidence — it is a claim.

Created 2026-07-27 (Phase 4.3): this directory's absence was blocking §3.5 compliance for
every stage. Stage 5 and Stage 8 self-certification were repaired on the board same week;
ENTRY/EXIT issue pairs are the remaining §6.3 machinery.
