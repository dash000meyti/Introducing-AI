<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { getEngine } from '$lib/engine/context';
	import 'reveal.js/reveal.css';

	const engine = getEngine();

	const slides = $derived(engine.scenario?.slides ?? []);
	// Presentation lighting: off => 10% opacity, on => 100%.
	const opacity = $derived(engine.lighting.presentation === 'on' ? 1 : 0.1);

	let deckEl: HTMLDivElement;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let deck: any = null;
	let ready = $state(false);
	let mounted = false;
	let initializing = false;
	// Number of <section>s Reveal has registered. The scenario (and therefore the
	// slide set) loads asynchronously, so the deck is usually empty at init time;
	// we must re-sync whenever the count changes.
	let syncedCount = -1;

	async function initializeDeck() {
		if (ready || initializing || !deckEl) return;
		initializing = true;
		try {
			const Reveal = (await import('reveal.js')).default;
			deck = new Reveal(deckEl, {
				embedded: true,
				controls: false,
				progress: false,
				slideNumber: false,
				keyboard: false,
				touch: false,
				hash: false,
				transition: 'fade',
				// 2:3 portrait content area.
				width: 600,
				height: 900,
				margin: 0.04,
				minScale: 0.1,
				maxScale: 2
			});
			await deck.initialize();
			ready = true;
		} finally {
			initializing = false;
		}
	}

	onMount(() => {
		mounted = true;
		return () => {
			mounted = false;
		};
	});

	// Reveal expects at least one slide while initializing; wait until the async
	// scenario load has flushed <section> nodes into the DOM.
	$effect(() => {
		const count = slides.length;
		if (!mounted || ready || initializing || count === 0) return;
		void (async () => {
			await tick();
			if (!mounted || ready || initializing || count === 0) return;
			await initializeDeck();
		})();
	});

	// Keep the deck in step with the engine. Reveal only displays <section>s it has
	// registered, so a changed slide set (e.g. the async scenario load, or a future
	// LLM-generated deck) must be re-synced before we can navigate to a slide.
	$effect(() => {
		const count = slides.length;
		const index = engine.currentSlide;
		if (!ready || !deck) return;
		if (count === 0) return;
		let active = true;
		void (async () => {
			// Let Svelte flush the {#each} into the DOM before Reveal reads it.
			await tick();
			if (!active || !ready || !deck) return;
			if (count !== syncedCount) {
				deck.sync();
				syncedCount = count;
			}
			const safeIndex = Math.min(Math.max(index, 0), count - 1);
			deck.slide(safeIndex, 0);
		})();
		return () => {
			active = false;
		};
	});

	onDestroy(() => {
		ready = false;
		initializing = false;
		syncedCount = -1;
		try {
			deck?.destroy();
		} catch {
			/* ignore */
		}
		deck = null;
	});
</script>

<div class="presentation-frame" style:opacity>
	<div class="reveal" bind:this={deckEl}>
		<div class="slides">
			{#each slides as slide (slide.id)}
				<section data-kind={slide.kind ?? 'text'}>
					{#if slide.kind === 'title'}
						<div class="slide title-slide">
							{#if slide.title}<h1>{slide.title}</h1>{/if}
							{#if slide.subtitle}<p class="subtitle">{slide.subtitle}</p>{/if}
						</div>
					{:else if slide.kind === 'image'}
						<div class="slide image-slide">
							{#if slide.title}<h2>{slide.title}</h2>{/if}
							{#if slide.image}<img src={slide.image} alt={slide.title ?? ''} />{/if}
						</div>
					{:else if slide.kind === 'grid'}
						<div class="slide grid-slide">
							{#if slide.title}<h2>{slide.title}</h2>{/if}
							<div class="grid">
								{#each slide.images ?? [] as img, i (i)}
									<div class="grid-cell" style:background-image={`url(${img})`}></div>
								{/each}
							</div>
						</div>
					{:else}
						<div class="slide text-slide">
							{#if slide.title}<h2>{slide.title}</h2>{/if}
							{#if slide.subtitle}<p class="subtitle">{slide.subtitle}</p>{/if}
							{#if slide.body}<p class="body">{slide.body}</p>{/if}
							{#if slide.bullets}
								<ul>
									{#each slide.bullets as b, i (i)}
										<li>{b}</li>
									{/each}
								</ul>
							{/if}
						</div>
					{/if}
				</section>
			{/each}
		</div>
	</div>
</div>

<style>
	.presentation-frame {
		position: absolute;
		top: 10.2%;
		left: 50%;
		width: 75.5%;
		aspect-ratio: 2 / 3;
		transform: translateX(-50%);
		overflow: hidden;
		transition: opacity 700ms ease;
	}

	.reveal {
		position: absolute;
		inset: 0;
		font-family: var(--font-body);
	}
	.reveal :global(.slides),
	.reveal :global(.slides section) {
		background: transparent !important;
	}
	:global(.reveal-viewport) {
		background: transparent !important;
	}

	.slide {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 18px;
		padding: 36px;
		color: var(--slide-text-primary);
		text-align: center;
	}

	.slide h1 {
		font-family: var(--font-title);
		font-size: 60px;
		font-weight: 900;
		color: var(--accent);
		margin: 0;
		line-height: 1.3;
	}
	.slide h2 {
		font-family: var(--font-title);
		font-size: 42px;
		font-weight: 700;
		margin: 0 0 8px;
		color: var(--slide-text-heading);
	}
	.subtitle {
		font-size: 30px;
		color: var(--slide-text-secondary);
		margin: 0;
	}
	.body {
		font-size: 28px;
		line-height: 1.7;
		color: var(--slide-text-secondary);
		margin: 0;
	}
	.slide ul {
		text-align: right;
		font-size: 28px;
		line-height: 1.9;
		color: var(--slide-text-secondary);
		padding-inline-start: 0;
		list-style-position: inside;
	}

	.image-slide img {
		width: 100%;
		border-radius: 8px;
		object-fit: cover;
	}

	.grid-slide .grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		width: 100%;
		height: 100%;
	}
	.grid-cell {
		border-radius: 8px;
		background-size: cover;
		background-position: center;
		background-color: var(--slide-grid-cell);
		min-height: 0;
	}
</style>
