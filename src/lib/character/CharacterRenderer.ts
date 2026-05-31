// CharacterRenderer draws the virtual presenter with PixiJS.
//
// For the MVP we have no sprite sheets, so the character is a stylised figure
// built from PixiJS Graphics. The public surface (init / setView / destroy) is
// deliberately sprite-agnostic: swapping in real sprite sheets later only means
// reimplementing the private draw/animate methods, not the engine wiring.

import { Application, Container, Graphics } from 'pixi.js';
import type { BodyAnimation, Emotion, MouthShape, Theme } from '../engine/types';
import { MOUTH_SHAPES } from './visemes';

export interface CharacterView {
	body: BodyAnimation;
	mouth: MouthShape;
	emotion: Emotion;
	lit: boolean;
	theme: Theme;
	visible: boolean;
}

const DESIGN_HEIGHT = 600; // rig is authored at this height, then scaled.

interface Palette {
	skin: number;
	hair: number;
	jacket: number;
	jacketDark: number;
	shirt: number;
	tie: number;
	feature: number;
}

const LIT_PALETTE: Palette = {
	skin: 0xe8b58c,
	hair: 0x241c17,
	jacket: 0x3a2f28,
	jacketDark: 0x2c231d,
	shirt: 0xf3f0ea,
	tie: 0x8a2b2b,
	feature: 0x2a1d16
};

export class CharacterRenderer {
	private app: Application | null = null;
	private host: HTMLElement | null = null;
	private rig = new Container();

	private g = {
		shadow: new Graphics(),
		legBack: new Graphics(),
		legFront: new Graphics(),
		armBack: new Graphics(),
		torso: new Graphics(),
		armFront: new Graphics(),
		head: new Graphics(),
		hair: new Graphics(),
		face: new Graphics(),
		mouth: new Graphics()
	};

	private view: CharacterView = {
		body: 'idle',
		mouth: 'rest',
		emotion: 'neutral',
		lit: true,
		theme: 'dark',
		visible: false
	};

	private t = 0;
	private walk = 0; // 0..1 entrance progress

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

		// Stack order: shadow, back leg, back arm, torso, front arm, head, hair, face, mouth.
		this.rig.addChild(
			this.g.shadow,
			this.g.legBack,
			this.g.legFront,
			this.g.armBack,
			this.g.torso,
			this.g.armFront,
			this.g.head,
			this.g.hair,
			this.g.face,
			this.g.mouth
		);
		app.stage.addChild(this.rig);

		this.redrawBody();
		this.redrawFace();
		this.redrawMouth();
		this.layout();

