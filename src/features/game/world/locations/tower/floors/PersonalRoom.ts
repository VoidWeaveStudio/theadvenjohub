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
    public onInteractablesChanged: ((added: THREE.Object3D[], removed: THREE.Object3D[]) => void) | null = null;

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
    }

    public getOwnerName(): string {
        return this.ownerName;
    }

    create(_rm: ResourceManager): void {
        this.plot.create();
        this.plot.renderer.onInteractablesChanged = (added, removed) => {
            this.onInteractablesChanged?.(added, removed);
        };

        this.collisionGrid = this.plot.collisionGrid;
        this.terrain = { getHeightAt: (x, z, referenceY) => this.plot.getHeightAt(x, z, referenceY) };
        this.coverProbe = (x, y, z) => this.plot.getCoverHeightAt(x, y, z);

        this.console = createRoomConsole(new THREE.Color(0x4fd1ff));
        this.console.group.position.set(CONSOLE_OFFSET, 0, -CONSOLE_OFFSET);
        this.console.group.rotation.y = -Math.PI / 4;
        this.scene.add(this.console.group);
        this.plot.addStaticCollider(new THREE.Box3().setFromObject(this.console.group));

        this.createCentralCrystal(new THREE.Vector3(
            -CONSOLE_OFFSET,
            this.plot.getHeightAt(-CONSOLE_OFFSET, -CONSOLE_OFFSET),
            -CONSOLE_OFFSET
        ));
        this.centralCrystal.userData.interactionId = "room-portal";
        this.plot.addStaticCollider(new THREE.Box3().setFromObject(this.centralCrystal));
    }

    update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        super.update(playerPosition, delta, isEPressed);
        this.console?.update(delta);
        this.plot.update(delta, playerPosition);
    }

    public override getInteractables(): THREE.Object3D[] {
        const interactables = super.getInteractables();
        if (this.console) interactables.push(this.console.group);
        interactables.push(...this.plot.getInteractables());
        return interactables;
    }

    getSpawnPoint(): THREE.Vector3 {
        return new THREE.Vector3(0, this.plot.getHeightAt(0, 4), 4);
    }

    dispose() {
        this.console?.dispose();
        this.console = null;

        this.plot.dispose();
        super.dispose();
    }
}
