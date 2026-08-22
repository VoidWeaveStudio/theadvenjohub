// src/features/game/systems/ViewModelTuner.ts
import * as THREE from "three";
import { InputManager } from "../core/InputManager";
import { DefusalViewModel, makeTransform, type TunedTransform } from "../entities/DefusalViewModel";
import { REMOTE_WEAPON_CLIP_TRANSFORMS, remoteWeaponTransformSlot } from "../entities/defusalWeaponModels";

type Target = "weapon" | "hands" | "handR" | "handL" | "remote";
type Mode = "move" | "rotate" | "scale";

const TARGETS: Target[] = ["weapon", "hands", "handL", "handR", "remote"];
const MODES: Mode[] = ["move", "rotate", "scale"];

const STEPS = [0.001, 0.005, 0.02, 0.1];

const AXES: Array<{ code: string; axis: "x" | "y" | "z"; sign: number }> = [
    { code: "Numpad4", axis: "x", sign: -1 },
    { code: "Numpad6", axis: "x", sign: 1 },
    { code: "Numpad8", axis: "y", sign: 1 },
    { code: "Numpad2", axis: "y", sign: -1 },
    { code: "Numpad7", axis: "z", sign: -1 },
    { code: "Numpad9", axis: "z", sign: 1 },
];

// One editor for every rig we can move by hand: pick a target, pick whether you
// are moving, turning or resizing it, and nudge with the same six keys. The step
// is adjustable so the same binding does both rough placement and fine work.
export class ViewModelTuner {
    public onReadout?: (text: string | null) => void;
    public onRemoteChange?: () => void;

    // Supplied by the game so the editor can hold a remote character on one clip
    // and dial the weapon against it, instead of chasing a pose that only shows
    // up mid-sprint.
    public onPreviewClip?: (clip: string | null) => void;
    public getClips?: () => string[];
    public getCurrentClip?: () => string;

    private enabled = false;
    private targetIndex = 0;
    private modeIndex = 0;
    private stepIndex = 1;

    private clipIndex = -1;

    private inputManager: InputManager | null = null;
    private viewModel: DefusalViewModel | null = null;
    private readonly fallback = makeTransform();

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
        if (this.enabled) {
            this.emit();
            return;
        }

