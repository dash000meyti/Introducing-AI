// PresentationEngine: the single source of truth that orchestrates every layer.
//
// One requestAnimationFrame loop advances the master clock (AudioController),
// drives lip-sync visemes, transcript, overlays, timed `change[]` events, and
// section transitions. Every layer is a pure consumer of the reactive state
// exposed here.
//
// v2 is fully data-driven after the "start" button: the entrance, lighting-up,
// and exit are authored as timed change[] events inside startSection /
// endSection, so nothing is hardcoded here. The engine normalises
// startSection + sections[] + endSection into one ordered list with reserved
// ids `__start` and `__end`.

import { AudioController } from './AudioController';
import { MusicController } from './MusicController';
import { PathMemory } from './PathMemory';
import { buildTranscriptView, resolveMouthShape } from './Timeline';
import type {
	Answer,
	ChangeEvent,
	Expression,
	Gesture,
	LinkDef,
	Lighting,
	Locomotion,
	MouthShape,
	OverlayDef,
	PresentationPhase,
	Question,
	Scenario,
	Step,
	Theme,
	ThemeSetting,
	TranscriptView,
	Zoom
} from './types';

const THEME_STORAGE_KEY = 'introducing-ai.theme';
/** Default auto-advance countdown for an interaction, in ms. */
const DEFAULT_INTERACTION_MS = 15000;

const START_ID = '__start';
const END_ID = '__end';

interface RuntimeSection {
	id: string;
	title: string;
	steps: Step[];
	/** Default next section id after the last step (or "end"); branches the flow. */
	nextSectionId?: string;
	/** Optional branch override based on the section that led into this one. */
	nextSectionIf?: { inId: string; outId: string }[];
}

const REPEAT_QUESTION: Question = {
	title: 'این بخش را یک بار توضیح داده‌ام، می‌خواهی دوباره تکرار کنم؟',
	answers: [{ id: 'repeat-yes', label: 'دوباره تکرار کن' }]
};

export class PresentationEngine {
	scenario = $state<Scenario | null>(null);
	phase = $state<PresentationPhase>('landing');
	sectionIndex = $state(0); // index into runtimeSections
	stepIndex = $state(0);

	// User-controllable state.
	theme = $state<Theme>('light');
	muted = $state(false);

	// Live stage state, mutated by timed change[] events (not per-step getters).
	zoom = $state<Zoom>('in');
	lighting = $state<Lighting>({ backstage: 'on', presentation: 'off', character: 'off' });
	currentSlide = $state(0);

	// Live clock state.
	stepTimeMs = $state(0);
	stepDurationMs = $state(0);
	interactionRemainingMs = $state(0);
	interactionTimerStopped = $state(false);

	// Character state. face/body are one-shot: the nonce changes to (re)trigger a
	// 12-frame play that returns to the default afterwards.
	characterPresent = $state(false);
	faceShot = $state<Expression>('normal');
	faceNonce = $state(0);
	bodyGesture = $state<Gesture>('none');
	bodyNonce = $state(0);
	locomotion = $state<Locomotion>('none');
	moveNonce = $state(0);
	hoverFace = $state<Expression | null>(null);

	// Interaction state.
	interactionQuestion = $state<Question | null>(null);
	pendingRepeat = $state(false);
	private pendingRepeatIndex = -1;

	private hasSavedTheme = false;
	private audio = new AudioController();
	private music = new MusicController();
	private path = new PathMemory();
	private rafId: number | null = null;
	private lastFrame = 0;
	private incomingSectionId: string | null = null;
	private pendingRepeatIncomingSectionId: string | null = null;

	// Per-step timed cursors.
	private stepChanges: ChangeEvent[] = [];
	private stepChangeCursor = 0;
	private stepSfx: { time: number; sound: string }[] = [];
	private stepSfxCursor = 0;

	// ---- setup -------------------------------------------------------------
	constructor() {
		const saved = this.loadSavedTheme();
		this.hasSavedTheme = saved !== null;
		this.theme = saved ?? 'light';
		this.syncThemeClass(this.theme);
	}

