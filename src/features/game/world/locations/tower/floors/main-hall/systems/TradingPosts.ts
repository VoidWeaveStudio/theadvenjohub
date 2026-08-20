// src/features/game/world/locations/tower/floors/main-hall/systems/TradingPosts.ts
import * as THREE from "three";
import { CollisionGrid } from "../../../../../CollisionGrid";
import { AssetBin } from "../utils/assetBin";
import { GeometryBatch, atlasRow } from "../utils/geometryBatch";
import { insertLocalBox } from "../utils/collision";
import { getAnisotropy } from "../utils/textureQuality";
import { createVelvetMaterial } from "../textures";
import type { ShellMaterials } from "./HallShell";
import { HALL_NPCS, HallNpc, POST_RADIUS, inwardRotation, isLowEndDevice, localToWorld } from "../layout";
import { t, onLanguageChange } from "@/core/i18n";

const SCREEN_TILE_WIDTH = 768;
const SCREEN_TILE_HEIGHT = 288;
const SIGN_TILE_WIDTH = 768;
const SIGN_TILE_HEIGHT = 192;

const POST_WIDTH = 13;
const POST_DEPTH = 8.4;
const COUNTER_FRONT = 2.2;
const CANOPY_Y = 7.4;

type Local = (lx: number, ly: number, lz: number) => [number, number, number];

interface Batches {
    steel: GeometryBatch;
    brass: GeometryBatch;
    dark: GeometryBatch;
    velvet: GeometryBatch;
}

function makeAtlas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return { canvas, ctx: canvas.getContext("2d")! };
}

function paintScreenTile(ctx: CanvasRenderingContext2D, npc: HallNpc, top: number) {
    ctx.save();
    ctx.translate(0, top);

    const backdrop = ctx.createLinearGradient(0, 0, 0, SCREEN_TILE_HEIGHT);
    backdrop.addColorStop(0, "#0c1017");
    backdrop.addColorStop(1, "#05070b");
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, SCREEN_TILE_WIDTH, SCREEN_TILE_HEIGHT);

    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
        const y = (i / 6) * SCREEN_TILE_HEIGHT;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(SCREEN_TILE_WIDTH, y);
        ctx.stroke();
    }

    ctx.fillStyle = npc.accent;
    ctx.fillRect(0, 0, SCREEN_TILE_WIDTH, 4);

    ctx.fillStyle = npc.accent;
    ctx.font = "bold 74px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(t(npc.npcName).toUpperCase(), 36, 78);

    ctx.fillStyle = "#e8edf5";
    ctx.font = "bold 34px Arial";
    ctx.fillText(t(npc.role).toUpperCase(), 38, 142);

    ctx.fillStyle = "#8b95a6";
    ctx.font = "bold 24px Arial";
    ctx.fillText(t(npc.tagline), 38, 190);

    ctx.fillStyle = npc.accent;
    ctx.fillRect(36, 224, 240, 4);

    paintScreenArt(ctx, npc);

    ctx.restore();
}