        this.clipIndex = -1;
        this.onPreviewClip?.(null);
        this.onReadout?.(null);
    }

    private get target(): Target {
        return TARGETS[this.targetIndex];
    }

    private get mode(): Mode {
        return MODES[this.modeIndex];
    }

    // The clip the remote weapon is being judged against: the held one while
    // previewing, otherwise whatever is playing right now.
    private clip(): string {
        const clips = this.getClips?.() ?? [];
        if (this.clipIndex >= 0 && this.clipIndex < clips.length) return clips[this.clipIndex];
        return this.getCurrentClip?.() ?? "";
    }

    private transformFor(target: Target): TunedTransform {
        if (target === "remote") return remoteWeaponTransformSlot(this.clip());
        if (!this.viewModel) return this.fallback;
        if (target === "weapon") return this.viewModel.weaponTransform;
        if (target === "handR") return this.viewModel.rightHandTransform;
        if (target === "handL") return this.viewModel.leftHandTransform;
        return this.viewModel.handsTransform;
    }

    update() {
        if (!this.enabled || !this.inputManager || !this.viewModel) return;

        const input = this.inputManager;

        if (input.isKeyJustPressed("NumpadEnter")) {
            this.targetIndex = (this.targetIndex + 1) % TARGETS.length;
            this.emit();
            return;
        }

        if (input.isKeyJustPressed("NumpadDecimal")) {
            this.modeIndex = (this.modeIndex + 1) % MODES.length;
            this.emit();
            return;
        }

        if (input.isKeyJustPressed("NumpadAdd")) {
            this.stepIndex = Math.min(STEPS.length - 1, this.stepIndex + 1);
            this.emit();
            return;
        }

        if (input.isKeyJustPressed("NumpadSubtract")) {
            this.stepIndex = Math.max(0, this.stepIndex - 1);
            this.emit();
            return;
        }

        if (input.isKeyJustPressed("NumpadMultiply")) {
            this.reset();
            return;
        }

        const nextClip = input.isKeyJustPressed("Numpad3");
        const prevClip = input.isKeyJustPressed("Numpad1");
        if (nextClip || prevClip) {
            const clips = this.getClips?.() ?? [];
            if (clips.length) {
                this.clipIndex = (this.clipIndex + (nextClip ? 1 : -1) + clips.length) % clips.length;
                this.onPreviewClip?.(clips[this.clipIndex]);
                this.emit();
            }
            return;
        }

        if (input.isKeyJustPressed("NumpadDivide")) {
            this.clipIndex = -1;
            this.onPreviewClip?.(null);
            this.emit();
            return;
        }

        if (input.isKeyJustPressed("Numpad5")) {
            console.log("[ViewModelTuner]\n" + this.snippet());
        }

        const transform = this.transformFor(this.target);
        const step = STEPS[this.stepIndex];
        let changed = false;

        for (const binding of AXES) {
            if (!input.isKeyPressed(binding.code)) continue;
            changed = true;

            const delta = binding.sign * step;
            if (this.mode === "move") transform.position[binding.axis] += delta;
            else if (this.mode === "rotate") transform.euler[binding.axis] += delta * 5;
            else transform.scale = Math.max(0.02, transform.scale + delta * 5);
        }

        if (!changed) return;
        this.commit();
        this.emit();
    }

    private reset() {
        // A per-clip weapon pose resets to the shared one, since zero is never a
        // pose anybody wants to start from.
        if (this.target === "remote" && this.clip()) {
            delete REMOTE_WEAPON_CLIP_TRANSFORMS[this.clip()];
            this.commit();
            this.emit();
            return;
        }

        const transform = this.transformFor(this.target);
        transform.position.set(0, 0, 0);
        transform.euler.set(0, 0, 0);
        transform.scale = 1;
        this.commit();
        this.emit();
    }

    private commit() {
        if (this.target === "remote") this.onRemoteChange?.();
        else this.viewModel?.applyTunedTransforms();
    }

    private snippet(): string {
        const f = (value: number) => value.toFixed(4);
        const held = this.viewModel?.heldItemId ?? "none";
        const line = (name: Target) => {
            const t = this.transformFor(name);
            return `${name.padEnd(6)} pos(${f(t.position.x)}, ${f(t.position.y)}, ${f(t.position.z)})`
                + `  rot(${f(t.euler.x)}, ${f(t.euler.y)}, ${f(t.euler.z)})`
                + `  scale ${f(t.scale)}`;
        };
        const clips = Object.keys(REMOTE_WEAPON_CLIP_TRANSFORMS).map((clip) => {
            const t = REMOTE_WEAPON_CLIP_TRANSFORMS[clip];
            return `    "${clip}": { pos: [${f(t.position.x)}, ${f(t.position.y)}, ${f(t.position.z)}],`
                + ` rot: [${f(t.euler.x)}, ${f(t.euler.y)}, ${f(t.euler.z)}], scale: ${f(t.scale)} },`;
        });

        return `weapon in hand: ${held}\n`
            + TARGETS.map(line).join("\n")
            + (clips.length ? `\nper-clip remote:\n${clips.join("\n")}` : "");
    }

    private emit() {
        const t = this.transformFor(this.target);
        const f = (value: number) => value.toFixed(3);
        const clip = this.target === "remote" ? this.clip() : "";
        const label = this.target !== "remote" ? ""
            : clip ? `[${clip}${this.clipIndex >= 0 ? " ·held" : ""}] `
            : "[no character on map] ";

        this.onReadout?.(
            `${this.target.toUpperCase()} ${label}· ${this.mode} · step ${STEPS[this.stepIndex]}`
            + `   pos(${f(t.position.x)}, ${f(t.position.y)}, ${f(t.position.z)})`
            + `  rot(${f(t.euler.x)}, ${f(t.euler.y)}, ${f(t.euler.z)})`
            + `  scale ${f(t.scale)}`
            + `   —  Enter target · Del mode · +/− step · × reset · 5 print · 1/3 clip · ÷ live`
        );
    }
}