	setScenario(scenario: Scenario) {
		this.scenario = scenario;
		this.sectionIndex = 0;
		this.stepIndex = 0;
		this.currentSlide = 0;
		this.zoom = 'in';
		this.lighting = { backstage: 'on', presentation: 'off', character: 'off' };
		this.characterPresent = false;
		this.phase = 'landing';
		this.music.load(scenario.music);
		this.music.setMuted(this.muted);
		// Honor the scenario theme unless the viewer has an explicit saved choice.
		if (!this.hasSavedTheme) {
			this.theme = resolveTheme(scenario.theme);
			this.syncThemeClass(this.theme);
		}
	}

	// ---- runtime section model --------------------------------------------

	private get runtimeSections(): RuntimeSection[] {
		const s = this.scenario;
		if (!s) return [];
		return [
			{
				id: START_ID,
				title: s.startSection.title,
				steps: s.startSection.steps,
				nextSectionId: s.startSection.nextSectionId,
				nextSectionIf: s.startSection.nextSectionIf
			},
			...s.sections,
			{
				id: END_ID,
				title: s.endSection.title,
				steps: s.endSection.steps,
				nextSectionId: s.endSection.nextSectionId,
				nextSectionIf: s.endSection.nextSectionIf
			}
		];
	}

	private indexOfSectionId(id: string): number {
		const target = id === 'end' ? END_ID : id;
		return this.runtimeSections.findIndex((s) => s.id === target);
	}

	private isRealSection(section: RuntimeSection | undefined): boolean {
		return !!section && section.id !== START_ID && section.id !== END_ID;
	}

	// ---- derived view (consumed by layers) ---------------------------------

	get currentSection(): RuntimeSection | null {
		return this.runtimeSections[this.sectionIndex] ?? null;
	}

	get currentStep(): Step | null {
		return this.currentSection?.steps[this.stepIndex] ?? null;
	}

	get isPlaying() {
		return this.phase === 'playing';
	}

	get sectionTitle(): string {
		if (this.phase === 'landing') return this.scenario?.title ?? '';
		if (this.pendingRepeat) {
			return this.runtimeSections[this.pendingRepeatIndex]?.title ?? '';
		}
		return this.currentSection?.title ?? '';
	}

	get characterVisible(): boolean {
		return this.phase !== 'landing' && this.characterPresent;
	}

	/** Resting facial expression (the one-shot face is delivered via faceShot). */
	get expression(): Expression {
		return 'normal';
	}

	get mouthShape(): MouthShape {
		if (this.phase !== 'playing') return 'rest';
		return resolveMouthShape(this.currentStep, this.stepTimeMs);
	}

	get activeOverlays(): OverlayDef[] {
		if (this.phase !== 'playing' && this.phase !== 'interaction') return [];
		const step = this.currentStep;
		if (!step?.overlays) return [];
		return step.overlays.filter((o) => {
			const start = o.at ?? 0;
			const end = o.until ?? this.stepDurationMs;
			return this.stepTimeMs >= start && this.stepTimeMs <= end;
		});
	}

	get transcriptText(): string {
		if (this.phase === 'playing' || this.phase === 'paused' || this.phase === 'interaction') {
			return this.currentStep?.text ?? '';
		}
		return '';
	}

	/** Continuous section transcript for the ticker (all steps on one line). */
	get transcriptView(): TranscriptView {
		if (this.phase === 'playing' || this.phase === 'paused' || this.phase === 'interaction') {
			const steps = this.currentSection?.steps ?? [];
			if (steps.length === 0) {
				return { tokens: [], activeWordIndex: 0, activeFraction: 0 };
			}
			return buildTranscriptView(steps, this.stepIndex, this.stepProgress);
		}
		return { tokens: [], activeWordIndex: 0, activeFraction: 0 };
	}

	get canInteract(): boolean {
		return this.phase === 'interaction';
	}

	get activeQuestion(): Question | null {
		return this.canInteract ? this.interactionQuestion : null;
	}

	get answers(): Answer[] {
		return this.activeQuestion?.answers ?? [];
	}

	get links(): LinkDef[] {
		return this.activeQuestion?.links ?? [];
	}

	get isRepeatPrompt(): boolean {
		return this.pendingRepeat;
	}

