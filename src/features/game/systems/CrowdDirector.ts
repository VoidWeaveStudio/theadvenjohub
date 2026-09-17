// src/features/game/systems/CrowdDirector.ts
import * as THREE from "three";
import { InputManager } from "../core/InputManager";
import { ResourceManager } from "../core/ResourceManager";
import { AssetBin } from "../world/AssetBin";
import { ShowcaseCrowd } from "../world/locations/showcase/actors/ShowcaseCrowd";
import { VARIANT_SETS, VariantSetId } from "../world/locations/showcase/actors/variants";

const SETS = Object.keys(VARIANT_SETS) as VariantSetId[];

const MIN_COUNT = 2;
const MAX_COUNT = 64;
const COUNT_STEP = 2;

const MIN_SPREAD = 0;
const MAX_SPREAD = 40;
const SPREAD_STEP = 1;

const MAX_POINTS = 16;
const MARKER_COLOUR = 0x4fd1ff;
const MARKER_RADIUS = 0.45;

export interface CrowdState {
    active: boolean;
    set: VariantSetId;
    count: number;
    spread: number;
    running: boolean;
    points: number;
    actors: number;
}

export class CrowdDirector {
    public onState?: (state: CrowdState | null) => void;
    public onNotification?: (key: string, duration: number, vars?: Record<string, string | number>) => void;

    private enabled = false;
    private inputManager: InputManager | null = null;
    private resourceManager: ResourceManager | null = null;

    private scene: THREE.Scene | null = null;
    private ground: ((x: number, z: number) => number) | null = null;

    private crowds: ShowcaseCrowd[] = [];
    private bins: AssetBin[] = [];
    private actorCount = 0;

    private path: THREE.Vector3[] = [];
    private markers: THREE.Mesh[] = [];
    private markerGeometry: THREE.SphereGeometry | null = null;
    private markerMaterial: THREE.MeshBasicMaterial | null = null;

    private setIndex = 0;
    private count = 16;
    private spread = 6;
    private running = true;
    private seed = 1;

