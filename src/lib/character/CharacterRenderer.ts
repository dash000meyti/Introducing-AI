// CharacterRenderer draws the virtual presenter with PixiJS.
//
// The character has two states, all clips authored at 12 fps:
//   - stand: two layers drawn on top of each other - a 360x720 body and a
//     200x200 head pinned to the body's top-centre. The body either holds its
//     resting pose or loops a hand-gesture clip; the head shows lip-sync
//     visemes, an expression, or an automatic blink.
//   - move:  a single 360x720 full-body clip (head + body in one frame) that
//     plays start -> stride -> stop once and holds on the final standing frame.
//
// The public API (init / setView / resize / destroy) is intentionally
// state-agnostic so the engine/layer can stay a pure consumer.

import { Application, Assets, ColorMatrixFilter, Container, Sprite, Texture } from 'pixi.js';
import type { Expression, Gesture, Locomotion, MouthShape, Theme } from '../engine/types';
import {
	ALL_CHARACTER_FILES,
	BLINK,
	BODY_NORMAL,
	EXPRESSION_FILE,
	GESTURE_FRAMES,
	MOVE_LEFT_SEQUENCE,
	VISEME_FILE
} from './visemes';

export interface CharacterView {
	/** Whole-character movement; non-"none" switches to the move clip. */
	locomotion: Locomotion;
	/** Standing head: active mouth shape (used while speaking). */
	mouth: MouthShape;
	/** Standing head: resting expression (used while not speaking). */
	expression: Expression;
	/** Standing body: hand-gesture loop ("none" = resting pose). */
	gesture: Gesture;
	/** True while actively speaking (drives lip-sync over the expression). */
	speaking: boolean;
	lit: boolean;
	theme: Theme;
	visible: boolean;
}

const THEME_SILHOUETTE: Record<Theme, number> = {
	dark: 0x05060a,
	light: 0xf2f0ec
};

// Native artwork dimensions (px).
const BODY_W = 360;
const BODY_H = 720;
const HEAD = 200;

const FPS = 12;
const FRAME_MS = 1000 / FPS;

// The whole stage (including this canvas) is CSS-scaled by the camera in
// `IntroducingLayer.svelte` (zoom-in = scale(1.88)). A canvas is a fixed-size
// bitmap, so CSS-magnifying it makes the figure look blocky/pixelated. We
// pre-render the backing store at the camera's max zoom so it stays crisp even
// when the browser scales the canvas element up. Keep this in sync with the
// largest camera `scale(...)` value in IntroducingLayer.
const CAMERA_MAX_ZOOM = 1.88;

const ENTRANCE_FADE_MS = 450;
const BLINK_MIN_GAP = 2500;
const BLINK_MAX_GAP = 5000;
const BLINK_HALF_MS = 55;
const BLINK_CLOSED_MS = 90;

type BlinkPhase = 'idle' | 'closing' | 'closed' | 'opening';

export class CharacterRenderer {
	// ---- layout tuning (align the figure with the painted stage) ---------------
	/** Figure height as a fraction of the full-stage height (0–1). */
	static readonly FIGURE_H = 0.28;
	/** Vertical anchor: feet position as a fraction of stage height (0 = top). */
	static readonly FEET_Y = 0.845;
	/** Extra gap past the right edge when the walk-in begins (fraction of width). */
	static readonly ENTRANCE_MARGIN = 0.05;

	private app: Application | null = null;
	private host: HTMLElement | null = null;

	private root = new Container();
	private stand = new Container();
	private bodySprite: Sprite | null = null;
	private faceSprite: Sprite | null = null;
	private moveSprite: Sprite | null = null;

	private textures = new Map<string, Texture>();
	private filter = new ColorMatrixFilter();

	private view: CharacterView = {
		locomotion: 'none',
		mouth: 'rest',
		expression: 'normal',
		gesture: 'none',
		speaking: false,
		lit: true,
		theme: 'light',
		visible: false
	};

	// Per-clip frame cursors.
	private bodyFrame = 0;
	private bodyTimer = 0;
	private lastGesture: Gesture = 'none';
	private moveFrame = 0;
	private moveTimer = 0;

	// Entrance fade + slide progress.
	private walkElapsed = 0;

