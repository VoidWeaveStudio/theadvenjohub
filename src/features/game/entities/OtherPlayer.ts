// src/features/game/entities/OtherPlayer.ts
import * as THREE from "three";
import { Entity } from "./Entity";
import { ResourceManager } from "../core/ResourceManager";
import { CharacterAnimator } from "./CharacterAnimator";
import { RIFLE_GRIP_QUATERNION } from "./Weapon";
import { scaleAndCenterModel, findBoneFirst, findBoneLast, reparentPreservingWorldScale } from "./characterModel";

export class OtherPlayer extends Entity {
    public nickname: string;
    private factionSymbol: string | null;
    private factionImage: string | null;
    private factionImageEl: HTMLImageElement | null = null;
    private nameCanvas: HTMLCanvasElement | null = null;
    private nameCtx: CanvasRenderingContext2D | null = null;
    private nameTexture: THREE.CanvasTexture | null = null;
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

    constructor(id: string, nickname: string, factionSymbol: string | null = null, factionImage: string | null = null) {
        super(id);
        this.nickname = nickname;
        this.factionSymbol = factionSymbol;
        this.factionImage = factionImage;

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
        const hasFaction = !!this.factionSymbol;
        const canvas = document.createElement("canvas");
        canvas.width = hasFaction ? 640 : 512;
        canvas.height = hasFaction ? 128 : 96;
        this.nameCanvas = canvas;
        this.nameCtx = canvas.getContext("2d")!;

        this.drawNameTag(name);

        const tex = new THREE.CanvasTexture(canvas);
        this.nameTexture = tex;
        const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
        const sprite = new THREE.Sprite(mat);
        sprite.position.y = 2.8;
        sprite.scale.set(hasFaction ? 2.6 : 2, hasFaction ? 0.52 : 0.4, 1);

        if (this.factionImage) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                this.factionImageEl = img;
                this.drawNameTag(name);
                if (this.nameTexture) this.nameTexture.needsUpdate = true;
            };
            img.src = this.factionImage;
        }

        return sprite;
    }

    private drawNameTag(name: string) {
        const ctx = this.nameCtx;
        const canvas = this.nameCanvas;
        if (!ctx || !canvas) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (!this.factionSymbol) {
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 48px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(name, canvas.width / 2, canvas.height / 2);
            return;
        }

        const imgSize = 96;
        const imgX = 16;
        const imgY = (canvas.height - imgSize) / 2;

        if (this.factionImageEl) {
            ctx.drawImage(this.factionImageEl, imgX, imgY, imgSize, imgSize);
        } else {
            ctx.fillStyle = "rgba(255,255,255,0.15)";
            ctx.fillRect(imgX, imgY, imgSize, imgSize);
        }

        const textX = imgX + imgSize + 24;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#4FD1FF";
        ctx.font = "bold 34px Arial";
        ctx.fillText(`$${this.factionSymbol}`, textX, 56);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 42px Arial";
        ctx.fillText(name, textX, 104);
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
