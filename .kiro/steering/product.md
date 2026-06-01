---
inclusion: always
---

# Product

Interactive AI Presentation Platform — a **mobile-only, RTL** web app that plays a
TED-Talk-style interactive presentation. A virtual character stands on a lit stage,
narrates audio-synced steps, and shows slides while lighting, transcript, overlays,
and a camera (zoom) are orchestrated from a single JSON scenario.

## Scene model

- **Introducing Layer** (camera/zoom container)
  - **Backstage** — stage artwork; 2 themes × 4 lighting presets (off / all-on /
    stage / presentation).
  - **Presentation** — Reveal.js slide deck, 2:3 portrait; lighting = opacity
    (off ⇒ 10%, on ⇒ 100%).
  - **Character** — PixiJS presenter; lighting off ⇒ theme-coloured silhouette,
    on ⇒ normal. Lip-sync + emotion + (future) body motion.
  - **Overlay** — popup / tooltip / highlight / callout.
- **Transcript Layer** (top) — live karaoke-style speech + non-speech cues.
- **Navigation Layer** (bottom) — play/pause, mute, theme, zoom, section timeline,
  current-section title, interaction questions.

## Run lifecycle (phases)

`landing → intro → entrance → playing ⇄ paused → interaction → ended`

## MVP vs future

- **MVP**: everything is data-driven from a static JSON `Scenario`. Sections and
  branch questions are pre-authored.
- **Future (designed-for, NOT built)**: LLM content/slide/audio generation and
  live Q&A (e.g. OpenRouter). These plug in behind the `Scenario` contract and
  emit the same JSON shape — the engine and layers stay unchanged. Do not bolt
  LLM calls into the engine or layers.
