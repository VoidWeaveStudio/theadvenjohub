// src/features/game/ui/preview/PreviewScene.ts
import * as THREE from "three";
import { ResourceManager } from "../../core/ResourceManager";
import { applyRestPoseCorrection, scaleAndCenterModel } from "../../entities/characterModel";
import {
    findPaintableMesh,
    clonePaintableMaterial,
    disposePaintableMaterial,
    applySkinTextureUrl,
} from "../../entities/characterPaint";
import { CosmeticRig } from "../../entities/CosmeticRig";
import { createCompanion, type CompanionInstance } from "../../entities/companionModels";
import { CosmeticId } from "../../data/cosmetics";
import { CompanionId } from "../../data/companions";

export type PreviewSubject =
    | { kind: "companion"; companionId: CompanionId }
    | {
        kind: "character";
        skinId: CosmeticId | null;
        accessoryId: CosmeticId | null;
        // A painted texture from the Alfredo editor, used by tournament entries.
        // Cosmetic pieces still layer on top of it.
        skinTextureUrl?: string | null;
    };

const AUTO_SPIN = 0.35;
const DRAG_SENSITIVITY = 0.008;
const MIN_PITCH = -0.5;
const MAX_PITCH = 0.9;

// Every preview on screen shares one WebGL context. A browser only grants a
// handful of them, and a shop page can easily show a dozen previews at once, so
// per-canvas renderers are not an option — the pool draws each tile into the
// shared buffer and copies the result into the tile's own 2D canvas.
const SHARED_BUFFER = 512;
// How many tiles get redrawn per animation frame. Twelve visible tiles at three
// per frame still spin at ~15fps each, which reads as smooth for a slow turn.
const TILES_PER_FRAME = 3;

class PreviewRendererPool {
    private renderer: THREE.WebGLRenderer | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private readonly tiles: PreviewTile[] = [];
    private cursor = 0;
    private frame = 0;
    private readonly clock = new THREE.Clock();

    private ensureRenderer(): THREE.WebGLRenderer | null {
        if (this.renderer) return this.renderer;
        if (typeof document === "undefined") return null;

        const canvas = document.createElement("canvas");
        canvas.width = SHARED_BUFFER;
        canvas.height = SHARED_BUFFER;

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setPixelRatio(1);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.setScissorTest(true);

        this.canvas = canvas;
        this.renderer = renderer;
        return renderer;
    }

    register(tile: PreviewTile) {
        this.tiles.push(tile);
        if (this.frame === 0) this.frame = requestAnimationFrame(this.loop);
    }

    unregister(tile: PreviewTile) {
        const index = this.tiles.indexOf(tile);
        if (index !== -1) this.tiles.splice(index, 1);

        if (this.tiles.length === 0) {
            cancelAnimationFrame(this.frame);
            this.frame = 0;
            this.clock.stop();
        }
    }

    private loop = () => {
        this.frame = requestAnimationFrame(this.loop);

        const renderer = this.ensureRenderer();
        const canvas = this.canvas;
        if (!renderer || !canvas || this.tiles.length === 0) return;

        const delta = Math.min(this.clock.getDelta(), 0.05);

        // Time advances for every tile so a spin never jumps when a tile's turn
        // comes back around; only the draw is rationed.
        for (const tile of this.tiles) tile.advance(delta);

        let drawn = 0;
        let checked = 0;
        while (drawn < TILES_PER_FRAME && checked < this.tiles.length) {
            const tile = this.tiles[this.cursor % this.tiles.length];
            this.cursor = (this.cursor + 1) % Math.max(1, this.tiles.length);
            checked++;
            if (!tile.isVisible()) continue;
            if (tile.draw(renderer, canvas)) drawn++;
        }
    };
}

const pool = new PreviewRendererPool();

export class PreviewTile {
    private readonly scene = new THREE.Scene();
    private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
    private readonly pivot = new THREE.Group();
    private readonly ctx: CanvasRenderingContext2D | null;

    private companion: CompanionInstance | null = null;
    private characterRoot: THREE.Object3D | null = null;
    private cosmeticRig: CosmeticRig | null = null;
    private paintableMaterial: THREE.Material | null = null;

    private pendingSubject: PreviewSubject | null = null;
    private awaitingModel = false;

    private elapsed = 0;
    private yaw = 0.6;
    private pitch = 0.1;
    private autoSpin = true;
    private dragging = false;
    private visible = true;
    private disposed = false;
    private lastPointer = { x: 0, y: 0 };

    constructor(private readonly target: HTMLCanvasElement, interactive = true) {
        this.ctx = target.getContext("2d");
        this.scene.add(this.pivot);

        this.scene.add(new THREE.AmbientLight(0xffffff, 1.15));

        const key = new THREE.DirectionalLight(0xffffff, 2.1);
        key.position.set(2.5, 4, 3);
        this.scene.add(key);

        const fill = new THREE.DirectionalLight(0x9fd3ff, 0.8);
        fill.position.set(-3, 1.5, -2);
        this.scene.add(fill);

        const rim = new THREE.DirectionalLight(0xffd166, 0.7);
        rim.position.set(0, 2, -4);
        this.scene.add(rim);

        if (interactive) {
            target.addEventListener("pointerdown", this.handlePointerDown);
            target.addEventListener("pointermove", this.handlePointerMove);
            window.addEventListener("pointerup", this.handlePointerUp);
        }

        pool.register(this);
    }

    setVisible(visible: boolean) {
        this.visible = visible;
    }

