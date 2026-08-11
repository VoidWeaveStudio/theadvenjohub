// src/features/game/world/locations/tower/floors/main-hall/systems/HallShell.ts
import * as THREE from "three";
import { CollisionGrid } from "../../../../../CollisionGrid";
import { AssetBin } from "../utils/assetBin";
import { GeometryBatch, makeRandom } from "../utils/geometryBatch";
import {
    createBrassMaterial,
    createDarkTrimMaterial,
    createGlassMaterial,
    createMarbleMaterial,
    createSkylightMaterial,
    createSteelMaterial,
    createStoneMaterial,
    createTickerTexture,
} from "../textures";
import {
    ARCADE_TOP,
    COLONNADE_RADIUS,
    COLUMN_COUNT,
    HALL_RADIUS,
    MEZZANINE_INNER,
    MEZZANINE_OUTER,
    MEZZANINE_Y,
    RING_STEPS,
    VAULT_HEIGHT,
    WALL_HEIGHT,
} from "../layout";

const TICKER_TEXT = "MEMETOWER FLOOR  ·  ASH INDEX  ·  FACTION VOLUME  ·  OPEN INTEREST  ·  ";
const TICKER_REPEAT = 11;

export interface ShellMaterials {
    stone: THREE.MeshStandardMaterial;
    steel: THREE.MeshStandardMaterial;
    brass: THREE.MeshStandardMaterial;
    darkTrim: THREE.MeshStandardMaterial;
}

export class HallShell {
    private readonly random = makeRandom(0x51a7c0);
    private tickerTexture: THREE.Texture | null = null;

