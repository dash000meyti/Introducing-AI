// Viseme definitions for the placeholder character. Each mouth shape maps to a
// simple drawing primitive. When real sprite sheets arrive, replace `rx/ry/line`
// with the matching sprite frame name for each shape.

import type { MouthShape } from '../engine/types';

export interface MouthGeometry {
	rx: number;
	ry: number;
	/** Draw as a flat line (closed mouth) instead of an ellipse. */
	line?: boolean;
	/** Future: sprite-sheet frame name for this viseme. */
	frame?: string;
}

export const MOUTH_SHAPES: Record<MouthShape, MouthGeometry> = {
	rest: { rx: 12, ry: 2, line: true, frame: 'mouth_rest' },
	mbp: { rx: 14, ry: 1.5, line: true, frame: 'mouth_mbp' },
	ah: { rx: 13, ry: 13, frame: 'mouth_ah' },
	ee: { rx: 18, ry: 4, frame: 'mouth_ee' },
	oh: { rx: 11, ry: 11, frame: 'mouth_oh' },
	oo: { rx: 7, ry: 8, frame: 'mouth_oo' },
	fv: { rx: 14, ry: 3, frame: 'mouth_fv' },
	l: { rx: 10, ry: 7, frame: 'mouth_l' }
};
