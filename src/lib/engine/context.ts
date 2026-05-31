import { getContext, setContext } from 'svelte';
import { PresentationEngine } from './PresentationEngine.svelte';

const ENGINE_KEY = Symbol('presentation-engine');

export function setEngine(engine: PresentationEngine): PresentationEngine {
	setContext(ENGINE_KEY, engine);
	return engine;
}

export function getEngine(): PresentationEngine {
	const engine = getContext<PresentationEngine>(ENGINE_KEY);
	if (!engine) {
		throw new Error('PresentationEngine context not found. Did you call setEngine() in a parent?');
	}
	return engine;
}
