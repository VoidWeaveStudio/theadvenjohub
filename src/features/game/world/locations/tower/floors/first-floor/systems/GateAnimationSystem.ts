// src/features/game/world/locations/tower/floors/first-floor/systems/GateAnimationSystem.ts
import * as THREE from "three";
import type { GateWall, SegmentContent } from "./SegmentBuilderSystem";
import type { FirstFloor } from "../FirstFloor";
import { SoundManager } from "../../../../../../core/SoundManager";

interface GateAnimation {
    gate: GateWall;
    mode: "crumble" | "reform";
    startTime: number;
}

export class GateAnimationSystem {
    private animations: GateAnimation[] = [];

    constructor(private floor: FirstFloor) { }

    startCrumble(gate: GateWall) {
        SoundManager.getInstance().playAt("gate-open", {
            x: gate.group.position.x,
            z: gate.group.position.z,
            volume: 0.7,
        });
        this.animations = this.animations.filter((a) => a.gate !== gate);
        this.animations.push({ gate, mode: "crumble", startTime: performance.now() });
    }

    startReform(gate: GateWall) {
        gate.group.scale.y = 0.01;
        this.animations = this.animations.filter((a) => a.gate !== gate);
        this.animations.push({ gate, mode: "reform", startTime: performance.now() });
    }

    resetGate(gate: GateWall, content: SegmentContent) {
        this.animations = this.animations.filter((a) => a.gate !== gate);
        gate.group.scale.set(1, 1, 1);
        gate.group.position.y = 0;
        if (!content.colliders.includes(gate.collider)) content.colliders.push(gate.collider);
    }

    updateAnimations() {
        if (this.animations.length === 0) return;
        const now = performance.now();
        this.animations = this.animations.filter((anim) => {
            const t = Math.min(1, (now - anim.startTime) / 1200);
            if (anim.mode === "crumble") {
                anim.gate.group.scale.y = 1 - t;
                anim.gate.group.position.y = -t * 5;
            } else {
                anim.gate.group.scale.y = t;
            }
            return t < 1;
        });
    }

    pulseArrow(mesh: THREE.Mesh, time: number) {
        const s = 1 + Math.sin(time * 3) * 0.2;
        mesh.scale.set(s, s, 1);
    }
}
