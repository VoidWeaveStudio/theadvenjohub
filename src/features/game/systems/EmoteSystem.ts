// src/features/game/systems/EmoteSystem.ts
import * as THREE from "three";
import { EmoteKey } from "../data/emotes";
import { getEmoteSheet, getMoonTexture, EmoteSheet } from "../entities/emoteSprites";

const FRAME_FPS = 14;
const POP_IN_SECONDS = 0.18;
const FADE_OUT_SECONDS = 0.45;
const DEFAULT_DURATION = 3;
const ROCKET_DURATION = 3.2;

const ROCKET_IGNITE_SECONDS = 1;
const ROCKET_FLIGHT_SECONDS = 1.5;
const ROCKET_START_Y = 2.9;
const ROCKET_END_Y = 8.4;
const MOON_Y = 9;

function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}

class EmoteInstance {
    public readonly object = new THREE.Group();

    private readonly sheet: EmoteSheet;
    private readonly sprite: THREE.Sprite;
    private readonly spriteMaterial: THREE.SpriteMaterial;
    private readonly moon: THREE.Sprite | null = null;
    private readonly moonMaterial: THREE.SpriteMaterial | null = null;
    private readonly isRocket: boolean;
    private readonly duration: number;

    private elapsed = 0;

    constructor(key: EmoteKey) {
        this.isRocket = key === "to_the_moon";
        this.duration = this.isRocket ? ROCKET_DURATION : DEFAULT_DURATION;
        this.sheet = getEmoteSheet(key);

        this.spriteMaterial = new THREE.SpriteMaterial({
            map: this.sheet.texture,
            depthTest: false,
            transparent: true,
        });
        this.sprite = new THREE.Sprite(this.spriteMaterial);
        this.sprite.renderOrder = 10;
        this.object.add(this.sprite);

        if (this.isRocket) {
            this.moonMaterial = new THREE.SpriteMaterial({
                map: getMoonTexture(),
                depthTest: false,
                transparent: true,
                opacity: 0,
            });
            this.moon = new THREE.Sprite(this.moonMaterial);
            this.moon.renderOrder = 9;
            this.moon.position.y = MOON_Y;
            this.moon.scale.setScalar(2.4);
            this.object.add(this.moon);
        }
    }

    update(delta: number): boolean {
        this.elapsed += delta;
        if (this.elapsed >= this.duration) return false;

        const frame = Math.floor(this.elapsed * FRAME_FPS) % this.sheet.frames;
        this.sheet.texture.offset.x = frame / this.sheet.frames;

        const popIn = Math.min(1, this.elapsed / POP_IN_SECONDS);
        const remaining = this.duration - this.elapsed;
        const fade = Math.min(1, remaining / FADE_OUT_SECONDS);

        if (this.isRocket) {
            this.updateRocket(popIn, fade);
        } else {
            this.spriteMaterial.opacity = fade;
            this.sprite.scale.setScalar(1.4 * easeOutCubic(popIn));
            this.sprite.position.y = 3.5 + Math.sin(this.elapsed * 2.4) * 0.08;
        }

        return true;
    }

    private updateRocket(popIn: number, fade: number) {
        if (this.moonMaterial) {
            this.moonMaterial.opacity = Math.min(1, this.elapsed / 0.6) * fade;
        }

        const flightStart = ROCKET_IGNITE_SECONDS;
        const flightEnd = ROCKET_IGNITE_SECONDS + ROCKET_FLIGHT_SECONDS;

        if (this.elapsed < flightStart) {
            const jitter = Math.sin(this.elapsed * 46) * 0.05;
            this.sprite.position.set(jitter, ROCKET_START_Y, 0);
            this.sprite.scale.setScalar(1.2 * easeOutCubic(popIn));
            this.spriteMaterial.opacity = fade;
            return;
        }

        if (this.elapsed < flightEnd) {
            const progress = (this.elapsed - flightStart) / ROCKET_FLIGHT_SECONDS;
            const eased = progress * progress;
            this.sprite.position.set(0, ROCKET_START_Y + (ROCKET_END_Y - ROCKET_START_Y) * eased, 0);
            this.sprite.scale.setScalar(1.2 - 0.65 * eased);
            this.spriteMaterial.opacity = fade;
            return;
        }

        this.spriteMaterial.opacity = 0;
        if (this.moon && this.moonMaterial) {
            const flare = 1 + Math.sin((this.elapsed - flightEnd) * 12) * 0.14;
            this.moon.scale.setScalar(2.4 * flare);
        }
    }

    dispose() {
        this.object.removeFromParent();
        this.spriteMaterial.dispose();
        this.moonMaterial?.dispose();
    }
}

export class EmoteSystem {
    private active = new Map<string, EmoteInstance>();

    play(playerId: string, key: EmoteKey, anchor: THREE.Object3D) {
        this.stop(playerId);

        const instance = new EmoteInstance(key);
        anchor.add(instance.object);
        this.active.set(playerId, instance);
    }

    update(delta: number) {
        for (const [playerId, instance] of Array.from(this.active.entries())) {
            if (!instance.update(delta)) {
                instance.dispose();
                this.active.delete(playerId);
            }
        }
    }

    stop(playerId: string) {
        const instance = this.active.get(playerId);
        if (!instance) return;
        instance.dispose();
        this.active.delete(playerId);
    }

    clear() {
        this.active.forEach((instance) => instance.dispose());
        this.active.clear();
    }
}
