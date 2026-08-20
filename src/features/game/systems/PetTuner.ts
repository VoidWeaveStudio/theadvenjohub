// src/features/game/systems/PetTuner.ts
import { InputManager } from "../core/InputManager";
import type { PetSystem, PetTuning } from "./PetSystem";

const STEP = {
    followDistance: 0.1,
    followSide: 0.1,
    scale: 0.02,
    runSpeed: 0.25,
    walkSpeed: 0.25,
};

const BINDINGS: Array<{ code: string; key: keyof PetTuning; sign: number }> = [
    { code: "Numpad4", key: "followDistance", sign: -1 },
    { code: "Numpad6", key: "followDistance", sign: 1 },
    { code: "Numpad7", key: "followSide", sign: -1 },
    { code: "Numpad9", key: "followSide", sign: 1 },
    { code: "Numpad8", key: "scale", sign: 1 },
    { code: "Numpad2", key: "scale", sign: -1 },
    { code: "NumpadAdd", key: "runSpeed", sign: 1 },
    { code: "NumpadSubtract", key: "runSpeed", sign: -1 },
    { code: "NumpadMultiply", key: "walkSpeed", sign: 1 },
    { code: "NumpadDivide", key: "walkSpeed", sign: -1 },
];

export class PetTuner {
    public onReadout?: (text: string | null) => void;

    private enabled = false;
    private inputManager: InputManager | null = null;
    private pet: PetSystem | null = null;

    init(inputManager: InputManager, pet: PetSystem) {
        this.inputManager = inputManager;
        this.pet = pet;
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    isReady(): boolean {
        return !!this.pet?.isActive();
    }

    toggle() {
        if (!this.pet) return;

        this.enabled = !this.enabled;
        if (this.enabled) {
            this.emit();
            return;
        }
        this.onReadout?.(null);
    }

    update() {
        if (!this.enabled || !this.inputManager || !this.pet) return;

        const tuning = this.pet.getTuning();
        let changed = false;

        for (const binding of BINDINGS) {
            if (!this.inputManager.isKeyPressed(binding.code)) continue;
            changed = true;
            tuning[binding.key] = tuning[binding.key] + binding.sign * STEP[binding.key];
        }

        if (this.inputManager.isKeyJustPressed("Numpad5")) {
            console.log("[PetTuner]", this.snippet());
        }

        if (!changed) return;

        this.pet.setTuning(tuning);
        this.emit();
    }

    private snippet(): string {
        if (!this.pet) return "";
        const t = this.pet.getTuning();
        const f = (value: number) => value.toFixed(2);
        return [
            `follow ${f(t.followDistance)}m`,
            `side ${f(t.followSide)}m`,
            `scale ${f(t.scale)}`,
            `run ${f(t.runSpeed)}`,
            `walk ${f(t.walkSpeed)}`,
        ].join("  |  ");
    }

    private emit() {
        this.onReadout?.(this.snippet());
    }
}
