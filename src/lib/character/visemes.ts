// Maps engine state to the character image files under /assets/character.
//
// The character has two states:
//   - stand: a 360x720 body layer + a 200x200 head layer (top-centre overlay).
//   - move:  a single 360x720 full-body clip (head + body baked into one frame).
//
// Every clip is authored at 12 fps. Faces and the resting body are single
// frames; gestures and the move sequence are ordered frame lists.

import type { Expression, Gesture, MouthShape } from '../engine/types';

const BASE = '/assets/character';

/** Build an ordered list of frame URLs, e.g. `<prefix><sep>001.png`. */
function frames(dir: string, prefix: string, sep: string, count: number): string[] {
	return Array.from(
		{ length: count },
		(_, i) => `${BASE}/${dir}/${prefix}${sep}${String(i + 1).padStart(3, '0')}.png`
	);
}

// ---- standing head (200x200) -------------------------------------------------

const FACE = {
	normal: `${BASE}/stand/face/face-normal.png`,
	mouthA: `${BASE}/stand/face/face-mouth-a.png`,
	mouthE: `${BASE}/stand/face/face-mouth-e.png`,
	mouthO: `${BASE}/stand/face/face-mouth-o.png`,
	mouthFv: `${BASE}/stand/face/face-mouth-fv.png`,
	mouthMbp: `${BASE}/stand/face/face-mouth-mbp.png`,
	happy: `${BASE}/stand/face/face-happy.png`,
	angry: `${BASE}/stand/face/face-angry.png`,
	question: `${BASE}/stand/face/face-question.png`,
	eyesOpen: `${BASE}/stand/face/face-eyes-open.png`,
	eyesHalf: `${BASE}/stand/face/face-eyes-half.png`,
	eyesClosed: `${BASE}/stand/face/face-eyes-closed.png`
} as const;

/** Lip-sync: mouth shape -> head image. `rest` shows the neutral face. */
export const VISEME_FILE: Record<MouthShape, string> = {
	rest: FACE.normal,
	a: FACE.mouthA,
	e: FACE.mouthE,
	o: FACE.mouthO,
	fv: FACE.mouthFv,
	mbp: FACE.mouthMbp
};

/** Resting expression (when not speaking) -> head image. */
export const EXPRESSION_FILE: Record<Expression, string> = {
	normal: FACE.normal,
	happy: FACE.happy,
	angry: FACE.angry,
	question: FACE.question,
	surprised: FACE.eyesOpen
};

/** Automatic blink frames (eyes-open uses the resting expression). */
export const BLINK = {
	half: FACE.eyesHalf,
	closed: FACE.eyesClosed
} as const;

// ---- standing body (360x720) -------------------------------------------------

/** Default standing body (no gesture). */
export const BODY_NORMAL = `${BASE}/stand/body/body-normal.png`;

/** 12-frame gesture loops for the standing body. */
export const GESTURE_FRAMES: Record<Exclude<Gesture, 'none'>, string[]> = {
	both: frames('stand/body', 'both-hand-movements-frame', '-', 12),
	right: frames('stand/body', 'right-hand-movements-frame', '-', 12),
	left: frames('stand/body', 'left-hand-movements-frame', '-', 12)
};

// ---- moving full body (360x720) ----------------------------------------------

/** Move-left clip: accelerate (24) -> stride loop (12) -> decelerate (12). */
export const MOVE_LEFT = {
	start: frames('move/once', 'start-moving-left-frame', '_', 24),
	loop: frames('move/loop', 'continue-moving-left-frame', '_', 12),
	end: frames('move/once', 'end-moving-left-frame', '_', 12)
} as const;

/** A single walk-in pass: start -> one loop cycle -> end (48 frames @ 12 fps). */
export const MOVE_LEFT_SEQUENCE: string[] = [
	...MOVE_LEFT.loop,
	...MOVE_LEFT.end
];

/** All character clips are authored at this frame rate. */
export const CHARACTER_FPS = 12;

/** Wall-clock duration of one full walk-in pass (keep ENTRANCE_MS in sync). */
export const MOVE_LEFT_ENTRANCE_MS = MOVE_LEFT_SEQUENCE.length * (1000 / CHARACTER_FPS);

// ---- preload manifest --------------------------------------------------------

/** Every image the renderer must preload. */
export const ALL_CHARACTER_FILES: string[] = [
	...new Set([
		...Object.values(VISEME_FILE),
		...Object.values(EXPRESSION_FILE),
		BLINK.half,
		BLINK.closed,
		BODY_NORMAL,
		...GESTURE_FRAMES.both,
		...GESTURE_FRAMES.right,
		...GESTURE_FRAMES.left,
		...MOVE_LEFT_SEQUENCE
	])
];
