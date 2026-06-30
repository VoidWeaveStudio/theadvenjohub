// src/features/game/hooks/movement/useMovement.ts
import * as THREE from 'three';
import { CollisionBox } from '../../types';
import { checkCollision } from '../../map/collision';
import { PLAYER_RADIUS } from '../../constants';

export interface MovementConfig {
    speed?: number;
    rotationSmoothness?: number;
}

const DEFAULT_MOVEMENT: Required<MovementConfig> = {
    speed: 7.0,
    rotationSmoothness: 15.0,
};

export class PlayerMovement {
    private config: Required<MovementConfig>;

    constructor(config: MovementConfig = {}) {
        this.config = { ...DEFAULT_MOVEMENT, ...config };
    }

  
    getInputDirection(keys: Set<string>): THREE.Vector3 {
        const dir = new THREE.Vector3();
        if (keys.has('KeyW')) dir.z -= 1;
        if (keys.has('KeyS')) dir.z += 1;
        if (keys.has('KeyA')) dir.x -= 1;
        if (keys.has('KeyD')) dir.x += 1;
        return dir;
    }

    toWorldDirection(localDir: THREE.Vector3, yaw: number): THREE.Vector3 {
        const sin = Math.sin(yaw);
        const cos = Math.cos(yaw);
        return new THREE.Vector3(
            localDir.x * cos + localDir.z * sin,
            0,
            -localDir.x * sin + localDir.z * cos,
        );
    }

 
    applyMovement(
        player: THREE.Group,
        worldDir: THREE.Vector3,
        deltaTime: number,
        collisionBoxes: CollisionBox[],
    ): void {
        if (worldDir.lengthSq() < 1e-6) return;

        worldDir.normalize();
        const speed = this.config.speed * deltaTime;

        const newX = player.position.x + worldDir.x * speed;
        const newZ = player.position.z + worldDir.z * speed;

        if (!checkCollision(newX, player.position.z, collisionBoxes, PLAYER_RADIUS)) {
            player.position.x = newX;
        }
        if (!checkCollision(player.position.x, newZ, collisionBoxes, PLAYER_RADIUS)) {
            player.position.z = newZ;
        }
    }


    rotateToward(player: THREE.Group, targetYaw: number, deltaTime: number): void {
        let diff = targetYaw - player.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        if (Math.abs(diff) < 0.01) return;

        const lerpFactor = 1 - Math.exp(-this.config.rotationSmoothness * deltaTime);
        player.rotation.y += diff * lerpFactor;
    }
}

export function useMovement(config: MovementConfig = {}) {
    return new PlayerMovement(config);
}