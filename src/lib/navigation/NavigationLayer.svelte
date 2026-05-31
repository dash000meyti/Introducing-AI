<script lang="ts">
	import { getEngine } from '$lib/engine/context';
	import ProgressTimeline from './ProgressTimeline.svelte';

	const engine = getEngine();

	// The middle panel sits between the progress bar and the nav. Opening it
	// pushes the progress bar up and reveals the hidden space.
	let expanded = $state(false);

	const isLanding = $derived(engine.phase === 'landing');
	const isEnded = $derived(engine.phase === 'ended');
	const loading = $derived(isLanding && !engine.scenario);
	const canInteract = $derived(engine.canInteract);
	const questions = $derived(engine.currentQuestions);
	const interactionSeconds = $derived(Math.ceil(engine.interactionRemainingMs / 1000));
	const progress = $derived(engine.overallProgress);

	// Progress bar shows during playback, and during landing only while loading.
	const showProgress = $derived(!isLanding || loading);

	$effect(() => {
		// Auto-reveal the panel for questions while paused; tuck away afterwards.
		expanded = canInteract;
	});

	function toggle() {
		if (isLanding) return;
		expanded = !expanded;
	}
</script>

<nav class="navigation" class:light={engine.theme === 'light'}>
	{#if showProgress}
		<button
			class="progress glass"
			type="button"
			disabled={isLanding}
			onclick={toggle}
			aria-expanded={expanded}
			aria-label={expanded ? 'بستن جزئیات' : 'باز کردن جزئیات'}
		>
			<span
				class="fill"
				class:indeterminate={loading}
				style:transform={`scaleX(${loading ? 1 : progress})`}
			></span>
		</button>
	{/if}

	{#if !isLanding}
		<div class="panel" class:open={expanded}>
			<div class="panel-clip">
				<div class="panel-card glass">
					<div class="status">
						<span class="title">{engine.sectionTitle}</span>
						<span class="count" dir="ltr">{engine.sectionIndex + 1} / {engine.totalSections}</span>
					</div>

					<ProgressTimeline />

					{#if canInteract}
						<div class="interaction">
							<div class="ask-row">
								<span class="ask">سوالی دارید؟</span>
								{#if interactionSeconds > 0}
									<span class="countdown" dir="ltr">{interactionSeconds}</span>
								{/if}
							</div>
							<div class="questions">
								{#each questions as q (q.id)}
									<button class="pill" onclick={() => engine.answerQuestion(q)}>{q.label}</button>
								{/each}
								<button class="pill continue" onclick={() => engine.continueInteraction()}>
									ادامه ارائه
								</button>
							</div>
						</div>
					{/if}

					<button
						class="pill zoom"
						class:active={engine.zoom === 'in'}
						onclick={() => engine.toggleZoom()}
						aria-label="zoom"
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
							><circle cx="11" cy="11" r="7" /><path
								d="m21 21-4.3-4.3M11 8v6M8 11h6"
								stroke-linecap="round"
							/></svg
						>
						<span>{engine.zoom === 'in' ? 'نمای کاراکتر' : 'نمای اسلاید'}</span>
					</button>
				</div>
			</div>
		</div>
	{/if}

	<div class="tray glass" dir="ltr">
		<button class="orb" onclick={() => engine.toggleTheme()} aria-label="theme">
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
		</button>

		{#if isLanding}
			<button class="center" disabled={!engine.scenario} onclick={() => engine.start()}>
				{engine.scenario ? 'شروع ارائه' : 'در حال آماده‌سازی…'}
			</button>
		{:else if isEnded}
			<button class="center" onclick={() => engine.restart()}>شروع دوباره</button>
		{:else}
			<button class="center title-center" onclick={toggle} aria-expanded={expanded}>
				<span class="center-title">{engine.sectionTitle}</span>
				<svg
					class="chev"
					class:up={expanded}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.4"
					><path d="m6 14 6-6 6 6" stroke-linecap="round" stroke-linejoin="round" /></svg
				>
			</button>
		{/if}

		<button class="orb" class:muted={engine.muted} onclick={() => engine.toggleMute()} aria-label="mute">
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
		padding: 0 12px calc(env(safe-area-inset-bottom, 0px) + 12px);
		display: flex;
		flex-direction: column;
		align-items: stretch;
		pointer-events: none;
		/* Liquid-glass (macOS Tahoe) palette, shared by every floating surface. */
		--glass-bg: rgba(22, 22, 26, 0.4);
		--glass-edge: rgba(255, 255, 255, 0.18);
		--glass-hi: rgba(255, 255, 255, 0.25);
		--fg: #f4f2ec;
		--orb-bg: rgba(255, 255, 255, 0.12);
		--orb-edge: rgba(255, 255, 255, 0.2);
	}
	.navigation.light {
		--glass-bg: rgba(250, 249, 246, 0.5);
		--glass-edge: rgba(255, 255, 255, 0.7);
		--glass-hi: rgba(255, 255, 255, 0.9);
		--fg: #1f1c16;
		--orb-bg: rgba(255, 255, 255, 0.5);
		--orb-edge: rgba(255, 255, 255, 0.7);
	}

	/* Shared frosted-glass surface. */
	.glass {
		background: var(--glass-bg);
		backdrop-filter: var(--glass-blur);
		-webkit-backdrop-filter: var(--glass-blur);
		border: 1px solid var(--glass-edge);
		box-shadow:
			0 14px 38px rgba(0, 0, 0, 0.34),
			inset 0 1px 0 var(--glass-hi);
		color: var(--fg);
	}

	/* ---- progress bar (top) -------------------------------------------- */
	.progress {
		pointer-events: auto;
		position: relative;
		height: 12px;
		padding: 0;
		margin: 0 40px -1px 40px ;
		border-radius: 999px 999px 0 0;
		overflow: hidden;
	}
	.progress:disabled {
		cursor: default;
	}
	.fill {
		position: absolute;
		inset: 0px;
		margin: 0 2px;
		border-radius: 999px 999px 0 0;
		top: 2px;
		transform-origin: right center; /* RTL: progress flows from the right */
		background: linear-gradient(90deg, #e0921e, var(--accent));
		transition: transform 140ms linear;
	}
	.fill.indeterminate {
		width: 40%;
		inset: 3px auto 3px 0;
		transform: none !important;
		animation: bar-loading 1.1s ease-in-out infinite;
	}
	@keyframes bar-loading {
		0% {
			left: -40%;
		}
		100% {
			left: 100%;
		}
	}

	/* ---- middle panel (between progress + nav) ------------------------- */
	.panel {
		pointer-events: auto;
		display: grid;
		margin: -1px 40px -1px 40px ;
		grid-template-rows: 0fr; /* collapsed: zero height, space stays hidden */
		transition: grid-template-rows 280ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	.panel.open {
		grid-template-rows: 1fr;
	}
	.panel-clip {
		min-height: 0;
		overflow: hidden;
	}
	.panel-card {
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		max-height: 56vh;
		overflow-y: auto;
	}

	.status {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 14px;
	}
	.title {
		font-weight: 800;
	}
	.count {
		opacity: 0.6;
		font-size: 12px;
	}

	.interaction {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.ask-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.ask {
		font-size: 13px;
		font-weight: 700;
	}
	.countdown {
		display: grid;
		place-items: center;
		min-width: 26px;
		height: 26px;
		padding: 0 8px;
		border-radius: 999px;
		background: var(--accent);
		color: #1a1407;
		font-size: 12px;
		font-weight: 800;
	}
	.questions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	/* Fully rounded pill controls inside the panel. */
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 10px 16px;
		border-radius: 999px;
		border: 1px solid var(--orb-edge);
		background: var(--orb-bg);
		color: inherit;
		font-size: 13px;
		font-weight: 600;
		transition: transform 120ms ease;
	}
	.pill:active {
		transform: scale(0.96);
	}
	.pill svg {
		width: 18px;
		height: 18px;
	}
	.pill.continue {
		background: var(--accent);
		color: #1a1407;
		border-color: transparent;
	}
	.pill.zoom {
		align-self: flex-start;
		font-size: 12px;
		font-weight: 700;
	}
	.pill.zoom.active {
		background: var(--accent);
		color: #1a1407;
		border-color: transparent;
	}

	/* ---- navigation tray (bottom) — glass pill ------------------------- */
	.tray {
		pointer-events: auto;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 10px;
		padding: 9px;
		border-radius: 999px; /* fully rounded glass bar */
	}

	/* Circular icon buttons. */
	.orb {
		display: grid;
		place-items: center;
		width: 56px;
		height: 56px;
		border: 1px solid var(--orb-edge);
		border-radius: 50%;
		background: var(--orb-bg);
		color: var(--fg);
		box-shadow: inset 0 1px 0 var(--glass-hi);
		transition: transform 120ms ease;
	}
	.orb svg {
		width: 22px;
		height: 22px;
	}
	.orb.muted {
		color: var(--accent);
	}
	.orb:active {
		transform: scale(0.92);
	}

	.center {
		height: 56px;
		min-width: 0;
		padding: 0 22px;
		border: none;
		border-radius: 999px; /* fully rounded */
		background: var(--accent);
		color: #1a1407;
		font-size: 17px;
		font-weight: 900;
		white-space: nowrap;
		box-shadow:
			0 6px 18px rgba(244, 180, 0, 0.35),
			inset 0 1px 0 rgba(255, 255, 255, 0.45);
		transition: transform 120ms ease;
	}
	.center:disabled {
		background: rgba(207, 202, 189, 0.6);
		color: #6b6657;
		box-shadow: none;
	}
	.center:not(:disabled):active {
		transform: scale(0.98);
	}
	.title-center {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		direction: rtl;
	}
	.center-title {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 16px;
	}
	.chev {
		flex: 0 0 auto;
		width: 20px;
		height: 20px;
		transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	.chev.up {
		transform: rotate(180deg);
	}

	@media (prefers-reduced-motion: reduce) {
		.panel,
		.fill,
		.chev,
		.orb,
		.center,
		.pill {
			transition: none;
		}
	}
</style>
