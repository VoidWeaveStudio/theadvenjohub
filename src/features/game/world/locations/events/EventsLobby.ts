// src/features/game/world/locations/events/EventsLobby.ts
import * as THREE from "three";
import { TowerFloor } from "../tower/TowerFloor";
import { ResourceManager } from "../../../core/ResourceManager";
import { AssetBin } from "../../AssetBin";
import { EVENTS_LOBBY_ID, ResolvedEvent } from "../../../data/eventDoors";
import { LobbyShell } from "./systems/LobbyShell";
import { LobbyDoors } from "./systems/LobbyDoors";
import { LobbyProps } from "./systems/LobbyProps";
import {
    BAY_COUNT,
    DOME_BASE_Y,
    DOME_HEIGHT,
    HALL_RADIUS,
    PLAYER_LIMIT_RADIUS,
    SPAWN_POINT,
    isLowEndDevice,
    placeOnRing,
} from "./lobbyLayout";
import { perf } from "../../../core/PerfProfiler";

const SHADOW_EXTENT = 52;
const ENV_PROBE_HEIGHT = 12;
const CRYSTAL_ANGLE = Math.PI / BAY_COUNT;
const CRYSTAL_RADIUS = 34;

export class EventsLobby extends TowerFloor {
    public override maxPlayerRadius: number | null = PLAYER_LIMIT_RADIUS;
    public override cameraBounds = { radius: HALL_RADIUS - 0.5, minY: -12, maxY: DOME_BASE_Y + DOME_HEIGHT + 12 };

    public readonly hallRadius = HALL_RADIUS;

    private readonly bin = new AssetBin();

    private shell!: LobbyShell;
    private doors!: LobbyDoors;
    private props!: LobbyProps;
    private keyLight: THREE.DirectionalLight | null = null;
    private environmentMap: THREE.Texture | null = null;

    private factionId: string | null = null;
    private factionName: string | null = null;

    constructor() {
        super(EVENTS_LOBBY_ID, "Events Hall");
    }

    public setFactionContext(factionId: string, factionName: string) {
        this.factionId = factionId;
        this.factionName = factionName;
    }

    public getFactionContext(): { factionId: string | null; factionName: string | null } {
        return { factionId: this.factionId, factionName: this.factionName };
    }

    create(_rm: ResourceManager): void {
        this.scene.fog = new THREE.FogExp2(0xd8e4f2, 0.0018);

        this.scene.add(new THREE.AmbientLight(0xdfe9f5, 0.55));
        this.scene.add(new THREE.HemisphereLight(0xeaf3ff, 0xc3b298, 0.9));

        this.shell = new LobbyShell(this.scene, this.collisionGrid, this.bin);
        this.doors = new LobbyDoors(this.scene, this.collisionGrid, this.bin);
        this.props = new LobbyProps(this.scene, this.collisionGrid, this.bin);

        const materials = perf.measure("lobby.shell", () => this.shell.create());
        perf.measure("lobby.keyLight", () => this.createKeyLight());
        perf.measure("lobby.doors", () => this.doors.create(materials));
        perf.measure("lobby.props", () => this.props.create(materials));
        perf.measure("lobby.crystal", () => this.buildLiftAlcove(materials.marble, materials.gilded));
        perf.measure("lobby.environment", () => this.bakeEnvironment());
    }

    private createKeyLight() {
        const shadowRes = isLowEndDevice() ? 1024 : 2048;

        const key = new THREE.DirectionalLight(0xfff3de, 2.35);
        key.position.copy(this.shell.sunDirection).multiplyScalar(DOME_BASE_Y + 120);
        key.target.position.set(0, 2, 0);
        key.castShadow = true;
        key.shadow.mapSize.set(shadowRes, shadowRes);
        key.shadow.camera.left = -SHADOW_EXTENT;
        key.shadow.camera.right = SHADOW_EXTENT;
        key.shadow.camera.top = SHADOW_EXTENT;
        key.shadow.camera.bottom = -SHADOW_EXTENT;
        key.shadow.camera.near = 20;
        key.shadow.camera.far = 340;
        key.shadow.bias = -0.0002;
        key.shadow.normalBias = 0.035;
        key.shadow.radius = 2;
        key.shadow.camera.updateProjectionMatrix();

        this.scene.add(key);
        this.scene.add(key.target);
        this.keyLight = key;

        const fill = new THREE.DirectionalLight(0xbcd6ff, 0.42);
        fill.position.set(-70, 52, -80);
        this.scene.add(fill);

        const rim = new THREE.DirectionalLight(0xffe0bb, 0.28);
        rim.position.set(60, 26, 70);
        this.scene.add(rim);
    }

