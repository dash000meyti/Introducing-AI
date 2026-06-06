// Pure timing helpers used by the PresentationEngine. Kept side-effect free so
// they are trivially testable and reusable by a future LLM-driven sequencer.

import { MOVE_LEFT_ENTRANCE_MS } from '../character/visemes';
import type { MouthShape, Step, TranscriptToken, TranscriptView, Viseme } from './types';

export { MOVE_LEFT_ENTRANCE_MS };

// Synthetic mouth flutter cycle used when a step has no authored visemes.
const SYNTH_VISEMES: MouthShape[] = ['a', 'rest', 'e', 'o', 'rest', 'mbp', 'fv', 'rest'];
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

function splitWords(text: string): string[] {
	return text.length ? text.split(/\s+/).filter(Boolean) : [];
}

/** Map step progress (0..1) onto a local word index + intra-word fraction. */
export function resolveWordProgress(
	words: string[],
	text: string,
	stepProgress: number
): { activeIndex: number; activeFraction: number } {
	if (words.length === 0) return { activeIndex: 0, activeFraction: 0 };

	const readChars = text.length * stepProgress;
	const starts: number[] = [];
	let pos = 0;
	for (const w of words) {
		starts.push(pos);
		pos += w.length + 1;
	}

	let activeIndex = 0;
	for (let i = 0; i < starts.length; i++) {
		if (starts[i] <= readChars) activeIndex = i;
		else break;
	}

	const w = words[activeIndex];
	const into = readChars - starts[activeIndex];
	const activeFraction = w ? Math.min(1, Math.max(0, into / w.length)) : 0;
	return { activeIndex, activeFraction };
}

/**
 * Build a continuous section transcript: all steps on one line, with karaoke
 * progress flowing across step boundaries instead of resetting each beat.
 */
export function buildTranscriptView(
	steps: Step[],
	stepIndex: number,
	stepProgress: number
): TranscriptView {
	const safeIndex = Math.min(Math.max(stepIndex, 0), Math.max(steps.length - 1, 0));

	let wordOffset = 0;
	for (let si = 0; si < safeIndex; si++) {
		wordOffset += splitWords(steps[si]?.text ?? '').length;
	}

	const currentStep = steps[safeIndex];
	const currentWords = splitWords(currentStep?.text ?? '');
	const currentText = currentStep?.text ?? '';
	const { activeIndex: localActive, activeFraction } = resolveWordProgress(
		currentWords,
		currentText,
		stepProgress
	);
	const activeWordIndex = wordOffset + localActive;
	const onLastWord = currentWords.length > 0 && localActive >= currentWords.length - 1;

	const tokens: TranscriptToken[] = [];
	let wordIndex = 0;

	for (let si = 0; si < steps.length; si++) {
		const step = steps[si];
		const words = splitWords(step.text ?? '');

		for (const word of words) {
			tokens.push({
				kind: 'word',
				text: word,
				wordIndex,
				spoken: wordIndex <= activeWordIndex,
				active: wordIndex === activeWordIndex,
				visible: true
			});
			wordIndex += 1;
		}

		if (step.cue && si <= safeIndex) {
			const cueSpoken =
				si < safeIndex ||
				(si === safeIndex &&
					(stepProgress >= 1 ||
						(onLastWord && (activeFraction >= 0.6 || stepProgress >= 0.9))));
			tokens.push({
				kind: 'cue',
				text: step.cue,
				spoken: cueSpoken,
				active: false,
				visible: true
			});
		}
	}

	return { tokens, activeWordIndex, activeFraction };
}
