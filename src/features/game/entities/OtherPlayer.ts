//src\features\game\entities\OtherPlayer.ts
import * as THREE from "three";
import { Entity } from "./Entity";
import { ResourceManager } from "../core/ResourceManager";

export class OtherPlayer extends Entity {
    public nickname: string;
    private targetPosition: THREE.Vector3 = new THREE.Vector3();
    private targetRotation: number = 0;
    private targetPitch: number = 0;
    private targetState: 'idle' | 'walk' | 'sprint' | 'jump' = 'idle';
    private nameSprite: THREE.Sprite | null = null;
    private headBone: THREE.Object3D | null = null;
    private neckBone: THREE.Object3D | null = null;
    private leftLeg: THREE.Object3D | null = null;
    private rightLeg: THREE.Object3D | null = null;
    private leftArm: THREE.Object3D | null = null;
    private rightArm: THREE.Object3D | null = null;
    private spine: THREE.Object3D | null = null;
    private initialized: boolean = false;
    private time: number = 0;

    private dead: boolean = false;
    private health: number = 100;

    private hitbox: THREE.Mesh;

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

        const box = new THREE.Box3().setFromObject(data.scene);
        const size = box.getSize(new THREE.Vector3());
        const targetHeight = 1.8;
        const scale = targetHeight / size.y;
        data.scene.scale.setScalar(scale);

        const scaledBox = new THREE.Box3().setFromObject(data.scene);
        data.scene.position.set(
            -(scaledBox.min.x + scaledBox.max.x) / 2,
            -scaledBox.min.y,
            -(scaledBox.min.z + scaledBox.max.z) / 2
        );

        this.mesh.add(data.scene);

        data.scene.traverse((obj) => {
            const name = obj.name.toLowerCase();
            if (name.includes('head')) this.headBone = obj;
            else if (name.includes('neck')) this.neckBone = obj;
            else if (name.includes('leg') && name.includes('left')) this.leftLeg = obj;
            else if (name.includes('leg') && name.includes('right')) this.rightLeg = obj;
            else if (name.includes('arm') && name.includes('left')) this.leftArm = obj;
            else if (name.includes('arm') && name.includes('right')) this.rightArm = obj;
            else if (name.includes('spine') || name.includes('body')) this.spine = obj;
        });

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
        this.mesh.visible = !dead;
        this.hitbox.visible = !dead;
    }

    public isDead(): boolean {
        return this.dead;
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

    update(delta: number) {
        if (this.dead) return;

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

        this.updateProceduralAnimation(delta);
    }

    private updateProceduralAnimation(delta: number) {
        const state = this.targetState;
        const isMoving = state === 'walk' || state === 'sprint';
        const isSprinting = state === 'sprint';
        const isJumping = state === 'jump';
        const walkSpeed = isSprinting ? 12 : 8;
        const walkAmplitude = isSprinting ? 0.8 : 0.5;
        const armAmplitude = isSprinting ? 0.6 : 0.4;

        if (isJumping) {
            if (this.leftLeg) this.leftLeg.rotation.x += (-0.5 - this.leftLeg.rotation.x) * 0.3;
            if (this.rightLeg) this.rightLeg.rotation.x += (-0.5 - this.rightLeg.rotation.x) * 0.3;
            if (this.leftArm) {
                this.leftArm.rotation.x += (-0.8 - this.leftArm.rotation.x) * 0.3;
                this.leftArm.rotation.z += (-0.3 - this.leftArm.rotation.z) * 0.3;
            }
            if (this.rightArm) {
                this.rightArm.rotation.x += (-0.8 - this.rightArm.rotation.x) * 0.3;
                this.rightArm.rotation.z += (0.3 - this.rightArm.rotation.z) * 0.3;
            }
            if (this.spine) this.spine.rotation.x += (-0.1 - this.spine.rotation.x) * 0.3;
        } else if (isMoving) {
            if (this.leftLeg) this.leftLeg.rotation.x = Math.sin(this.time * walkSpeed) * walkAmplitude;
            if (this.rightLeg) this.rightLeg.rotation.x = -Math.sin(this.time * walkSpeed) * walkAmplitude;
            if (this.leftArm) this.leftArm.rotation.x = -Math.sin(this.time * walkSpeed) * armAmplitude;
            if (this.rightArm) this.rightArm.rotation.x = Math.sin(this.time * walkSpeed) * (armAmplitude * 0.3);
            if (this.spine) this.spine.rotation.x = isSprinting ? 0.15 : 0.05;
        } else {
            const breathSpeed = 2;
            const breathAmplitude = 0.05;
            if (this.leftLeg) this.leftLeg.rotation.x *= 0.9;
            if (this.rightLeg) this.rightLeg.rotation.x *= 0.9;
            if (this.leftArm) this.leftArm.rotation.x = Math.sin(this.time * breathSpeed) * breathAmplitude;
            if (this.rightArm) this.rightArm.rotation.x = Math.sin(this.time * breathSpeed) * breathAmplitude;
            if (this.spine) this.spine.rotation.x = Math.sin(this.time * breathSpeed) * breathAmplitude * 0.5;
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
    }
}