    isVisible(): boolean {
        return this.visible && !this.disposed && this.target.isConnected;
    }

    setSubject(subject: PreviewSubject) {
        this.clearSubject();
        this.pendingSubject = null;

        if (subject.kind === "companion") {
            this.companion = createCompanion(subject.companionId);
            this.pivot.add(this.companion.root);
            this.frameCompanion();
            return;
        }

        const data = ResourceManager.getInstance().getModel("player");
        if (!data) {
            // The character glb may still be loading when a shop tab mounts.
            // Wait for the load event rather than polling: getModel clones the
            // whole rig, so probing it once a frame would be expensive.
            this.pendingSubject = subject;
            if (!this.awaitingModel) {
                this.awaitingModel = true;
                ResourceManager.getInstance().onModelLoaded("player", () => {
                    this.awaitingModel = false;
                    const queued = this.pendingSubject;
                    if (this.disposed || !queued) return;
                    this.setSubject(queued);
                });
            }
            return;
        }

        applyRestPoseCorrection(data.scene, data.animations);
        scaleAndCenterModel(data.scene, 1.8, 0, true);

        const paintableMesh = findPaintableMesh(data.scene);
        this.paintableMaterial = paintableMesh ? clonePaintableMaterial(paintableMesh) : null;

        if (subject.skinTextureUrl) {
            applySkinTextureUrl(this.paintableMaterial, subject.skinTextureUrl);
        }

        this.cosmeticRig = new CosmeticRig(data.scene, this.paintableMaterial);
        this.cosmeticRig.apply(subject.skinId, subject.accessoryId);

        this.characterRoot = data.scene;
        this.pivot.add(data.scene);

        this.camera.position.set(0, 1.1, 3.4);
        this.camera.lookAt(0, 0.95, 0);
        this.pivot.position.set(0, 0, 0);
    }

    private frameCompanion() {
        if (!this.companion) return;

        this.companion.update(0, 0, false);
        this.companion.root.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(this.companion.root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const radius = Math.max(size.x, size.y, size.z) || 1;

        this.companion.root.position.sub(center);
        this.camera.position.set(0, radius * 0.35, radius * 3.1);
        this.camera.lookAt(0, 0, 0);
    }

    private clearSubject() {
        if (this.companion) {
            this.companion.dispose();
            this.companion = null;
        }

        if (this.characterRoot) {
            this.characterRoot.removeFromParent();
            this.characterRoot.traverse((child) => {
                const mesh = child as THREE.Mesh;
                if (!mesh.isMesh) return;
                mesh.geometry?.dispose();
            });
            this.characterRoot = null;
        }

        this.cosmeticRig = null;
        disposePaintableMaterial(this.paintableMaterial);
        this.paintableMaterial = null;
    }

    advance(delta: number) {
        this.elapsed += delta;
        if (this.autoSpin && !this.dragging) this.yaw += delta * AUTO_SPIN;
    }

    draw(renderer: THREE.WebGLRenderer, shared: HTMLCanvasElement): boolean {
        const ctx = this.ctx;
        if (!ctx || this.disposed) return false;

        const cssWidth = this.target.clientWidth;
        const cssHeight = this.target.clientHeight;
        if (cssWidth <= 0 || cssHeight <= 0) return false;

        const dpr = Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, 2);
        const fit = Math.min(1, SHARED_BUFFER / (cssWidth * dpr), SHARED_BUFFER / (cssHeight * dpr));
        const width = Math.max(1, Math.floor(cssWidth * dpr * fit));
        const height = Math.max(1, Math.floor(cssHeight * dpr * fit));

        if (this.target.width !== width || this.target.height !== height) {
            this.target.width = width;
            this.target.height = height;
        }

        this.pivot.rotation.y = this.yaw;
        this.pivot.rotation.x = this.pitch * 0.35;
        this.companion?.update(this.elapsed, 0, false);
        this.cosmeticRig?.update(1 / 60);

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        // Render into the bottom-left of the shared buffer: the GL viewport
        // origin is bottom-left, so that region maps to the bottom of the image
        // the 2D copy reads back from.
        renderer.setViewport(0, 0, width, height);
        renderer.setScissor(0, 0, width, height);
        renderer.clear();
        renderer.render(this.scene, this.camera);

        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(shared, 0, shared.height - height, width, height, 0, 0, width, height);
        return true;
    }

    private handlePointerDown = (e: PointerEvent) => {
        this.dragging = true;
        this.autoSpin = false;
        this.lastPointer = { x: e.clientX, y: e.clientY };
        this.target.setPointerCapture?.(e.pointerId);
    };

    private handlePointerMove = (e: PointerEvent) => {
        if (!this.dragging) return;
        this.yaw -= (e.clientX - this.lastPointer.x) * DRAG_SENSITIVITY;
        this.pitch = Math.max(
            MIN_PITCH,
            Math.min(MAX_PITCH, this.pitch + (e.clientY - this.lastPointer.y) * DRAG_SENSITIVITY)
        );
        this.lastPointer = { x: e.clientX, y: e.clientY };
    };

    private handlePointerUp = () => {
        this.dragging = false;
    };

    dispose() {
        if (this.disposed) return;
        this.disposed = true;

        pool.unregister(this);

        this.target.removeEventListener("pointerdown", this.handlePointerDown);
        this.target.removeEventListener("pointermove", this.handlePointerMove);
        window.removeEventListener("pointerup", this.handlePointerUp);

        this.clearSubject();
        this.scene.clear();
        this.pendingSubject = null;
    }
}
