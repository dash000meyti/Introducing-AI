<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
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

	onMount(async () => {
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
		deck.slide(engine.currentSlide, 0);
	});

	// Drive the deck from the engine.
	$effect(() => {
		const index = engine.currentSlide;
		if (ready && deck) deck.slide(index, 0);
	});

	onDestroy(() => {
		try {
			deck?.destroy();
		} catch {
			/* ignore */
		}
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
		border-radius: 4px;
		overflow: hidden;
		background: var(--slide-bg, #fbfbf9);
		box-shadow: 0 6px 22px rgba(0, 0, 0, 0.22);
		transition: opacity 700ms ease;
	}

	:global(.theme-dark) .presentation-frame {
		--slide-bg: #f5f4f1;
	}

	.reveal {
		position: absolute;
		inset: 0;
		font-family: 'Vazirmatn', sans-serif;
	}

	.slide {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 18px;
		padding: 36px;
		color: #1c1c1c;
		text-align: center;
	}

	.slide h1 {
		font-size: 60px;
		font-weight: 900;
		color: var(--accent);
		margin: 0;
		line-height: 1.3;
	}
	.slide h2 {
		font-size: 42px;
		font-weight: 700;
		margin: 0 0 8px;
		color: #222;
	}
	.subtitle {
		font-size: 30px;
		color: #555;
		margin: 0;
	}
	.body {
		font-size: 28px;
		line-height: 1.7;
		color: #333;
		margin: 0;
	}
	.slide ul {
		text-align: right;
		font-size: 28px;
		line-height: 1.9;
		color: #333;
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
		background-color: #e6e3dc;
		min-height: 0;
	}
</style>
