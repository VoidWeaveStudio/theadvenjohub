//src\features\game\models\PlayerModel.ts
import * as THREE from 'three';
import { Player, PlayerAnimationData } from '../types';
import { FFA_COLORS } from '../constants';

export class PlayerModel {
    static create(
        scene: THREE.Scene,
        player: Player,
        index: number,
        mode: '5v5' | 'ffa'
    ): THREE.Group {
        const group = new THREE.Group();
        group.userData.playerId = player.id;

        const bodyColor = this.getBodyColor(player, index, mode);

        const torso = this.createTorso(bodyColor);
        torso.position.y = 0.9;
        group.add(torso);

        const head = this.createHead();
        head.position.y = 1.95;
        group.add(head);

        const shoulders = new THREE.Group();
        shoulders.position.y = 1.6;
        group.add(shoulders);

        const leftArm = this.createArm(bodyColor);
        leftArm.position.set(-0.5, 0, 0);
        leftArm.name = 'leftUpperArm';
        shoulders.add(leftArm);

        const leftForearm = this.createForearm(bodyColor);
        leftForearm.position.set(0, -0.45, 0);
        leftForearm.name = 'leftForearm';
        leftArm.add(leftForearm);

        const rightArm = this.createArm(bodyColor);
        rightArm.position.set(0.5, 0, 0);
        rightArm.name = 'rightUpperArm';
        shoulders.add(rightArm);

        const rightForearm = this.createForearm(bodyColor);
        rightForearm.position.set(0, -0.45, 0);
        rightForearm.name = 'rightForearm';
        rightArm.add(rightForearm);

        const weapon = this.createWeapon();
        weapon.position.set(0, -0.5, 0.1);
        weapon.rotation.x = -Math.PI / 2;
        rightForearm.add(weapon);

        const hips = new THREE.Group();
        hips.position.y = 0.4;
        group.add(hips);

        const leftLeg = this.createThigh();
        leftLeg.position.set(-0.25, 0, 0);
        leftLeg.name = 'leftThigh';
        hips.add(leftLeg);

        const leftShin = this.createShin();
        leftShin.position.set(0, -0.5, 0);
        leftShin.name = 'leftShin';
        leftLeg.add(leftShin);

        const rightLeg = this.createThigh();
        rightLeg.position.set(0.25, 0, 0);
        rightLeg.name = 'rightThigh';
        hips.add(rightLeg);

        const rightShin = this.createShin();
        rightShin.position.set(0, -0.5, 0);
        rightShin.name = 'rightShin';
        rightLeg.add(rightShin);

        group.position.set(player.position.x, 0, player.position.z);
        group.rotation.set(player.rotation.x, player.rotation.y, player.rotation.z);

        scene.add(group);

        return group;
    }

    private static getBodyColor(player: Player, index: number, mode: '5v5' | 'ffa'): number {
        if (mode === '5v5') return player.team === 1 ? 0x0000ff : 0xff0000;
        return FFA_COLORS[index % FFA_COLORS.length];
    }


    private static createTorso(color: number): THREE.Mesh {
        const geometry = new THREE.BoxGeometry(0.7, 0.8, 0.4);
        const material = new THREE.MeshStandardMaterial({ color, flatShading: true });
        const torso = new THREE.Mesh(geometry, material);
        torso.castShadow = true;
        torso.name = 'torso';
        return torso;
    }

    private static createHead(): THREE.Mesh {
        const geometry = new THREE.BoxGeometry(0.45, 0.5, 0.45);
        const material = new THREE.MeshStandardMaterial({ color: 0xffdbac, flatShading: true });
        const head = new THREE.Mesh(geometry, material);
        head.position.y = 0.25;
        head.castShadow = true;
        head.name = 'head';
        return head;
    }

    private static createArm(color: number): THREE.Mesh {
        const geometry = new THREE.BoxGeometry(0.18, 0.45, 0.18);
        const material = new THREE.MeshStandardMaterial({ color, flatShading: true });
        return new THREE.Mesh(geometry, material);
    }

    private static createForearm(color: number): THREE.Mesh {
        const geometry = new THREE.BoxGeometry(0.16, 0.45, 0.16);
        const material = new THREE.MeshStandardMaterial({ color, flatShading: true });
        const forearm = new THREE.Mesh(geometry, material);
        forearm.position.y = -0.225;
        return forearm;
    }

    private static createThigh(): THREE.Mesh {
        const geometry = new THREE.BoxGeometry(0.22, 0.5, 0.22);
        const material = new THREE.MeshStandardMaterial({ color: 0x333333, flatShading: true });
        return new THREE.Mesh(geometry, material);
    }

