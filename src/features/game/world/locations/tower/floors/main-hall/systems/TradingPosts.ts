// src/features/game/world/locations/tower/floors/main-hall/systems/TradingPosts.ts
import * as THREE from "three";
import { CollisionGrid } from "../../../../../CollisionGrid";
import { AssetBin } from "../utils/assetBin";
import { GeometryBatch, atlasRow } from "../utils/geometryBatch";
import type { ShellMaterials } from "./HallShell";
import { HALL_NPCS, HallNpc, POST_RADIUS, inwardRotation, isLowEndDevice, localToWorld } from "../layout";

const SCREEN_TILE_WIDTH = 512;
const SCREEN_TILE_HEIGHT = 192;
const SIGN_TILE_WIDTH = 512;
const SIGN_TILE_HEIGHT = 128;

function makeAtlas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return { canvas, ctx: canvas.getContext("2d")! };
}

function paintScreenTile(ctx: CanvasRenderingContext2D, npc: HallNpc, top: number) {
    ctx.save();
    ctx.translate(0, top);

    ctx.fillStyle = "#0a0d13";
    ctx.fillRect(0, 0, SCREEN_TILE_WIDTH, SCREEN_TILE_HEIGHT);

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
        const y = (i / 4) * SCREEN_TILE_HEIGHT;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(SCREEN_TILE_WIDTH, y);
        ctx.stroke();
    }

    ctx.fillStyle = npc.accent;
    ctx.font = "bold 54px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(npc.npcName.toUpperCase(), 28, 58);

    ctx.fillStyle = "#8b95a6";
    ctx.font = "bold 30px Arial";
    ctx.fillText(npc.role.toUpperCase(), 30, 112);

    ctx.fillStyle = npc.accent;
    ctx.fillRect(28, 142, 180, 4);

    ctx.strokeStyle = npc.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 300; x <= 484; x += 23) {
        const y = 96 + Math.sin(x * 0.06) * 34;
        if (x === 300) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.restore();
}

function paintSignTile(ctx: CanvasRenderingContext2D, npc: HallNpc, index: number, top: number) {
    ctx.save();
    ctx.translate(0, top);

    ctx.fillStyle = "rgba(10,13,19,0.92)";
    ctx.fillRect(0, 0, SIGN_TILE_WIDTH, SIGN_TILE_HEIGHT);

    ctx.strokeStyle = npc.accent;
    ctx.lineWidth = 5;
    ctx.strokeRect(4, 4, SIGN_TILE_WIDTH - 8, SIGN_TILE_HEIGHT - 8);

    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = "#8b95a6";
    ctx.font = "bold 34px Arial";
    ctx.fillText("POST " + String(index + 1).padStart(2, "0"), 26, 64);

    ctx.textAlign = "right";
    ctx.fillStyle = npc.accent;
    ctx.font = "bold 46px Arial";
    ctx.fillText(npc.role.toUpperCase(), 486, 64);

    ctx.restore();
}

export class TradingPosts {
    constructor(
        private readonly scene: THREE.Scene,
        private readonly collisionGrid: CollisionGrid,
        private readonly bin: AssetBin
    ) { }

