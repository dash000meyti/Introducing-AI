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

	let error = $state<string | null>(null);

	onMount(async () => {
		try {
			const scenario = await loadScenario('intro');
			engine.setScenario(scenario);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	});

	onDestroy(() => engine.dispose());

	const phase = $derived(engine.phase);
</script>

<div class="stage" class:theme-light={engine.theme === 'light'} class:theme-dark={engine.theme === 'dark'}>
	<IntroducingLayer />

	{#if phase !== 'landing'}
		<TranscriptLayer />
	{/if}

	<NavigationLayer />

	<!-- Stage 1: Landing (brand is part of the stage artwork) -->
	{#if phase === 'landing'}
		<div class="screen landing">
			{#if error}
				<p class="err">{error}</p>
			{/if}
		</div>
	{/if}
</div>
