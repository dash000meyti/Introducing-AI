// Core data model for the Interactive AI Presentation Platform.
// A Scenario is the single contract every layer consumes. In the MVP it is
// authored by hand (static JSON); in future it can be emitted by an LLM.

export type Theme = 'light' | 'dark';

/** Camera focus. `in` = close-up on the character, `out` = wide on the slide. */
export type Zoom = 'in' | 'out';

/** Backstage lighting presets, one image (or CSS preset) per value, per theme. */
export type BackstageLighting = 'allOff' | 'allOn' | 'stage' | 'presentation';

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

/** Whole-character locomotion (move state). Only "left" art is provided. */
export type Locomotion = 'none' | 'left';

/** Hand-gesture clip for the standing body layer. */
export type Gesture = 'none' | 'both' | 'right' | 'left';

/** Facial expression for the standing head layer (mutually exclusive faces). */
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

/** A single beat of the presentation. */
export interface Step {
	id: string;
	/** Spoken transcript text shown in the Transcript layer. */
	text: string;
	/** Optional non-speech cue shown in the transcript, e.g. "[applause]". */
	cue?: string;
	/** Audio file URL. When absent the step runs on `duration` alone. */
	audio?: string;
	/** Fallback / minimum duration in ms (used when there is no audio). */
	duration: number;
	visemes?: Viseme[];
	/** Hand-gesture clip for the standing body. Defaults to "none". */
	gesture?: Gesture;
	/** Facial expression for the standing head. Defaults to "normal". */
	expression?: Expression;
	/** Reveal.js horizontal slide index this step displays. */
	slide?: number;
	overlays?: OverlayDef[];
	lighting: Lighting;
	zoom: Zoom;
	/** Ambient sound effects to trigger, e.g. ["applause"]. */
	sfx?: string[];
}

/** A preset, branchable question offered during an interaction pause. */
export interface PresetQuestion {
	id: string;
	label: string;
	/** Section id to jump to when chosen. Omit to simply continue. */
	gotoSectionId?: string;
}

export interface Section {
	id: string;
	title: string;
	steps: Step[];
	/** ms to wait at the end of the section for interaction (0 = none). */
	interactionPause?: number;
	questions?: PresetQuestion[];
}

/** A presentation slide rendered by the Presentation (Reveal.js) layer. */
export interface SlideDef {
	id: string;
	kind?: 'title' | 'text' | 'image' | 'grid';
	title?: string;
	subtitle?: string;
	body?: string;
	bullets?: string[];
	/** Single image URL (kind: 'image'). */
	image?: string;
	/** Image URLs for a grid (kind: 'grid'). */
	images?: string[];
}

export interface Scenario {
	id: string;
	title: string;
	subtitle?: string;
	/** Starting theme. */
	theme: Theme;
	/** Slide deck, referenced by `Step.slide` (index into this array). */
	slides: SlideDef[];
	sections: Section[];
}

/** High-level lifecycle of a presentation run. */
export type PresentationPhase =
	| 'landing'
	| 'intro' // darken + first slide + title
	| 'entrance' // character walks in
	| 'playing'
	| 'paused'
	| 'interaction' // waiting at end of a section
	| 'ended';
