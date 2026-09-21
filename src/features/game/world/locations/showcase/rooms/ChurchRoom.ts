// src/features/game/world/locations/showcase/rooms/ChurchRoom.ts
import * as THREE from "three";
import { ShowcaseRoom } from "../ShowcaseRoom";
import { ResourceManager } from "../../../../core/ResourceManager";
import { SHOWCASE_INFO_BY_ID, ShowcaseInfo } from "../config";
import { CrowdSpec } from "../actors/ShowcaseCrowd";
import { footRestY, seatedActorY } from "../actors/poses";
import type { EmblemKind } from "../textures";
import { getGraphicsSettings, prefersMobileProfile } from "@/features/game/core/graphicsSettings";
import { ChurchLight, type ShaftSpec } from "./church/ChurchLight";
import { ChurchAtmosphere, type BeamAnchor } from "./church/ChurchAtmosphere";
import { ChurchService } from "./church/ChurchService";
import type { DirectedActor, DirectedScene } from "../scene/directedScene";
import type { ShowcaseActor } from "../actors/ShowcaseActor";
import {
    ALTAR_Z,
    BOOTH_BENCH_X,
    BOOTH_DEPTH,
    BOOTH_DOOR_WIDTH,
    BOOTH_GRILLE_Y,
    BOOTH_HEIGHT,
    BOOTH_SEAT_TOP,
    BOOTH_WIDTH,
    BOOTH_X,
    BOOTH_Z,
    boothCellZ,
    type BoothCell,
    CENSER_ANCHOR_Y,
    CENSER_DROP,
    CHOIR_TIERS,
    CHOIR_X,
    COLUMN_X,
    HALF_WIDTH,
    NAVE_END,
    NAVE_LENGTH,
    NAVE_MID,
    NAVE_START,
    PEW_CENTER_X,
    PEW_FIRST_Z,
    PEW_ROWS,
    PEW_SEATS,
    PEW_STEP,
    PEW_WIDTH,
    PULPIT_DECK_Y,
    PULPIT_FACING,
    PULPIT_X,
    PULPIT_Z,
    ROSE_BLAZE_GLOW,
    ROSE_IDLE_GLOW,
    ROSE_RADIUS,
    ROSE_Y,
    ROSE_Z,
    SEAT_TOP,
    VAULT_RADIUS,
    VOTIVE_Z,
    WALL_HEIGHT,
    WINDOW_BAYS,
    pewSeatX,
    pewRowZ,
    seatKey,
    STORY_SEATS,
} from "./church/churchLayout";
import {
    disposeChurchSurfaces,
    grilleTexture,
    loadChurchSurfaces,
    loadPepeIcon,
    roseTexture,
    surfaceSet,
    type ChurchSurfaceSet,
    type ChurchSurfaceTextures,
} from "./church/churchTextures";

const GOSPELS: Array<{ ticker: string; kind: EmblemKind; tint: number }> = [
    { ticker: "$DOGE", kind: "dog", tint: 0xffc43d },
    { ticker: "$PEPE", kind: "frog", tint: 0x4ade80 },
    { ticker: "$MOON", kind: "rocket", tint: 0x67c9ff },
    { ticker: "$HODL", kind: "diamond", tint: 0x9ec6ff },
    { ticker: "$PUMP", kind: "chart", tint: 0xff8f5a },
    { ticker: "$BULL", kind: "bull", tint: 0xff6f61 },
];

const RELICS = ["$LUNA", "$FTT", "$SAFE", "$ICO", "$BITCONNECT", "$SQUID"];

const CHURCH_EXPOSURE = {
    environment: 0.38,
    ambient: 0.36,
    hemisphere: 0.44,
    key: 1.3,
    fill: 0.34,
    shaftSun: 0.17,
    shaftShade: 0.08,
};

// Every shaft is pulled this far towards candle-warm before it is drawn, so a green
// or blue window still throws honey-coloured light instead of tinting the aisle.
const SHAFT_WARMTH = 0xffe0b0;

const BOOTH_DOOR_SWING = 1.35;
const BOOTH_DOOR_RATE = 3.4;

interface BoothDoor {
    hinge: THREE.Group;
    sign: number;
    angle: number;
    target: number;
}

export class ChurchRoom extends ShowcaseRoom {
    private candleLights: THREE.PointLight[] = [];
    private surfaces: ChurchSurfaceTextures | null = null;
    private light: ChurchLight | null = null;
    private atmosphere: ChurchAtmosphere | null = null;
    private environment: THREE.Texture | null = null;
    private shaftSpecs: ShaftSpec[] = [];
    private censerBowl: THREE.Object3D | null = null;
    private readonly cameraProbe = new THREE.Vector3(0, 4, 0);
    private readonly censerProbe = new THREE.Vector3();
    private rose: THREE.Group | null = null;
    private roseGlass: THREE.MeshStandardMaterial | null = null;
    private roseFigure: THREE.MeshStandardMaterial | null = null;
    private roseFigureMesh: THREE.Mesh | null = null;
    private roseBloom: THREE.MeshBasicMaterial | null = null;
    private roseLight: THREE.PointLight | null = null;
    private roseGlow = 0;
    private roseGlowTarget = 0;
    private chartCandles: THREE.Mesh[] = [];
    private chartBaseY: number[] = [];
    private banners: THREE.Group[] = [];
    private censer: THREE.Group | null = null;
    private booth: THREE.Group | null = null;
    private readonly boothDoors = new Map<BoothCell, BoothDoor>();
    private service: ChurchService | null = null;

    constructor(info: ShowcaseInfo = SHOWCASE_INFO_BY_ID.get("show-church") as ShowcaseInfo) {
        super(info, 0x51a3c7, 60);
        this.exitPosition.set(0, 0, NAVE_START + 3);
        this.exitFacing = 0;
        this.spawnPosition.set(0, 0, NAVE_START + 13);
    }

    protected buildAtmosphere(): void {
        const settings = getGraphicsSettings();

        this.scene.background = new THREE.Color(0x0e0a07);
        this.scene.fog = new THREE.FogExp2(0x160f0a, 0.0115);

        const anisotropy = this.renderer?.capabilities.getMaxAnisotropy() ?? 4;
        this.surfaces = loadChurchSurfaces(prefersMobileProfile() ? Math.min(4, anisotropy) : anisotropy);

        this.scene.add(new THREE.AmbientLight(0x43352a, CHURCH_EXPOSURE.ambient));
        this.scene.add(new THREE.HemisphereLight(0x5f5140, 0x171310, CHURCH_EXPOSURE.hemisphere));

        const key = new THREE.DirectionalLight(0xffdca8, CHURCH_EXPOSURE.key);
        key.position.set(46, 54, 10);
        key.target.position.set(0, 0, 6);
        key.castShadow = settings.shadowRes > 0;
        key.shadow.mapSize.set(Math.max(1024, settings.shadowRes), Math.max(1024, settings.shadowRes));
        key.shadow.camera.left = -46;
        key.shadow.camera.right = 46;
        key.shadow.camera.top = 60;
        key.shadow.camera.bottom = -60;
        key.shadow.camera.near = 5;
        key.shadow.camera.far = 200;
        key.shadow.bias = -0.0004;
        key.shadow.normalBias = 0.05;
        key.shadow.camera.updateProjectionMatrix();
        this.scene.add(key);
        this.scene.add(key.target);

        // A cold blue bounce is what made the left aisle look sickly next to the warm
        // key; the shade side gets a dim warm fill instead.
        const fill = new THREE.DirectionalLight(0xffcf9e, CHURCH_EXPOSURE.fill);
        fill.position.set(-40, 26, -30);
        this.scene.add(fill);

        const aisle = new THREE.PointLight(0xffc186, 26, 52, 2);
        aisle.position.set(-8.5, 8.5, -4);
        this.scene.add(aisle);

        const altarGlow = new THREE.PointLight(0xffc46a, 54, 60, 2);
        altarGlow.position.set(0, 9, ALTAR_Z - 2);
        this.scene.add(altarGlow);
    }

