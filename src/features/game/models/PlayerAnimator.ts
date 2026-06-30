// src/features/game/models/PlayerAnimator.ts
import * as THREE from 'three';
import { ProceduralAnimation, AnimState } from './ProceduralAnimation';

export interface ProceduralAnimationData {
    isMoving: boolean;
    moveSpeed: number;
    strafeInput: number;
    aimDirection?: THREE.Vector3;
    isDead?: boolean;
    isShooting?: boolean;
    isReloading?: boolean;
}

export class PlayerAnimator {
    private procedural: ProceduralAnimation;
    private currentState: AnimState = 'idle';
    private time = 0;

    constructor(private model: THREE.Group) {
        this.procedural = new ProceduralAnimation(model);
    }

    update(deltaTime: number, data?: ProceduralAnimationData): void {
        this.time += deltaTime;

        if (!data) {
            this.procedural.update(deltaTime, 'idle', 0, 0);
            return;
        }

        if (data.isDead) {
            this.currentState = 'death';
        } else if (data.isShooting) {
            this.currentState = 'shoot';
        } else if (data.isReloading) {
            this.currentState = 'reload';
        } else if (data.isMoving) {
            this.currentState = data.moveSpeed > 0.5 ? 'run' : 'walk';
        } else {
            this.currentState = 'idle';
        }

        this.procedural.update(
            deltaTime,
            this.currentState,
            data.moveSpeed,
            data.strafeInput,
            data.aimDirection
        );
    }

    getCurrentAnimation(): string {
        return this.currentState;
    }

    reset(): void {
        this.procedural.reset();
        this.currentState = 'idle';
        this.time = 0;
    }

    dispose(): void {
        this.procedural.reset();
    }
}