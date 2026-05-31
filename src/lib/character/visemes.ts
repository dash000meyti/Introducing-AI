// Maps engine state to the provided character image files (in
// /assets/character/<name>.png). The character is sprite/texture based: each
// state is a full-frame face. When the full version arrives, extend these maps.

import type { Emotion, MouthShape } from '../engine/types';

/** Lip-sync: mouth shape -> viseme image filename (without extension). */
export const VISEME_FILE: Record<MouthShape, string> = {
	rest: 'neutral',
	ah: 'viseme-a',
	ee: 'viseme-e',
	oh: 'viseme-o',
	oo: 'viseme-u',
	mbp: 'viseme-m-b-p',
	fv: 'viseme-f-v',
	l: 'viseme-l-n-t-d'
};

/** Resting expression (when not speaking) -> image filename. */
export const EXPRESSION_FILE: Record<Emotion, string> = {
	neutral: 'neutral',
	happy: 'slight-smile',
	thinking: 'focused-slight-smile',
	surprised: 'neutral'
};

/** Blink frames. */
export const BLINK = {
	half: 'blink-half',
	closed: 'blink-closed'
} as const;

/** Every image the renderer needs to preload. */
export const ALL_CHARACTER_FILES: string[] = [
	...new Set([
		...Object.values(VISEME_FILE),
		...Object.values(EXPRESSION_FILE),
		BLINK.half,
		BLINK.closed
	])
];
