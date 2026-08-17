// src/features/game/systems/MemeSystem.ts
import * as THREE from "three";

export interface MemeCastEvent {
    memeId: string;
    casterId: string;
    position: number[];
    radius: number;
    durationMs: number;
}

export interface MemeZone {
    memeId: string;
    casterId: string;
    center: THREE.Vector3;
    radius: number;
    expiresAt: number;
}

const ZONE_MEMES = new Set(["ink_dump", "copium_cloud", "airdrop"]);

function basic(color: number, opacity: number): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
}

function standard(color: number, emissive = 0): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
        color,
        emissive,
        emissiveIntensity: emissive ? 1.2 : 0,
        roughness: 0.6,
        metalness: 0.1,
        transparent: true,
        opacity: 1,
    });
}

abstract class MemeInstance {
    public readonly object = new THREE.Group();

    protected elapsed = 0;
    protected readonly duration: number;

    constructor(durationSeconds: number) {
        this.duration = Math.max(0.2, durationSeconds);
    }

    update(delta: number): boolean {
        this.elapsed += delta;
        if (this.elapsed >= this.duration) return false;

        this.tick(delta, this.elapsed / this.duration);
        return true;
    }

    protected abstract tick(delta: number, progress: number): void;

    dispose() {
        this.object.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) return;
            child.geometry.dispose();
            if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
            else child.material.dispose();
        });
        this.object.removeFromParent();
    }
}

class SqueakBurst extends MemeInstance {
    private readonly ring: THREE.Mesh;
    private readonly ringMaterial: THREE.MeshBasicMaterial;

    constructor(duration: number) {
        super(duration);
        this.ringMaterial = basic(0xff9db1, 0.9);
        this.ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.32, 24), this.ringMaterial);
        this.ring.rotation.x = -Math.PI / 2;
        this.ring.position.y = 1.1;
        this.object.add(this.ring);
    }

    protected tick(_delta: number, progress: number) {
        this.ring.scale.setScalar(1 + progress * 4);
        this.ringMaterial.opacity = 0.9 * (1 - progress);
    }
}

class CrabBubbles extends MemeInstance {
    private readonly bubbles: THREE.Mesh[] = [];

    constructor(duration: number) {
        super(duration);

        for (let i = 0; i < 5; i++) {
            const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), basic(0xff8f5a, 0.75));
            this.object.add(bubble);
            this.bubbles.push(bubble);
        }
    }

    protected tick(_delta: number, progress: number) {
        this.bubbles.forEach((bubble, index) => {
            const angle = this.elapsed * 2.4 + (Math.PI * 2 * index) / this.bubbles.length;
            bubble.position.set(Math.cos(angle) * 0.75, 0.5 + Math.sin(angle * 2) * 0.25, Math.sin(angle) * 0.75);
            (bubble.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - progress * 0.7);
        });
    }
}

class Cloud extends MemeInstance {
    private readonly puffs: THREE.Mesh[] = [];
    private readonly radius: number;

    constructor(duration: number, radius: number, color: number, opacity: number) {
        super(duration);
        this.radius = radius;

        for (let i = 0; i < 14; i++) {
            const puff = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.34, 10, 8), basic(color, opacity));
            const angle = (Math.PI * 2 * i) / 14;
            const spread = radius * (0.25 + Math.random() * 0.6);
            puff.position.set(
                Math.cos(angle) * spread,
                radius * (0.25 + Math.random() * 0.5),
                Math.sin(angle) * spread
            );
            this.object.add(puff);
            this.puffs.push(puff);
        }
    }

    protected tick(delta: number, progress: number) {
        const swell = 0.6 + Math.min(1, progress * 4) * 0.4;
        const fade = progress > 0.75 ? 1 - (progress - 0.75) / 0.25 : 1;

        this.object.rotation.y += delta * 0.25;
        this.puffs.forEach((puff, index) => {
            puff.scale.setScalar(swell + Math.sin(this.elapsed * 2 + index) * 0.06);
            (puff.material as THREE.MeshBasicMaterial).opacity = fade * (this.radius > 7 ? 0.3 : 0.55);
        });
    }
}

class Candle extends MemeInstance {
    private readonly body: THREE.Mesh;
    private readonly wick: THREE.Mesh;
    private readonly rising: number;

