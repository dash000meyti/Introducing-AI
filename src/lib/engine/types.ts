// Core data model for the Interactive AI Presentation Platform.
// A Scenario is the single contract every layer consumes. In the MVP it is
// authored by hand (static JSON); in future it can be emitted by an LLM.
//
// v2 shape: Scenario -> slides[] + startSection + sections[] + endSection.
// Every section (start / end / each entry of sections) shares the same shape;
// start and end have no id. A Step choreographs the stage purely through timed
// `change[]` events, so the entrance, lighting-up, and exit are authored in JSON
// instead of being hardcoded in the engine.

/** Resolved, applied theme. */
export type Theme = 'light' | 'dark';
/** Authoring-time theme preference. `auto` follows the browser. */
export type ThemeSetting = 'light' | 'dark' | 'auto';

/** Camera focus. `in` = close-up on the character, `out` = wide on the slide. */
export type Zoom = 'in' | 'out';

/** Backstage lighting presets, one image (or CSS preset) per value, per theme. */
export type BackstageLighting = 'on' | 'off' | 'character' | 'presentation';

/** Presentation lighting: `off` => 10% opacity, `on` => 100% opacity. */
export type PresentationLighting = 'off' | 'on';

/** Character lighting: `off` => theme-coloured silhouette, `on` => normal render. */
export type CharacterLighting = 'off' | 'on';

export interface Lighting {
	backstage: BackstageLighting;
	presentation: PresentationLighting;
	character: CharacterLighting;
}

// The character has two states:
//   - stand: a head layer + a body layer drawn on top of each other.
//   - move: a single full-body clip (head + body in one frame).
// Every clip plays at 12 fps; see CharacterRenderer.

/**
 * Whole-character locomotion (move state). `in` walks the character onto the
 * stage from the right; `out` walks it off to the left. Only used in
 * startSection / endSection so the entrance/exit are not hardcoded.
 */
export type Locomotion = 'none' | 'in' | 'out';

/** Hand-gesture clip for the standing body layer (one-shot, returns to idle). */
export type Gesture = 'none' | 'both' | 'right' | 'left';

/** Facial expression for the standing head layer (one-shot, returns to default). */
export type Expression = 'normal' | 'happy' | 'angry' | 'question' | 'surprised';

/**
 * A viseme keyframe. `t` is milliseconds from the start of the step's audio.
 * `shape` maps to a mouth frame on the standing head layer.
 */
export interface Viseme {
	t: number;
	shape: MouthShape;
}

/** Mouth shapes for lip-sync, drawn on the standing head layer. */
export type MouthShape =
	| 'rest'
	| 'a'
	| 'e'
	| 'o'
	| 'fv' // teeth on lip (f / v)
	| 'mbp'; // closed (m / b / p)

export type OverlayKind = 'popup' | 'tooltip' | 'highlight' | 'callout';

export interface OverlayDef {
	id: string;
	kind: OverlayKind;
	text?: string;
	/** Anchor position as a percentage of the stage, 0..100. */
	x?: number;
	y?: number;
	/** Highlight box size as a percentage of the stage. */
	w?: number;
	h?: number;
	/** ms from step start to appear; defaults to 0. */
	at?: number;
	/** ms from step start to disappear; defaults to step end. */
	until?: number;
}

/** One token in the continuous section transcript ticker. */
export interface TranscriptToken {
	kind: 'word' | 'cue';
	text: string;
	/** Word tokens only: stable index for scroll centring. */
	wordIndex?: number;
	spoken: boolean;
	active: boolean;
	visible: boolean;
}

/** Precomputed transcript state for the Transcript layer. */
export interface TranscriptView {
	tokens: TranscriptToken[];
	activeWordIndex: number;
	activeFraction: number;
}

/** A timed ambient sound effect within a step. */
export interface SfxCue {
	/** ms from step start to fire. */
	time: number;
	/** Sound name, e.g. "applause" | "laughter". */
	sound: string;
}

/** Character mutations carried by a change event. Omitted fields are unchanged. */
export interface CharacterChange {
	/** One-shot facial expression; holds 12 frames then returns to default. */
	face?: Expression;
	/** One-shot body gesture; plays 12 frames then returns to idle. */
	body?: Gesture;
	/** Locomotion (entrance/exit). Only meaningful in start/end sections. */
	move?: Locomotion;
}

export interface CameraChange {
	zoom?: Zoom;
}

/**
 * A timed change applied while a step plays. As the step clock crosses `time`
 * the listed fields are merged into the live stage state; anything omitted keeps
 * its previous value.
 */
