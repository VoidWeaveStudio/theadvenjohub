// src/features/game/world/building/BuildPlot.ts
import * as THREE from "three";
import { CollisionGrid } from "../CollisionGrid";
import { getSurfaceMaterial } from "./buildTextures";
import { BuildRenderer } from "./BuildRenderer";
import { BuildEnvironmentRig } from "./environmentPresets";
import { BuildLayout, pieceKey, sanitizePiece, type BuildLayoutData, type BuildPiece } from "./BuildLayout";
import { CELL_SIZE } from "./BuildCatalog";

export class BuildPlot {
    public readonly layout: BuildLayout;
    public readonly renderer: BuildRenderer;
    public readonly collisionGrid: CollisionGrid;

    private environment: BuildEnvironmentRig | null = null;
    private ground: THREE.Mesh | null = null;
    private border: THREE.LineSegments | null = null;
    private groundMaterial: THREE.MeshStandardMaterial | null = null;

    constructor(private scene: THREE.Scene, public readonly plotSize: number) {
        this.layout = new BuildLayout(plotSize);
        this.collisionGrid = new CollisionGrid(CELL_SIZE * 4);
        this.renderer = new BuildRenderer(this.layout, this.collisionGrid);
    }

    public create() {
        this.environment = new BuildEnvironmentRig(this.scene, Math.max(this.plotSize * 1.6, 400));
        this.applyEnvironment();

        this.groundMaterial = getSurfaceMaterial("grass").clone();
        const map = this.groundMaterial.map;
        if (map) {
            const repeats = Math.max(4, Math.round(this.plotSize / 6));
            this.groundMaterial.map = map.clone();
            this.groundMaterial.map.needsUpdate = true;
            this.groundMaterial.map.wrapS = THREE.RepeatWrapping;
            this.groundMaterial.map.wrapT = THREE.RepeatWrapping;
            this.groundMaterial.map.repeat.set(repeats, repeats);
        }

        this.ground = new THREE.Mesh(
            new THREE.PlaneGeometry(this.plotSize, this.plotSize),
            this.groundMaterial
        );
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        this.buildBorder();
        this.scene.add(this.renderer.group);
    }

    private buildBorder() {
        const half = this.plotSize / 2;
        const height = 2.4;
        const points: number[] = [];
        const corners: Array<[number, number]> = [
            [-half, -half], [half, -half], [half, half], [-half, half],
        ];

        for (let i = 0; i < corners.length; i++) {
            const [x1, z1] = corners[i];
            const [x2, z2] = corners[(i + 1) % corners.length];
            points.push(x1, 0, z1, x2, 0, z2);
            points.push(x1, height, z1, x2, height, z2);
            points.push(x1, 0, z1, x1, height, z1);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));

        this.border = new THREE.LineSegments(
            geometry,
            new THREE.LineBasicMaterial({ color: 0x4fd1ff, transparent: true, opacity: 0.35, depthWrite: false })
        );
        this.border.visible = false;
        this.scene.add(this.border);
    }

    public applyEnvironment() {
        this.environment?.apply(this.layout.environment.sky, this.layout.environment.light);
    }

    public setEnvironment(sky: string, light: string) {
        this.layout.environment.sky = sky;
        this.layout.environment.light = light;
        this.applyEnvironment();
    }

    public loadLayout(data: unknown) {
        this.layout.load(data);
        this.renderer.markAll();
        this.renderer.flush();
        this.applyEnvironment();
    }

    public exportLayout(): BuildLayoutData {
        return this.layout.serialize();
    }

    public placePiece(piece: BuildPiece): boolean {
        const sanitized = sanitizePiece(piece, this.plotSize);
        if (!sanitized) return false;

        const previous = this.layout.at(pieceKey(sanitized));
        const result = this.layout.place(sanitized);
        if (!result.changed) return false;

        if (previous) this.renderer.markPiece(previous);
        this.renderer.markPiece(sanitized);
        this.renderer.flush();
        return true;
    }

    public erasePiece(key: string): boolean {
        const removed = this.layout.removeAt(key);
        if (!removed) return false;

        this.renderer.markPiece(removed);
        this.renderer.flush();
        return true;
    }

    public getHeightAt(x: number, z: number): number {
        const half = this.plotSize / 2;
        if (Math.abs(x) > half || Math.abs(z) > half) return -1000;
        return this.renderer.getSurfaceHeightAt(x, z);
    }

    public followViewer(x: number, z: number) {
        this.environment?.followTarget(x, z);
    }

    public setEditorMode(active: boolean) {
        if (this.border) this.border.visible = active;
    }

    public dispose() {
        this.renderer.dispose();
        this.environment?.dispose();
        this.environment = null;

        if (this.ground) {
            this.ground.geometry.dispose();
            this.scene.remove(this.ground);
            this.ground = null;
        }
        if (this.groundMaterial) {
            this.groundMaterial.map?.dispose();
            this.groundMaterial.dispose();
            this.groundMaterial = null;
        }
        if (this.border) {
            this.border.geometry.dispose();
            (this.border.material as THREE.Material).dispose();
            this.scene.remove(this.border);
            this.border = null;
        }
        this.collisionGrid.clear();
    }
}
