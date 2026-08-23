// src/features/game/world/locations/tower/floors/first-floor/FirstFloor.ts
import * as THREE from "three";
import { TowerFloor } from "../../TowerFloor";
import { ResourceManager } from "../../../../../core/ResourceManager";
import { CollisionGrid } from "../../../../CollisionGrid";
import { prefersMobileProfile } from "@/features/game/core/graphicsSettings";
import { segmentStartZ, pathOffsetX } from "./utils/canyonMath";
import { CanyonBiome, biomeForSegment, biomeFromKey, biomeSunDirection } from "./utils/canyonBiomes";
import { CanyonTerrain, canyonHeight } from "./utils/canyonTerrain";
import { SegmentBuilderSystem, SegmentContent } from "./systems/SegmentBuilderSystem";
import { CanyonSkySystem } from "./systems/CanyonSkySystem";
import { CanyonAtmosphereSystem } from "./systems/CanyonAtmosphereSystem";
import { GateAnimationSystem } from "./systems/GateAnimationSystem";
import { ProgressionSystem } from "./systems/ProgressionSystem";

const SUN_DISTANCE = 220;
const SHADOW_EXTENT = 115;

export interface CanyonSegmentInfo {
    biome?: string;
    segment: number;
    maxSegmentReached: number;
    cleared: boolean;
    name: string;
}

export interface CanyonClearedInfo {
    biome?: string;
    clearedSegment: number;
    segment: number;
    maxSegmentReached: number;
    name: string;
}

export interface CanyonHubInfo {
    maxSegmentReached: number;
}

export class FirstFloor extends TowerFloor {
    public maxPlayerRadius: number | null = null;

    public hub!: SegmentContent;
    public current: SegmentContent | null = null;
    public pendingNext: SegmentContent | null = null;
    public thresholdZ: number | null = null;
    private dispatcherTime: number = 0;

    public segment: number = 1;
    public inHub: boolean = true;
    public biome: CanyonBiome = biomeForSegment(1);

    private sun: THREE.DirectionalLight | null = null;
    private sunTarget: THREE.Object3D | null = null;
    private bounce: THREE.DirectionalLight | null = null;
    private hemi: THREE.HemisphereLight | null = null;

    public sky: CanyonSkySystem | null = null;
    public atmosphere: CanyonAtmosphereSystem | null = null;

    public readonly segmentBuilder: SegmentBuilderSystem;
    public readonly gateAnimation: GateAnimationSystem;
    public readonly progression: ProgressionSystem;

    private readonly highQuality: boolean;
    private readonly sunOffset = new THREE.Vector3();

    public onInteractablesChanged?: (added: THREE.Object3D[], removed: THREE.Object3D[]) => void;
    public onReadyToEnterDungeon?: () => void;
    public onSegmentCrossed?: () => void;

    constructor() {
        super('tower-first-floor', 'Slime Valley');
        this.collisionGrid = new CollisionGrid(40);
        this.terrain = new CanyonTerrain();

        this.highQuality = !prefersMobileProfile()
            && !((typeof navigator !== "undefined" && navigator.hardwareConcurrency != null)
                ? navigator.hardwareConcurrency <= 4
                : false);

        this.segmentBuilder = new SegmentBuilderSystem(this, this.highQuality);
        this.gateAnimation = new GateAnimationSystem(this);
        this.progression = new ProgressionSystem(this);
    }

    create(resourceManager: ResourceManager): void {
        this.scene.background = new THREE.Color(this.biome.fogColor);
        this.scene.fog = new THREE.FogExp2(this.biome.fogColor, this.biome.fogDensity);

        this.sky = new CanyonSkySystem(this.scene, this.highQuality);
        this.atmosphere = new CanyonAtmosphereSystem(this.scene, this.highQuality);

        const sun = new THREE.DirectionalLight(this.biome.sunColor, this.biome.sunIntensity);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.left = -SHADOW_EXTENT;
        sun.shadow.camera.right = SHADOW_EXTENT;
        sun.shadow.camera.top = SHADOW_EXTENT;
        sun.shadow.camera.bottom = -SHADOW_EXTENT;
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = SUN_DISTANCE * 2.4;
        sun.shadow.bias = -0.0005;
        sun.shadow.normalBias = 0.06;
        this.sun = sun;

        this.sunTarget = new THREE.Object3D();
        sun.target = this.sunTarget;
        this.scene.add(sun);
        this.scene.add(this.sunTarget);

        const bounce = new THREE.DirectionalLight(this.biome.bounceColor, this.biome.bounceIntensity);
        this.bounce = bounce;
        this.scene.add(bounce);
        this.scene.add(bounce.target);

        this.hemi = new THREE.HemisphereLight(this.biome.hemiSky, this.biome.hemiGround, this.biome.hemiIntensity);
        this.scene.add(this.hemi);

        this.applyBiome(this.biome.key, 1);

        this.hub = this.segmentBuilder.buildHub(resourceManager);
        this.segmentBuilder.rebuildCollisionGrid();
    }

