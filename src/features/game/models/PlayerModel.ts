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
        const body = this.createBody(bodyColor);
        group.add(body);

        const head = this.createHead();
        group.add(head);

        const leftArm = this.createArm(bodyColor);
        leftArm.position.set(-0.55, 0.8, 0);
        leftArm.name = 'leftArm';
        group.add(leftArm);

        const rightArm = this.createArm(bodyColor);
        rightArm.position.set(0.55, 0.8, 0);
        rightArm.name = 'rightArm';
        group.add(rightArm);

        const leftLeg = this.createLeg();
        leftLeg.position.set(-0.2, 0.0, 0);
        leftLeg.name = 'leftLeg';
        group.add(leftLeg);

        const rightLeg = this.createLeg();
        rightLeg.position.set(0.2, 0.0, 0);
        rightLeg.name = 'rightLeg';
        group.add(rightLeg);

        group.position.set(player.position.x, 0, player.position.z);
        scene.add(group);

        return group;
    }

    private static getBodyColor(player: Player, index: number, mode: '5v5' | 'ffa'): number {
        if (mode === '5v5') return player.team === 1 ? 0x0000ff : 0xff0000;
        return FFA_COLORS[index % FFA_COLORS.length];
    }

    private static createBody(color: number): THREE.Mesh {
        const geometry = new THREE.BoxGeometry(0.8, 1.6, 0.8);
        const material = new THREE.MeshStandardMaterial({ color, flatShading: true });
        const body = new THREE.Mesh(geometry, material);
        body.position.y = 0.8;
        body.castShadow = true;
        body.name = 'body';
        return body;
    }

    private static createHead(): THREE.Mesh {
        const geometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        const material = new THREE.MeshStandardMaterial({ color: 0xffdbac, flatShading: true });
        const head = new THREE.Mesh(geometry, material);
        head.position.y = 1.9;
        head.castShadow = true;
        head.name = 'head';
        return head;
    }

    private static createArm(color: number): THREE.Mesh {
        const geometry = new THREE.BoxGeometry(0.25, 1.0, 0.25);
        const material = new THREE.MeshStandardMaterial({ color, flatShading: true });
        return new THREE.Mesh(geometry, material);
    }

    private static createLeg(): THREE.Mesh {
        const geometry = new THREE.BoxGeometry(0.3, 1.0, 0.3);
        const material = new THREE.MeshStandardMaterial({ color: 0x333333, flatShading: true });
        return new THREE.Mesh(geometry, material);
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

        const body = playerModel.getObjectByName('body') as THREE.Mesh;
        if (body) {
            body.position.y = 0.8 + Math.abs(Math.sin(animData.walkPhase)) * 0.05;
        }

        const leftArm = playerModel.getObjectByName('leftArm') as THREE.Mesh;
        const rightArm = playerModel.getObjectByName('rightArm') as THREE.Mesh;
        if (leftArm && rightArm) {
            leftArm.rotation.x = Math.sin(animData.walkPhase) * 0.5;
            rightArm.rotation.x = -Math.sin(animData.walkPhase) * 0.5;
        }

        const leftLeg = playerModel.getObjectByName('leftLeg') as THREE.Mesh;
        const rightLeg = playerModel.getObjectByName('rightLeg') as THREE.Mesh;
        if (leftLeg && rightLeg) {
            leftLeg.rotation.x = -Math.sin(animData.walkPhase) * 0.6;
            rightLeg.rotation.x = Math.sin(animData.walkPhase) * 0.6;
        }

        if (animData.hitFlash > 0) {
            animData.hitFlash -= deltaTime;
            if (body && body.material instanceof THREE.MeshStandardMaterial) {
                body.material.emissive.setHex(0xff0000);
                body.material.emissiveIntensity = animData.hitFlash * 5;
            }
        } else if (body && body.material instanceof THREE.MeshStandardMaterial) {
            body.material.emissive.setHex(0x000000);
            body.material.emissiveIntensity = 0;
        }
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