    private pbr(
        set: ChurchSurfaceSet,
        repeatX: number,
        repeatY: number,
        options: { color?: number; roughness?: number; metalness?: number; normalScale?: number } = {}
    ): THREE.MeshStandardMaterial {
        const tiled = surfaceSet(this.bin, set, repeatX, repeatY);
        const material = this.bin.material(new THREE.MeshStandardMaterial({
            map: tiled.map,
            normalMap: tiled.normal,
            color: options.color ?? 0xffffff,
            roughness: options.roughness ?? 0.92,
            metalness: options.metalness ?? 0.04,
        }));
        const scale = options.normalScale ?? 1;
        material.normalScale.set(scale, scale);
        return material;
    }

    protected decorate(rm: ResourceManager): void {
        const settings = getGraphicsSettings();
        const mobile = prefersMobileProfile();

        this.atmosphere = new ChurchAtmosphere(this.scene, this.bin, this.random, settings.particles);

        this.buildShell();
        this.buildColumns();
        this.buildWindows();
        this.buildBanners();
        this.buildApse();
        this.buildPulpit();
        this.buildChoir();
        this.buildPews();
        this.buildVotives();
        this.buildConfessional();
        this.buildRelicWall();
        this.buildChandeliers();
        this.buildCrowd();
        this.service = new ChurchService(this, this.crowd, this.random);
        this.service.create(rm, this.collisionGrid);

        this.captureEnvironment();

        this.light = new ChurchLight(this.scene, this.bin, this.random, 0);
        this.light.create(this.shaftSpecs, !mobile);

        const anchors: BeamAnchor[] = this.shaftSpecs.map((spec) => ({
            origin: spec.origin,
            direction: spec.direction,
            length: spec.length,
            radius: Math.max(spec.width, spec.height) * 0.4,
        }));

        this.atmosphere.create(anchors, {
            halfWidth: HALF_WIDTH,
            from: NAVE_START + 2,
            to: NAVE_END - 2,
            height: 14,
        });
    }

    private captureEnvironment() {
        if (!this.renderer) return;

        const generator = new THREE.PMREMGenerator(this.renderer);
        const target = generator.fromScene(this.scene, 0, 0.5, 220, {
            size: 128,
            position: new THREE.Vector3(0, 6, NAVE_MID),
        });

        this.environment = target.texture;
        this.scene.environment = target.texture;
        this.scene.environmentIntensity = CHURCH_EXPOSURE.environment;
        generator.dispose();
    }

    private buildShell() {
        const textures = this.surfaces!;
        const slab = this.pbr(textures.floor, 10, 24, { color: 0xa2967f, roughness: 0.42, metalness: 0.08, normalScale: 0.85 });
        const wallSkin = this.pbr(textures.brick, 16, 4.5, { color: 0x8f8270, roughness: 0.95, normalScale: 1.2 });
        const endSkin = this.pbr(textures.brick, 7, 4, { color: 0x7d7160, roughness: 0.95, normalScale: 1.2 });
        const runnerSkin = this.textured(this.tex.carpet([1, 14], 0x7c2230, 0xd8b46a), { roughness: 0.98, metalness: 0 });
        const vaultSkin = this.pbr(textures.plaster, 6, 13, { color: 0x6f6252, roughness: 0.97, normalScale: 0.7 });
        const ribSkin = this.pbr(textures.marble, 3, 1, { color: 0x8a7e6a, roughness: 0.68, metalness: 0.06 });

        const floor = this.mesh(new THREE.BoxGeometry(HALF_WIDTH * 2, 0.6, NAVE_LENGTH), slab, [0, -0.3, NAVE_MID]);
        floor.castShadow = false;
        this.scene.add(floor);

        const runner = this.mesh(new THREE.BoxGeometry(5.2, 0.08, NAVE_LENGTH - 10), runnerSkin, [0, 0.04, NAVE_MID - 2]);
        runner.castShadow = false;
        this.scene.add(runner);

        for (const side of [-1, 1]) {
            const wall = this.mesh(new THREE.BoxGeometry(1.6, WALL_HEIGHT, NAVE_LENGTH), wallSkin, [side * HALF_WIDTH, WALL_HEIGHT / 2, NAVE_MID]);
            this.scene.add(wall);
            this.collisionGrid.insertOrientedBox(side * HALF_WIDTH, NAVE_MID, 1.6, NAVE_LENGTH, 0, 0, WALL_HEIGHT);

            const buttressGeometry = this.bin.geometry(new THREE.BoxGeometry(1.4, WALL_HEIGHT - 2, 1.2));
            for (let z = NAVE_START + 4; z <= NAVE_END - 4; z += 7.4) {
                const buttress = new THREE.Mesh(buttressGeometry, wallSkin);
                buttress.position.set(side * (HALF_WIDTH - 1.2), (WALL_HEIGHT - 2) / 2, z);
                buttress.castShadow = true;
                this.scene.add(buttress);
            }
        }

        for (const [z, height] of [[NAVE_START, WALL_HEIGHT], [NAVE_END, WALL_HEIGHT]] as Array<[number, number]>) {
            const wall = this.mesh(new THREE.BoxGeometry(HALF_WIDTH * 2 + 1.6, height, 1.6), endSkin, [0, height / 2, z]);
            this.scene.add(wall);
            this.collisionGrid.insertOrientedBox(0, z, HALF_WIDTH * 2 + 1.6, 1.6, 0, 0, height + VAULT_RADIUS);

            const tympanum = this.mesh(new THREE.CircleGeometry(VAULT_RADIUS, 26, 0, Math.PI), endSkin, [0, height, z + (z < 0 ? 0.8 : -0.8)]);
            if (z > 0) tympanum.rotation.y = Math.PI;
            tympanum.castShadow = false;
            this.scene.add(tympanum);
        }

        const vault = this.mesh(
            new THREE.CylinderGeometry(VAULT_RADIUS, VAULT_RADIUS, NAVE_LENGTH, 26, 1, true, Math.PI / 2, Math.PI),
            vaultSkin,
            [0, WALL_HEIGHT, NAVE_MID],
            [Math.PI / 2, 0, 0]
        );
        (vault.material as THREE.Material).side = THREE.BackSide;
        vault.castShadow = false;
        this.scene.add(vault);

        const ribGeometry = this.bin.geometry(new THREE.TorusGeometry(VAULT_RADIUS - 0.25, 0.42, 8, 24, Math.PI));
        for (let z = NAVE_START + 3.7; z <= NAVE_END - 3.7; z += 7.4) {
            const rib = new THREE.Mesh(ribGeometry, ribSkin);
            rib.position.set(0, WALL_HEIGHT, z);
            rib.castShadow = false;
            this.scene.add(rib);
        }

        const cornice = this.bin.geometry(new THREE.BoxGeometry(1.5, 0.8, NAVE_LENGTH));
        for (const side of [-1, 1]) {
            const strip = new THREE.Mesh(cornice, ribSkin);
            strip.position.set(side * (HALF_WIDTH - 0.9), WALL_HEIGHT - 0.2, NAVE_MID);
            strip.castShadow = false;
            this.scene.add(strip);
        }
    }

    private buildColumns() {
        const textures = this.surfaces!;
        const shaftSkin = this.pbr(textures.marble, 2, 5, { color: 0x968a72, roughness: 0.46, metalness: 0.07, normalScale: 0.6 });
        const trimSkin = this.pbr(textures.marble, 2, 1, { color: 0x7d7160, roughness: 0.6, metalness: 0.07 });

        const shaft = this.bin.geometry(new THREE.CylinderGeometry(0.9, 1.02, WALL_HEIGHT - 3.5, 16, 1));
        const capital = this.bin.geometry(new THREE.CylinderGeometry(1.35, 0.95, 1.1, 16));
        const collar = this.bin.geometry(new THREE.TorusGeometry(1.06, 0.12, 8, 18));
        const plinth = this.bin.geometry(new THREE.BoxGeometry(2.6, 0.8, 2.6));

        for (let z = NAVE_START + 6; z <= ALTAR_Z - 2; z += 7.4) {
            for (const side of [-1, 1]) {
                const x = side * COLUMN_X;

                const base = new THREE.Mesh(plinth, trimSkin);
                base.position.set(x, 0.4, z);
                base.castShadow = true;
                base.receiveShadow = true;
                this.scene.add(base);

                const body = new THREE.Mesh(shaft, shaftSkin);
                body.position.set(x, (WALL_HEIGHT - 3.5) / 2 + 0.8, z);
                body.castShadow = true;
                this.scene.add(body);

                for (const ringY of [1.5, WALL_HEIGHT - 3.6]) {
                    const ring = new THREE.Mesh(collar, trimSkin);
                    ring.position.set(x, ringY, z);
                    ring.rotation.x = Math.PI / 2;
                    this.scene.add(ring);
                }

                const top = new THREE.Mesh(capital, trimSkin);
                top.position.set(x, WALL_HEIGHT - 2.2, z);
                top.castShadow = true;
                this.scene.add(top);

                this.collisionGrid.insertCylinder(new THREE.Vector3(x, WALL_HEIGHT / 2, z), 1.15, WALL_HEIGHT);
            }
        }
    }

