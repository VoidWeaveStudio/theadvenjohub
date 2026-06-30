// src/features/game/models/PlayerModel.ts
import * as THREE from 'three';
import { Player, PlayerAnimationData } from '../types';
import { FFA_COLORS } from '../constants';
import { PlayerModelLoader } from './PlayerModelLoader';
import { PlayerAnimator, ProceduralAnimationData } from './PlayerAnimator';

const sharedRingGeometry = new THREE.RingGeometry(0.4, 0.55, 32);
const teamMaterials = new Map<number, THREE.MeshBasicMaterial>();

function getTeamMaterial(color: number): THREE.MeshBasicMaterial {
    let mat = teamMaterials.get(color);
    if (!mat) {
        mat = new THREE.MeshBasicMaterial({
            color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8,
        });
        teamMaterials.set(color, mat);
    }
    return mat;
}

export class PlayerModel {
    readonly group: THREE.Group;
    readonly animator: PlayerAnimator;
    readonly height: number;

    private animData: PlayerAnimationData;
    private meshMaterials: THREE.MeshStandardMaterial[] = [];
    private disposed = false;

    constructor(
        scene: THREE.Scene,
        player: Player,
        index: number,
        mode: '5v5' | 'ffa',
        skinId: string = 'default',
    ) {
        console.log(`🎭 [PlayerModel] Creating model for player "${player.id}" (index: ${index}, mode: ${mode}, skin: ${skinId})`);
        
        const clonedModel = PlayerModelLoader.getModelClone(skinId);
        if (clonedModel) {
            this.group = clonedModel;
            this.height = PlayerModelLoader.getModelHeight(skinId);
            console.log(`✅ [PlayerModel] Using cloned model for player "${player.id}" (height: ${this.height})`);
        } else {
            this.group = PlayerModel.createFallback(player, index, mode);
            this.height = 1.8;
            console.warn(`⚠️ [PlayerModel] Using fallback model for player "${player.id}"`);
        }

        const teamColor = PlayerModel.getTeamColor(player, index, mode);
        this.addTeamIndicator(teamColor);
        console.log(`🎨 [PlayerModel] Team indicator added with color #${teamColor.toString(16).padStart(6, '0')}`);

        this.cacheMaterials();

        this.animator = new PlayerAnimator(this.group);

        this.group.userData.playerId = player.id;
        this.group.userData.animator = this.animator;
        this.group.userData.playerModel = this;

        const groundOffset = PlayerModelLoader.getGroundOffset(skinId);
        this.group.position.set(player.position.x, groundOffset, player.position.z);
        this.group.rotation.set(0, player.rotation.y, 0);

        console.log(`📍 [PlayerModel] Position: (${player.position.x.toFixed(2)}, ${groundOffset.toFixed(2)}, ${player.position.z.toFixed(2)})`);
        console.log(`🔄 [PlayerModel] Rotation: ${player.rotation.y.toFixed(2)} rad (${(player.rotation.y * 180 / Math.PI).toFixed(1)}°)`);

        this.animData = PlayerModel.createAnimationData();

        scene.add(this.group);
        console.log(`✅ [PlayerModel] Model added to scene for player "${player.id}"`);
    }

    update(deltaTime: number, proceduralData?: ProceduralAnimationData): void {
        if (this.disposed) return;

        const data: ProceduralAnimationData = {
            isMoving: this.animData.isMoving,
            moveSpeed: proceduralData?.moveSpeed ?? 0,
            strafeInput: proceduralData?.strafeInput ?? 0,
            aimDirection: proceduralData?.aimDirection,
            isDead: this.animData.isDead,
            isShooting: this.animData.isShooting,
            isReloading: this.animData.isReloading,
        };

        this.animator.update(deltaTime, data);
        this.updateHitFlash(deltaTime);
    }

    updateRotation(yaw: number): void {
        this.group.rotation.y = yaw;
    }

    getAnimationData(): PlayerAnimationData {
        return this.animData;
    }

    setMoving(moving: boolean): void {
        if (this.animData.isMoving !== moving) {
            console.log(`🚶 [PlayerModel] Player "${this.group.userData.playerId}" ${moving ? 'started' : 'stopped'} moving`);
            this.animData.isMoving = moving;
        }
    }

    setShooting(shooting: boolean): void {
        if (this.animData.isShooting !== shooting) {
            console.log(`🔫 [PlayerModel] Player "${this.group.userData.playerId}" ${shooting ? 'started' : 'stopped'} shooting`);
            this.animData.isShooting = shooting;
        }
    }

    setReloading(reloading: boolean): void {
        if (this.animData.isReloading !== reloading) {
            console.log(`🔄 [PlayerModel] Player "${this.group.userData.playerId}" ${reloading ? 'started' : 'stopped'} reloading`);
            this.animData.isReloading = reloading;
        }
    }

