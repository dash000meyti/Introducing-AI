// Pure timing helpers used by the PresentationEngine. Kept side-effect free so
// they are trivially testable and reusable by a future LLM-driven sequencer.

import type { MouthShape, Step, Viseme } from './types';

// Synthetic mouth flutter cycle used when a step has no authored visemes.
const SYNTH_VISEMES: MouthShape[] = ['ah', 'rest', 'ee', 'oh', 'rest', 'oo', 'ah', 'rest'];
const SYNTH_FRAME_MS = 110;

/** Resolve the active viseme for a given time (ms) within a step. */
export function resolveMouthShape(step: Step | null, timeMs: number): MouthShape {
	if (!step) return 'rest';

	if (step.visemes && step.visemes.length > 0) {
		return resolveAuthoredViseme(step.visemes, timeMs);
	}

	// Placeholder: synthesise a talking flutter while there is text.
	if (step.text && step.text.trim().length > 0) {
		const frame = Math.floor(timeMs / SYNTH_FRAME_MS) % SYNTH_VISEMES.length;
		return SYNTH_VISEMES[frame];
	}
	return 'rest';
}

function resolveAuthoredViseme(visemes: Viseme[], timeMs: number): MouthShape {
	let shape: MouthShape = 'rest';
	for (const v of visemes) {
		if (v.t <= timeMs) shape = v.shape;
		else break;
	}
	return shape;
}

/** Total number of steps across every section. */
export function countSteps(sections: { steps: unknown[] }[]): number {
	return sections.reduce((sum, s) => sum + s.steps.length, 0);
}
