// PresentationEngine: the single source of truth that orchestrates every layer.
//
// One requestAnimationFrame loop advances the master clock (AudioController),
// drives lip-sync visemes, transcript, overlays, and step/section transitions.
// Every layer is a pure consumer of the reactive state exposed here, so a
// future LLM-driven run only needs to feed in a different Scenario.

import { AudioController } from './AudioController';
import { resolveMouthShape } from './Timeline';
import type {
	BodyAnimation,
	Emotion,
	Lighting,
	MouthShape,
	OverlayDef,
	PresentationPhase,
	PresetQuestion,
	Scenario,
	Section,
	Step,
	Theme,
	Zoom
} from './types';

const INTRO_MS = 2200; // room darkens, first slide + title appear
const ENTRANCE_MS = 2600; // character walks in under the spotlight

export class PresentationEngine {
	scenario = $state<Scenario | null>(null);
	phase = $state<PresentationPhase>('landing');
	sectionIndex = $state(0);
	stepIndex = $state(0);

	// User-controllable state.
	theme = $state<Theme>('dark');
	zoom = $state<Zoom>('out');
	muted = $state(false);

	// Live clock state.
	stepTimeMs = $state(0);
	stepDurationMs = $state(0);
	currentSlide = $state(0);
	interactionRemainingMs = $state(0);

	private phaseElapsed = 0;
	private audio = new AudioController();
	private rafId: number | null = null;
	private lastFrame = 0;

	// ---- setup -------------------------------------------------------------

	setScenario(scenario: Scenario) {
		this.scenario = scenario;
		this.theme = scenario.theme;
		this.sectionIndex = 0;
		this.stepIndex = 0;
		this.currentSlide = 0;
		this.phase = 'landing';
	}

	// ---- derived view (consumed by layers) ---------------------------------

	get currentSection(): Section | null {
		return this.scenario?.sections[this.sectionIndex] ?? null;
	}

	get currentStep(): Step | null {
		return this.currentSection?.steps[this.stepIndex] ?? null;
	}

	get isPlaying() {
		return this.phase === 'playing';
	}

	get sectionTitle(): string {
		if (this.phase === 'landing') return this.scenario?.title ?? '';
		return this.currentSection?.title ?? '';
	}

	get characterVisible(): boolean {
		return this.phase !== 'landing' && this.phase !== 'intro';
	}

	get lighting(): Lighting {
		switch (this.phase) {
			case 'landing':
				return { backstage: 'allOn', presentation: 'off', character: 'off' };
			case 'intro':
				return { backstage: 'presentation', presentation: 'on', character: 'off' };
			case 'entrance':
				return { backstage: 'stage', presentation: 'on', character: 'on' };
			case 'ended':
				return { backstage: 'allOn', presentation: 'on', character: 'on' };
			default:
				return (
					this.currentStep?.lighting ?? {
						backstage: 'stage',
						presentation: 'on',
						character: 'on'
					}
				);
		}
	}

	get body(): BodyAnimation {
		if (this.phase === 'entrance') return 'walkIn';
		if (this.phase === 'ended') return 'wave';
		if (this.phase === 'playing' || this.phase === 'paused' || this.phase === 'interaction') {
			return this.currentStep?.body ?? 'idle';
		}
		return 'idle';
	}

	get emotion(): Emotion {
		return this.currentStep?.emotion ?? 'neutral';
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
		if (this.phase === 'ended') return this.scenario?.subtitle ?? '';
		return '';
	}

	get transcriptCue(): string | undefined {
		if (this.phase === 'playing' || this.phase === 'interaction') return this.currentStep?.cue;
		return undefined;
	}

	get canInteract(): boolean {
		return this.phase === 'interaction';
	}

	get currentQuestions(): PresetQuestion[] {
		return this.canInteract ? (this.currentSection?.questions ?? []) : [];
	}