	private blinkPhase: BlinkPhase = 'idle';
	private blinkElapsed = 0;
	private blinkCooldown = randomGap();

	private currentFace = '';
	private currentBody = '';
	private currentMove = '';

	async init(host: HTMLElement) {
		this.host = host;
		const app = new Application();
		await app.init({
			backgroundAlpha: 0,
			antialias: true,
			// Render at the device's true pixel density, multiplied by the camera's
			// max zoom, so the figure stays crisp on high-DPR phones AND while the
			// camera CSS-magnifies the canvas (otherwise the bitmap looks blocky).
			// Clamped to bound the backing-store memory on unusual high-DPR devices.
			resolution: Math.min((window.devicePixelRatio || 1) * CAMERA_MAX_ZOOM, 6),
			autoDensity: true,
			width: host.clientWidth || 360,
			height: host.clientHeight || 720
		});
		this.app = app;
		host.appendChild(app.canvas);

		await Assets.load(ALL_CHARACTER_FILES);
		for (const url of ALL_CHARACTER_FILES) this.textures.set(url, Assets.get(url));

		// Standing layers: body fills 360x720, head pinned to its top-centre.
		const body = new Sprite(this.textures.get(BODY_NORMAL));
		body.anchor.set(0, 0);
		body.position.set(0, 0);
		this.bodySprite = body;
		this.currentBody = BODY_NORMAL;

		const face = new Sprite(this.textures.get(VISEME_FILE.rest));
		face.anchor.set(0.5, 0);
		face.position.set(BODY_W / 2, 0);
		face.width = HEAD;
		face.height = HEAD;
		this.faceSprite = face;
		this.currentFace = VISEME_FILE.rest;

		this.stand.addChild(body, face);
		// Pivot at the body's bottom-centre so the figure stands on `root`'s origin.
		this.stand.pivot.set(BODY_W / 2, BODY_H);
		this.stand.position.set(0, 0);

		// Moving layer: full-body clip sharing the same feet point.
		const move = new Sprite(this.textures.get(MOVE_LEFT_SEQUENCE[0]));
		move.anchor.set(0.5, 1);
		move.position.set(0, 0);
		move.visible = false;
		this.moveSprite = move;
		this.currentMove = MOVE_LEFT_SEQUENCE[0];

		this.root.addChild(this.stand, move);
		this.root.alpha = 0;
		this.root.visible = false;
		app.stage.addChild(this.root);

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
		// Restart the entrance fade/slide when the character (re)appears.
		if (this.view.visible && !prev.visible) {
			this.root.alpha = 0;
			this.walkElapsed = 0;
		}
		// Restart the walk clip whenever movement (re)starts.
		if (this.view.locomotion !== 'none' && prev.locomotion === 'none') {
			this.moveFrame = 0;
			this.moveTimer = 0;
			this.walkElapsed = 0;
		}
	}

	private applyLighting() {
		if (this.view.lit) {
			this.root.filters = [];
			return;
		}
		const c = THEME_SILHOUETTE[this.view.theme];
		const r = ((c >> 16) & 0xff) / 255;
		const g = ((c >> 8) & 0xff) / 255;
		const b = (c & 0xff) / 255;
		// Flatten RGB to a constant colour while preserving alpha -> silhouette.
		this.filter.matrix = [0, 0, 0, 0, r, 0, 0, 0, 0, g, 0, 0, 0, 0, b, 0, 0, 0, 1, 0];
		this.root.filters = [this.filter];
	}

	private update(deltaMs: number) {
		this.root.visible = this.view.visible;
		if (!this.view.visible) return;

		if (this.root.alpha < 1) {
			this.root.alpha = Math.min(1, this.root.alpha + deltaMs / ENTRANCE_FADE_MS);
		}

		if (this.view.locomotion !== 'none') {
			this.updateMove(deltaMs);
		} else {
			this.updateStand(deltaMs);
		}
	}

	// ---- move state --------------------------------------------------------

