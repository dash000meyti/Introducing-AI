<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { getEngine } from '$lib/engine/context';
	import { fade } from 'svelte/transition';

	const engine = getEngine();
	/** Higher = softer/slower glide toward the active word (ms time constant). */
	const SCROLL_TAU_MS = 360;

	const view = $derived(engine.transcriptView);
	const tokens = $derived(view.tokens);
	const visible = $derived(tokens.some((t) => t.visible));
	const reduceMotion =
		typeof matchMedia !== 'undefined' &&
		matchMedia('(prefers-reduced-motion: reduce)').matches;

	let viewport = $state<HTMLElement>();
	let wordEls = $state<(HTMLElement | undefined)[]>([]);
	let offset = $state(0);
	let scrollTarget = $state<number | null>(null);
	let scrollRaf: number | null = null;
	let lastSection = $state(-1);

	function wordRef(node: HTMLElement, index: number) {
		wordEls[index] = node;
		return {
			update(i: number) {
				wordEls[i] = node;
			},
			destroy() {
				if (wordEls[index] === node) wordEls[index] = undefined;
			}
		};
	}

	function centerDelta(): number {
		if (!viewport) return 0;
		const current = wordEls[view.activeWordIndex];
		if (!current) return 0;
		const vRect = viewport.getBoundingClientRect();
		const aRect = current.getBoundingClientRect();
		return vRect.left + vRect.width / 2 - (aRect.left + aRect.width / 2);
	}

	function measureTarget(): number {
		return offset + centerDelta();
	}

	function stopScroll() {
		if (scrollRaf !== null) {
			cancelAnimationFrame(scrollRaf);
			scrollRaf = null;
		}
		scrollTarget = null;
	}

	function startScrollLoop() {
		if (scrollRaf !== null) return;

		let last = performance.now();

		const frame = (now: number) => {
			const dt = Math.min(now - last, 32);
			last = now;

			if (scrollTarget === null) {
				scrollRaf = null;
				return;
			}

			const dist = scrollTarget - offset;
			if (Math.abs(dist) < 0.5) {
				offset = scrollTarget;
				scrollTarget = null;
				scrollRaf = null;
				return;
			}

			// Exponential ease: gentle start and soft landing on the target.
			const alpha = 1 - Math.exp(-dt / SCROLL_TAU_MS);
			offset += dist * alpha;
			scrollRaf = requestAnimationFrame(frame);
		};

		scrollRaf = requestAnimationFrame(frame);
	}

	function applyCenter(smooth: boolean) {
		const target = measureTarget();

		if (!smooth || reduceMotion) {
			stopScroll();
			offset = target;
			return;
		}

		scrollTarget = target;
		startScrollLoop();
	}

	$effect(() => {
		void view.activeWordIndex;
		const section = engine.sectionIndex;
		const sectionChanged = section !== lastSection;
		lastSection = section;

		const smooth = view.activeWordIndex > 0;
		tick().then(() => {
			requestAnimationFrame(() => {
				if (sectionChanged) {
					stopScroll();
					offset = measureTarget();
				}
				applyCenter(smooth);
			});
		});
	});

	onDestroy(() => stopScroll());
</script>

{#if visible}
	<div
		class="transcript"
		transition:fade={{ duration: 320 }}
	>
		<div class="bar">
			<div class="ticker" bind:this={viewport}>
				<div class="track" style:transform={`translateX(${offset}px)`}>
					{#each tokens as token, i (i)}
						{#if token.visible}
							{#if token.kind === 'word'}
								<span
									class="word"
									class:spoken={token.spoken}
									class:active={token.active}
									use:wordRef={token.wordIndex ?? 0}>{token.text}</span
								>{' '}
							{:else}
								<span class="cue" class:spoken={token.spoken}>{token.text}</span>
							{/if}
						{/if}
					{/each}
				</div>
			</div>
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
		background: var(--glass-bg);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		border: 1px solid var(--glass-edge);
		box-shadow:
			0 10px 30px rgba(0, 0, 0, 0.35),
			inset 0 1px 0 var(--glass-hi);
		color: var(--glass-fg);
	}

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

	.track {
		position: relative;
		display: inline-block;
		white-space: nowrap;
		will-change: transform;
	}

	.cue {
		font-family: var(--font-title);
		font-size: 15px;
		font-weight: 800;
		color: var(--accent);
		opacity: 0.55;
		margin-inline: 0.6rem;
		line-height: 44px;
		transition:
			color 180ms ease,
			opacity 180ms ease;
	}
	.cue.spoken {
		opacity: 1;
	}

	.word {
		font-family: var(--font-body);
		font-size: 15px;
		font-weight: 700;
		line-height: 44px;
		color: var(--text-muted);
		transition: color 180ms ease;
	}
	.word.spoken:not(.active) {
		color: color-mix(in srgb, var(--text-primary) 55%, var(--text-muted));
	}
	.word.active {
		color: var(--text-primary);
	}
</style>
