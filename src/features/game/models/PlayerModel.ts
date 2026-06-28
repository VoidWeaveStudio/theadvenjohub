// src/features/game/models/PlayerModel.ts
import * as THREE from 'three';
import { Player, PlayerAnimationData } from '../types';
import { FFA_COLORS } from '../constants';
import { PlayerModelLoader } from './PlayerModelLoader';
import { PlayerAnimator, ProceduralAnimationData } from './PlayerAnimator';

export class PlayerModel {
    static create(
        scene: THREE.Scene,
        player: Player,
        index: number,
        mode: '5v5' | 'ffa'
    ): THREE.Group {
        console.log('🎯 [PlayerModel] === CREATING PLAYER MODEL ===');
        console.log('🎯 [PlayerModel] Player ID:', player.id);
        console.log('🎯 [PlayerModel] Player position:', `X=${player.position.x.toFixed(3)}, Y=${player.position.y.toFixed(3)}, Z=${player.position.z.toFixed(3)}`);
        console.log('🎯 [PlayerModel] Player rotation:', `X=${player.rotation.x.toFixed(3)}, Y=${player.rotation.y.toFixed(3)}, Z=${player.rotation.z.toFixed(3)}`);
        console.log('🎯 [PlayerModel] Index:', index);
        console.log('🎯 [PlayerModel] Mode:', mode);

        let group: THREE.Group;

        if (PlayerModelLoader.isLoaded()) {
            console.log('🎯 [PlayerModel] Using loaded model');
            const clonedModel = PlayerModelLoader.getModelClone();
            if (clonedModel) {
                group = clonedModel;
                const teamColor = this.getTeamColor(player, index, mode);
                this.addTeamIndicator(group, teamColor);
                const animator = new PlayerAnimator(group);
                group.userData.animator = animator;
            } else {
                console.log('🎯 [PlayerModel] Clone failed, using fallback');
                group = this.createFallbackModel(player, index, mode);
            }
        } else {
            console.log('🎯 [PlayerModel] Model not loaded, using fallback');
            group = this.createFallbackModel(player, index, mode);
        }

        group.userData.playerId = player.id;
        
        const groundOffset = PlayerModelLoader.getGroundOffset();
        const finalY = player.position.y + groundOffset;
        
        console.log('🎯 [PlayerModel] === POSITIONING MODEL ===');
        console.log('🎯 [PlayerModel] Ground offset:', groundOffset.toFixed(3));
        console.log('🎯 [PlayerModel] Final Y position:', finalY.toFixed(3));
        console.log('🎯 [PlayerModel] Setting position to:', `X=${player.position.x.toFixed(3)}, Y=${finalY.toFixed(3)}, Z=${player.position.z.toFixed(3)}`);
        
        group.position.set(player.position.x, finalY, player.position.z);
        
        console.log('🎯 [PlayerModel] Setting rotation Y to:', player.rotation.y.toFixed(3));
        group.rotation.set(0, player.rotation.y, 0);
        
        const afterBox = new THREE.Box3().setFromObject(group);
        const afterSize = afterBox.getSize(new THREE.Vector3());
        const afterCenter = afterBox.getCenter(new THREE.Vector3());
        const afterMin = afterBox.min;
        const afterMax = afterBox.max;
        
        console.log('🎯 [PlayerModel] === AFTER POSITIONING ===');
        console.log('🎯 [PlayerModel] Group position:', `X=${group.position.x.toFixed(3)}, Y=${group.position.y.toFixed(3)}, Z=${group.position.z.toFixed(3)}`);
        console.log('🎯 [PlayerModel] Group rotation:', `X=${group.rotation.x.toFixed(3)}, Y=${group.rotation.y.toFixed(3)}, Z=${group.rotation.z.toFixed(3)}`);
        console.log('🎯 [PlayerModel] Group scale:', `X=${group.scale.x.toFixed(3)}, Y=${group.scale.y.toFixed(3)}, Z=${group.scale.z.toFixed(3)}`);
        console.log('🎯 [PlayerModel] World bounding box size:', `X=${afterSize.x.toFixed(3)}, Y=${afterSize.y.toFixed(3)}, Z=${afterSize.z.toFixed(3)}`);
        console.log('🎯 [PlayerModel] World bounding box center:', `X=${afterCenter.x.toFixed(3)}, Y=${afterCenter.y.toFixed(3)}, Z=${afterCenter.z.toFixed(3)}`);
        console.log('🎯 [PlayerModel] World bounding box min:', `X=${afterMin.x.toFixed(3)}, Y=${afterMin.y.toFixed(3)}, Z=${afterMin.z.toFixed(3)}`);
        console.log('🎯 [PlayerModel] World bounding box max:', `X=${afterMax.x.toFixed(3)}, Y=${afterMax.y.toFixed(3)}, Z=${afterMax.z.toFixed(3)}`);

        console.log('🎯 [PlayerModel] Adding to scene');
        scene.add(group);
        console.log('✅ [PlayerModel] Player model created successfully');
        return group;
    }

    static animate(
        playerModel: THREE.Group,
        animData: PlayerAnimationData,
        deltaTime: number,
        proceduralData?: ProceduralAnimationData
    ): void {
        const animator = playerModel.userData.animator as PlayerAnimator | undefined;

        if (animator) {
            let targetAnim = 'idle';
            if (animData.isDead) targetAnim = 'death';
            else if (animData.isShooting) targetAnim = 'shooting';
            else if (animData.isReloading) targetAnim = 'reloading';
            else if (animData.isMoving) targetAnim = 'running';

            const currentAnim = animator.getCurrentAnimation();
            if (currentAnim !== targetAnim) animator.play(targetAnim);

            animator.update(deltaTime, proceduralData);
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
                color, side: THREE.DoubleSide, transparent: true, opacity: 0.8
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
        player: Player, index: number, mode: '5v5' | 'ffa'
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