export interface ChangeEvent {
	/** ms from step start at which to apply the change. */
	time: number;
	changes: {
		/** Slide id to display (resolved to an index into slides[]). */
		slide?: string;
		character?: CharacterChange;
		camera?: CameraChange;
		lighting?: Partial<Lighting>;
	};
}

/** A preset, branchable answer offered during an interaction. */
export interface Answer {
	id: string;
	label: string;
	/** Section id to jump to when chosen (or "end" for the end section). */
	gotoSectionId?: string;
	/**
	 * When true, the current run is persisted to path memory and a fresh run is
	 * started before navigating. Defaults to false. Lets an ending offer a clean
	 * "restart" without conflating it with the end section, so a scenario can mix
	 * different endings.
	 */
	restart?: boolean;
	/** Optional face shown while the answer is hovered / touch-held. */
	face?: Expression;
}

/** An external link offered during an interaction. */
export interface LinkDef {
	id: string;
	label: string;
	url: string;
	/** Optional icon name for the link. */
	icon?: string;
	/** Optional face shown while the link is hovered / touch-held. */
	face?: Expression;
}

/** An interaction prompt shown at a step: a question with answers and/or links. */
export interface Question {
	title: string;
	answers?: Answer[];
	links?: LinkDef[];
	/** ms from step start to show the question while the step keeps playing. */
	showOnTime?: number;
	/** Auto-advance countdown in ms. Falls back to the engine default. */
	pause?: number;
}

/** A single beat of the presentation. */
export interface Step {
	id: string;
	/** Spoken transcript text shown in the Transcript layer. */
	text: string;
	/** Fallback / minimum duration in ms (used when there is no audio). */
	duration: number;
	/** Audio file URL. When absent the step runs on `duration` alone. */
	voice?: string;
	/** Non-speech note shown before the spoken text (not read aloud). */
	startCue?: string;
	/** Non-speech note shown after the spoken text (not read aloud). */
	endCue?: string;
	/** Timed sound effects. */
	sfx?: SfxCue[];
	/** Timed stage changes (slide / character / camera / lighting). */
	change?: ChangeEvent[];
	/** Interaction prompt shown when the step completes. */
	question?: Question;
	overlays?: OverlayDef[];
	visemes?: Viseme[];
}

/** Conditional default branch chosen by the section visited immediately before this one. */
export interface NextSectionCondition {
	/** Previous section id that led into the current section. */
	inId: string;
	/** Section id to visit instead of nextSectionId when inId matches. */
	outId: string;
}

/** Shared section shape. startSection / endSection use this (no id). */
export interface SectionTemplate {
	title: string;
	steps: Step[];
	/** Default branch to this section id after the last step (or "end"). */
	nextSectionId?: string;
	/** Optional overrides for the default branch based on the incoming section id. */
	nextSectionIf?: NextSectionCondition[];
}

/** A regular, addressable section of the presentation. */
export interface Section extends SectionTemplate {
	id: string;
}

/** Slide layout template (was `kind`). */
export type SlideTemplate = 'title' | 'text' | 'image' | 'grid' | 'video';

/** A presentation slide rendered by the Presentation (Reveal.js) layer. */
export interface SlideDef {
	id: string;
	/** Layout template selecting which fields render. */
	theme?: SlideTemplate;
	title?: string;
	subtitle?: string;
	body?: string;
	bullets?: string[];
	/** Single image URL (template: 'image'). */
	image?: string;
	/** Image URLs for a grid (template: 'grid'). */
	images?: string[];
	/** Video URL (template: 'video'). */
	video?: string;
	/** Optional display duration hint (ms). */
	duration?: number;
}

export interface Scenario {
	id: string;
	title: string;
	description?: string;
	/** Starting theme preference. */
	theme: ThemeSetting;
	/** Background music URL; plays from startSection start to endSection end. */
	music?: string;
	/** Slide deck, referenced by `ChangeEvent.changes.slide` (by id). */
	slides: SlideDef[];
	/** Intro section: choreographs the entrance / lighting-up via change[]. */
	startSection: SectionTemplate;
	/** The branchable body of the presentation. */
	sections: Section[];
	/** Outro section: choreographs the exit and reveals contact links. */
	endSection: SectionTemplate;
}

/** High-level lifecycle of a presentation run. */
export type PresentationPhase =
	| 'landing'
	| 'playing'
	| 'paused'
	| 'interaction' // waiting at a question
	| 'ended';
