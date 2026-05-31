<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { PresentationEngine } from '$lib/engine/PresentationEngine.svelte';
	import { setEngine } from '$lib/engine/context';
	import { loadScenario } from '$lib/data/loadScenario';
	import IntroducingLayer from '$lib/layers/IntroducingLayer.svelte';
	import TranscriptLayer from '$lib/transcript/TranscriptLayer.svelte';
	import NavigationLayer from '$lib/navigation/NavigationLayer.svelte';

	// Create the engine once and expose it to all layers via context.
	const engine = setEngine(new PresentationEngine());

	let loaded = $state(false);
	let error = $state<string | null>(null);

	onMount(async () => {
		try {
			const scenario = await loadScenario('intro');
			engine.setScenario(scenario);
			loaded = true;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	});

	onDestroy(() => engine.dispose());

	const phase = $derived(engine.phase);
</script>

<div class="stage">
	<IntroducingLayer />

	{#if phase !== 'landing'}
		<TranscriptLayer />
	{/if}

	{#if phase !== 'landing'}
		<NavigationLayer />
	{/if}

	<!-- Stage 1: Landing -->
	{#if phase === 'landing'}
		<div class="screen landing">
			<div class="brand">
				<h1>{engine.scenario?.title ?? 'مهدی گودینی'}</h1>
				<p>{engine.scenario?.subtitle ?? ''}</p>
			</div>
			{#if error}
				<p class="err">{error}</p>
			{:else}
				<button class="start" disabled={!loaded} onclick={() => engine.start()}>
					{loaded ? 'شروع ارائه' : 'در حال آماده‌سازی…'}
				</button>
			{/if}
		</div>
	{/if}

	<!-- Stage 6: Ended -->
	{#if phase === 'ended'}
		<div class="screen ended">
			<div class="brand">
				<h1>سپاس از همراهی شما</h1>
				<p>{engine.scenario?.subtitle ?? ''}</p>
			</div>
			<button class="start" onclick={() => engine.restart()}>شروع دوباره</button>
		</div>
	{/if}
</div>

<style>
	.stage {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: #000;
	}

	.screen {
		position: absolute;
		inset: 0;
		z-index: 8;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		gap: 28px;
		padding-bottom: 16%;
		text-align: center;
		animation: screen-in 500ms ease both;
	}
	.ended {
		justify-content: center;
		padding-bottom: 0;
		background: rgba(0, 0, 0, 0.35);
	}

	.brand h1 {
		margin: 0;
		font-size: 34px;
		font-weight: 900;
		color: var(--accent);
		text-shadow: 0 2px 20px rgba(0, 0, 0, 0.5);
	}
	.brand p {
		margin: 6px 0 0;
		font-size: 16px;
		font-weight: 500;
		color: #efe9da;
		opacity: 0.9;
	}

	.start {
		padding: 14px 34px;
		border: none;
		border-radius: 999px;
		background: var(--accent);
		color: #1a1407;
		font-size: 16px;
		font-weight: 800;
		box-shadow: 0 10px 30px rgba(244, 180, 0, 0.35);
		transition: transform 150ms ease;
	}
	.start:disabled {
		opacity: 0.6;
		background: #cfcabd;
		color: #555;
		box-shadow: none;
	}
	.start:not(:disabled):active {
		transform: scale(0.96);
	}

	.err {
		color: #ff8a8a;
		font-size: 14px;
		max-width: 80%;
	}

	@keyframes screen-in {
		from {
			opacity: 0;
		}
	}
</style>
