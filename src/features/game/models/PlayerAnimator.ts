//src\features\game\models\PlayerAnimator.ts
import * as THREE from 'three';
import { ProceduralAnimation, AnimState } from './ProceduralAnimation';

export interface ProceduralAnimationData {
    isMoving: boolean;
    moveSpeed: number;
    strafeInput: number;
    isDead?: boolean;
    isShooting?: boolean;
    isReloading?: boolean;
    playerYaw?: number;
    cameraYaw?: number;
    cameraPitch?: number;
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
            this.procedural.update(deltaTime, 'idle', 0, 0, 0, 0, 0);
            return;
        }

        let newState: AnimState = 'idle';
        if (data.isDead) {
            newState = 'death';
        } else if (data.isShooting) {
            newState = 'shoot';
        } else if (data.isReloading) {
            newState = 'reload';
        } else if (data.isMoving) {
            newState = data.moveSpeed > 0.5 ? 'run' : 'walk';
        }

        if (newState !== this.currentState) {
            console.log(`🎭 [PlayerAnimator] State changed: ${this.currentState} -> ${newState}, isMoving: ${data.isMoving}, moveSpeed: ${data.moveSpeed}`);
            this.currentState = newState;
        }

        this.procedural.update(
            deltaTime,
            this.currentState,
            data.moveSpeed,
            data.strafeInput,
            data.playerYaw ?? 0,
            data.cameraYaw ?? 0,
            data.cameraPitch ?? 0,
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