    setDead(dead: boolean): void {
        if (this.animData.isDead !== dead) {
            console.log(`💀 [PlayerModel] Player "${this.group.userData.playerId}" ${dead ? 'died' : 'revived'}`);
            this.animData.isDead = dead;
        }
    }

    triggerHitFlash(): void {
        this.animData.hitFlash = 0.3;
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;

        console.log(`🗑️ [PlayerModel] Disposing model for player "${this.group.userData.playerId}"`);

        this.group.parent?.remove(this.group);

        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry?.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => {
                        if (!teamMaterials.has(m.color?.getHex?.() ?? -1)) {
                            m.dispose();
                        }
                    });
                } else if (child.material && !teamMaterials.has(child.material.color?.getHex?.() ?? -1)) {
                    child.material.dispose();
                }
            }
        });

        console.log(`✅ [PlayerModel] Model disposed for player "${this.group.userData.playerId}"`);
    }

    private cacheMaterials(): void {
        this.meshMaterials = [];
        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                const mat = child.material as THREE.MeshStandardMaterial;
                if (mat?.emissive) {
                    this.meshMaterials.push(mat);
                }
            }
        });
    }

    private addTeamIndicator(color: number): void {
        const indicator = new THREE.Mesh(
            sharedRingGeometry,
            getTeamMaterial(color),
        );
        indicator.rotation.x = -Math.PI / 2;
        indicator.position.y = 0.02;
        indicator.name = 'teamIndicator';
        this.group.add(indicator);
    }

    private updateHitFlash(deltaTime: number): void {
        if (this.animData.hitFlash <= 0) {
            if (this.meshMaterials.some(m => m.emissiveIntensity > 0)) {
                for (const mat of this.meshMaterials) {
                    mat.emissive.setHex(0x000000);
                    mat.emissiveIntensity = 0;
                }
            }
            return;
        }

        this.animData.hitFlash -= deltaTime;
        const intensity = Math.max(0, this.animData.hitFlash) * 5;

        for (const mat of this.meshMaterials) {
            mat.emissive.setHex(0xff0000);
            mat.emissiveIntensity = intensity;
        }
    }

    private static getTeamColor(player: Player, index: number, mode: '5v5' | 'ffa'): number {
        if (mode === '5v5') return player.team === 1 ? 0x0066ff : 0xff3333;
        return FFA_COLORS[index % FFA_COLORS.length];
    }

    private static createFallback(
        player: Player,
        index: number,
        mode: '5v5' | 'ffa',
    ): THREE.Group {
        console.log(`🔧 [PlayerModel] Creating fallback model for player "${player.id}"`);
        
        const group = new THREE.Group();
        const color = this.getTeamColor(player, index, mode);

        const body = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.3, 1.6, 12),
            new THREE.MeshStandardMaterial({ color }),
        );
        body.position.y = 0.8;
        body.castShadow = true;
        group.add(body);

        const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.25, 16, 16),
            new THREE.MeshStandardMaterial({ color: 0xffdbac }),
        );
        head.position.y = 1.85;
        head.castShadow = true;
        group.add(head);

        return group;
    }

    static create(
        scene: THREE.Scene,
        player: Player,
        index: number,
        mode: '5v5' | 'ffa',
        skinId: string = 'default',
    ): THREE.Group {
        const instance = new PlayerModel(scene, player, index, mode, skinId);
        return instance.group;
    }

    static animate(
        playerModel: THREE.Group,
        animData: PlayerAnimationData,
        deltaTime: number,
        proceduralData?: ProceduralAnimationData,
    ): void {
        const animator = playerModel.userData.animator as PlayerAnimator | undefined;

        if (animator) {
            animator.update(deltaTime, proceduralData);
        } else {
            PlayerModel.animateFallback(playerModel, animData, deltaTime);
        }

        PlayerModel.updateHitFlashStatic(playerModel, animData, deltaTime);
    }

    static updateTilt(playerModel: THREE.Group, cameraRotation: { x: number; y: number }): void {
        playerModel.rotation.y = cameraRotation.y;
    }

    static createAnimationData(): PlayerAnimationData {
        return {
            walkPhase: 0,
            isMoving: false,
            isShooting: false,
            isReloading: false,
            isDead: false,
            hitFlash: 0,
            deathAnimation: 0,
        };
    }

    private static animateFallback(
        playerModel: THREE.Group,
        animData: PlayerAnimationData,
        deltaTime: number,
    ): void {
        if (animData.isMoving) {
            animData.walkPhase += deltaTime * 10;
            playerModel.position.y = Math.abs(Math.sin(animData.walkPhase)) * 0.05;
        }
    }

    private static updateHitFlashStatic(
        playerModel: THREE.Group,
        animData: PlayerAnimationData,
        deltaTime: number,
    ): void {
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
}