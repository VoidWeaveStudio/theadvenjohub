// src/features/game/systems/CandleEmoteSystem.ts
import * as THREE from "three";

const RISE_DELAY = 0.35;
const RISE_SECONDS = 1.35;
const HANG_SECONDS = 0.3;
const FALL_SECONDS = 0.55;
const CANDLE_HEIGHT = 5.2;

export type CandlePhase = "spread" | "rising" | "hanging" | "falling" | "downed";

export interface CandlePerformer {
    mesh: THREE.Object3D;
    playPose(name: string | null): void;
}

class CandleRun {
    public readonly group = new THREE.Group();
    public phase: CandlePhase = "spread";

    private elapsed = 0;
    private readonly body: THREE.Mesh;
    private readonly wickTop: THREE.Mesh;
    private readonly wickBottom: THREE.Mesh;
    private readonly glow: THREE.Mesh;
    private readonly baseY: number;

    constructor(private readonly performer: CandlePerformer) {
        this.baseY = performer.mesh.position.y;

        const green = new THREE.MeshStandardMaterial({
            color: 0x1f8f3a,
            emissive: 0x27d14f,
            emissiveIntensity: 1.4,
            roughness: 0.35,
            metalness: 0.1,
        });
        const wickMat = new THREE.MeshStandardMaterial({
            color: 0x1f8f3a,
            emissive: 0x27d14f,
            emissiveIntensity: 1.1,
            roughness: 0.4,
        });

        this.body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1, 1.5), green);
        this.body.castShadow = true;
        this.group.add(this.body);

        this.wickBottom = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1, 0.16), wickMat);
        this.group.add(this.wickBottom);

        this.wickTop = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1, 0.16), wickMat);
        this.group.add(this.wickTop);

        const glowMat = new THREE.MeshBasicMaterial({
            color: 0x4dffa0,
            transparent: true,
            opacity: 0.18,
            depthWrite: false,
            side: THREE.DoubleSide,
        });
        this.glow = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1, 2.3), glowMat);
        this.group.add(this.glow);

        this.group.visible = false;
        performer.playPose("t-pose");
    }

    private shape(height: number) {
        this.body.scale.y = Math.max(0.001, height);
        this.body.position.y = height / 2;

        this.wickBottom.scale.y = Math.max(0.001, height * 0.16);
        this.wickBottom.position.y = -height * 0.08;

        this.wickTop.scale.y = Math.max(0.001, height * 0.22);
        this.wickTop.position.y = height + height * 0.11;

        this.glow.scale.y = Math.max(0.001, height * 1.02);
        this.glow.position.y = height / 2;
    }

    update(delta: number): boolean {
        this.elapsed += delta;

        if (this.phase === "spread") {
            if (this.elapsed < RISE_DELAY) return true;
            this.phase = "rising";
            this.group.visible = true;
        }

        if (this.phase === "rising") {
            const t = Math.min(1, (this.elapsed - RISE_DELAY) / RISE_SECONDS);
            const eased = 1 - Math.pow(1 - t, 2);
            const height = CANDLE_HEIGHT * eased;
            this.shape(height);
            this.performer.mesh.position.y = this.baseY + height;
            if (t >= 1) this.phase = "hanging";
            return true;
        }

        if (this.phase === "hanging") {
            const t = (this.elapsed - RISE_DELAY - RISE_SECONDS) / HANG_SECONDS;
            this.shape(CANDLE_HEIGHT);
            this.performer.mesh.position.y = this.baseY + CANDLE_HEIGHT + Math.sin(this.elapsed * 9) * 0.05;
            if (t >= 1) {
                this.phase = "falling";
                this.group.visible = false;
                this.performer.playPose("death");
            }
            return true;
        }

        if (this.phase === "falling") {
            const t = Math.min(1, (this.elapsed - RISE_DELAY - RISE_SECONDS - HANG_SECONDS) / FALL_SECONDS);
            const eased = t * t;
            this.performer.mesh.position.y = this.baseY + CANDLE_HEIGHT * (1 - eased);
            if (t >= 1) {
                this.performer.mesh.position.y = this.baseY;
                this.phase = "downed";
            }
            return true;
        }

        return true;
    }

    release() {
        this.performer.mesh.position.y = this.baseY;
        this.performer.playPose(null);
        this.group.removeFromParent();
        this.group.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.geometry.dispose();
            (mesh.material as THREE.Material).dispose();
        });
    }
}

export class CandleEmoteSystem {
    private runs = new Map<string, CandleRun>();

    start(playerId: string, performer: CandlePerformer, scene: THREE.Object3D) {
        this.stop(playerId);
        const run = new CandleRun(performer);
        run.group.position.copy(performer.mesh.position);
        scene.add(run.group);
        this.runs.set(playerId, run);
    }

    update(delta: number) {
        for (const run of this.runs.values()) {
            run.update(delta);
        }
    }

    isDowned(playerId: string): boolean {
        return this.runs.get(playerId)?.phase === "downed";
    }

    isBusy(playerId: string): boolean {
        return this.runs.has(playerId);
    }

    stop(playerId: string) {
        const run = this.runs.get(playerId);
        if (!run) return;
        run.release();
        this.runs.delete(playerId);
    }

    clear() {
        for (const id of Array.from(this.runs.keys())) this.stop(id);
    }
}