    private buildWindows() {
        const frame = this.pbr(this.surfaces!.brick, 1, 2, { color: 0x4a4135, roughness: 0.9, metalness: 0.05 });
        const spacing = (ALTAR_Z - 4 - (NAVE_START + 6)) / (WINDOW_BAYS - 1);

        for (let i = 0; i < WINDOW_BAYS; i++) {
            const z = NAVE_START + 6 + i * spacing;

            for (const side of [-1, 1]) {
                const gospel = GOSPELS[(i + (side > 0 ? 3 : 0)) % GOSPELS.length];
                const x = side * (HALF_WIDTH - 0.7);
                const group = new THREE.Group();
                group.position.set(x, 11, z);
                group.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;

                const casing = new THREE.Mesh(this.bin.geometry(new THREE.BoxGeometry(4.6, 9.4, 0.5)), frame);
                group.add(casing);

                const glassSkin = this.textured(this.tex.stained(gospel.ticker, gospel.kind, gospel.tint), {
                    roughness: 0.28,
                    metalness: 0,
                    emissive: 0xffffff,
                    emissiveIntensity: 1.9,
                });

                const pane = new THREE.Mesh(this.bin.geometry(new THREE.BoxGeometry(3.5, 7, 0.24)), glassSkin);
                pane.position.set(0, -0.6, 0.2);
                group.add(pane);

                const archPane = new THREE.Mesh(this.bin.geometry(new THREE.CircleGeometry(1.75, 20, 0, Math.PI)), glassSkin);
                archPane.position.set(0, 2.9, 0.32);
                group.add(archPane);

                const archRing = new THREE.Mesh(this.bin.geometry(new THREE.TorusGeometry(1.78, 0.16, 8, 20, Math.PI)), frame);
                archRing.position.set(0, 2.9, 0.34);
                group.add(archRing);

                for (const dx of [-1.16, 0, 1.16]) {
                    const mullion = new THREE.Mesh(this.bin.geometry(new THREE.BoxGeometry(0.16, 7, 0.32)), frame);
                    mullion.position.set(dx, -0.6, 0.28);
                    group.add(mullion);
                }

                for (const dy of [-3.4, -0.6, 2.2]) {
                    const transom = new THREE.Mesh(this.bin.geometry(new THREE.BoxGeometry(3.5, 0.14, 0.32)), frame);
                    transom.position.set(0, dy, 0.28);
                    group.add(transom);
                }

                const sill = new THREE.Mesh(this.bin.geometry(new THREE.BoxGeometry(5.2, 0.4, 1)), frame);
                sill.position.set(0, -4.9, 0.2);
                group.add(sill);

                const bloomTint = new THREE.Color(gospel.tint).lerp(new THREE.Color(SHAFT_WARMTH), 0.6);
                const bloom = new THREE.Mesh(
                    this.bin.geometry(new THREE.PlaneGeometry(5.4, 11)),
                    this.glow(bloomTint.getHex(), side > 0 ? 0.26 : 0.15)
                );
                bloom.position.set(0, 0.4, 0.5);
                bloom.renderOrder = 6;
                group.add(bloom);

                this.scene.add(group);

                const sunward = side > 0;
                const tint = new THREE.Color(gospel.tint).lerp(
                    new THREE.Color(SHAFT_WARMTH),
                    sunward ? 0.62 : 0.78
                );

                this.shaftSpecs.push({
                    origin: new THREE.Vector3(x - side * 1.2, 11.2, z),
                    direction: new THREE.Vector3(-side * 0.62, -0.74, -0.16).normalize(),
                    width: 4.2,
                    height: 8.8,
                    length: 24,
                    tint: tint.getHex(),
                    strength: sunward ? CHURCH_EXPOSURE.shaftSun : CHURCH_EXPOSURE.shaftShade,
                });
            }
        }
    }

    private buildBanners() {
        const rod = this.metal(0x8c6b28, 0.45, 0.8);
        const rodGeometry = this.bin.geometry(new THREE.CylinderGeometry(0.07, 0.07, 3.3, 8));
        for (let i = 0; i < GOSPELS.length; i++) {
            const gospel = GOSPELS[i];
            const side = i % 2 === 0 ? -1 : 1;
            const z = NAVE_START + 9.7 + Math.floor(i / 2) * 14.8;
            const x = side * (COLUMN_X - 2.2);

            const bar = new THREE.Mesh(rodGeometry, rod);
            bar.position.set(x, 10.6, z);
            bar.rotation.x = Math.PI / 2;
            this.scene.add(bar);

            const cloth = this.board(
                this.tex.emblem(`banner${gospel.ticker}`, gospel.kind, 0x2a1f16, gospel.tint, gospel.ticker),
                3,
                5.4,
                [x + side * 0.24, 7.8, z],
                side > 0 ? -Math.PI / 2 : Math.PI / 2,
                { roughness: 0.95, metalness: 0.02, emissive: gospel.tint, emissiveIntensity: 0.18, segments: 6 }
            );
            this.scene.add(cloth);
            this.banners.push(cloth);

            for (const dz of [-1.3, 1.3]) {
                const tassel = this.mesh(new THREE.ConeGeometry(0.16, 0.5, 6), rod, [x + side * 0.24, 5, z + dz]);
                this.scene.add(tassel);
            }
        }
    }

