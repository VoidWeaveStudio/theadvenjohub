// src/features/game/world/locations/tower/floors/main-hall/systems/MezzanineSystem.ts
import * as THREE from "three";
import { CollisionGrid } from "../../../../../CollisionGrid";
import { AssetBin } from "../utils/assetBin";
import { GeometryBatch } from "../utils/geometryBatch";
import { insertAnnulusDeck, insertLocalBox } from "../utils/collision";
import { createStairMaterial } from "../textures";
import type { ShellMaterials } from "./HallShell";
import {
    MEZZANINE_INNER,
    MEZZANINE_OUTER,
    MEZZANINE_SLAB,
    MEZZANINE_Y,
    RAIL_HEIGHT,
    STAIR_ANGLES,
    STAIR_BOTTOM_RADIUS,
    STAIR_LANDING_OUTER,
    STAIR_RISE,
    STAIR_RUN,
    STAIR_STEPS,
    STAIR_TOP_RADIUS,
    STAIR_WIDTH,
    inwardRotation,
    localToWorld,
} from "../layout";

const BALUSTER_SPACING = 2.1;
const RAIL_TUBE = 0.16;
const SIDE_WALL_THICKNESS = 0.7;

function railGapHalfAngle(radius: number): number {
    return STAIR_WIDTH / 2 / radius + 0.035;
}

function insideGap(angle: number, gapHalf: number): boolean {
    for (const stair of STAIR_ANGLES) {
        let diff = angle - stair;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) < gapHalf) return true;
    }
    return false;
}

export class MezzanineSystem {
    constructor(
        private readonly scene: THREE.Scene,
        private readonly collisionGrid: CollisionGrid,
        private readonly bin: AssetBin
    ) { }

    create(materials: ShellMaterials) {
        const stoneBatch = new GeometryBatch();
        const brassBatch = new GeometryBatch();
        const darkBatch = new GeometryBatch();

        this.buildDeck(brassBatch, darkBatch);
        this.buildInnerRail(brassBatch, darkBatch);
        this.buildStairs(stoneBatch, brassBatch, darkBatch);

        const stoneMesh = stoneBatch.build(createStairMaterial(this.bin), { castShadow: true, receiveShadow: true });
        if (stoneMesh) this.scene.add(stoneMesh);

        const brassMesh = brassBatch.build(materials.brass, { castShadow: true, receiveShadow: true });
        if (brassMesh) this.scene.add(brassMesh);

        const darkMesh = darkBatch.build(materials.darkTrim, { castShadow: true, receiveShadow: true });
        if (darkMesh) this.scene.add(darkMesh);
    }

    private buildDeck(brassBatch: GeometryBatch, darkBatch: GeometryBatch) {
        const cut = this.bin.geometry(new THREE.RingGeometry(MEZZANINE_INNER, MEZZANINE_OUTER, 96, 3));

        darkBatch.addRotated(cut, 0, MEZZANINE_Y, 0, -Math.PI / 2);
        darkBatch.addRotated(cut, 0, MEZZANINE_Y - MEZZANINE_SLAB, 0, Math.PI / 2);

        for (const radius of [MEZZANINE_INNER + 3, MEZZANINE_INNER + 9, MEZZANINE_OUTER - 2]) {
            const inlay = this.bin.geometry(new THREE.TorusGeometry(radius, 0.1, 4, 120));
            brassBatch.addRotated(inlay, 0, MEZZANINE_Y + 0.03, 0, Math.PI / 2);
        }

        const fasciaHeight = MEZZANINE_SLAB + 1.6;
        const fascia = this.bin.geometry(
            new THREE.CylinderGeometry(MEZZANINE_INNER, MEZZANINE_INNER, fasciaHeight, 96, 1, true)
        );
        darkBatch.add(fascia, 0, MEZZANINE_Y - fasciaHeight / 2, 0);

        for (const y of [MEZZANINE_Y - fasciaHeight, MEZZANINE_Y - 0.1]) {
            const trim = this.bin.geometry(new THREE.TorusGeometry(MEZZANINE_INNER + 0.06, 0.14, 5, 120));
            brassBatch.addRotated(trim, 0, y, 0, Math.PI / 2);
        }

        const nosing = this.bin.geometry(new THREE.TorusGeometry(MEZZANINE_INNER, 0.18, 5, 96));
        brassBatch.addRotated(nosing, 0, MEZZANINE_Y + 0.02, 0, Math.PI / 2);

        const bracketCount = 36;
        const bracket = this.bin.geometry(new THREE.BoxGeometry(1, 1, 1));
        for (let i = 0; i < bracketCount; i++) {
            const angle = (i / bracketCount) * Math.PI * 2;
            if (insideGap(angle, railGapHalfAngle(MEZZANINE_INNER) + 0.06)) continue;

            const radius = MEZZANINE_INNER - 0.5;
            darkBatch.addScaled(
                bracket,
                Math.sin(angle) * radius,
                MEZZANINE_Y - 3.2,
                -Math.cos(angle) * radius,
                0.6,
                2.2,
                1.6,
                -angle
            );
        }

        insertAnnulusDeck(this.collisionGrid, MEZZANINE_INNER, MEZZANINE_OUTER, MEZZANINE_Y, 0.7);
    }