    create(materials: ShellMaterials) {
        const steelBatch = new GeometryBatch();
        const brassBatch = new GeometryBatch();
        const darkBatch = new GeometryBatch();
        const screenBatch = new GeometryBatch();
        const signBatch = new GeometryBatch();

        const box = this.bin.geometry(new THREE.BoxGeometry(1, 1, 1));
        const cylinder = this.bin.geometry(new THREE.CylinderGeometry(1, 1, 1, 10));
        const plane = this.bin.geometry(new THREE.PlaneGeometry(1, 1));

        const screenAtlas = makeAtlas(SCREEN_TILE_WIDTH, SCREEN_TILE_HEIGHT * HALL_NPCS.length);
        const signAtlas = makeAtlas(SIGN_TILE_WIDTH, SIGN_TILE_HEIGHT * HALL_NPCS.length);
        const lowEnd = isLowEndDevice();

        HALL_NPCS.forEach((npc, index) => {
            const rotation = inwardRotation(npc.angle);
            const at = (lx: number, ly: number, lz: number) => localToWorld(npc.angle, POST_RADIUS, lx, ly, lz);

            const cabinet = at(0, 2.4, -3);
            steelBatch.addScaled(box, cabinet[0], cabinet[1], cabinet[2], 10.5, 4.8, 1.4, rotation);

            const counter = at(0, 0.6, 1.4);
            darkBatch.addScaled(box, counter[0], counter[1], counter[2], 9.4, 1.2, 1.8, rotation);

            const counterTop = at(0, 1.26, 1.4);
            brassBatch.addScaled(box, counterTop[0], counterTop[1], counterTop[2], 9.7, 0.14, 2.1, rotation);

            for (const side of [-1, 1]) {
                const front = at(side * 4.9, 3.1, 2.3);
                steelBatch.addScaled(box, front[0], front[1], front[2], 0.3, 6.2, 0.3, rotation);

                const back = at(side * 4.9, 3.1, -3);
                steelBatch.addScaled(box, back[0], back[1], back[2], 0.3, 6.2, 0.3, rotation);
            }

            const canopy = at(0, 6.3, -0.4);
            steelBatch.addScaled(box, canopy[0], canopy[1], canopy[2], 11.4, 0.36, 6.4, rotation);

            const canopyTrim = at(0, 6.58, -0.4);
            brassBatch.addScaled(box, canopyTrim[0], canopyTrim[1], canopyTrim[2], 11.8, 0.16, 6.8, rotation);

            this.addProps(npc, steelBatch, brassBatch, darkBatch, box, cylinder, rotation, at);

            paintScreenTile(screenAtlas.ctx, npc, index * SCREEN_TILE_HEIGHT);
            const screenAt = at(0, 3.7, -2.24);
            screenBatch.addPanel(plane, screenAt[0], screenAt[1], screenAt[2], 8.6, 3.2, rotation, atlasRow(HALL_NPCS.length, index));

            paintSignTile(signAtlas.ctx, npc, index, index * SIGN_TILE_HEIGHT);
            const signAt = at(0, 7.9, -0.4);
            signBatch.addPanel(plane, signAt[0], signAt[1], signAt[2], 7.4, 1.85, rotation, atlasRow(HALL_NPCS.length, index));

            if (!lowEnd) {
                const light = new THREE.PointLight(npc.accentHex, 9, 30, 2);
                const lightAt = at(0, 5.4, 1.6);
                light.position.set(lightAt[0], lightAt[1], lightAt[2]);
                light.castShadow = false;
                this.scene.add(light);
            }

            const center = at(0, 0, -0.8);
            this.collisionGrid.insert(new THREE.Box3(
                new THREE.Vector3(center[0] - 3.4, 0, center[2] - 3.4),
                new THREE.Vector3(center[0] + 3.4, 6.4, center[2] + 3.4)
            ));
        });

        const steelMesh = steelBatch.build(materials.steel, { castShadow: true, receiveShadow: true });
        if (steelMesh) this.scene.add(steelMesh);

        const darkMesh = darkBatch.build(materials.darkTrim, { castShadow: true, receiveShadow: true });
        if (darkMesh) this.scene.add(darkMesh);

        const brassMesh = brassBatch.build(materials.brass, { castShadow: false, receiveShadow: true });
        if (brassMesh) this.scene.add(brassMesh);

        const screenTexture = this.bin.texture(new THREE.CanvasTexture(screenAtlas.canvas));
        screenTexture.colorSpace = THREE.SRGBColorSpace;
        screenTexture.anisotropy = 8;

        const screenMesh = screenBatch.build(this.bin.material(new THREE.MeshStandardMaterial({
            map: screenTexture,
            emissiveMap: screenTexture,
            emissive: 0xffffff,
            emissiveIntensity: lowEnd ? 1.5 : 1,
            roughness: 0.3,
            metalness: 0.1,
        })));
        if (screenMesh) this.scene.add(screenMesh);

        const signTexture = this.bin.texture(new THREE.CanvasTexture(signAtlas.canvas));
        signTexture.colorSpace = THREE.SRGBColorSpace;
        signTexture.anisotropy = 8;

        const signMesh = signBatch.build(this.bin.material(new THREE.MeshBasicMaterial({
            map: signTexture,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
        })));
        if (signMesh) this.scene.add(signMesh);
    }

