<script lang="ts">
	import { tick } from 'svelte';
	import { getEngine } from '$lib/engine/context';
	import { fade } from 'svelte/transition';

	const engine = getEngine();

	const view = $derived(engine.transcriptView);
	const tokens = $derived(view.tokens);
	const visible = $derived(tokens.some((t) => t.visible));

	let viewport = $state<HTMLElement>();
	let wordEls = $state<(HTMLElement | undefined)[]>([]);
	let offset = $state(0);

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

	function recenter() {
		if (!viewport) return;
		const current = wordEls[view.activeWordIndex];
		if (!current) return;
		const vRect = viewport.getBoundingClientRect();
		const aRect = current.getBoundingClientRect();
		const delta =
			vRect.left + vRect.width / 2 - (aRect.left + aRect.width / 2);
		offset += delta;
	}

	$effect(() => {
		void view.activeWordIndex;
		void tokens;
		tick().then(() => {
			recenter();
			requestAnimationFrame(recenter);
		});
	});
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
		margin-inline-start: 0.6rem;
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
		font-weight: 600;
		line-height: 44px;
		color: var(--text-muted);
		transition: color 180ms ease;
	}
	.word.spoken:not(.active) {
		color: color-mix(in srgb, var(--text-primary) 55%, var(--text-muted));
	}
	.word.active {
		color: var(--text-primary);
		font-weight: 700;
	}
</style>
