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
    private hipsBone: THREE.Object3D | null = null;
    private initialized: boolean = false;
    private time: number = 0;

    private dead: boolean = false;
    private health: number = 100;

    private hitbox: THREE.Mesh;

    private weaponMesh: THREE.Group | null = null;
    private weaponEquipped: boolean = true;

    private mixer: THREE.AnimationMixer | null = null;
    private animations: Map<string, THREE.AnimationAction> = new Map();
    private currentAnimation: string = 'idle';

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

        data.scene.rotation.y = -Math.PI / 2;

        this.mesh.add(data.scene);

        data.scene.traverse((obj) => {
            const name = obj.name.toLowerCase();
            if (name.includes('head')) this.headBone = obj;
            if (!this.hipsBone && (name === 'hips' || name === 'pelvis' || name.includes('hips'))) {
                this.hipsBone = obj;
            }
        });

        this.mixer = new THREE.AnimationMixer(data.scene);

        if (data.animations && data.animations.length > 0) {
            const animMapping: Record<string, string> = {
                'idle': 'idle',
                'walk': 'walk',
                'run': 'run',
                'jump': 'jump'
            };

            for (const clip of data.animations) {
                for (const [key, value] of Object.entries(animMapping)) {
                    if (clip.name.toLowerCase().includes(key)) {
                        const action = this.mixer.clipAction(clip);
                        action.setEffectiveTimeScale(1);
                        action.setEffectiveWeight(1);
                        this.animations.set(value, action);
                        break;
                    }
                }
            }
        }

        this.playAnimation('idle');

        const weaponData = resourceManager.getModel("rifle");
        if (weaponData) {
            const rifle = weaponData.scene;

            const weaponBox = new THREE.Box3().setFromObject(rifle);
            const weaponSize = weaponBox.getSize(new THREE.Vector3());
            const targetLength = 0.9;
            const maxDim = Math.max(weaponSize.x, weaponSize.y, weaponSize.z);
            const weaponScale = targetLength / maxDim;
            rifle.scale.setScalar(weaponScale);

            rifle.position.set(0, 0, -0.2);
            rifle.rotation.set(0, 0, 0);

            this.mesh.add(rifle);
            this.weaponMesh = rifle;
        }

        this.nameSprite = this.createNameTag(this.nickname);
        this.mesh.add(this.nameSprite);

        scene.add(this.hitbox);
        scene.add(this.mesh);
    }

    private playAnimation(name: string) {
        if (this.currentAnimation === name) return;

        const nextAction = this.animations.get(name);
        const currentAction = this.animations.get(this.currentAnimation);

        if (nextAction) {
            if (currentAction) {
                currentAction.fadeOut(0.2);
            }
            nextAction.reset().fadeIn(0.2).play();
            this.currentAnimation = name;
        }
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

    public setWeaponVisible(visible: boolean) {
        this.weaponEquipped = visible;
        if (this.weaponMesh) {
            this.weaponMesh.visible = visible;
        }
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

        if (this.targetState === 'jump') {
            this.playAnimation('jump');
        } else if (this.targetState === 'sprint') {
            this.playAnimation('run');
        } else if (this.targetState === 'walk') {
            this.playAnimation('walk');
        } else {
            this.playAnimation('idle');
        }

        if (this.mixer) {
            this.mixer.update(delta);
        }

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
    }
}