function paintScreenArt(ctx: CanvasRenderingContext2D, npc: HallNpc) {
    const cx = 570;
    const cy = 144;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = npc.accent;
    ctx.fillStyle = npc.accent;
    ctx.lineWidth = 6;

    if (npc.style === "exchange") {
        ctx.beginPath();
        ctx.arc(-60, 0, 62, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = "bold 64px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("¢", -60, 4);

        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(96, 0);
        ctx.moveTo(76, -20);
        ctx.lineTo(96, 0);
        ctx.lineTo(76, 20);
        ctx.stroke();

        ctx.font = "bold 54px Arial";
        ctx.fillText(t("g.post.ashTicker"), 168, 2);
    } else if (npc.style === "contracts") {
        ctx.strokeRect(-84, -74, 168, 148);
        ctx.lineWidth = 5;
        for (let i = 0; i < 3; i++) {
            const y = -36 + i * 36;
            ctx.beginPath();
            ctx.moveTo(-56, y);
            ctx.lineTo(-24, y + 16);
            ctx.lineTo(20, y - 22);
            ctx.stroke();
            ctx.fillRect(36, y - 4, 40, 6);
        }
        ctx.font = "bold 34px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(t("g.post.questsTop"), 104, -22);
        ctx.fillText(t("g.post.questsBottom"), 104, 22);
    } else if (npc.style === "atelier") {
        ctx.beginPath();
        ctx.arc(-30, -46, 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-30, -30);
        ctx.lineTo(-30, -12);
        ctx.moveTo(-96, 34);
        ctx.lineTo(-30, -12);
        ctx.lineTo(36, 34);
        ctx.closePath();
        ctx.stroke();

        const swatches = ["#e2666e", "#5fd39a", "#f0b95c", "#c79ae0", "#7cc4e8"];
        swatches.forEach((color, i) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(84 + i * 34, 30, 14, 0, Math.PI * 2);
            ctx.fill();
        });
    } else {
        ctx.beginPath();
        ctx.moveTo(-70, -70);
        ctx.lineTo(70, -70);
        ctx.lineTo(70, 10);
        ctx.quadraticCurveTo(70, 66, 0, 84);
        ctx.quadraticCurveTo(-70, 66, -70, 10);
        ctx.closePath();
        ctx.stroke();

        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(-70, -18);
        ctx.lineTo(70, -18);
        ctx.moveTo(0, -70);
        ctx.lineTo(0, 78);
        ctx.stroke();

        ctx.font = "bold 34px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(t("g.post.joinTop"), 104, -22);
        ctx.fillText(t("g.post.joinBottom"), 104, 22);
    }

    ctx.restore();
}

function paintSignTile(ctx: CanvasRenderingContext2D, npc: HallNpc, index: number, top: number) {
    ctx.save();
    ctx.translate(0, top);

    ctx.fillStyle = "rgba(8,11,17,0.94)";
    ctx.fillRect(0, 0, SIGN_TILE_WIDTH, SIGN_TILE_HEIGHT);

    ctx.strokeStyle = npc.accent;
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, SIGN_TILE_WIDTH - 12, SIGN_TILE_HEIGHT - 12);

    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = "#8b95a6";
    ctx.font = "bold 44px Arial";
    ctx.fillText(t("g.post.desk", { n: String(index + 1).padStart(2, "0") }), 34, 96);

    ctx.textAlign = "right";
    ctx.fillStyle = npc.accent;
    ctx.font = "bold 62px Arial";
    ctx.fillText(t(npc.role).toUpperCase(), SIGN_TILE_WIDTH - 34, 96);

    ctx.restore();
}

