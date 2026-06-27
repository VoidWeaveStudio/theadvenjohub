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
        torso.position.y = 1.1;
        group.add(torso);

        const head = this.createHead();
        head.position.y = 0.5;
        torso.add(head);

        const shoulders = new THREE.Group();
        shoulders.position.y = 0.25;
        torso.add(shoulders);

        const leftArm = this.createUpperArm(bodyColor);
        leftArm.position.set(-0.35, 0, 0);
        shoulders.add(leftArm);

        const leftForearm = this.createForearm(bodyColor);
        leftForearm.position.y = -0.35;
        leftArm.add(leftForearm);

        const rightArm = this.createUpperArm(bodyColor);
        rightArm.position.set(0.35, 0, 0);
        shoulders.add(rightArm);

        const rightForearm = this.createForearm(bodyColor);
        rightForearm.position.y = -0.35;
        rightArm.add(rightForearm);

        const weapon = this.createWeapon();
        weapon.position.set(0, -0.35, 0.1);
        weapon.rotation.x = -Math.PI / 2;
        rightForearm.add(weapon);

        const hips = new THREE.Group();
        hips.position.y = -0.4;
        torso.add(hips);

        const leftLeg = this.createThigh(bodyColor);
        leftLeg.position.set(-0.15, 0, 0);
        hips.add(leftLeg);

        const leftShin = this.createShin();
        leftShin.position.y = -0.45;
        leftLeg.add(leftShin);

        const rightLeg = this.createThigh(bodyColor);
        rightLeg.position.set(0.15, 0, 0);
        hips.add(rightLeg);

        const rightShin = this.createShin();
        rightShin.position.y = -0.45;
        rightLeg.add(rightShin);

        group.position.set(player.position.x, 0, player.position.z);
        group.rotation.set(0, player.rotation.y, 0);

        scene.add(group);

        return group;
    }

    private static getBodyColor(player: Player, index: number, mode: '5v5' | 'ffa'): number {
        if (mode === '5v5') return player.team === 1 ? 0x0000ff : 0xff0000;
        return FFA_COLORS[index % FFA_COLORS.length];
    }


    private static createTorso(color: number): THREE.Mesh {
        const geometry = new THREE.CylinderGeometry(0.25, 0.2, 0.8, 12);
        const material = new THREE.MeshStandardMaterial({
            color,
            flatShading: false,
            roughness: 0.7
        });
        const torso = new THREE.Mesh(geometry, material);
        torso.castShadow = true;
        torso.name = 'torso';
        return torso;
    }

    private static createHead(): THREE.Mesh {
        const geometry = new THREE.SphereGeometry(0.2, 16, 16);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffdbac,
            flatShading: false,
            roughness: 0.6
        });
        const head = new THREE.Mesh(geometry, material);
        head.castShadow = true;
        head.name = 'head';
        return head;
    }

    private static createUpperArm(color: number): THREE.Mesh {
        const geometry = new THREE.CylinderGeometry(0.08, 0.07, 0.35, 10);
        const material = new THREE.MeshStandardMaterial({
            color,
            flatShading: false
        });
        const arm = new THREE.Mesh(geometry, material);
        arm.position.y = -0.175;
        arm.castShadow = true;
        arm.name = 'upperArm';
        return arm;
    }

    private static createForearm(color: number): THREE.Group {
        const forearm = new THREE.Group();

        const lowerArm = new THREE.Mesh(
            new THREE.CylinderGeometry(0.07, 0.06, 0.35, 10),
            new THREE.MeshStandardMaterial({ color, flatShading: false })
        );
        lowerArm.position.y = -0.175;
        lowerArm.castShadow = true;
        forearm.add(lowerArm);

        const hand = new THREE.Mesh(
            new THREE.SphereGeometry(0.065, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0xffdbac, flatShading: false })
        );
        hand.position.y = -0.35;
        hand.castShadow = true;
        forearm.add(hand);

        return forearm;
    }

    private static createThigh(color: number): THREE.Mesh {
        const geometry = new THREE.CylinderGeometry(0.11, 0.09, 0.45, 10);
        const material = new THREE.MeshStandardMaterial({
            color: 0x2a2a2a,
            flatShading: false
        });
        const thigh = new THREE.Mesh(geometry, material);
        thigh.position.y = -0.225;
        thigh.castShadow = true;
        thigh.name = 'thigh';
        return thigh;
    }

    private static createShin(): THREE.Group {
        const shin = new THREE.Group();

        const lowerLeg = new THREE.Mesh(
            new THREE.CylinderGeometry(0.09, 0.08, 0.45, 10),
            new THREE.MeshStandardMaterial({ color: 0x222222, flatShading: false })
        );
        lowerLeg.position.y = -0.225;
        lowerLeg.castShadow = true;
        shin.add(lowerLeg);

        const foot = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.08, 0.2),
            new THREE.MeshStandardMaterial({ color: 0x1a1a1a, flatShading: false })
        );
        foot.position.set(0, -0.45, 0.05);
        foot.castShadow = true;
        shin.add(foot);

        return shin;
    }

    private static createWeapon(): THREE.Group {
        const weapon = new THREE.Group();

        const body = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.12, 0.5),
            new THREE.MeshStandardMaterial({ color: 0x2a2a2a, flatShading: false })
        );
        body.position.z = -0.1;
        body.castShadow = true;
        weapon.add(body);

        const barrel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.025, 0.35, 8),
            new THREE.MeshStandardMaterial({ color: 0x1a1a1a, flatShading: false })
        );
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.02, -0.45);
        barrel.castShadow = true;
        weapon.add(barrel);

        const grip = new THREE.Mesh(
            new THREE.BoxGeometry(0.05, 0.15, 0.08),
            new THREE.MeshStandardMaterial({ color: 0x3a3a3a, flatShading: false })
        );
        grip.position.set(0, -0.12, 0.1);
        grip.rotation.x = -0.3;
        grip.castShadow = true;
        weapon.add(grip);

        const stock = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.1, 0.2),
            new THREE.MeshStandardMaterial({ color: 0x4a3a2a, flatShading: false })
        );
        stock.position.set(0, 0, 0.3);
        stock.castShadow = true;
        weapon.add(stock);

        return weapon;
    }

    static animate(
        playerModel: THREE.Group,
        animData: PlayerAnimationData,
        deltaTime: number
    ): void {
        if (animData.isMoving) {
            animData.walkPhase += deltaTime * 10;
        } else {
            animData.walkPhase *= 0.9;
            if (Math.abs(animData.walkPhase) < 0.01) {
                animData.walkPhase = 0;
            }
        }

        const walkCycle = Math.sin(animData.walkPhase);

        const torso = playerModel.getObjectByName('torso') as THREE.Mesh;
        if (torso) {
            const hips = torso.children.find(c => c.type === 'Group' && c.position.y === -0.4) as THREE.Group;
            if (hips) {
                const leftLeg = hips.children.find(c => c.position.x === -0.15) as THREE.Mesh;
                const rightLeg = hips.children.find(c => c.position.x === 0.15) as THREE.Mesh;

                if (leftLeg) {
                    leftLeg.rotation.x = walkCycle * 0.7;
                    const leftShin = leftLeg.children.find(c => c.type === 'Group') as THREE.Group;
                    if (leftShin) {
                        leftShin.rotation.x = Math.max(0, walkCycle * 0.9);
                    }
                }

                if (rightLeg) {
                    rightLeg.rotation.x = -walkCycle * 0.7;
                    const rightShin = rightLeg.children.find(c => c.type === 'Group') as THREE.Group;
                    if (rightShin) {
                        rightShin.rotation.x = Math.max(0, -walkCycle * 0.9);
                    }
                }
            }
        }

        if (torso) {
            const shoulders = torso.children.find(c => c.type === 'Group' && c.position.y === 0.25) as THREE.Group;
            if (shoulders) {
                const leftArm = shoulders.children.find(c => c.position.x === -0.35) as THREE.Mesh;
                const rightArm = shoulders.children.find(c => c.position.x === 0.35) as THREE.Mesh;

                if (leftArm) {
                    leftArm.rotation.x = -walkCycle * 0.6;
                    const leftForearm = leftArm.children.find(c => c.type === 'Group') as THREE.Group;
                    if (leftForearm) {
                        leftForearm.rotation.x = 0.3;
                    }
                }

                if (rightArm) {
                    rightArm.rotation.x = walkCycle * 0.6;
                    const rightForearm = rightArm.children.find(c => c.type === 'Group') as THREE.Group;
                    if (rightForearm) {
                        rightForearm.rotation.x = 0.3;
                    }
                }
            }
        }

        if (torso && playerModel.userData.tiltAmount !== undefined) {
            const tilt = playerModel.userData.tiltAmount;
            torso.rotation.x = THREE.MathUtils.lerp(torso.rotation.x, tilt * 0.3, 0.1);
        }

        const head = playerModel.getObjectByName('head') as THREE.Mesh;
        if (head && playerModel.userData.lookAmount !== undefined) {
            const look = playerModel.userData.lookAmount;
            head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, look * 0.5, 0.1);
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
        playerModel.rotation.y = cameraRotation.y;
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