// src/features/game/world/locations/tower/floors/main-hall/systems/BoardSystem.ts
import * as THREE from "three";
import { CollisionGrid } from "../../../../../CollisionGrid";
import type { LeaderboardEntry, FactionSummary } from "../../../../../../network/NetworkManager";
import { AssetBin } from "../utils/assetBin";
import { GeometryBatch, atlasColumn, atlasRow } from "../utils/geometryBatch";
import type { ShellMaterials } from "./HallShell";
import {
    BANNER_HEIGHT,
    BANNER_WIDTH,
    BOARD_HEIGHT,
    BOARD_WIDTH,
    drawBanner,
    drawFactionBoard,
    drawNoticeBoard,
    drawPlayerBoard,
} from "../utils/boards";
import {
    BANNER_RADIUS,
    BOARD_BOTTOM,
    BOARD_HEIGHT_UNITS,
    BOARD_RADIUS,
    BOARD_WIDTH_UNITS,
    NORTH,
    NOTICE_RADIUS,
    PEDESTAL_RADIUS,
    SOUTH,
    WEST,
    factionColor,
    inwardRotation,
    localToWorld,
} from "../layout";

const PLATE_WIDTH = 512;
const PLATE_HEIGHT = 128;
const TROPHY_COLORS = [0xffd479, 0xdfe4ec, 0xd09a63];
const TROPHY_HEIGHTS = [2.6, 2.2, 2];
const BANNER_SIZES: [number, number][] = [[4.4, 7.6], [3.6, 6.4], [3.6, 6.4]];
const BANNER_CENTERS = [19.2, 18.8, 18.8];
const BANNER_SPREAD = [0, -0.12, 0.12];
const PEDESTAL_SPREAD = [0, -0.22, 0.22];

function makeCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return { canvas, ctx: canvas.getContext("2d")! };
}

function drawNameplate(ctx: CanvasRenderingContext2D, rank: number, name: string, score: string) {
    ctx.fillStyle = "#0d1016";
    ctx.fillRect(0, 0, PLATE_WIDTH, PLATE_HEIGHT);

    const accent = ["#ffd479", "#dfe4ec", "#d09a63"][rank - 1] ?? "#8b95a6";
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.strokeRect(3, 3, PLATE_WIDTH - 6, PLATE_HEIGHT - 6);

    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillStyle = accent;
    ctx.font = "bold 42px Arial";
    ctx.fillText(name, PLATE_WIDTH / 2, 48);

    ctx.fillStyle = "#8b95a6";
    ctx.font = "bold 30px Arial";
    ctx.fillText(score, PLATE_WIDTH / 2, 94);
}

function entryName(entry: LeaderboardEntry): string {
    if (entry.nickname && entry.nickname.trim().length > 0) return entry.nickname.slice(0, 16);
    return entry.wallet.slice(0, 4) + "…" + entry.wallet.slice(-4);
}

