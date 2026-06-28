//src\features\game\models\PlayerModel.ts
import * as THREE from 'three';
import { Player, PlayerAnimationData } from '../types';
import { FFA_COLORS } from '../constants';
import { PlayerModelLoader } from './PlayerModelLoader';
import { PlayerAnimator } from './PlayerAnimator';

export class PlayerModel {
    static create(
        scene: THREE.Scene,
        player: Player,
        index: number,
        mode: '5v5' | 'ffa'
    ): THREE.Group {
        let group: THREE.Group;

        console.log(`🎮 Creating model for ${player.username}, isLoaded: ${PlayerModelLoader.isLoaded()}`);

        if (PlayerModelLoader.isLoaded()) {
            const clonedModel = PlayerModelLoader.getModelClone();
            console.log(`📦 Clone result:`, clonedModel ? 'SUCCESS' : 'FAILED');

            if (clonedModel) {
                group = clonedModel;

                const teamColor = this.getTeamColor(player, index, mode);
                this.addTeamIndicator(group, teamColor);

                const animator = new PlayerAnimator(group);
                group.userData.animator = animator;

                console.log(`✅ FBX model created for ${player.username}`);
            } else {
                console.warn(`⚠️ Clone failed, using fallback for ${player.username}`);
                group = this.createFallbackModel(player, index, mode);
            }
        } else {
            console.warn(`⚠️ Model not loaded yet, using fallback for ${player.username}`);
            group = this.createFallbackModel(player, index, mode);
        }

        group.userData.playerId = player.id;
        group.position.set(player.position.x, 0, player.position.z);
        group.rotation.set(0, player.rotation.y, 0);

        scene.add(group);
        return group;
    }

    static animate(
        playerModel: THREE.Group,
        animData: PlayerAnimationData,
        deltaTime: number
    ): void {
        const animator = playerModel.userData.animator as PlayerAnimator | undefined;

        if (animator) {
            animator.update(deltaTime);

            let targetAnim = 'idle';

            if (animData.isDead) {
                targetAnim = 'death';
            } else if (animData.isShooting) {
                targetAnim = 'shooting';
            } else if (animData.isReloading) {
                targetAnim = 'reloading';
            } else if (animData.isMoving) {
                targetAnim = 'running';
            }

            const currentAnim = animator.getCurrentAnimation();
            if (currentAnim !== targetAnim) {
                animator.play(targetAnim);
            }
        } else {
            this.animateFallback(playerModel, animData, deltaTime);
        }

        this.updateHitFlash(playerModel, animData, deltaTime);
    }

    static updateTilt(playerModel: THREE.Group, cameraRotation: { x: number, y: number }) {
        playerModel.rotation.y = cameraRotation.y;
    }

    private static addTeamIndicator(model: THREE.Group, color: number) {
        const indicator = new THREE.Mesh(
            new THREE.RingGeometry(0.4, 0.55, 32),
            new THREE.MeshBasicMaterial({
                color,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.8
            })
        );
        indicator.rotation.x = -Math.PI / 2;
        indicator.position.y = 0.02;
        indicator.name = 'teamIndicator';
        model.add(indicator);
    }

    private static getTeamColor(player: Player, index: number, mode: '5v5' | 'ffa'): number {
        if (mode === '5v5') return player.team === 1 ? 0x0066ff : 0xff3333;
        return FFA_COLORS[index % FFA_COLORS.length];
    }

    private static createFallbackModel(
        player: Player,
        index: number,
        mode: '5v5' | 'ffa'
    ): THREE.Group {
        const group = new THREE.Group();
        const bodyColor = this.getTeamColor(player, index, mode);

        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.3, 1.6, 12),
            new THREE.MeshStandardMaterial({ color: bodyColor })
        );
        body.position.y = 0.8;
        body.castShadow = true;
        group.add(body);

        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.25, 16, 16),
            new THREE.MeshStandardMaterial({ color: 0xffdbac })
        );
        head.position.y = 1.85;
        head.castShadow = true;
        group.add(head);

        return group;
    }

    private static animateFallback(
        playerModel: THREE.Group,
        animData: PlayerAnimationData,
        deltaTime: number
    ) {
        if (animData.isMoving) {
            animData.walkPhase += deltaTime * 10;
            playerModel.position.y = Math.abs(Math.sin(animData.walkPhase)) * 0.05;
        }
    }

    private static updateHitFlash(
        playerModel: THREE.Group,
        animData: PlayerAnimationData,
        deltaTime: number
    ) {
        if (animData.hitFlash > 0) {
            animData.hitFlash -= deltaTime;
            playerModel.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    const mat = child.material as THREE.MeshStandardMaterial;
                    if (mat.emissive) {
                        mat.emissive.setHex(0xff0000);
                        mat.emissiveIntensity = animData.hitFlash * 5;
                    }
                }
            });
        } else {
            playerModel.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    const mat = child.material as THREE.MeshStandardMaterial;
                    if (mat.emissive && mat.emissiveIntensity > 0) {
                        mat.emissive.setHex(0x000000);
                        mat.emissiveIntensity = 0;
                    }
                }
            });
        }
    }

    static createAnimationData(): PlayerAnimationData {
        return {
            walkPhase: Math.random() * Math.PI * 2,
            isMoving: false,
            isShooting: false,
            isReloading: false,
            isDead: false,
            hitFlash: 0,
            deathAnimation: 0
        };
    }
}