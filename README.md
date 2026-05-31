# Interactive AI Presentation Platform

A mobile-only, RTL web app that plays a TED-Talk-style interactive presentation: a
virtual character stands on a lit stage and narrates audio-synced steps while
slides, transcript, lighting, and a camera (zoom) are orchestrated from a single
JSON scenario.

This is the MVP scaffold — the full layered architecture runs end-to-end with a
placeholder character and synthetic lip-sync, so real sprite sheets and audio can
be dropped in later without touching the engine.

## Stack

- **SvelteKit + Svelte 5 (runes) + TypeScript**, Vite
- **PixiJS** — character rendering, body animation, viseme lip-sync
- **Reveal.js** — the slide deck (2:3 portrait)
- **Tailwind CSS** — mobile-first styling
- Native `Audio` wrapped as the master clock

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run check    # type-check
npm run build    # production build
```

Open on a phone (or a narrow viewport); on desktop the stage is framed as a phone.

## Architecture

The `PresentationEngine` is the single source of truth. One `requestAnimationFrame`
loop advances the master clock and every layer is a pure consumer of the engine's
reactive state.

```
Introducing Layer (camera / zoom transform)
├── Backstage Layer    – stage + 4 lighting presets per theme
├── Presentation Layer – Reveal.js deck (2:3), opacity lighting
├── Character Layer    – PixiJS figure, body anim + lip-sync, silhouette lighting
└── Overlay Layer      – popup / tooltip / highlight / callout
Transcript Layer (top)        – live, karaoke-style text + non-speech cues
Navigation Layer (bottom)     – play/pause, mute, theme, zoom, section timeline,
                                current-section title, interaction questions
```

Key files:

- `src/lib/engine/PresentationEngine.svelte.ts` — orchestrator + lifecycle
- `src/lib/engine/AudioController.ts` — master clock / sound output
- `src/lib/engine/Timeline.ts` — viseme/timing helpers
- `src/lib/engine/types.ts` — the `Scenario` contract
- `src/lib/character/CharacterRenderer.ts` — PixiJS figure (sprite-swappable)
- `src/lib/layers/*`, `src/lib/navigation/*`, `src/lib/transcript/*` — layers

## Scenarios

A presentation is authored as JSON at
`static/data/presentations/<id>.json` and loaded by `loadScenario()`.

Shape: `Scenario -> slides[] + sections[] -> steps[]`. Each `Step` declares its
text, optional audio + visemes, body animation, slide index, overlays, per-layer
lighting, camera zoom, and sound effects. Sections can define an `interactionPause`
and preset, branchable `questions` (a question's `gotoSectionId` jumps the flow).

See `static/data/presentations/intro.json` for the worked example.

## Placeholders (MVP)

- **Character**: a stylised PixiJS figure with synthetic lip-sync when a step has no
  authored `visemes`. Replace the draw methods in `CharacterRenderer` with sprite
  sheets to upgrade.
- **Audio**: steps run on the manual clock when no audio file is present; add files
  under `static/audio/` and reference them via `Step.audio` / sfx under
  `static/audio/sfx/`.
- **Backstage**: rendered in CSS. To use artwork, drop images at
  `static/assets/backstage/{light,dark}/{allOff,allOn,stage,presentation}.png`.

## Future (designed-for, not built)

LLM-driven content/slide/audio generation and live Q&A (e.g. via OpenRouter) plug
in behind the JSON `Scenario` contract — the engine and layers stay unchanged.
