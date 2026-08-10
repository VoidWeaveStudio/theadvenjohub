// src/features/game/world/locations/tower/floors/PersonalRoom.ts
import * as THREE from "three";
import { TowerFloor } from "../TowerFloor";
import { ResourceManager } from "../../../../core/ResourceManager";
import { createRoomConsole, type RoomConsole } from "./roomConsole";
import { BuildPlot } from "../../../building/BuildPlot";
import { PERSONAL_PLOT_SIZE } from "../../../building/BuildLayout";

export const PERSONAL_ROOM_PREFIX = "player-room-";

const CONSOLE_OFFSET = 6;

export class PersonalRoom extends TowerFloor {
    public readonly ownerUserId: string;
    public readonly plot: BuildPlot;

    private nameSprite: THREE.Sprite | null = null;
    private ownerName = "Your Lot";
    private console: RoomConsole | null = null;

    constructor(ownerUserId: string) {
        super(`${PERSONAL_ROOM_PREFIX}${ownerUserId}`, "Personal Lot");
        this.ownerUserId = ownerUserId;
        this.maxPlayerRadius = PERSONAL_PLOT_SIZE;
        this.plot = new BuildPlot(this.scene, PERSONAL_PLOT_SIZE);
    }

    public setOwnerName(name: string) {
        this.ownerName = name;
        this.refreshNameplate();
    }

    create(_rm: ResourceManager): void {
        this.plot.create();

        this.collisionGrid = this.plot.collisionGrid;
        this.terrain = { getHeightAt: (x, z) => this.plot.getHeightAt(x, z) };

        this.buildNameplate();

        this.console = createRoomConsole(new THREE.Color(0x4fd1ff));
        this.console.group.position.set(CONSOLE_OFFSET, 0, -CONSOLE_OFFSET);
        this.console.group.rotation.y = -Math.PI / 4;
        this.scene.add(this.console.group);
        this.plot.collisionGrid.insert(new THREE.Box3().setFromObject(this.console.group));
    }

    private buildNameplate() {
        this.nameSprite = this.createNameSprite(this.ownerName);
        this.nameSprite.position.set(0, 3.4, -8);
        this.scene.add(this.nameSprite);
    }

    private createNameSprite(text: string): THREE.Sprite {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 96;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#e5e7eb";
        ctx.font = "bold 42px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 12;
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
        sprite.scale.set(5, 0.94, 1);
        return sprite;
    }

    private refreshNameplate() {
        if (this.nameSprite) {
            this.scene.remove(this.nameSprite);
            (this.nameSprite.material.map as THREE.Texture | null)?.dispose();
            this.nameSprite.material.dispose();
        }
        this.buildNameplate();
    }

    update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        super.update(playerPosition, delta, isEPressed);
        this.console?.update(delta);
        this.plot.followViewer(playerPosition.x, playerPosition.z);
    }

    public override getInteractables(): THREE.Object3D[] {
        const interactables = super.getInteractables();
        if (this.console) interactables.push(this.console.group);
        return interactables;
    }

    getSpawnPoint(): THREE.Vector3 {
        return new THREE.Vector3(0, this.plot.getHeightAt(0, 4), 4);
    }

    dispose() {
        this.console?.dispose();
        this.console = null;

        if (this.nameSprite) {
            (this.nameSprite.material.map as THREE.Texture | null)?.dispose();
            this.nameSprite.material.dispose();
            this.nameSprite = null;
        }

        this.plot.dispose();
        super.dispose();
    }
}
