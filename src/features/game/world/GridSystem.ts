//src\features\game\world\GridSystem.ts
import * as THREE from "three";

export interface GridCell {
    x: number;
    z: number;
    occupied: boolean;
    type: string | null;
}

export class GridSystem {
    private cellSize: number;
    private gridSize: number;
    private grid: Map<string, GridCell> = new Map();
    private gridHelper: THREE.GridHelper | null = null;
    private highlightMesh: THREE.Mesh | null = null;

    constructor(gridSize: number = 500, cellSize: number = 5) {
        this.gridSize = gridSize;
        this.cellSize = cellSize;
        this.initializeGrid();
    }

    private initializeGrid() {
        const cellsPerSide = Math.floor(this.gridSize / this.cellSize);
        const halfSize = this.gridSize / 2;

        for (let x = 0; x < cellsPerSide; x++) {
            for (let z = 0; z < cellsPerSide; z++) {
                const worldX = -halfSize + x * this.cellSize + this.cellSize / 2;
                const worldZ = -halfSize + z * this.cellSize + this.cellSize / 2;
                const key = this.getCellKey(x, z);

                this.grid.set(key, {
                    x: worldX,
                    z: worldZ,
                    occupied: false,
                    type: null,
                });
            }
        }
    }

    private getCellKey(gridX: number, gridZ: number): string {
        return `${gridX},${gridZ}`;
    }

    worldToGrid(worldX: number, worldZ: number): { gridX: number; gridZ: number } {
        const halfSize = this.gridSize / 2;
        const gridX = Math.floor((worldX + halfSize) / this.cellSize);
        const gridZ = Math.floor((worldZ + halfSize) / this.cellSize);
        return { gridX, gridZ };
    }

    gridToWorld(gridX: number, gridZ: number): { worldX: number; worldZ: number } {
        const halfSize = this.gridSize / 2;
        const worldX = -halfSize + gridX * this.cellSize + this.cellSize / 2;
        const worldZ = -halfSize + gridZ * this.cellSize + this.cellSize / 2;
        return { worldX, worldZ };
    }

    getCell(gridX: number, gridZ: number): GridCell | null {
        return this.grid.get(this.getCellKey(gridX, gridZ)) || null;
    }

    isCellOccupied(gridX: number, gridZ: number): boolean {
        const cell = this.getCell(gridX, gridZ);
        return cell ? cell.occupied : false;
    }

    occupyCell(gridX: number, gridZ: number, type: string): boolean {
        const cell = this.getCell(gridX, gridZ);
        if (!cell || cell.occupied) return false;

        cell.occupied = true;
        cell.type = type;
        return true;
    }

    freeCell(gridX: number, gridZ: number): boolean {
        const cell = this.getCell(gridX, gridZ);
        if (!cell) return false;

        cell.occupied = false;
        cell.type = null;
        return true;
    }

    createVisualization(scene: THREE.Scene) {
        this.gridHelper = new THREE.GridHelper(
            this.gridSize,
            this.gridSize / this.cellSize,
            0x000000,
            0x000000
        );
        (this.gridHelper.material as THREE.Material).opacity = 0.15;
        (this.gridHelper.material as THREE.Material).transparent = true;
        this.gridHelper.position.y = 0.02;
        this.gridHelper.visible = false;
        scene.add(this.gridHelper);

        const geometry = new THREE.PlaneGeometry(this.cellSize, this.cellSize);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
        });
        this.highlightMesh = new THREE.Mesh(geometry, material);
        this.highlightMesh.rotation.x = -Math.PI / 2;
        this.highlightMesh.position.y = 0.05;
        this.highlightMesh.visible = false;
        scene.add(this.highlightMesh);
    }

    setVisible(visible: boolean) {
        if (this.gridHelper) {
            this.gridHelper.visible = visible;
        }
    }

    highlightCell(gridX: number, gridZ: number, valid: boolean = true) {
        if (!this.highlightMesh) return;

        const { worldX, worldZ } = this.gridToWorld(gridX, gridZ);
        this.highlightMesh.position.x = worldX;
        this.highlightMesh.position.z = worldZ;
        this.highlightMesh.visible = true;

        const material = this.highlightMesh.material as THREE.MeshBasicMaterial;
        material.color.set(valid ? 0x00ff00 : 0xff0000);
    }

    hideHighlight() {
        if (this.highlightMesh) {
            this.highlightMesh.visible = false;
        }
    }

    getCellSize(): number {
        return this.cellSize;
    }

    getGridSize(): number {
        return this.gridSize;
    }

    getOccupiedCells(): GridCell[] {
        return Array.from(this.grid.values()).filter((c) => c.occupied);
    }

    dispose() {
        if (this.gridHelper) {
            this.gridHelper.geometry.dispose();
            (this.gridHelper.material as THREE.Material).dispose();
        }
        if (this.highlightMesh) {
            this.highlightMesh.geometry.dispose();
            (this.highlightMesh.material as THREE.Material).dispose();
        }
    }
}