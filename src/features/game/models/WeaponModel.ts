// src/features/game/models/WeaponModel.ts
import * as THREE from 'three';
import { BoneMapper } from './BoneMapper';


class RecoilSystem {
    private offset = 0;
    private velocity = 0;

    private readonly stiffness = 80;
    private readonly damping = 8;
    private readonly maxOffset = 0.15;

    trigger(): void {
        this.velocity = -12;
    }

    update(deltaTime: number): number {
        const springForce = -this.stiffness * this.offset;
        const dampingForce = -this.damping * this.velocity;
        this.velocity += (springForce + dampingForce) * deltaTime;
        this.offset += this.velocity * deltaTime;

        this.offset = THREE.MathUtils.clamp(this.offset, -this.maxOffset, this.maxOffset * 0.2);

        return this.offset;
    }

    reset(): void {
        this.offset = 0;
        this.velocity = 0;
    }
}

export class WeaponModel {
    readonly group: THREE.Group;
    private readonly muzzlePoint: THREE.Object3D;
    private readonly recoil = new RecoilSystem();
    private readonly body: THREE.Mesh;

    constructor(playerModel: THREE.Group) {
        this.group = new THREE.Group();
        this.group.name = 'weapon';

        const bodyGeo = new THREE.BoxGeometry(0.08, 0.08, 0.6);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x2a2a2a,
            metalness: 0.8,
            roughness: 0.3,
            flatShading: true,
        });
        this.body = new THREE.Mesh(bodyGeo, bodyMat);
        this.body.castShadow = true;
        this.body.name = 'body';
        this.group.add(this.body);

        const barrelGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8);
        const barrelMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            metalness: 0.9,
            roughness: 0.2,
            flatShading: true,
        });
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.z = -0.4;
        barrel.castShadow = true;
        barrel.name = 'barrel';
        this.group.add(barrel);

        const gripGeo = new THREE.BoxGeometry(0.06, 0.15, 0.08);
        const gripMat = new THREE.MeshStandardMaterial({
            color: 0x3a3a3a,
            metalness: 0.5,
            roughness: 0.6,
            flatShading: true,
        });
        const grip = new THREE.Mesh(gripGeo, gripMat);
        grip.position.set(0, -0.1, 0.1);
        grip.rotation.x = -0.2;
        grip.castShadow = true;
        grip.name = 'grip';
        this.group.add(grip);

        this.muzzlePoint = new THREE.Object3D();
        this.muzzlePoint.name = 'muzzlePoint';
        this.muzzlePoint.position.set(0, 0, -0.6);
        this.group.add(this.muzzlePoint);

        this.attachToHand(playerModel);
    }

  
    private attachToHand(playerModel: THREE.Group): void {
        const mapper = new BoneMapper(playerModel);
        const rightHand = mapper.get('rightHand');

        if (rightHand) {
            rightHand.add(this.group);
            this.group.position.set(0, 0.05, 0.1);
            this.group.rotation.set(Math.PI / 2, 0, 0);
            console.log(`🔫 Weapon attached to bone: ${rightHand.name}`);
        } else {
            playerModel.add(this.group);
            this.group.position.set(0.3, 1.3, -0.5);
            this.group.rotation.set(0, 0, 0);
            console.warn('⚠️ Weapon fallback: attached to model root (no right hand bone)');
        }
    }

    getMuzzlePosition(): THREE.Vector3 {
        const worldPos = new THREE.Vector3();
        this.muzzlePoint.getWorldPosition(worldPos);
        return worldPos;
    }

    getMuzzlePositionForNetwork(): { x: number; y: number; z: number } {
        const pos = this.getMuzzlePosition();
        return { x: pos.x, y: pos.y, z: pos.z };
    }

    triggerRecoil(): void {
        this.recoil.trigger();
    }

    updateRecoil(deltaTime: number): void {
        const offset = this.recoil.update(deltaTime);
        this.body.position.z = offset;
    }

    dispose(): void {
        this.group.parent?.remove(this.group);
        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry?.dispose();
                (child.material as THREE.Material)?.dispose();
            }
        });
    }
}