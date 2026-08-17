// src/features/game/world/building/BuildEditor.ts
import * as THREE from "three";
import { EditorCamera } from "./EditorCamera";
import { getBuildEntry, getBuildParts, CELL_SIZE, LEVEL_HEIGHT } from "./BuildCatalog";
import {
    BuildLayout,
    MAX_LEVELS,
    cellToWorld,
    cellsAcross,
    levelBaseY,
    pieceKey,
    worldToCell,
    type BuildPiece,
} from "./BuildLayout";

export type EditorTool = "place" | "erase" | "select";

export interface EditorSelection {
    key: string;
    piece: BuildPiece;
}

export interface BuildEditorCallbacks {
    onPlace: (piece: BuildPiece) => void;
    onErase: (key: string, piece: BuildPiece) => void;
    canRemove: (key: string, piece: BuildPiece) => boolean;
    onStateChange: () => void;
    onRequestExit: () => void;
}

const GHOST_OK = 0x6fe3a0;
const GHOST_BAD = 0xff6b7a;
const HIGHLIGHT = 0xffd166;

const PREVENTED_KEYS = new Set([
    "Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown",
]);

export class BuildEditor {
    public readonly camera: EditorCamera;
    public active = false;
    public tool: EditorTool = "place";
    public selectedType: string | null = null;
    public rotation = 0;
    public level = 0;
    public selection: EditorSelection | null = null;
    public carrying: BuildPiece | null = null;
    public suspended = false;

    private layout: BuildLayout | null = null;
    private scene: THREE.Scene | null = null;
    private canvas: HTMLCanvasElement | null = null;

    private ghost = new THREE.Group();
    private ghostType: string | null = null;
    private ghostMaterial: THREE.MeshBasicMaterial;
    private grid: THREE.LineSegments | null = null;
    private highlight: THREE.LineSegments | null = null;

    private raycaster = new THREE.Raycaster();
    private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    private pointer = new THREE.Vector2();
    private hit = new THREE.Vector3();

    private hasCursor = false;
    private cursorCell = { x: 0, z: 0 };
    private orbiting = false;
    private lastMouse = { x: 0, y: 0 };
    private keys = new Set<string>();

    private onKeyDown: (event: KeyboardEvent) => void;
    private onKeyUp: (event: KeyboardEvent) => void;
    private onBlur: () => void;
    private onMouseMove: (event: MouseEvent) => void;
    private onMouseDown: (event: MouseEvent) => void;
    private onMouseUp: (event: MouseEvent) => void;
    private onWheel: (event: WheelEvent) => void;
    private onContextMenu: (event: MouseEvent) => void;

    constructor(aspect: number, private callbacks: BuildEditorCallbacks) {
        this.camera = new EditorCamera(aspect);

        this.ghostMaterial = new THREE.MeshBasicMaterial({
            color: GHOST_OK,
            transparent: true,
            opacity: 0.45,
            depthWrite: false,
        });
        this.ghost.visible = false;

        this.onKeyDown = (event) => {
            if (!this.active || this.suspended) return;
            const target = event.target as HTMLElement | null;
            if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

            this.keys.add(event.code);
            if (PREVENTED_KEYS.has(event.code)) event.preventDefault();

            if (event.code === "KeyR") {
                this.rotation = (this.rotation + 1) % 4;
                if (this.selection && !this.carrying) this.rotateSelection();
                else this.callbacks.onStateChange();
            } else if (event.code === "KeyQ") {
                this.camera.rotateStep(1);
            } else if (event.code === "KeyE") {
                this.camera.rotateStep(-1);
            } else if (event.code === "BracketLeft" || event.code === "PageDown") {
                this.setLevel(this.level - 1);
            } else if (event.code === "BracketRight" || event.code === "PageUp") {
                this.setLevel(this.level + 1);
            } else if (event.code === "Escape") {
                if (this.carrying) this.cancelCarry();
                else if (this.selection) this.clearSelection();
                else this.callbacks.onRequestExit();
            } else if (event.code === "Delete" || event.code === "Backspace") {
                if (this.selection) this.deleteSelection();
            } else if (event.code === "KeyX") {
                this.setTool(this.tool === "erase" ? "select" : "erase");
            }
        };

        this.onKeyUp = (event) => {
            this.keys.delete(event.code);
        };

        this.onBlur = () => this.releaseKeys();

        this.onMouseMove = (event) => {
            if (!this.active || !this.canvas) return;

            const rect = this.canvas.getBoundingClientRect();
            this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            if (this.orbiting) {
                this.camera.orbit(event.clientX - this.lastMouse.x, event.clientY - this.lastMouse.y);
            }
            this.lastMouse.x = event.clientX;
            this.lastMouse.y = event.clientY;
        };

        this.onMouseDown = (event) => {
            if (!this.active || this.suspended) return;
            this.lastMouse.x = event.clientX;
            this.lastMouse.y = event.clientY;

            if (event.button === 2) {
                this.orbiting = true;
                return;
            }
            if (event.button === 0) {
                this.applyAtCursor();
            }
        };

        this.onMouseUp = (event) => {
            if (event.button === 2) this.orbiting = false;
        };

        this.onWheel = (event) => {
            if (!this.active) return;
            event.preventDefault();
            this.camera.zoom(event.deltaY);
        };

        this.onContextMenu = (event) => {
            if (this.active) event.preventDefault();
        };
    }

