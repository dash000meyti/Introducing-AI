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
- `src/lib/character/visemes.ts` — engine-state → character image maps
- `src/lib/layers/*`, `src/lib/navigation/*`, `src/lib/transcript/*` — layers
- `src/lib/data/loadScenario.ts` — fetches a scenario by id

### Reveal.js + async content (gotcha)

The slide deck loads its scenario asynchronously, so `PresentationLayer` mounts
and initializes Reveal **before** the `<section>` slides exist in the DOM. Reveal
only displays sections it has registered, so the layer must call `deck.sync()`
(after a Svelte `tick()` flushes the `{#each}`) whenever the slide count changes,
then `deck.slide(index)`. Skipping the re-sync is why a freshly loaded deck shows
no slides. The same path keeps a future LLM-generated deck working.

## Scenarios

A presentation is authored as JSON at
`static/data/presentations/<id>.json` and loaded by `loadScenario()`.

Shape: `Scenario -> slides[] + startSection + sections[] + endSection -> steps[]`.
`startSection` / `endSection` share the section shape but have no `id`; the engine
normalises them into one ordered list with reserved ids `__start` / `__end`, so
the entrance, lighting-up, and exit are authored in JSON (not hardcoded).

Each `Step` declares its `text`, optional `voice` + `visemes`, `startCue` /
`endCue`, timed `sfx`, overlays, and a timed `change[]` of stage mutations
(`slide` by id, `camera.zoom`, `lighting`, and `character` `face` / `body` /
`move`) applied as the step clock crosses each `change.time`. Flow is driven by a
section's `nextSectionId` (or `"end"`), applied after its last step, plus an
optional per-step `question` with branchable `answers` (via `gotoSectionId`) and
external `links`. A missing `nextSectionId` on the last section marks the end. A
top-level `music` track loops from startSection to endSection.

The viewer's route (section order + visit counts) is tracked in `PathMemory`;
repeats raise a "replay this section?" prompt, and completed runs are appended to
the `introducing-ai.paths` array in `localStorage`.

See `static/data/presentations/intro.json` for the worked example.

## Placeholders (MVP)

- **Character**: a PixiJS sprite that swaps full-frame face textures for lip-sync
  visemes, emotions, and an automatic blink. Locomotion (walk/gesture) is stubbed
  in the public API but not animated yet. Faces live in
  `static/assets/character/*.png` and are mapped from engine state in
  `src/lib/character/visemes.ts`. When a step has no authored `visemes` the engine
  synthesises a talking flutter.
- **Audio**: the authoritative timeline is a manual clock, so steps run on
  `Step.duration` when no audio file is present. Add files under `static/audio/`
  and reference them via `Step.audio`; ambient effects load from
  `static/audio/sfx/<name>.mp3` via `Step.sfx`.
- **Backstage**: real stage artwork — one JPG per lighting state, per theme — at
  `static/assets/backstage/{light,dark}/{off,stage,slide,person}.jpg`, layered and
  crossfaded by opacity (`off`=all off, `stage`=all on, `slide`=presentation light,
  `person`=character light).
- **Slides**: authored as data in the scenario and rendered by Reveal.js. Drop
  slide imagery under `static/assets/slides/` and reference it from the scenario.

## Future (designed-for, not built)

LLM-driven content/slide/audio generation and live Q&A (e.g. via OpenRouter) plug
in behind the JSON `Scenario` contract — the engine and layers stay unchanged.
