// src/features/game/ui/personalization/PaintEditorScene.ts
import * as THREE from "three";
import { ResourceManager } from "../../core/ResourceManager";
import { screenDeltaToGameSpace, screenPointToGameSpace, screenRectToGameSpace } from "../../utils/rotatedViewport";
import { applyRestPoseCorrection, scaleAndCenterModel } from "../../entities/characterModel";
import { findPaintableMesh, clonePaintableMaterial } from "../../entities/characterPaint";
import { canvasToPngBlob } from "../../utils/exportPng";

const CANVAS_SIZE = 1024;
const MODEL_HEIGHT = 1.8;
const SEAM_MARGIN_PX = 2.5;

const ORBIT_SPEED = 0.008;
const MIN_DISTANCE = 1.2;
const MAX_DISTANCE = 5;
const MIN_POLAR = 0.15;
const MAX_POLAR = Math.PI - 0.15;
const WHEEL_STEP = 1.12;

interface PaintTriangle {
    a: number;
    b: number;
    c: number;
    centroid: THREE.Vector3;
    boundRadius: number;
    ax: number;
    ay: number;
    bx: number;
    by: number;
    cx: number;
    cy: number;
    cxUV: number;
    cyUV: number;
}

export class PaintEditorScene {
    private canvas: HTMLCanvasElement;
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private raycaster = new THREE.Raycaster();
    private orbitTarget = new THREE.Vector3(0, 0.9, 0);
    private orbitRadius = 3;
    private orbitAzimuth = 0;
    private orbitPolar = 1.5;
    private pointers = new Map<number, { x: number; y: number }>();
    private gestureMode: "none" | "paint" | "orbit" = "none";
    private orbitPointerId: number | null = null;
    private pinchDistance = 0;
    private paintMesh: THREE.Mesh | null = null;
    private paintMaterial: THREE.MeshStandardMaterial | null = null;
    private paintTriangles: PaintTriangle[] = [];
    private posedPositions: Float32Array | null = null;
    private paintCanvas: HTMLCanvasElement;
    private paintCtx: CanvasRenderingContext2D;
    private paintTexture: THREE.CanvasTexture;
    private animationFrameId: number | null = null;
    private isPainting = false;
    private lastPaintPoint: THREE.Vector3 | null = null;
    private brushSize = 24;
    private brushColor = "#ff0000";
    private disposed = false;

    constructor(canvas: HTMLCanvasElement, resourceManager: ResourceManager) {
        this.canvas = canvas;

        this.paintCanvas = document.createElement("canvas");
        this.paintCanvas.width = CANVAS_SIZE;
        this.paintCanvas.height = CANVAS_SIZE;
        this.paintCtx = this.paintCanvas.getContext("2d")!;
        this.paintCtx.fillStyle = "#ffffff";
        this.paintCtx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        this.paintTexture = new THREE.CanvasTexture(this.paintCanvas);
        this.paintTexture.colorSpace = THREE.SRGBColorSpace;
        this.paintTexture.flipY = false;

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x14161a);

        this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
        this.applyOrbit();