    init(inputManager: InputManager, resourceManager: ResourceManager) {
        this.inputManager = inputManager;
        this.resourceManager = resourceManager;
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    setStage(scene: THREE.Scene | null, ground: ((x: number, z: number) => number) | null) {
        this.clear();
        this.scene = scene;
        this.ground = ground;
    }

    toggle() {
        this.enabled = !this.enabled;
        this.showMarkers(this.enabled);
        this.emit();
    }

    close() {
        if (!this.enabled) return;
        this.enabled = false;
        this.showMarkers(false);
        this.emit();
    }

    update(delta: number, focus: THREE.Vector3) {
        for (const crowd of this.crowds) crowd.update(delta);

        if (!this.enabled || !this.inputManager) return;

        const input = this.inputManager;
        let changed = false;

        if (input.isKeyJustPressed("KeyG")) {
            this.addPoint(focus);
            changed = true;
        }
        if (input.isKeyJustPressed("KeyT")) {
            this.spawn();
            changed = true;
        }
        if (input.isKeyJustPressed("KeyY")) {
            this.clear();
            this.onNotification?.("g.crowd.cleared", 1600);
            changed = true;
        }
        if (input.isKeyJustPressed("KeyC")) {
            this.clearPath();
            changed = true;
        }
        if (input.isKeyJustPressed("KeyN")) {
            this.count = Math.max(MIN_COUNT, this.count - COUNT_STEP);
            changed = true;
        }
        if (input.isKeyJustPressed("KeyM")) {
            this.count = Math.min(MAX_COUNT, this.count + COUNT_STEP);
            changed = true;
        }
        if (input.isKeyJustPressed("Semicolon")) {
            this.spread = Math.max(MIN_SPREAD, this.spread - SPREAD_STEP);
            changed = true;
        }
        if (input.isKeyJustPressed("Quote")) {
            this.spread = Math.min(MAX_SPREAD, this.spread + SPREAD_STEP);
            changed = true;
        }
        if (input.isKeyJustPressed("KeyV")) {
            this.setIndex = (this.setIndex + 1) % SETS.length;
            changed = true;
        }
        if (input.isKeyJustPressed("KeyB")) {
            this.running = !this.running;
            changed = true;
        }

        if (changed) this.emit();
    }

    private addPoint(focus: THREE.Vector3) {
        if (!this.scene) return;
        if (this.path.length >= MAX_POINTS) {
            this.onNotification?.("g.crowd.pathFull", 2000);
            return;
        }

        const y = this.ground ? this.ground(focus.x, focus.z) : focus.y;
        const point = new THREE.Vector3(focus.x, y, focus.z);
        this.path.push(point);

        if (!this.markerGeometry) this.markerGeometry = new THREE.SphereGeometry(MARKER_RADIUS, 12, 8);
        if (!this.markerMaterial) {
            this.markerMaterial = new THREE.MeshBasicMaterial({
                color: MARKER_COLOUR,
                transparent: true,
                opacity: 0.65,
                depthTest: false,
            });
        }

        const marker = new THREE.Mesh(this.markerGeometry, this.markerMaterial);
        marker.position.set(point.x, point.y + MARKER_RADIUS, point.z);
        marker.renderOrder = 999;
        marker.visible = this.enabled;
        this.scene.add(marker);
        this.markers.push(marker);
    }

    private showMarkers(visible: boolean) {
        for (const marker of this.markers) marker.visible = visible;
    }

    private clearPath() {
        for (const marker of this.markers) marker.parent?.remove(marker);
        this.markers.length = 0;
        this.path.length = 0;
    }

    private spawn() {
        if (!this.scene || !this.resourceManager) return;
        if (this.path.length < 2) {
            this.onNotification?.("g.crowd.needPath", 2500);
            return;
        }

        const random = this.makeRandom();
        const bin = new AssetBin();
        const crowd = new ShowcaseCrowd(this.scene, bin, random);
        crowd.setGroundProvider(this.ground);

        const set = SETS[this.setIndex];
        const pool = VARIANT_SETS[set];
        const total = this.totalLength();

        for (let i = 0; i < this.count; i++) {
            const lateral = this.spread > 0 ? (random() - 0.5) * this.spread : 0;
            const lane = this.path.map((point, index) => {
                const offset = this.lateralOffset(index);
                const wobble = this.spread > 0 ? (random() - 0.5) * 0.6 : 0;
                const x = point.x + offset.x * (lateral + wobble);
                const z = point.z + offset.z * (lateral + wobble);
                return new THREE.Vector3(x, this.ground ? this.ground(x, z) : point.y, z);
            });

            const progress = total > 0 ? (i / this.count) * total : 0;
            const placed = this.pointAt(lane, progress);

            const actor = crowd.createActor(this.resourceManager, {
                position: placed.position,
                set,
                variantIndex: i % pool.length,
                facing: placed.facing,
                walk: {
                    path: lane,
                    mode: "cycle",
                    run: this.running,
                    speed: (this.running ? 4.2 : 1.35) * (0.88 + random() * 0.24),
                },
                phase: random() * 12,
                solid: false,
            });

            actor?.setWalkIndex(placed.nextIndex);
        }

        this.crowds.push(crowd);
        this.bins.push(bin);
        this.actorCount += crowd.actors().length;
        this.onNotification?.("g.crowd.spawned", 2000, { count: this.actorCount });
    }

    private lateralOffset(index: number): THREE.Vector3 {
        const from = this.path[Math.max(0, index - 1)];
        const to = this.path[Math.min(this.path.length - 1, index + 1)];
        const dx = to.x - from.x;
        const dz = to.z - from.z;
        const length = Math.hypot(dx, dz);
        if (length < 0.001) return new THREE.Vector3(1, 0, 0);
        return new THREE.Vector3(-dz / length, 0, dx / length);
    }

    private totalLength(): number {
        let total = 0;
        for (let i = 1; i < this.path.length; i++) {
            total += this.path[i].distanceTo(this.path[i - 1]);
        }
        return total;
    }

    private pointAt(lane: THREE.Vector3[], distance: number): { position: THREE.Vector3; nextIndex: number; facing: number } {
        let travelled = 0;

        for (let i = 1; i < lane.length; i++) {
            const segment = lane[i].distanceTo(lane[i - 1]);
            if (travelled + segment >= distance || i === lane.length - 1) {
                const t = segment > 0 ? Math.min(1, (distance - travelled) / segment) : 0;
                const position = lane[i - 1].clone().lerp(lane[i], t);
                const facing = Math.atan2(lane[i].x - lane[i - 1].x, lane[i].z - lane[i - 1].z);
                return { position, nextIndex: i, facing };
            }
            travelled += segment;
        }

        return { position: lane[0].clone(), nextIndex: 1, facing: 0 };
    }

    private clearActors() {
        for (const crowd of this.crowds) crowd.dispose();
        for (const bin of this.bins) bin.dispose();
        this.crowds.length = 0;
        this.bins.length = 0;
        this.actorCount = 0;
    }

    clear() {
        this.clearActors();
        this.clearPath();
        this.emit();
    }

    dispose() {
        this.clearActors();
        this.clearPath();
        this.markerGeometry?.dispose();
        this.markerGeometry = null;
        this.markerMaterial?.dispose();
        this.markerMaterial = null;
        this.scene = null;
        this.ground = null;
        this.enabled = false;
    }

    private makeRandom(): () => number {
        let state = (this.seed = (this.seed * 1664525 + 1013904223) >>> 0);
        return () => {
            state = (state * 1664525 + 1013904223) >>> 0;
            return state / 4294967296;
        };
    }

    private emit() {
        if (!this.enabled) {
            this.onState?.(null);
            return;
        }

        this.onState?.({
            active: true,
            set: SETS[this.setIndex],
            count: this.count,
            spread: this.spread,
            running: this.running,
            points: this.path.length,
            actors: this.actorCount,
        });
    }
}
