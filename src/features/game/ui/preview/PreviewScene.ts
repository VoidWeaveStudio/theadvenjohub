// src/features/game/ui/preview/PreviewScene.ts
import * as THREE from "three";
import { ResourceManager } from "../../core/ResourceManager";
import { applyRestPoseCorrection, scaleAndCenterModel } from "../../entities/characterModel";
import { findPaintableMesh, clonePaintableMaterial, disposePaintableMaterial } from "../../entities/characterPaint";
import { CosmeticRig } from "../../entities/CosmeticRig";
import { createCompanion, type CompanionInstance } from "../../entities/companionModels";
import { CosmeticId } from "../../data/cosmetics";
import { CompanionId } from "../../data/companions";

export type PreviewSubject =
    | { kind: "companion"; companionId: CompanionId }
    | { kind: "character"; skinId: CosmeticId | null; accessoryId: CosmeticId | null };

const AUTO_SPIN = 0.35;
const DRAG_SENSITIVITY = 0.008;
const MIN_PITCH = -0.5;
const MAX_PITCH = 0.9;

export class PreviewScene {
    private readonly renderer: THREE.WebGLRenderer;
    private readonly scene = new THREE.Scene();
    private readonly camera: THREE.PerspectiveCamera;
    private readonly pivot = new THREE.Group();
    private readonly clock = new THREE.Clock();

    private companion: CompanionInstance | null = null;
    private characterRoot: THREE.Object3D | null = null;
    private cosmeticRig: CosmeticRig | null = null;
    private paintableMaterial: THREE.Material | null = null;

    private frame = 0;
    private elapsed = 0;
    private yaw = 0.6;
    private pitch = 0.1;
    private autoSpin = true;
    private dragging = false;
    private lastPointer = { x: 0, y: 0 };
    private disposed = false;

    constructor(
        private readonly canvas: HTMLCanvasElement,
        private readonly resourceManager: ResourceManager
    ) {
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
        this.scene.add(this.pivot);

        const ambient = new THREE.AmbientLight(0xffffff, 1.15);
        this.scene.add(ambient);

        const key = new THREE.DirectionalLight(0xffffff, 2.1);
        key.position.set(2.5, 4, 3);
        this.scene.add(key);

        const fill = new THREE.DirectionalLight(0x9fd3ff, 0.8);
        fill.position.set(-3, 1.5, -2);
        this.scene.add(fill);

        const rim = new THREE.DirectionalLight(0xffd166, 0.7);
        rim.position.set(0, 2, -4);
        this.scene.add(rim);

        canvas.addEventListener("pointerdown", this.handlePointerDown);
        canvas.addEventListener("pointermove", this.handlePointerMove);
        window.addEventListener("pointerup", this.handlePointerUp);

        this.resize();
        this.animate();
    }

    setSubject(subject: PreviewSubject) {
        this.clearSubject();

        if (subject.kind === "companion") {
            this.companion = createCompanion(subject.companionId);
            this.pivot.add(this.companion.root);
            this.frameCompanion();
            return;
        }

        const data = this.resourceManager.getModel("player");
        if (!data) return;

        applyRestPoseCorrection(data.scene, data.animations);
        scaleAndCenterModel(data.scene, 1.8, 0, true);

        const paintableMesh = findPaintableMesh(data.scene);
        this.paintableMaterial = paintableMesh ? clonePaintableMaterial(paintableMesh) : null;
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

    private handlePointerDown = (e: PointerEvent) => {
        this.dragging = true;
        this.autoSpin = false;
        this.lastPointer = { x: e.clientX, y: e.clientY };
        this.canvas.setPointerCapture?.(e.pointerId);
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

    resize() {
        const width = this.canvas.clientWidth || 1;
        const height = this.canvas.clientHeight || 1;
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    private animate = () => {
        if (this.disposed) return;
        this.frame = requestAnimationFrame(this.animate);

        const delta = Math.min(this.clock.getDelta(), 0.05);
        this.elapsed += delta;

        if (this.autoSpin && !this.dragging) this.yaw += delta * AUTO_SPIN;

        this.pivot.rotation.y = this.yaw;
        this.pivot.rotation.x = this.pitch * 0.35;

        this.companion?.update(this.elapsed, 0, false);
        this.cosmeticRig?.update(delta);

        this.renderer.render(this.scene, this.camera);
    };

    dispose() {
        if (this.disposed) return;
        this.disposed = true;

        cancelAnimationFrame(this.frame);
        this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
        this.canvas.removeEventListener("pointermove", this.handlePointerMove);
        window.removeEventListener("pointerup", this.handlePointerUp);

        this.clearSubject();
        this.scene.clear();
        this.renderer.dispose();
    }
}
