// src/features/game/systems/CosmeticTuner.ts
import * as THREE from "three";
import { InputManager } from "../core/InputManager";
import type { Player } from "../entities/Player";
import type { CosmeticPiece } from "../entities/CosmeticRig";

const MOVE_STEP = 0.01;
const ROTATE_STEP = 0.02;
const SCALE_STEP = 0.01;

const MOVE_BINDINGS: Array<{ code: string; axis: "x" | "y" | "z"; sign: number }> = [
    { code: "Numpad4", axis: "x", sign: -1 },
    { code: "Numpad6", axis: "x", sign: 1 },
    { code: "Numpad2", axis: "y", sign: -1 },
    { code: "Numpad8", axis: "y", sign: 1 },
    { code: "Numpad7", axis: "z", sign: -1 },
    { code: "Numpad9", axis: "z", sign: 1 },
];

interface PieceState {
    position: THREE.Vector3;
    rotation: THREE.Euler;
    scale: number;
}

export class CosmeticTuner {
    public onReadout?: (text: string | null) => void;

    private enabled = false;
    private inputManager: InputManager | null = null;
    private player: Player | null = null;
    private selected = 0;
    private readonly defaults = new Map<THREE.Object3D, PieceState>();

    init(inputManager: InputManager, player: Player) {
        this.inputManager = inputManager;
        this.player = player;
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    isReady(): boolean {
        return this.pieces().length > 0;
    }

    toggle() {
        if (!this.isReady()) return;

        this.enabled = !this.enabled;
        if (this.enabled) {
            this.selected = 0;
            this.emit();
            return;
        }
        this.onReadout?.(null);
    }

    update() {
        if (!this.enabled || !this.inputManager) return;

        const pieces = this.pieces();
        if (pieces.length === 0) {
            this.onReadout?.(null);
            this.enabled = false;
            return;
        }

        if (this.selected >= pieces.length) this.selected = 0;
        const piece = pieces[this.selected];
        this.remember(piece.object);

        if (this.inputManager.isKeyJustPressed("Numpad1")) {
            this.selected = (this.selected + 1) % pieces.length;
            this.emit();
            return;
        }

        if (this.inputManager.isKeyJustPressed("Numpad3")) {
            this.restore(piece.object);
            this.emit();
            return;
        }

        if (this.inputManager.isKeyJustPressed("Numpad5")) {
            console.log("[CosmeticTuner]", this.snippet());
        }

        let changed = false;

        for (const binding of MOVE_BINDINGS) {
            if (!this.inputManager.isKeyPressed(binding.code)) continue;
            piece.object.position[binding.axis] += binding.sign * MOVE_STEP;
            changed = true;
        }

        if (this.inputManager.isKeyPressed("NumpadAdd")) {
            piece.object.scale.multiplyScalar(1 + SCALE_STEP);
            changed = true;
        }
        if (this.inputManager.isKeyPressed("NumpadSubtract")) {
            piece.object.scale.multiplyScalar(1 - SCALE_STEP);
            changed = true;
        }
        if (this.inputManager.isKeyPressed("NumpadMultiply")) {
            piece.object.rotation.x += ROTATE_STEP;
            changed = true;
        }
        if (this.inputManager.isKeyPressed("NumpadDivide")) {
            piece.object.rotation.x -= ROTATE_STEP;
            changed = true;
        }

        if (!changed) return;
        this.emit();
    }

    private pieces(): CosmeticPiece[] {
        return this.player?.getCosmeticRig()?.getPieces() ?? [];
    }

    private remember(object: THREE.Object3D) {
        if (this.defaults.has(object)) return;
        this.defaults.set(object, {
            position: object.position.clone(),
            rotation: object.rotation.clone(),
            scale: object.scale.x,
        });
    }

    private restore(object: THREE.Object3D) {
        const state = this.defaults.get(object);
        if (!state) return;
        object.position.copy(state.position);
        object.rotation.copy(state.rotation);
        object.scale.setScalar(state.scale);
    }

    private snippet(): string {
        const pieces = this.pieces();
        if (pieces.length === 0) return "";

        const piece = pieces[this.selected] ?? pieces[0];
        const f = (value: number) => value.toFixed(3);
        const p = piece.object.position;
        return [
            `${piece.label} ${this.selected + 1}/${pieces.length}`,
            `pos ${f(p.x)} ${f(p.y)} ${f(p.z)}`,
            `rotX ${f(piece.object.rotation.x)}`,
            `scale ${f(piece.object.scale.x)}`,
        ].join("  |  ");
    }

    private emit() {
        this.onReadout?.(this.snippet());
    }
}