export class TradingPosts {
    // The plaques are painted into two atlases, so a language switch only has to
    // repaint the tiles and flag the textures — no geometry is rebuilt.
    private screenAtlas: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null;
    private signAtlas: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null;
    private screenTexture: THREE.CanvasTexture | null = null;
    private signTexture: THREE.CanvasTexture | null = null;
    private stopLanguageWatch: (() => void) | null = null;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly collisionGrid: CollisionGrid,
        private readonly bin: AssetBin
    ) { }

    create(materials: ShellMaterials) {
        const batches: Batches = {
            steel: new GeometryBatch(),
            brass: new GeometryBatch(),
            dark: new GeometryBatch(),
            velvet: new GeometryBatch(),
        };

        const screenBatch = new GeometryBatch();
        const signBatch = new GeometryBatch();

        const box = this.bin.geometry(new THREE.BoxGeometry(1, 1, 1));
        const cylinder = this.bin.geometry(new THREE.CylinderGeometry(1, 1, 1, 14));
        const disc = this.bin.geometry(new THREE.CylinderGeometry(1, 1, 1, 24).rotateX(Math.PI / 2));
        const plane = this.bin.geometry(new THREE.PlaneGeometry(1, 1));

        const screenAtlas = makeAtlas(SCREEN_TILE_WIDTH, SCREEN_TILE_HEIGHT * HALL_NPCS.length);
        const signAtlas = makeAtlas(SIGN_TILE_WIDTH, SIGN_TILE_HEIGHT * HALL_NPCS.length);
        this.screenAtlas = screenAtlas;
        this.signAtlas = signAtlas;
        const lowEnd = isLowEndDevice();

        HALL_NPCS.forEach((npc, index) => {
            const rotation = inwardRotation(npc.angle);
            const at: Local = (lx, ly, lz) => localToWorld(npc.angle, POST_RADIUS, lx, ly, lz);

            this.buildShell(batches, box, cylinder, rotation, at);
            this.buildStyle(npc, batches, box, cylinder, disc, rotation, at);

            paintScreenTile(screenAtlas.ctx, npc, index * SCREEN_TILE_HEIGHT);
            const screenAt = at(0, 4.4, -3.4);
            screenBatch.addPanel(plane, screenAt[0], screenAt[1], screenAt[2], 10.2, 3.8, rotation, atlasRow(HALL_NPCS.length, index));

            paintSignTile(signAtlas.ctx, npc, index, index * SIGN_TILE_HEIGHT);
            const signAt = at(0, CANOPY_Y + 1.6, -0.6);
            signBatch.addPanel(plane, signAt[0], signAt[1], signAt[2], 8.8, 2.2, rotation, atlasRow(HALL_NPCS.length, index));

            if (!lowEnd) {
                const light = new THREE.PointLight(npc.accentHex, 6, 30, 2);
                const lightAt = at(0, 6.2, 1.4);
                light.position.set(lightAt[0], lightAt[1], lightAt[2]);
                light.castShadow = false;
                this.scene.add(light);
            }

            this.insertPostCollision(npc.angle);
        });

        const steelMesh = batches.steel.build(materials.steel, { castShadow: true, receiveShadow: true });
        if (steelMesh) this.scene.add(steelMesh);

        const darkMesh = batches.dark.build(materials.darkTrim, { castShadow: true, receiveShadow: true });
        if (darkMesh) this.scene.add(darkMesh);

        const brassMesh = batches.brass.build(materials.brass, { castShadow: true, receiveShadow: true });
        if (brassMesh) this.scene.add(brassMesh);

        const velvetMesh = batches.velvet.build(createVelvetMaterial(this.bin), { castShadow: false, receiveShadow: true });
        if (velvetMesh) this.scene.add(velvetMesh);

        const screenTexture = this.bin.texture(new THREE.CanvasTexture(screenAtlas.canvas));
        screenTexture.colorSpace = THREE.SRGBColorSpace;
        screenTexture.anisotropy = getAnisotropy();
        this.screenTexture = screenTexture;

        const screenMesh = screenBatch.build(this.bin.material(new THREE.MeshStandardMaterial({
            map: screenTexture,
            emissiveMap: screenTexture,
            emissive: 0xffffff,
            emissiveIntensity: lowEnd ? 1.1 : 0.8,
            roughness: 0.3,
            metalness: 0.1,
        })));
        if (screenMesh) this.scene.add(screenMesh);

        const signTexture = this.bin.texture(new THREE.CanvasTexture(signAtlas.canvas));
        signTexture.colorSpace = THREE.SRGBColorSpace;
        signTexture.anisotropy = getAnisotropy();
        this.signTexture = signTexture;

        const signMesh = signBatch.build(this.bin.material(new THREE.MeshBasicMaterial({
            map: signTexture,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
        })));
        if (signMesh) this.scene.add(signMesh);

        this.stopLanguageWatch = onLanguageChange(() => this.repaintLabels());
    }

    private repaintLabels() {
        const screenAtlas = this.screenAtlas;
        const signAtlas = this.signAtlas;
        if (!screenAtlas || !signAtlas) return;

        screenAtlas.ctx.clearRect(0, 0, screenAtlas.canvas.width, screenAtlas.canvas.height);
        signAtlas.ctx.clearRect(0, 0, signAtlas.canvas.width, signAtlas.canvas.height);

        HALL_NPCS.forEach((npc, index) => {
            paintScreenTile(screenAtlas.ctx, npc, index * SCREEN_TILE_HEIGHT);
            paintSignTile(signAtlas.ctx, npc, index, index * SIGN_TILE_HEIGHT);
        });

        if (this.screenTexture) this.screenTexture.needsUpdate = true;
        if (this.signTexture) this.signTexture.needsUpdate = true;
    }

    dispose() {
        this.stopLanguageWatch?.();
        this.stopLanguageWatch = null;
        this.screenAtlas = null;
        this.signAtlas = null;
        this.screenTexture = null;
        this.signTexture = null;
    }

    private insertPostCollision(angle: number) {
        const interiorFront = COUNTER_FRONT - 1.1;
        const interiorBack = -POST_DEPTH / 2 - 0.5;
        const interiorDepth = interiorFront - interiorBack;

        insertLocalBox(
            this.collisionGrid,
            angle,
            POST_RADIUS,
            0,
            (interiorFront + interiorBack) / 2,
            POST_WIDTH + 1,
            interiorDepth,
            0,
            CANOPY_Y
        );

        insertLocalBox(
            this.collisionGrid,
            angle,
            POST_RADIUS,
            0,
            COUNTER_FRONT + 0.4,
            POST_WIDTH - 1.5,
            2.2,
            0,
            1.5
        );
    }

    private buildShell(
        batches: Batches,
        box: THREE.BufferGeometry,
        cylinder: THREE.BufferGeometry,
        rotation: number,
        at: Local
    ) {
        const plinth = at(0, 0.15, -0.6);
        batches.dark.addScaled(box, plinth[0], plinth[1], plinth[2], POST_WIDTH + 1.4, 0.3, POST_DEPTH + 1, rotation);

        const plinthTrim = at(0, 0.32, -0.6);
        batches.brass.addScaled(box, plinthTrim[0], plinthTrim[1], plinthTrim[2], POST_WIDTH + 1.6, 0.1, POST_DEPTH + 1.2, rotation);

        const backWall = at(0, 3, -3.6);
        batches.steel.addScaled(box, backWall[0], backWall[1], backWall[2], POST_WIDTH, 6, 1.2, rotation);

        const backTrim = at(0, 6.1, -3.6);
        batches.brass.addScaled(box, backTrim[0], backTrim[1], backTrim[2], POST_WIDTH + 0.4, 0.24, 1.5, rotation);

        const counter = at(0, 0.72, COUNTER_FRONT);
        batches.dark.addScaled(box, counter[0], counter[1], counter[2], POST_WIDTH - 2, 1.15, 2, rotation);

        const counterTop = at(0, 1.36, COUNTER_FRONT);
        batches.brass.addScaled(box, counterTop[0], counterTop[1], counterTop[2], POST_WIDTH - 1.5, 0.16, 2.4, rotation);

        const kick = at(0, 0.2, COUNTER_FRONT + 1.05);
        batches.brass.addScaled(box, kick[0], kick[1], kick[2], POST_WIDTH - 2, 0.28, 0.16, rotation);

        for (const side of [-1, 1]) {
            const pillar = at(side * (POST_WIDTH / 2 - 0.4), CANOPY_Y / 2, -0.6);
            batches.steel.addScaled(box, pillar[0], pillar[1], pillar[2], 0.7, CANOPY_Y, 0.7, rotation);

            const pillarTrim = at(side * (POST_WIDTH / 2 - 0.4), CANOPY_Y - 0.4, -0.6);
            batches.brass.addScaled(box, pillarTrim[0], pillarTrim[1], pillarTrim[2], 0.95, 0.2, 0.95, rotation);

            const base = at(side * (POST_WIDTH / 2 - 0.4), 0.45, -0.6);
            batches.brass.addScaled(cylinder, base[0], base[1], base[2], 0.8, 0.9, 0.8, rotation);
        }

        const canopy = at(0, CANOPY_Y + 0.25, -0.6);
        batches.steel.addScaled(box, canopy[0], canopy[1], canopy[2], POST_WIDTH + 1.2, 0.5, POST_DEPTH + 0.6, rotation);

        const canopyTrim = at(0, CANOPY_Y + 0.6, -0.6);
        batches.brass.addScaled(box, canopyTrim[0], canopyTrim[1], canopyTrim[2], POST_WIDTH + 1.7, 0.18, POST_DEPTH + 1.1, rotation);

        const valance = at(0, CANOPY_Y - 0.3, COUNTER_FRONT + 1.6);
        batches.velvet.addScaled(box, valance[0], valance[1], valance[2], POST_WIDTH + 0.6, 1.1, 0.14, rotation);
    }

    private buildStyle(
        npc: HallNpc,
        batches: Batches,
        box: THREE.BufferGeometry,
        cylinder: THREE.BufferGeometry,
        disc: THREE.BufferGeometry,
        rotation: number,
        at: Local
    ) {
        if (npc.style === "exchange") return this.buildExchange(batches, box, cylinder, disc, rotation, at);
        if (npc.style === "contracts") return this.buildContracts(batches, box, cylinder, disc, rotation, at);
        if (npc.style === "atelier") return this.buildAtelier(batches, box, cylinder, disc, rotation, at);
        return this.buildHeraldry(batches, box, cylinder, disc, rotation, at);
    }

    private buildExchange(batches: Batches, box: THREE.BufferGeometry, cylinder: THREE.BufferGeometry, disc: THREE.BufferGeometry, rotation: number, at: Local) {
        for (let i = 0; i < 14; i++) {
            const bar = at(-5.2 + i * 0.8, 3.1, COUNTER_FRONT - 0.1);
            batches.brass.addScaled(box, bar[0], bar[1], bar[2], 0.09, 3.4, 0.09, rotation);
        }

        const lintel = at(0, 4.85, COUNTER_FRONT - 0.1);
        batches.brass.addScaled(box, lintel[0], lintel[1], lintel[2], 11.2, 0.22, 0.3, rotation);

        const teller = at(0, 1.6, COUNTER_FRONT - 0.1);
        batches.dark.addScaled(box, teller[0], teller[1], teller[2], 3.4, 0.3, 0.4, rotation);

        for (let i = 0; i < 5; i++) {
            const stack = at(-4.4 + i * 2.1, 1.72, COUNTER_FRONT + 0.4);
            batches.brass.addScaled(cylinder, stack[0], stack[1], stack[2], 0.19, 0.5 + (i % 3) * 0.2, 0.19, rotation);
        }

        const vault = at(0, 2.5, -2.85);
        batches.steel.addScaled(disc, vault[0], vault[1], vault[2], 1.9, 1.9, 0.34, rotation);
        batches.brass.addScaled(disc, vault[0], vault[1], vault[2], 2.1, 2.1, 0.18, rotation);
        batches.brass.addScaled(disc, vault[0], vault[1], vault[2], 0.42, 0.42, 0.62, rotation);

        for (let i = 0; i < 8; i++) {
            const spokeAngle = (i / 8) * Math.PI * 2;
            const spoke = at(Math.cos(spokeAngle) * 0.95, 2.5 + Math.sin(spokeAngle) * 0.95, -2.6);
            batches.brass.addScaled(box, spoke[0], spoke[1], spoke[2], 0.34, 0.34, 0.2, rotation);
        }

        const scaleBeam = at(4.6, 2.6, COUNTER_FRONT + 0.3);
        batches.brass.addScaled(box, scaleBeam[0], scaleBeam[1], scaleBeam[2], 2.4, 0.1, 0.1, rotation);
        const scalePost = at(4.6, 2, COUNTER_FRONT + 0.3);
        batches.brass.addScaled(cylinder, scalePost[0], scalePost[1], scalePost[2], 0.1, 1.3, 0.1, rotation);
        for (const side of [-1, 1]) {
            const pan = at(4.6 + side * 1.1, 2.3, COUNTER_FRONT + 0.3);
            batches.brass.addScaled(cylinder, pan[0], pan[1], pan[2], 0.55, 0.1, 0.55, rotation);
        }
    }

    private buildContracts(batches: Batches, box: THREE.BufferGeometry, cylinder: THREE.BufferGeometry, disc: THREE.BufferGeometry, rotation: number, at: Local) {
        const desk = at(0, 1.5, COUNTER_FRONT + 0.1);
        batches.dark.addScaled(box, desk[0], desk[1], desk[2], 5.2, 0.14, 1.5, rotation);

        for (let i = 0; i < 5; i++) {
            const paper = at(-4.4 + i * 2.2, 1.55, COUNTER_FRONT + 0.2);
            batches.velvet.addScaled(box, paper[0], paper[1], paper[2], 1.5, 0.2, 1.05, rotation + 0.16 * (i - 2));
        }

        const seal = at(3.6, 1.62, COUNTER_FRONT + 0.2);
        batches.brass.addScaled(cylinder, seal[0], seal[1], seal[2], 0.4, 0.28, 0.4, rotation);
        const sealHandle = at(3.6, 2.1, COUNTER_FRONT + 0.2);
        batches.brass.addScaled(cylinder, sealHandle[0], sealHandle[1], sealHandle[2], 0.12, 0.9, 0.12, rotation);

        const boardBack = at(0, 4, -2.9);
        batches.velvet.addScaled(box, boardBack[0], boardBack[1], boardBack[2], 9.6, 3.4, 0.14, rotation);

        for (let i = 0; i < 9; i++) {
            const row = Math.floor(i / 3);
            const col = i % 3;
            const note = at(-3 + col * 3, 5 - row * 1.2, -2.8);
            batches.dark.addScaled(box, note[0], note[1], note[2], 1.9, 0.9, 0.06, rotation + (i % 2 === 0 ? 0.06 : -0.05));
            const pin = at(-3 + col * 3, 5.4 - row * 1.2, -2.72);
            batches.brass.addScaled(disc, pin[0], pin[1], pin[2], 0.08, 0.08, 0.18, rotation);
        }

        for (const side of [-1, 1]) {
            const post = at(side * 5.2, 2.4, COUNTER_FRONT + 1.4);
            batches.brass.addScaled(cylinder, post[0], post[1], post[2], 0.13, 3.2, 0.13, rotation);
            const lamp = at(side * 5.2, 4.1, COUNTER_FRONT + 1.4);
            batches.brass.addScaled(cylinder, lamp[0], lamp[1], lamp[2], 0.5, 0.6, 0.5, rotation);
        }

        const rope = at(0, 3.9, COUNTER_FRONT + 1.4);
        batches.brass.addScaled(box, rope[0], rope[1], rope[2], 10.4, 0.1, 0.1, rotation);
    }

    private buildAtelier(batches: Batches, box: THREE.BufferGeometry, cylinder: THREE.BufferGeometry, disc: THREE.BufferGeometry, rotation: number, at: Local) {
        for (const side of [-1, 1]) {
            const mirrorFrame = at(side * 4.2, 3.4, -3.3);
            batches.brass.addScaled(box, mirrorFrame[0], mirrorFrame[1], mirrorFrame[2], 3.3, 5, 0.22, rotation);

            const glass = at(side * 4.2, 3.4, -3.15);
            batches.steel.addScaled(box, glass[0], glass[1], glass[2], 2.9, 4.6, 0.08, rotation);

            const stand = at(side * 2.4, 0.55, COUNTER_FRONT - 1);
            batches.brass.addScaled(cylinder, stand[0], stand[1], stand[2], 0.45, 0.22, 0.45, rotation);

            const pole = at(side * 2.4, 1.2, COUNTER_FRONT - 1);
            batches.brass.addScaled(cylinder, pole[0], pole[1], pole[2], 0.14, 1.3, 0.14, rotation);

            const torso = at(side * 2.4, 2.55, COUNTER_FRONT - 1);
            batches.velvet.addScaled(box, torso[0], torso[1], torso[2], 1.35, 1.9, 0.78, rotation);

            const shoulder = at(side * 2.4, 3.4, COUNTER_FRONT - 1);
            batches.velvet.addScaled(cylinder, shoulder[0], shoulder[1], shoulder[2], 0.3, 0.42, 0.3, rotation);
        }

        const railBar = at(0, 4.6, -1.4);
        batches.brass.addScaled(box, railBar[0], railBar[1], railBar[2], 7.6, 0.12, 0.12, rotation);

        for (let i = 0; i < 7; i++) {
            const hangerX = -3 + i;
            const hook = at(hangerX, 4.35, -1.4);
            batches.brass.addScaled(cylinder, hook[0], hook[1], hook[2], 0.06, 0.55, 0.06, rotation);

            const cloth = at(hangerX, 3.3, -1.4);
            batches.velvet.addScaled(box, cloth[0], cloth[1], cloth[2], 0.85, 1.7, 0.3, rotation);
        }

        for (let i = 0; i < 4; i++) {
            const bolt = at(-5.2 + i * 0.7, 1.9, COUNTER_FRONT + 0.1);
            batches.velvet.addScaled(cylinder, bolt[0], bolt[1], bolt[2], 0.16, 1.1, 0.16, rotation);
        }

        const palette = at(4.4, 1.55, COUNTER_FRONT + 0.2);
        batches.dark.addScaled(cylinder, palette[0], palette[1], palette[2], 0.42, 0.1, 0.42, rotation);
    }

    private buildHeraldry(batches: Batches, box: THREE.BufferGeometry, cylinder: THREE.BufferGeometry, disc: THREE.BufferGeometry, rotation: number, at: Local) {
        const tableX = -4.3;
        const tableZ = -1.7;

        const table = at(tableX, 1.45, tableZ);
        batches.dark.addScaled(cylinder, table[0], table[1], table[2], 1.05, 0.22, 1.05, rotation);
        const tableTop = at(tableX, 1.57, tableZ);
        batches.brass.addScaled(cylinder, tableTop[0], tableTop[1], tableTop[2], 1.12, 0.06, 1.12, rotation);
        const stem = at(tableX, 0.72, tableZ);
        batches.dark.addScaled(cylinder, stem[0], stem[1], stem[2], 0.26, 1.5, 0.26, rotation);
        const tableFoot = at(tableX, 0.12, tableZ);
        batches.brass.addScaled(cylinder, tableFoot[0], tableFoot[1], tableFoot[2], 0.62, 0.24, 0.62, rotation);

        for (let i = 0; i < 4; i++) {
            const seatAngle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const seat = at(tableX + Math.cos(seatAngle) * 2.2, 0.5, tableZ + Math.sin(seatAngle) * 1.6);
            batches.velvet.addScaled(cylinder, seat[0], seat[1], seat[2], 0.3, 1, 0.3, rotation);
        }

        for (const side of [-1, 1]) {
            const brazier = at(side * 5.4, 1.4, COUNTER_FRONT - 0.4);
            batches.brass.addScaled(cylinder, brazier[0], brazier[1], brazier[2], 0.46, 0.7, 0.46, rotation);
            const stem = at(side * 5.4, 0.6, COUNTER_FRONT - 0.4);
            batches.brass.addScaled(cylinder, stem[0], stem[1], stem[2], 0.24, 1.2, 0.24, rotation);
            const foot = at(side * 5.4, 0.12, COUNTER_FRONT - 0.4);
            batches.dark.addScaled(cylinder, foot[0], foot[1], foot[2], 0.5, 0.24, 0.5, rotation);
        }

        for (let i = 0; i < 5; i++) {
            const drape = at(-4.6 + i * 2.3, 4.3, -2.94);
            batches.velvet.addScaled(box, drape[0], drape[1], drape[2], 1.8, 3.6, 0.1, rotation);
            const crest = at(-4.6 + i * 2.3, 5.6, -2.86);
            batches.brass.addScaled(disc, crest[0], crest[1], crest[2], 0.52, 0.52, 0.14, rotation);
        }

        const registry = at(0, 1.68, COUNTER_FRONT + 0.2);
        batches.dark.addScaled(box, registry[0], registry[1], registry[2], 2.4, 0.5, 1.6, rotation + 0.12);
        const clasp = at(0, 1.95, COUNTER_FRONT + 0.2);
        batches.brass.addScaled(box, clasp[0], clasp[1], clasp[2], 0.4, 0.1, 1.7, rotation + 0.12);
    }
}