    public attach(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        window.addEventListener("keydown", this.onKeyDown);
        window.addEventListener("keyup", this.onKeyUp);
        window.addEventListener("blur", this.onBlur);
        canvas.addEventListener("mousemove", this.onMouseMove);
        canvas.addEventListener("mousedown", this.onMouseDown);
        window.addEventListener("mouseup", this.onMouseUp);
        canvas.addEventListener("wheel", this.onWheel, { passive: false });
        canvas.addEventListener("contextmenu", this.onContextMenu);
    }

    public detach() {
        window.removeEventListener("keydown", this.onKeyDown);
        window.removeEventListener("keyup", this.onKeyUp);
        window.removeEventListener("blur", this.onBlur);
        window.removeEventListener("mouseup", this.onMouseUp);
        if (this.canvas) {
            this.canvas.removeEventListener("mousemove", this.onMouseMove);
            this.canvas.removeEventListener("mousedown", this.onMouseDown);
            this.canvas.removeEventListener("wheel", this.onWheel);
            this.canvas.removeEventListener("contextmenu", this.onContextMenu);
        }
        this.canvas = null;
    }

    public activate(scene: THREE.Scene, layout: BuildLayout) {
        this.scene = scene;
        this.layout = layout;
        this.active = true;
        this.level = 0;
        this.rotation = 0;
        this.tool = "select";
        this.selectedType = null;
        this.selection = null;
        this.carrying = null;
        this.keys.clear();

        this.camera.setBounds(layout.plotSize);
        this.camera.reset(0);

        this.buildGrid(layout.plotSize);
        this.buildHighlight();
        scene.add(this.ghost);
        this.refreshGhost();
        this.callbacks.onStateChange();
    }

    public deactivate() {
        if (this.carrying) this.cancelCarry();

        this.active = false;
        this.releaseKeys();
        this.ghost.visible = false;
        this.selection = null;

        if (this.scene) {
            this.scene.remove(this.ghost);
            if (this.grid) this.scene.remove(this.grid);
            if (this.highlight) this.scene.remove(this.highlight);
        }
        this.disposeGrid();
        this.disposeHighlight();
        this.scene = null;
        this.layout = null;
    }

    public releaseKeys() {
        this.keys.clear();
        this.orbiting = false;
        this.camera.stopPan();
    }

    public setSelectedType(typeId: string | null) {
        this.selectedType = typeId;
        if (typeId) {
            this.tool = "place";
            this.selection = null;
        }
        this.refreshGhost();
        this.callbacks.onStateChange();
    }

    public setTool(tool: EditorTool) {
        if (this.carrying && tool !== "place") this.cancelCarry();

        this.tool = tool;
        if (tool !== "place") this.selectedType = null;
        if (tool !== "select") this.selection = null;
        this.refreshGhost();
        this.callbacks.onStateChange();
    }

    public setLevel(level: number) {
        const next = THREE.MathUtils.clamp(level, 0, MAX_LEVELS - 1);
        if (next === this.level) return;
        this.level = next;
        this.camera.setFocusHeight(levelBaseY(next));
        if (this.grid) this.grid.position.y = levelBaseY(next) + 0.02;
        this.callbacks.onStateChange();
    }

    public selectionLabel(): string | null {
        const piece = this.selection?.piece;
        if (!piece) return null;
        return getBuildEntry(piece.t)?.name ?? piece.t;
    }

    public selectionPaintable(): boolean {
        const piece = this.selection?.piece;
        if (!piece || this.carrying) return false;
        return getBuildEntry(piece.t)?.paint !== undefined;
    }

