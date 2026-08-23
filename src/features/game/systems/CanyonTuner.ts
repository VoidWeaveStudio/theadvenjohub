// src/features/game/systems/CanyonTuner.ts
import { InputManager } from "../core/InputManager";
import type { FirstFloor } from "../world/locations/tower/floors/first-floor/FirstFloor";

interface Knob {
    label: string;
    step: number;
    digits: number;
    get: () => number;
    set: (value: number) => void;
}

interface KnobGroup {
    name: string;
    knobs: Knob[];
}

const PAIRS: Array<{ down: string; up: string }> = [
    { down: "Numpad4", up: "Numpad6" },
    { down: "Numpad7", up: "Numpad9" },
    { down: "Numpad2", up: "Numpad8" },
];

export class CanyonTuner {
    public onReadout?: (text: string | null) => void;

    private enabled = false;
    private inputManager: InputManager | null = null;
    private floor: FirstFloor | null = null;
    private groupIndex = 0;
    private sunSharpness = 900;

    init(inputManager: InputManager, floor: FirstFloor | null) {
        this.inputManager = inputManager;
        this.floor = floor;
        if (!floor && this.enabled) {
            this.enabled = false;
            this.onReadout?.(null);
        }
    }

    isReady(): boolean {
        return !!this.floor;
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    toggle() {
        if (!this.floor) return;

        this.enabled = !this.enabled;
        if (this.enabled) {
            this.emit();
            return;
        }
        this.onReadout?.(null);
    }

    update() {
        if (!this.enabled || !this.inputManager || !this.floor) return;

        const groups = this.groups();
        if (groups.length === 0) return;

        if (this.inputManager.isKeyJustPressed("NumpadAdd")) {
            this.groupIndex = (this.groupIndex + 1) % groups.length;
            this.emit();
            return;
        }
        if (this.inputManager.isKeyJustPressed("NumpadSubtract")) {
            this.groupIndex = (this.groupIndex + groups.length - 1) % groups.length;
            this.emit();
            return;
        }
        if (this.inputManager.isKeyJustPressed("Numpad5")) {
            console.log("[CanyonTuner]", this.snippet());
            return;
        }

        const group = groups[Math.min(this.groupIndex, groups.length - 1)];
        let changed = false;

        for (let i = 0; i < group.knobs.length && i < PAIRS.length; i++) {
            const knob = group.knobs[i];
            const pair = PAIRS[i];
            if (this.inputManager.isKeyPressed(pair.up)) {
                knob.set(knob.get() + knob.step);
                changed = true;
            }
            if (this.inputManager.isKeyPressed(pair.down)) {
                knob.set(knob.get() - knob.step);
                changed = true;
            }
        }

        if (changed) this.emit();
    }

    private groups(): KnobGroup[] {
        const floor = this.floor;
        if (!floor) return [];

        const biome = floor.biome;
        const terrain = floor.segmentBuilder.terrain;
        const atmosphere = floor.atmosphere;
        const sky = floor.sky;
        const reapply = () => floor.applyBiome(biome.key, floor.segment);

        const groups: KnobGroup[] = [
            {
                name: "sun",
                knobs: [
                    { label: "alt", step: 1, digits: 0, get: () => biome.sunAltitude, set: (v) => { biome.sunAltitude = v; reapply(); } },
                    { label: "azi", step: 2, digits: 0, get: () => biome.sunAzimuth, set: (v) => { biome.sunAzimuth = v; reapply(); } },
                    { label: "int", step: 0.05, digits: 2, get: () => biome.sunIntensity, set: (v) => { biome.sunIntensity = v; reapply(); } },
                ],
            },
            {
                name: "fill",
                knobs: [
                    { label: "bounce", step: 0.02, digits: 2, get: () => biome.bounceIntensity, set: (v) => { biome.bounceIntensity = v; reapply(); } },
                    { label: "hemi", step: 0.02, digits: 2, get: () => biome.hemiIntensity, set: (v) => { biome.hemiIntensity = v; reapply(); } },
                    { label: "vein", step: 0.05, digits: 2, get: () => terrain.getUniform(biome, "uVeinStrength") ?? biome.veinStrength, set: (v) => terrain.setUniform(biome, "uVeinStrength", Math.max(0, v)) },
                ],
            },
            {
                name: "air",
                knobs: [
                    { label: "fog", step: 0.0002, digits: 4, get: () => biome.fogDensity, set: (v) => { biome.fogDensity = Math.max(0, v); reapply(); } },
                    { label: "dust", step: 0.02, digits: 2, get: () => atmosphere?.getDustOpacity() ?? 0, set: (v) => atmosphere?.setDustOpacity(v) },
                    { label: "shaft", step: 0.01, digits: 3, get: () => atmosphere?.getShaftOpacity() ?? 0, set: (v) => atmosphere?.setShaftOpacity(v) },
                ],
            },
            {
                name: "rock",
                knobs: [
                    { label: "strata", step: 0.005, digits: 3, get: () => terrain.getUniform(biome, "uStrataFreq") ?? 0, set: (v) => terrain.setUniform(biome, "uStrataFreq", Math.max(0.005, v)) },
                    { label: "rockUv", step: 0.002, digits: 3, get: () => terrain.getUniform(biome, "uRockScale") ?? 0, set: (v) => terrain.setUniform(biome, "uRockScale", Math.max(0.002, v)) },
                    { label: "sandUv", step: 0.002, digits: 3, get: () => terrain.getUniform(biome, "uGroundScale") ?? 0, set: (v) => terrain.setUniform(biome, "uGroundScale", Math.max(0.002, v)) },
                ],
            },
            {
                name: "shadow",
                knobs: [
                    { label: "bias", step: 0.0001, digits: 5, get: () => floor.getSunLight()?.shadow.bias ?? 0, set: (v) => { const sun = floor.getSunLight(); if (sun) sun.shadow.bias = v; } },
                    { label: "nBias", step: 0.01, digits: 3, get: () => floor.getSunLight()?.shadow.normalBias ?? 0, set: (v) => { const sun = floor.getSunLight(); if (sun) sun.shadow.normalBias = Math.max(0, v); } },
                    { label: "disc", step: 25, digits: 0, get: () => this.sunSharpness, set: (v) => { this.sunSharpness = Math.max(50, v); sky?.setSunSharpness(this.sunSharpness); } },
                ],
            },
        ];

        return groups;
    }

    private snippet(): string {
        const floor = this.floor;
        if (!floor) return "";

        const biome = floor.biome;
        const terrain = floor.segmentBuilder.terrain;
        const f = (value: number, digits: number) => value.toFixed(digits);

        return [
            `biome ${biome.key}`,
            `sunAltitude: ${f(biome.sunAltitude, 0)}`,
            `sunAzimuth: ${f(biome.sunAzimuth, 0)}`,
            `sunIntensity: ${f(biome.sunIntensity, 2)}`,
            `bounceIntensity: ${f(biome.bounceIntensity, 2)}`,
            `hemiIntensity: ${f(biome.hemiIntensity, 2)}`,
            `fogDensity: ${f(biome.fogDensity, 4)}`,
            `veinStrength: ${f(terrain.getUniform(biome, "uVeinStrength") ?? biome.veinStrength, 2)}`,
            `dust: ${f(floor.atmosphere?.getDustOpacity() ?? 0, 2)}`,
            `shaft: ${f(floor.atmosphere?.getShaftOpacity() ?? 0, 3)}`,
            `uStrataFreq: ${f(terrain.getUniform(biome, "uStrataFreq") ?? 0, 3)}`,
            `uRockScale: ${f(terrain.getUniform(biome, "uRockScale") ?? 0, 3)}`,
            `uGroundScale: ${f(terrain.getUniform(biome, "uGroundScale") ?? 0, 3)}`,
            `shadow.bias: ${f(floor.getSunLight()?.shadow.bias ?? 0, 5)}`,
            `shadow.normalBias: ${f(floor.getSunLight()?.shadow.normalBias ?? 0, 3)}`,
        ].join("\n");
    }

    private emit() {
        const groups = this.groups();
        if (groups.length === 0) {
            this.onReadout?.(null);
            return;
        }

        const group = groups[Math.min(this.groupIndex, groups.length - 1)];
        const values = group.knobs
            .map((knob) => `${knob.label} ${knob.get().toFixed(knob.digits)}`)
            .join("  |  ");

        this.onReadout?.(`⛰ ${group.name} (+/− group, 5 = log)  ${values}`);
    }
}
