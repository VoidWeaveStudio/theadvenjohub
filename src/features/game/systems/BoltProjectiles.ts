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
    private readonly trail: THREE.Mesh;
    private readonly trailMaterial: THREE.MeshBasicMaterial;

    constructor(spawn: BoltSpawn) {
        this.position = spawn.origin.clone();
        this.direction = spawn.direction.clone().normalize();
        this.speed = spawn.speed;
        this.maxRange = spawn.maxRange;
        this.pierceLeft = spawn.pierce;
        this.local = spawn.local;

        const scale = spawn.charged ? 1.7 : 1;

        this.coreMaterial = new THREE.MeshBasicMaterial({
            color: spawn.accent,
            transparent: true,
            opacity: 0.95,
            depthWrite: false,
        });
        this.core = new THREE.Mesh(new THREE.SphereGeometry(0.09 * scale, 10, 8), this.coreMaterial);
        this.object.add(this.core);

        this.trailMaterial = new THREE.MeshBasicMaterial({
            color: spawn.accent,
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
        });
        this.trail = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * scale, 0.001, 0.9 * scale, 6), this.trailMaterial);
        this.trail.rotation.x = Math.PI / 2;
        this.trail.position.z = -0.45 * scale;
        this.object.add(this.trail);

        this.object.position.copy(this.position);
        this.object.lookAt(this.position.clone().add(this.direction));
    }

    advance(delta: number): THREE.Vector3 {
        const step = Math.min(this.speed * delta, this.maxRange - this.travelled);
        this.travelled += step;

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