    public selectionPaintAspect(): number | null {
        const piece = this.selection?.piece;
        if (!piece || this.carrying) return null;

        const spec = getBuildEntry(piece.t)?.paint;
        return spec ? spec.width / spec.height : null;
    }

    public selectionPaintUrl(): string | null {
        const piece = this.selection?.piece;
        if (!piece || this.carrying) return null;
        return getBuildEntry(piece.t)?.paint ? piece.d ?? null : null;
    }

    public paintSelection(url: string) {
        const selected = this.selection;
        if (!selected) return;

        const painted: BuildPiece = { ...selected.piece, d: url };
        this.callbacks.onPlace(painted);
        this.selection = { key: pieceKey(painted), piece: painted };
        this.callbacks.onStateChange();
    }

    public clearSelection() {
        if (!this.selection) return;
        this.selection = null;
        this.callbacks.onStateChange();
    }

    public deleteSelection() {
        const selected = this.selection;
        if (!selected) return;
        if (!this.callbacks.canRemove(selected.key, selected.piece)) return;

        this.selection = null;
        this.callbacks.onErase(selected.key, selected.piece);
        this.callbacks.onStateChange();
    }

    public rotateSelection() {
        const selected = this.selection;
        if (!selected || this.carrying) return;

        const rotated: BuildPiece = { ...selected.piece, r: (selected.piece.r + 1) % 4 };
        this.callbacks.onErase(selected.key, selected.piece);
        this.callbacks.onPlace(rotated);
        this.selection = { key: pieceKey(rotated), piece: rotated };
        this.callbacks.onStateChange();
    }

    public pickUpSelection() {
        const selected = this.selection;
        if (!selected || this.carrying) return;
        if (!this.callbacks.canRemove(selected.key, selected.piece)) return;

        this.carrying = selected.piece;
        this.selection = null;
        this.rotation = selected.piece.r;
        this.setLevel(selected.piece.l);
        this.callbacks.onErase(selected.key, selected.piece);
        this.refreshGhost();
        this.callbacks.onStateChange();
    }

    public cancelCarry() {
        const carried = this.carrying;
        if (!carried) return;

        this.carrying = null;
        this.callbacks.onPlace(carried);
        this.refreshGhost();
        this.callbacks.onStateChange();
    }

    private disposeGrid() {
        if (!this.grid) return;
        this.grid.geometry.dispose();
        (this.grid.material as THREE.Material).dispose();
        this.grid = null;
    }

    private buildGrid(plotSize: number) {
        this.disposeGrid();

        const across = cellsAcross(plotSize);
        const half = plotSize / 2;
        const points: number[] = [];

        for (let i = 0; i <= across; i++) {
            const offset = -half + i * CELL_SIZE;
            points.push(offset, 0, -half, offset, 0, half);
            points.push(-half, 0, offset, half, 0, offset);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));

