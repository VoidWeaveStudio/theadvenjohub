// src/features/game/systems/WeaponTuner.ts
import { InputManager } from "../core/InputManager";
import type { Player } from "../entities/Player";
import { weaponPoseSlot, weaponPoseSnippet, type WeaponPose } from "../entities/weaponPoses";

const MOVE_STEP = 0.005;
const ROTATE_STEP = 0.02;
const SCALE_STEP = 0.01;
const MIN_SCALE = 0.2;
const MAX_SCALE = 4;

type Mode = "move" | "turn";

const AXIS_BINDINGS: Array<{ code: string; axis: "x" | "y" | "z"; sign: number }> = [
    { code: "Numpad4", axis: "x", sign: -1 },
    { code: "Numpad6", axis: "x", sign: 1 },
    { code: "Numpad2", axis: "y", sign: -1 },
    { code: "Numpad8", axis: "y", sign: 1 },
    { code: "Numpad7", axis: "z", sign: -1 },
    { code: "Numpad9", axis: "z", sign: 1 },
];

export class WeaponTuner {
    public onReadout?: (text: string | null) => void;

    private enabled = false;
    private inputManager: InputManager | null = null;
    private player: Player | null = null;

    private mode: Mode = "move";
    private clipIndex = -1;

    init(inputManager: InputManager, player: Player) {
        this.inputManager = inputManager;
        this.player = player;
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    toggle() {
        if (!this.player) return;

        this.enabled = !this.enabled;

        if (this.enabled) {
            this.mode = "move";
            this.emit();
            return;
        }

        this.clipIndex = -1;
        this.player.playPose(null);
        this.onReadout?.(null);
    }

    update() {
        if (!this.enabled || !this.inputManager || !this.player) return;

        const input = this.inputManager;
        const target = this.slot();
        let changed = false;

        if (input.isKeyJustPressed("Numpad0")) {
            this.mode = this.mode === "move" ? "turn" : "move";
            this.emit();
            return;
        }

        for (const binding of AXIS_BINDINGS) {
            if (!input.isKeyPressed(binding.code)) continue;

            if (this.mode === "move") target.position[binding.axis] += binding.sign * MOVE_STEP;
            else target.euler[binding.axis] += binding.sign * ROTATE_STEP;

            changed = true;
        }

        if (input.isKeyPressed("NumpadAdd")) {
            target.scale = Math.min(MAX_SCALE, target.scale + SCALE_STEP);
            changed = true;
        }
        if (input.isKeyPressed("NumpadSubtract")) {
            target.scale = Math.max(MIN_SCALE, target.scale - SCALE_STEP);
            changed = true;
        }

        const next = input.isKeyJustPressed("Numpad3");
        const previous = input.isKeyJustPressed("Numpad1");
        if (next || previous) {
            const clips = this.player.listAnimations();
            if (clips.length > 0) {
                this.clipIndex = (this.clipIndex + (next ? 1 : -1) + clips.length) % clips.length;
                this.player.playPose(clips[this.clipIndex]);
                changed = true;
            }
        }

        if (input.isKeyJustPressed("NumpadMultiply")) {
            this.clipIndex = -1;
            this.player.playPose(null);
            changed = true;
        }

        if (input.isKeyJustPressed("Numpad5")) {
            console.log("[WeaponTuner]", weaponPoseSnippet(this.clipName(), this.slot()));
        }

        if (changed) this.emit();
    }

    private clipName(): string {
        return this.player?.currentAnimation() ?? "";
    }

    private slot(): WeaponPose {
        const weapon = this.player!.getWeapon();
        return weaponPoseSlot(weapon.kind, this.clipName());
    }

    private emit() {
        const target = this.slot();
        const f = (value: number) => value.toFixed(3);
        const active = this.mode === "move" ? "MOVE" : "TURN";

        this.onReadout?.(
            `🔫 ${active}  ${this.clipName()}`
            + `  pos ${f(target.position.x)} ${f(target.position.y)} ${f(target.position.z)}`
            + `  rot ${f(target.euler.x)} ${f(target.euler.y)} ${f(target.euler.z)}`
            + `  scale ${target.scale.toFixed(2)}`
            + "   (0 move/turn, 4/6 8/2 7/9 axes, +/− scale, 1/3 clip, * live, 5 log)"
        );
    }
}
