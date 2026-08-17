// src/features/game/systems/WeaponTuner.ts
import * as THREE from "three";
import { InputManager } from "../core/InputManager";
import { Weapon } from "../entities/Weapon";

const MOVE_STEP = 0.01;
const ROTATE_STEP = 0.02;

const BINDINGS: Array<{ code: string; axis: "px" | "py" | "pz" | "rx" | "ry" | "rz"; sign: number }> = [
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

export class WeaponTuner {
    public onReadout?: (text: string | null) => void;

    private enabled = false;
    private inputManager: InputManager | null = null;
    private weapon: Weapon | null = null;

    private readonly offset = new THREE.Vector3();
    private readonly euler = new THREE.Euler();

    init(inputManager: InputManager, weapon: Weapon) {
        this.inputManager = inputManager;
        this.weapon = weapon;
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    toggle() {
        if (!this.weapon) return;

        this.enabled = !this.enabled;
        if (this.enabled) {
            this.offset.copy(this.weapon.mesh.position);
            this.euler.set(0, 0, 0);
            this.emit();
            return;
        }

        this.onReadout?.(null);
    }

    update() {
        if (!this.enabled || !this.inputManager || !this.weapon) return;

        let changed = false;
        for (const binding of BINDINGS) {
            if (!this.inputManager.isKeyPressed(binding.code)) continue;

            changed = true;
            const step = binding.sign * (binding.axis.startsWith("p") ? MOVE_STEP : ROTATE_STEP);

            if (binding.axis === "px") this.offset.x += step;
            else if (binding.axis === "py") this.offset.y += step;
            else if (binding.axis === "pz") this.offset.z += step;
            else if (binding.axis === "rx") this.euler.x += step;
            else if (binding.axis === "ry") this.euler.y += step;
            else this.euler.z += step;
        }

        if (this.inputManager.isKeyJustPressed("Numpad5")) {
            console.log("[WeaponTuner]", this.snippet());
        }

        if (!changed) return;

        this.weapon.setGripTransform(this.offset, this.euler);
        this.emit();
    }

    private snippet(): string {
        const f = (value: number) => value.toFixed(4);
        return [
            `offset new THREE.Vector3(${f(this.offset.x)}, ${f(this.offset.y)}, ${f(this.offset.z)})`,
            `rotation new THREE.Euler(${f(this.euler.x)}, ${f(this.euler.y)}, ${f(this.euler.z)})`,
        ].join("  |  ");
    }

    private emit() {
        this.onReadout?.(this.snippet());
    }
}
