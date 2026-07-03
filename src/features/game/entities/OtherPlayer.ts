//src\features\game\entities\OtherPlayer.ts
import * as THREE from "three";
import { Entity } from "./Entity";
import { ResourceManager } from "../core/ResourceManager";

export class OtherPlayer extends Entity {
    public nickname: string;
    private targetPosition: THREE.Vector3 = new THREE.Vector3();
    private targetRotation: number = 0;
    private targetPitch: number = 0;
    private nameSprite: THREE.Sprite | null = null;
    private headBone: THREE.Object3D | null = null;

    constructor(id: string, nickname: string) {
        super(id);
        this.nickname = nickname;
    } 

    create(scene: THREE.Scene, resourceManager: ResourceManager) {
        const data = resourceManager.getModel("player");
        if (data) {
            this.mesh.add(data.scene);
            data.scene.traverse((obj) => {
                if (obj.name.toLowerCase().includes("head")) {
                    this.headBone = obj;
                }
            });
        }

        this.nameSprite = this.createNameTag(this.nickname);
        this.mesh.add(this.nameSprite);

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

    update(delta: number) {
        this.mesh.position.lerp(this.targetPosition, Math.min(1, delta * 12));

        const targetQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.targetRotation, 0));
        this.mesh.quaternion.slerp(targetQuat, Math.min(1, delta * 12));

        if (this.headBone) {
            const headQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.targetPitch, 0, 0));
            this.headBone.quaternion.slerp(headQuat, Math.min(1, delta * 12));
        }
    }

    updateFromNetwork(data: any) {
        this.targetPosition.fromArray(data.position);
        this.targetRotation = data.rotation;
        this.targetPitch = data.pitch || 0;
    }
}