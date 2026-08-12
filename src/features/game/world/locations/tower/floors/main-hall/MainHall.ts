// src/features/game/world/locations/tower/floors/main-hall/MainHall.ts
import * as THREE from "three";
import { TowerFloor } from "../../TowerFloor";
import { ResourceManager } from "../../../../../core/ResourceManager";
import type { LeaderboardEntry, FactionSummary, FactionQuestEntry } from "../../../../../network/NetworkManager";
import { AssetBin } from "./utils/assetBin";
import { HallShell } from "./systems/HallShell";
import { HallSky } from "./systems/HallSky";
import { MezzanineSystem } from "./systems/MezzanineSystem";
import { TradingRing } from "./systems/TradingRing";
import { TradingPosts } from "./systems/TradingPosts";
import { BoardSystem } from "./systems/BoardSystem";
import { createMainHallNpcs, MainHallNpc } from "./systems/NpcSystem";
import { configureTextureQuality } from "./utils/textureQuality";
import { whenFactionImagesSettled } from "./utils/factionImages";
import { HALL_RADIUS, MEZZANINE_Y, RING_TOP_Y, SPAWN_POINT, VAULT_HEIGHT, isLowEndDevice } from "./layout";
import { perf } from "../../../../../core/PerfProfiler";

const SHADOW_EXTENT = 46;
const ENV_PROBE_HEIGHT = 14;
const BOARD_RETRY_SECONDS = 2.5;
const BOARD_REFRESH_SECONDS = 30;

export class MainHall extends TowerFloor {
    public readonly hallRadius = HALL_RADIUS;
    public override maxPlayerRadius: number | null = HALL_RADIUS - 4;
    public override cameraBounds = { radius: HALL_RADIUS - 1.8, minY: -20, maxY: VAULT_HEIGHT + 20 };

    private readonly bin = new AssetBin();

    private shell!: HallShell;
    private sky!: HallSky;
    private mezzanine!: MezzanineSystem;
    private ring!: TradingRing;
    private posts!: TradingPosts;
    private boards!: BoardSystem;
    private npcs: MainHallNpc[] = [];
    private keyLight: THREE.DirectionalLight | null = null;
    private environmentMap: THREE.Texture | null = null;
    private refreshTimer = 0;

    public onRequestBoardData?: () => void;

    constructor() {
        super("tower-main-hall", "Tower Trading Floor");
    }

    create(rm: ResourceManager) {
        configureTextureQuality(this.renderer);

        this.scene.fog = new THREE.FogExp2(0x243044, 0.0026);

        this.scene.add(new THREE.AmbientLight(0xbccfee, 0.16));
        this.scene.add(new THREE.HemisphereLight(0xd9edff, 0x3a3648, 0.32));

        this.sky = new HallSky(this.scene, this.bin);
        perf.measure("sky", () => this.sky.create());
        perf.measure("keyLight", () => this.createKeyLight());

        this.shell = new HallShell(this.scene, this.collisionGrid, this.bin);
        this.mezzanine = new MezzanineSystem(this.scene, this.collisionGrid, this.bin);
        this.ring = new TradingRing(this.scene, this.collisionGrid, this.bin);
        this.posts = new TradingPosts(this.scene, this.collisionGrid, this.bin);
        this.boards = new BoardSystem(this.scene, this.collisionGrid, this.bin);

        const materials = perf.measure("shell", () => this.shell.create());
        perf.measure("mezzanine", () => this.mezzanine.create(materials));
        perf.measure("tradingRing", () => this.ring.create(materials));
        perf.measure("tradingPosts", () => this.posts.create(materials));
        perf.measure("boards", () => this.boards.create(materials));

        perf.measure("crystal", () => this.createCentralCrystal(new THREE.Vector3(0, RING_TOP_Y, 0)));

        this.npcs = perf.measure("npcs", () => createMainHallNpcs(this.scene, this.collisionGrid, rm));

        perf.measure("environmentProbe", () => this.bakeEnvironment());
    }

    private bakeEnvironment() {
        const renderer = this.renderer;
        if (!renderer) return;

        const cubeTarget = new THREE.WebGLCubeRenderTarget(isLowEndDevice() ? 128 : 256, {
            type: THREE.HalfFloatType,
        });
        const cubeCamera = new THREE.CubeCamera(1, 20000, cubeTarget);
        cubeCamera.position.set(0, ENV_PROBE_HEIGHT, 0);
        this.scene.add(cubeCamera);

        this.sky.setShaftsVisible(false);
        cubeCamera.update(renderer, this.scene);
        this.sky.setShaftsVisible(true);

        this.scene.remove(cubeCamera);

        const pmrem = new THREE.PMREMGenerator(renderer);
        this.environmentMap = pmrem.fromCubemap(cubeTarget.texture).texture;
        pmrem.dispose();
        cubeTarget.dispose();

        this.scene.environment = this.environmentMap;
        this.scene.environmentIntensity = 0.42;
    }

