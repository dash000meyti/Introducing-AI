<script lang="ts">
	import { getEngine } from '$lib/engine/context';

	const engine = getEngine();
	const overlays = $derived(engine.activeOverlays);
</script>

<div class="overlay-root">
	{#each overlays as o (o.id)}
		{#if o.kind === 'highlight'}
			<div
				class="ov highlight"
				style:left={`${o.x ?? 50}%`}
				style:top={`${o.y ?? 50}%`}
				style:width={`${o.w ?? 20}%`}
				style:height={`${o.h ?? 12}%`}
			></div>
		{:else if o.kind === 'tooltip'}
			<div class="ov tooltip" style:left={`${o.x ?? 50}%`} style:top={`${o.y ?? 50}%`}>
				{o.text}
			</div>
		{:else if o.kind === 'callout'}
			<div class="ov callout" style:left={`${o.x ?? 50}%`} style:top={`${o.y ?? 50}%`}>
				<span class="dot"></span>
				<span class="callout-text">{o.text}</span>
			</div>
		{:else}
			<!-- popup -->
			<div class="ov popup">
				<div class="popup-card">{o.text}</div>
			</div>
		{/if}
	{/each}
</div>

<style>
	.overlay-root {
		position: absolute;
		inset: 0;
		z-index: 4;
		pointer-events: none;
	}

	.ov {
		position: absolute;
		animation: ov-fade 280ms ease both;
	}

	.highlight {
		transform: translate(-50%, -50%);
		border: 3px solid var(--accent);
		border-radius: 12px;
		box-shadow:
			0 0 0 9999px var(--overlay-backdrop),
			0 0 24px color-mix(in srgb, var(--accent) 55%, transparent);
	}

	.tooltip {
		transform: translate(-50%, -120%);
		background: var(--overlay-tooltip-bg);
		color: var(--overlay-tooltip-text);
		font-family: var(--font-body);
		font-size: 13px;
		padding: 8px 12px;
		border-radius: 10px;
		max-width: 70%;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
	}
	.tooltip::after {
		content: '';
		position: absolute;
		bottom: -6px;
		left: 50%;
		transform: translateX(-50%);
		border: 6px solid transparent;
		border-top-color: var(--overlay-tooltip-bg);
		border-bottom: 0;
	}

	.callout {
		transform: translate(-50%, -50%);
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.callout .dot {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 0 6px rgba(244, 180, 0, 0.25);
		animation: pulse-glow 1.6s ease-in-out infinite;
	}
	.callout-text {
		background: var(--accent);
		color: var(--accent-contrast);
		font-family: var(--font-title);
		font-weight: 700;
		font-size: 13px;
		padding: 6px 12px;
		border-radius: 999px;
		white-space: nowrap;
	}

	.popup {
		inset: 0;
		display: grid;
		place-items: center;
		background: var(--overlay-backdrop);
	}
	.popup-card {
		background: var(--popup-surface);
		color: var(--popup-text);
		font-family: var(--font-body);
		font-size: 16px;
		line-height: 1.7;
		padding: 22px 26px;
		border-radius: 16px;
		max-width: 78%;
		text-align: center;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
	}

	@keyframes ov-fade {
		from {
			opacity: 0;
		}
	}
</style>