	/**
	 * During an interaction, whether the center "continue" action proceeds into
	 * the end section. The final slide's nav button reads "پایان ارائه" instead
	 * of "ادامه ارائه".
	 */
	get continuesToEnd(): boolean {
		if (this.phase !== 'interaction' || this.pendingRepeat) return false;
		const endIndex = this.indexOfSectionId(END_ID);
		return endIndex >= 0 && this.continueTargetIndex === endIndex;
	}

	/** Runtime section index continueInteraction() would move into (mirrors its resolution). */
	private get continueTargetIndex(): number {
		const section = this.currentSection;
		if (!section) return this.indexOfSectionId(END_ID);
		if (this.stepIndex + 1 < section.steps.length) return this.sectionIndex;
		const nextSectionId = this.resolveNextSectionId(section, this.incomingSectionId);
		if (nextSectionId) {
			return this.indexOfSectionId(nextSectionId);
		}
		// END section, or a section with no explicit next → presentation ends.
		return this.indexOfSectionId(END_ID);
	}

	/** Contact links live on the endSection's question(s). */
	get contactLinks(): LinkDef[] {
		const end = this.scenario?.endSection;
		if (!end) return [];
		const out: LinkDef[] = [];
		for (const step of end.steps) {
			if (step.question?.links) out.push(...step.question.links);
		}
		return out;
	}

	get totalSections(): number {
		return this.scenario?.sections.length ?? 0;
	}

	/** Index into scenario.sections of the current section, or -1 before / N after. */
	get realSectionIndex(): number {
		const section = this.currentSection;
		if (!section) return -1;
		if (section.id === START_ID) return -1;
		if (section.id === END_ID) return this.totalSections;
		return this.scenario?.sections.findIndex((s) => s.id === section.id) ?? -1;
	}

	/** Progress through the current step's clock, 0..1. */
	get stepProgress(): number {
		return this.stepDurationMs > 0 ? Math.min(1, this.stepTimeMs / this.stepDurationMs) : 0;
	}

	/** Progress within the current section, 0..1. */
	get sectionProgress(): number {
		const steps = this.currentSection?.steps.length ?? 0;
		if (steps === 0) return 0;
		const stepFraction = this.stepDurationMs > 0 ? this.stepTimeMs / this.stepDurationMs : 0;
		return Math.min(1, (this.stepIndex + stepFraction) / steps);
	}

	// ---- controls ----------------------------------------------------------

	start() {
		if (!this.scenario) return;
		this.path.reset();
		this.incomingSectionId = null;
		this.pendingRepeatIncomingSectionId = null;
		this.resetLiveState({ backstage: 'off', presentation: 'off', character: 'off' });
		this.characterPresent = false;
		this.startMusic();
		const idx = this.indexOfSectionId(START_ID);
		this.applyStep(idx, 0);
	}

	togglePlay() {
		if (this.phase === 'playing') this.pause();
		else if (this.phase === 'paused') this.play();
	}

	play() {
		if (this.phase === 'paused') {
			this.phase = 'playing';
			this.audio.play();
			this.startLoop();
		}
	}

	pause() {
		if (this.phase === 'playing') {
			this.phase = 'paused';
			this.audio.pause();
		}
	}

	toggleMute() {
		this.muted = !this.muted;
		this.audio.setMuted(this.muted);
		this.music.setMuted(this.muted);
	}

	toggleTheme() {
		this.theme = this.theme === 'dark' ? 'light' : 'dark';
		this.hasSavedTheme = true;
		this.saveTheme(this.theme);
		this.syncThemeClass(this.theme);
	}

	toggleZoom() {
		this.zoom = this.zoom === 'in' ? 'out' : 'in';
	}

	/** Hover/touch on an answer or link can momentarily change the face. */
	setHoverFace(face: Expression | null) {
		this.hoverFace = face;
	}

	nextStep() {
		if (this.phase === 'interaction') {
			this.continueInteraction();
			return;
		}
		this.advanceStep();
	}

	prevStep() {
		if (!this.currentSection) return;
		if (this.stepIndex > 0) this.applyStep(this.sectionIndex, this.stepIndex - 1);
	}

