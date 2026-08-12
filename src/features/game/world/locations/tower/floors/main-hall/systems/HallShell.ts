// src/features/game/world/locations/tower/floors/main-hall/systems/HallShell.ts
import * as THREE from "three";
import { CollisionGrid } from "../../../../../CollisionGrid";
import { AssetBin } from "../utils/assetBin";
import { perf } from "../../../../../../core/PerfProfiler";
import { GeometryBatch, makeRandom } from "../utils/geometryBatch";
import {
    createBrassMaterial,
    createDarkTrimMaterial,
    createDomeGlassMaterial,
    createFloorMedallionTexture,
    createGlassMaterial,
    createMarbleMaterial,
    createSteelMaterial,
    createStoneMaterial,
    createTickerTexture,
} from "../textures";
import {
    ARCADE_TOP,
    COLONNADE_RADIUS,
    COLUMN_COLLIDER_RADIUS,
    COLUMN_COUNT,
    HALL_RADIUS,
    MEZZANINE_INNER,
    MEZZANINE_Y,
    RING_STEPS,
    VAULT_HEIGHT,
    WALL_SOLID_TOP,
} from "../layout";

const TICKER_TEXT =
    "MEMETOWER FLOOR  ·  ASH INDEX +4.812%  ·  FACTION VOLUME 128.4M  ·  OPEN INTEREST 41.9M  ·  TOP MOVER: PEPE +212%  ·  LIQUIDATIONS 3.1M  ·  ";
