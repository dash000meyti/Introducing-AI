// CharacterRenderer draws the virtual presenter with PixiJS.
//
// The character is sprite/texture based: the provided images are full-frame
// faces and only the face/mouth changes between them. For now the figure is
// static (no walking, no arm/hand motion) - the only animation is swapping the
// face texture (lip-sync visemes + simple emotions) plus an automatic blink.
//
// The public API (init / setView / resize / destroy) is sprite-agnostic, so the
// future "full version" only changes the private draw/animate internals.

import { Application, Assets, ColorMatrixFilter, Sprite, Texture } from 'pixi.js';
import type { BodyAnimation, Emotion, MouthShape, Theme } from '../engine/types';
import { ALL_CHARACTER_FILES, BLINK, EXPRESSION_FILE, VISEME_FILE } from './visemes';

export interface CharacterView {
	body?: BodyAnimation; // accepted for API stability; locomotion is not used yet
	mouth: MouthShape;
	emotion: Emotion;
	lit: boolean;
	theme: Theme;
	visible: boolean;
	/** True while the character is actively speaking (drives lip-sync). */
	speaking: boolean;
}

const THEME_SILHOUETTE: Record<Theme, number> = {
	dark: 0x05060a,
	light: 0xf2f0ec
};

const ENTRANCE_FADE_MS = 450;
const BLINK_MIN_GAP = 2500;
const BLINK_MAX_GAP = 5000;
const BLINK_HALF_MS = 55;
const BLINK_CLOSED_MS = 90;

type BlinkPhase = 'idle' | 'closing' | 'closed' | 'opening';

export class CharacterRenderer {
	private app: Application | null = null;
	private host: HTMLElement | null = null;
	private sprite: Sprite | null = null;
	private textures = new Map<string, Texture>();
	private filter = new ColorMatrixFilter();

	private view: CharacterView = {
		mouth: 'rest',
		emotion: 'neutral',
		lit: true,
		theme: 'dark',
		visible: false,
		speaking: false
	};

	private currentFile = '';
	private blinkPhase: BlinkPhase = 'idle';
	private blinkElapsed = 0;
	private blinkCooldown = randomGap();

	async init(host: HTMLElement) {
		this.host = host;
		const app = new Application();
		await app.init({
			backgroundAlpha: 0,
			antialias: true,
			resolution: Math.min(window.devicePixelRatio || 1, 2),
			autoDensity: true,
			width: host.clientWidth || 360,
			height: host.clientHeight || 700
		});
		this.app = app;
		host.appendChild(app.canvas);

		const urls = ALL_CHARACTER_FILES.map((f) => `/assets/character/${f}.png`);
		await Assets.load(urls);
		for (const f of ALL_CHARACTER_FILES) {
			this.textures.set(f, Assets.get(`/assets/character/${f}.png`));
		}

		const sprite = new Sprite(this.textures.get('neutral'));
		sprite.anchor.set(0.5, 1);
		sprite.alpha = 0;
		sprite.visible = false;
		this.sprite = sprite;
		this.currentFile = 'neutral';
		app.stage.addChild(sprite);

		this.applyLighting();
		this.layout();

		app.ticker.add((ticker) => this.update(ticker.deltaMS));
	}

	setView(next: Partial<CharacterView>) {
		const prev = this.view;
		this.view = { ...prev, ...next };

		if (this.view.lit !== prev.lit || this.view.theme !== prev.theme) {
			this.applyLighting();
		}
		// Restart the entrance fade when the character (re)appears.
		if (this.view.visible && !prev.visible && this.sprite) {
			this.sprite.alpha = 0;
		}
	}

	private applyLighting() {
		if (!this.sprite) return;
		if (this.view.lit) {
			this.sprite.filters = [];
			return;
		}
		const c = THEME_SILHOUETTE[this.view.theme];
		const r = ((c >> 16) & 0xff) / 255;
		const g = ((c >> 8) & 0xff) / 255;
		const b = (c & 0xff) / 255;
		// Flatten RGB to a constant colour while preserving alpha -> silhouette.
		this.filter.matrix = [0, 0, 0, 0, r, 0, 0, 0, 0, g, 0, 0, 0, 0, b, 0, 0, 0, 1, 0];
		this.sprite.filters = [this.filter];
	}

	private update(deltaMs: number) {
		const sprite = this.sprite;
		if (!sprite) return;

		sprite.visible = this.view.visible;
		if (!this.view.visible) return;

		// Entrance fade-in.
		if (sprite.alpha < 1) {
			sprite.alpha = Math.min(1, sprite.alpha + deltaMs / ENTRANCE_FADE_MS);
		}

		this.tickBlink(deltaMs);
		this.setTexture(this.resolveFile());
	}

	private tickBlink(deltaMs: number) {
		// Blink only while not speaking, to avoid closing the mouth mid-syllable.
		if (this.view.speaking) {
			this.blinkPhase = 'idle';
			this.blinkCooldown = randomGap();
			return;
		}

		if (this.blinkPhase === 'idle') {
			this.blinkCooldown -= deltaMs;
			if (this.blinkCooldown <= 0) {
				this.blinkPhase = 'closing';
				this.blinkElapsed = 0;
			}
			return;
		}

		this.blinkElapsed += deltaMs;
		switch (this.blinkPhase) {
			case 'closing':
				if (this.blinkElapsed >= BLINK_HALF_MS) {
					this.blinkPhase = 'closed';
					this.blinkElapsed = 0;
				}
				break;
			case 'closed':
				if (this.blinkElapsed >= BLINK_CLOSED_MS) {
					this.blinkPhase = 'opening';
					this.blinkElapsed = 0;
				}
				break;
			case 'opening':
				if (this.blinkElapsed >= BLINK_HALF_MS) {
					this.blinkPhase = 'idle';
					this.blinkCooldown = randomGap();
				}
				break;
		}
	}

	/** Resolve the active image filename by priority: blink > speaking > emotion. */
	private resolveFile(): string {
		if (this.blinkPhase === 'closed') return BLINK.closed;
		if (this.blinkPhase === 'closing' || this.blinkPhase === 'opening') return BLINK.half;
		if (this.view.speaking) return VISEME_FILE[this.view.mouth] ?? 'neutral';
		return EXPRESSION_FILE[this.view.emotion] ?? 'neutral';
	}

	private setTexture(file: string) {
		if (file === this.currentFile || !this.sprite) return;
		const tex = this.textures.get(file);
		if (!tex) return;
		this.sprite.texture = tex;
		this.currentFile = file;
	}

	private layout() {
		if (!this.app || !this.host || !this.sprite) return;
		const w = this.host.clientWidth || 360;
		const h = this.host.clientHeight || 700;
		this.app.renderer.resize(w, h);

		const texH = this.sprite.texture.height || 1;
		// Sized and placed so the figure stands on the stage disc in the artwork.
		this.sprite.scale.set((h * 0.6) / texH);
		this.sprite.position.set(w / 2, h * 0.88);
	}

	resize() {
		this.layout();
	}

	destroy() {
		if (this.app) {
			this.app.destroy(true, { children: true });
			this.app = null;
		}
		this.sprite = null;
	}
}

function randomGap(): number {
	return BLINK_MIN_GAP + Math.random() * (BLINK_MAX_GAP - BLINK_MIN_GAP);
}