	get totalSections(): number {
		return this.scenario?.sections.length ?? 0;
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

	/** Progress across the whole presentation, 0..1. */
	get overallProgress(): number {
		if (!this.scenario) return 0;
		let total = 0;
		let done = 0;
		this.scenario.sections.forEach((section, si) => {
			section.steps.forEach((_, sti) => {
				total += 1;
				if (si < this.sectionIndex || (si === this.sectionIndex && sti < this.stepIndex)) {
					done += 1;
				} else if (si === this.sectionIndex && sti === this.stepIndex) {
					done += this.stepDurationMs > 0 ? this.stepTimeMs / this.stepDurationMs : 0;
				}
			});
		});
		return total > 0 ? done / total : 0;
	}

	// ---- controls ----------------------------------------------------------

	start() {
		if (!this.scenario) return;
		this.sectionIndex = 0;
		this.stepIndex = 0;
		this.currentSlide = 0;
		this.phaseElapsed = 0;
		this.phase = 'intro';
		this.startLoop();
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
	}

	toggleTheme() {
		this.theme = this.theme === 'dark' ? 'light' : 'dark';
	}

	toggleZoom() {
		this.zoom = this.zoom === 'in' ? 'out' : 'in';
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
		if (this.stepIndex > 0) {
			this.applyStep(this.sectionIndex, this.stepIndex - 1);
		} else if (this.sectionIndex > 0) {
			const prevSection = this.scenario!.sections[this.sectionIndex - 1];
			this.applyStep(this.sectionIndex - 1, prevSection.steps.length - 1);
		}
	}

	/** Replay the current section from its first step. */
	repeatSection() {
		this.applyStep(this.sectionIndex, 0);
	}

	/** Jump to the start of a section by index (used by the progress timeline). */
	goToSection(index: number) {
		if (!this.scenario) return;
		if (index < 0 || index >= this.scenario.sections.length) return;
		this.applyStep(index, 0);
	}

	answerQuestion(q: PresetQuestion) {
		if (!this.scenario) return;
		if (q.gotoSectionId) {
			const target = this.scenario.sections.findIndex((s) => s.id === q.gotoSectionId);
			if (target >= 0) {
				this.applyStep(target, 0);
				return;
			}
		}
		this.continueInteraction();
	}

	continueInteraction() {
		const nextSection = this.sectionIndex + 1;
		if (nextSection < (this.scenario?.sections.length ?? 0)) {
			this.applyStep(nextSection, 0);
		} else {
			this.end();
		}
	}

	restart() {
		this.audio.dispose();
		this.audio = new AudioController();
		this.audio.setMuted(this.muted);
		this.stepTimeMs = 0;
		this.stepDurationMs = 0;
		this.start();
	}

	// ---- internals ---------------------------------------------------------

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
		return (
			this.phase === 'intro' ||
			this.phase === 'entrance' ||
			this.phase === 'playing' ||
			this.phase === 'interaction'
		);
	}

	private tick(delta: number) {
		switch (this.phase) {
			case 'intro':
				this.phaseElapsed += delta;
				if (this.phaseElapsed >= INTRO_MS) this.enterEntrance();
				break;
			case 'entrance':
				this.phaseElapsed += delta;
				if (this.phaseElapsed >= ENTRANCE_MS) this.beginPlayback();
				break;
			case 'playing':
				this.audio.tick(delta);
				this.stepTimeMs = this.audio.timeMs;
				if (this.audio.isFinished) this.advanceStep();
				break;
			case 'interaction':
				this.interactionRemainingMs = Math.max(0, this.interactionRemainingMs - delta);
				if (this.interactionRemainingMs <= 0) this.continueInteraction();
				break;
			default:
				break;
		}
	}

	private enterEntrance() {
		this.phaseElapsed = 0;
		this.phase = 'entrance';
		this.zoom = 'in';
	}

	private beginPlayback() {
		this.applyStep(0, 0);
	}

	/** Load a specific step and begin playing it. */
	private applyStep(sectionIndex: number, stepIndex: number) {
		const section = this.scenario?.sections[sectionIndex];
		const step = section?.steps[stepIndex];
		if (!section || !step) return;

		this.sectionIndex = sectionIndex;
		this.stepIndex = stepIndex;
		if (typeof step.slide === 'number') this.currentSlide = step.slide;
		this.zoom = step.zoom;

		this.stepTimeMs = 0;
		this.stepDurationMs = step.duration;
		this.audio.load(step.audio, step.duration);
		this.audio.setMuted(this.muted);
		this.audio.play();

		if (step.sfx) for (const name of step.sfx) this.audio.playSfx(name);

		this.phase = 'playing';
		this.startLoop();
	}

	private advanceStep() {
		const section = this.currentSection;
		if (!section) return;

		if (this.stepIndex + 1 < section.steps.length) {
			this.applyStep(this.sectionIndex, this.stepIndex + 1);
			return;
		}

		// End of section: pause for interaction if configured.
		if (section.interactionPause && section.interactionPause > 0) {
			this.enterInteraction(section.interactionPause);
			return;
		}
		this.continueInteraction();
	}

	private enterInteraction(pauseMs: number) {
		this.audio.pause();
		this.interactionRemainingMs = pauseMs;
		this.phase = 'interaction';
		this.startLoop();
	}

	private end() {
		this.audio.pause();
		this.phase = 'ended';
		this.zoom = 'out';
	}

	dispose() {
		if (this.rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
			cancelAnimationFrame(this.rafId);
		}
		this.rafId = null;
		this.audio.dispose();
	}
}