    private buildApse() {
        const textures = this.surfaces!;
        const stone = this.pbr(textures.brick, 6, 5, { color: 0x8a7d6a, roughness: 0.94, normalScale: 1.1 });
        const step = this.pbr(textures.marble, 4, 2, { color: 0x9a8e78, roughness: 0.5, metalness: 0.07 });
        const gold = this.metal(0xe0b552, 0.26, 0.95);
        const goldDark = this.metal(0x8c6b28, 0.48, 0.82);

        const apse = this.mesh(
            new THREE.CylinderGeometry(VAULT_RADIUS, VAULT_RADIUS, WALL_HEIGHT, 26, 1, true, -Math.PI / 2, Math.PI),
            stone,
            [0, WALL_HEIGHT / 2, NAVE_END - 6]
        );
        (apse.material as THREE.Material).side = THREE.BackSide;
        this.scene.add(apse);
        this.collisionGrid.insertOrientedBox(0, NAVE_END - 2, HALF_WIDTH * 2, 4, 0, 0, WALL_HEIGHT);

        const halfDome = this.mesh(
            new THREE.SphereGeometry(VAULT_RADIUS, 26, 14, 0, Math.PI * 2, 0, Math.PI / 2),
            stone,
            [0, WALL_HEIGHT, NAVE_END - 6]
        );
        (halfDome.material as THREE.Material).side = THREE.BackSide;
        halfDome.castShadow = false;
        this.scene.add(halfDome);

        for (let i = 0; i < 3; i++) {
            const width = 20 - i * 3;
            const depth = 10 - i * 2.2;
            const height = 0.42;
            const stair = this.mesh(new THREE.BoxGeometry(width, height, depth), step, [0, i * height + height / 2, ALTAR_Z - 4 + i * 1.1]);
            this.scene.add(stair);
        }

        this.buildRose(gold, goldDark);

        const altarSkin = this.pbr(this.surfaces!.marble, 3, 1, { color: 0x8c7a5c, roughness: 0.38, metalness: 0.1 });
        const altarTable = this.mesh(new THREE.BoxGeometry(7.4, 1.5, 3), altarSkin, [0, 2.05, ALTAR_Z]);
        this.scene.add(altarTable);
        this.collisionGrid.insertOrientedBox(0, ALTAR_Z, 7.4, 3, 0, 1.3, 2.8);

        const clothSkin = this.textured(this.tex.carpet([2, 1], 0x7c2230, 0xd8b46a), { roughness: 0.96, metalness: 0 });
        const cloth = this.mesh(new THREE.BoxGeometry(7.8, 0.12, 3.4), clothSkin, [0, 2.82, ALTAR_Z]);
        this.scene.add(cloth);

        const chartBase = this.mesh(new THREE.BoxGeometry(9.5, 0.5, 1.6), this.matte(0x3e372c, 0.9), [0, 3.1, ALTAR_Z + 0.2]);
        this.scene.add(chartBase);

        const greenMaterial = this.lit(0x3ddc84, 1.8);
        for (let i = 0; i < 7; i++) {
            const height = 0.9 + i * 0.62 + (i === 6 ? 1.6 : 0);
            const candle = this.mesh(new THREE.BoxGeometry(0.85, height, 0.85), greenMaterial, [3.6 - i * 1.2, 3.35 + height / 2, ALTAR_Z + 0.2]);
            this.scene.add(candle);
            this.chartCandles.push(candle);
            this.chartBaseY.push(candle.position.y);

            const wick = this.mesh(new THREE.BoxGeometry(0.14, height * 0.45, 0.14), greenMaterial, [3.6 - i * 1.2, 3.35 + height + height * 0.2, ALTAR_Z + 0.2]);
            this.scene.add(wick);
        }

        for (const side of [-1, 1]) {
            const stand = new THREE.Group();
            stand.position.set(side * 6.5, 0, ALTAR_Z - 1);

            const pole = this.mesh(new THREE.CylinderGeometry(0.16, 0.26, 3.4, 10), goldDark, [0, 1.7, 0]);
            stand.add(pole);

            const bowl = this.mesh(new THREE.CylinderGeometry(0.85, 0.45, 0.6, 12), goldDark, [0, 3.6, 0]);
            stand.add(bowl);

            this.atmosphere?.addCandle(side * 6.5, 4.4, ALTAR_Z - 1, 2.6);

            const light = new THREE.PointLight(0xffa845, 26, 26, 2);
            light.position.set(0, 4.4, 0);
            stand.add(light);
            this.candleLights.push(light);

            this.scene.add(stand);
        }

        // The group's origin is the hook in the vault, not the bowl: rotating it swings
        // the whole censer on its chain instead of waggling the chain around a bowl that
        // stays put.
        const censer = new THREE.Group();
        censer.position.set(0, CENSER_ANCHOR_Y, ALTAR_Z - 6);

        const hook = this.mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 14), goldDark, [0, 0, 0], [Math.PI / 2, 0, 0]);
        censer.add(hook);

        const chain = this.mesh(new THREE.CylinderGeometry(0.04, 0.04, CENSER_DROP, 6), goldDark, [0, -CENSER_DROP / 2, 0]);
        censer.add(chain);

        const bowlBody = this.mesh(
            new THREE.SphereGeometry(0.42, 14, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
            goldDark,
            [0, -CENSER_DROP, 0]
        );
        censer.add(bowlBody);

        const lid = this.mesh(new THREE.ConeGeometry(0.44, 0.5, 12), gold, [0, -CENSER_DROP + 0.26, 0]);
        censer.add(lid);

        const vent = new THREE.Object3D();
        vent.position.set(0, -CENSER_DROP + 0.5, 0);
        censer.add(vent);
        this.censerBowl = vent;

        this.scene.add(censer);
        this.censer = censer;
    }

    // The apse window: a stone-and-gold sunburst with a leaded rose in it, and the
    // praying frog as its figure. Lit from behind so it reads as glass, and the story
    // drives setRoseGlow when the congregation lifts their bags.
    private buildRose(gold: THREE.Material, goldDark: THREE.Material) {
        const group = new THREE.Group();
        group.position.set(0, ROSE_Y, ROSE_Z);
        group.rotation.y = Math.PI;

        const stone = this.pbr(this.surfaces!.marble, 3, 1, { color: 0x8e8270, roughness: 0.58, metalness: 0.06 });
        const lead = this.matte(0x1b1409, 0.84, 0.18);

        const surround = this.mesh(new THREE.TorusGeometry(ROSE_RADIUS + 0.8, 0.62, 10, 46), stone);
        group.add(surround);

        const rim = this.mesh(new THREE.TorusGeometry(ROSE_RADIUS + 0.12, 0.42, 10, 46), goldDark);
        group.add(rim);

        this.roseGlass = this.textured(roseTexture(this.bin, this.random), {
            roughness: 0.2,
            metalness: 0,
            emissive: 0xffffff,
            emissiveIntensity: ROSE_IDLE_GLOW,
        });
        this.roseGlass.transparent = true;
        this.roseGlass.side = THREE.DoubleSide;

        const pane = this.mesh(new THREE.CircleGeometry(ROSE_RADIUS, 52), this.roseGlass, [0, 0, 0.1]);
        pane.castShadow = false;
        pane.receiveShadow = false;
        pane.renderOrder = 3;
        group.add(pane);

        const anisotropy = this.renderer?.capabilities.getMaxAnisotropy() ?? 4;
        const icon = loadPepeIcon(this.bin, anisotropy, (aspect) => this.roseFigureMesh?.scale.set(1, aspect, 1));

        this.roseFigure = this.textured(icon, {
            roughness: 0.26,
            metalness: 0,
            emissive: 0xffffff,
            emissiveIntensity: ROSE_IDLE_GLOW * 1.4,
        });
        // No alphaTest: the cut-out's edge is feathered and its lower hem fades out, and
        // a hard cutoff would bring the straight ribbon cut back.
        this.roseFigure.transparent = true;
        this.roseFigure.depthWrite = false;
        this.roseFigure.side = THREE.DoubleSide;

        // Sized to sit inside the medallion (radius 0.46 of the pane) with its corners
        // to spare, rather than spilling onto the surrounding quarries. The plane is one
        // unit wide and scaled by the loader's aspect once the file is in.
        const figureWidth = ROSE_RADIUS * 0.74;
        const holder = new THREE.Group();
        holder.position.set(0, 0.12, 0.22);
        holder.scale.setScalar(figureWidth);

        const figure = this.mesh(new THREE.PlaneGeometry(1, 1), this.roseFigure);
        figure.scale.set(1, 0.85, 1);
        figure.castShadow = false;
        figure.receiveShadow = false;
        figure.renderOrder = 4;
        holder.add(figure);
        group.add(holder);
        this.roseFigureMesh = figure;

        const medallion = this.mesh(new THREE.TorusGeometry(ROSE_RADIUS * 0.47, 0.14, 8, 40), lead, [0, 0, 0.16]);
        group.add(medallion);

        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2;
            const ray = new THREE.Mesh(this.bin.geometry(new THREE.BoxGeometry(0.3, 3.4, 0.3)), gold);
            ray.position.set(Math.cos(angle) * (ROSE_RADIUS + 2.4), Math.sin(angle) * (ROSE_RADIUS + 2.4), -0.3);
            ray.rotation.z = angle - Math.PI / 2;
            group.add(ray);
        }

        this.roseBloom = this.glow(0xffd79a, 0.16);
        const bloom = new THREE.Mesh(this.bin.geometry(new THREE.CircleGeometry(ROSE_RADIUS + 3.4, 46)), this.roseBloom);
        bloom.position.z = 0.34;
        bloom.renderOrder = 5;
        group.add(bloom);

        this.scene.add(group);
        this.rose = group;

        this.roseLight = new THREE.PointLight(0xffd7a2, 26, 54, 2);
        this.roseLight.position.set(0, ROSE_Y - 1, ROSE_Z - 4.5);
        this.scene.add(this.roseLight);
    }

    // 0 keeps the window at its resting glow, 1 is the full blaze at the end of the
    // sermon when every bag is held up.
    public setRoseGlow(amount: number) {
        this.roseGlowTarget = THREE.MathUtils.clamp(amount, 0, 1);
    }

    // Rebuilt straight: a true cylinder instead of a tapered one, the open side of the
    // rail centred on the nave, the crest curved onto the drum instead of floating flat
    // in front of it, and a closed flight of steps that actually reaches the deck.
    private buildPulpit() {
        const wood = this.pbr(this.surfaces!.wood, 2, 1, { color: 0x6b5238, roughness: 0.74, metalness: 0.05 });
        const stepWood = this.pbr(this.surfaces!.wood, 1, 1, { color: 0x5d4730, roughness: 0.78, metalness: 0.05 });
        const gold = this.metal(0xd8b46a, 0.3, 0.9);

        const group = new THREE.Group();
        group.position.set(PULPIT_X, 0, PULPIT_Z);
        group.rotation.y = PULPIT_FACING;

        const radius = 1.42;
        const drumHeight = PULPIT_DECK_Y - 0.16;

        const drum = this.mesh(new THREE.CylinderGeometry(radius, radius, drumHeight, 16), wood, [0, drumHeight / 2, 0]);
        group.add(drum);

        const foot = this.mesh(new THREE.CylinderGeometry(radius + 0.16, radius + 0.22, 0.24, 16), wood, [0, 0.12, 0]);
        group.add(foot);

        const deck = this.mesh(new THREE.CylinderGeometry(radius + 0.06, radius + 0.06, 0.16, 16), wood, [0, PULPIT_DECK_Y - 0.08, 0]);
        group.add(deck);

        // Open sector centred on local +Z, so the preacher looks out over the nave
        // through the gap rather than over the panelling.
        const rail = this.mesh(
            new THREE.CylinderGeometry(radius + 0.06, radius + 0.06, 0.92, 16, 1, true, Math.PI * 0.25, Math.PI * 1.5),
            wood,
            [0, PULPIT_DECK_Y + 0.46, 0]
        );
        (rail.material as THREE.Material).side = THREE.DoubleSide;
        group.add(rail);

        const trim = this.mesh(new THREE.TorusGeometry(radius + 0.07, 0.07, 8, 24), gold, [0, PULPIT_DECK_Y + 0.92, 0], [Math.PI / 2, 0, 0]);
        group.add(trim);

        const collar = this.mesh(new THREE.TorusGeometry(radius + 0.02, 0.06, 8, 24), gold, [0, drumHeight, 0], [Math.PI / 2, 0, 0]);
        group.add(collar);

        // The crest is a slice of cylinder skinned with the emblem, so it sits on the
        // curve of the drum with no gap and no lean.
        const crest = this.mesh(
            new THREE.CylinderGeometry(radius + 0.02, radius + 0.02, 0.92, 20, 1, true, -Math.PI / 6, Math.PI / 3),
            this.decal(this.tex.emblem("pulpit", "diamond", 0x3a2c1c, 0xffd489), {
                roughness: 0.8,
                metalness: 0.1,
                emissive: 0xffd489,
                emissiveIntensity: 0.25,
            }),
            [0, drumHeight * 0.58, 0]
        );
        crest.castShadow = false;
        group.add(crest);

        const lectern = this.mesh(new THREE.BoxGeometry(0.95, 0.1, 0.62), wood, [0, PULPIT_DECK_Y + 0.66, 1.08], [-0.3, 0, 0]);
        group.add(lectern);

        const ledge = this.mesh(new THREE.BoxGeometry(0.95, 0.09, 0.1), wood, [0, PULPIT_DECK_Y + 0.58, 1.34]);
        group.add(ledge);

        const lecternBook = this.mesh(new THREE.BoxGeometry(0.62, 0.08, 0.42), this.matte(0xf2e6cc, 0.9), [0, PULPIT_DECK_Y + 0.73, 1.06], [-0.3, 0, 0]);
        group.add(lecternBook);

        const steps = 4;
        const rise = PULPIT_DECK_Y / steps;
        const tread = 0.52;
        const stepWidth = 1.3;
        const firstZ = -(radius - 0.24);

        for (let i = 0; i < steps; i++) {
            const height = rise * (i + 1);
            const z = firstZ - (steps - 1 - i) * tread;
            const block = this.mesh(new THREE.BoxGeometry(stepWidth, height, tread), stepWood, [0, height / 2, z]);
            group.add(block);

            const nose = this.mesh(new THREE.BoxGeometry(stepWidth + 0.08, 0.06, tread + 0.08), stepWood, [0, height, z]);
            group.add(nose);
        }

        const flightLength = steps * tread;
        const flightMidZ = firstZ - flightLength / 2 + tread / 2;

        for (const side of [-1, 1]) {
            const newel = this.mesh(new THREE.BoxGeometry(0.12, PULPIT_DECK_Y + 0.5, 0.12), wood, [side * (stepWidth / 2 + 0.02), (PULPIT_DECK_Y + 0.5) / 2, firstZ + 0.1]);
            group.add(newel);

            const footPost = this.mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), wood, [side * (stepWidth / 2 + 0.02), 0.45, firstZ - flightLength + 0.2]);
            group.add(footPost);

            const handRail = this.mesh(
                new THREE.CylinderGeometry(0.055, 0.055, flightLength + 0.3, 8),
                gold,
                [side * (stepWidth / 2 + 0.02), (PULPIT_DECK_Y + 0.5 + 0.9) / 2 - 0.1, flightMidZ + 0.15],
                [Math.atan2(PULPIT_DECK_Y - 0.4, flightLength) + Math.PI / 2, 0, 0]
            );
            group.add(handRail);
        }

        this.scene.add(group);

        const facing = PULPIT_FACING;
        this.collisionGrid.insertCylinder(new THREE.Vector3(PULPIT_X, drumHeight / 2, PULPIT_Z), radius + 0.2, drumHeight);
        this.collisionGrid.insertOrientedBox(
            PULPIT_X + Math.sin(facing) * flightMidZ,
            PULPIT_Z + Math.cos(facing) * flightMidZ,
            stepWidth,
            flightLength,
            facing,
            0,
            PULPIT_DECK_Y
        );
    }

    private buildChoir() {
        const wood = this.pbr(this.surfaces!.wood, 3, 1, { color: 0x5f4830, roughness: 0.78, metalness: 0.04 });

        for (const tier of CHOIR_TIERS) {
            const deck = this.mesh(new THREE.BoxGeometry(tier.width, tier.y, 2.6), wood, [CHOIR_X, tier.y / 2, tier.z]);
            this.scene.add(deck);
            this.collisionGrid.insertOrientedBox(CHOIR_X, tier.z, tier.width, 2.6, 0, 0, tier.y);
        }

        const brass = this.metal(0xd8b46a, 0.35, 0.85);
        const railZ = CHOIR_TIERS[0].z - 1.5;

        const rail = this.mesh(new THREE.BoxGeometry(8.4, 0.14, 0.14), brass, [CHOIR_X, 1.05, railZ]);
        this.scene.add(rail);

        for (const dx of [-4.1, 0, 4.1]) {
            const post = this.mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.05, 8), brass, [CHOIR_X + dx, 0.52, railZ]);
            this.scene.add(post);
        }
    }

    private buildPews() {
        const wood = this.pbr(this.surfaces!.wood, 4, 1, { color: 0x5a4430, roughness: 0.72, metalness: 0.05, normalScale: 0.8 });
        const seat = this.bin.geometry(new THREE.BoxGeometry(PEW_WIDTH, 0.16, 0.72));
        const back = this.bin.geometry(new THREE.BoxGeometry(PEW_WIDTH, 0.78, 0.16));
        const leg = this.bin.geometry(new THREE.BoxGeometry(0.34, SEAT_TOP - 0.08, 0.66));
        const kneelerHeight = footRestY(SEAT_TOP);
        const kneeler = this.bin.geometry(new THREE.BoxGeometry(PEW_WIDTH, 0.14, 0.5));
        const kneelerLeg = this.bin.geometry(new THREE.BoxGeometry(0.22, kneelerHeight, 0.4));
        const finial = this.bin.geometry(new THREE.OctahedronGeometry(0.1, 0));
        const brass = this.metal(0xb8882f, 0.4, 0.85);

        for (let row = 0; row < PEW_ROWS; row++) {
            const z = PEW_FIRST_Z + row * PEW_STEP;

            for (const side of [-1, 1]) {
                const cx = side * PEW_CENTER_X;
                const group = new THREE.Group();
                group.position.set(cx, 0, z);

                const bench = new THREE.Mesh(seat, wood);
                bench.position.y = SEAT_TOP - 0.08;
                bench.castShadow = true;
                bench.receiveShadow = true;
                group.add(bench);

                const rest = new THREE.Mesh(back, wood);
                rest.position.set(0, SEAT_TOP + 0.34, -0.5);
                rest.castShadow = true;
                group.add(rest);

                for (const dx of [-(PEW_WIDTH / 2 - 0.4), 0, PEW_WIDTH / 2 - 0.4]) {
                    const support = new THREE.Mesh(leg, wood);
                    support.position.set(dx, (SEAT_TOP - 0.08) / 2, 0);
                    group.add(support);

                    const kneelerSupport = new THREE.Mesh(kneelerLeg, wood);
                    kneelerSupport.position.set(dx, kneelerHeight / 2, 0.95);
                    group.add(kneelerSupport);
                }

                const cap = new THREE.Mesh(finial, brass);
                cap.position.set(side * -(PEW_WIDTH / 2 - 0.2), SEAT_TOP + 0.76, -0.5);
                group.add(cap);

                const board = new THREE.Mesh(kneeler, wood);
                board.position.set(0, kneelerHeight, 0.95);
                board.receiveShadow = true;
                group.add(board);

                this.scene.add(group);
                this.collisionGrid.insertOrientedBox(cx, z, PEW_WIDTH, 0.9, 0, 0, SEAT_TOP + 0.5);
            }
        }
    }

    private buildVotives() {
        const iron = this.matte(0x2b2620, 0.82, 0.35);
        const group = new THREE.Group();
        group.position.set(HALF_WIDTH - 3.4, 0, VOTIVE_Z);
        group.rotation.y = -Math.PI / 2;

        const table = this.mesh(new THREE.BoxGeometry(5.4, 0.18, 1.5), iron, [0, 1.02, 0]);
        group.add(table);

        for (const dx of [-2.4, 2.4]) {
            const leg = this.mesh(new THREE.BoxGeometry(0.16, 1.02, 1.3), iron, [dx, 0.51, 0]);
            group.add(leg);
        }

        const wax = this.bin.geometry(new THREE.CylinderGeometry(0.1, 0.11, 0.34, 8));
        const waxMaterial = this.matte(0xe8dcc0, 0.85);

        for (let row = 0; row < 3; row++) {
            for (let i = 0; i < 14; i++) {
                if (this.random() < 0.15) continue;
                const x = -2.4 + i * 0.37;
                const z = -0.45 + row * 0.45;
                const candle = new THREE.Mesh(wax, waxMaterial);
                candle.position.set(x, 1.28, z);
                group.add(candle);

                this.atmosphere?.addCandle(HALF_WIDTH - 3.4 - z, 1.54, VOTIVE_Z + x, 0.62);
            }
        }

        const light = new THREE.PointLight(0xffa845, 22, 20, 2);
        light.position.set(0, 1.9, 0);
        group.add(light);
        this.candleLights.push(light);

        const board = this.board(
            this.tex.sign("votive", ["IN MEMORIAM", "RUGGED, NOT FORGOTTEN"], { background: 0x1c1710, color: 0xf6e7c4, accent: 0x8c6b28 }),
            5,
            2,
            [0, 3, -0.7],
            0,
            { roughness: 0.9, metalness: 0.05, emissive: 0xffd489, emissiveIntensity: 0.2 }
        );
        group.add(board);

        this.scene.add(group);
        this.collisionGrid.insertOrientedBox(HALF_WIDTH - 3.4, VOTIVE_Z, 1.5, 5.4, 0, 0, 1.2);
    }

    // Two cells side by side against the left wall: each has its own door on the aisle
    // face, and the wall between them carries a grille at the height of a seated head,
    // so the pair can talk without seeing each other.
    private buildConfessional() {
        const wood = this.pbr(this.surfaces!.wood, 2, 2, { color: 0x4d3a26, roughness: 0.78, metalness: 0.05 });
        const panel = this.pbr(this.surfaces!.wood, 1, 1, { color: 0x3d2d1d, roughness: 0.8, metalness: 0.05 });
        const brass = this.metal(0xb8882f, 0.4, 0.85);
        const shadow = this.matte(0x0d0906, 0.98, 0);

        const group = new THREE.Group();
        group.position.set(BOOTH_X, 0, BOOTH_Z);

        const half = BOOTH_DEPTH / 2;
        const span = BOOTH_WIDTH / 2;
        const doorWidth = BOOTH_DOOR_WIDTH;
        const doorHeight = 2.68;
        const postWidth = (BOOTH_WIDTH - doorWidth * 2) / 3;

        const back = this.mesh(new THREE.BoxGeometry(0.18, BOOTH_HEIGHT, BOOTH_WIDTH), wood, [-half, BOOTH_HEIGHT / 2, 0]);
        group.add(back);

        for (const side of [-1, 1]) {
            const wall = this.mesh(new THREE.BoxGeometry(BOOTH_DEPTH, BOOTH_HEIGHT, 0.18), wood, [0, BOOTH_HEIGHT / 2, side * span]);
            group.add(wall);
        }

        // One dividing wall with a window in it: four slabs of the same panelling around
        // the opening read as a single wall, and the mesh screen in the opening is see
        // through, so the two of them can look at each other while they talk.
        const holeWidth = 0.86;
        const holeHeight = 0.66;
        const holeX = 0.12;
        const belowHeight = BOOTH_GRILLE_Y - holeHeight / 2;
        const aboveY = BOOTH_GRILLE_Y + holeHeight / 2;

        const below = this.mesh(new THREE.BoxGeometry(BOOTH_DEPTH, belowHeight, 0.18), panel, [0, belowHeight / 2, 0]);
        group.add(below);

        const above = this.mesh(
            new THREE.BoxGeometry(BOOTH_DEPTH, BOOTH_HEIGHT - aboveY, 0.18),
            panel,
            [0, aboveY + (BOOTH_HEIGHT - aboveY) / 2, 0]
        );
        group.add(above);

        for (const edge of [-1, 1]) {
            const inner = holeX + (edge * holeWidth) / 2;
            const outer = edge < 0 ? -BOOTH_DEPTH / 2 : BOOTH_DEPTH / 2;
            const width = Math.abs(outer - inner);
            const jamb = this.mesh(
                new THREE.BoxGeometry(width, holeHeight, 0.18),
                panel,
                [(inner + outer) / 2, BOOTH_GRILLE_Y, 0]
            );
            group.add(jamb);
        }

        const screen = this.mesh(
            new THREE.PlaneGeometry(holeWidth, holeHeight),
            this.textured(grilleTexture(this.bin), { roughness: 0.6, metalness: 0.3 }),
            [holeX, BOOTH_GRILLE_Y, 0]
        );
        const screenMaterial = screen.material as THREE.MeshStandardMaterial;
        screenMaterial.transparent = true;
        screenMaterial.alphaMap = screenMaterial.map;
        screenMaterial.side = THREE.DoubleSide;
        screenMaterial.depthWrite = false;
        screen.castShadow = false;
        screen.receiveShadow = false;
        group.add(screen);

        const roof = this.mesh(new THREE.BoxGeometry(BOOTH_DEPTH + 0.6, 0.34, BOOTH_WIDTH + 0.6), wood, [0, BOOTH_HEIGHT + 0.17, 0]);
        group.add(roof);

        const cornice = this.mesh(new THREE.BoxGeometry(BOOTH_DEPTH + 0.32, 0.16, BOOTH_WIDTH + 0.32), brass, [0, BOOTH_HEIGHT - 0.06, 0]);
        group.add(cornice);

        const shaft = this.mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), brass, [0, BOOTH_HEIGHT + 0.72, 0]);
        group.add(shaft);

        const crossBar = this.mesh(new THREE.BoxGeometry(0.12, 0.12, 0.52), brass, [0, BOOTH_HEIGHT + 0.96, 0]);
        group.add(crossBar);

        // Mullions of the aisle face, with the two door openings left clear.
        for (let i = 0; i < 3; i++) {
            const z = -span + postWidth / 2 + i * (postWidth + doorWidth);
            const post = this.mesh(new THREE.BoxGeometry(0.22, BOOTH_HEIGHT, postWidth), wood, [half, BOOTH_HEIGHT / 2, z]);
            group.add(post);
        }

        const lintel = this.mesh(
            new THREE.BoxGeometry(0.24, BOOTH_HEIGHT - doorHeight, BOOTH_WIDTH),
            wood,
            [half, doorHeight + (BOOTH_HEIGHT - doorHeight) / 2, 0]
        );
        group.add(lintel);

        for (const cell of ["penitent", "priest"] as BoothCell[]) {
            const z = boothCellZ(cell) - BOOTH_Z;

            // The cell is a real room you walk into — a solid block used to fill it,
            // which is why stepping through the door looked like walking into a wall.
            // Darkness comes from the floor panel and the dim lamp instead.
            const floor = this.mesh(
                new THREE.BoxGeometry(BOOTH_DEPTH - 0.24, 0.06, doorWidth + 0.14),
                shadow,
                [-0.06, 0.03, z]
            );
            group.add(floor);

            // A seat, not a shelf across the whole cell: he sits against the back wall
            // with room to step in front of it.
            const bench = this.mesh(new THREE.BoxGeometry(0.66, 0.14, doorWidth - 0.16), wood, [BOOTH_BENCH_X, BOOTH_SEAT_TOP - 0.07, z]);
            group.add(bench);

            for (const dz of [-0.32, 0.32]) {
                const leg = this.mesh(
                    new THREE.BoxGeometry(0.5, BOOTH_SEAT_TOP - 0.14, 0.12),
                    wood,
                    [BOOTH_BENCH_X, (BOOTH_SEAT_TOP - 0.14) / 2, z + dz]
                );
                group.add(leg);
            }

            const kneel = this.mesh(new THREE.BoxGeometry(0.5, 0.12, doorWidth - 0.3), wood, [half - 0.5, footRestY(BOOTH_SEAT_TOP), z]);
            group.add(kneel);

            const hingeSign = cell === "priest" ? 1 : -1;
            const hinge = new THREE.Group();
            hinge.position.set(half + 0.14, 0, z + (hingeSign * doorWidth) / 2);

            const leaf = this.mesh(new THREE.BoxGeometry(0.1, doorHeight, doorWidth), panel, [0.02, doorHeight / 2, (-hingeSign * doorWidth) / 2]);
            hinge.add(leaf);

            const trim = this.mesh(
                new THREE.BoxGeometry(0.05, doorHeight - 0.56, doorWidth - 0.36),
                brass,
                [0.09, doorHeight / 2, (-hingeSign * doorWidth) / 2]
            );
            hinge.add(trim);

            const knob = this.mesh(new THREE.SphereGeometry(0.07, 10, 8), brass, [0.13, 1.04, -hingeSign * (doorWidth - 0.24)]);
            hinge.add(knob);

            group.add(hinge);
            this.boothDoors.set(cell, { hinge, sign: hingeSign, angle: 0, target: 0 });
        }

        for (const cell of ["penitent", "priest"] as BoothCell[]) {
            const lamp = new THREE.PointLight(0xffb76a, cell === "priest" ? 7 : 5, 7, 2);
            lamp.position.set(-0.2, BOOTH_HEIGHT - 1, boothCellZ(cell) - BOOTH_Z);
            group.add(lamp);
        }

        const plate = this.board(
            this.tex.sign("confession", ["CONFESSION", "PAPER HANDS WELCOME"], { background: 0x1c1710, color: 0xf6e7c4, accent: 0x8c6b28 }),
            2,
            0.84,
            [half + 0.22, 3.42, 0],
            Math.PI / 2,
            { roughness: 0.9, metalness: 0.05, emissive: 0xffd489, emissiveIntensity: 0.22, oneSided: true }
        );
        group.add(plate);

        this.scene.add(group);
        this.booth = group;

        // Only the shell is solid: the two door openings stay clear so an actor (or the
        // player) can actually step inside.
        this.collisionGrid.insertOrientedBox(BOOTH_X - half, BOOTH_Z, 0.18, BOOTH_WIDTH, 0, 0, BOOTH_HEIGHT);
        for (const side of [-1, 1]) {
            this.collisionGrid.insertOrientedBox(BOOTH_X, BOOTH_Z + side * span, BOOTH_DEPTH, 0.18, 0, 0, BOOTH_HEIGHT);
        }
        this.collisionGrid.insertOrientedBox(BOOTH_X, BOOTH_Z, BOOTH_DEPTH, 0.2, 0, 0, BOOTH_HEIGHT);
        for (let i = 0; i < 3; i++) {
            const z = BOOTH_Z - span + postWidth / 2 + i * (postWidth + doorWidth);
            this.collisionGrid.insertOrientedBox(BOOTH_X + half, z, 0.22, postWidth, 0, 0, BOOTH_HEIGHT);
        }
    }

    // What the F8 scene director drives: the service timeline plus every actor in the
    // room, cast first so the scripted ones are the first thing you land on.
    public getDirectedScene(): DirectedScene | null {
        const timeline = this.service?.getTimeline();
        if (!timeline) return null;

        return {
            timeline,
            actors: () => {
                const list: DirectedActor[] = [];
                const scripted = new Set<ShowcaseActor>();

                for (const id of timeline.actorIds()) {
                    const actor = timeline.getActor(id);
                    if (!actor) continue;
                    list.push({ id, actor });
                    scripted.add(actor);
                }

                let index = 0;
                for (const actor of this.crowd.actors()) {
                    if (scripted.has(actor)) continue;
                    list.push({ id: `extra ${++index}`, actor });
                }

                return list;
            },
        };
    }

    // The story swings these: a door opens for whoever is stepping in, then shuts
    // behind them for the confession itself.
    public setBoothDoor(cell: BoothCell, open: boolean) {
        const door = this.boothDoors.get(cell);
        if (door) door.target = open ? -door.sign * BOOTH_DOOR_SWING : 0;
    }

    private buildRelicWall() {
        const plaqueGeometry = this.bin.geometry(new THREE.PlaneGeometry(2, 1));
        const frameGeometry = this.bin.geometry(new THREE.BoxGeometry(2.3, 1.3, 0.16));
        const frameMaterial = this.metal(0x6b5a34, 0.5, 0.75);

        for (let i = 0; i < RELICS.length; i++) {
            const side = i % 2 === 0 ? -1 : 1;
            const z = NAVE_START + 9.7 + Math.floor(i / 2) * 7.4;
            const x = side * (HALF_WIDTH - 0.95);

            const frame = new THREE.Mesh(frameGeometry, frameMaterial);
            frame.position.set(x, 3.4, z);
            frame.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
            this.scene.add(frame);

            const plaque = new THREE.Mesh(
                plaqueGeometry,
                this.decal(this.tex.sign(`relic${RELICS[i]}`, [RELICS[i], "RIP"], { background: 0x241c14, color: 0xd9c9a4, accent: 0x6b5a34, width: 512, height: 256 }), {
                    roughness: 0.85,
                    metalness: 0.1,
                })
            );
            plaque.position.set(x - side * 0.14, 3.4, z);
            plaque.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
            this.scene.add(plaque);
        }
    }

    private buildChandeliers() {
        const iron = this.matte(0x2b2620, 0.8, 0.4);

        for (let i = 0; i < 4; i++) {
            const z = -18 + i * 12;
            const group = new THREE.Group();
            group.position.set(0, 12.8, z);

            const chain = this.mesh(new THREE.CylinderGeometry(0.06, 0.06, 6, 6), iron, [0, 4.2, 0]);
            group.add(chain);

            const ring = this.mesh(new THREE.TorusGeometry(2.5, 0.12, 8, 24), iron, [0, 0, 0], [Math.PI / 2, 0, 0]);
            group.add(ring);

            const innerRing = this.mesh(new THREE.TorusGeometry(1.4, 0.09, 8, 20), iron, [0, 0.6, 0], [Math.PI / 2, 0, 0]);
            group.add(innerRing);

            for (let s = 0; s < 4; s++) {
                const angle = (s / 4) * Math.PI * 2;
                const spoke = this.mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6), iron, [Math.cos(angle) * 1.25, 0.3, Math.sin(angle) * 1.25], [0, -angle, Math.PI / 2.6]);
                group.add(spoke);
            }

            for (let c = 0; c < 10; c++) {
                const angle = (c / 10) * Math.PI * 2;
                const wax = this.mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.72, 8), this.matte(0xe8dcc0, 0.85), [Math.cos(angle) * 2.5, 0.5, Math.sin(angle) * 2.5]);
                group.add(wax);

                this.atmosphere?.addCandle(Math.cos(angle) * 2.5, 13.7, z + Math.sin(angle) * 2.5, 0.8);
            }

            const light = new THREE.PointLight(0xffb45a, 40, 34, 2);
            light.position.y = 0.6;
            group.add(light);
            this.candleLights.push(light);

            this.scene.add(group);
        }
    }

    // Standing dressing only: everyone here holds a fixed spot. The people who move,
    // speak or take part in the service are built by ChurchService instead, and the
    // seats it owns are skipped here so nobody shares a bench with a scripted actor.
    private buildCrowd() {
        const specs: CrowdSpec[] = [];
        const altarLook = new THREE.Vector3(0, 1.6, ALTAR_Z);
        const naveLook = new THREE.Vector3(0, 1.6, PULPIT_Z - 6);

        const reserved = new Set<string>();
        for (const seat of Object.values(STORY_SEATS)) reserved.add(seatKey(seat));

        for (const side of [-1, 1]) {
            specs.push({
                position: new THREE.Vector3(side * 4.4, 1.26, ALTAR_Z - 3.4),
                set: "clergy",
                variantIndex: 1,
                lookAt: naveLook,
                pose: "carry",
                held: "candle",
                heldLight: true,
                solid: false,
            });
        }

        for (const tier of CHOIR_TIERS) {
            for (let i = 0; i < 4; i++) {
                specs.push({
                    position: new THREE.Vector3(CHOIR_X - 2.7 + i * 1.8, tier.y, tier.z),
                    set: "clergy",
                    variantIndex: 1,
                    lookAt: naveLook,
                    pose: i % 2 === 0 ? "carry" : "pray",
                    held: "book",
                    heldHand: "left",
                    phase: this.random() * 10,
                    solid: false,
                });
            }
        }

        for (let row = 0; row < PEW_ROWS; row++) {
            const z = pewRowZ(row);

            for (const side of [-1, 1] as Array<-1 | 1>) {
                for (let seat = 0; seat < PEW_SEATS; seat++) {
                    if (reserved.has(seatKey({ row, side, seat }))) continue;
                    if (this.random() < 0.2) continue;

                    const x = pewSeatX(side, seat) + (this.random() - 0.5) * 0.3;
                    const slouch = this.random() < 0.3;

                    specs.push({
                        position: new THREE.Vector3(x, seatedActorY(SEAT_TOP), z + 0.1),
                        set: this.random() < 0.18 ? "mourner" : "flock",
                        facing: 0.02 + (this.random() - 0.5) * 0.22,
                        pose: slouch ? "sitSlouch" : (this.random() < 0.5 ? "sit" : "pray"),
                        held: this.random() < 0.34 ? "bag" : (this.random() < 0.3 ? "candle" : undefined),
                        heldLight: false,
                        phase: this.random() * 10,
                        solid: false,
                    });
                }
            }
        }

        // Candle table on the right, clear of the column at x = 10.25.
        for (let i = 0; i < 4; i++) {
            specs.push({
                position: new THREE.Vector3(9.1, 0, VOTIVE_Z - 1.6 + i * 1.1),
                set: i === 1 ? "mourner" : "flock",
                facing: Math.PI / 2,
                pose: i === 0 ? "work" : "mourn",
                held: i === 0 ? "candle" : undefined,
                heldLight: i === 0,
                phase: this.random() * 10,
            });
        }

        // Waiting their turn outside the confessional, in the pocket between the booth
        // and the pews.
        specs.push({
            position: new THREE.Vector3(-10.4, 0, BOOTH_Z + 1.6),
            set: "flock",
            lookAt: new THREE.Vector3(BOOTH_X, 1.4, BOOTH_Z),
            pose: "pray",
            phase: this.random() * 6,
            solid: false,
        });

        // Along the aisles, inside the columns rather than in the wall buttresses,
        // which is where these used to end up.
        for (let i = 0; i < 5; i++) {
            const side = i % 2 === 0 ? -1 : 1;
            specs.push({
                position: new THREE.Vector3(side * 9.4, 0, -12 + i * 7),
                set: "flock",
                lookAt: altarLook,
                pose: "pray",
                held: "candle",
                heldLight: i < 2,
                phase: this.random() * 10,
            });
        }

        for (let i = 0; i < 3; i++) {
            specs.push({
                position: new THREE.Vector3(-4.4 + i * 4.4, 0, NAVE_START + 7.5),
                set: "flock",
                lookAt: altarLook,
                pose: i === 1 ? "gawk" : "pray",
                phase: this.random() * 10,
            });
        }

        this.crowd.addMany(specs);
    }

    protected override timeScale(): number {
        return this.service?.getTimeline().isPaused() ? 0 : 1;
    }

    protected tick(delta: number): void {
        const camera = this.camera;
        if (camera) camera.getWorldPosition(this.cameraProbe);

        this.light?.update(delta, this.cameraProbe);

        if (this.censerBowl) {
            this.censerBowl.getWorldPosition(this.censerProbe);
            this.atmosphere?.setCenser(this.censerProbe);
        }

        this.atmosphere?.update(delta, this.cameraProbe);

        const flicker = 0.85 + Math.sin(this.elapsed * 7.3) * 0.08 + Math.sin(this.elapsed * 3.1) * 0.05;

        for (let i = 0; i < this.candleLights.length; i++) {
            const light = this.candleLights[i];
            light.intensity = (i < 2 ? 26 : 40) * (flicker + Math.sin(this.elapsed * 5 + i) * 0.06);
        }

        // Set, not eased: the story ramps this value itself, and an easing term here
        // would make the same scene frame look different depending on the scrub.
        this.roseGlow = this.roseGlowTarget;
        const roseBreath = 0.92 + Math.sin(this.elapsed * 0.7) * 0.08;
        const roseLevel = (ROSE_IDLE_GLOW + (ROSE_BLAZE_GLOW - ROSE_IDLE_GLOW) * this.roseGlow) * roseBreath;

        if (this.roseGlass) this.roseGlass.emissiveIntensity = roseLevel;
        if (this.roseFigure) this.roseFigure.emissiveIntensity = roseLevel * 1.4;
        if (this.roseBloom) this.roseBloom.opacity = 0.14 + this.roseGlow * 0.5;
        if (this.roseLight) this.roseLight.intensity = (22 + this.roseGlow * 150) * roseBreath;

        this.service?.update(delta);

        for (const door of this.boothDoors.values()) {
            if (Math.abs(door.target - door.angle) < 0.001) continue;
            door.angle += (door.target - door.angle) * Math.min(1, delta * BOOTH_DOOR_RATE);
            door.hinge.rotation.y = door.angle;
        }

        // A censer on a chain is a pendulum: T = 2*pi*sqrt(L/g), and two nearly equal
        // rates on the two axes make it precess the way a swung thurible does.
        if (this.censer) {
            const rate = Math.sqrt(9.81 / CENSER_DROP);
            this.censer.rotation.z = Math.sin(this.elapsed * rate) * 0.085;
            this.censer.rotation.x = Math.sin(this.elapsed * rate * 0.97 + 1.2) * 0.05;
        }

        for (let i = 0; i < this.banners.length; i++) {
            this.waveBoard(this.banners[i], this.elapsed * 0.7, 0.03, i);
        }

        for (let i = 0; i < this.chartCandles.length; i++) {
            this.chartCandles[i].position.y = this.chartBaseY[i] + Math.sin(this.elapsed * 1.6 + i * 0.5) * 0.06;
        }
    }

    dispose(): void {
        this.light?.dispose();
        this.atmosphere?.dispose();
        if (this.surfaces) disposeChurchSurfaces(this.surfaces);

        this.scene.environment = null;
        this.environment?.dispose();
        this.environment = null;

        this.light = null;
        this.atmosphere = null;
        this.surfaces = null;
        this.shaftSpecs = [];
        this.censerBowl = null;
        this.candleLights = [];
        this.banners = [];
        this.chartCandles = [];
        this.chartBaseY = [];
        this.rose = null;
        this.roseGlass = null;
        this.roseFigure = null;
        this.roseFigureMesh = null;
        this.roseBloom = null;
        this.roseLight = null;
        this.roseGlow = 0;
        this.roseGlowTarget = 0;
        this.censer = null;
        this.booth = null;
        this.boothDoors.clear();
        this.service?.dispose();
        this.service = null;

        super.dispose();
    }
}
