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
			? 'scale(1.88)'
			: 'scale(1.2)'
	);
	const cameraOrigin = $derived(
		engine.zoom === 'in'
			? '50% 95%'
			: '50% 12%'
	);
</script>

<div class="introducing" class:theme-light={engine.theme === 'light'} class:theme-dark={engine.theme === 'dark'}>
	<!--
	  Fixed-aspect stage box matching the backstage artwork (1125 x 2436). Every
	  layer is positioned relative to THIS box, so the slide screen, character feet
	  and overlays stay locked to the painted scene at any viewport width/height.
	  The box COVERS the viewport (overflow cropped, never letterboxed) so its
	  proportions stay locked without showing black bars.
	-->
	<div class="stage-frame">
		<div
			class="camera"
			class:zoom-in={engine.zoom === 'in'}
			class:zoom-out={engine.zoom === 'out'}
			style:transform={camera}
			style:transform-origin={cameraOrigin}
		>
			<BackstageLayer />
			<PresentationLayer />
			<CharacterLayer />
			<OverlayLayer />
		</div>
	</div>
</div>

<style>
	.introducing {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: #000;
		/* Establish a size container so the stage can be sized in cqw/cqh units. */
		container-type: size;
	}

	/* Cover the viewport with the artwork's aspect ratio (fills fully, crops the
	   overflow, never stretches). The overflow is cropped symmetrically from the
	   centre via translate(-50%, -50%). cqw/cqh resolve against `.introducing`. */
	.stage-frame {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		aspect-ratio: 1125 / 2436;
		width: max(100cqw, 100cqh * 1125 / 2436);
		height: max(100cqh, 100cqw * 2436 / 1125);
		overflow: hidden;
	}

	.camera {
		position: absolute;
		inset: 0;
		transition-property: transform, transform-origin;
		will-change: transform;
	}

	.camera.zoom-in {
		transition-duration: 500ms, 500ms;
		transition-timing-function: cubic-bezier(0.8, 1, 0.8, 1), cubic-bezier(0.18, 1, 0.18, 1);
	}

	.camera.zoom-out {
		transition-duration: 500ms, 500ms;
		transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1), cubic-bezier(0.16, 1, 0.3, 1);
	}
</style>
