// src/features/game/world/locations/tower/floors/main-hall/MainHall.ts
import * as THREE from "three";
import { TowerFloor } from "../../TowerFloor";
import { ResourceManager } from "../../../../../core/ResourceManager";
import type { LeaderboardEntry, FactionSummary } from "../../../../../network/NetworkManager";
import { AssetBin } from "./utils/assetBin";
import { HallShell } from "./systems/HallShell";
import { TradingRing } from "./systems/TradingRing";
import { TradingPosts } from "./systems/TradingPosts";
import { BoardSystem } from "./systems/BoardSystem";
import { createMainHallNpcs, MainHallNpc } from "./systems/NpcSystem";
import { HALL_RADIUS, RING_TOP_Y, SPAWN_POINT, VAULT_HEIGHT, isLowEndDevice } from "./layout";

const SHADOW_EXTENT = 52;

export class MainHall extends TowerFloor {
    public readonly hallRadius = HALL_RADIUS;

    private readonly bin = new AssetBin();

    private shell!: HallShell;
    private ring!: TradingRing;
    private posts!: TradingPosts;
    private boards!: BoardSystem;
    private npcs: MainHallNpc[] = [];

    constructor() {
        super("tower-main-hall", "Tower Trading Floor");
    }

    create(rm: ResourceManager) {
        this.scene.background = new THREE.Color(0x151a24);
        this.scene.fog = new THREE.FogExp2(0x232c3c, 0.0032);

        this.scene.add(new THREE.AmbientLight(0xb9cdec, 1.05));
        this.scene.add(new THREE.HemisphereLight(0xd6ecff, 0x585268, 1.2));
        this.createKeyLight();

        this.shell = new HallShell(this.scene, this.collisionGrid, this.bin);
        this.ring = new TradingRing(this.scene, this.collisionGrid, this.bin);
        this.posts = new TradingPosts(this.scene, this.collisionGrid, this.bin);
        this.boards = new BoardSystem(this.scene, this.collisionGrid, this.bin);

        const materials = this.shell.create();
        this.ring.create(materials);
        this.posts.create(materials);
        this.boards.create(materials);

        this.createCentralCrystal(new THREE.Vector3(0, RING_TOP_Y, 0));
        this.disableCrystalShadow();

        this.npcs = createMainHallNpcs(this.scene, this.collisionGrid, rm);
    }

    private disableCrystalShadow() {
        this.centralCrystal?.traverse((object) => {
            const light = object as THREE.PointLight;
            if (light.isPointLight) light.castShadow = false;
        });
    }

    private createKeyLight() {
        const shadowRes = isLowEndDevice() ? 1024 : 2048;

        const keyLight = new THREE.DirectionalLight(0xf3f7ff, 2.4);
        keyLight.position.set(24, VAULT_HEIGHT + 34, 34);
        keyLight.target.position.set(0, 2, 0);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(shadowRes, shadowRes);
        keyLight.shadow.camera.left = -SHADOW_EXTENT;
        keyLight.shadow.camera.right = SHADOW_EXTENT;
        keyLight.shadow.camera.top = SHADOW_EXTENT;
        keyLight.shadow.camera.bottom = -SHADOW_EXTENT;
        keyLight.shadow.camera.near = 20;
        keyLight.shadow.camera.far = 170;
        keyLight.shadow.bias = -0.0004;
        keyLight.shadow.normalBias = 0.04;
        keyLight.shadow.camera.updateProjectionMatrix();

        this.scene.add(keyLight);
        this.scene.add(keyLight.target);
    }

    public setLeaderboard(entries: LeaderboardEntry[]) {
        this.boards?.setPlayers(entries);
    }

    public setFactionLeaderboard(list: FactionSummary[]) {
        this.boards?.setFactions(list);
    }

    update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        super.update(playerPosition, delta, isEPressed);

        this.shell.update(delta);
        this.boards.update(delta);

        for (const npc of this.npcs) {
            npc.time += delta;
            npc.handle.group.rotation.y = npc.baseRotation + Math.sin(npc.time * 0.4) * 0.3;
            npc.handle.update(delta);
        }
    }

    public override getInteractables(): THREE.Object3D[] {
        return [...super.getInteractables(), ...this.npcs.map((npc) => npc.handle.group)];
    }

    getSpawnPoint(): THREE.Vector3 {
        return SPAWN_POINT.clone();
    }

    dispose() {
        this.shell?.dispose();
        this.boards?.dispose();
        this.npcs = [];

        super.dispose();
        this.bin.dispose();
    }
}
