<script lang="ts">
	import { getEngine } from '$lib/engine/context';
	import type { BackstageLighting, Theme } from '$lib/engine/types';

	const engine = getEngine();

	// Lighting state -> provided artwork filename.
	//   off    = all lights off
	//   stage  = all lights on
	//   slide  = only the presentation light on
	//   person = only the character light on
	const STATE_FILE: Record<BackstageLighting, string> = {
		allOff: 'off',
		allOn: 'stage',
		presentation: 'slide',
		stage: 'person'
	};

	const themes: Theme[] = ['dark', 'light'];
	const states: BackstageLighting[] = ['allOff', 'allOn', 'presentation', 'stage'];
</script>

<!--
  Backstage uses the provided stage artwork (one image per lighting state, per
  theme). All eight images are layered and crossfaded via opacity so theme and
  lighting changes are smooth. The active image is the only one at full opacity.
-->
<div class="backstage">
	{#each themes as theme (theme)}
		{#each states as state (state)}
			<div
				class="bg"
				style:background-image={`url(/assets/backstage/${theme}/${STATE_FILE[state]}.jpg)`}
				style:opacity={engine.theme === theme && engine.lighting.backstage === state ? 1 : 0}
			></div>
		{/each}
	{/each}
</div>

<style>
	.backstage {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: var(--background-color);
	}

	.bg {
		position: absolute;
		inset: 0;
		background-size: cover;
		background-position: center;
		opacity: 0;
		transition: opacity 700ms ease;
		will-change: opacity;
	}
</style>