	answerQuestion(answer: Answer) {
		if (!this.scenario) return;
		// A "restart" answer closes the current run (persist + reset) so the next
		// section begins a fresh path with no repeat prompts.
		if (answer.restart) {
			this.path.persist(this.scenario.id);
			this.path.reset();
		}
		if (answer.gotoSectionId) {
			this.goToSectionById(answer.gotoSectionId);
			return;
		}
		this.continueInteraction();
	}

	/** Center nav button while interacting: proceed past the current question. */
	continueInteraction() {
		if (this.pendingRepeat) {
			this.skipRepeat();
			return;
		}
		const section = this.currentSection;
		if (section && this.stepIndex + 1 < section.steps.length) {
			this.applyStep(this.sectionIndex, this.stepIndex + 1);
			return;
		}
		this.onSectionEndDefault(section);
	}

	/** Repeat-detection prompt: confirm replay of the already-seen section. */
	confirmRepeat() {
		if (!this.pendingRepeat) return;
		this.presentSection(this.pendingRepeatIndex, this.pendingRepeatIncomingSectionId);
	}

	/** Repeat-detection prompt: skip ("برو مرحله بعد") without re-presenting. */
	skipRepeat() {
		if (!this.pendingRepeat) return;
		const section = this.runtimeSections[this.pendingRepeatIndex];
		const incomingSectionId = this.pendingRepeatIncomingSectionId;
		this.pendingRepeat = false;
		this.pendingRepeatIncomingSectionId = null;
		this.interactionQuestion = null;
		this.skipRepeatedDefaultsAfter(section ?? null, incomingSectionId);
	}

	/** "تکرار ارائه این بخش" — replay the current section, counting the repeat. */
	repeatSectionForce() {
		const section = this.currentSection;
		if (!this.isRealSection(section ?? undefined)) return;
		this.presentSection(this.sectionIndex, this.incomingSectionId);
	}

	/** Stop the interaction auto-advance countdown (gives more decision time). */
	stopInteractionTimer() {
		this.interactionTimerStopped = true;
	}

	// ---- navigation internals ----------------------------------------------

	private goToSectionById(id: string, incomingSectionId = this.currentRealSectionId()) {
		const idx = this.indexOfSectionId(id);
		if (idx < 0) return;
		const section = this.runtimeSections[idx];
		if (this.isRealSection(section) && this.path.count(section.id) >= 1) {
			this.openRepeatPrompt(idx, incomingSectionId);
			return;
		}
		this.presentSection(idx, incomingSectionId);
	}

	private presentSection(idx: number, incomingSectionId: string | null) {
		const section = this.runtimeSections[idx];
		if (!section) return;
		this.incomingSectionId = incomingSectionId;
		if (this.isRealSection(section)) this.path.record(section.id);
		this.pendingRepeat = false;
		this.pendingRepeatIncomingSectionId = null;
		this.interactionQuestion = null;
		this.applyStep(idx, 0);
	}

	private openRepeatPrompt(idx: number, incomingSectionId: string | null) {
		this.audio.pause();
		this.pendingRepeatIndex = idx;
		this.pendingRepeatIncomingSectionId = incomingSectionId;
		this.pendingRepeat = true;
		this.interactionQuestion = REPEAT_QUESTION;
		this.interactionRemainingMs = DEFAULT_INTERACTION_MS;
		this.interactionTimerStopped = false;
		this.phase = 'interaction';
		this.startLoop();
	}

	private advanceStep() {
		const step = this.currentStep;
		const section = this.currentSection;
		if (!step || !section) return;

		// The end section's question only carries contact links; it never pauses.
		if (step.question && section.id !== END_ID) {
			this.enterInteraction(step.question);
			return;
		}
		if (this.stepIndex + 1 < section.steps.length) {
			this.applyStep(this.sectionIndex, this.stepIndex + 1);
			return;
		}
		this.onSectionEndDefault(section);
	}

	/** After a section's last step, branch to its resolved next section or end. */
	private onSectionEndDefault(section: RuntimeSection | null) {
		const nextSectionId = this.resolveNextSectionId(section, this.incomingSectionId);
		if (nextSectionId) {
			this.goToSectionById(nextSectionId, this.currentRealSectionId());
			return;
		}
		this.end();
	}