    public materials!: ShellMaterials;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly collisionGrid: CollisionGrid,
        private readonly bin: AssetBin
    ) { }

    create(): ShellMaterials {
        const stone = createStoneMaterial(this.bin, this.random);
        const steel = createSteelMaterial(this.bin, this.random);
        const brass = createBrassMaterial(this.bin);
        const darkTrim = createDarkTrimMaterial(this.bin);
        this.materials = { stone, steel, brass, darkTrim };

        const stoneBatch = new GeometryBatch();
        const brassBatch = new GeometryBatch();

        this.buildFloor(brassBatch);
        this.buildWall(steel);
        this.buildColonnade(stoneBatch, brassBatch);
        this.buildMezzanine(brassBatch);
        this.buildTicker();
        this.buildVault(brassBatch);

        const stoneMesh = stoneBatch.build(stone, { castShadow: true, receiveShadow: true });
        if (stoneMesh) this.scene.add(stoneMesh);

        const brassMesh = brassBatch.build(brass, { castShadow: false, receiveShadow: true });
        if (brassMesh) this.scene.add(brassMesh);

        this.buildPerimeterCollision();

        return this.materials;
    }

    private buildFloor(brassBatch: GeometryBatch) {
        const marble = createMarbleMaterial(this.bin, this.random);
        const floor = new THREE.Mesh(new THREE.CircleGeometry(HALL_RADIUS, 64), marble);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        floor.matrixAutoUpdate = false;
        floor.updateMatrix();
        this.scene.add(floor);

        for (const radius of [26, 46]) {
            const ring = this.bin.geometry(new THREE.TorusGeometry(radius, 0.13, 4, 72));
            brassBatch.addRotated(ring, 0, 0.03, 0, Math.PI / 2);
        }

        const innerRadius = RING_STEPS[0].radius;
        const spoke = this.bin.geometry(new THREE.BoxGeometry(1, 1, 1));
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const midRadius = (innerRadius + HALL_RADIUS) / 2;
            brassBatch.addScaled(
                spoke,
                Math.sin(angle) * midRadius,
                0.03,
                -Math.cos(angle) * midRadius,
                0.4,
                0.06,
                HALL_RADIUS - innerRadius,
                -angle
            );
        }
    }

    private buildWall(steel: THREE.MeshStandardMaterial) {
        const wallMaterial = this.bin.material(steel.clone());
        wallMaterial.side = THREE.BackSide;

        const wall = new THREE.Mesh(
            new THREE.CylinderGeometry(HALL_RADIUS, HALL_RADIUS, WALL_HEIGHT, 48, 1, true),
            wallMaterial
        );
        wall.position.y = WALL_HEIGHT / 2;
        wall.receiveShadow = true;
        wall.matrixAutoUpdate = false;
        wall.updateMatrix();
        this.scene.add(wall);
    }

    private buildColonnade(stoneBatch: GeometryBatch, brassBatch: GeometryBatch) {
        const base = this.bin.geometry(new THREE.BoxGeometry(1, 1, 1));
        const shaft = this.bin.geometry(new THREE.CylinderGeometry(1, 1, 1, 10));
        const collar = this.bin.geometry(new THREE.TorusGeometry(1, 0.14, 5, 16));
        const glass = this.bin.geometry(new THREE.PlaneGeometry(1, 1));
        const glassBatch = new GeometryBatch();

        const step = (Math.PI * 2) / COLUMN_COUNT;

        for (let i = 0; i < COLUMN_COUNT; i++) {
            const angle = i * step;
            const x = Math.sin(angle) * COLONNADE_RADIUS;
            const z = -Math.cos(angle) * COLONNADE_RADIUS;
            const rotation = -angle;

            stoneBatch.addScaled(base, x, 0.4, z, 4, 0.8, 4, rotation);
            stoneBatch.addScaled(shaft, x, 6.2, z, 1.3, 10.8, 1.3, rotation);
            stoneBatch.addScaled(base, x, 12, z, 3.4, 0.8, 3.4, rotation);

            brassBatch.addRotated(collar, x, 1.1, z, 0, rotation, 0);
            brassBatch.addRotated(collar, x, 11.3, z, 0, rotation, 0);

            stoneBatch.addScaled(shaft, x, 18.4, z, 0.95, 9.6, 0.95, rotation);
            stoneBatch.addScaled(base, x, 23.55, z, 2.7, 0.7, 2.7, rotation);

            const panelAngle = angle + step / 2;
            const panelX = Math.sin(panelAngle) * (HALL_RADIUS - 1.2);
            const panelZ = -Math.cos(panelAngle) * (HALL_RADIUS - 1.2);
            const panelWidth = 2 * (HALL_RADIUS - 1.2) * Math.sin(step / 2) * 0.84;
            glassBatch.addScaled(glass, panelX, 12, panelZ, panelWidth, 22, 1, -panelAngle);

            this.collisionGrid.insert(new THREE.Box3(
                new THREE.Vector3(x - 2, 0, z - 2),
                new THREE.Vector3(x + 2, 14, z + 2)
            ));
        }

        const glassMesh = glassBatch.build(createGlassMaterial(this.bin), { renderOrder: 2 });
        if (glassMesh) this.scene.add(glassMesh);
    }

    private buildMezzanine(brassBatch: GeometryBatch) {
        const mezzBatch = new GeometryBatch();

        const deck = this.bin.geometry(new THREE.RingGeometry(MEZZANINE_INNER, MEZZANINE_OUTER, 48));
        mezzBatch.addRotated(deck, 0, MEZZANINE_Y, 0, -Math.PI / 2);
        mezzBatch.addRotated(deck, 0, MEZZANINE_Y - 0.5, 0, Math.PI / 2);

        const parapet = this.bin.geometry(new THREE.CylinderGeometry(MEZZANINE_INNER, MEZZANINE_INNER, 1.6, 48, 1, true));
        mezzBatch.add(parapet, 0, MEZZANINE_Y + 0.8, 0);

        const mezzMaterial = this.bin.material(this.materials.steel.clone());
        mezzMaterial.side = THREE.DoubleSide;
        const mezzMesh = mezzBatch.build(mezzMaterial, { receiveShadow: true });
        if (mezzMesh) this.scene.add(mezzMesh);

        const rail = this.bin.geometry(new THREE.TorusGeometry(MEZZANINE_INNER, 0.16, 5, 64));
        brassBatch.addRotated(rail, 0, MEZZANINE_Y + 1.65, 0, Math.PI / 2);

        const cornice = this.bin.geometry(new THREE.TorusGeometry(COLONNADE_RADIUS, 0.3, 5, 64));
        brassBatch.addRotated(cornice, 0, ARCADE_TOP, 0, Math.PI / 2);
    }

    private buildTicker() {
        this.tickerTexture = createTickerTexture(this.bin, TICKER_TEXT);
        this.tickerTexture.repeat.set(-TICKER_REPEAT, 1);

        const material = this.bin.material(new THREE.MeshStandardMaterial({
            map: this.tickerTexture,
            emissiveMap: this.tickerTexture,
            emissive: 0xffffff,
            emissiveIntensity: 1.1,
            roughness: 0.4,
            metalness: 0.1,
            side: THREE.BackSide,
        }));

        const band = new THREE.Mesh(
            new THREE.CylinderGeometry(MEZZANINE_INNER - 0.1, MEZZANINE_INNER - 0.1, 1.25, 48, 1, true),
            material
        );
        band.position.y = MEZZANINE_Y + 0.8;
        band.matrixAutoUpdate = false;
        band.updateMatrix();
        this.scene.add(band);
    }

    private buildVault(brassBatch: GeometryBatch) {
        const scaleY = (VAULT_HEIGHT - ARCADE_TOP) / HALL_RADIUS;

        const vault = new THREE.Mesh(
            new THREE.SphereGeometry(HALL_RADIUS, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2),
            createSkylightMaterial(this.bin)
        );
        vault.scale.y = scaleY;
        vault.position.y = ARCADE_TOP;
        vault.matrixAutoUpdate = false;
        vault.updateMatrix();
        vault.renderOrder = -1000;
        this.scene.add(vault);

        const ribCount = 12;
        for (let i = 0; i < ribCount; i++) {
            const angle = (i / ribCount) * Math.PI * 2;
            const points: THREE.Vector3[] = [];
            for (let step = 0; step <= 8; step++) {
                const phi = (step / 8) * (Math.PI / 2);
                const radius = HALL_RADIUS * Math.sin(phi);
                points.push(new THREE.Vector3(
                    Math.sin(angle) * radius,
                    ARCADE_TOP + HALL_RADIUS * Math.cos(phi) * scaleY,
                    -Math.cos(angle) * radius
                ));
            }

            const rib = this.bin.geometry(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 10, 0.3, 4, false));
            brassBatch.add(rib, 0, 0, 0);
        }

        const oculus = this.bin.geometry(new THREE.TorusGeometry(12, 0.4, 5, 32));
        brassBatch.addRotated(oculus, 0, VAULT_HEIGHT - 1.6, 0, Math.PI / 2);
    }

    private buildPerimeterCollision() {
        const segments = 40;
        for (let i = 0; i < segments; i++) {
            const angle = ((i + 0.5) / segments) * Math.PI * 2;
            const x = Math.cos(angle) * (HALL_RADIUS + 5);
            const z = Math.sin(angle) * (HALL_RADIUS + 5);
            const half = 8;

            this.collisionGrid.insert(new THREE.Box3(
                new THREE.Vector3(x - half, 0, z - half),
                new THREE.Vector3(x + half, VAULT_HEIGHT + 10, z + half)
            ));
        }
    }

    update(delta: number) {
        if (this.tickerTexture) {
            this.tickerTexture.offset.x = (this.tickerTexture.offset.x + delta * 0.03) % 1;
        }
    }

    dispose() {
        this.tickerTexture = null;
    }
}
