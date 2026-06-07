<script lang="ts">
	import { getEngine } from '$lib/engine/context';
	import type { Expression } from '$lib/engine/types';

	const engine = getEngine();

	// The middle panel sits between the progress bar and the nav. Opening it
	// pushes the progress bar up and reveals the hidden space.
	let expanded = $state(false);

	const isLanding = $derived(engine.phase === 'landing');
	const isEnded = $derived(engine.phase === 'ended');
	const loading = $derived(isLanding && !engine.scenario);
	const canInteract = $derived(engine.canInteract);
	const isRepeat = $derived(engine.isRepeatPrompt);
	const continuesToEnd = $derived(engine.continuesToEnd);
	const question = $derived(engine.activeQuestion);
	const answers = $derived(engine.answers);
	const links = $derived(engine.links);
	const contactLinks = $derived(engine.contactLinks);
	const interactionSeconds = $derived(Math.ceil(engine.interactionRemainingMs / 1000));
	const progress = $derived(engine.sectionProgress);

	// Contact info only surfaces on the landing (intro) and ended screens; the
	// presentation body (playback / questions) shows the controls header instead.
	const showContact = $derived(isLanding || isEnded);
	const headTitle = $derived(canInteract ? (question?.title ?? engine.sectionTitle) : engine.sectionTitle);
	const repeatDisabled = $derived(engine.realSectionIndex < 0);

	$effect(() => {
		// Auto-reveal the panel for questions and at the end; closed otherwise
		// (including landing, where it opens only on a progress-bar click).
		expanded = canInteract || isEnded;
	});

	function toggle() {
		if (loading) return;
		expanded = !expanded;
	}

	function onCounter() {
		if (canInteract) engine.stopInteractionTimer();
		else engine.togglePlay();
	}

	function hoverOn(face?: Expression | null) {
		if (face) engine.setHoverFace(face);
	}
	function hoverOff() {
		engine.setHoverFace(null);
	}
</script>

