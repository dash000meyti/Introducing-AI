// AudioController is the master clock for a single step.
//
// To stay robust when placeholder audio files are missing or silent, the
// authoritative timeline is a manual clock advanced by the engine's rAF loop.
// A native <audio> element (when a src is provided) is used purely for sound
// output and is kept loosely in sync. This avoids drift/flakiness from
// half-loaded media while still playing real audio when it exists.

export class AudioController {
	private elapsed = 0; // ms within the current step
	private durationMs = 0;
	private running = false;
	private muted = false;

	private audio: HTMLAudioElement | null = null;
	private currentSrc: string | null = null;
	private activeSfx = new Set<HTMLAudioElement>();

	/** Load the clip for a step. `durationMs` is the fallback/clamp length. */
	load(src: string | undefined, durationMs: number) {
		this.elapsed = 0;
		this.durationMs = Math.max(0, durationMs);
		this.running = false;

		if (src && src !== this.currentSrc) {
			this.disposeAudio();
			if (typeof Audio !== 'undefined') {
				const el = new Audio(src);
				el.preload = 'auto';
				el.muted = this.muted;
				// Missing files should never break playback; we fall back to the clock.
				el.addEventListener('error', () => this.disposeAudio());
				this.audio = el;
				this.currentSrc = src;
			}
		} else if (!src) {
			this.disposeAudio();
		}
	}

	play() {
		this.running = true;
		if (this.audio) {
			try {
				this.audio.currentTime = this.elapsed / 1000;
			} catch {
				/* media not ready yet */
			}
			void this.audio.play().catch(() => {
				/* autoplay blocked / no media: clock keeps running */
			});
		}
	}

	pause() {
		this.running = false;
		this.audio?.pause();
	}

	/** Advance the manual clock. Called every animation frame with deltaMs. */
	tick(deltaMs: number) {
		if (!this.running) return;
		this.elapsed = Math.min(this.elapsed + deltaMs, this.durationMs);
	}

	seek(ms: number) {
		this.elapsed = Math.max(0, Math.min(ms, this.durationMs));
		if (this.audio) {
			try {
				this.audio.currentTime = this.elapsed / 1000;
			} catch {
				/* ignore */
			}
		}
	}

	setMuted(muted: boolean) {
		this.muted = muted;
		if (this.audio) this.audio.muted = muted;
		for (const sfx of this.activeSfx) sfx.muted = muted;
	}

	get isMuted() {
		return this.muted;
	}

	get timeMs() {
		return this.elapsed;
	}

	get duration() {
		return this.durationMs;
	}

	get isRunning() {
		return this.running;
	}

	get isFinished() {
		return this.elapsed >= this.durationMs;
	}

	get progress() {
		return this.durationMs > 0 ? this.elapsed / this.durationMs : 1;
	}

	/** Fire-and-forget ambient sound effect (applause, laughter, ...). */
	playSfx(name: string) {
		if (this.muted || typeof Audio === 'undefined') return;
		try {
			// Support both legacy `/audio/*.mp3` and the preferred `/audio/sfx/*.mp3`.
			const sources = [`/audio/${name}.mp3`, `/audio/sfx/${name}.mp3`];
			const sfx = new Audio(sources[0]);
			sfx.volume = 0.6;
			sfx.muted = this.muted;
			this.activeSfx.add(sfx);
			const cleanup = () => {
				sfx.onended = null;
				sfx.onerror = null;
				this.activeSfx.delete(sfx);
			};
			sfx.onended = cleanup;
			let i = 0;
			sfx.onerror = () => {
				i += 1;
				if (i >= sources.length) {
					cleanup();
					return;
				}
				sfx.src = sources[i];
				void sfx.play().catch(() => {});
			};
			void sfx.play().catch(() => {});
		} catch {
			/* ignore */
		}
	}

	private disposeAudio() {
		if (this.audio) {
			this.audio.pause();
			this.audio.src = '';
			this.audio = null;
		}
		this.currentSrc = null;
	}

	dispose() {
		this.disposeAudio();
		for (const sfx of this.activeSfx) {
			sfx.pause();
			sfx.src = '';
		}
		this.activeSfx.clear();
		this.running = false;
	}
}
