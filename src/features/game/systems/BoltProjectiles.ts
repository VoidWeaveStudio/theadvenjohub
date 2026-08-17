// src/features/game/systems/BoltProjectiles.ts
import * as THREE from "three";

export interface BoltSpawn {
    origin: THREE.Vector3;
    direction: THREE.Vector3;
    speed: number;
    maxRange: number;
    pierce: number;
    accent: number;
    charged: boolean;
    local: boolean;
}

export type BoltStepResult = "continue" | "stop";

export interface BoltStep {
    from: THREE.Vector3;
    to: THREE.Vector3;
    bolt: Bolt;
}

export class Bolt {
    public readonly object = new THREE.Group();
    public readonly position: THREE.Vector3;
    public readonly direction: THREE.Vector3;
    public readonly speed: number;
    public readonly maxRange: number;
    public readonly local: boolean;
    public readonly hitIds = new Set<string>();

    public pierceLeft: number;
    public travelled = 0;

    private readonly core: THREE.Mesh;
    private readonly coreMaterial: THREE.MeshBasicMaterial;
    private readonly shell: THREE.Mesh;
    private readonly shellMaterial: THREE.MeshBasicMaterial;
    private readonly trail: THREE.Mesh;
    private readonly trailMaterial: THREE.MeshBasicMaterial;
    private flicker = Math.random() * Math.PI * 2;

    constructor(spawn: BoltSpawn) {
        this.position = spawn.origin.clone();
        this.direction = spawn.direction.clone().normalize();
        this.speed = spawn.speed;
        this.maxRange = spawn.maxRange;
        this.pierceLeft = spawn.pierce;
        this.local = spawn.local;

        const scale = spawn.charged ? 1.7 : 1;

        this.coreMaterial = new THREE.MeshBasicMaterial({
            color: 0xfff2c4,
            transparent: true,
            opacity: 1,
            depthWrite: false,
            toneMapped: false,
        });
        this.core = new THREE.Mesh(new THREE.SphereGeometry(0.1 * scale, 10, 8), this.coreMaterial);
        this.object.add(this.core);

        this.shellMaterial = new THREE.MeshBasicMaterial({
            color: spawn.accent,
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
        });
        this.shell = new THREE.Mesh(new THREE.SphereGeometry(0.21 * scale, 12, 10), this.shellMaterial);
        this.object.add(this.shell);

        this.trailMaterial = new THREE.MeshBasicMaterial({
            color: spawn.accent,
            transparent: true,
            opacity: 0.4,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
        });
        this.trail = new THREE.Mesh(new THREE.ConeGeometry(0.16 * scale, 1.3 * scale, 8, 1, true), this.trailMaterial);
        this.trail.rotation.x = -Math.PI / 2;
        this.trail.position.z = -0.65 * scale;
        this.object.add(this.trail);

        this.object.position.copy(this.position);
        this.object.lookAt(this.position.clone().add(this.direction));
    }

    advance(delta: number): THREE.Vector3 {
        const step = Math.min(this.speed * delta, this.maxRange - this.travelled);
        this.travelled += step;

        this.flicker += delta * 26;
        const pulse = 1 + Math.sin(this.flicker) * 0.18;
        this.shell.scale.setScalar(pulse);
        this.shellMaterial.opacity = 0.45 + Math.sin(this.flicker * 0.7) * 0.14;
        this.trail.scale.set(pulse, 1, pulse);
        this.object.rotateZ(delta * 7);

        const next = this.position.clone().addScaledVector(this.direction, step);
        return next;
    }

    moveTo(point: THREE.Vector3) {
        this.position.copy(point);
        this.object.position.copy(point);
    }

    isSpent(): boolean {
        return this.travelled >= this.maxRange || this.pierceLeft < 0;
    }

    dispose() {
        this.object.removeFromParent();
        this.core.geometry.dispose();
        this.coreMaterial.dispose();
        this.shell.geometry.dispose();
        this.shellMaterial.dispose();
        this.trail.geometry.dispose();
        this.trailMaterial.dispose();
    }
}

export class BoltProjectiles {
    private readonly root = new THREE.Group();
    private readonly bolts: Bolt[] = [];

    private scene: THREE.Scene | null = null;

    setScene(scene: THREE.Scene) {
        if (this.scene === scene) return;

        this.root.removeFromParent();
        this.scene = scene;
        scene.add(this.root);
    }

    spawn(spawn: BoltSpawn): Bolt {
        const bolt = new Bolt(spawn);
        this.root.add(bolt.object);
        this.bolts.push(bolt);
        return bolt;
    }

    update(delta: number, onStep: (step: BoltStep) => BoltStepResult) {
        for (let i = this.bolts.length - 1; i >= 0; i--) {
            const bolt = this.bolts[i];
            const from = bolt.position.clone();
            const to = bolt.advance(delta);

            const result = onStep({ from, to, bolt });
            bolt.moveTo(to);

            if (result === "stop" || bolt.isSpent()) {
                bolt.dispose();
                this.bolts.splice(i, 1);
            }
        }
    }

    clear() {
        this.bolts.forEach((bolt) => bolt.dispose());
        this.bolts.length = 0;
    }

    dispose() {
        this.clear();
        this.root.removeFromParent();
        this.scene = null;
    }
}
