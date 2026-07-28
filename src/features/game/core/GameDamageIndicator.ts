// src/features/game/core/GameDamageIndicator.ts
import * as THREE from "three";
import type { Game } from "./Game";

export function updateDamageIndicator(game: Game) {
    if (game.damageAttackerId === null) return;

    const timeSinceDamage = Date.now() - game.lastDamageTime;
    if (timeSinceDamage > game.DAMAGE_INDICATOR_DURATION) {
        game.damageAttackerId = null;
        game.onDamageIndicatorUpdate?.(null, 0);
        return;
    }

    let attackerPos: THREE.Vector3 | null = null;

    const playerAttacker = game.otherPlayers.get(game.damageAttackerId);
    if (playerAttacker && !playerAttacker.isDead() && !playerAttacker.isHidden()) {
        attackerPos = playerAttacker.mesh.position;
    } else {
        const enemy = game.enemySystem.getEnemy(game.damageAttackerId);
        if (enemy) {
            attackerPos = enemy.mesh.position;
        }
    }

    if (!attackerPos) {
        game.damageAttackerId = null;
        game.onDamageIndicatorUpdate?.(null, 0);
        return;
    }

    const playerPos = game.player.mesh.position;
    const dx = attackerPos.x - playerPos.x;
    const dz = attackerPos.z - playerPos.z;
    const worldAngle = Math.atan2(dx, dz);
    const cameraFacingAngle = game.cameraController.getYaw() + Math.PI;

    let relativeAngle = worldAngle - cameraFacingAngle;
    while (relativeAngle > Math.PI) relativeAngle -= Math.PI * 2;
    while (relativeAngle < -Math.PI) relativeAngle += Math.PI * 2;

    game.onDamageIndicatorUpdate?.(game.damageAttackerId, relativeAngle);
}
