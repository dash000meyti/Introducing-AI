---
inclusion: always
---

# Tech & Workflow

## Stack

- **SvelteKit + Svelte 5 (runes) + TypeScript**, Vite 8
- **PixiJS 8** — character rendering / lip-sync
- **Reveal.js 6** — slide deck (2:3 portrait, embedded)
- **Tailwind CSS 4** — mobile-first styling
- Native `Audio`, wrapped by `AudioController` as the master clock
- Route is client-only (`ssr = false`, `prerender = false`)

## Commands

```bash
npm run dev      # vite dev (do NOT run as a blocking step in automation)
npm run check    # svelte-kit sync && svelte-check  (must be 0 errors / 0 warnings)
npm run build    # production build (must succeed)
```

`npm run dev` is a long-running server — start it as a background process, never a
blocking command.

## Definition of done

A change is not done until `npm run check` passes clean, `npm run build` succeeds,
and the affected flow is verified in the browser (landing → start → entrance →
playback → interaction → end, as relevant).

## Svelte 5 conventions

- Runes only: `$state`, `$derived`, `$effect`, `$props`. No legacy stores or
  `export let`.
- Get the shared engine via `getEngine()` from `src/lib/engine/context.ts`. Only
  the root page instantiates `PresentationEngine` (via `setEngine`).
- Components are presentational: read `$derived` engine state and render.
- Engine getters are pure (no side effects/mutation/I/O). State transitions go
  through engine methods.
- Keep the per-frame delta clamp in the loop (`Math.min(now - last, 100)`) so a
  backgrounded tab can't skip whole steps. Guard browser-only APIs
  (`requestAnimationFrame`, `performance`, `Audio`).

## Bridging to imperative libraries

Push reactive state into PixiJS/Reveal inside `$effect`; tear down in `onDestroy`.

### Reveal.js gotcha (caused a real bug)

Scenario content loads asynchronously, so `PresentationLayer` initializes Reveal
with an EMPTY `.slides` container. Reveal only displays `<section>`s it has
registered (`present/past/future`), so slides added reactively afterwards stay
hidden. Whenever the slide set changes, re-register before navigating:

```svelte
$effect(() => {
  const count = slides.length;     // track the set size
  const index = engine.currentSlide;
  if (!ready || !deck) return;
  void (async () => {
    await tick();                  // flush {#each} into the DOM first
    if (count !== syncedCount) { deck.sync(); syncedCount = count; }
    deck.slide(index, 0);
  })();
});
```

`deck.slide()` alone is insufficient on a freshly loaded/changed deck.

## Mobile + RTL

Mobile-first; the app is framed as a phone. The document is RTL (`dir="rtl"`) —
wrap LTR fragments such as numeric counters with `dir="ltr"` (e.g. `2 / 5`).
