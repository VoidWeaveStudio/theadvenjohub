// src/features/game/world/locations/main-world/systems/WaterAmbienceSystem.ts
import * as THREE from "three";
import { SoundManager, type SoundHandle } from "../../../../core/SoundManager";
import type { TerrainSystem } from "./TerrainSystem";
import { SEA_LEVEL, SHORE_RADIUS } from "../worldConfig";

const SAMPLE_INTERVAL = 0.35;
const PROBE_RINGS = [4, 12, 26, 48, 78];
const PROBE_DIRECTIONS = 8;
const AUDIBLE_RANGE = 78;
const OCEAN_VOLUME = 0.55;
const WAVE_MIN_GAP = 2.2;
const WAVE_GAP_SPREAD = 2.6;
const LAKE_VOLUME = 0.32;
const FADE_SECONDS = 0.9;

export class WaterAmbienceSystem {
    private lakeHandle: SoundHandle | null = null;

    private oceanLevel = 0;
    private lakeLevel = 0;
    private timer = 0;
    private waveTimer = 0;

    constructor(private readonly terrain: TerrainSystem) { }

    private isOcean(x: number, z: number): boolean {
        return Math.hypot(x, z) > SHORE_RADIUS * 0.82;
    }

    private submerged(x: number, z: number): boolean {
        if (this.terrain.getHeightAt(x, z) < SEA_LEVEL - 0.15) return true;

        for (const lake of this.terrain.lakes) {
            const dx = x - lake.x;
            const dz = z - lake.z;
            if (dx * dx + dz * dz > lake.radius * lake.radius) continue;
            if (this.terrain.getHeightAt(x, z) < lake.level) return true;
        }

        return false;
    }

    private measure(position: THREE.Vector3): { ocean: number; lake: number } {
        let oceanDistance = Number.POSITIVE_INFINITY;
        let lakeDistance = Number.POSITIVE_INFINITY;

        const record = (x: number, z: number, distance: number) => {
            if (!this.submerged(x, z)) return;
            if (this.isOcean(x, z)) oceanDistance = Math.min(oceanDistance, distance);
            else lakeDistance = Math.min(lakeDistance, distance);
        };

        record(position.x, position.z, 0);

        for (const radius of PROBE_RINGS) {
            if (radius > AUDIBLE_RANGE) break;
            for (let i = 0; i < PROBE_DIRECTIONS; i++) {
                const angle = (i / PROBE_DIRECTIONS) * Math.PI * 2;
                record(position.x + Math.cos(angle) * radius, position.z + Math.sin(angle) * radius, radius);
            }
        }

        const falloff = (distance: number) => {
            if (!Number.isFinite(distance)) return 0;
            const t = 1 - Math.min(1, distance / AUDIBLE_RANGE);
            return t * t;
        };

        return { ocean: falloff(oceanDistance), lake: falloff(lakeDistance) };
    }

    private ensureLoop(handle: SoundHandle | null, name: string): SoundHandle | null {
        if (handle) return handle;
        return SoundManager.getInstance().playLoop(name, { volume: 0.0008 });
    }

    public update(delta: number, position: THREE.Vector3) {
        this.waveTimer -= delta;
        if (this.waveTimer <= 0 && this.oceanLevel > 0.01) {
            this.waveTimer = WAVE_MIN_GAP + Math.random() * WAVE_GAP_SPREAD;
            SoundManager.getInstance().playOceanWave(this.oceanLevel);
        }

        this.timer -= delta;
        if (this.timer > 0) return;
        this.timer = SAMPLE_INTERVAL;

        const { ocean, lake } = this.measure(position);

        this.oceanLevel = ocean * OCEAN_VOLUME;

        const lakeTarget = lake * LAKE_VOLUME;
        if (lakeTarget > 0.002 || this.lakeLevel > 0.002) {
            this.lakeHandle = this.ensureLoop(this.lakeHandle, "ambient-water");
            this.lakeHandle?.setVolume?.(lakeTarget, FADE_SECONDS);
            this.lakeLevel = lakeTarget;
        }
    }

    public dispose() {
        this.lakeHandle?.stop(0.4);
        this.lakeHandle = null;
    }
}
