// CharacterRenderer draws the virtual presenter with PixiJS.
//
// The character has two states, all clips authored at 12 fps:
//   - stand: two layers drawn on top of each other - a 360x720 body and a
//     200x200 head pinned to the body's top-centre. The body holds its idle
//     loop or plays a one-shot hand-gesture (12 frames, then back to idle); the
//     head shows lip-sync visemes, a one-shot expression flash, a hover face, or
//     an automatic blink.
//   - move:  a single 360x720 full-body clip. `in` slides on from the right,
//     `out` slides off to the left. Each plays once.
//
// Face and body "one-shots" are (re)triggered by a changing nonce so repeats of
// the same value still replay. The public API stays state-agnostic.

import { Application, Assets, ColorMatrixFilter, Container, Sprite, Texture } from 'pixi.js';
import type { Expression, Gesture, Locomotion, MouthShape, Theme } from '../engine/types';
import {
	ALL_CHARACTER_FILES,
	BLINK,
	BODY_NORMAL_FRAMES,
	EXPRESSION_FILE,
	GESTURE_FRAMES,
	MOVE_IN_SEQUENCE,
	MOVE_OUT_SEQUENCE,
	VISEME_FILE
} from './visemes';

export interface CharacterView {
	/** Whole-character movement; non-"none" + a new moveNonce starts the clip. */
	locomotion: Locomotion;
	moveNonce: number;
	/** Standing head: active mouth shape (used while speaking). */
	mouth: MouthShape;
	/** Standing head: resting expression (used while not speaking / flashing). */
	expression: Expression;
	/** One-shot expression flash; replays whenever faceNonce changes. */
	faceShot: Expression;
	faceNonce: number;
	/** Overrides the face entirely while set (answer/link hover or touch-hold). */
	hoverFace: Expression | null;
	/** One-shot body gesture; replays whenever bodyNonce changes. */
	gesture: Gesture;
	bodyNonce: number;
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
/** One-shots hold for 12 frames before returning to the default. */
const ONE_SHOT_FRAMES = 12;
const ONE_SHOT_MS = ONE_SHOT_FRAMES * FRAME_MS;

// The whole stage (including this canvas) is CSS-scaled by the camera in
// `IntroducingLayer.svelte` (zoom-in = scale(1.88)). A canvas is a fixed-size
// bitmap, so CSS-magnifying it makes the figure look blocky/pixelated. We
// pre-render the backing store at the camera's max zoom so it stays crisp even
// when the browser scales the canvas element up. Keep this in sync with the
// largest camera `scale(...)` value in IntroducingLayer.
const CAMERA_MAX_ZOOM = 1.4;

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
	/** Extra gap past the edge when a walk begins (fraction of width). */
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
		moveNonce: 0,
		mouth: 'rest',
		expression: 'normal',
		faceShot: 'normal',
		faceNonce: 0,
		hoverFace: null,
		gesture: 'none',
		bodyNonce: 0,
		speaking: false,
		lit: true,
		theme: 'light',
		visible: false
	};

	// Body cursors + one-shot gesture.
	private bodyFrame = 0;
	private bodyTimer = 0;
	private bodyShotActive = false;
	private bodyShotGesture: Gesture = 'none';
	private lastBodyNonce = 0;

	// One-shot face flash.
	private faceShotActive = false;
	private faceShotExpr: Expression = 'normal';
	private faceShotElapsed = 0;
	private lastFaceNonce = 0;

	// Move clip cursors.
	private moveActive = false;
	private moveKind: Locomotion = 'none';
	private moveFrame = 0;
	private moveTimer = 0;
	private walkElapsed = 0;
	private lastMoveNonce = 0;

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
		const body = new Sprite(this.textures.get(BODY_NORMAL_FRAMES[0]));
		body.anchor.set(0, 0);
		body.position.set(0, 0);
		this.bodySprite = body;
		this.currentBody = BODY_NORMAL_FRAMES[0];

		const face = new Sprite(this.textures.get(VISEME_FILE.rest));
		face.anchor.set(0.5, 0);
		face.position.set(BODY_W / 2, 0);
		face.width = HEAD;
		face.height = HEAD;
		this.faceSprite = face;
		this.currentFace = VISEME_FILE.rest;

		this.stand.addChild(body, face);
		this.stand.pivot.set(BODY_W / 2, BODY_H);
		this.stand.position.set(0, 0);

		// Moving layer: full-body clip sharing the same feet point.
		const move = new Sprite(this.textures.get(MOVE_IN_SEQUENCE[0]));
		move.anchor.set(0.5, 1);
		move.position.set(0, 0);
		move.visible = false;
		this.moveSprite = move;
		this.currentMove = MOVE_IN_SEQUENCE[0];

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
		// Restart the entrance fade when the character (re)appears.
		if (this.view.visible && !prev.visible) {
			this.root.alpha = 0;
		}
		// (Re)trigger the move clip on a new nonce.
		if (this.view.moveNonce !== this.lastMoveNonce) {
			this.lastMoveNonce = this.view.moveNonce;
			if (this.view.locomotion !== 'none') {
				this.moveActive = true;
				this.moveKind = this.view.locomotion;
				this.moveFrame = 0;
				this.moveTimer = 0;
				this.walkElapsed = 0;
			} else {
				this.moveActive = false;
			}
		}
		// (Re)trigger the one-shot face flash on a new nonce.
		if (this.view.faceNonce !== this.lastFaceNonce) {
			this.lastFaceNonce = this.view.faceNonce;
			this.faceShotActive = true;
			this.faceShotExpr = this.view.faceShot;
			this.faceShotElapsed = 0;
		}
		// (Re)trigger the one-shot body gesture on a new nonce.
		if (this.view.bodyNonce !== this.lastBodyNonce) {
			this.lastBodyNonce = this.view.bodyNonce;
			if (this.view.gesture !== 'none') {
				this.bodyShotActive = true;
				this.bodyShotGesture = this.view.gesture;
				this.bodyFrame = 0;
				this.bodyTimer = 0;
			} else {
				this.bodyShotActive = false;
			}
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

		if (this.moveActive) {
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

		const out = this.moveKind === 'out';
		const seq = out ? MOVE_OUT_SEQUENCE : MOVE_IN_SEQUENCE;
		this.moveTimer += deltaMs;
		while (this.moveTimer >= FRAME_MS && this.moveFrame < seq.length - 1) {
			this.moveTimer -= FRAME_MS;
			this.moveFrame += 1;
		}
		this.setMove(seq[this.moveFrame]);

		this.walkElapsed += deltaMs;
		const total = seq.length * FRAME_MS;
		const t = Math.min(1, this.walkElapsed / total);
		const dist = this.slideDistance();
		if (out) {
			// Walk off to the left, accelerating away from the resting centre.
			this.root.position.x = this.baseX() - easeInCubic(t) * dist;
		} else {
			// Walk in from the right, easing to the resting centre.
			this.root.position.x = this.baseX() + (1 - easeOutCubic(t)) * dist;
			if (t >= 1) {
				// Entrance finished: hand control back to the standing layers.
				this.moveActive = false;
				this.root.position.x = this.baseX();
			}
		}
	}

	// ---- stand state -------------------------------------------------------

	private updateStand(deltaMs: number) {
		if (!this.moveSprite) return;
		this.moveSprite.visible = false;
		this.stand.visible = true;
		this.root.position.x = this.baseX();

		this.updateBody(deltaMs);
		this.tickBlink(deltaMs);
		this.tickFaceShot(deltaMs);
		this.setFace(this.resolveFace());
	}

	private updateBody(deltaMs: number) {
		if (this.bodyShotActive) {
			const seq = GESTURE_FRAMES[this.bodyShotGesture as Exclude<Gesture, 'none'>];
			this.bodyTimer += deltaMs;
			while (this.bodyTimer >= FRAME_MS && this.bodyFrame < seq.length - 1) {
				this.bodyTimer -= FRAME_MS;
				this.bodyFrame += 1;
			}
			this.setBody(seq[this.bodyFrame]);
			if (this.bodyFrame >= seq.length - 1) {
				// One pass done; fall back to the idle loop from the top.
				this.bodyShotActive = false;
				this.bodyFrame = 0;
				this.bodyTimer = 0;
			}
			return;
		}

		const seq = BODY_NORMAL_FRAMES;
		this.bodyTimer += deltaMs;
		while (this.bodyTimer >= FRAME_MS) {
			this.bodyTimer -= FRAME_MS;
			this.bodyFrame = (this.bodyFrame + 1) % seq.length;
		}
		this.setBody(seq[this.bodyFrame]);
	}

	private tickFaceShot(deltaMs: number) {
		if (!this.faceShotActive) return;
		this.faceShotElapsed += deltaMs;
		if (this.faceShotElapsed >= ONE_SHOT_MS) this.faceShotActive = false;
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

	/**
	 * Resolve the head image by priority:
	 * hover > one-shot flash > blink > speaking viseme > resting expression.
	 */
	private resolveFace(): string {
		if (this.view.hoverFace) {
			return EXPRESSION_FILE[this.view.hoverFace] ?? EXPRESSION_FILE.normal;
		}
		if (this.faceShotActive) {
			return EXPRESSION_FILE[this.faceShotExpr] ?? EXPRESSION_FILE.normal;
		}
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
		// Anchor is horizontal centre; travel fully off-screen plus a margin.
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
	return 1 - Math.pow(1 - t, 1.34);
}

function easeInCubic(t: number): number {
	return Math.pow(t, 1.34);
}