	private updateMove(deltaMs: number) {
		if (!this.moveSprite) return;
		this.stand.visible = false;
		this.moveSprite.visible = true;

		const seq = MOVE_LEFT_SEQUENCE;
		this.moveTimer += deltaMs;
		while (this.moveTimer >= FRAME_MS && this.moveFrame < seq.length - 1) {
			this.moveTimer -= FRAME_MS;
			this.moveFrame += 1;
		}
		this.setMove(seq[this.moveFrame]);

		// Slide in from the right, easing to the resting position as the walk ends.
		this.walkElapsed += deltaMs;
		const total = seq.length * FRAME_MS;
		const t = Math.min(1, this.walkElapsed / total);
		const slide = (1 - easeOutCubic(t)) * this.slideDistance();
		this.root.position.x = this.baseX() + slide;
	}

	// ---- stand state -------------------------------------------------------

	private updateStand(deltaMs: number) {
		if (!this.moveSprite) return;
		this.moveSprite.visible = false;
		this.stand.visible = true;
		// Reset the walk clip so a future move replays from the first frame.
		this.moveFrame = 0;
		this.moveTimer = 0;
		this.root.position.x = this.baseX();

		this.updateBody(deltaMs);
		this.tickBlink(deltaMs);
		this.setFace(this.resolveFace());
	}

	private updateBody(deltaMs: number) {
		const gesture = this.view.gesture;
		if (gesture !== this.lastGesture) {
			this.bodyFrame = 0;
			this.bodyTimer = 0;
			this.lastGesture = gesture;
		}

		if (gesture === 'none') {
			this.setBody(BODY_NORMAL);
			return;
		}

		const seq = GESTURE_FRAMES[gesture];
		this.bodyTimer += deltaMs;
		while (this.bodyTimer >= FRAME_MS) {
			this.bodyTimer -= FRAME_MS;
			this.bodyFrame = (this.bodyFrame + 1) % seq.length;
		}
		this.setBody(seq[this.bodyFrame]);
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

	/** Resolve the head image by priority: blink > speaking viseme > expression. */
	private resolveFace(): string {
		if (this.blinkPhase === 'closed') return BLINK.closed;
		if (this.blinkPhase === 'closing' || this.blinkPhase === 'opening') return BLINK.half;
		if (this.view.speaking) return VISEME_FILE[this.view.mouth] ?? VISEME_FILE.rest;
		return EXPRESSION_FILE[this.view.expression] ?? EXPRESSION_FILE.normal;
	}

	private setFace(url: string) {
		if (url === this.currentFace || !this.faceSprite) return;
		const tex = this.textures.get(url);
		if (!tex) return;
		this.faceSprite.texture = tex;
		this.currentFace = url;
	}

	private setBody(url: string) {
		if (url === this.currentBody || !this.bodySprite) return;
		const tex = this.textures.get(url);
		if (!tex) return;
		this.bodySprite.texture = tex;
		this.currentBody = url;
	}

	private setMove(url: string) {
		if (url === this.currentMove || !this.moveSprite) return;
		const tex = this.textures.get(url);
		if (!tex) return;
		this.moveSprite.texture = tex;
		this.currentMove = url;
	}

	// ---- layout ------------------------------------------------------------

	private baseX(): number {
		const w = this.host?.clientWidth || 360;
		return w / 2;
	}

	private slideDistance(): number {
		const w = this.host?.clientWidth || 360;
		const h = this.host?.clientHeight || 720;
		const scale = (h * CharacterRenderer.FIGURE_H) / BODY_H;
		const figureW = scale * BODY_W;
		// Anchor is horizontal centre; start fully off-screen to the right.
		return w / 2 + figureW / 2 + w * CharacterRenderer.ENTRANCE_MARGIN;
	}

	private layout() {
		if (!this.app || !this.host) return;
		const w = this.host.clientWidth || 360;
		const h = this.host.clientHeight || 720;
		this.app.renderer.resize(w, h);

		const scale = (h * CharacterRenderer.FIGURE_H) / BODY_H;
		this.root.scale.set(scale);
		this.root.position.set(w / 2, h * CharacterRenderer.FEET_Y);
	}

	resize() {
		this.layout();
	}

	destroy() {
		if (this.app) {
			this.app.destroy(true, { children: true });
			this.app = null;
		}
		this.bodySprite = null;
		this.faceSprite = null;
		this.moveSprite = null;
	}
}

function randomGap(): number {
	return BLINK_MIN_GAP + Math.random() * (BLINK_MAX_GAP - BLINK_MIN_GAP);
}

function easeOutCubic(t: number): number {
	return 1 - Math.pow(1 - t, 1.6);
}