export class BoardSystem {
    private boardAtlas!: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D };
    private boardTexture!: THREE.CanvasTexture;
    private bannerAtlas!: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D };
    private bannerTexture!: THREE.CanvasTexture;
    private plateAtlas!: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D };
    private plateTexture!: THREE.CanvasTexture;

    private trophies: THREE.Mesh[] = [];
    private players: LeaderboardEntry[] = [];
    private factions: FactionSummary[] = [];

    constructor(
        private readonly scene: THREE.Scene,
        private readonly collisionGrid: CollisionGrid,
        private readonly bin: AssetBin
    ) { }

    create(materials: ShellMaterials) {
        const frameBatch = new GeometryBatch();
        const brassBatch = new GeometryBatch();
        const panelBatch = new GeometryBatch();
        const bannerBatch = new GeometryBatch();
        const plateBatch = new GeometryBatch();

        this.boardAtlas = makeCanvas(BOARD_WIDTH, BOARD_HEIGHT * 3);
        this.bannerAtlas = makeCanvas(BANNER_WIDTH * 3, BANNER_HEIGHT);
        this.plateAtlas = makeCanvas(PLATE_WIDTH, PLATE_HEIGHT * 3);

        this.boardTexture = this.registerTexture(this.boardAtlas.canvas);
        this.bannerTexture = this.registerTexture(this.bannerAtlas.canvas);
        this.plateTexture = this.registerTexture(this.plateAtlas.canvas);

        const plane = this.bin.geometry(new THREE.PlaneGeometry(1, 1));

        this.buildBigBoard(NORTH, 0, plane, panelBatch, frameBatch, brassBatch);
        this.buildBigBoard(SOUTH, 1, plane, panelBatch, frameBatch, brassBatch);
        this.buildNotice(plane, panelBatch, frameBatch, brassBatch);
        this.buildBanners(plane, bannerBatch);
        this.buildPedestals(plane, plateBatch, frameBatch, brassBatch);

        const frame = frameBatch.build(materials.darkTrim, { castShadow: true, receiveShadow: true });
        if (frame) this.scene.add(frame);

        const brass = brassBatch.build(materials.brass, { castShadow: false, receiveShadow: true });
        if (brass) this.scene.add(brass);

        const panels = panelBatch.build(this.bin.material(new THREE.MeshStandardMaterial({
            map: this.boardTexture,
            emissiveMap: this.boardTexture,
            emissive: 0xffffff,
            emissiveIntensity: 1.05,
            roughness: 0.28,
            metalness: 0.05,
        })));
        if (panels) this.scene.add(panels);

        const banners = bannerBatch.build(this.bin.material(new THREE.MeshBasicMaterial({
            map: this.bannerTexture,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
        })));
        if (banners) this.scene.add(banners);

        const plates = plateBatch.build(this.bin.material(new THREE.MeshBasicMaterial({
            map: this.plateTexture,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
        })));
        if (plates) this.scene.add(plates);

        this.paintBoards();
        this.paintBanners();
        this.paintPlates();
    }

    private registerTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
        const texture = this.bin.texture(new THREE.CanvasTexture(canvas));
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        return texture;
    }

    private buildBigBoard(
        angle: number,
        atlasIndex: number,
        plane: THREE.BufferGeometry,
        panelBatch: GeometryBatch,
        frameBatch: GeometryBatch,
        brassBatch: GeometryBatch
    ) {
        const rotation = inwardRotation(angle);
        const at = (lx: number, ly: number, lz: number) => localToWorld(angle, BOARD_RADIUS, lx, ly, lz);
        const box = this.bin.geometry(new THREE.BoxGeometry(1, 1, 1));
        const centerY = BOARD_BOTTOM + BOARD_HEIGHT_UNITS / 2;

        const backing = at(0, centerY, -0.4);
        frameBatch.addScaled(box, backing[0], backing[1], backing[2], BOARD_WIDTH_UNITS + 1.8, BOARD_HEIGHT_UNITS + 1.6, 0.8, rotation);

        for (const offset of [-1, 1]) {
            const trimY = centerY + offset * (BOARD_HEIGHT_UNITS / 2 + 0.95);
            const trim = at(0, trimY, -0.1);
            brassBatch.addScaled(box, trim[0], trim[1], trim[2], BOARD_WIDTH_UNITS + 2.4, 0.34, 1.1, rotation);

            const legX = offset * (BOARD_WIDTH_UNITS / 2 - 1.4);
            const leg = at(legX, BOARD_BOTTOM / 2, -0.4);
            frameBatch.addScaled(box, leg[0], leg[1], leg[2], 1.3, BOARD_BOTTOM, 1.3, rotation);

            const foot = at(legX, 0.3, -0.4);
            brassBatch.addScaled(box, foot[0], foot[1], foot[2], 2.2, 0.6, 2.2, rotation);

            this.collisionGrid.insert(new THREE.Box3(
                new THREE.Vector3(foot[0] - 1.2, 0, foot[2] - 1.2),
                new THREE.Vector3(foot[0] + 1.2, BOARD_BOTTOM, foot[2] + 1.2)
            ));
        }

        const panelAt = at(0, centerY, 0.02);
        panelBatch.addPanel(plane, panelAt[0], panelAt[1], panelAt[2], BOARD_WIDTH_UNITS, BOARD_HEIGHT_UNITS, rotation, atlasRow(3, atlasIndex));
    }

    private buildNotice(
        plane: THREE.BufferGeometry,
        panelBatch: GeometryBatch,
        frameBatch: GeometryBatch,
        brassBatch: GeometryBatch
    ) {
        const rotation = inwardRotation(WEST);
        const at = (lx: number, ly: number, lz: number) => localToWorld(WEST, NOTICE_RADIUS, lx, ly, lz);
        const box = this.bin.geometry(new THREE.BoxGeometry(1, 1, 1));

        const width = 18;
        const height = 6.19;
        const centerY = 5.6;

        const backing = at(0, centerY, -0.35);
        frameBatch.addScaled(box, backing[0], backing[1], backing[2], width + 1.2, height + 1.2, 0.7, rotation);

        const post = at(0, 1.25, -0.35);
        frameBatch.addScaled(box, post[0], post[1], post[2], 1.4, 2.5, 1.4, rotation);

        const foot = at(0, 0.3, -0.35);
        brassBatch.addScaled(box, foot[0], foot[1], foot[2], 3.6, 0.6, 2.6, rotation);

        const panelAt = at(0, centerY, 0.02);
        panelBatch.addPanel(plane, panelAt[0], panelAt[1], panelAt[2], width, height, rotation, atlasRow(3, 2));

        this.collisionGrid.insert(new THREE.Box3(
            new THREE.Vector3(foot[0] - 1.9, 0, foot[2] - 1.9),
            new THREE.Vector3(foot[0] + 1.9, 2.8, foot[2] + 1.9)
        ));
    }

    private buildBanners(plane: THREE.BufferGeometry, bannerBatch: GeometryBatch) {
        for (let i = 0; i < 3; i++) {
            const angle = SOUTH + BANNER_SPREAD[i];
            const [width, height] = BANNER_SIZES[i];
            const at = localToWorld(angle, BANNER_RADIUS, 0, BANNER_CENTERS[i], 0);
            bannerBatch.addPanel(plane, at[0], at[1], at[2], width, height, inwardRotation(angle), atlasColumn(3, i));
        }
    }

    private buildPedestals(
        plane: THREE.BufferGeometry,
        plateBatch: GeometryBatch,
        frameBatch: GeometryBatch,
        brassBatch: GeometryBatch
    ) {
        const cylinder = this.bin.geometry(new THREE.CylinderGeometry(1, 1, 1, 20));
        const coinGeometry = this.bin.geometry(new THREE.CylinderGeometry(0.95, 0.95, 0.18, 24));
        coinGeometry.rotateX(Math.PI / 2);

        for (let i = 0; i < 3; i++) {
            const angle = NORTH + PEDESTAL_SPREAD[i];
            const rotation = inwardRotation(angle);
            const height = TROPHY_HEIGHTS[i];
            const at = (lx: number, ly: number, lz: number) => localToWorld(angle, PEDESTAL_RADIUS, lx, ly, lz);

            const body = at(0, height / 2, 0);
            frameBatch.addScaled(cylinder, body[0], body[1], body[2], 1.7, height, 1.7, rotation);

            const cap = at(0, height + 0.1, 0);
            brassBatch.addScaled(cylinder, cap[0], cap[1], cap[2], 2, 0.2, 2, rotation);

            const base = at(0, 0.14, 0);
            brassBatch.addScaled(cylinder, base[0], base[1], base[2], 2.2, 0.28, 2.2, rotation);

            const coin = new THREE.Mesh(coinGeometry, this.bin.material(new THREE.MeshStandardMaterial({
                color: TROPHY_COLORS[i],
                emissive: TROPHY_COLORS[i],
                emissiveIntensity: 0.35,
                roughness: 0.22,
                metalness: 0.95,
            })));
            const coinAt = at(0, height + 1.3, 0);
            coin.position.set(coinAt[0], coinAt[1], coinAt[2]);
            coin.castShadow = true;
            this.scene.add(coin);
            this.trophies.push(coin);

            const plateAt = at(0, height * 0.62, 0.89);
            plateBatch.addPanel(plane, plateAt[0], plateAt[1], plateAt[2], 2.8, 0.7, rotation, atlasRow(3, i));

            this.collisionGrid.insert(new THREE.Box3(
                new THREE.Vector3(body[0] - 1, 0, body[2] - 1),
                new THREE.Vector3(body[0] + 1, height + 0.4, body[2] + 1)
            ));
        }
    }

    private paintBoards() {
        const ctx = this.boardAtlas.ctx;

        ctx.save();
        drawPlayerBoard(ctx, this.players);
        ctx.restore();

        ctx.save();
        ctx.translate(0, BOARD_HEIGHT);
        drawFactionBoard(ctx, this.factions);
        ctx.restore();

        ctx.save();
        ctx.translate(0, BOARD_HEIGHT * 2);
        drawNoticeBoard(ctx);
        ctx.restore();

        this.boardTexture.needsUpdate = true;
    }

    private paintBanners() {
        const ctx = this.bannerAtlas.ctx;

        for (let i = 0; i < 3; i++) {
            const faction = this.factions[i] ?? null;
            const color = faction
                ? "#" + factionColor(faction.number).toString(16).padStart(6, "0")
                : "#3a4354";

            ctx.save();
            ctx.translate(BANNER_WIDTH * i, 0);
            drawBanner(ctx, faction, i + 1, color);
            ctx.restore();
        }

        this.bannerTexture.needsUpdate = true;
    }

    private paintPlates() {
        const ctx = this.plateAtlas.ctx;

        for (let i = 0; i < 3; i++) {
            const entry = this.players[i];
            ctx.save();
            ctx.translate(0, PLATE_HEIGHT * i);
            if (entry) {
                drawNameplate(ctx, i + 1, entryName(entry), "score " + Math.round(entry.score));
            } else {
                drawNameplate(ctx, i + 1, "—", "awaiting data");
            }
            ctx.restore();
        }

        this.plateTexture.needsUpdate = true;
    }

    setPlayers(entries: LeaderboardEntry[]) {
        this.players = entries;
        if (!this.boardTexture) return;
        this.paintBoards();
        this.paintPlates();
    }

    setFactions(list: FactionSummary[]) {
        this.factions = list;
        if (!this.boardTexture) return;
        this.paintBoards();
        this.paintBanners();
    }

    update(delta: number) {
        for (const trophy of this.trophies) {
            trophy.rotation.y += delta * 0.6;
        }
    }

    dispose() {
        this.trophies = [];
    }
}