    private buildInnerRail(brassBatch: GeometryBatch, darkBatch: GeometryBatch) {
        const gapHalf = railGapHalfAngle(MEZZANINE_INNER);
        const circumference = Math.PI * 2 * MEZZANINE_INNER;
        const balusterCount = Math.round(circumference / BALUSTER_SPACING);

        const baluster = this.bin.geometry(new THREE.CylinderGeometry(0.07, 0.07, 1, 6));
        const kick = this.bin.geometry(new THREE.BoxGeometry(1, 1, 1));

        for (let i = 0; i < balusterCount; i++) {
            const angle = (i / balusterCount) * Math.PI * 2;
            if (insideGap(angle, gapHalf)) continue;

            const x = Math.sin(angle) * MEZZANINE_INNER;
            const z = -Math.cos(angle) * MEZZANINE_INNER;

            brassBatch.addScaled(baluster, x, MEZZANINE_Y + RAIL_HEIGHT / 2, z, 1, RAIL_HEIGHT, 1, -angle);

            const chord = (circumference / balusterCount) * 1.15;
            darkBatch.addScaled(kick, x, MEZZANINE_Y + 0.3, z, chord, 0.6, 0.34, -angle);
        }

        this.buildRailArcs(brassBatch, MEZZANINE_INNER, MEZZANINE_Y + RAIL_HEIGHT, gapHalf, 0.14);
        this.buildRailArcs(brassBatch, MEZZANINE_INNER, MEZZANINE_Y + RAIL_HEIGHT * 0.55, gapHalf, 0.075);

        this.insertRailCollision(gapHalf);
    }

    private buildRailArcs(
        brassBatch: GeometryBatch,
        radius: number,
        y: number,
        gapHalf: number,
        tube: number
    ) {
        const starts = STAIR_ANGLES.map((angle) => angle - Math.PI / 2);
        const a0 = starts[0];
        const a1 = starts[1];

        let span = a1 - a0;
        while (span < 0) span += Math.PI * 2;

        const arcs: [number, number][] = [
            [a0 + gapHalf, span - gapHalf * 2],
            [a1 + gapHalf, Math.PI * 2 - span - gapHalf * 2],
        ];

        for (const [start, length] of arcs) {
            if (length <= 0.01) continue;
            const geometry = this.bin.geometry(
                new THREE.TorusGeometry(radius, tube, 6, Math.max(24, Math.round(length * 26)), length)
            );
            brassBatch.addRotated(geometry, 0, y, 0, Math.PI / 2, 0, start);
        }
    }

    private insertRailCollision(gapHalf: number) {
        this.collisionGrid.insertRingWall(
            MEZZANINE_INNER,
            0.6,
            MEZZANINE_Y,
            MEZZANINE_Y + RAIL_HEIGHT,
            STAIR_ANGLES.map((angle) => ({ angle, halfAngle: gapHalf }))
        );
    }