    constructor(duration: number, color: number, rising: number) {
        super(duration);
        this.rising = rising;

        this.body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 0.4), standard(color, color));
        this.body.position.y = 2.6;
        this.object.add(this.body);

        this.wick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6), standard(color, color));
        this.wick.position.y = 2.6;
        this.object.add(this.wick);
    }

    protected tick(_delta: number, progress: number) {
        const lift = this.rising * progress;
        this.body.position.y = 2.6 + lift;
        this.wick.position.y = 2.6 + lift;

        const fade = progress > 0.7 ? 1 - (progress - 0.7) / 0.3 : 1;
        (this.body.material as THREE.MeshStandardMaterial).opacity = fade;
        (this.wick.material as THREE.MeshStandardMaterial).opacity = fade * 0.7;
    }
}

class Sack extends MemeInstance {
    private readonly sack: THREE.Mesh;

    constructor(duration: number) {
        super(duration);

        this.sack = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 10), standard(0x9c6b3f));
        this.sack.scale.set(1, 1.25, 0.85);
        this.sack.position.set(0, 1.5, -0.45);
        this.object.add(this.sack);

        const knot = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.04, 6, 12), standard(0x6b4726));
        knot.position.set(0, 1.95, -0.45);
        knot.rotation.x = Math.PI / 2;
        this.object.add(knot);
    }

    protected tick(_delta: number, progress: number) {
        this.sack.position.y = 1.5 + Math.sin(this.elapsed * 4) * 0.05;
        const fade = progress > 0.85 ? 1 - (progress - 0.85) / 0.15 : 1;
        (this.sack.material as THREE.MeshStandardMaterial).opacity = fade;
    }
}

class Rug extends MemeInstance {
    private readonly rug: THREE.Mesh;

    constructor(duration: number) {
        super(duration);

        this.rug = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.6), basic(0xc0392b, 0.85));
        this.rug.rotation.x = -Math.PI / 2;
        this.rug.position.y = 0.06;
        this.object.add(this.rug);
    }

    protected tick(_delta: number, progress: number) {
        this.rug.position.z = -progress * 5;
        (this.rug.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - progress);
    }
}

class Splash extends MemeInstance {
    private readonly ring: THREE.Mesh;
    private readonly ringMaterial: THREE.MeshBasicMaterial;
    private readonly radius: number;

    constructor(duration: number, radius: number) {
        super(duration);
        this.radius = radius;

        this.ringMaterial = basic(0x6fc3ff, 0.8);
        this.ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.9, radius, 40), this.ringMaterial);
        this.ring.rotation.x = -Math.PI / 2;
        this.ring.position.y = 0.1;
        this.object.add(this.ring);
    }

    protected tick(_delta: number, progress: number) {
        this.ring.scale.setScalar(0.15 + progress * 0.95);
        this.ringMaterial.opacity = 0.8 * (1 - progress);
    }
}

class Airdrop extends MemeInstance {
    private readonly canopy: THREE.Mesh;
    private readonly crate: THREE.Mesh;
    private readonly confetti: THREE.Mesh[] = [];
    private readonly startY: number;

    constructor(duration: number, radius: number) {
        super(duration);
        this.startY = radius * 2.2;

        this.canopy = new THREE.Mesh(
            new THREE.SphereGeometry(radius * 0.42, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2),
            basic(0x8ce99a, 0.75)
        );
        this.canopy.position.y = this.startY;
        this.object.add(this.canopy);

        this.crate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), standard(0xb08968));
        this.crate.position.y = this.startY - radius * 0.5;
        this.object.add(this.crate);

        for (let i = 0; i < 18; i++) {
            const piece = new THREE.Mesh(
                new THREE.PlaneGeometry(0.09, 0.14),
                basic([0xffd166, 0x8ce99a, 0x6fc3ff, 0xff8fa3][i % 4], 0.9)
            );
            const angle = (Math.PI * 2 * i) / 18;
            piece.position.set(Math.cos(angle) * radius * 0.5, this.startY, Math.sin(angle) * radius * 0.5);
            this.object.add(piece);
            this.confetti.push(piece);
        }
    }

    protected tick(delta: number, progress: number) {
        const drop = this.startY * progress;
        this.canopy.position.y = this.startY - drop;
        this.crate.position.y = Math.max(0.3, this.canopy.position.y - 3);

        this.confetti.forEach((piece, index) => {
            piece.position.y = Math.max(0.05, this.startY - drop * (0.7 + (index % 5) * 0.08));
            piece.rotation.y += delta * (2 + (index % 3));
            piece.rotation.x += delta * 1.6;
        });
    }
}

class RocketTrail extends MemeInstance {
    private readonly flame: THREE.Mesh;
    private readonly flameMaterial: THREE.MeshBasicMaterial;
    private readonly smoke: THREE.Mesh[] = [];