		app.ticker.add((ticker) => this.update(ticker.deltaMS));
	}

	setView(next: Partial<CharacterView>) {
		const prev = this.view;
		this.view = { ...prev, ...next };

		this.rig.visible = this.view.visible;

		if (this.view.lit !== prev.lit || this.view.theme !== prev.theme) {
			this.redrawBody();
			this.redrawFace();
			this.redrawMouth();
		}
		if (this.view.emotion !== prev.emotion) this.redrawFace();
		if (this.view.mouth !== prev.mouth) this.redrawMouth();

		// Reset entrance progress when a fresh walk-in begins.
		if (this.view.body === 'walkIn' && prev.body !== 'walkIn') this.walk = 0;
	}

	private palette(): Palette {
		if (this.view.lit) return LIT_PALETTE;
		// Silhouette: a single flat colour matching the theme background so the
		// character reads as an unlit shape against the stage.
		const sil = this.view.theme === 'dark' ? 0x05060a : 0xf2f0ec;
		return {
			skin: sil,
			hair: sil,
			jacket: sil,
			jacketDark: sil,
			shirt: sil,
			tie: sil,
			feature: sil
		};
	}

	private redrawBody() {
		const p = this.palette();
		const { shadow, legBack, legFront, armBack, armFront, torso, head, hair } = this.g;

		shadow.clear();
		shadow.ellipse(0, 6, 120, 26).fill({ color: 0x000000, alpha: this.view.lit ? 0.22 : 0.12 });

		// Legs (pivot at hip so they can swing during walk).
		const drawLeg = (gg: Graphics) => {
			gg.clear();
			gg.roundRect(-26, 0, 52, 250, 22).fill(p.jacketDark);
			gg.roundRect(-30, 232, 70, 26, 10).fill(p.feature); // shoe
			gg.pivot.set(0, 0);
		};
		drawLeg(legBack);
		drawLeg(legFront);
		legBack.position.set(28, -250);
		legFront.position.set(-28, -250);

		// Torso / jacket.
		torso.clear();
		torso.roundRect(-78, -440, 156, 210, 40).fill(p.jacket);
		torso.poly([-30, -440, 30, -440, 14, -300, -14, -300]).fill(p.shirt); // shirt V
		torso.poly([-6, -432, 6, -432, 16, -330, -16, -330]).fill(p.tie); // tie
		torso.roundRect(-80, -432, 30, 200, 18).fill(p.jacketDark); // lapel shadow
		torso.roundRect(50, -432, 30, 200, 18).fill(p.jacketDark);

		// Arms (pivot at shoulder).
		const drawArm = (gg: Graphics) => {
			gg.clear();
			gg.roundRect(-22, 0, 44, 190, 20).fill(p.jacket);
			gg.circle(0, 196, 18).fill(p.skin); // hand
			gg.pivot.set(0, 0);
		};
		drawArm(armBack);
		drawArm(armFront);
		armBack.position.set(70, -420);
		armFront.position.set(-70, -420);

		// Head + neck.
		head.clear();
		head.roundRect(-22, -250, 44, 36, 12).fill(p.skin); // neck
		head.circle(0, -505, 64).fill(p.skin);

		// Hair / beard suggestion.
		hair.clear();
		hair.arc(0, -512, 66, Math.PI, 0).fill(p.hair); // top hair
		hair.roundRect(-66, -520, 18, 60, 9).fill(p.hair); // side
		hair.roundRect(48, -520, 18, 60, 9).fill(p.hair);
		if (this.view.lit) {
			hair.arc(0, -470, 52, 0.15, Math.PI - 0.15).fill({ color: p.hair, alpha: 0.85 }); // beard
		}
		hair.position.set(0, 0);
	}

	private redrawFace() {
		const face = this.g.face;
		face.clear();
		if (!this.view.lit) return;
		const p = LIT_PALETTE;

		const eyeY = -512;
		const dx = 24;
		// Eyes.
		face.circle(-dx, eyeY, 7).fill(p.feature);
		face.circle(dx, eyeY, 7).fill(p.feature);

		// Brows convey emotion.
		const brow = (cx: number, tilt: number) => {
			face
				.moveTo(cx - 14, eyeY - 18 + tilt)
				.lineTo(cx + 14, eyeY - 18 - tilt)
				.stroke({ width: 5, color: p.hair, cap: 'round' });
		};
		switch (this.view.emotion) {
			case 'happy':
				brow(-dx, -3);
				brow(dx, 3);
				break;
			case 'thinking':
				brow(-dx, 6);
				brow(dx, -2);
				break;
			case 'surprised':
				face.circle(-dx, eyeY, 9).stroke({ width: 3, color: p.feature });
				face.circle(dx, eyeY, 9).stroke({ width: 3, color: p.feature });
				brow(-dx, -6);
				brow(dx, 6);
				break;
			default:
				brow(-dx, 1);
				brow(dx, -1);
		}
	}

	private redrawMouth() {
		const mouth = this.g.mouth;
		mouth.clear();
		if (!this.view.lit) return;
		const color = LIT_PALETTE.feature;
		const my = -480;

		const s = MOUTH_SHAPES[this.view.mouth] ?? MOUTH_SHAPES.rest;
		if (s.line) {
			mouth
				.moveTo(-s.rx, my)
				.lineTo(s.rx, my)
				.stroke({ width: 4, color, cap: 'round' });
		} else {
			mouth.ellipse(0, my, s.rx, s.ry).fill(color);
		}
	}

	private update(deltaMs: number) {
		if (!this.app || !this.view.visible) return;
		this.t += deltaMs;
		const tSec = this.t / 1000;

		// Reset transforms each frame, then apply the active animation.
		this.g.legBack.rotation = 0;
		this.g.legFront.rotation = 0;
		this.g.armBack.rotation = 0;
		this.g.armFront.rotation = 0;

		let offsetX = 0;
		let bob = Math.sin(tSec * 2) * 4; // gentle breathing

		switch (this.view.body) {
			case 'walkIn': {
				this.walk = Math.min(1, this.walk + deltaMs / 2400);
				const eased = 1 - Math.pow(1 - this.walk, 3);
				offsetX = (1 - eased) * this.entranceDistance();
				const stride = Math.sin(tSec * 8) * 0.5;
				this.g.legFront.rotation = stride;
				this.g.legBack.rotation = -stride;
				this.g.armFront.rotation = -stride * 0.7;
				this.g.armBack.rotation = stride * 0.7;
				bob = Math.abs(Math.sin(tSec * 8)) * 6;
				break;
			}
			case 'walkOut': {
				offsetX = -this.entranceDistance() * Math.min(1, this.walk);
				this.walk = Math.min(1, this.walk + deltaMs / 2400);
				break;
			}
			case 'wave': {
				this.g.armFront.rotation = -2.2 + Math.sin(tSec * 8) * 0.4;
				break;
			}
			case 'gesture': {
				this.g.armFront.rotation = Math.sin(tSec * 2.5) * 0.5 - 0.3;
				this.g.armBack.rotation = Math.sin(tSec * 2.5 + 1) * 0.3;
				break;
			}
			default: {
				// idle: subtle arm sway
				this.g.armFront.rotation = Math.sin(tSec * 1.5) * 0.05;
				this.g.armBack.rotation = -Math.sin(tSec * 1.5) * 0.05;
			}
		}

		this.rig.x = this.baseX + offsetX;
		this.rig.y = this.baseY + bob;
	}

	private entranceDistance() {
		return (this.app?.renderer.width ?? 360) * 0.9;
	}

	private baseX = 0;
	private baseY = 0;

	private layout() {
		if (!this.app || !this.host) return;
		const w = this.host.clientWidth || 360;
		const h = this.host.clientHeight || 700;
		this.app.renderer.resize(w, h);

		const scale = (h * 0.82) / DESIGN_HEIGHT;
		this.rig.scale.set(scale);
		this.baseX = w / 2;
		this.baseY = h * 0.985;
		this.rig.x = this.baseX;
		this.rig.y = this.baseY;
	}

	resize() {
		this.layout();
	}

	destroy() {
		if (this.app) {
			this.app.destroy(true, { children: true });
			this.app = null;
		}
	}
}