    private buildStairs(stoneBatch: GeometryBatch, brassBatch: GeometryBatch, darkBatch: GeometryBatch) {
        const box = this.bin.geometry(new THREE.BoxGeometry(1, 1, 1));
        const halfWidth = STAIR_WIDTH / 2;
        const sideOffset = halfWidth + SIDE_WALL_THICKNESS / 2;

        for (const angle of STAIR_ANGLES) {
            const rotation = inwardRotation(angle);

            for (let i = 0; i < STAIR_STEPS; i++) {
                const radius = STAIR_BOTTOM_RADIUS + STAIR_RUN * (i + 0.5);
                const top = STAIR_RISE * (i + 1);
                const at = localToWorld(angle, radius, 0, 0, 0);

                stoneBatch.addScaled(box, at[0], top / 2, at[2], STAIR_WIDTH, top, STAIR_RUN, rotation);

                const nose = localToWorld(angle, radius - STAIR_RUN / 2 - 0.02, 0, 0, 0);
                brassBatch.addScaled(box, nose[0], top + 0.025, nose[2], STAIR_WIDTH, 0.09, 0.1, rotation);

                insertLocalBox(
                    this.collisionGrid,
                    angle,
                    radius,
                    0,
                    0,
                    STAIR_WIDTH,
                    STAIR_RUN + 0.1,
                    top - STAIR_RISE * 0.9,
                    top
                );
            }

            const landingRadius = (STAIR_TOP_RADIUS + STAIR_LANDING_OUTER) / 2;
            const landingDepth = STAIR_LANDING_OUTER - STAIR_TOP_RADIUS;
            const landingAt = localToWorld(angle, landingRadius, 0, 0, 0);

            stoneBatch.addScaled(
                box,
                landingAt[0],
                MEZZANINE_Y - 0.35,
                landingAt[2],
                STAIR_WIDTH,
                0.7,
                landingDepth,
                rotation
            );

            insertLocalBox(
                this.collisionGrid,
                angle,
                landingRadius,
                0,
                0,
                STAIR_WIDTH,
                landingDepth,
                MEZZANINE_Y - 0.6,
                MEZZANINE_Y
            );

            insertLocalBox(
                this.collisionGrid,
                angle,
                STAIR_TOP_RADIUS - 0.5,
                0,
                0,
                STAIR_WIDTH + SIDE_WALL_THICKNESS * 2,
                1.2,
                0,
                MEZZANINE_Y - 0.55
            );

            for (const side of [-1, 1]) {
                this.buildStairSide(angle, side * sideOffset, rotation, box, stoneBatch, brassBatch, darkBatch);
            }
        }
    }

    private buildStairSide(
        angle: number,
        offsetX: number,
        rotation: number,
        box: THREE.BufferGeometry,
        stoneBatch: GeometryBatch,
        brassBatch: GeometryBatch,
        darkBatch: GeometryBatch
    ) {
        const handrailPoints: THREE.Vector3[] = [];

        for (let i = 0; i < STAIR_STEPS; i++) {
            const radius = STAIR_BOTTOM_RADIUS + STAIR_RUN * (i + 0.5);
            const top = STAIR_RISE * (i + 1);
            const at = localToWorld(angle, radius, offsetX, 0, 0);

            stoneBatch.addScaled(
                box,
                at[0],
                top / 2,
                at[2],
                SIDE_WALL_THICKNESS,
                top,
                STAIR_RUN,
                rotation
            );

            insertLocalBox(
                this.collisionGrid,
                angle,
                radius,
                offsetX,
                0,
                SIDE_WALL_THICKNESS + 0.2,
                STAIR_RUN + 0.1,
                0,
                top + RAIL_HEIGHT
            );

            if (i % 4 === 0) {
                brassBatch.addScaled(
                    box,
                    at[0],
                    top + RAIL_HEIGHT / 2,
                    at[2],
                    0.12,
                    RAIL_HEIGHT,
                    0.12,
                    rotation
                );
            }

            handrailPoints.push(new THREE.Vector3(at[0], top + RAIL_HEIGHT, at[2]));
        }

        const first = localToWorld(angle, STAIR_BOTTOM_RADIUS - 0.6, offsetX, 0, 0);
        handrailPoints.unshift(new THREE.Vector3(first[0], RAIL_HEIGHT * 0.85, first[2]));

        const last = localToWorld(angle, STAIR_LANDING_OUTER - 0.4, offsetX, 0, 0);
        handrailPoints.push(new THREE.Vector3(last[0], MEZZANINE_Y + RAIL_HEIGHT, last[2]));

        const curve = new THREE.CatmullRomCurve3(handrailPoints);
        const handrail = this.bin.geometry(
            new THREE.TubeGeometry(curve, STAIR_STEPS * 2, RAIL_TUBE, 6, false)
        );
        brassBatch.add(handrail, 0, 0, 0);

        const newel = localToWorld(angle, STAIR_BOTTOM_RADIUS - 0.6, offsetX, 0, 0);
        darkBatch.addScaled(box, newel[0], 0.85, newel[2], 1.1, 1.7, 1.1, rotation);
        brassBatch.addScaled(box, newel[0], 1.78, newel[2], 1.3, 0.16, 1.3, rotation);

        insertLocalBox(
            this.collisionGrid,
            angle,
            STAIR_BOTTOM_RADIUS - 0.6,
            offsetX,
            0,
            1.2,
            1.2,
            0,
            1.9
        );

        for (let i = 0; i < STAIR_STEPS; i += 4) {
            const radius = STAIR_BOTTOM_RADIUS + STAIR_RUN * (i + 0.5);
            const top = STAIR_RISE * (i + 1);
            const at = localToWorld(angle, radius, offsetX, 0, 0);
            brassBatch.addScaled(box, at[0], top + 0.12, at[2], 0.9, 0.1, 0.5, rotation);
        }
    }
}