    constructor(duration: number) {
        super(duration);

        this.flameMaterial = basic(0xffb347, 0.9);
        this.flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.5, 10), this.flameMaterial);
        this.flame.rotation.x = Math.PI;
        this.flame.position.y = 0.2;
        this.object.add(this.flame);

        for (let i = 0; i < 6; i++) {
            const puff = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), basic(0xdedede, 0.5));
            puff.position.y = -i * 0.5;
            this.object.add(puff);
            this.smoke.push(puff);
        }
    }

    protected tick(_delta: number, progress: number) {
        const flicker = 1 + Math.sin(this.elapsed * 28) * 0.18;
        this.flame.scale.set(flicker, 1 + Math.sin(this.elapsed * 20) * 0.25, flicker);
        this.flameMaterial.opacity = 0.9 * (1 - progress * 0.6);

        this.smoke.forEach((puff, index) => {
            puff.position.y = -index * 0.5 - progress * 3;
            puff.scale.setScalar(1 + progress * 1.4 + index * 0.1);
            (puff.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - progress);
        });
    }
}

function createInstance(memeId: string, durationSeconds: number, radius: number): MemeInstance | null {
    switch (memeId) {
        case "shrimp_squeak": return new SqueakBurst(durationSeconds);
        case "crab_walk": return new CrabBubbles(durationSeconds);
        case "ink_dump": return new Cloud(durationSeconds, radius || 6, 0x1b1b28, 0.55);
        case "bag_holder": return new Sack(durationSeconds);
        case "pump_it": return new Candle(durationSeconds, 0x4ade80, 1.2);
        case "rug_pull": return new Rug(Math.max(durationSeconds, 0.9));
        case "copium_cloud": return new Cloud(durationSeconds, radius || 8, 0xe8e0ff, 0.3);
        case "whale_splash": return new Splash(durationSeconds, radius || 8);
        case "airdrop": return new Airdrop(durationSeconds, radius || 8);
        case "moon_launch": return new RocketTrail(durationSeconds);
        default: return null;
    }
}

const ANCHORED = new Set(["shrimp_squeak", "crab_walk", "bag_holder", "pump_it", "rug_pull", "moon_launch"]);

export class MemeSystem {
    private readonly root = new THREE.Group();
    private readonly active: Array<{ instance: MemeInstance; anchor: THREE.Object3D | null }> = [];
    private readonly zones: MemeZone[] = [];

    private scene: THREE.Scene | null = null;

    attach(scene: THREE.Scene) {
        if (this.scene === scene) return;

        this.root.removeFromParent();
        this.scene = scene;
        scene.add(this.root);
    }

    play(event: MemeCastEvent, anchor: THREE.Object3D | null) {
        const durationSeconds = Math.max(0.4, event.durationMs / 1000);
        const instance = createInstance(event.memeId, durationSeconds, event.radius);
        if (!instance) return;

        const useAnchor = anchor && ANCHORED.has(event.memeId) ? anchor : null;
        if (useAnchor) useAnchor.add(instance.object);
        else {
            instance.object.position.set(event.position[0], event.position[1], event.position[2]);
            this.root.add(instance.object);
        }

        this.active.push({ instance, anchor: useAnchor });

        if (ZONE_MEMES.has(event.memeId) && event.radius > 0) {
            this.zones.push({
                memeId: event.memeId,
                casterId: event.casterId,
                center: new THREE.Vector3(event.position[0], event.position[1], event.position[2]),
                radius: event.radius,
                expiresAt: performance.now() + event.durationMs,
            });
        }
    }

    zoneCovering(memeId: string, position: THREE.Vector3): MemeZone | null {
        for (const zone of this.zones) {
            if (zone.memeId !== memeId) continue;

            const dx = position.x - zone.center.x;
            const dz = position.z - zone.center.z;
            if (Math.hypot(dx, dz) <= zone.radius) return zone;
        }
        return null;
    }

    update(delta: number) {
        for (let i = this.active.length - 1; i >= 0; i--) {
            if (this.active[i].instance.update(delta)) continue;

            this.active[i].instance.dispose();
            this.active.splice(i, 1);
        }

        const now = performance.now();
        for (let i = this.zones.length - 1; i >= 0; i--) {
            if (this.zones[i].expiresAt > now) continue;
            this.zones.splice(i, 1);
        }
    }

    clear() {
        this.active.forEach((entry) => entry.instance.dispose());
        this.active.length = 0;
        this.zones.length = 0;
    }

    dispose() {
        this.clear();
        this.root.removeFromParent();
        this.scene = null;
    }
}
