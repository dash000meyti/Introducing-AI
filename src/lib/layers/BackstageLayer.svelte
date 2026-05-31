<script lang="ts">
	import { getEngine } from '$lib/engine/context';
	import type { BackstageLighting } from '$lib/engine/types';

	const engine = getEngine();

	const state = $derived<BackstageLighting>(engine.lighting.backstage);

	// Global dimming overlay (how dark the whole room is).
	const dim = $derived(
		{ allOff: 0.82, allOn: 0, stage: 0.5, presentation: 0.5 }[state]
	);
	// Presentation-area glow (upper region where the slide sits).
	const topLight = $derived(
		{ allOff: 0.05, allOn: 0.6, stage: 0.18, presentation: 1 }[state]
	);
	// Stage spotlight on the podium / character (lower region).
	const stageLight = $derived(
		{ allOff: 0.05, allOn: 0.7, stage: 1, presentation: 0.2 }[state]
	);
</script>

<!--
  Backstage is rendered with CSS so the four lighting presets are programmatic
  and clean. To swap in real artwork later, drop images at
  /assets/backstage/{theme}/{allOff|allOn|stage|presentation}.png and layer
  them here keyed on `state`.
-->
<div class="backstage">
	<div class="wall"></div>
	<div class="floor"></div>

	<!-- Podium steps -->
	<div class="podium podium-3"></div>
	<div class="podium podium-2"></div>
	<div class="podium podium-1"></div>

	<!-- Brand spotlight disc on the floor -->
	<div class="spot-disc" style:opacity={0.35 + stageLight * 0.65}></div>

	<!-- Lighting overlays -->
	<div class="light top-light" style:opacity={topLight}></div>
	<div class="light stage-light" style:opacity={stageLight}></div>
	<div class="dim" style:opacity={dim}></div>
</div>

<style>
	.backstage {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: var(--bg);
	}

	/* Theme palettes resolved from .theme-light / .theme-dark on the ancestor. */
	:global(.theme-light) .backstage {
		--bg: #eceae5;
		--wall: linear-gradient(180deg, #f4f2ee 0%, #e6e3dc 100%);
		--floor: linear-gradient(180deg, #dedacf 0%, #cfcabd 100%);
		--podium: #e9e6df;
		--podium-edge: rgba(0, 0, 0, 0.08);
		--grid: rgba(0, 0, 0, 0.04);
	}
	:global(.theme-dark) .backstage {
		--bg: #0b0c10;
		--wall: linear-gradient(180deg, #1b1e26 0%, #0e1015 100%);
		--floor: linear-gradient(180deg, #15171d 0%, #0a0b0e 100%);
		--podium: #1a1d24;
		--podium-edge: rgba(255, 255, 255, 0.06);
		--grid: rgba(255, 255, 255, 0.04);
	}

	.wall {
		position: absolute;
		inset: 0 0 32% 0;
		background: var(--wall);
		background-image:
			linear-gradient(var(--grid) 1px, transparent 1px),
			linear-gradient(90deg, var(--grid) 1px, transparent 1px),
			var(--wall);
		background-size:
			28px 28px,
			28px 28px,
			100% 100%;
	}

	.floor {
		position: absolute;
		inset: 68% 0 0 0;
		background: var(--floor);
		transform: perspective(360px) rotateX(48deg);
		transform-origin: top center;
	}

	.podium {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		border-radius: 50%;
		background: var(--podium);
		box-shadow:
			0 -1px 0 var(--podium-edge),
			0 8px 20px rgba(0, 0, 0, 0.25);
	}
	.podium-1 {
		bottom: 9%;
		width: 86%;
		height: 11%;
	}
	.podium-2 {
		bottom: 5%;
		width: 100%;
		height: 11%;
		opacity: 0.85;
	}
	.podium-3 {
		bottom: 1%;
		width: 112%;
		height: 11%;
		opacity: 0.7;
	}

	.spot-disc {
		position: absolute;
		bottom: 11%;
		left: 50%;
		width: 46%;
		height: 9%;
		transform: translateX(-50%);
		border-radius: 50%;
		background: radial-gradient(circle, var(--accent) 0%, var(--accent-soft) 55%, transparent 75%);
		filter: blur(0.5px);
		transition: opacity 700ms ease;
	}

	.light {
		position: absolute;
		pointer-events: none;
		transition: opacity 700ms ease;
		mix-blend-mode: screen;
	}
	.top-light {
		inset: -10% 0 40% 0;
		background: radial-gradient(
			ellipse 60% 55% at 50% 28%,
			rgba(255, 255, 255, 0.85),
			transparent 70%
		);
	}
	.stage-light {
		inset: 40% 0 0 0;
		background: radial-gradient(
			ellipse 55% 60% at 50% 75%,
			rgba(255, 246, 214, 0.9),
			transparent 72%
		);
	}

	.dim {
		position: absolute;
		inset: 0;
		background: #000;
		pointer-events: none;
		transition: opacity 800ms ease;
	}
</style>