const TICKER_REPEAT = 9;
const MEDALLION_INNER = RING_STEPS[0].radius + 0.4;
const MEDALLION_RADIUS = 46;

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
        this.materials = perf.measure("shell.textures", () => {
            const stone = createStoneMaterial(this.bin, this.random);
            const steel = createSteelMaterial(this.bin, this.random);
            const brass = createBrassMaterial(this.bin);
            const darkTrim = createDarkTrimMaterial(this.bin);
            return { stone, steel, brass, darkTrim };
        });

        const stoneBatch = new GeometryBatch();
        const brassBatch = new GeometryBatch();

        perf.measure("shell.floor", () => this.buildFloor(brassBatch));
        perf.measure("shell.wall", () => this.buildWall(stoneBatch, brassBatch));
        perf.measure("shell.colonnade", () => this.buildColonnade(stoneBatch, brassBatch));
        perf.measure("shell.ticker", () => this.buildTicker());
        perf.measure("shell.dome", () => this.buildDome(brassBatch));

        perf.measure("shell.merge", () => {
            const stoneMesh = stoneBatch.build(this.materials.stone, { castShadow: true, receiveShadow: true });
            if (stoneMesh) {
                stoneMesh.name = "hall-stone";
                this.scene.add(stoneMesh);
            }

            const brassMesh = brassBatch.build(this.materials.brass, { castShadow: false, receiveShadow: true });
            if (brassMesh) {
                brassMesh.name = "hall-brass";
                this.scene.add(brassMesh);
            }
        });

        return this.materials;
    }

    private buildFloor(brassBatch: GeometryBatch) {
        const marble = createMarbleMaterial(this.bin, this.random);
        const floor = new THREE.Mesh(new THREE.CircleGeometry(HALL_RADIUS, 96), marble);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        floor.matrixAutoUpdate = false;
        floor.updateMatrix();
        this.scene.add(floor);

        const medallion = new THREE.Mesh(
            new THREE.RingGeometry(MEDALLION_INNER, MEDALLION_RADIUS, 96, 1),
            this.bin.material(new THREE.MeshStandardMaterial({
                map: createFloorMedallionTexture(this.bin, this.random),
                transparent: true,
                roughness: 0.3,
                metalness: 0.6,
                depthWrite: false,
                polygonOffset: true,
                polygonOffsetFactor: -2,
                polygonOffsetUnits: -2,
            }))
        );
        medallion.rotation.x = -Math.PI / 2;
        medallion.position.y = 0.02;
        medallion.receiveShadow = false;
        medallion.matrixAutoUpdate = false;
        medallion.updateMatrix();
        this.scene.add(medallion);

        for (const radius of [MEDALLION_INNER, MEDALLION_RADIUS, 64, 86]) {
            const ring = this.bin.geometry(new THREE.TorusGeometry(radius, 0.14, 4, 96));
            brassBatch.addRotated(ring, 0, 0.04, 0, Math.PI / 2);
        }

        const innerRadius = RING_STEPS[0].radius;
        const spoke = this.bin.geometry(new THREE.BoxGeometry(1, 1, 1));
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const midRadius = (innerRadius + HALL_RADIUS) / 2;
            brassBatch.addScaled(
                spoke,
                Math.sin(angle) * midRadius,
                0.04,
                -Math.cos(angle) * midRadius,
                0.35,
                0.07,
                HALL_RADIUS - innerRadius,
                -angle
            );
        }
    }

    private buildWall(stoneBatch: GeometryBatch, brassBatch: GeometryBatch) {
        const plinth = this.bin.geometry(
            new THREE.CylinderGeometry(HALL_RADIUS, HALL_RADIUS, WALL_SOLID_TOP, 96, 1, true)
        );
        stoneBatch.add(plinth, 0, WALL_SOLID_TOP / 2, 0);

        const skirt = this.bin.geometry(new THREE.RingGeometry(HALL_RADIUS - 2.2, HALL_RADIUS, 96));
        stoneBatch.addRotated(skirt, 0, WALL_SOLID_TOP, 0, -Math.PI / 2);

        for (const y of [0.5, WALL_SOLID_TOP]) {
            const band = this.bin.geometry(new THREE.TorusGeometry(HALL_RADIUS - 0.25, 0.26, 5, 96));
            brassBatch.addRotated(band, 0, y, 0, Math.PI / 2);
        }

        const cornice = this.bin.geometry(new THREE.TorusGeometry(HALL_RADIUS - 0.4, 0.42, 6, 96));
        brassBatch.addRotated(cornice, 0, ARCADE_TOP, 0, Math.PI / 2);
    }

    private buildColonnade(stoneBatch: GeometryBatch, brassBatch: GeometryBatch) {
        const base = this.bin.geometry(new THREE.BoxGeometry(1, 1, 1));
        const shaft = this.bin.geometry(new THREE.CylinderGeometry(1, 1, 1, 12));
        const collarLower = this.bin.geometry(new THREE.TorusGeometry(1.62, 0.15, 6, 24).rotateX(Math.PI / 2));
        const collarUpper = this.bin.geometry(new THREE.TorusGeometry(1.32, 0.13, 6, 24).rotateX(Math.PI / 2));
        const glass = this.bin.geometry(new THREE.PlaneGeometry(1, 1));
        const mullion = this.bin.geometry(new THREE.BoxGeometry(1, 1, 1));
        const glassBatch = new GeometryBatch();

        const step = (Math.PI * 2) / COLUMN_COUNT;
        const glazeBottom = WALL_SOLID_TOP - 0.25;
        const glazeTop = ARCADE_TOP - 0.6;
        const glazeHeight = glazeTop - glazeBottom;
        const glazeCenter = (glazeTop + glazeBottom) / 2;
        const glazeRadius = HALL_RADIUS - 1.4;
        const bayWidth = 2 * glazeRadius * Math.tan(step / 2);

        for (let i = 0; i < COLUMN_COUNT; i++) {
            const angle = i * step;
            const x = Math.sin(angle) * COLONNADE_RADIUS;
            const z = -Math.cos(angle) * COLONNADE_RADIUS;
            const rotation = -angle;

            stoneBatch.addScaled(base, x, 0.45, z, 4.2, 0.9, 4.2, rotation);
            stoneBatch.addScaled(shaft, x, 7.7, z, 1.5, 13.6, 1.5, rotation);
            stoneBatch.addScaled(base, x, 14.9, z, 3.6, 0.8, 3.6, rotation);

            brassBatch.add(collarLower, x, 1.25, z);
            brassBatch.add(collarLower, x, 14.1, z);

            stoneBatch.addScaled(base, x, 16.4, z, 3.4, 0.8, 3.4, rotation);
            stoneBatch.addScaled(shaft, x, 23.1, z, 1.2, 12.6, 1.2, rotation);
            stoneBatch.addScaled(base, x, 29.8, z, 3, 0.8, 3, rotation);

            brassBatch.add(collarUpper, x, 17.2, z);
            brassBatch.add(collarUpper, x, 29, z);

            const panelAngle = angle + step / 2;
            const panelX = Math.sin(panelAngle) * glazeRadius;
            const panelZ = -Math.cos(panelAngle) * glazeRadius;
            const tangentX = Math.cos(panelAngle);
            const tangentZ = Math.sin(panelAngle);

            glassBatch.addScaled(glass, panelX, glazeCenter, panelZ, bayWidth, glazeHeight, 1, -panelAngle);

            const frameRadius = glazeRadius - 0.18;
            const frameX = Math.sin(panelAngle) * frameRadius;
            const frameZ = -Math.cos(panelAngle) * frameRadius;

            for (const offset of [-0.5, 0, 0.5]) {
                const mx = frameX + tangentX * offset * bayWidth;
                const mz = frameZ + tangentZ * offset * bayWidth;
                brassBatch.addScaled(mullion, mx, glazeCenter, mz, 0.26, glazeHeight, 0.3, -panelAngle);
            }

            for (const railY of [glazeBottom + 0.13, glazeCenter, glazeTop - 0.13]) {
                brassBatch.addScaled(mullion, frameX, railY, frameZ, bayWidth + 0.3, 0.26, 0.3, -panelAngle);
            }

            this.collisionGrid.insertCylinder(
                new THREE.Vector3(x, ARCADE_TOP / 2, z),
                COLUMN_COLLIDER_RADIUS,
                ARCADE_TOP
            );
        }

        const glassMesh = glassBatch.build(createGlassMaterial(this.bin), { renderOrder: 2 });
        if (glassMesh) this.scene.add(glassMesh);
    }

    private buildTicker() {
        this.tickerTexture = createTickerTexture(this.bin, TICKER_TEXT);
        this.tickerTexture.repeat.set(-TICKER_REPEAT, 1);

        const material = this.bin.material(new THREE.MeshStandardMaterial({
            map: this.tickerTexture,
            emissiveMap: this.tickerTexture,
            emissive: 0xffffff,
            emissiveIntensity: 0.95,
            roughness: 0.4,
            metalness: 0.1,
            side: THREE.BackSide,
        }));

        const band = new THREE.Mesh(
            new THREE.CylinderGeometry(MEZZANINE_INNER - 0.1, MEZZANINE_INNER - 0.1, 1.35, 96, 1, true),
            material
        );
        band.position.y = MEZZANINE_Y - 1.2;
        band.matrixAutoUpdate = false;
        band.updateMatrix();
        this.scene.add(band);
    }

    private buildDome(brassBatch: GeometryBatch) {
        const scaleY = (VAULT_HEIGHT - ARCADE_TOP) / HALL_RADIUS;

        const dome = new THREE.Mesh(
            new THREE.SphereGeometry(HALL_RADIUS, 64, 20, 0, Math.PI * 2, 0, Math.PI / 2),
            createDomeGlassMaterial(this.bin)
        );
        dome.scale.y = scaleY;
        dome.position.y = ARCADE_TOP;
        dome.matrixAutoUpdate = false;
        dome.updateMatrix();
        dome.renderOrder = 3;
        this.scene.add(dome);

        const ribCount = 20;
        for (let i = 0; i < ribCount; i++) {
            const angle = (i / ribCount) * Math.PI * 2;
            const points: THREE.Vector3[] = [];
            for (let step = 0; step <= 10; step++) {
                const phi = (step / 10) * (Math.PI / 2);
                const radius = HALL_RADIUS * Math.sin(phi);
                points.push(new THREE.Vector3(
                    Math.sin(angle) * radius,
                    ARCADE_TOP + HALL_RADIUS * Math.cos(phi) * scaleY,
                    -Math.cos(angle) * radius
                ));
            }

            const rib = this.bin.geometry(
                new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 14, 0.34, 5, false)
            );
            brassBatch.add(rib, 0, 0, 0);
        }

        for (let step = 1; step <= 4; step++) {
            const phi = (step / 5) * (Math.PI / 2);
            const radius = HALL_RADIUS * Math.sin(phi);
            const y = ARCADE_TOP + HALL_RADIUS * Math.cos(phi) * scaleY;
            const hoop = this.bin.geometry(new THREE.TorusGeometry(radius, 0.2, 5, 96));
            brassBatch.addRotated(hoop, 0, y, 0, Math.PI / 2);
        }

        const oculus = this.bin.geometry(new THREE.TorusGeometry(11, 0.55, 6, 48));
        brassBatch.addRotated(oculus, 0, VAULT_HEIGHT - 1.2, 0, Math.PI / 2);

        const lanternRing = this.bin.geometry(new THREE.CylinderGeometry(11, 11, 2.4, 48, 1, true));
        brassBatch.add(lanternRing, 0, VAULT_HEIGHT + 0.2, 0);
    }


    update(delta: number) {
        if (this.tickerTexture) {
            this.tickerTexture.offset.x = (this.tickerTexture.offset.x + delta * 0.024) % 1;
        }
    }

    dispose() {
        this.tickerTexture = null;
    }
}
