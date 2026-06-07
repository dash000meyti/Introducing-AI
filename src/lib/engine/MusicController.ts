// MusicController plays a single looping background track for the presentation.
//
// The engine starts it when the run begins (startSection) and stops it when the
// run ends (endSection). It is independent of the per-step AudioController clock
// and simply respects the global mute flag.

export class MusicController {
	private audio: HTMLAudioElement | null = null;
	private src: string | null = null;
	private muted = false;

	/** Point at a track (does not start playback). */
	load(src: string | undefined) {
		if (!src) {
			this.stop();
			this.src = null;
			return;
		}
		if (src === this.src && this.audio) return;
		this.disposeAudio();
		this.src = src;
		if (typeof Audio === 'undefined') return;
		const el = new Audio(src);
		el.loop = true;
		el.preload = 'auto';
		el.volume = 0.35;
		el.muted = this.muted;
		el.addEventListener('error', () => this.disposeAudio());
		this.audio = el;
	}

	play() {
		if (!this.audio) return;
		void this.audio.play().catch(() => {
			/* autoplay blocked / no media */
		});
	}

	stop() {
		if (!this.audio) return;
		try {
			this.audio.pause();
			this.audio.currentTime = 0;
		} catch {
			/* media not ready */
		}
	}

	setMuted(muted: boolean) {
		this.muted = muted;
		if (this.audio) this.audio.muted = muted;
	}

	private disposeAudio() {
		if (this.audio) {
			this.audio.pause();
			this.audio.src = '';
			this.audio = null;
		}
	}

	dispose() {
		this.disposeAudio();
		this.src = null;
	}
}
