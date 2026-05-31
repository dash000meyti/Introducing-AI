<script lang="ts">
	import { getEngine } from '$lib/engine/context';
	import BackstageLayer from './BackstageLayer.svelte';
	import PresentationLayer from './PresentationLayer.svelte';
	import CharacterLayer from './CharacterLayer.svelte';
	import OverlayLayer from './OverlayLayer.svelte';

	const engine = getEngine();

	// Camera system. `out` frames the whole stage (slide focus); `in` pushes in
	// toward the character standing on the lower-centre of the stage.
	const camera = $derived(
		engine.zoom === 'in'
			? 'scale(1.55)'
			: 'scale(1)'
	);
</script>

<div class="introducing" class:theme-light={engine.theme === 'light'} class:theme-dark={engine.theme === 'dark'}>
	<div class="camera" style:transform={camera}>
		<BackstageLayer />
		<PresentationLayer />
		<CharacterLayer />
		<OverlayLayer />
	</div>
</div>

<style>
	.introducing {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}

	.camera {
		position: absolute;
		inset: 0;
		/* Zoom-in focuses on the character at the lower-centre of the stage. */
		transform-origin: 50% 82%;
		transition: transform 900ms cubic-bezier(0.16, 1, 0.3, 1);
		will-change: transform;
	}
</style>
