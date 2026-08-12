// src/features/game/world/locations/tower/floors/main-hall/systems/BoardSystem.ts
import * as THREE from "three";
import { CollisionGrid } from "../../../../../CollisionGrid";
import type { LeaderboardEntry, FactionSummary, FactionQuestEntry } from "../../../../../../network/NetworkManager";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { tokenTextureCache } from "../../../../../../utils/TokenTextureCache";
import { AssetBin } from "../utils/assetBin";
import { LoadGate } from "../../../../../../utils/loadGate";
import { GeometryBatch, atlasColumn, atlasRow } from "../utils/geometryBatch";
import { insertLocalBox } from "../utils/collision";
import { factionImageUrl, loadFactionImage } from "../utils/factionImages";
import { getAnisotropy } from "../utils/textureQuality";
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
    drawQuestBoard,
    hexColor,
} from "../utils/boards";
import {
    BANNER_BOTTOM,
    BANNER_RADIUS,
    BOARD_BOTTOM,
    BOARD_HEIGHT_UNITS,
    BOARD_RADIUS,
    BOARD_WIDTH_UNITS,
    NORTH,
    NOTICE_ANGLES,
    NOTICE_RADIUS,
    PEDESTAL_RADIUS,
    SOUTH,
    factionColor,
    inwardRotation,
    isLowEndDevice,
    localToWorld,
} from "../layout";

const PLATE_WIDTH = 768;
const PLATE_HEIGHT = 192;
const RANK_COLORS = [0xffd479, 0xdfe4ec, 0xd09a63];
const PEDESTAL_HEIGHTS = [4.2, 3.5, 3.5];
const PEDESTAL_SPREAD = [0, -0.26, 0.26];
const BANNER_SIZES: [number, number][] = [[5.2, 10.4], [4.4, 8.8], [4.4, 8.8]];
const BANNER_SPREAD = [0, -0.15, 0.15];
const NOTICE_WIDTH_UNITS = 22;
const NOTICE_HEIGHT_UNITS = 7.33;

interface Pedestal {
    coin: THREE.Mesh;
    faceMaterial: THREE.MeshStandardMaterial;
    halo: THREE.Mesh;
    baseY: number;
    phase: number;
}

function makeCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return { canvas, ctx: canvas.getContext("2d")! };
}

function drawFactionPlate(ctx: CanvasRenderingContext2D, rank: number, name: string, detail: string, accent: string) {
    ctx.clearRect(0, 0, PLATE_WIDTH, PLATE_HEIGHT);

    ctx.fillStyle = "rgba(8,11,17,0.94)";
    ctx.fillRect(0, 0, PLATE_WIDTH, PLATE_HEIGHT);

    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    ctx.strokeRect(4, 4, PLATE_WIDTH - 8, PLATE_HEIGHT - 8);

    ctx.fillStyle = accent;
    ctx.fillRect(4, 4, 12, PLATE_HEIGHT - 8);

    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = accent;
    ctx.font = "bold 46px Arial";
    ctx.fillText("#" + rank, 40, PLATE_HEIGHT / 2);

    ctx.fillStyle = "#e8edf5";
    ctx.font = "bold 54px Arial";
    ctx.fillText(name, 150, 74);

    ctx.fillStyle = "#8b95a6";
    ctx.font = "bold 32px Arial";
    ctx.fillText(detail, 152, 132);
}