	/**
	 * "Skip repeat" should not make the viewer dismiss the same repeat prompt for
	 * every already-seen section in a default chain. Walk forward until the first
	 * real section that has not been presented in this run, or the end section.
	 */
	private skipRepeatedDefaultsAfter(section: RuntimeSection | null, incomingSectionId: string | null) {
		const visited = new Set<number>();
		let skippedSection = section;
		let skippedIncomingSectionId = incomingSectionId;
		let nextIndex = this.defaultNextIndex(skippedSection, skippedIncomingSectionId);

		while (nextIndex >= 0) {
			if (visited.has(nextIndex)) {
				this.end();
				return;
			}
			visited.add(nextIndex);

			const nextSection = this.runtimeSections[nextIndex];
			if (!nextSection) break;
			if (!this.isRealSection(nextSection) || this.path.count(nextSection.id) === 0) {
				this.presentSection(nextIndex, this.realSectionId(skippedSection));
				return;
			}

			skippedIncomingSectionId = this.realSectionId(skippedSection);
			skippedSection = nextSection;
			nextIndex = this.defaultNextIndex(skippedSection, skippedIncomingSectionId);
		}

		this.end();
	}

	private defaultNextIndex(section: RuntimeSection | null, incomingSectionId: string | null): number {
		const nextSectionId = this.resolveNextSectionId(section, incomingSectionId);
		return nextSectionId ? this.indexOfSectionId(nextSectionId) : -1;
	}

	private resolveNextSectionId(
		section: RuntimeSection | null,
		incomingSectionId: string | null
	): string | undefined {
		if (!section || section.id === END_ID) return undefined;
		const override = section.nextSectionIf?.find((rule) => rule.inId === incomingSectionId);
		return override?.outId ?? section.nextSectionId;
	}

	private currentRealSectionId(): string | null {
		return this.realSectionId(this.currentSection);
	}

	private realSectionId(section: RuntimeSection | null | undefined): string | null {
		if (!section) return null;
		return this.isRealSection(section) ? section.id : null;
	}

	private enterInteraction(question: Question) {
		this.audio.pause();
		this.pendingRepeat = false;
		this.interactionQuestion = question;
		this.interactionRemainingMs = question.pause ?? DEFAULT_INTERACTION_MS;
		this.interactionTimerStopped = false;
		this.zoom = 'in';
		this.phase = 'interaction';
		this.startLoop();
	}

	/** Load a specific step and begin playing it. */
	private applyStep(sectionIndex: number, stepIndex: number) {
		const section = this.runtimeSections[sectionIndex];
		const step = section?.steps[stepIndex];
		if (!section || !step) return;

		this.sectionIndex = sectionIndex;
		this.stepIndex = stepIndex;
		this.pendingRepeat = false;
		this.interactionQuestion = null;
		this.hoverFace = null;

		this.stepTimeMs = 0;
		this.stepDurationMs = step.duration;

		this.stepChanges = [...(step.change ?? [])].sort((a, b) => a.time - b.time);
		this.stepChangeCursor = 0;
		this.stepSfx = [...(step.sfx ?? [])].sort((a, b) => a.time - b.time);
		this.stepSfxCursor = 0;

		// Apply anything scheduled at time 0 before the first frame paints.
		this.applyDueChanges(0);

		this.audio.load(step.voice, step.duration);
		this.audio.setMuted(this.muted);
		this.audio.play();
		this.applyDueSfx(0);

		this.phase = 'playing';
		this.startLoop();
	}

	private applyDueChanges(timeMs: number) {
		while (
			this.stepChangeCursor < this.stepChanges.length &&
			this.stepChanges[this.stepChangeCursor].time <= timeMs
		) {
			this.applyChange(this.stepChanges[this.stepChangeCursor].changes);
			this.stepChangeCursor += 1;
		}
	}

	private applyDueSfx(timeMs: number) {
		while (
			this.stepSfxCursor < this.stepSfx.length &&
			this.stepSfx[this.stepSfxCursor].time <= timeMs
		) {
			this.audio.playSfx(this.stepSfx[this.stepSfxCursor].sound);
			this.stepSfxCursor += 1;
		}
	}

