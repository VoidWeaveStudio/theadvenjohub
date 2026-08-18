// src/features/game/systems/ViewModelTuner.ts
import * as THREE from "three";
import { InputManager } from "../core/InputManager";
import { DefusalViewModel } from "../entities/DefusalViewModel";

const MOVE_STEP = 0.004;
const ROTATE_STEP = 0.02;

type Axis = "px" | "py" | "pz" | "rx" | "ry" | "rz";

const BINDINGS: Array<{ code: string; axis: Axis; sign: number }> = [
    { code: "Numpad4", axis: "px", sign: -1 },
    { code: "Numpad6", axis: "px", sign: 1 },
    { code: "Numpad8", axis: "py", sign: 1 },
    { code: "Numpad2", axis: "py", sign: -1 },
    { code: "Numpad7", axis: "pz", sign: -1 },
    { code: "Numpad9", axis: "pz", sign: 1 },
    { code: "Numpad1", axis: "ry", sign: -1 },
    { code: "Numpad3", axis: "ry", sign: 1 },
    { code: "NumpadSubtract", axis: "rx", sign: -1 },
    { code: "NumpadAdd", axis: "rx", sign: 1 },
    { code: "NumpadDivide", axis: "rz", sign: -1 },
    { code: "NumpadMultiply", axis: "rz", sign: 1 },
];

export class ViewModelTuner {
    public onReadout?: (text: string | null) => void;

    private enabled = false;
    private target: "weapon" | "hands" = "weapon";
    private inputManager: InputManager | null = null;
    private viewModel: DefusalViewModel | null = null;

    private readonly weaponOffset = new THREE.Vector3();
    private readonly weaponEuler = new THREE.Euler();
    private readonly handOffset = new THREE.Vector3();

    init(inputManager: InputManager, viewModel: DefusalViewModel) {
        this.inputManager = inputManager;
        this.viewModel = viewModel;
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    isReady(): boolean {
        return this.viewModel !== null;
    }

    toggle() {
        if (!this.viewModel) return;

        this.enabled = !this.enabled;
        if (this.enabled) this.emit();
        else this.onReadout?.(null);
    }

    update() {
        if (!this.enabled || !this.inputManager || !this.viewModel) return;

        if (this.inputManager.isKeyJustPressed("NumpadEnter")) {
            this.target = this.target === "weapon" ? "hands" : "weapon";
            this.emit();
            return;
        }

        if (this.inputManager.isKeyJustPressed("Numpad5")) {
            console.log("[ViewModelTuner]", this.snippet());
        }

        let changed = false;
        for (const binding of BINDINGS) {
            if (!this.inputManager.isKeyPressed(binding.code)) continue;
            if (this.target === "hands" && binding.axis.startsWith("r")) continue;

            changed = true;
            const step = binding.sign * (binding.axis.startsWith("p") ? MOVE_STEP : ROTATE_STEP);
            const offset = this.target === "weapon" ? this.weaponOffset : this.handOffset;

            if (binding.axis === "px") offset.x += step;
            else if (binding.axis === "py") offset.y += step;
            else if (binding.axis === "pz") offset.z += step;
            else if (binding.axis === "rx") this.weaponEuler.x += step;
            else if (binding.axis === "ry") this.weaponEuler.y += step;
            else this.weaponEuler.z += step;
        }

        if (!changed) return;

        if (this.target === "weapon") this.viewModel.setRigTransform(this.weaponOffset, this.weaponEuler);
        else this.viewModel.setHandOffset(this.handOffset);

        this.emit();
    }

    private snippet(): string {
        const f = (value: number) => value.toFixed(4);
        return [
            `[${this.target}] Enter switches`,
            `weapon pos(${f(this.weaponOffset.x)}, ${f(this.weaponOffset.y)}, ${f(this.weaponOffset.z)})`,
            `rot(${f(this.weaponEuler.x)}, ${f(this.weaponEuler.y)}, ${f(this.weaponEuler.z)})`,
            `hands(${f(this.handOffset.x)}, ${f(this.handOffset.y)}, ${f(this.handOffset.z)})`,
        ].join("  |  ");
    }

    private emit() {
        this.onReadout?.(this.snippet());
    }
}