export class BoardSystem {
    private boardAtlas!: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D };
    private boardTexture!: THREE.CanvasTexture;
    private bannerAtlas!: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D };
    private bannerTexture!: THREE.CanvasTexture;
    private plateAtlas!: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D };
    private plateTexture!: THREE.CanvasTexture;

    private pedestals: Pedestal[] = [];
    private players: LeaderboardEntry[] = [];
    private factions: FactionSummary[] = [];
    private quests: FactionQuestEntry[] = [];
    private time = 0;

    private readonly dataGate = new LoadGate();
    private readonly received = { players: false, factions: false, quests: false };

    constructor(
        private readonly scene: THREE.Scene,
        private readonly collisionGrid: CollisionGrid,
        private readonly bin: AssetBin
    ) { }

    create(materials: ShellMaterials) {
        if (!isLowEndDevice()) RectAreaLightUniformsLib.init();

        const frameBatch = new GeometryBatch();
        const brassBatch = new GeometryBatch();
        const panelBatch = new GeometryBatch();
        const bannerBatch = new GeometryBatch();
        const plateBatch = new GeometryBatch();

        this.boardAtlas = makeCanvas(BOARD_WIDTH, BOARD_HEIGHT * 4);
        this.bannerAtlas = makeCanvas(BANNER_WIDTH * 3, BANNER_HEIGHT);
        this.plateAtlas = makeCanvas(PLATE_WIDTH, PLATE_HEIGHT * 3);

        this.boardTexture = this.registerTexture(this.boardAtlas.canvas);
        this.bannerTexture = this.registerTexture(this.bannerAtlas.canvas);
        this.plateTexture = this.registerTexture(this.plateAtlas.canvas);

        const plane = this.bin.geometry(new THREE.PlaneGeometry(1, 1));

        this.buildBigBoard(NORTH, 0, plane, panelBatch, frameBatch, brassBatch);
        this.buildBigBoard(SOUTH, 1, plane, panelBatch, frameBatch, brassBatch);
        this.buildSideBoard(NOTICE_ANGLES[0], 2, plane, panelBatch, frameBatch, brassBatch);
        this.buildSideBoard(NOTICE_ANGLES[1], 3, plane, panelBatch, frameBatch, brassBatch);
        this.buildBanners(plane, bannerBatch, brassBatch, frameBatch);
        this.buildPedestals(plane, plateBatch, frameBatch, brassBatch);

        const frame = frameBatch.build(materials.darkTrim, { castShadow: true, receiveShadow: true });
        if (frame) this.scene.add(frame);

        const brass = brassBatch.build(materials.brass, { castShadow: true, receiveShadow: true });
        if (brass) this.scene.add(brass);

        const panels = panelBatch.build(this.bin.material(new THREE.MeshStandardMaterial({
            map: this.boardTexture,
            emissiveMap: this.boardTexture,
            emissive: 0xffffff,
            emissiveIntensity: 0.75,
            roughness: 0.26,
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
        texture.anisotropy = getAnisotropy();
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

        const backing = at(0, centerY, -0.5);
        frameBatch.addScaled(box, backing[0], backing[1], backing[2], BOARD_WIDTH_UNITS + 2.2, BOARD_HEIGHT_UNITS + 2, 1, rotation);

        for (const offset of [-1, 1]) {
            const trimY = centerY + offset * (BOARD_HEIGHT_UNITS / 2 + 1.1);
            const trim = at(0, trimY, -0.15);
            brassBatch.addScaled(box, trim[0], trim[1], trim[2], BOARD_WIDTH_UNITS + 3, 0.4, 1.4, rotation);

            const legX = offset * (BOARD_WIDTH_UNITS / 2 - 1.8);
            const leg = at(legX, BOARD_BOTTOM / 2, -0.5);
            frameBatch.addScaled(box, leg[0], leg[1], leg[2], 1.6, BOARD_BOTTOM, 1.6, rotation);

            for (let i = 0; i < 4; i++) {
                const braceY = 1.6 + i * 2.1;
                const brace = at(legX, braceY, -0.5);
                brassBatch.addScaled(box, brace[0], brace[1], brace[2], 2.1, 0.12, 2.1, rotation);
            }

            const foot = at(legX, 0.35, -0.5);
            brassBatch.addScaled(box, foot[0], foot[1], foot[2], 2.8, 0.7, 2.8, rotation);

            insertLocalBox(
                this.collisionGrid,
                angle,
                BOARD_RADIUS,
                legX,
                -0.5,
                2.8,
                2.8,
                0,
                BOARD_BOTTOM
            );
        }

        const panelAt = at(0, centerY, 0.05);
        panelBatch.addPanel(plane, panelAt[0], panelAt[1], panelAt[2], BOARD_WIDTH_UNITS, BOARD_HEIGHT_UNITS, rotation, atlasRow(4, atlasIndex));

        if (isLowEndDevice()) return;

        const wash = new THREE.RectAreaLight(
            atlasIndex === 0 ? 0xf5c877 : 0xc9a6e6,
            1.1,
            BOARD_WIDTH_UNITS * 0.9,
            BOARD_HEIGHT_UNITS * 0.9
        );
        const washAt = at(0, centerY, 0.6);
        wash.position.set(washAt[0], washAt[1], washAt[2]);
        wash.lookAt(0, centerY, 0);
        this.scene.add(wash);
    }

    private buildSideBoard(
        angle: number,
        atlasIndex: number,
        plane: THREE.BufferGeometry,
        panelBatch: GeometryBatch,
        frameBatch: GeometryBatch,
        brassBatch: GeometryBatch
    ) {
        const rotation = inwardRotation(angle);
        const at = (lx: number, ly: number, lz: number) => localToWorld(angle, NOTICE_RADIUS, lx, ly, lz);
        const box = this.bin.geometry(new THREE.BoxGeometry(1, 1, 1));
        const centerY = 7.4;

        const backing = at(0, centerY, -0.4);
        frameBatch.addScaled(box, backing[0], backing[1], backing[2], NOTICE_WIDTH_UNITS + 1.4, NOTICE_HEIGHT_UNITS + 1.4, 0.8, rotation);

        for (const offset of [-1, 1]) {
            const legX = offset * (NOTICE_WIDTH_UNITS / 2 - 1.2);
            const leg = at(legX, 1.85, -0.4);
            frameBatch.addScaled(box, leg[0], leg[1], leg[2], 1.1, 3.7, 1.1, rotation);

            const foot = at(legX, 0.3, -0.4);
            brassBatch.addScaled(box, foot[0], foot[1], foot[2], 2.2, 0.6, 2, rotation);

            insertLocalBox(this.collisionGrid, angle, NOTICE_RADIUS, legX, -0.4, 2.2, 2, 0, 3.7);
        }

        const cap = at(0, centerY + NOTICE_HEIGHT_UNITS / 2 + 0.9, -0.2);
        brassBatch.addScaled(box, cap[0], cap[1], cap[2], NOTICE_WIDTH_UNITS + 2, 0.3, 1.2, rotation);

        const panelAt = at(0, centerY, 0.05);
        panelBatch.addPanel(plane, panelAt[0], panelAt[1], panelAt[2], NOTICE_WIDTH_UNITS, NOTICE_HEIGHT_UNITS, rotation, atlasRow(4, atlasIndex));
    }

    private buildBanners(
        plane: THREE.BufferGeometry,
        bannerBatch: GeometryBatch,
        brassBatch: GeometryBatch,
        frameBatch: GeometryBatch
    ) {
        const box = this.bin.geometry(new THREE.BoxGeometry(1, 1, 1));
        const knobGeometry = this.bin.geometry(new THREE.SphereGeometry(0.3, 10, 8));
        const rotation = inwardRotation(SOUTH);
        const mastTop = BANNER_BOTTOM + Math.max(...BANNER_SIZES.map(([, h]) => h)) + 2.4;
        const mastHalf = BOARD_WIDTH_UNITS / 2 - 1;

        for (const side of [-1, 1]) {
            const mast = localToWorld(SOUTH, BANNER_RADIUS, side * mastHalf, mastTop / 2, 0);
            frameBatch.addScaled(box, mast[0], mast[1], mast[2], 0.9, mastTop, 0.9, rotation);

            const foot = localToWorld(SOUTH, BANNER_RADIUS, side * mastHalf, 0.35, 0);
            brassBatch.addScaled(box, foot[0], foot[1], foot[2], 1.8, 0.7, 1.8, rotation);

            const collar = localToWorld(SOUTH, BANNER_RADIUS, side * mastHalf, mastTop, 0);
            brassBatch.addScaled(box, collar[0], collar[1], collar[2], 1.3, 0.3, 1.3, rotation);

            insertLocalBox(this.collisionGrid, SOUTH, BANNER_RADIUS, side * mastHalf, 0, 1.8, 1.8, 0, 3);
        }

        const beam = localToWorld(SOUTH, BANNER_RADIUS, 0, mastTop - 0.6, 0);
        brassBatch.addScaled(box, beam[0], beam[1], beam[2], mastHalf * 2 + 1.3, 0.34, 0.34, rotation);

        for (let i = 0; i < 3; i++) {
            const angle = SOUTH + BANNER_SPREAD[i];
            const [width, height] = BANNER_SIZES[i];
            const topY = BANNER_BOTTOM + height;
            const centerY = BANNER_BOTTOM + height / 2;
            const at = localToWorld(angle, BANNER_RADIUS, 0, centerY, 0);

            bannerBatch.addPanel(plane, at[0], at[1], at[2], width, height, inwardRotation(angle), atlasColumn(3, i));

            const rodAt = localToWorld(angle, BANNER_RADIUS, 0, topY + 0.3, 0);
            brassBatch.addScaled(box, rodAt[0], rodAt[1], rodAt[2], width + 1.4, 0.26, 0.26, inwardRotation(angle));

            for (const side of [-1, 1]) {
                const knob = localToWorld(angle, BANNER_RADIUS, side * (width / 2 + 0.7), topY + 0.3, 0);
                brassBatch.add(knobGeometry, knob[0], knob[1], knob[2]);

                const hangerHeight = mastTop - 0.6 - (topY + 0.3);
                if (hangerHeight <= 0.1) continue;
                const hanger = localToWorld(angle, BANNER_RADIUS, side * (width / 2 + 0.2), topY + 0.3 + hangerHeight / 2, 0);
                brassBatch.addScaled(box, hanger[0], hanger[1], hanger[2], 0.1, hangerHeight, 0.1, inwardRotation(angle));
            }
        }
    }

    private buildPedestals(
        plane: THREE.BufferGeometry,
        plateBatch: GeometryBatch,
        frameBatch: GeometryBatch,
        brassBatch: GeometryBatch
    ) {
        const stepRadius = 1.55;
        const baseRadius = 1.2;
        const shaftRadius = 0.75;
        const capRadius = 1.05;

        const drum = this.bin.geometry(new THREE.CylinderGeometry(1, 1, 1, 28));
        const flute = this.bin.geometry(new THREE.CylinderGeometry(1, 1, 1, 8));
        const box = this.bin.geometry(new THREE.BoxGeometry(1, 1, 1));
        const collarRing = this.bin.geometry(
            new THREE.TorusGeometry(shaftRadius + 0.06, 0.09, 6, 32).rotateX(Math.PI / 2)
        );
        const coinGeometry = this.bin.geometry(new THREE.CylinderGeometry(1.2, 1.2, 0.26, 44));
        coinGeometry.rotateX(Math.PI / 2);
        const haloGeometry = this.bin.geometry(new THREE.RingGeometry(1.45, 1.95, 44));

        for (let i = 0; i < 3; i++) {
            const angle = SOUTH + PEDESTAL_SPREAD[i];
            const rotation = inwardRotation(angle);
            const height = PEDESTAL_HEIGHTS[i];
            const at = (lx: number, ly: number, lz: number) => localToWorld(angle, PEDESTAL_RADIUS, lx, ly, lz);

            const step = at(0, 0.18, 0);
            frameBatch.addScaled(drum, step[0], step[1], step[2], stepRadius, 0.36, stepRadius, rotation);
            brassBatch.addScaled(drum, step[0], 0.4, step[2], stepRadius + 0.05, 0.1, stepRadius + 0.05, rotation);

            const base = at(0, 0.66, 0);
            frameBatch.addScaled(drum, base[0], base[1], base[2], baseRadius, 0.56, baseRadius, rotation);
            brassBatch.addScaled(drum, base[0], 0.98, base[2], baseRadius + 0.06, 0.14, baseRadius + 0.06, rotation);

            const shaftBottom = 1.05;
            const shaftHeight = height;
            const body = at(0, shaftBottom + shaftHeight / 2, 0);
            frameBatch.addScaled(drum, body[0], body[1], body[2], shaftRadius, shaftHeight, shaftRadius, rotation);

            for (let f = 0; f < 12; f++) {
                const fluteAngle = (f / 12) * Math.PI * 2;
                const fx = body[0] + Math.cos(fluteAngle) * shaftRadius;
                const fz = body[2] + Math.sin(fluteAngle) * shaftRadius;
                frameBatch.addScaled(flute, fx, body[1], fz, 0.1, shaftHeight - 0.5, 0.1, rotation);
            }

            const collarY = shaftBottom + shaftHeight;
            brassBatch.add(collarRing, body[0], shaftBottom + 0.22, body[2]);
            brassBatch.add(collarRing, body[0], collarY - 0.22, body[2]);

            const cap = at(0, collarY + 0.2, 0);
            frameBatch.addScaled(drum, cap[0], cap[1], cap[2], capRadius, 0.4, capRadius, rotation);
            brassBatch.addScaled(drum, cap[0], collarY + 0.46, cap[2], capRadius + 0.08, 0.14, capRadius + 0.08, rotation);

            const accent = RANK_COLORS[i];

            const faceMaterial = this.bin.material(new THREE.MeshStandardMaterial({
                color: accent,
                emissive: accent,
                emissiveIntensity: 0.5,
                roughness: 0.24,
                metalness: 0.9,
                toneMapped: false,
            }));
            const sideMaterial = this.bin.material(new THREE.MeshStandardMaterial({
                color: accent,
                roughness: 0.22,
                metalness: 1,
            }));

            const coin = new THREE.Mesh(coinGeometry, [sideMaterial, faceMaterial, faceMaterial]);
            const coinAt = at(0, collarY + 2.9, 0);
            coin.position.set(coinAt[0], coinAt[1], coinAt[2]);
            coin.castShadow = true;
            this.scene.add(coin);

            const halo = new THREE.Mesh(haloGeometry, this.bin.material(new THREE.MeshBasicMaterial({
                color: accent,
                transparent: true,
                opacity: 0.35,
                side: THREE.DoubleSide,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
            })));
            halo.position.copy(coin.position);
            halo.rotation.y = rotation;
            this.scene.add(halo);

            this.pedestals.push({
                coin,
                faceMaterial,
                halo,
                baseY: coinAt[1],
                phase: i * 1.7,
            });

            if (!isLowEndDevice()) {
                const light = new THREE.PointLight(accent, 5, 20, 2);
                light.position.set(coinAt[0], coinAt[1] + 0.5, coinAt[2]);
                light.castShadow = false;
                this.scene.add(light);
            }

            const tabletY = shaftBottom + shaftHeight * 0.55;
            const tabletDepth = shaftRadius + 0.16;
            const tablet = at(0, tabletY, tabletDepth);
            frameBatch.addScaled(box, tablet[0], tablet[1], tablet[2], 2.5, 0.9, 0.2, rotation);
            brassBatch.addScaled(box, tablet[0], tabletY + 0.52, tablet[2], 2.7, 0.12, 0.3, rotation);
            brassBatch.addScaled(box, tablet[0], tabletY - 0.52, tablet[2], 2.7, 0.12, 0.3, rotation);

            const plateAt = at(0, tabletY, tabletDepth + 0.12);
            plateBatch.addPanel(plane, plateAt[0], plateAt[1], plateAt[2], 2.36, 0.59, rotation, atlasRow(3, i));

            const pedestalCenter = localToWorld(angle, PEDESTAL_RADIUS, 0, 0, 0);
            this.collisionGrid.insertCylinder(
                new THREE.Vector3(pedestalCenter[0], (collarY + 0.6) / 2, pedestalCenter[2]),
                stepRadius + 0.15,
                collarY + 0.6
            );
        }
    }

    private paintRow(index: number, draw: (ctx: CanvasRenderingContext2D) => void) {
        const ctx = this.boardAtlas.ctx;
        ctx.save();
        ctx.translate(0, BOARD_HEIGHT * index);
        draw(ctx);
        ctx.restore();
        this.boardTexture.needsUpdate = true;
    }

    private paintTraderBoard() {
        this.paintRow(0, (ctx) => drawPlayerBoard(ctx, this.players));
    }

    private paintFactionBoards() {
        this.paintRow(1, (ctx) => drawFactionBoard(ctx, this.factions));
    }

    private paintQuestBoard() {
        this.paintRow(3, (ctx) => drawQuestBoard(ctx, this.quests));
    }

    private paintBoards() {
        this.paintTraderBoard();
        this.paintFactionBoards();
        this.paintQuestBoard();
        this.paintRow(2, (ctx) => drawNoticeBoard(ctx));
    }

    private paintBanners() {
        const ctx = this.bannerAtlas.ctx;

        for (let i = 0; i < 3; i++) {
            const faction = this.factions[i] ?? null;
            const color = faction ? hexColor(factionColor(faction.number)) : "#3a4354";

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
            const faction = this.factions[i];
            ctx.save();
            ctx.translate(0, PLATE_HEIGHT * i);
            if (faction) {
                drawFactionPlate(
                    ctx,
                    faction.rank ?? i + 1,
                    faction.name.slice(0, 16),
                    "LV " + faction.level + "  ·  " + faction.memberCount + " members",
                    hexColor(factionColor(faction.number))
                );
            } else {
                drawFactionPlate(ctx, i + 1, "—", "awaiting syndicate", "#3a4354");
            }
            ctx.restore();
        }

        this.plateTexture.needsUpdate = true;
    }

    private refreshPedestalCoins() {
        this.pedestals.forEach((pedestal, index) => {
            const faction = this.factions[index];
            const accent = RANK_COLORS[index];

            if (!faction) {
                pedestal.faceMaterial.map = null;
                pedestal.faceMaterial.emissiveMap = null;
                pedestal.faceMaterial.color.setHex(accent);
                pedestal.faceMaterial.needsUpdate = true;
                return;
            }

            const url = factionImageUrl(faction.image);
            if (!url) {
                pedestal.faceMaterial.map = null;
                pedestal.faceMaterial.emissiveMap = null;
                pedestal.faceMaterial.color.setHex(factionColor(faction.number));
                pedestal.faceMaterial.needsUpdate = true;
                return;
            }

            tokenTextureCache.load(url, (texture) => {
                if (this.factions[index]?.id !== faction.id) return;
                texture.colorSpace = THREE.SRGBColorSpace;
                pedestal.faceMaterial.map = texture;
                pedestal.faceMaterial.emissiveMap = texture;
                pedestal.faceMaterial.color.setHex(0xffffff);
                pedestal.faceMaterial.emissive.setHex(0xffffff);
                pedestal.faceMaterial.emissiveIntensity = 0.42;
                pedestal.faceMaterial.needsUpdate = true;
            });
        });
    }

    private requestFactionArtwork() {
        for (const faction of this.factions.slice(0, 8)) {
            loadFactionImage(faction.image, () => {
                this.paintFactionBoards();
                this.paintBanners();
            });
        }
    }

    private markReceived(key: "players" | "factions" | "quests") {
        this.received[key] = true;
        if (this.received.players && this.received.factions && this.received.quests) this.dataGate.open();
    }

    public whenDataReady(): Promise<void> {
        return this.dataGate.promise;
    }

    setPlayers(entries: LeaderboardEntry[]) {
        this.players = entries;
        this.markReceived("players");
        if (!this.boardTexture) return;
        this.paintTraderBoard();
    }

    setQuests(list: FactionQuestEntry[]) {
        this.quests = list;
        this.markReceived("quests");
        if (!this.boardTexture) return;

        for (const quest of list.slice(0, 6)) {
            loadFactionImage(quest.factionImage, () => this.paintQuestBoard());
        }
        this.paintQuestBoard();
    }

    hasBoardData(): boolean {
        return this.players.length > 0 && this.factions.length > 0;
    }

    setFactions(list: FactionSummary[]) {
        this.factions = list;
        this.markReceived("factions");
        if (!this.boardTexture) return;
        this.requestFactionArtwork();
        this.paintFactionBoards();
        this.paintBanners();
        this.paintPlates();
        this.refreshPedestalCoins();
    }

    update(delta: number) {
        this.time += delta;

        for (const pedestal of this.pedestals) {
            pedestal.coin.rotation.y += delta * 0.7;
            pedestal.coin.position.y = pedestal.baseY + Math.sin(this.time * 1.1 + pedestal.phase) * 0.22;
            pedestal.halo.position.y = pedestal.coin.position.y;
            const material = pedestal.halo.material as THREE.MeshBasicMaterial;
            material.opacity = 0.24 + Math.sin(this.time * 2 + pedestal.phase) * 0.09;
        }
    }

    dispose() {
        this.pedestals = [];
    }
}
