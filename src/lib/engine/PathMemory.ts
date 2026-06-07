// PathMemory tracks the route a viewer takes through the branchable sections.
//
// It is intentionally a tiny, plain JSON shape so it is trivial to extract and
// analyse later:
//   - `order`: the section ids in the order they were actually presented.
//   - `counts`: how many times each section was presented (0 = never seen,
//     >1 = repeated). Skipping a section ("برو مرحله بعد") does not increment.
//
// Completed runs are appended to a single localStorage array so a sequence of
// sessions can be exported from devtools without any backend.

export interface PathSnapshot {
	order: string[];
	counts: Record<string, number>;
}

export interface CompletedRun extends PathSnapshot {
	scenarioId: string;
	startedAt: number;
	endedAt: number;
}

const STORAGE_KEY = 'introducing-ai.paths';

export class PathMemory {
	private order: string[] = [];
	private counts: Record<string, number> = {};
	private startedAt = Date.now();

	/** Forget the current run (kept in memory only until persisted). */
	reset() {
		this.order = [];
		this.counts = {};
		this.startedAt = Date.now();
	}

	/** Record that a section was presented (appends to order, bumps count). */
	record(sectionId: string) {
		this.order.push(sectionId);
		this.counts[sectionId] = (this.counts[sectionId] ?? 0) + 1;
	}

	/** How many times a section has been presented so far this run. */
	count(sectionId: string): number {
		return this.counts[sectionId] ?? 0;
	}

	snapshot(): PathSnapshot {
		return { order: [...this.order], counts: { ...this.counts } };
	}

	/** Append the current run to the persisted array of completed runs. */
	persist(scenarioId: string) {
		if (typeof localStorage === 'undefined') return;
		try {
			const run: CompletedRun = {
				scenarioId,
				startedAt: this.startedAt,
				endedAt: Date.now(),
				...this.snapshot()
			};
			const raw = localStorage.getItem(STORAGE_KEY);
			const all: CompletedRun[] = raw ? JSON.parse(raw) : [];
			all.push(run);
			localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
		} catch {
			/* ignore storage / serialisation errors */
		}
	}
}