	private applyChange(changes: ChangeEvent['changes']) {
		if (changes.slide !== undefined) {
			const idx = this.scenario?.slides.findIndex((s) => s.id === changes.slide) ?? -1;
			if (idx >= 0) this.currentSlide = idx;
		}
		if (changes.camera?.zoom) this.zoom = changes.camera.zoom;
		if (changes.lighting) this.lighting = { ...this.lighting, ...changes.lighting };
		if (changes.character) {
			const ch = changes.character;
			if (ch.face) {
				this.faceShot = ch.face;
				this.faceNonce += 1;
			}
			if (ch.body) {
				this.bodyGesture = ch.body;
				this.bodyNonce += 1;
			}
			if (ch.move) {
				this.locomotion = ch.move;
				this.moveNonce += 1;
				if (ch.move === 'in') this.characterPresent = true;
			}
		}
	}

	private end() {
		this.audio.pause();
		this.stopMusic();
		this.phase = 'ended';
		this.pendingRepeat = false;
		this.interactionQuestion = null;
		this.path.persist(this.scenario?.id ?? 'unknown');
	}

	// ---- live state helpers ------------------------------------------------

	private resetLiveState(lighting: Lighting) {
		this.zoom = 'in';
		this.currentSlide = 0;
		this.lighting = lighting;
		this.faceShot = 'normal';
		this.bodyGesture = 'none';
		this.locomotion = 'none';
		this.hoverFace = null;
		this.interactionQuestion = null;
		this.pendingRepeat = false;
	}

	private startMusic() {
		this.music.setMuted(this.muted);
		this.music.play();
	}

	private stopMusic() {
		this.music.stop();
	}

	// ---- loop --------------------------------------------------------------

	private startLoop() {
		if (typeof requestAnimationFrame === 'undefined') return;
		if (this.rafId !== null) return;
		this.lastFrame = performance.now();
		const loop = (now: number) => {
			// Clamp the delta so a throttled/backgrounded tab (which pauses rAF and
			// resumes with a huge gap) cannot skip whole steps in a single frame.
			const delta = Math.min(now - this.lastFrame, 100);
			this.lastFrame = now;
			this.tick(delta);
			if (this.needsLoop()) {
				this.rafId = requestAnimationFrame(loop);
			} else {
				this.rafId = null;
			}
		};
		this.rafId = requestAnimationFrame(loop);
	}

	private needsLoop() {
		return this.phase === 'playing' || this.phase === 'interaction';
	}

	private tick(delta: number) {
		switch (this.phase) {
			case 'playing':
				this.audio.tick(delta);
				this.stepTimeMs = this.audio.timeMs;
				this.applyDueChanges(this.stepTimeMs);
				this.applyDueSfx(this.stepTimeMs);
				if (this.audio.isFinished) this.advanceStep();
				break;
			case 'interaction':
				if (!this.interactionTimerStopped) {
					this.interactionRemainingMs = Math.max(0, this.interactionRemainingMs - delta);
					if (this.interactionRemainingMs <= 0) this.continueInteraction();
				}
				break;
			default:
				break;
		}
	}

	dispose() {
		if (this.rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
			cancelAnimationFrame(this.rafId);
		}
		this.rafId = null;
		this.audio.dispose();
		this.music.dispose();
	}

	// ---- theme persistence -------------------------------------------------

	private loadSavedTheme(): Theme | null {
		if (typeof localStorage === 'undefined') return null;
		try {
			const saved = localStorage.getItem(THEME_STORAGE_KEY);
			return saved === 'light' || saved === 'dark' ? saved : null;
		} catch {
			return null;
		}
	}

	private saveTheme(theme: Theme) {
		if (typeof localStorage === 'undefined') return;
		try {
			localStorage.setItem(THEME_STORAGE_KEY, theme);
		} catch {
			/* ignore storage errors */
		}
	}

	/** Theme tokens live on `html` so layout chrome outside the stage inherits them. */
	private syncThemeClass(theme: Theme) {
		if (typeof document === 'undefined') return;
		document.documentElement.classList.toggle('theme-dark', theme === 'dark');
		document.documentElement.classList.toggle('theme-light', theme === 'light');
	}
}

function resolveTheme(setting: ThemeSetting): Theme {
	if (setting === 'auto') {
		if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches) {
			return 'dark';
		}
		return 'light';
	}
	return setting;
}
