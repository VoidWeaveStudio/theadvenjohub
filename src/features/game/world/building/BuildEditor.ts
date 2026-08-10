// src/features/game/world/building/BuildEditor.ts
import * as THREE from "three";
import { EditorCamera } from "./EditorCamera";
import { getBuildEntry, getBuildParts, CELL_SIZE } from "./BuildCatalog";
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

export type EditorTool = "place" | "erase";

export interface BuildEditorCallbacks {
    onPlace: (piece: BuildPiece) => void;
    onErase: (key: string, piece: BuildPiece) => void;
    onStateChange: () => void;
    onRequestExit: () => void;
}

const GHOST_OK = 0x6fe3a0;
const GHOST_BAD = 0xff6b7a;

export class BuildEditor {
    public readonly camera: EditorCamera;
    public active = false;
    public tool: EditorTool = "place";
    public selectedType: string | null = null;
    public rotation = 0;
    public level = 0;

    private layout: BuildLayout | null = null;
    private scene: THREE.Scene | null = null;
    private canvas: HTMLCanvasElement | null = null;

    private ghost = new THREE.Group();
    private ghostType: string | null = null;
    private ghostMaterial: THREE.MeshBasicMaterial;
    private grid: THREE.LineSegments | null = null;

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
            if (!this.active) return;
            const target = event.target as HTMLElement | null;
            if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

            this.keys.add(event.code);

            if (event.code === "KeyR") {
                this.rotation = (this.rotation + 1) % 4;
                this.callbacks.onStateChange();
            } else if (event.code === "KeyQ") {
                this.camera.rotateStep(1);
            } else if (event.code === "KeyE") {
                this.camera.rotateStep(-1);
            } else if (event.code === "BracketLeft" || event.code === "PageDown") {
                this.setLevel(this.level - 1);
            } else if (event.code === "BracketRight" || event.code === "PageUp") {
                this.setLevel(this.level + 1);
            } else if (event.code === "Escape") {
                this.callbacks.onRequestExit();
            } else if (event.code === "KeyX" || event.code === "Delete") {
                this.tool = this.tool === "erase" ? "place" : "erase";
                this.callbacks.onStateChange();
            }
        };

        this.onKeyUp = (event) => {
            this.keys.delete(event.code);
        };

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
            if (!this.active) return;
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
        canvas.addEventListener("mousemove", this.onMouseMove);
        canvas.addEventListener("mousedown", this.onMouseDown);
        window.addEventListener("mouseup", this.onMouseUp);
        canvas.addEventListener("wheel", this.onWheel, { passive: false });
        canvas.addEventListener("contextmenu", this.onContextMenu);
    }

    public detach() {
        window.removeEventListener("keydown", this.onKeyDown);
        window.removeEventListener("keyup", this.onKeyUp);
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
        this.tool = "place";
        this.keys.clear();

        this.camera.setBounds(layout.plotSize);
        this.camera.reset(0);

        this.buildGrid(layout.plotSize);
        scene.add(this.ghost);
        this.refreshGhost();
        this.callbacks.onStateChange();
    }

    public deactivate() {
        this.active = false;
        this.keys.clear();
        this.orbiting = false;
        this.ghost.visible = false;

        if (this.scene) {
            this.scene.remove(this.ghost);
            if (this.grid) this.scene.remove(this.grid);
        }
        this.disposeGrid();
        this.scene = null;
        this.layout = null;
    }

    public setSelectedType(typeId: string | null) {
        this.selectedType = typeId;
        this.tool = typeId ? "place" : this.tool;
        this.refreshGhost();
        this.callbacks.onStateChange();
    }

    public setTool(tool: EditorTool) {
        this.tool = tool;
        this.refreshGhost();
        this.callbacks.onStateChange();
    }

    public setLevel(level: number) {
        const next = THREE.MathUtils.clamp(level, 0, MAX_LEVELS - 1);
        if (next === this.level) return;
        this.level = next;
        this.camera.setFocusHeight(levelBaseY(next));
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
        this.grid.position.y = 0.02;
        this.scene?.add(this.grid);
    }

    private refreshGhost() {
        if (this.ghostType === this.selectedType) return;
        this.ghostType = this.selectedType;

        this.ghost.clear();
        if (!this.selectedType) {
            this.ghost.visible = false;
            return;
        }

        for (const part of getBuildParts(this.selectedType)) {
            this.ghost.add(new THREE.Mesh(part.geometry, this.ghostMaterial));
        }
    }

    private currentPiece(): BuildPiece | null {
        if (!this.selectedType || !this.hasCursor) return null;
        return {
            t: this.selectedType,
            x: this.cursorCell.x,
            z: this.cursorCell.z,
            l: this.level,
            r: this.rotation,
        };
    }

    private applyAtCursor() {
        if (!this.layout || !this.hasCursor) return;

        if (this.tool === "erase") {
            const removed = this.eraseAtCursor();
            if (removed) this.callbacks.onStateChange();
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

        this.callbacks.onErase(found.key, found.piece);
        return true;
    }

    public update(delta: number) {
        if (!this.active || !this.layout) return;

        let forward = 0;
        let right = 0;
        if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) forward += 1;
        if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) forward -= 1;
        if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) right += 1;
        if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) right -= 1;
        if (forward !== 0 || right !== 0) this.camera.pan(forward, right);

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

        if (!this.hasCursor || !this.selectedType || this.tool === "erase") {
            this.ghost.visible = false;
            return;
        }

        const entry = getBuildEntry(this.selectedType);
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

    public getCursorLabel(): string {
        if (!this.hasCursor) return "outside the plot";
        return `cell ${this.cursorCell.x}, ${this.cursorCell.z} — level ${this.level + 1}`;
    }

    public dispose() {
        this.detach();
        this.disposeGrid();
        this.ghost.clear();
        this.ghostMaterial.dispose();
    }
}
