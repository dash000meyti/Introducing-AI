import type { Scenario } from '$lib/engine/types';

/** Fetch a presentation scenario from /static/data/presentations/<id>.json. */
export async function loadScenario(id = 'intro', fetchFn: typeof fetch = fetch): Promise<Scenario> {
	const res = await fetchFn(`/data/presentations/${id}.json`);
	if (!res.ok) {
		throw new Error(`Failed to load scenario "${id}": ${res.status}`);
	}
	return (await res.json()) as Scenario;
}
