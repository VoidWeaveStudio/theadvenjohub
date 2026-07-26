// src/features/game/entities/OtherPlayer.ts
import * as THREE from "three";
import { Entity } from "./Entity";
import { ResourceManager } from "../core/ResourceManager";
import { CharacterAnimator } from "./CharacterAnimator";
import { RIFLE_GRIP_QUATERNION } from "./Weapon";
import { scaleAndCenterModel, findBoneFirst, findBoneLast, reparentPreservingWorldScale } from "./characterModel";

export class OtherPlayer extends Entity {
    public nickname: string;
    private targetPosition: THREE.Vector3 = new THREE.Vector3();
    private targetRotation: number = 0;
    private targetPitch: number = 0;
    private targetState: 'idle' | 'walk' | 'sprint' | 'jump' = 'idle';
    private nameSprite: THREE.Sprite | null = null;
    private headBone: THREE.Object3D | null = null;
    private hipsBone: THREE.Object3D | null = null;
    private rightHand: THREE.Object3D | null = null;
    private initialized: boolean = false;
    private time: number = 0;

    private dead: boolean = false;
    private health: number = 100;
    private hidden: boolean = false;

    private hitbox: THREE.Mesh;

    private weaponMesh: THREE.Group | null = null;
    private weaponEquipped: boolean = true;

    private animator = new CharacterAnimator();

    constructor(id: string, nickname: string) {
        super(id);
        this.nickname = nickname;

        const hitboxGeometry = new THREE.BoxGeometry(0.8, 1.8, 0.8);
        const hitboxMaterial = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false,
        });
        this.hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial);
        this.hitbox.position.set(0, 0.9, 0);
        this.hitbox.userData.playerId = id;
    }

    create(scene: THREE.Scene, resourceManager: ResourceManager) {
        const data = resourceManager.getModel("player");
        if (!data) {
            throw new Error("Player model not found. Cannot initialize other player.");
        }

        scaleAndCenterModel(data.scene, 1.8, -Math.PI / 2);

        this.mesh.add(data.scene);

        this.headBone = findBoneLast(data.scene, (name) => name.includes('head') && !name.endsWith('_end'));
        this.hipsBone = findBoneFirst(data.scene, (name) =>
            name === 'hips' || name === 'pelvis' || name.includes('hips')
        );
        this.rightHand = findBoneFirst(data.scene, (name) =>
            name === 'handr' || name === 'hand.r' ||
            (name.includes('right') && name.includes('hand')) ||
            name === 'r_hand' || name === 'rhand' ||
            name.includes('righthand') || name.includes('rightarm')
        );

        this.animator.setup(data.scene, data.animations);
        this.animator.play('idle', this.weaponEquipped);

        const weaponData = resourceManager.getModel("rifle");
        if (weaponData) {
            const rifle = weaponData.scene;

            const weaponBox = new THREE.Box3().setFromObject(rifle);
            const weaponSize = weaponBox.getSize(new THREE.Vector3());
            const targetLength = 0.9;
            const maxDim = Math.max(weaponSize.x, weaponSize.y, weaponSize.z);
            const weaponScale = targetLength / maxDim;
            rifle.scale.setScalar(weaponScale);

            const scaledCenter = weaponBox.getCenter(new THREE.Vector3()).multiplyScalar(weaponScale);
            rifle.position.copy(scaledCenter).multiplyScalar(-1);
            rifle.quaternion.copy(RIFLE_GRIP_QUATERNION);

            this.mesh.add(rifle);
            if (this.rightHand) {
                reparentPreservingWorldScale(rifle, this.rightHand);
            }
            this.weaponMesh = rifle;
        }

        this.nameSprite = this.createNameTag(this.nickname);
        this.mesh.add(this.nameSprite);

        scene.add(this.hitbox);
        scene.add(this.mesh);
    }

    private createNameTag(name: string): THREE.Sprite {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 96;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, 512, 96);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 48px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(name, 256, 48);

        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
        const sprite = new THREE.Sprite(mat);
        sprite.position.y = 2.8;
        sprite.scale.set(2, 0.4, 1);
        return sprite;
    }

    public setDead(dead: boolean) {
        this.dead = dead;
        if (!this.hidden) {
            this.mesh.visible = !dead;
            this.hitbox.visible = !dead;
        }
    }

    public isDead(): boolean {
        return this.dead;
    }

    public setHidden(hidden: boolean) {
        this.hidden = hidden;
        this.mesh.visible = !hidden && !this.dead;
        this.hitbox.visible = !hidden && !this.dead;
    }

    public isHidden(): boolean {
        return this.hidden;
    }

    public setHealth(health: number) {
        this.health = health;
    }

    public getHealth(): number {
        return this.health;
    }

    public getHitbox(): THREE.Mesh {
        return this.hitbox;
    }

    public setWeaponVisible(visible: boolean) {
        this.weaponEquipped = visible;
        if (this.weaponMesh) {
            this.weaponMesh.visible = visible;
        }
    }

    update(delta: number) {
        if (this.dead || this.hidden) return;

        this.time += delta;
        this.mesh.position.lerp(this.targetPosition, Math.min(1, delta * 12));

        this.hitbox.position.copy(this.mesh.position);
        this.hitbox.position.y += 0.9;

        const targetQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.targetRotation, 0));
        this.mesh.quaternion.slerp(targetQuat, Math.min(1, delta * 12));
        this.hitbox.quaternion.copy(this.mesh.quaternion);

        if (this.headBone) {
            const headQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.targetPitch, 0, 0));
            this.headBone.quaternion.slerp(headQuat, Math.min(1, delta * 12));
        }

        if (this.targetState === 'jump') {
            this.animator.play('jump', this.weaponEquipped);
        } else if (this.targetState === 'sprint') {
            this.animator.play('run', this.weaponEquipped);
        } else if (this.targetState === 'walk') {
            this.animator.play('walk', this.weaponEquipped);
        } else {
            this.animator.play('idle', this.weaponEquipped);
        }

        this.animator.update(delta);

        if (this.hipsBone) {
            this.hipsBone.rotation.x = 0;
            this.hipsBone.rotation.z = 0;
            this.hipsBone.position.x = 0;
            this.hipsBone.position.z = 0;
        }
    }

    updateFromNetwork(data: any) {
        this.targetPosition.fromArray(data.position);

        if (!this.initialized) {
            this.mesh.position.copy(this.targetPosition);
            this.hitbox.position.copy(this.targetPosition);
            this.hitbox.position.y += 0.9;
            this.initialized = true;
        }

        this.targetRotation = data.rotation;
        this.targetPitch = data.pitch || 0;
        this.targetState = (data.state as any) || 'idle';

        if (data.alive !== undefined) {
            this.setDead(!data.alive);
        }
        if (data.health !== undefined) {
            this.setHealth(data.health);
        }
    }

    dispose(scene: THREE.Scene) {
        super.dispose(scene);
        scene.remove(this.hitbox);
        this.hitbox.geometry.dispose();
        (this.hitbox.material as THREE.Material).dispose();

        if (this.nameSprite) {
            const mat = this.nameSprite.material as THREE.SpriteMaterial;
            mat.map?.dispose();
            mat.dispose();
        }
    }
}