    private buildLiftAlcove(marble: THREE.MeshStandardMaterial, gilded: THREE.MeshStandardMaterial) {
        const dais = new THREE.Group();
        placeOnRing(dais, CRYSTAL_ANGLE, CRYSTAL_RADIUS);

        for (let step = 0; step < 2; step++) {
            const radius = 5.2 - step * 1.3;
            const top = 0.3 + step * 0.3;
            const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius + 0.3, 0.3, 32), marble);
            disc.position.y = top - 0.15;
            disc.receiveShadow = true;
            disc.castShadow = true;
            dais.add(disc);
        }

        const ring = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.12, 6, 48), gilded);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.62;
        dais.add(ring);

        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 4.6, 12), gilded);
            post.position.set(Math.cos(angle) * 4.2, 2.9, Math.sin(angle) * 4.2);
            post.castShadow = true;
            dais.add(post);

            const finial = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), gilded);
            finial.position.set(Math.cos(angle) * 4.2, 5.35, Math.sin(angle) * 4.2);
            dais.add(finial);
        }

        const canopy = new THREE.Mesh(new THREE.ConeGeometry(5.4, 2.4, 4), marble);
        canopy.rotation.y = Math.PI / 4;
        canopy.position.y = 6.6;
        canopy.castShadow = true;
        dais.add(canopy);

        this.scene.add(dais);

        this.createCentralCrystal(new THREE.Vector3(dais.position.x, 1.2, dais.position.z));
    }

    private bakeEnvironment() {
        const renderer = this.renderer;
        if (!renderer) return;

        const target = new THREE.WebGLCubeRenderTarget(isLowEndDevice() ? 128 : 256, { type: THREE.HalfFloatType });
        const camera = new THREE.CubeCamera(1, 20000, target);
        camera.position.set(0, ENV_PROBE_HEIGHT, 0);
        this.scene.add(camera);

        this.shell.setShaftsVisible(false);
        camera.update(renderer, this.scene);
        this.shell.setShaftsVisible(true);

        this.scene.remove(camera);

        const pmrem = new THREE.PMREMGenerator(renderer);
        this.environmentMap = pmrem.fromCubemap(target.texture).texture;
        pmrem.dispose();
        target.dispose();

        this.scene.environment = this.environmentMap;
        this.scene.environmentIntensity = 0.55;
    }

    public applyEventStates(events: ResolvedEvent[]) {
        this.doors?.applyEvents(events);
    }

    public override getInteractables(): THREE.Object3D[] {
        return [...super.getInteractables(), ...this.doors.getInteractables()];
    }

    override update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        super.update(playerPosition, delta, isEPressed);

        this.shell.update(delta);
        this.doors.update(playerPosition, delta);
        this.props.update(delta);
        this.trackShadowCamera(playerPosition);
    }

    private trackShadowCamera(playerPosition: THREE.Vector3) {
        const light = this.keyLight;
        if (!light) return;

        const texel = (SHADOW_EXTENT * 2) / light.shadow.mapSize.width;
        const x = Math.round(playerPosition.x / texel) * texel;
        const z = Math.round(playerPosition.z / texel) * texel;

        light.target.position.set(x, 0, z);
        light.position.copy(this.shell.sunDirection).multiplyScalar(DOME_BASE_Y + 120);
        light.position.x += x;
        light.position.z += z;
        light.target.updateMatrixWorld();
    }

    getSpawnPoint(): THREE.Vector3 {
        return SPAWN_POINT.clone();
    }

    dispose() {
        this.shell?.dispose();
        this.doors?.dispose();
        this.props?.dispose();
        this.keyLight = null;

        this.scene.environment = null;
        this.environmentMap?.dispose();
        this.environmentMap = null;

        super.dispose();
        this.bin.dispose();
    }
}