        this.grid = new THREE.LineSegments(
            geometry,
            new THREE.LineBasicMaterial({ color: 0x4fd1ff, transparent: true, opacity: 0.16, depthWrite: false })
        );
        this.grid.position.y = levelBaseY(this.level) + 0.02;
        this.scene?.add(this.grid);
    }

    private disposeHighlight() {
        if (!this.highlight) return;
        this.highlight.geometry.dispose();
        (this.highlight.material as THREE.Material).dispose();
        this.highlight = null;
    }

    private buildHighlight() {
        this.disposeHighlight();

        const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(CELL_SIZE, LEVEL_HEIGHT, CELL_SIZE));
        this.highlight = new THREE.LineSegments(
            geometry,
            new THREE.LineBasicMaterial({ color: HIGHLIGHT, transparent: true, opacity: 0.9, depthTest: false })
        );
        this.highlight.renderOrder = 999;
        this.highlight.visible = false;
        this.scene?.add(this.highlight);
    }

    private activeType(): string | null {
        return this.carrying?.t ?? this.selectedType;
    }

    private refreshGhost() {
        const type = this.activeType();
        if (this.ghostType === type) return;
        this.ghostType = type;

        this.ghost.clear();
        if (!type) {
            this.ghost.visible = false;
            return;
        }

        for (const part of getBuildParts(type)) {
            this.ghost.add(new THREE.Mesh(part.geometry, this.ghostMaterial));
        }
    }

    private currentPiece(): BuildPiece | null {
        const type = this.activeType();
        if (!type || !this.hasCursor) return null;
        return {
            t: type,
            x: this.cursorCell.x,
            z: this.cursorCell.z,
            l: this.level,
            r: this.rotation,
        };
    }

    private applyAtCursor() {
        if (!this.layout || !this.hasCursor) return;

        if (this.carrying) {
            const dropped = this.currentPiece();
            if (!dropped) return;
            this.carrying = null;
            this.callbacks.onPlace(dropped);
            this.selection = { key: pieceKey(dropped), piece: dropped };
            this.tool = "select";
            this.refreshGhost();
            this.callbacks.onStateChange();
            return;
        }

        if (this.tool === "erase") {
            const removed = this.eraseAtCursor();
            if (removed) this.callbacks.onStateChange();
            return;
        }

        if (this.tool === "select") {
            const found = this.layout.findAt(this.level, this.cursorCell.x, this.cursorCell.z, this.rotation);
            this.selection = found ? { key: found.key, piece: found.piece } : null;
            this.callbacks.onStateChange();
            return;
        }

        const piece = this.currentPiece();
        if (!piece) return;
        this.callbacks.onPlace(piece);
    }

    private eraseAtCursor(): boolean {
        if (!this.layout) return false;

        const found = this.layout.findAt(this.level, this.cursorCell.x, this.cursorCell.z, this.rotation);
        if (!found) return false;
        if (!this.callbacks.canRemove(found.key, found.piece)) return false;

        this.callbacks.onErase(found.key, found.piece);
        return true;
    }

    public update(delta: number) {
        if (!this.active || !this.layout) return;

        let forward = 0;
        let right = 0;
        let up = 0;
        if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) forward += 1;
        if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) forward -= 1;
        if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) right += 1;
        if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) right -= 1;
        if (this.keys.has("Space")) up += 1;
        if (this.keys.has("ControlLeft") || this.keys.has("ControlRight")) up -= 1;

        this.camera.setPan(forward, right, up, this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"));
        this.camera.update(delta);
        this.updateCursor();
    }

    private updateCursor() {
        if (!this.layout) return;

        this.plane.constant = -levelBaseY(this.level);
        this.raycaster.setFromCamera(this.pointer, this.camera.camera);

        const intersection = this.raycaster.ray.intersectPlane(this.plane, this.hit);
        if (!intersection) {
            this.hasCursor = false;
            this.ghost.visible = false;
            return;
        }

        const across = cellsAcross(this.layout.plotSize);
        const cellX = worldToCell(this.hit.x, this.layout.plotSize);
        const cellZ = worldToCell(this.hit.z, this.layout.plotSize);

        this.hasCursor = cellX >= 0 && cellX < across && cellZ >= 0 && cellZ < across;
        this.cursorCell.x = cellX;
        this.cursorCell.z = cellZ;

        this.updateHighlight();

        const type = this.activeType();
        if (!this.hasCursor || !type || this.tool === "erase") {
            this.ghost.visible = false;
            return;
        }

        const entry = getBuildEntry(type);
        if (!entry) {
            this.ghost.visible = false;
            return;
        }

        this.ghost.visible = true;
        this.ghost.position.set(
            cellToWorld(cellX, this.layout.plotSize),
            levelBaseY(this.level),
            cellToWorld(cellZ, this.layout.plotSize)
        );
        this.ghost.rotation.y = (this.rotation * Math.PI) / 2;

        const piece = this.currentPiece();
        const occupied = piece ? this.layout.at(pieceKey(piece)) : null;
        this.ghostMaterial.color.setHex(occupied ? GHOST_BAD : GHOST_OK);
    }

    private updateHighlight() {
        if (!this.highlight || !this.layout) return;

        const piece = this.selection?.piece;
        if (!piece) {
            this.highlight.visible = false;
            return;
        }

        this.highlight.visible = true;
        this.highlight.position.set(
            cellToWorld(piece.x, this.layout.plotSize),
            levelBaseY(piece.l) + LEVEL_HEIGHT / 2,
            cellToWorld(piece.z, this.layout.plotSize)
        );
    }

    public getCursorLabel(): string {
        if (!this.hasCursor) return "outside the plot";
        return `cell ${this.cursorCell.x}, ${this.cursorCell.z} — level ${this.level + 1}`;
    }

    public dispose() {
        this.detach();
        this.disposeGrid();
        this.disposeHighlight();
        this.ghost.clear();
        this.ghostMaterial.dispose();
    }
}