    private createKeyLight() {
        const shadowRes = isLowEndDevice() ? 1024 : 2048;

        const keyLight = new THREE.DirectionalLight(0xfff4e2, 1.75);
        keyLight.position.copy(this.sky.sunDirection).multiplyScalar(VAULT_HEIGHT + 90);
        keyLight.target.position.set(0, 2, 0);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(shadowRes, shadowRes);
        keyLight.shadow.camera.left = -SHADOW_EXTENT;
        keyLight.shadow.camera.right = SHADOW_EXTENT;
        keyLight.shadow.camera.top = SHADOW_EXTENT;
        keyLight.shadow.camera.bottom = -SHADOW_EXTENT;
        keyLight.shadow.camera.near = 20;
        keyLight.shadow.camera.far = 320;
        keyLight.shadow.bias = -0.0002;
        keyLight.shadow.normalBias = 0.035;
        keyLight.shadow.radius = 2;
        keyLight.shadow.camera.updateProjectionMatrix();

        this.scene.add(keyLight);
        this.scene.add(keyLight.target);
        this.keyLight = keyLight;

        const fill = new THREE.DirectionalLight(0x9fc4ff, 0.2);
        fill.position.set(-60, 44, -70);
        fill.castShadow = false;
        this.scene.add(fill);
    }

    public override async whenReady() {
        await this.boards.whenDataReady();
        await whenFactionImagesSettled();
    }

    public setLeaderboard(entries: LeaderboardEntry[]) {
        this.boards?.setPlayers(entries);
    }

    public setFactionLeaderboard(list: FactionSummary[]) {
        this.boards?.setFactions(list);
    }

    public setFactionQuests(list: FactionQuestEntry[]) {
        this.boards?.setQuests(list);
    }

    private updateBoardRefresh(delta: number) {
        if (!this.onRequestBoardData) return;

        this.refreshTimer -= delta;
        if (this.refreshTimer > 0) return;

        const settled = this.boards?.hasBoardData() ?? false;
        this.refreshTimer = settled ? BOARD_REFRESH_SECONDS : BOARD_RETRY_SECONDS;
        this.onRequestBoardData();
    }

    update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        super.update(playerPosition, delta, isEPressed);

        this.shell.update(delta);
        this.sky.update(delta);
        perf.begin("hall.boards");
        this.boards.update(delta);
        this.updateBoardRefresh(delta);
        perf.end("hall.boards");
        perf.begin("hall.shadowCamera");
        this.trackShadowCamera(playerPosition);
        perf.end("hall.shadowCamera");

        perf.begin("hall.npcs");
        for (const npc of this.npcs) {
            npc.time += delta;
            npc.handle.group.rotation.y = npc.baseRotation + Math.sin(npc.time * 0.4) * 0.3;
            npc.handle.update(delta);
        }
        perf.end("hall.npcs");
    }

    private trackShadowCamera(playerPosition: THREE.Vector3) {
        const light = this.keyLight;
        if (!light) return;

        const focusY = playerPosition.y > MEZZANINE_Y - 2 ? MEZZANINE_Y : 0;
        const texelSize = (SHADOW_EXTENT * 2) / light.shadow.mapSize.width;
        const snappedX = Math.round(playerPosition.x / texelSize) * texelSize;
        const snappedZ = Math.round(playerPosition.z / texelSize) * texelSize;

        light.target.position.set(snappedX, focusY, snappedZ);
        light.position.copy(this.sky.sunDirection).multiplyScalar(VAULT_HEIGHT + 90);
        light.position.x += snappedX;
        light.position.z += snappedZ;
        light.target.updateMatrixWorld();
    }

    public override getInteractables(): THREE.Object3D[] {
        return [...super.getInteractables(), ...this.npcs.map((npc) => npc.handle.group)];
    }

    getSpawnPoint(): THREE.Vector3 {
        return SPAWN_POINT.clone();
    }

    dispose() {
        this.shell?.dispose();
        this.sky?.dispose();
        this.boards?.dispose();
        this.npcs = [];
        this.keyLight = null;

        this.scene.environment = null;
        this.environmentMap?.dispose();
        this.environmentMap = null;

        super.dispose();
        this.bin.dispose();
    }
}
