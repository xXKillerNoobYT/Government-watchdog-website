# Explainer media contract

**Recorded:** 2026-08-10
**Surface:** private-beta `#/explainer?demo=sample`
**Binding:** gated synthetic product media (GS)

This contract locks the owner-supplied walkthrough, its web derivative, the
visible honesty boundary, and its text equivalent as one release unit. The
video is product education; it is not a civic record, reviewed Alpine evidence,
or a live-data response.

## Audited source

| Property | Value |
| --- | --- |
| Container / codec | MP4 / H.264 High Profile Level 4.0 |
| Geometry | 1920×1080 landscape, progressive |
| Frame rate | constant 30 fps |
| Duration | 73.000 seconds |
| Color | BT.709, 8-bit yuv420p, limited range |
| Audio | none |
| Captions / subtitles / chapters | none |
| Fast-start | yes; metadata precedes media data |
| Source bytes | 19,482,192 |
| Source SHA-256 | `48b32cf188afb1fd67228945bf464d5df0657b4bbd2a6cccf21d91be5e028714` |

## Committed delivery assets

| Repository asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `src/assets/government-watchdog-explainer.mp4` | 3,990,980 | `fe93fc244f2b08abe006e10aff13646147c29d424c8029d667ad131ae2377be1` |
| `src/assets/government-watchdog-explainer-poster.jpg` | 69,527 | `8134363f974a3078e522a7cae6577a16d78283feca259b5e8b0f0b36e582a3da` |

The committed MP4 is a same-resolution, fast-start web derivative. It is about
80% smaller than the source while preserving 1920×1080 geometry, 30 fps, H.264,
and yuv420p browser compatibility. A persistent matte header identifies the
scenario as an illustrative demo with hypothetical data, so the provenance
boundary survives native fullscreen and an authorized direct asset view. The
authored frame is proportionally scaled into reserved space beneath that header;
the label does not cover the animation. The poster carries the same treatment.
The original remains the owner-held master; the repository carries only the
delivery asset needed by Sites.

## Honesty and access boundary

- Reviewer admission remains the outer access boundary.
- The media renders only when the URL-local `demo=sample` flag is present.
- Plain `#/explainer` attaches no `<video>` or `<source>` element.
- The shell origin is `product_demo`, never `live_server` or a reviewed snapshot.
- The shell and player both state that the scenario and figures are
  hypothetical and are not a live or reviewed Alpine finding.
- Every video frame and the poster repeat the illustrative/hypothetical/non-live
  boundary inside the media artifact itself.
- The product-demo origin does not activate fixture Alert counts.
- Simple/Advanced changes presentation only; both modes link to the same asset
  and carry the same disclosure.
- The public build graph cannot import `src/ui/explainer.ts` or either asset.

## Accessibility contract

- Native controls remain enabled.
- `playsinline` and `preload="metadata"` are set.
- Autoplay and looping are absent.
- The player has an accessible name and is described by the visible notice and
  transcript summary.
- The interface says that the video is silent and 1 minute 13 seconds long.
- A scene-by-scene visual transcript is adjacent to the player. An empty caption
  track is deliberately not used because there is no spoken audio to caption.
- Print hides the media control but preserves the notice and full transcript.

Any replacement requires new source and delivery hashes, a new poster/transcript
review, the private/public exposure scans, and exact-version release evidence.
