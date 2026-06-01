---
inclusion: always
---

# Structure & Conventions

## Single source of truth

`PresentationEngine` (`src/lib/engine/PresentationEngine.svelte.ts`) runs ONE
`requestAnimationFrame` loop and exposes reactive getters. Every layer is a pure
consumer. Never add a second clock, timeline, or rAF loop in a layer.

## Where things go (do not duplicate)

| Concern | Location |
|---|---|
| Engine, clock, types, timing helpers | `src/lib/engine/` |
| Stage layers (backstage/presentation/character/overlay) + camera | `src/lib/layers/` |
| Player controls + section timeline | `src/lib/navigation/` |
| Transcript | `src/lib/transcript/` |
| PixiJS character rendering + viseme maps | `src/lib/character/` |
| Scenario JSON content | `static/data/presentations/` |
| Stage / character / slide artwork, audio | `static/assets/`, `static/audio/` |

## Data-driven contract

All content flows through the `Scenario` type (`Scenario → slides[] + sections[]
→ steps[]`). Never hardcode copy, slide content, timing, lighting, or zoom in a
layer or the engine — it belongs in the scenario JSON. This is the clean seam for
future LLM generation.

To add a capability, follow this order (do not skip):
1. Extend the type in `src/lib/engine/types.ts`.
2. Consume it in `PresentationEngine` (add/extend a getter or transition).
3. Render it in the relevant layer.

## DRY

Reuse engine getters instead of recomputing in components: `lighting`, `zoom`,
`mouthShape`, `activeOverlays`, `transcriptText`, `sectionProgress`,
`overallProgress`, `stepProgress`. Reusable timing/viseme math lives in
`Timeline.ts`, not inline in a component.

## Comments

Explain intent/trade-offs only; don't narrate what the code obviously does. Leave
no dead code, stubs, or unused placeholders behind.
