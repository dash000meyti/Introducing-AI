<script lang="ts">
	import { getEngine } from '$lib/engine/context';

	const engine = getEngine();

	const text = $derived(engine.transcriptText);
	const cue = $derived(engine.transcriptCue);
	const visible = $derived(text.length > 0 || !!cue);

	// Karaoke-style reveal: show the spoken portion brightly and the rest dimmed,
	// proportional to how far through the current step's audio we are.
	const revealCount = $derived(Math.round(text.length * engine.stepProgress));
	const spoken = $derived(text.slice(0, revealCount));
	const upcoming = $derived(text.slice(revealCount));
</script>

{#if visible}
	<div class="transcript" class:light={engine.theme === 'light'}>
		<div class="bubble">
			{#if cue}
				<span class="cue">{cue}</span>
			{/if}
			{#if text}
				<p class="line">
					<span class="spoken">{spoken}</span><span class="upcoming">{upcoming}</span>
				</p>
			{/if}
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
		padding: calc(env(safe-area-inset-top, 0px) + 14px) 16px 8px;
		pointer-events: none;
	}

	.bubble {
		max-width: 92%;
		background: rgba(12, 12, 14, 0.72);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 16px;
		padding: 12px 18px;
		text-align: center;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
	}
	.transcript.light .bubble {
		background: rgba(255, 255, 255, 0.82);
		border-color: rgba(0, 0, 0, 0.06);
	}

	.cue {
		display: inline-block;
		font-size: 12px;
		font-weight: 700;
		color: var(--accent);
		margin-bottom: 4px;
	}

	.line {
		margin: 0;
		font-size: 15px;
		line-height: 1.85;
		font-weight: 500;
	}
	.spoken {
		color: #fff;
	}
	.upcoming {
		color: rgba(255, 255, 255, 0.45);
	}
	.transcript.light .spoken {
		color: #14110a;
	}
	.transcript.light .upcoming {
		color: rgba(20, 17, 10, 0.4);
	}
</style>