    public applyBiome(key: string | undefined, segment: number): void {
        const biome = biomeFromKey(key, segment);
        this.biome = biome;

        (this.scene.background as THREE.Color)?.setHex(biome.fogColor);
        const fog = this.scene.fog as THREE.FogExp2 | null;
        if (fog) {
            fog.color.setHex(biome.fogColor);
            fog.density = biome.fogDensity;
        }

        const direction = biomeSunDirection(biome);
        this.sunOffset.set(direction.x, direction.y, direction.z).normalize().multiplyScalar(SUN_DISTANCE);

        if (this.sun) {
            this.sun.color.setHex(biome.sunColor);
            this.sun.intensity = biome.sunIntensity;
        }
        if (this.bounce) {
            this.bounce.color.setHex(biome.bounceColor);
            this.bounce.intensity = biome.bounceIntensity;
        }
        if (this.hemi) {
            this.hemi.color.setHex(biome.hemiSky);
            this.hemi.groundColor.setHex(biome.hemiGround);
            this.hemi.intensity = biome.hemiIntensity;
        }

        this.sky?.applyBiome(biome);
        if (this.sky) this.atmosphere?.applyBiome(biome, this.sky.sunDirection);
    }

    public getSunLight(): THREE.DirectionalLight | null {
        return this.sun;
    }

    public applyFreshSegment(info: CanyonSegmentInfo): void {
        this.progression.applyFreshSegment(info);
    }

    public applyHub(info: CanyonHubInfo): void {
        this.progression.applyHub(info);
    }

    public applyBossDefeated(info: CanyonClearedInfo): void {
        this.progression.applyBossDefeated(info);
    }

    update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        super.update(playerPosition, delta, isEPressed);

        this.followPlayerWithLighting(playerPosition);
        this.sky?.update(playerPosition);
        this.atmosphere?.update(delta, playerPosition, this.camera);

        if (this.hub.crystal) {
            const t = performance.now() * 0.002;
            this.hub.crystal.rotation.y += delta * 0.6;
            this.hub.crystal.position.y = (this.hub.crystalBaseY ?? 1.5) + Math.sin(t) * 0.2;
        }
        if (this.hub.dispatcher) {
            this.dispatcherTime += delta;
            this.hub.dispatcher.group.rotation.y = Math.sin(this.dispatcherTime * 0.4) * 0.3;
            this.hub.dispatcher.update(delta);
        }

        this.gateAnimation.updateAnimations();

        const time = performance.now() * 0.001;
        if (this.hub.arrow?.visible) this.gateAnimation.pulseArrow(this.hub.arrow, time);
        if (this.current?.arrow?.visible) this.gateAnimation.pulseArrow(this.current.arrow, time);
        if (this.pendingNext?.arrow?.visible) this.gateAnimation.pulseArrow(this.pendingNext.arrow, time);

        this.progression.checkHubGateTrigger(playerPosition);
    }

    private followPlayerWithLighting(playerPosition: THREE.Vector3) {
        if (!this.sun || !this.sunTarget) return;

        this.sunTarget.position.copy(playerPosition);
        this.sunTarget.updateMatrixWorld();
        this.sun.position.copy(playerPosition).add(this.sunOffset);

        if (this.bounce) {
            this.bounce.position.set(
                playerPosition.x - this.sunOffset.x * 0.7,
                playerPosition.y + 40,
                playerPosition.z - this.sunOffset.z * 0.7
            );
            this.bounce.target.position.copy(playerPosition);
            this.bounce.target.updateMatrixWorld();
        }
    }

    getSpawnPoint(): THREE.Vector3 {
        if (this.inHub) {
            return new THREE.Vector3(0, canyonHeight(0, 20) + 0.5, 20);
        }
        const startZ = segmentStartZ(this.segment);
        const z = startZ + 20;
        const x = pathOffsetX(z);
        return new THREE.Vector3(x, canyonHeight(x, z) + 0.5, z);
    }

    public override getInteractables(): THREE.Object3D[] {
        if (this.inHub) return this.hub.interactables;
        return [...(this.current?.interactables ?? []), ...(this.pendingNext?.interactables ?? [])];
    }

    dispose() {
        this.segmentBuilder.disposeContent(this.hub);
        if (this.current) this.segmentBuilder.disposeContent(this.current);
        if (this.pendingNext) this.segmentBuilder.disposeContent(this.pendingNext);
        this.sky?.dispose();
        this.atmosphere?.dispose();
        this.segmentBuilder.dispose();
        this.sky = null;
        this.atmosphere = null;
        super.dispose();
    }
}