    private addProps(
        npc: HallNpc,
        steelBatch: GeometryBatch,
        brassBatch: GeometryBatch,
        darkBatch: GeometryBatch,
        box: THREE.BufferGeometry,
        cylinder: THREE.BufferGeometry,
        rotation: number,
        at: (lx: number, ly: number, lz: number) => [number, number, number]
    ) {
        if (npc.id === "token-vendor") {
            for (let i = 0; i < 3; i++) {
                const stack = at(-3 + i * 1.5, 1.55, 1.3);
                brassBatch.addScaled(cylinder, stack[0], stack[1], stack[2], 0.38, 0.46 + i * 0.16, 0.38, rotation);
            }
            for (let i = 0; i < 10; i++) {
                const bar = at(-4.1 + i * 0.92, 3.5, 1.4);
                brassBatch.addScaled(box, bar[0], bar[1], bar[2], 0.08, 4, 0.08, rotation);
            }
            const beam = at(0, 5.5, 1.4);
            brassBatch.addScaled(box, beam[0], beam[1], beam[2], 8.8, 0.18, 0.18, rotation);
            return;
        }

        if (npc.id === "quest-giver-sola") {
            for (let i = 0; i < 3; i++) {
                const paper = at(-2.8 + i * 2.8, 1.4, 1.3);
                darkBatch.addScaled(box, paper[0], paper[1], paper[2], 1.3, 0.16, 0.9, rotation + 0.2 * (i - 1));
            }
            for (const side of [-1, 1]) {
                const post = at(side * 4, 2.7, 2.2);
                brassBatch.addScaled(cylinder, post[0], post[1], post[2], 0.13, 3, 0.13, rotation);
            }
            const rope = at(0, 4.1, 2.2);
            brassBatch.addScaled(box, rope[0], rope[1], rope[2], 8, 0.11, 0.11, rotation);
            return;
        }

        if (npc.id === "npc-alfredo") {
            for (const side of [-1, 1]) {
                const stand = at(side * 3.4, 2.1, 0.2);
                steelBatch.addScaled(cylinder, stand[0], stand[1], stand[2], 0.56, 0.18, 0.56, rotation);

                const torso = at(side * 3.4, 2.95, 0.2);
                steelBatch.addScaled(box, torso[0], torso[1], torso[2], 1.25, 1.7, 0.68, rotation);

                const pole = at(side * 3.4, 1.35, 0.2);
                brassBatch.addScaled(cylinder, pole[0], pole[1], pole[2], 0.11, 1.6, 0.11, rotation);
            }
            const mirror = at(0, 2.9, -2.24);
            brassBatch.addScaled(box, mirror[0], mirror[1], mirror[2], 2.9, 3.8, 0.12, rotation);
            return;
        }

        for (const side of [-1, 1]) {
            const pole = at(side * 4.1, 3, 1.9);
            brassBatch.addScaled(cylinder, pole[0], pole[1], pole[2], 0.12, 6, 0.12, rotation);
        }
        const table = at(0, 1.45, -0.8);
        darkBatch.addScaled(box, table[0], table[1], table[2], 4, 0.22, 2.7, rotation);
        for (const side of [-1, 1]) {
            const leg = at(side * 1.6, 0.72, -0.8);
            steelBatch.addScaled(box, leg[0], leg[1], leg[2], 0.22, 1.45, 0.22, rotation);
        }
    }
}