        const ambient = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambient);
        const key = new THREE.DirectionalLight(0xffffff, 1.2);
        key.position.set(2, 3, 2);
        this.scene.add(key);
        const fill = new THREE.DirectionalLight(0xffffff, 0.5);
        fill.position.set(-2, 1, -2);
        this.scene.add(fill);

        const data = resourceManager.getModel("player");
        if (data) {
            applyRestPoseCorrection(data.scene, data.animations);
            scaleAndCenterModel(data.scene, 1.8, 0, true);
            this.scene.add(data.scene);
            data.scene.updateMatrixWorld(true);

            const mesh = findPaintableMesh(data.scene);
            if (mesh) {
                this.paintMesh = mesh;
                const material = clonePaintableMaterial(mesh) as THREE.MeshStandardMaterial;
                material.map = this.paintTexture;
                material.needsUpdate = true;
                this.paintMaterial = material;
                this.posedPositions = this.buildPosedPositionCache(mesh);
                this.paintTriangles = this.buildTriangleList(mesh);
            }
        }

        canvas.style.touchAction = "none";
        canvas.addEventListener("pointerdown", this.handlePointerDown);
        canvas.addEventListener("wheel", this.handleWheel, { passive: false });
        canvas.addEventListener("contextmenu", this.handleContextMenu);
        window.addEventListener("pointermove", this.handlePointerMove);
        window.addEventListener("pointerup", this.handlePointerUp);
        window.addEventListener("pointercancel", this.handlePointerUp);

        this.resize();
        this.animate();
    }

    private applyOrbit() {
        this.orbitPolar = THREE.MathUtils.clamp(this.orbitPolar, MIN_POLAR, MAX_POLAR);
        this.orbitRadius = THREE.MathUtils.clamp(this.orbitRadius, MIN_DISTANCE, MAX_DISTANCE);

        const sinPolar = Math.sin(this.orbitPolar);
        this.camera.position.set(
            this.orbitTarget.x + this.orbitRadius * sinPolar * Math.sin(this.orbitAzimuth),
            this.orbitTarget.y + this.orbitRadius * Math.cos(this.orbitPolar),
            this.orbitTarget.z + this.orbitRadius * sinPolar * Math.cos(this.orbitAzimuth)
        );
        this.camera.lookAt(this.orbitTarget);
    }

    private pointerSpread(): number {
        const points = Array.from(this.pointers.values());
        if (points.length < 2) return 0;
        return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    }

    private stopPainting() {
        this.isPainting = false;
        this.lastPaintPoint = null;
    }

    private handleContextMenu = (e: MouseEvent) => {
        e.preventDefault();
    };

    private handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        this.orbitRadius *= e.deltaY > 0 ? WHEEL_STEP : 1 / WHEEL_STEP;
        this.applyOrbit();
    };

    private handlePointerDown = (e: PointerEvent) => {
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        try {
            this.canvas.setPointerCapture(e.pointerId);
        } catch {
        }

        if (this.pointers.size >= 2) {
            this.stopPainting();
            this.gestureMode = "orbit";
            this.orbitPointerId = null;
            this.pinchDistance = this.pointerSpread();
            return;
        }

        if (e.pointerType === "mouse" && e.button !== 0) {
            this.gestureMode = "orbit";
            this.orbitPointerId = e.pointerId;
            return;
        }

        this.gestureMode = "paint";
        this.orbitPointerId = null;

        const point = this.getHitAtPointer(e);
        if (!point) return;

        this.isPainting = true;
        this.paintAtLocalPoint(point);
        this.lastPaintPoint = point;
    };

    private handlePointerMove = (e: PointerEvent) => {
        const previous = this.pointers.get(e.pointerId);
        if (!previous) return;

        const rawDx = e.clientX - previous.x;
        const rawDy = e.clientY - previous.y;
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (this.gestureMode === "orbit") {
            if (this.pointers.size >= 2) {
                const spread = this.pointerSpread();
                if (this.pinchDistance > 0 && spread > 0) {
                    this.orbitRadius *= this.pinchDistance / spread;
                }
                this.pinchDistance = spread;
            }

            if (this.orbitPointerId === null) this.orbitPointerId = e.pointerId;

            if (this.orbitPointerId === e.pointerId) {
                const { dx, dy } = screenDeltaToGameSpace(rawDx, rawDy);
                this.orbitAzimuth -= dx * ORBIT_SPEED;
                this.orbitPolar -= dy * ORBIT_SPEED;
            }

            this.applyOrbit();
            return;
        }

        if (!this.isPainting) return;

        const point = this.getHitAtPointer(e);
        if (!point) return;

        if (this.lastPaintPoint) {
            this.paintLine3D(this.lastPaintPoint, point);
        } else {
            this.paintAtLocalPoint(point);
        }

        this.lastPaintPoint = point;
    };

    private handlePointerUp = (e: PointerEvent) => {
        if (!this.pointers.delete(e.pointerId)) return;

        if (this.orbitPointerId === e.pointerId) this.orbitPointerId = null;
        if (this.pointers.size < 2) this.pinchDistance = 0;

        if (this.pointers.size === 0) {
            this.gestureMode = "none";
            this.stopPainting();
        }
    };

    private getHitAtPointer(e: PointerEvent): THREE.Vector3 | null {
        if (!this.paintMesh) return null;
        const rect = screenRectToGameSpace(this.canvas.getBoundingClientRect());
        const local = screenPointToGameSpace(e.clientX, e.clientY);
        const width = Math.max(1, rect.right - rect.left);
        const height = Math.max(1, rect.bottom - rect.top);
        const ndc = new THREE.Vector2(
            ((local.x - rect.left) / width) * 2 - 1,
            -((local.y - rect.top) / height) * 2 + 1
        );
        this.raycaster.setFromCamera(ndc, this.camera);
        const hits = this.raycaster.intersectObject(this.paintMesh, false);
        const hit = hits[0];
        if (!hit) return null;
        return this.paintMesh.worldToLocal(hit.point.clone());
    }

    private buildPosedPositionCache(mesh: THREE.Mesh): Float32Array {
        const posAttr = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
        const out = new Float32Array(posAttr.count * 3);
        const v = new THREE.Vector3();
        for (let i = 0; i < posAttr.count; i++) {
            mesh.getVertexPosition(i, v);
            out[i * 3] = v.x;
            out[i * 3 + 1] = v.y;
            out[i * 3 + 2] = v.z;
        }
        return out;
    }

    private readPosed(index: number, target: THREE.Vector3) {
        const p = this.posedPositions!;
        target.set(p[index * 3], p[index * 3 + 1], p[index * 3 + 2]);
    }

    private buildTriangleList(mesh: THREE.Mesh): PaintTriangle[] {
        const index = mesh.geometry.getIndex();
        const uvAttr = mesh.geometry.getAttribute("uv") as THREE.BufferAttribute;
        if (!index || !uvAttr) return [];

        const triangles: PaintTriangle[] = [];
        const va = new THREE.Vector3();
        const vb = new THREE.Vector3();
        const vc = new THREE.Vector3();

        for (let i = 0; i < index.count; i += 3) {
            const a = index.getX(i);
            const b = index.getX(i + 1);
            const c = index.getX(i + 2);

            this.readPosed(a, va);
            this.readPosed(b, vb);
            this.readPosed(c, vc);
            const centroid = new THREE.Vector3().addVectors(va, vb).add(vc).multiplyScalar(1 / 3);
            const boundRadius = Math.sqrt(
                Math.max(
                    centroid.distanceToSquared(va),
                    centroid.distanceToSquared(vb),
                    centroid.distanceToSquared(vc)
                )
            );

            const ax = uvAttr.getX(a) * CANVAS_SIZE, ay = uvAttr.getY(a) * CANVAS_SIZE;
            const bx = uvAttr.getX(b) * CANVAS_SIZE, by = uvAttr.getY(b) * CANVAS_SIZE;
            const cx = uvAttr.getX(c) * CANVAS_SIZE, cy = uvAttr.getY(c) * CANVAS_SIZE;

            triangles.push({
                a, b, c, centroid, boundRadius,
                ax, ay, bx, by, cx, cy,
                cxUV: (ax + bx + cx) / 3,
                cyUV: (ay + by + cy) / 3,
            });
        }
        return triangles;
    }

    private brush3DRadius(): number {
        return (this.brushSize / CANVAS_SIZE) * MODEL_HEIGHT;
    }

    private inflateUV(x: number, y: number, cx: number, cy: number): [number, number] {
        const dx = x - cx, dy = y - cy;
        const len = Math.hypot(dx, dy) || 1;
        return [x + (dx / len) * SEAM_MARGIN_PX, y + (dy / len) * SEAM_MARGIN_PX];
    }

    private paintAtLocalPoint(point: THREE.Vector3) {
        if (!this.paintMesh || !this.posedPositions) return;

        const radius = this.brush3DRadius();
        const radiusSq = radius * radius;
        let painted = false;

        const va = new THREE.Vector3();
        const vb = new THREE.Vector3();
        const vc = new THREE.Vector3();
        const closest = new THREE.Vector3();
        const bary = new THREE.Vector3();
        const triangle = new THREE.Triangle();

        this.paintCtx.fillStyle = this.brushColor;

        for (const tri of this.paintTriangles) {
            const broadRadius = radius + tri.boundRadius;
            if (tri.centroid.distanceToSquared(point) > broadRadius * broadRadius) continue;

            this.readPosed(tri.a, va);
            this.readPosed(tri.b, vb);
            this.readPosed(tri.c, vc);
            triangle.set(va, vb, vc);
            triangle.closestPointToPoint(point, closest);
            if (closest.distanceToSquared(point) > radiusSq) continue;

            let stampX = tri.cxUV;
            let stampY = tri.cyUV;
            if (triangle.getBarycoord(closest, bary)) {
                stampX = tri.ax * bary.x + tri.bx * bary.y + tri.cx * bary.z;
                stampY = tri.ay * bary.x + tri.by * bary.y + tri.cy * bary.z;
            }

            const [pax, pay] = this.inflateUV(tri.ax, tri.ay, tri.cxUV, tri.cyUV);
            const [pbx, pby] = this.inflateUV(tri.bx, tri.by, tri.cxUV, tri.cyUV);
            const [pcx, pcy] = this.inflateUV(tri.cx, tri.cy, tri.cxUV, tri.cyUV);

            this.paintCtx.save();
            this.paintCtx.beginPath();
            this.paintCtx.moveTo(pax, pay);
            this.paintCtx.lineTo(pbx, pby);
            this.paintCtx.lineTo(pcx, pcy);
            this.paintCtx.closePath();
            this.paintCtx.clip();
            this.paintCtx.beginPath();
            this.paintCtx.arc(stampX, stampY, this.brushSize, 0, Math.PI * 2);
            this.paintCtx.fill();
            this.paintCtx.restore();

            painted = true;
        }

        if (painted) this.paintTexture.needsUpdate = true;
    }

    private paintLine3D(from: THREE.Vector3, to: THREE.Vector3) {
        const distance = from.distanceTo(to);
        const step = Math.max(this.brush3DRadius() * 0.5, 0.001);
        const steps = Math.min(24, Math.max(1, Math.ceil(distance / step)));
        const point = new THREE.Vector3();
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            point.lerpVectors(from, to, t);
            this.paintAtLocalPoint(point);
        }
    }

    setBrushSize(px: number) {
        this.brushSize = px;
    }

    setColor(hex: string) {
        this.brushColor = hex;
    }

    loadExistingTexture(url: string): Promise<void> {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                this.paintCtx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
                this.paintTexture.needsUpdate = true;
                resolve();
            };
            img.onerror = () => resolve();
            img.src = url;
        });
    }

    resetToBlank() {
        this.paintCtx.fillStyle = "#ffffff";
        this.paintCtx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        this.paintTexture.needsUpdate = true;
    }

    exportPNGBlob(): Promise<Blob | null> {
        return canvasToPngBlob(this.paintCanvas);
    }

    resize() {
        const width = this.canvas.clientWidth || 1;
        const height = this.canvas.clientHeight || 1;
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    private animate = () => {
        if (this.disposed) return;
        this.animationFrameId = requestAnimationFrame(this.animate);
        this.renderer.render(this.scene, this.camera);
    };

    dispose() {
        this.disposed = true;
        if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);
        this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
        this.canvas.removeEventListener("wheel", this.handleWheel);
        this.canvas.removeEventListener("contextmenu", this.handleContextMenu);
        window.removeEventListener("pointermove", this.handlePointerMove);
        window.removeEventListener("pointerup", this.handlePointerUp);
        window.removeEventListener("pointercancel", this.handlePointerUp);
        if (this.paintMaterial) {
            this.paintMaterial.map = null;
            this.paintMaterial.dispose();
        }
        this.paintTexture.dispose();
        this.renderer.dispose();
    }
}