<nav class="navigation">
	<button
		class="progress glass"
		type="button"
		disabled={loading}
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

	<div class="panel" class:open={expanded}>
		<div class="panel-clip">
			<div class="panel-card glass">
				{#if showContact}
					<div class="head">
						<span class="title">راه‌های ارتباطی</span>
					</div>
					{#if contactLinks.length > 0}
						<div class="options">
							{#each contactLinks as l (l.id)}
								<a
									class="box link"
									href={l.url}
									target="_blank"
									rel="noopener noreferrer"
									onpointerenter={() => hoverOn(l.face)}
									onpointerleave={hoverOff}
									onpointerdown={() => hoverOn(l.face)}
									onpointerup={hoverOff}
									onpointercancel={hoverOff}
								>
									{#if l.icon}<span class="icon">{l.icon}</span>{/if}
									<span class="label">{l.label}</span>
								</a>
							{/each}
						</div>
					{/if}
				{:else}
					<div class="head">
						<span class="title">{headTitle}</span>
						<div class="tools" dir="ltr">
							<button
								class="tool"
								disabled={repeatDisabled}
								onclick={() => engine.repeatSectionForce()}
								aria-label="تکرار ارائه این بخش"
								title="تکرار ارائه این بخش"
							>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
									><path
										d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5"
										stroke-linecap="round"
										stroke-linejoin="round"
									/><path
										d="M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"
										stroke-linecap="round"
										stroke-linejoin="round"
									/></svg
								>
							</button>

							<button
								class="tool"
								class:active={engine.zoom === 'in'}
								onclick={() => engine.toggleZoom()}
								aria-label="نمای اسلاید"
								title={engine.zoom === 'in' ? 'نمای کاراکتر' : 'نمای اسلاید'}
							>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
									><circle cx="11" cy="11" r="7" /><path
										d="m21 21-4.3-4.3M11 8v6M8 11h6"
										stroke-linecap="round"
									/></svg
								>
							</button>

							<button
								class="tool counter"
								onclick={onCounter}
								aria-label={canInteract ? 'توقف شمارش' : 'پخش/توقف'}
							>
								{#if canInteract}
									{#if engine.interactionTimerStopped}
										<span class="glyph">∞</span>
									{:else}
										<span class="num">{interactionSeconds}</span>
									{/if}
								{:else if engine.isPlaying}
									<svg viewBox="0 0 24 24" fill="currentColor"
										><path d="M7 5h3v14H7zM14 5h3v14h-3z" /></svg
									>
								{:else}
									<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
								{/if}
							</button>
						</div>
					</div>

					{#if canInteract}
						<div class="options">
							{#each answers as a (a.id)}
								<button
									class="box answer"
									onclick={() => (isRepeat ? engine.confirmRepeat() : engine.answerQuestion(a))}
									onpointerenter={() => hoverOn(a.face)}
									onpointerleave={hoverOff}
									onpointerdown={() => hoverOn(a.face)}
									onpointerup={hoverOff}
									onpointercancel={hoverOff}
								>
									<span class="label">{a.label}</span>
								</button>
							{/each}

							{#each links as l (l.id)}
								<a
									class="box link"
									href={l.url}
									target="_blank"
									rel="noopener noreferrer"
									onpointerenter={() => hoverOn(l.face)}
									onpointerleave={hoverOff}
									onpointerdown={() => hoverOn(l.face)}
									onpointerup={hoverOff}
									onpointercancel={hoverOff}
								>
									{#if l.icon}<span class="icon">{l.icon}</span>{/if}
									<span class="label">{l.label}</span>
								</a>
							{/each}
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</div>

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
			<button class="center" onclick={() => engine.start()}>شروع ارائه</button>
		{:else if canInteract}
			<button class="center" onclick={() => engine.continueInteraction()}>
				{isRepeat ? 'برو مرحله بعد' : continuesToEnd ? 'پایان ارائه' : 'ادامه ارائه'}
			</button>
		{:else}
			<div class="orb-center title-center" aria-expanded={expanded}>
				<span>{engine.sectionTitle}</span>
			</div>
		{/if}

		<button
			class="orb"
			class:muted={engine.muted}
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
		color: var(--glass-fg);
	}

	/* ---- progress bar (top) -------------------------------------------- */
	.progress {
		pointer-events: auto;
		position: relative;
		height: 12px;
		padding: 0;
		margin: 0 40px -1px 40px;
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
		margin: -1px 40px -1px 40px;
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

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.title {
		font-family: var(--font-title);
		font-weight: 800;
		font-size: 15px;
		min-width: 0;
		flex: 1;
	}

	/* Uniform control cluster: repeat / zoom / counter. */
	.tools {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: none;
	}
	.tool {
		display: grid;
		place-items: center;
		width: 42px;
		height: 42px;
		border-radius: 50%;
		border: 1px solid var(--orb-edge);
		background: var(--orb-bg);
		color: inherit;
		transition: transform 120ms ease;
	}
	.tool svg {
		width: 20px;
		height: 20px;
	}
	.tool:not(:disabled):active {
		transform: scale(0.92);
	}
	.tool:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.tool.active {
		background: var(--accent);
		color: var(--accent-contrast);
		border-color: transparent;
	}
	.tool.counter .num,
	.tool.counter .glyph {
		font-weight: 800;
		font-size: 15px;
		line-height: 1;
	}
	.tool.counter .glyph {
		font-size: 20px;
	}

	/* ---- interaction / contact option boxes (full width) --------------- */
	.options {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.box {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 13px 16px;
		border-radius: 14px;
		border: 1px solid var(--orb-edge);
		background: var(--orb-bg);
		color: inherit;
		font-size: 14px;
		font-weight: 600;
		text-align: center;
		text-decoration: none;
		transition: transform 120ms ease;
	}
	.box:active {
		transform: scale(0.98);
	}
	.box.answer {
		background: var(--accent);
		color: var(--accent-contrast);
		border-color: transparent;
	}
	.box .icon {
		font-size: 16px;
		line-height: 1;
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
		color: var(--glass-fg);
		box-shadow:
			inset 0 1px 1px var(--orb-side),
			inset 0 -1px 1px var(--orb-side);
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

	.orb-center {
		height: 56px;
		min-width: 0;
		display: grid;
		place-items: center;
		padding: 0 22px;
		border: 1px solid var(--orb-edge);
		border-radius: 999px;
		background: var(--orb-bg);
		color: var(--glass-fg);
		box-shadow: inset 0 1px 0 var(--glass-hi);
		transition: transform 120ms ease;
	}

	.center {
		height: 56px;
		min-width: 0;
		display: grid;
		place-items: center;
		padding: 0 22px;
		border: 1px solid var(--orb-edge);
		border-radius: 999px; /* fully rounded */
		background: var(--orb-accent);
		color: var(--glass-fg);
		font-family: var(--font-title);
		font-size: 18px;
		box-shadow:
			0 6px 18px rgba(244, 180, 0, 0.35),
			inset 0 2px 2px var(--orb-side),
			inset 0 -2px 2px var(--orb-side);
		transition: transform 120ms ease;
	}
	.center:disabled {
		background: var(--orb-bg);
		color: var(--glass-fg);
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
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (prefers-reduced-motion: reduce) {
		.panel,
		.fill,
		.orb,
		.center,
		.box,
		.tool {
			transition: none;
		}
	}
</style>
