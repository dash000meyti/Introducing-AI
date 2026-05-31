<script lang="ts">
	import { getEngine } from '$lib/engine/context';

	const engine = getEngine();
	const sections = $derived(engine.scenario?.sections ?? []);

	function fill(index: number): number {
		if (index < engine.sectionIndex) return 1;
		if (index > engine.sectionIndex) return 0;
		return engine.sectionProgress;
	}
</script>

<div class="timeline">
	{#each sections as section, i (section.id)}
		<button
			class="seg"
			class:current={i === engine.sectionIndex}
			title={section.title}
			onclick={() => engine.goToSection(i)}
			aria-label={section.title}
		>
			<span class="seg-fill" style:transform={`scaleX(${fill(i)})`}></span>
		</button>
	{/each}
</div>

<style>
	.timeline {
		display: flex;
		gap: 5px;
		width: 100%;
	}
	.seg {
		flex: 1;
		height: 5px;
		padding: 0;
		border: none;
		border-radius: 999px;
		background: color-mix(in srgb, currentColor 22%, transparent);
		overflow: hidden;
		position: relative;
	}
	.seg.current {
		height: 6px;
	}
	.seg-fill {
		position: absolute;
		inset: 0;
		transform-origin: right center; /* RTL: fill from the right */
		background: var(--accent);
		border-radius: 999px;
		transition: transform 120ms linear;
	}
</style>
