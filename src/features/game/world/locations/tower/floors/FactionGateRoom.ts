// src/features/game/world/locations/tower/floors/FactionGateRoom.ts
import * as THREE from "three";
import { TowerFloor } from "../TowerFloor";
import { ResourceManager } from "../../../../core/ResourceManager";
import { createRoomConsole, type RoomConsole } from "./roomConsole";
import { BuildPlot } from "../../../building/BuildPlot";
import { FACTION_PLOT_SIZE, factionPlotExtent } from "../../../building/BuildLayout";
import { FactionHeart } from "./FactionHeart";

export const FACTION_ROOM_PREFIX = "faction-gate-";

const CONSOLE_OFFSET = 6;

export class FactionGateRoom extends TowerFloor {
    public readonly factionId: string;
    public readonly plot: BuildPlot;
    public onInteractablesChanged: ((added: THREE.Object3D[], removed: THREE.Object3D[]) => void) | null = null;

    public readonly heart: FactionHeart;

    private factionName: string = "Faction";
    private console: RoomConsole | null = null;

    constructor(factionId: string) {
        super(`${FACTION_ROOM_PREFIX}${factionId}`, "Faction Lot");
        this.factionId = factionId;
        this.maxPlayerRadius = FACTION_PLOT_SIZE;
        this.plot = new BuildPlot(this.scene, FACTION_PLOT_SIZE);
        this.heart = new FactionHeart();
    }

    public setFactionInfo(name: string, image: string | null, symbol: string | null, level = 1, mcTier = 0) {
        this.factionName = symbol ? `${name} ($${symbol})` : name;
        this.heart.applyFaction(this.factionId, image, level, mcTier);
        this.setLevel(level);
    }

    public setLevel(level: number) {
        const extent = factionPlotExtent(level);
        this.plot.setExtent(extent);
        this.maxPlayerRadius = extent / 2;
    }

    public get extent(): number {
        return this.plot.layout.extent;
    }

    public getFactionName(): string {
        return this.factionName;
    }

    create(_rm: ResourceManager): void {
        this.plot.create();
        this.plot.renderer.onInteractablesChanged = (added, removed) => {
            this.onInteractablesChanged?.(added, removed);
        };

        this.collisionGrid = this.plot.collisionGrid;
        this.terrain = { getHeightAt: (x, z, referenceY) => this.plot.getHeightAt(x, z, referenceY) };
        this.coverProbe = (x, y, z) => this.plot.getCoverHeightAt(x, y, z);

        this.console = createRoomConsole(new THREE.Color(0x66ccff));
        this.console.group.position.set(CONSOLE_OFFSET, 0, -CONSOLE_OFFSET);
        this.console.group.rotation.y = -Math.PI / 4;
        this.scene.add(this.console.group);
        this.plot.addStaticCollider(new THREE.Box3().setFromObject(this.console.group));

        this.heart.group.position.set(0, this.plot.getHeightAt(0, 0), 0);
        this.scene.add(this.heart.group);
        this.plot.addStaticCollider(new THREE.Box3(
            new THREE.Vector3(-3.4, 0, -3.4),
            new THREE.Vector3(3.4, 6, 3.4)
        ));

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
        this.heart.setViewerDistance(playerPosition.distanceTo(this.heart.group.position));
        this.heart.update(delta);
        this.plot.update(delta, playerPosition);
    }

    public override getInteractables(): THREE.Object3D[] {
        const interactables = super.getInteractables();
        interactables.push(this.heart.group);
        if (this.console) interactables.push(this.console.group);
        interactables.push(...this.plot.getInteractables());
        return interactables;
    }

    getSpawnPoint(): THREE.Vector3 {
        return new THREE.Vector3(0, this.plot.getHeightAt(0, 4), 4);
    }

    dispose() {
        this.heart.dispose();
        this.console?.dispose();
        this.console = null;

        this.plot.dispose();
        super.dispose();
    }
}