    private static createShin(): THREE.Mesh {
        const geometry = new THREE.BoxGeometry(0.2, 0.5, 0.2);
        const material = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, flatShading: true });
        const shin = new THREE.Mesh(geometry, material);
        shin.position.y = -0.25;
        return shin;
    }

    private static createWeapon(): THREE.Group {
        const weapon = new THREE.Group();

        const body = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.1, 0.5),
            new THREE.MeshStandardMaterial({ color: 0x2a2a2a, flatShading: true })
        );
        body.position.z = -0.1;
        weapon.add(body);

        const barrel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8),
            new THREE.MeshStandardMaterial({ color: 0x1a1a1a, flatShading: true })
        );
        barrel.rotation.x = Math.PI / 2;
        barrel.position.z = -0.4;
        barrel.position.y = 0.02;
        weapon.add(barrel);

        const grip = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.15, 0.08),
            new THREE.MeshStandardMaterial({ color: 0x3a3a3a, flatShading: true })
        );
        grip.position.y = -0.12;
        grip.position.z = 0.1;
        grip.rotation.x = -0.3;
        weapon.add(grip);

        return weapon;
    }

    static animate(
        playerModel: THREE.Group,
        animData: PlayerAnimationData,
        deltaTime: number
    ): void {
        if (animData.isMoving) {
            animData.walkPhase += deltaTime * 8;
        } else {
            animData.walkPhase *= 0.9;
            if (Math.abs(animData.walkPhase) < 0.01) {
                animData.walkPhase = 0;
            }
        }

        const walkAmount = Math.sin(animData.walkPhase);

        const leftThigh = playerModel.getObjectByName('leftThigh') as THREE.Mesh;
        const rightThigh = playerModel.getObjectByName('rightThigh') as THREE.Mesh;
        const leftShin = playerModel.getObjectByName('leftShin') as THREE.Mesh;
        const rightShin = playerModel.getObjectByName('rightShin') as THREE.Mesh;

        if (leftThigh && rightThigh) {
            leftThigh.rotation.x = walkAmount * 0.6;
            rightThigh.rotation.x = -walkAmount * 0.6;
        }

        if (leftShin && rightShin) {
            leftShin.rotation.x = Math.max(0, walkAmount * 0.8);
            rightShin.rotation.x = Math.max(0, -walkAmount * 0.8);
        }

        const leftUpperArm = playerModel.getObjectByName('leftUpperArm') as THREE.Mesh;
        const rightUpperArm = playerModel.getObjectByName('rightUpperArm') as THREE.Mesh;
        const leftForearm = playerModel.getObjectByName('leftForearm') as THREE.Mesh;
        const rightForearm = playerModel.getObjectByName('rightForearm') as THREE.Mesh;

        if (leftUpperArm && rightUpperArm) {
            leftUpperArm.rotation.x = -walkAmount * 0.5;
            rightUpperArm.rotation.x = walkAmount * 0.5;
        }

        if (leftForearm && rightForearm) {
            leftForearm.rotation.x = 0.2;
            rightForearm.rotation.x = 0.2;
        }

        const torso = playerModel.getObjectByName('torso') as THREE.Mesh;
        const head = playerModel.getObjectByName('head') as THREE.Mesh;
        const shoulders = playerModel.children.find(c => c.type === 'Group' && c.position.y === 1.6);

        if (torso && shoulders) {
            const tiltAmount = playerModel.userData.tiltAmount || 0;
            torso.rotation.x = tiltAmount * 0.5;
            shoulders.rotation.x = tiltAmount * 0.3;
        }

        if (head) {
            const lookAmount = playerModel.userData.lookAmount || 0;
            head.rotation.x = lookAmount * 0.7;
        }

        if (animData.hitFlash > 0) {
            animData.hitFlash -= deltaTime;
            if (torso && torso.material instanceof THREE.MeshStandardMaterial) {
                torso.material.emissive.setHex(0xff0000);
                torso.material.emissiveIntensity = animData.hitFlash * 5;
            }
        } else if (torso && torso.material instanceof THREE.MeshStandardMaterial) {
            torso.material.emissive.setHex(0x000000);
            torso.material.emissiveIntensity = 0;
        }
    }

    static updateTilt(playerModel: THREE.Group, cameraRotation: { x: number, y: number }) {
        playerModel.userData.tiltAmount = cameraRotation.x;
        playerModel.userData.lookAmount = cameraRotation.x;
        playerModel.userData.rotationY = cameraRotation.y;
    }

    static createAnimationData(): PlayerAnimationData {
        return {
            walkPhase: Math.random() * Math.PI * 2,
            isMoving: false,
            hitFlash: 0,
            deathAnimation: 0
        };
    }
}