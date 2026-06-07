<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { getEngine } from '$lib/engine/context';
	import { CharacterRenderer } from '$lib/character/CharacterRenderer';

	const engine = getEngine();

	let host: HTMLDivElement;
	let renderer: CharacterRenderer | null = null;
	let resizeObserver: ResizeObserver | null = null;

	onMount(async () => {
		renderer = new CharacterRenderer();
		await renderer.init(host);
		resizeObserver = new ResizeObserver(() => renderer?.resize());
		resizeObserver.observe(host);
		syncView();
	});

	function syncView() {
		renderer?.setView({
			locomotion: engine.locomotion,
			moveNonce: engine.moveNonce,
			mouth: engine.mouthShape,
			expression: engine.expression,
			faceShot: engine.faceShot,
			faceNonce: engine.faceNonce,
			hoverFace: engine.hoverFace,
			gesture: engine.bodyGesture,
			bodyNonce: engine.bodyNonce,
			lit: engine.lighting.character === 'on',
			theme: engine.theme,
			visible: engine.characterVisible,
			speaking: engine.isPlaying
		});
	}

	// Push reactive engine state into the imperative PixiJS renderer.
	$effect(() => {
		// Touch the reactive sources so this effect re-runs when they change.
		void engine.locomotion;
		void engine.moveNonce;
		void engine.mouthShape;
		void engine.expression;
		void engine.faceShot;
		void engine.faceNonce;
		void engine.hoverFace;
		void engine.bodyGesture;
		void engine.bodyNonce;
		void engine.lighting.character;
		void engine.theme;
		void engine.characterVisible;
		void engine.isPlaying;
		syncView();
	});

	onDestroy(() => {
		resizeObserver?.disconnect();
		renderer?.destroy();
	});
</script>

<div class="character-host" bind:this={host}></div>

<style>
	.character-host {
		position: absolute;
		inset: 0;
		z-index: 3;
		pointer-events: none;
	}
	.character-host :global(canvas) {
		width: 100%;
		height: 100%;
		display: block;
	}
</style>
