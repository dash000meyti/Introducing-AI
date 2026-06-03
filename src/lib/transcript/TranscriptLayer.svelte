<script lang="ts">
	import { getEngine } from '$lib/engine/context';
	import { fade } from 'svelte/transition';

	const engine = getEngine();

	const text = $derived(engine.transcriptText);
	const cue = $derived(engine.transcriptCue);
	const visible = $derived(text.length > 0 || !!cue);

	// Word-level karaoke: highlight whole words as the reading point reaches
	// them, driven by the same clock as the lip-sync (engine.stepProgress).
	const words = $derived(text.length ? text.split(/\s+/).filter(Boolean) : []);

	// Character offset where each word starts (incl. the separating space), so
	// we can map continuous reading progress onto discrete words.
	const wordStarts = $derived.by(() => {
		const starts: number[] = [];
		let pos = 0;
		for (const w of words) {
			starts.push(pos);
			pos += w.length + 1; // + 1 for the space
		}
		return starts;
	});

	const readChars = $derived(text.length * engine.stepProgress);

	// Index of the word currently being spoken.
	const activeIndex = $derived.by(() => {
		let idx = 0;
		for (let i = 0; i < wordStarts.length; i++) {
			if (wordStarts[i] <= readChars) idx = i;
			else break;
		}
		return idx;
	});

	// Fraction (0..1) through the active word — used to glide the scroll between
	// word centres so motion stays smooth even though colour snaps per word.
	const activeFraction = $derived.by(() => {
		const w = words[activeIndex];
		if (!w) return 0;
		const into = readChars - wordStarts[activeIndex];
		return Math.min(1, Math.max(0, into / w.length));
	});

	let viewport = $state<HTMLElement>();
	let wordEls = $state<HTMLElement[]>([]);
	let offset = $state(0);

	$effect(() => {
		// Re-centre every frame as playback advances.
		void activeIndex;
		void activeFraction;
		void text;
		void cue;
		if (!viewport || words.length === 0) return;
		const current = wordEls[activeIndex];
		if (!current) return;
		const centreOf = (el: HTMLElement) => el.offsetLeft + el.offsetWidth / 2;
		const c1 = centreOf(current);
		const next = wordEls[activeIndex + 1];
		const target = next ? c1 + (centreOf(next) - c1) * activeFraction : c1;
		offset = viewport.clientWidth / 2 - target;
	});
</script>

{#if visible}
	<div
		class="transcript"
		transition:fade={{ duration: 320 }}
	>
		<div class="bar">
			{#if words.length}
				<div class="ticker" bind:this={viewport}>
					<div class="track" style:transform={`translateX(${offset}px)`}>
						{#each words as word, i (i)}<span
								class="word"
								class:spoken={i <= activeIndex}
								bind:this={wordEls[i]}>{word}</span
							>{' '}{/each}{#if cue}<span class="cue">{cue}</span>{/if}
					</div>
				</div>
			{:else if cue}
				<!-- Standalone cue (no speech): still lives inside the bar, centred. -->
				<div class="ticker static">
					<span class="cue">{cue}</span>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.transcript {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 6;
		display: flex;
		justify-content: center;
		padding: calc(env(safe-area-inset-top, 0px) + 14px) 12px 8px;
		pointer-events: none;
	}

	.bar {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		max-width: 560px;
		height: 44px;
		padding: 0 16px;
		border-radius: 999px;
		overflow: hidden;
		/* Liquid glass: translucent fill + heavy blur + crisp hairline edge. */
		background: var(--glass-bg);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		border: 1px solid var(--glass-edge);
		box-shadow:
			0 10px 30px rgba(0, 0, 0, 0.35),
			inset 0 1px 0 var(--glass-hi);
		color: var(--glass-fg);
	}

	/* Single-line viewport; the inner track scrolls so the spoken word stays
	   centred, like a synced news ticker. */
	.ticker {
		position: relative;
		flex: 1 1 auto;
		overflow: hidden;
		-webkit-mask-image: linear-gradient(
			to right,
			transparent,
			#000 12%,
			#000 88%,
			transparent
		);
		mask-image: linear-gradient(to right, transparent, #000 12%, #000 88%, transparent);
	}
	.ticker.static {
		display: flex;
		justify-content: center;
	}
	.track {
		position: relative;
		display: inline-block;
		white-space: nowrap;
		will-change: transform;
		/* Small smoothing pass over the per-frame, progress-driven offset. */
		transition: transform 120ms linear;
	}

	/* Non-speech cue text scrolls inline with the line, in the accent colour. */
	.cue {
		font-family: var(--font-title);
		font-size: 15px;
		font-weight: 800;
		color: var(--accent);
		margin-inline-start: 0.6rem;
		line-height: 44px;
	}

	/* Constant weight so highlighting never reflows (keeps centring stable);
	   only the colour brightens word by word. */
	.word {
		font-family: var(--font-body);
		font-size: 15px;
		font-weight: 600;
		line-height: 44px;
		color: var(--text-muted);
		transition: color 180ms ease;
	}
	.word.spoken {
		color: var(--text-primary);
	}
</style>
