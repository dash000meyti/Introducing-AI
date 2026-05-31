<script lang="ts">
	import { getEngine } from '$lib/engine/context';
	import ProgressTimeline from './ProgressTimeline.svelte';

	const engine = getEngine();

	const isPlaying = $derived(engine.phase === 'playing');
	const canInteract = $derived(engine.canInteract);
	const questions = $derived(engine.currentQuestions);
	const interactionSeconds = $derived(Math.ceil(engine.interactionRemainingMs / 1000));
</script>

<nav class="navigation" class:light={engine.theme === 'light'}>
	{#if canInteract}
		<div class="interaction">
			<div class="interaction-head">
				<span>سوالی دارید؟</span>
				{#if interactionSeconds > 0}<span class="countdown">{interactionSeconds}</span>{/if}
			</div>
			<div class="questions">
				{#each questions as q (q.id)}
					<button class="q" onclick={() => engine.answerQuestion(q)}>{q.label}</button>
				{/each}
				<button class="q continue" onclick={() => engine.continueInteraction()}>
					ادامه ارائه
				</button>
			</div>
		</div>
	{/if}

	<div class="status">
		<span class="title">{engine.sectionTitle}</span>
		<span class="count" dir="ltr">{engine.sectionIndex + 1} / {engine.totalSections}</span>
	</div>

	<ProgressTimeline />

	<div class="controls no-scrollbar">
		<button class="ctrl" onclick={() => engine.togglePlay()} aria-label="play-pause">
			{#if isPlaying}
				<svg viewBox="0 0 24 24" fill="currentColor"
					><rect x="6" y="5" width="4" height="14" rx="1" /><rect
						x="14"
						y="5"
						width="4"
						height="14"
						rx="1"
					/></svg
				>
			{:else}
				<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z" /></svg>
			{/if}
			<span>{isPlaying ? 'توقف' : 'پخش'}</span>
		</button>

		<button class="ctrl" onclick={() => engine.repeatSection()} aria-label="repeat">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
				><path d="M17 1v4a8 8 0 1 1-3-2" stroke-linecap="round" /></svg
			>
			<span>تکرار</span>
		</button>

		<button
			class="ctrl"
			class:active={engine.zoom === 'in'}
			onclick={() => engine.toggleZoom()}
			aria-label="zoom"
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
				><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3M11 8v6M8 11h6" stroke-linecap="round" /></svg
			>
			<span>{engine.zoom === 'in' ? 'نمای کاراکتر' : 'نمای اسلاید'}</span>
		</button>

		<button class="ctrl" onclick={() => engine.toggleTheme()} aria-label="theme">
			{#if engine.theme === 'dark'}
				<svg viewBox="0 0 24 24" fill="currentColor"
					><path d="M12 3a9 9 0 1 0 9 9c-4 1-8-3-9-9z" /></svg
				>
			{:else}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
					><circle cx="12" cy="12" r="4" /><path
						d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"
						stroke-linecap="round"
					/></svg
				>
			{/if}
			<span>{engine.theme === 'dark' ? 'روشن' : 'تاریک'}</span>
		</button>

		<button
			class="ctrl"
			class:active={engine.muted}
			onclick={() => engine.toggleMute()}
			aria-label="mute"
		>
			{#if engine.muted}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
					><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none" /><path
						d="m17 9 4 6M21 9l-4 6"
						stroke-linecap="round"
					/></svg
				>
			{:else}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
					><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none" /><path
						d="M16 8a5 5 0 0 1 0 8"
						stroke-linecap="round"
					/></svg
				>
			{/if}
			<span>{engine.muted ? 'بی‌صدا' : 'صدا'}</span>
		</button>
	</div>
</nav>

<style>
	.navigation {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 7;
		padding: 12px 14px calc(env(safe-area-inset-bottom, 0px) + 14px);
		background: linear-gradient(to top, rgba(8, 8, 10, 0.92), rgba(8, 8, 10, 0));
		color: #fff;
		display: flex;
		flex-direction: column;
		gap: 9px;
	}
	.navigation.light {
		color: #14110a;
		background: linear-gradient(to top, rgba(245, 244, 240, 0.95), rgba(245, 244, 240, 0));
	}

	.status {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 13px;
	}
	.title {
		font-weight: 700;
	}
	.count {
		opacity: 0.7;
		font-size: 12px;
	}

	.controls {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding-top: 2px;
	}
	.ctrl {
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		border-radius: 14px;
		border: none;
		background: rgba(255, 255, 255, 0.1);
		color: inherit;
		font-size: 12px;
		font-weight: 600;
		white-space: nowrap;
	}
	.navigation.light .ctrl {
		background: rgba(0, 0, 0, 0.06);
	}
	.ctrl svg {
		width: 18px;
		height: 18px;
	}
	.ctrl.active {
		background: var(--accent);
		color: #1a1407;
	}

	.interaction {
		background: rgba(20, 20, 24, 0.9);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 16px;
		padding: 12px 14px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.navigation.light .interaction {
		background: rgba(255, 255, 255, 0.95);
		border-color: rgba(0, 0, 0, 0.06);
	}
	.interaction-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 13px;
		font-weight: 700;
	}
	.countdown {
		display: grid;
		place-items: center;
		min-width: 24px;
		height: 24px;
		padding: 0 6px;
		border-radius: 999px;
		background: var(--accent);
		color: #1a1407;
		font-size: 12px;
	}
	.questions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.q {
		padding: 9px 14px;
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.14);
		background: rgba(255, 255, 255, 0.06);
		color: inherit;
		font-size: 13px;
		font-weight: 600;
	}
	.navigation.light .q {
		border-color: rgba(0, 0, 0, 0.1);
		background: rgba(0, 0, 0, 0.04);
	}
	.q.continue {
		background: var(--accent);
		color: #1a1407;
		border-color: transparent;
	}
</style>
