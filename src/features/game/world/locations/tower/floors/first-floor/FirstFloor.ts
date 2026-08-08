// src/features/game/world/locations/tower/floors/first-floor/FirstFloor.ts
import * as THREE from "three";
import { TowerFloor } from "../../TowerFloor";
import { ResourceManager } from "../../../../../core/ResourceManager";
import { CollisionGrid } from "../../../../CollisionGrid";
import { segmentStartZ, pathOffsetX } from "./utils/canyonMath";
import { CanyonBiome, biomeForSegment, biomeFromKey } from "./utils/canyonBiomes";
import { SegmentBuilderSystem, SegmentContent } from "./systems/SegmentBuilderSystem";
import { GateAnimationSystem } from "./systems/GateAnimationSystem";
import { ProgressionSystem } from "./systems/ProgressionSystem";

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
    private hemi: THREE.HemisphereLight | null = null;

    public readonly segmentBuilder: SegmentBuilderSystem;
    public readonly gateAnimation: GateAnimationSystem;
    public readonly progression: ProgressionSystem;

    public onInteractablesChanged?: (added: THREE.Object3D[], removed: THREE.Object3D[]) => void;
    public onReadyToEnterDungeon?: () => void;
    public onSegmentCrossed?: () => void;

    constructor() {
        super('tower-first-floor', 'Slime Valley');
        this.collisionGrid = new CollisionGrid(300);

        this.segmentBuilder = new SegmentBuilderSystem(this);
        this.gateAnimation = new GateAnimationSystem(this);
        this.progression = new ProgressionSystem(this);
    }

    create(resourceManager: ResourceManager): void {
        this.scene.background = new THREE.Color(0xC9A876);
        this.scene.fog = new THREE.FogExp2(0xC9A876, 0.0028);

        const sun = new THREE.DirectionalLight(this.biome.sunColor, this.biome.sunIntensity);
        this.sun = sun;
        sun.position.set(120, 220, 80);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.left = -150;
        sun.shadow.camera.right = 150;
        sun.shadow.camera.top = 150;
        sun.shadow.camera.bottom = -150;
        sun.shadow.camera.near = 10;
        sun.shadow.camera.far = 700;
        this.scene.add(sun);

        this.hemi = new THREE.HemisphereLight(this.biome.hemiSky, this.biome.hemiGround, this.biome.hemiIntensity);
        this.scene.add(this.hemi);

        this.hub = this.segmentBuilder.buildHub(resourceManager);
        this.segmentBuilder.rebuildCollisionGrid();
    }

    public applyBiome(key: string | undefined, segment: number): void {
        const biome = biomeFromKey(key, segment);
        this.biome = biome;

        (this.scene.background as THREE.Color)?.setHex(biome.sky);
        const fog = this.scene.fog as THREE.FogExp2 | null;
        if (fog) {
            fog.color.setHex(biome.sky);
            fog.density = biome.fogDensity;
        }
        if (this.sun) {
            this.sun.color.setHex(biome.sunColor);
            this.sun.intensity = biome.sunIntensity;
        }
        if (this.hemi) {
            this.hemi.color.setHex(biome.hemiSky);
            this.hemi.groundColor.setHex(biome.hemiGround);
            this.hemi.intensity = biome.hemiIntensity;
        }
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

        if (this.hub.crystal) {
            const t = performance.now() * 0.002;
            this.hub.crystal.rotation.y += delta * 0.6;
            this.hub.crystal.position.y = 1.5 + Math.sin(t) * 0.2;
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

    getSpawnPoint(): THREE.Vector3 {
        if (this.inHub) {
            return new THREE.Vector3(0, 2, 20);
        }
        const startZ = segmentStartZ(this.segment);
        return new THREE.Vector3(pathOffsetX(startZ + 20), 2, startZ + 20);
    }

    public override getInteractables(): THREE.Object3D[] {
        if (this.inHub) return this.hub.interactables;
        return [...(this.current?.interactables ?? []), ...(this.pendingNext?.interactables ?? [])];
    }

    dispose() {
        this.segmentBuilder.disposeContent(this.hub);
        if (this.current) this.segmentBuilder.disposeContent(this.current);
        if (this.pendingNext) this.segmentBuilder.disposeContent(this.pendingNext);
        super.dispose();
    }
}
