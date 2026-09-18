// src/features/game/world/locations/showcase/rooms/GraveyardRoom.ts
import * as THREE from "three";
import { ShowcaseRoom } from "../ShowcaseRoom";
import { ResourceManager } from "../../../../core/ResourceManager";
import { SHOWCASE_INFO_BY_ID, ShowcaseInfo } from "../config";
import { CrowdSpec } from "../actors/ShowcaseCrowd";
import { createNpcNameTag } from "../../../../entities/npcNameTag";
import type { ShowcaseActor } from "../actors/ShowcaseActor";
import { KNEEL_DROP } from "../actors/poses";
import { isRainEnabled } from "../rainVisibility";

const YARD_RADIUS = 66;
const MONUMENT_Z = 34;
const WISP_COUNT = 22;
const MAX_CANDLE_LIGHTS = 24;

const MAUSOLEUM = new THREE.Vector3(-28, 0, 12);
const FRESH_GRAVE = new THREE.Vector3(15, 0, -9);
const JOHNNY_GRAVE = new THREE.Vector3(-4.6, 0, -22);

const LIGHTNING_MIN_GAP = 18;
const LIGHTNING_MAX_GAP = 42;
const LIGHTNING_FLASH_DURATION = 0.14;
const LIGHTNING_GAP_DURATION = 0.1;
const LIGHTNING_SECOND_DURATION = 0.22;

const DEAD_TICKERS: Array<[string, string]> = [
    ["$MOONZ", "DEV WENT DARK"],
    ["$SAFU", "NOT SO SAFU"],
    ["$LUNC", "-99.99% IN A WEEK"],
    ["$RUGME", "IT SAID SO"],
    ["$PEPE2", "THE SEQUEL NOBODY WANTED"],
    ["$ELONX", "ONE TWEET, ONE GRAVE"],
    ["$HODLR", "HELD ALL THE WAY DOWN"],
    ["$DOGE9", "NINE LIVES, ZERO LIQUIDITY"],
    ["$GEMZ", "100x GUARANTEED"],
    ["$APE3", "APED IN AT THE TOP"],
    ["$WOJAK", "HE KNEW, HE BOUGHT ANYWAY"],
    ["$FOMO", "BOUGHT THE GREEN CANDLE"],
    ["$BONKZ", "LP PULLED AT 03:14"],
    ["$SHIBX", "1 000 000 HOLDERS, 0 BUYERS"],
    ["$MOG2", "PRESALE ONLY"],
    ["$LAMBO", "STILL TAKING THE BUS"],
];

interface Wisp {
    mesh: THREE.Mesh;
    light: THREE.PointLight | null;
    center: THREE.Vector3;
    radius: number;
    speed: number;
    phase: number;
    height: number;
}

interface MistLayer {
    mesh: THREE.Mesh;
    centerX: number;
    centerZ: number;
    driftRadius: number;
    driftSpeed: number;
    phase: number;
    baseOpacity: number;
}

type LightningPhase = "idle" | "flashA" | "gap" | "flashB";

export class GraveyardRoom extends ShowcaseRoom {
    private wisps: Wisp[] = [];
    private candleMaterials: THREE.Material[] = [];
    private candleLights: THREE.PointLight[] = [];
    private mist: MistLayer[] = [];
    private crows: THREE.Object3D[] = [];
    private coffin: THREE.Object3D | null = null;
    private widow: ShowcaseActor | null = null;
    private friend: ShowcaseActor | null = null;
    private rain: THREE.Points | null = null;

    private moonLight: THREE.DirectionalLight | null = null;
    private ambientLight: THREE.AmbientLight | null = null;
    private skyColor: THREE.Color | null = null;
    private skyBase = 0x0b1018;
    private lightningPhase: LightningPhase = "idle";
    private lightningTimer = LIGHTNING_MIN_GAP;
    private lightningStep = 0;
    private moonBaseIntensity = 1.1;
    private ambientBaseIntensity = 0.7;
    private lightningBoltMesh: THREE.Mesh | null = null;
    private lightningBoltMaterial: THREE.MeshBasicMaterial | null = null;
    private lightningGlow: THREE.Sprite | null = null;
    private lightningGlowMaterial: THREE.SpriteMaterial | null = null;

    constructor(info: ShowcaseInfo = SHOWCASE_INFO_BY_ID.get("show-graveyard") as ShowcaseInfo) {
        super(info, 0x7b21a9, 64);
        this.exitPosition.set(0, 0, -42);
        this.exitFacing = 0;
        this.spawnPosition.set(0, 0, -34);
    }

    protected buildAtmosphere(): void {
        this.skyColor = new THREE.Color(this.skyBase);
        this.scene.background = this.skyColor;
        this.scene.fog = new THREE.FogExp2(0x10161f, 0.017);

        const ambient = new THREE.AmbientLight(0x28324a, this.ambientBaseIntensity);
        this.scene.add(ambient);
        this.ambientLight = ambient;

        this.scene.add(new THREE.HemisphereLight(0x3b4a6b, 0x0c1016, 0.75));

        const moon = new THREE.DirectionalLight(0xb8cdf2, this.moonBaseIntensity);
        moon.position.set(34, 58, -46);
        moon.target.position.set(0, 0, 10);
        moon.castShadow = true;
        moon.shadow.mapSize.set(2048, 2048);
        moon.shadow.camera.left = -60;
        moon.shadow.camera.right = 60;
        moon.shadow.camera.top = 60;
        moon.shadow.camera.bottom = -60;
        moon.shadow.camera.near = 5;
        moon.shadow.camera.far = 200;
        moon.shadow.bias = -0.0004;
        moon.shadow.normalBias = 0.05;
        moon.shadow.camera.updateProjectionMatrix();
        this.scene.add(moon);
        this.scene.add(moon.target);
        this.moonLight = moon;

        const moonDisc = this.mesh(
            new THREE.CircleGeometry(11, 32),
            this.bin.material(new THREE.MeshBasicMaterial({ color: 0xdfe9ff, fog: false, toneMapped: false })),
            [58, 76, -120]
        );
        moonDisc.castShadow = false;
        moonDisc.lookAt(0, 0, 0);
        this.scene.add(moonDisc);

        const moonHalo = this.mesh(new THREE.CircleGeometry(22, 32), this.glow(0x9ec6ff, 0.16), [57, 75, -118]);
        moonHalo.castShadow = false;
        moonHalo.lookAt(0, 0, 0);
        this.scene.add(moonHalo);

        const rim = new THREE.PointLight(0x6a8fd8, 60, 160, 2);
        rim.position.set(0, 30, 60);
        this.scene.add(rim);

        this.buildSkyDome();
        this.buildMoonShafts();
        this.buildLightningRig();
    }

    private buildSkyDome(): void {
        const skyTexture = this.tex.nightSky("graveyard", 0x05070c, 0x171d28, 0x2a3548);
        const domeMaterial = this.bin.material(new THREE.MeshBasicMaterial({
            map: skyTexture,
            side: THREE.BackSide,
            fog: false,
            toneMapped: false,
            depthWrite: false,
        }));
        const dome = new THREE.Mesh(this.bin.geometry(new THREE.SphereGeometry(280, 24, 16)), domeMaterial);
        dome.rotation.y = Math.PI * 0.3;
        dome.renderOrder = -1;
        dome.castShadow = false;
        dome.receiveShadow = false;
        this.scene.add(dome);
    }

    private buildLightningRig(): void {
        const boltMaterial = this.bin.material(new THREE.MeshBasicMaterial({
            color: 0xe8f0ff,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            depthTest: false,
            toneMapped: false,
            fog: false,
        }));
        this.lightningBoltMaterial = boltMaterial;

        const placeholder = new THREE.Mesh(this.bin.geometry(new THREE.BufferGeometry()), boltMaterial);
        placeholder.frustumCulled = false;
        placeholder.renderOrder = 6;
        placeholder.castShadow = false;
        placeholder.receiveShadow = false;
        this.scene.add(placeholder);
        this.lightningBoltMesh = placeholder;

        const glowTexture = this.tex.radialGlow("boltglow", 0xd8e6ff);
        const glowMaterial = this.bin.material(new THREE.SpriteMaterial({
            map: glowTexture,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            fog: false,
        }));
        this.lightningGlowMaterial = glowMaterial;

        const glow = new THREE.Sprite(glowMaterial);
        glow.scale.setScalar(90);
        glow.renderOrder = 5;
        this.scene.add(glow);
        this.lightningGlow = glow;

        this.randomizeLightningBolt();
    }

    private randomizeLightningBolt(): void {
        const mesh = this.lightningBoltMesh;
        if (!mesh) return;

        const angle = this.random() * Math.PI * 2;
        const distance = 150 + this.random() * 50;
        const topY = 140 + this.random() * 40;
        const originX = Math.cos(angle) * distance;
        const originZ = Math.sin(angle) * distance;

        const segments = 9;
        const points: THREE.Vector3[] = [];
        let x = originX;
        let z = originZ;
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const y = topY - t * (topY - 18);
            points.push(new THREE.Vector3(x, y, z));
            x += (this.random() - 0.5) * 16 * (1 - t * 0.5);
            z += (this.random() - 0.5) * 7;
        }

        const curve = new THREE.CatmullRomCurve3(points);
        const geometry = new THREE.TubeGeometry(curve, 24, 0.65, 5, false);
        mesh.geometry.dispose();
        mesh.geometry = geometry;

        this.lightningGlow?.position.set(originX, topY * 0.55, originZ);
    }

    private buildMoonShafts(): void {
        const shaftTexture = this.tex.radialGlow("moonshaft", 0xbfe0ff);
        const shaftMaterial = this.bin.material(new THREE.MeshBasicMaterial({
            map: shaftTexture,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            opacity: 0.16,
            fog: false,
        }));

        const moonDir = new THREE.Vector3(34, 58, -46).normalize();
        const spots: Array<[number, number, number]> = [
            [-18, 0, -6],
            [10, 0, 14],
            [-30, 0, 22],
            [22, 0, -18],
        ];

        for (const [x, y, z] of spots) {
            const shaft = new THREE.Mesh(
                this.bin.geometry(new THREE.ConeGeometry(6.5, 46, 16, 1, true)),
                shaftMaterial
            );
            shaft.position.set(x, y + 23, z);
            shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), moonDir);
            shaft.castShadow = false;
            shaft.receiveShadow = false;
            shaft.renderOrder = 1;
            this.scene.add(shaft);
        }
    }

    protected decorate(rm: ResourceManager): void {
        this.buildGround();
        this.buildFence();
        this.buildLampPosts();
        this.buildGraves();
        this.buildJohnnyGrave();
        this.buildMausoleum();
        this.buildFreshGrave();
        this.buildNoticeBoard();
        this.buildMonument();
        this.buildTrees();
        this.buildMist();
        this.buildWisps();
        this.buildRain();
        this.buildCrowd();
        this.buildWake(rm);
    }

    private buildWake(rm: ResourceManager) {
        const grave = new THREE.Vector3(2.4, 0, 12);

        const stone = this.mesh(
            new THREE.BoxGeometry(1.8, 2.4, 0.36),
            this.textured(this.tex.granite([1, 2], 0x5f646d), { roughness: 0.92, metalness: 0.06, bump: 0.06 }),
            [grave.x, 1.2, grave.z],
            [0.04, 0.1, 0.02]
        );
        this.scene.add(stone);

        const plate = this.mesh(
            new THREE.PlaneGeometry(1.4, 0.7),
            this.decal(this.tex.sign("wake", ["$HOPIUM", "HE BELIEVED"], { background: 0x2b2f36, color: 0xc8d2e0, accent: 0x6a7a94, width: 512, height: 256 }), { roughness: 0.88, metalness: 0.1 }),
            [grave.x, 1.5, grave.z + 0.24],
            [0.04, 0.1, 0.02]
        );
        plate.castShadow = false;
        this.scene.add(plate);

        const base = this.mesh(new THREE.BoxGeometry(2.2, 0.3, 1), this.matte(0x3a3f48, 0.94), [grave.x, 0.15, grave.z + 0.1]);
        this.scene.add(base);
        this.collisionGrid.insertOrientedBox(grave.x, grave.z, 2.2, 1, 0, 0, 2.4);

        const widow = this.crowd.createActor(rm, {
            position: new THREE.Vector3(grave.x - 0.3, -KNEEL_DROP, grave.z + 2.1),
            set: "mourner",
            variantIndex: 1,
            facing: Math.PI,
            pose: "kneel",
            held: "rose",
            accent: 0xc2342f,
            phase: 1.8,
            solid: false,
        }, this.collisionGrid);

        const friend = this.crowd.createActor(rm, {
            position: new THREE.Vector3(grave.x + 1.15, 0, grave.z + 2.5),
            set: "mourner",
            variantIndex: 0,
            facing: Math.PI - 0.5,
            pose: "comfort",
            accent: 0x9ec6ff,
            phase: 3.1,
            solid: false,
        }, this.collisionGrid);

        if (!widow || !friend) return;
        this.widow = widow;
        this.friend = friend;

        const cry = this.bubble("IT WAS MY RENT", "#ff8f8f", { width: 3.2, y: 2.1, speaker: widow });
        const sob = this.bubble("WHY", "#ff8f8f", { width: 1.6, tone: "shout", y: 2.1, speaker: widow });
        widow.group.add(cry);
        widow.group.add(sob);

        const support = this.bubble("IT'S JUST A DIP", "#9ec6ff", { width: 3.2, y: 2.9, speaker: friend });
        const truth = this.bubble("WE'RE ALL GONNA MAKE IT", "#7ce8a8", { width: 4, y: 2.9, speaker: friend });
        friend.group.add(support);
        friend.group.add(truth);

        this.addStory([
            {
                duration: 5,
                enter: () => {
                    cry.visible = true;
                    sob.visible = false;
                    support.visible = false;
                    truth.visible = false;
                    widow.setPose("kneel");
                },
            },
            {
                duration: 4,
                enter: () => {
                    cry.visible = false;
                    support.visible = true;
                    friend.setPose("comfort");
                },
            },
            {
                duration: 3,
                enter: () => {
                    support.visible = false;
                    sob.visible = true;
                    widow.setPose("grieve");
                },
            },
            {
                duration: 5,
                enter: () => {
                    sob.visible = false;
                    truth.visible = true;
                },
            },
            {
                duration: 4,
                enter: () => {
                    truth.visible = false;
                    widow.setPose("kneel");
                },
            },
        ]);
    }

    private buildGround() {
        const soil = this.textured(this.tex.dirt(6, 0x232a25, 0x424a3e), { roughness: 0.98, metalness: 0.01, bump: 0.06 });
        const grass = this.textured(this.tex.grass(26, 0x2c3a2e, 0x3f5540), { roughness: 0.98, metalness: 0.01, bump: 0.04 });
        const gravel = this.textured(this.tex.dirt([2, 20], 0x2e3136, 0x585c64), { roughness: 0.96, metalness: 0.02, bump: 0.05 });

        const field = this.mesh(new THREE.CircleGeometry(YARD_RADIUS + 16, 56), grass, [0, 0, 0], [-Math.PI / 2, 0, 0]);
        field.castShadow = false;
        this.scene.add(field);

        const path = this.mesh(new THREE.PlaneGeometry(6, 90), gravel, [0, 0.05, -2], [-Math.PI / 2, 0, 0]);
        path.castShadow = false;
        this.scene.add(path);

        for (let i = 0; i < 28; i++) {
            const angle = this.random() * Math.PI * 2;
            const distance = this.random() * YARD_RADIUS;
            const mound = this.mesh(
                new THREE.SphereGeometry(0.6 + this.random() * 0.7, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
                soil,
                [Math.cos(angle) * distance, 0.025, Math.sin(angle) * distance]
            );
            mound.scale.y = 0.12;
            mound.castShadow = false;
            mound.receiveShadow = true;
            this.scene.add(mound);
        }

        this.collisionGrid.insertRingWall(YARD_RADIUS + 2, 2, 0, 8);
    }

    private buildFence() {
        const iron = this.metal(0x2a2e36, 0.62, 0.72);
        const bar = this.bin.geometry(new THREE.CylinderGeometry(0.07, 0.07, 3.1, 6));
        const spike = this.bin.geometry(new THREE.ConeGeometry(0.11, 0.34, 6));

        const segments = 120;
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = Math.sin(angle) * (YARD_RADIUS + 1);
            const z = Math.cos(angle) * (YARD_RADIUS + 1);
            if (Math.abs(x) < 5 && z < -YARD_RADIUS + 4) continue;

            const post = new THREE.Mesh(bar, iron);
            post.position.set(x, 1.55, z);
            post.castShadow = true;
            this.scene.add(post);

            const tip = new THREE.Mesh(spike, iron);
            tip.position.set(x, 3.25, z);
            this.scene.add(tip);
        }

        for (const height of [1.1, 2.5]) {
            const rail = this.mesh(new THREE.TorusGeometry(YARD_RADIUS + 1, 0.06, 5, 90), iron, [0, height, 0], [-Math.PI / 2, 0, 0]);
            this.scene.add(rail);
        }
    }

    private buildGraves() {
        const moss = 0x4a6b46;
        const stone = this.textured(this.tex.weatheredGranite([1, 2], 0x5a5f68, moss), { roughness: 0.92, metalness: 0.06, bump: 0.06 });
        const stoneDark = this.textured(this.tex.weatheredGranite([1, 2], 0x424750, moss), { roughness: 0.93, metalness: 0.05, bump: 0.06 });
        const mossy = this.textured(this.tex.weatheredGranite([1, 2], 0x4a5450, 0x5c7a52), { roughness: 0.95, metalness: 0.04, bump: 0.07 });
        const tones = [stone, stoneDark, mossy];
        const plinthTone = this.textured(this.tex.weatheredGranite(1, 0x3a3f48, moss), { roughness: 0.94, metalness: 0.05 });

        const plinthGeo = this.bin.geometry(new THREE.BoxGeometry(2, 0.28, 0.9));
        const tabletGeo = this.bin.geometry(new THREE.BoxGeometry(1.5, 1.9, 0.32));
        const archBodyGeo = this.bin.geometry(new THREE.BoxGeometry(1.5, 1.5, 0.32));
        const archCapGeo = this.bin.geometry(new THREE.SphereGeometry(0.78, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2));
        const wideGeo = this.bin.geometry(new THREE.BoxGeometry(1.8, 1.5, 0.36));
        const pedimentBodyGeo = this.bin.geometry(new THREE.BoxGeometry(1.6, 1.7, 0.34));
        const pedimentCapGeo = this.bin.geometry(new THREE.ConeGeometry(1.16, 0.6, 4));
        const crossBaseGeo = this.bin.geometry(new THREE.BoxGeometry(1.2, 1.0, 0.32));
        const crossVGeo = this.bin.geometry(new THREE.BoxGeometry(0.24, 1.4, 0.22));
        const crossHGeo = this.bin.geometry(new THREE.BoxGeometry(0.86, 0.22, 0.2));

        type GraveShape = (tone: THREE.Material) => THREE.Object3D;

        const shapes: GraveShape[] = [
            (tone) => {
                const mesh = new THREE.Mesh(tabletGeo, tone);
                mesh.position.y = 0.95;
                return mesh;
            },
            (tone) => {
                const group = new THREE.Group();
                const body = new THREE.Mesh(archBodyGeo, tone);
                body.position.y = 0.75;
                group.add(body);
                const cap = new THREE.Mesh(archCapGeo, tone);
                cap.scale.set(1, 1, 0.42);
                cap.position.set(0, 1.45, 0);
                group.add(cap);
                return group;
            },
            (tone) => {
                const mesh = new THREE.Mesh(wideGeo, tone);
                mesh.position.y = 1.05;
                return mesh;
            },
            (tone) => {
                const group = new THREE.Group();
                const body = new THREE.Mesh(pedimentBodyGeo, tone);
                body.position.y = 0.95;
                group.add(body);
                const cap = new THREE.Mesh(pedimentCapGeo, tone);
                cap.position.y = 0.95 + 0.85 + 0.3 - 0.06;
                group.add(cap);
                return group;
            },
            (tone) => {
                const group = new THREE.Group();
                const base = new THREE.Mesh(crossBaseGeo, tone);
                base.position.y = 0.5;
                group.add(base);
                const vertical = new THREE.Mesh(crossVGeo, tone);
                vertical.position.y = 1.55;
                group.add(vertical);
                const horizontal = new THREE.Mesh(crossHGeo, tone);
                horizontal.position.y = 1.9;
                group.add(horizontal);
                return group;
            },
        ];

        let tickerIndex = 0;
        const columnsPerBlock = 3;
        const columnSpacing = 4.2;
        const laneWidth = 2.8;

        const keepClearOf: Array<[number, number, number]> = [
            [MAUSOLEUM.x, MAUSOLEUM.z, 8.5],
            [FRESH_GRAVE.x, FRESH_GRAVE.z, 5.5],
            [JOHNNY_GRAVE.x, JOHNNY_GRAVE.z, 4],
        ];
        const inExclusionZone = (x: number, z: number) =>
            keepClearOf.some(([cx, cz, radius]) => Math.hypot(x - cx, z - cz) < radius);

        for (let row = 0; row < 9; row++) {
            for (let column = 0; column < 14; column++) {
                const side = column < 7 ? -1 : 1;
                const localColumn = column % 7;
                const block = Math.floor(localColumn / columnsPerBlock);
                const withinBlock = localColumn % columnsPerBlock;
                const x = side * (
                    5.4 +
                    block * (columnsPerBlock * columnSpacing + laneWidth) +
                    withinBlock * columnSpacing +
                    (this.random() - 0.5) * 0.7
                );
                const z = -18 + row * 5.4 + (this.random() - 0.5) * 1.3;

                if (inExclusionZone(x, z)) continue;

                const tilt = (this.random() - 0.5) * 0.24;
                const yaw = (this.random() - 0.5) * 0.5;

                const shapeFn = shapes[Math.floor(this.random() * shapes.length)];
                const tone = tones[Math.floor(this.random() * tones.length)];
                const grave = shapeFn(tone);
                grave.position.x = x;
                grave.position.z = z;
                grave.rotation.set(tilt, yaw, tilt * 0.6);
                grave.traverse((child) => {
                    const childMesh = child as THREE.Mesh;
                    if (!childMesh.isMesh) return;
                    childMesh.castShadow = true;
                    childMesh.receiveShadow = true;
                });
                this.scene.add(grave);

                const base = new THREE.Mesh(plinthGeo, plinthTone);
                base.position.set(x, 0.14, z);
                base.receiveShadow = true;
                this.scene.add(base);

                this.collisionGrid.insertOrientedBox(x, z, 2, 0.9, 0, 0, 2.3);

                if (this.random() < 0.72) {
                    const [ticker, years] = DEAD_TICKERS[tickerIndex % DEAD_TICKERS.length];
                    const engraving = this.decal(
                        this.tex.sign(`grave${ticker}`, [ticker, years], { background: 0x2b2f36, color: 0xc8d2e0, accent: 0x6a7a94, width: 512, height: 256 }),
                        { roughness: 0.88, metalness: 0.1 }
                    );
                    const label = this.mesh(new THREE.PlaneGeometry(1.15, 0.58), engraving, [x, 1.35, z + 0.22]);
                    label.rotation.set(tilt, yaw, tilt * 0.6);
                    label.castShadow = false;
                    this.scene.add(label);
                    tickerIndex++;
                }

                if (this.random() < 0.5) {
                    this.buildMemorialCandle(x + 0.9, z + 0.7, 0.4 + this.random() * 0.22);
                }
            }
        }
    }

    private buildFlame(
        parent: THREE.Object3D,
        position: THREE.Vector3,
        options: { color: number; tipColor?: number; lightColor: number; intensity: number; scale?: number; forceLight?: boolean }
    ): void {
        const scale = options.scale ?? 1;

        const outerMaterial = this.glow(options.color, 0.92);
        this.candleMaterials.push(outerMaterial);
        const outer = new THREE.Mesh(new THREE.ConeGeometry(0.1 * scale, 0.32 * scale, 8), outerMaterial);
        outer.position.copy(position);
        outer.castShadow = false;
        parent.add(outer);

        const tipMaterial = this.glow(options.tipColor ?? 0xfff2c8, 0.95);
        this.candleMaterials.push(tipMaterial);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045 * scale, 0.16 * scale, 8), tipMaterial);
        tip.position.set(position.x, position.y + 0.1 * scale, position.z);
        tip.castShadow = false;
        parent.add(tip);

        const haloTexture = this.tex.radialGlow(`flame${options.color.toString(16)}`, options.color);
        const haloMaterial = this.bin.material(new THREE.SpriteMaterial({
            map: haloTexture,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            opacity: 0.7,
        }));
        this.candleMaterials.push(haloMaterial);
        const halo = new THREE.Sprite(haloMaterial);
        halo.scale.setScalar(0.55 * scale);
        halo.position.set(position.x, position.y + 0.05 * scale, position.z);
        parent.add(halo);

        if (options.forceLight || this.candleLights.length < MAX_CANDLE_LIGHTS) {
            const light = new THREE.PointLight(options.lightColor, options.intensity, options.intensity, 2);
            light.position.copy(position);
            parent.add(light);
            this.candleLights.push(light);
        }
    }

    private buildMemorialCandle(x: number, z: number, height = 0.5, forceLight = false): void {
        const dish = this.mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.06, 12), this.matte(0x2a2e36, 0.7), [x, 0.03, z]);
        this.scene.add(dish);

        const wax = this.mesh(new THREE.CylinderGeometry(0.14, 0.17, height, 10), this.lit(0xc2342f, 0.4), [x, 0.06 + height / 2, z]);
        this.scene.add(wax);

        const glassMaterial = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0xffb08a,
            roughness: 0.15,
            metalness: 0.05,
            transparent: true,
            opacity: 0.26,
            side: THREE.DoubleSide,
        }));
        const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, height + 0.14, 12, 1, false), glassMaterial);
        glass.position.set(x, 0.09 + height / 2, z);
        glass.castShadow = false;
        this.scene.add(glass);

        const wick = this.mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 5), this.matte(0x14100c, 0.8), [x, 0.06 + height + 0.03, z]);
        wick.castShadow = false;
        this.scene.add(wick);

        this.buildFlame(this.scene, new THREE.Vector3(x, 0.06 + height + 0.12, z), {
            color: 0xff4a4a,
            tipColor: 0xffd9a0,
            lightColor: 0xff5a4a,
            intensity: 12,
            forceLight,
        });
    }

    private buildJohnnyGrave(): void {
        const tone = this.textured(this.tex.weatheredGranite(1, 0x565b64, 0x4a6b46), { roughness: 0.9, metalness: 0.07, bump: 0.07 });

        const group = new THREE.Group();
        group.position.set(JOHNNY_GRAVE.x, 0, JOHNNY_GRAVE.z);
        group.rotation.y = 0.12;

        const plinth = new THREE.Mesh(this.bin.geometry(new THREE.BoxGeometry(1.7, 0.24, 1.05)), tone);
        plinth.position.y = 0.12;
        plinth.receiveShadow = true;
        group.add(plinth);

        const base = new THREE.Mesh(this.bin.geometry(new THREE.BoxGeometry(1.35, 1.05, 0.34)), tone);
        base.position.y = 0.525;
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        const vertical = new THREE.Mesh(this.bin.geometry(new THREE.BoxGeometry(0.28, 1.4, 0.24)), tone);
        vertical.position.y = 1.55;
        vertical.castShadow = true;
        group.add(vertical);

        const horizontal = new THREE.Mesh(this.bin.geometry(new THREE.BoxGeometry(0.94, 0.24, 0.2)), tone);
        horizontal.position.y = 1.9;
        horizontal.castShadow = true;
        group.add(horizontal);

        const plateSkin = this.decal(
            this.tex.sign("johnnygrave", ["$JOHNNY", "2021-2026"], { background: 0x2b2f36, color: 0xffd9a0, accent: 0x8f5f2f, width: 512, height: 320 }),
            { roughness: 0.86, metalness: 0.1 }
        );
        const plate = new THREE.Mesh(this.bin.geometry(new THREE.PlaneGeometry(1.05, 0.66)), plateSkin);
        plate.position.set(0, 0.62, 0.19);
        plate.castShadow = false;
        group.add(plate);

        this.scene.add(group);
        this.collisionGrid.insertOrientedBox(JOHNNY_GRAVE.x, JOHNNY_GRAVE.z, 1.7, 1.1, group.rotation.y, 0, 2.3);

        this.buildMemorialCandle(JOHNNY_GRAVE.x + 0.85, JOHNNY_GRAVE.z + 0.35, 0.52, true);
    }

    private buildMausoleum() {
        const stone = this.textured(this.tex.stoneBlock([3, 2], 0x4e535c, 0x2f333a, 5), { roughness: 0.94, metalness: 0.05, bump: 0.08 });
        const trim = this.textured(this.tex.granite([2, 1], 0x6b707a), { roughness: 0.82, metalness: 0.1, bump: 0.05 });
        const iron = this.metal(0x22262c, 0.55, 0.78);

        const group = new THREE.Group();
        group.position.set(MAUSOLEUM.x, 0, MAUSOLEUM.z);
        group.rotation.y = Math.PI / 2.6;

        const base = this.mesh(new THREE.BoxGeometry(9.4, 0.8, 7.4), trim, [0, 0.4, 0]);
        group.add(base);

        const body = this.mesh(new THREE.BoxGeometry(8, 5.4, 6), stone, [0, 3.5, 0]);
        group.add(body);

        const cornice = this.mesh(new THREE.BoxGeometry(8.8, 0.6, 6.8), trim, [0, 6.5, 0]);
        group.add(cornice);

        const roof = this.mesh(new THREE.ConeGeometry(6.4, 2.6, 4), trim, [0, 8.1, 0], [0, Math.PI / 4, 0]);
        group.add(roof);

        const finial = this.mesh(new THREE.OctahedronGeometry(0.6, 0), iron, [0, 9.8, 0]);
        group.add(finial);

        for (const dx of [-2.6, 2.6]) {
            const column = this.mesh(new THREE.CylinderGeometry(0.45, 0.5, 4.6, 12), trim, [dx, 3.1, 3.1]);
            group.add(column);

            const cap = this.mesh(new THREE.BoxGeometry(1.3, 0.4, 1.3), trim, [dx, 5.5, 3.1]);
            group.add(cap);
        }

        const doorway = this.mesh(new THREE.BoxGeometry(2.6, 3.8, 0.4), this.matte(0x0d1014, 0.98, 0), [0, 2.7, 3.05]);
        group.add(doorway);

        for (let i = 0; i < 7; i++) {
            const bar = this.mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.6, 6), iron, [-1.1 + i * 0.37, 2.7, 3.24]);
            group.add(bar);
        }

        const plaqueSkin = this.decal(
            this.tex.sign("crypt", ["$LUNA", "40B GONE · 2022"], { background: 0x1a1d22, color: 0xcfd8e8, accent: 0x6a7a94 }),
            { roughness: 0.82, metalness: 0.14, emissive: 0x6a7a94, emissiveIntensity: 0.2 }
        );
        const plaque = this.mesh(new THREE.PlaneGeometry(3.4, 1.35), plaqueSkin, [0, 5.4, 3.3]);
        plaque.castShadow = false;
        group.add(plaque);

        for (const dx of [-3.4, 3.4]) {
            const bowl = this.mesh(new THREE.CylinderGeometry(0.42, 0.28, 0.5, 10), iron, [dx, 1.05, 3.6]);
            group.add(bowl);

            this.buildFlame(group, new THREE.Vector3(dx, 1.75, 3.6), {
                color: 0x5fc8ff,
                tipColor: 0xeaf8ff,
                lightColor: 0x7fd8ff,
                intensity: 16,
                scale: 1.9,
                forceLight: true,
            });
        }

        this.scene.add(group);
        this.collisionGrid.insertOrientedBox(MAUSOLEUM.x, MAUSOLEUM.z, 9.4, 7.4, Math.PI / 2.6, 0, 6.5);
    }

    private buildFreshGrave() {
        const soil = this.textured(this.tex.dirt(3, 0x3a3128, 0x6b6052), { roughness: 0.98, metalness: 0.01, bump: 0.07 });
        const wood = this.textured(this.tex.planks([2, 1], 0x4a3a28, 0x261c12, 5), { roughness: 0.92, metalness: 0.03, bump: 0.05 });
        const iron = this.metal(0x2a2e36, 0.6, 0.7);

        const group = new THREE.Group();
        group.position.set(FRESH_GRAVE.x, 0, FRESH_GRAVE.z);

        const pit = this.mesh(new THREE.BoxGeometry(2.6, 2.4, 5.2), this.matte(0x0c0f12, 0.99, 0), [0, -1.2, 0]);
        pit.castShadow = false;
        group.add(pit);

        for (const side of [-1, 1]) {
            const wall = this.mesh(new THREE.BoxGeometry(0.4, 0.5, 5.6), soil, [side * 1.5, 0.12, 0]);
            group.add(wall);
        }

        const mound = this.mesh(new THREE.SphereGeometry(2.4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), soil, [3.4, 0.03, 0.6]);
        mound.scale.y = 0.42;
        group.add(mound);

        const coffin = new THREE.Group();
        coffin.position.set(0, 0.62, 0);

        const lid = this.mesh(new THREE.BoxGeometry(1.7, 0.16, 4.4), wood, [0, 0.52, 0]);
        coffin.add(lid);

        const box = this.mesh(new THREE.BoxGeometry(1.6, 0.9, 4.3), wood, [0, 0, 0]);
        coffin.add(box);

        const emblemSkin = this.decal(
            this.tex.emblem("coffin", "skull", 0x3a2c1c, 0xcfd8e8),
            { roughness: 0.8, metalness: 0.12, emissive: 0x6a7a94, emissiveIntensity: 0.12 }
        );
        const emblem = this.mesh(new THREE.PlaneGeometry(1.1, 1.1), emblemSkin, [0, 0.63, -0.6], [-Math.PI / 2, 0, 0]);
        emblem.castShadow = false;
        coffin.add(emblem);

        for (const dz of [-1.5, 1.5]) {
            for (const side of [-1, 1]) {
                const handle = this.mesh(new THREE.TorusGeometry(0.16, 0.04, 5, 10), iron, [side * 0.84, 0.1, dz], [0, Math.PI / 2, 0]);
                coffin.add(handle);
            }
        }

        group.add(coffin);
        this.coffin = coffin;

        for (const side of [-1, 1]) {
            const trestle = this.mesh(new THREE.BoxGeometry(0.2, 0.7, 2.4), wood, [side * 1.6, 0.35, 0]);
            group.add(trestle);
        }

        const shovel = new THREE.Group();
        shovel.position.set(2.2, 0, -2.2);
        shovel.rotation.z = -0.5;
        const handle = this.mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 8), wood, [0, 1.1, 0]);
        shovel.add(handle);
        const blade = this.mesh(new THREE.BoxGeometry(0.42, 0.6, 0.08), iron, [0, 0.1, 0]);
        shovel.add(blade);
        group.add(shovel);

        const marker = this.mesh(new THREE.BoxGeometry(1.5, 2.2, 0.3), this.textured(this.tex.granite(1, 0x5a5f68), { roughness: 0.92, metalness: 0.06, bump: 0.05 }), [-3.2, 1.1, -0.4], [0, 0.3, 0.06]);
        group.add(marker);

        const markerSkin = this.decal(
            this.tex.sign("fresh", ["$NEXT", "SOON"], { background: 0x23262c, color: 0xc8d2e0, accent: 0x6a7a94, width: 512, height: 256 }),
            { roughness: 0.86, metalness: 0.1 }
        );
        const markerPlate = this.mesh(new THREE.PlaneGeometry(1.15, 0.58), markerSkin, [-3.0, 1.35, -0.21], [0, 0.3, 0.06]);
        markerPlate.castShadow = false;
        group.add(markerPlate);

        this.scene.add(group);
        this.collisionGrid.insertOrientedBox(FRESH_GRAVE.x, FRESH_GRAVE.z, 3.4, 5.6, 0, 0, 1.2);
    }

    private buildNoticeBoard() {
        const wood = this.textured(this.tex.planks([2, 1], 0x3d3128, 0x1e1812, 5), { roughness: 0.94, metalness: 0.02, bump: 0.05 });

        const group = new THREE.Group();
        group.position.set(-7.5, 0, -28);
        group.rotation.y = 0.55;

        for (const dx of [-2, 2]) {
            const post = this.mesh(new THREE.BoxGeometry(0.28, 3.4, 0.28), wood, [dx, 1.7, 0]);
            group.add(post);
        }

        const board = this.mesh(new THREE.BoxGeometry(4.6, 2.6, 0.18), wood, [0, 2.5, 0]);
        group.add(board);

        const notice = this.board(
            this.tex.sign("obituaries", ["OBITUARIES", "TODAY: 14 · ALL TIME: 1.2M"], { background: 0x1b1f24, color: 0xcfd8e8, accent: 0x8f5f6f }),
            4.2,
            2.2,
            [0, 2.5, 0],
            0,
            { roughness: 0.9, metalness: 0.04, emissive: 0x9ec6ff, emissiveIntensity: 0.16, offset: 0.11 }
        );
        group.add(notice);

        const lamp = this.mesh(new THREE.SphereGeometry(0.22, 10, 8), this.glow(0x9ec6ff, 0.8), [0, 4.1, 0.2]);
        lamp.castShadow = false;
        group.add(lamp);

        if (this.candleLights.length < MAX_CANDLE_LIGHTS) {
            const light = new THREE.PointLight(0x9ec6ff, 14, 14, 2);
            light.position.set(0, 4.1, 0.6);
            group.add(light);
            this.candleLights.push(light);
        }

        this.scene.add(group);
        this.collisionGrid.insertOrientedBox(-7.5, -28, 4.6, 0.6, 0.55, 0, 3.4);
    }

    private buildLampPosts() {
        const iron = this.metal(0x22262c, 0.58, 0.74);

        for (let i = 0; i < 8; i++) {
            const z = -26 + i * 8;
            for (const side of [-1, 1]) {
                const x = side * 4.6;
                const group = new THREE.Group();
                group.position.set(x, 0, z);

                const post = this.mesh(new THREE.CylinderGeometry(0.1, 0.16, 4.2, 8), iron, [0, 2.1, 0]);
                group.add(post);

                const arm = this.mesh(new THREE.TorusGeometry(0.5, 0.06, 5, 10, Math.PI / 2), iron, [0, 4.1, 0], [0, side > 0 ? Math.PI : 0, 0]);
                group.add(arm);

                const cage = this.mesh(new THREE.BoxGeometry(0.5, 0.7, 0.5), iron, [-side * 0.5, 3.9, 0]);
                group.add(cage);

                const glassMaterial = this.glow(0x9ec6ff, 0.75);
                this.candleMaterials.push(glassMaterial);
                const glass = this.mesh(new THREE.SphereGeometry(0.2, 10, 8), glassMaterial, [-side * 0.5, 3.9, 0]);
                glass.castShadow = false;
                group.add(glass);

                if (this.candleLights.length < MAX_CANDLE_LIGHTS) {
                    const light = new THREE.PointLight(0x8fb8ff, 14, 16, 2);
                    light.position.set(-side * 0.5, 3.9, 0);
                    group.add(light);
                    this.candleLights.push(light);
                }

                this.scene.add(group);
                this.collisionGrid.insertCylinder(new THREE.Vector3(x, 2, z), 0.24, 4.2);
            }
        }
    }

    private buildMonument() {
        const group = new THREE.Group();
        group.position.set(0, 0, MONUMENT_Z);

        const plinthSkin = this.textured(this.tex.stoneBlock([5, 1], 0x3a3f48, 0x22262c, 2), { roughness: 0.94, metalness: 0.05, bump: 0.07 });
        const stepSkin = this.textured(this.tex.granite([4, 1], 0x4a505a), { roughness: 0.9, metalness: 0.07, bump: 0.05 });

        const plinth = this.mesh(new THREE.CylinderGeometry(7.5, 8.6, 1.6, 20), plinthSkin, [0, 0.8, 0]);
        group.add(plinth);

        const step = this.mesh(new THREE.CylinderGeometry(5.6, 6.4, 0.9, 20), stepSkin, [0, 1.9, 0]);
        group.add(step);

        const rollBoard = this.board(
            this.tex.sign("rollcall", ["THE GREAT UNWIND", "1 204 881 TOKENS BURIED HERE"], { background: 0x2a1418, color: 0xffb8b8, accent: 0x8f3f4f }),
            7,
            3.5,
            [0, 3.6, -6.8],
            Math.PI,
            { roughness: 0.86, metalness: 0.08, emissive: 0xff5a4a, emissiveIntensity: 0.22 }
        );
        rollBoard.rotation.x = 0.18;
        group.add(rollBoard);

        const redBody = this.lit(0xc2342f, 0.7);
        const waxDrip = this.lit(0x9c2a26, 0.5);

        const candleBase = this.mesh(new THREE.CylinderGeometry(3.1, 3.6, 3.4, 20), redBody, [0, 1.7, 0]);
        group.add(candleBase);

        const candleMid = this.mesh(new THREE.CylinderGeometry(2.55, 3.05, 5.3, 20), redBody, [0, 5.95, 0]);
        group.add(candleMid);

        const candleUpper = this.mesh(new THREE.CylinderGeometry(2.05, 2.5, 4.7, 20), redBody, [0, 10.85, 0]);
        group.add(candleUpper);

        const dripSpots: Array<[number, number, number]> = [
            [2.3, 8.4, 0.6],
            [-1.9, 5.8, 1.8],
            [1.1, 3.2, -2.4],
            [-2.4, 9.6, -1.1],
        ];
        for (const [dx, dy, dz] of dripSpots) {
            const drip = this.mesh(new THREE.ConeGeometry(0.5, 1.6, 8), waxDrip, [dx, dy, dz], [Math.PI, 0, 0]);
            group.add(drip);
        }

        const collar = this.mesh(new THREE.CylinderGeometry(1.05, 1.3, 0.6, 16), waxDrip, [0, 13.4, 0]);
        group.add(collar);

        const wick = this.mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.4, 8), this.matte(0x1a1210, 0.85), [0, 14.35, 0]);
        wick.castShadow = false;
        group.add(wick);

        this.buildFlame(group, new THREE.Vector3(0, 15.4, 0), {
            color: 0xff4a3a,
            tipColor: 0xffe0a0,
            lightColor: 0xff5a4a,
            intensity: 50,
            scale: 5,
            forceLight: true,
        });

        const arrow = new THREE.Group();
        arrow.position.set(-6.4, 12, 0.6);
        arrow.rotation.z = -0.35;

        const stem = this.mesh(new THREE.BoxGeometry(1.1, 7.4, 1.1), this.metal(0x8a8f98, 0.45, 0.7), [0, 0, 0]);
        arrow.add(stem);

        const head = this.mesh(new THREE.ConeGeometry(1.9, 2.6, 4), this.metal(0x8a8f98, 0.45, 0.7), [0, -4.6, 0], [Math.PI, Math.PI / 4, 0]);
        arrow.add(head);

        group.add(arrow);

        const halo = this.mesh(new THREE.CircleGeometry(13, 36), this.glow(0x8f5f6f, 0.1), [0, 12, -3]);
        halo.castShadow = false;
        group.add(halo);

        const tag = createNpcNameTag("R.I.P. 2021—2026", "#ff8f8f");
        tag.position.set(0, 19.5, 0);
        tag.scale.set(9, 2.25, 1);
        group.add(tag);

        this.scene.add(group);
        this.collisionGrid.insertCylinder(new THREE.Vector3(0, 4, MONUMENT_Z), 8.6, 8);
    }

    private buildTrees() {
        const bark = this.textured(this.tex.bark([2, 3], 0x2e2a26), { roughness: 0.97, metalness: 0.02, bump: 0.12 });
        const foliage = this.matte(0x24301f, 0.92, 0.02);
        const crowBody = this.matte(0x14161a, 0.9, 0.1);

        const branchGeo = this.bin.geometry(new THREE.CylinderGeometry(0.06, 0.15, 1, 6));
        const twigGeo = this.bin.geometry(new THREE.CylinderGeometry(0.03, 0.08, 1, 5));
        const upAxis = new THREE.Vector3(0, 1, 0);

        const aimAlong = (mesh: THREE.Mesh, base: THREE.Vector3, dir: THREE.Vector3, length: number) => {
            mesh.quaternion.setFromUnitVectors(upAxis, dir);
            mesh.position.copy(base).addScaledVector(dir, length / 2);
            mesh.scale.y = length;
        };

        for (let i = 0; i < 13; i++) {
            const angle = (i / 13) * Math.PI * 2 + this.random() * 0.4;
            const distance = 26 + this.random() * 32;
            const x = Math.cos(angle) * distance;
            const z = Math.sin(angle) * distance;
            const height = 6.5 + this.random() * 4;
            const hasFoliage = this.random() < 0.45;

            const tree = new THREE.Group();
            tree.position.set(x, 0, z);
            tree.rotation.y = this.random() * Math.PI;

            const trunk = this.mesh(new THREE.CylinderGeometry(0.24, 0.5, height, 8), bark, [0, height / 2, 0]);
            trunk.scale.x = 0.85 + this.random() * 0.3;
            tree.add(trunk);

            const branchCount = 4 + Math.floor(this.random() * 3);
            for (let b = 0; b < branchCount; b++) {
                const branchLength = 2.2 + this.random() * 2;
                const branchY = height * (0.5 + (b / branchCount) * 0.42 + this.random() * 0.08);
                const branchAngle = (b / branchCount) * Math.PI * 2 + this.random() * 0.6;
                const upward = 0.32 + this.random() * 0.4;

                const base = new THREE.Vector3(0, branchY, 0);
                const dir = new THREE.Vector3(Math.cos(branchAngle), upward, Math.sin(branchAngle)).normalize();

                const branch = new THREE.Mesh(branchGeo, bark);
                aimAlong(branch, base, dir, branchLength);
                branch.castShadow = true;
                tree.add(branch);

                const tip = base.clone().addScaledVector(dir, branchLength);

                if (this.random() < 0.6) {
                    const twigLength = 0.8 + this.random() * 0.7;
                    const twigDir = dir.clone()
                        .add(new THREE.Vector3((this.random() - 0.5) * 0.7, 0.35 + this.random() * 0.3, (this.random() - 0.5) * 0.7))
                        .normalize();
                    const twig = new THREE.Mesh(twigGeo, bark);
                    aimAlong(twig, tip, twigDir, twigLength);
                    twig.castShadow = true;
                    tree.add(twig);
                }

                if (hasFoliage && this.random() < 0.7) {
                    const clumpCount = 2 + Math.floor(this.random() * 2);
                    for (let c = 0; c < clumpCount; c++) {
                        const clump = this.mesh(
                            new THREE.IcosahedronGeometry(0.55 + this.random() * 0.35, 0),
                            foliage,
                            [
                                tip.x + (this.random() - 0.5) * 0.8,
                                tip.y + (this.random() - 0.5) * 0.6 + 0.2,
                                tip.z + (this.random() - 0.5) * 0.8,
                            ]
                        );
                        clump.rotation.set(this.random() * Math.PI, this.random() * Math.PI, this.random() * Math.PI);
                        tree.add(clump);
                    }
                }

                if (!hasFoliage && this.random() < 0.22) {
                    const crow = new THREE.Group();
                    crow.position.copy(tip);

                    const body = this.mesh(new THREE.SphereGeometry(0.22, 8, 6), crowBody, [0, 0, 0]);
                    body.scale.set(1, 0.9, 1.5);
                    crow.add(body);

                    const head = this.mesh(new THREE.SphereGeometry(0.13, 8, 6), crowBody, [0, 0.18, 0.24]);
                    crow.add(head);

                    const beak = this.mesh(new THREE.ConeGeometry(0.05, 0.16, 5), crowBody, [0, 0.17, 0.4], [Math.PI / 2, 0, 0]);
                    crow.add(beak);

                    tree.add(crow);
                    this.crows.push(crow);
                }
            }

            this.scene.add(tree);
            this.collisionGrid.insertCylinder(new THREE.Vector3(x, height / 2, z), 0.55, height);
        }
    }

    private buildMist() {
        const mistTexture = this.tex.radialGlow("groundmist", 0x8fa6c8);
        const spots: Array<[number, number]> = [
            [0, 30],
            [-18, -8],
            [16, 8],
            [-24, 18],
            [22, -18],
            [-6, -26],
        ];

        for (let i = 0; i < spots.length; i++) {
            const [x, z] = spots[i];
            const baseOpacity = 0.16 + this.random() * 0.05;
            const material = this.bin.material(new THREE.MeshBasicMaterial({
                map: mistTexture,
                color: 0x8fa6c8,
                transparent: true,
                opacity: baseOpacity,
                depthWrite: false,
                side: THREE.DoubleSide,
                toneMapped: false,
            }));
            const radius = 15 + this.random() * 9;
            const plane = this.mesh(
                new THREE.CircleGeometry(radius, 24),
                material,
                [x, 0.25 + this.random() * 0.15, z],
                [-Math.PI / 2, 0, this.random() * Math.PI * 2]
            );
            plane.castShadow = false;
            plane.renderOrder = 2;
            this.scene.add(plane);
            this.mist.push({
                mesh: plane,
                centerX: x,
                centerZ: z,
                driftRadius: 1.5 + this.random() * 2.5,
                driftSpeed: 0.04 + this.random() * 0.03,
                phase: this.random() * Math.PI * 2,
                baseOpacity,
            });
        }
    }

    private buildWisps() {
        for (let i = 0; i < WISP_COUNT; i++) {
            const angle = this.random() * Math.PI * 2;
            const distance = 8 + this.random() * (YARD_RADIUS - 14);
            const center = new THREE.Vector3(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);

            const mesh = this.mesh(new THREE.SphereGeometry(0.2, 10, 8), this.glow(i % 3 === 0 ? 0x9ef0bb : 0x9ec6ff, 0.9), [0, 0, 0]);
            mesh.castShadow = false;
            this.scene.add(mesh);

            let light: THREE.PointLight | null = null;
            if (i < 3) {
                light = new THREE.PointLight(i % 3 === 0 ? 0x6ff0a0 : 0x8fb6ff, 9, 14, 2);
                this.scene.add(light);
            }

            this.wisps.push({
                mesh,
                light,
                center,
                radius: 1.6 + this.random() * 4,
                speed: 0.25 + this.random() * 0.5,
                phase: this.random() * 9,
                height: 1.2 + this.random() * 2.6,
            });
        }
    }

    private buildRain() {
        const count = 900;
        const positions = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            positions[i * 3] = (this.random() - 0.5) * YARD_RADIUS * 2;
            positions[i * 3 + 1] = this.random() * 40;
            positions[i * 3 + 2] = (this.random() - 0.5) * YARD_RADIUS * 2;
        }

        const geometry = this.bin.geometry(new THREE.BufferGeometry());
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        const material = this.bin.material(new THREE.PointsMaterial({
            color: 0x9fb4d8,
            size: 0.08,
            transparent: true,
            opacity: 0.4,
            depthWrite: false,
            toneMapped: false,
            fog: false,
        }));

        const points = new THREE.Points(geometry, material);
        points.frustumCulled = false;
        points.visible = isRainEnabled();
        this.scene.add(points);
        this.rain = points;
    }

    private buildCrowd() {
        const specs: CrowdSpec[] = [];

        const mourners: Array<[number, number, number]> = [
            [-3.4, 6.2, 0.1],
            [-3.2, 12.4, 0.3],
            [3.3, -1.8, -0.2],
            [3.4, 7.8, 0.15],
            [-3.3, 18.2, 0.4],
            [3.2, 22.1, -0.3],
        ];

        for (const [x, z, facing] of mourners) {
            specs.push({
                position: new THREE.Vector3(x, 0, z),
                set: "mourner",
                facing,
                pose: "mourn",
                held: this.random() < 0.5 ? "rose" : undefined,
                accent: 0xc2342f,
                phase: this.random() * 9,
            });
        }

        specs.push({
            position: new THREE.Vector3(-1.8, 0, MONUMENT_Z - 10),
            set: "mourner",
            variantIndex: 1,
            lookAt: new THREE.Vector3(0, 6, MONUMENT_Z),
            pose: "pray",
            phase: 2,
        });

        specs.push({
            position: new THREE.Vector3(2.4, 0, MONUMENT_Z - 11),
            set: "mourner",
            variantIndex: 0,
            lookAt: new THREE.Vector3(0, 6, MONUMENT_Z),
            pose: "gawk",
            held: "lantern",
            heldLight: true,
            accent: 0xffb45a,
            phase: 4,
        });

        const walkers: Array<[number, number, number, number]> = [
            [0, -30, 0, 22],
            [-17.3, -12, -17.3, 20],
            [32.7, 24, 32.7, -16],
            [11.6, -14, 11.6, 20],
        ];

        for (let w = 0; w < walkers.length; w++) {
            const [x1, z1, x2, z2] = walkers[w];
            specs.push({
                position: new THREE.Vector3(x1, 0, z1),
                set: "mourner",
                walk: {
                    path: [new THREE.Vector3(x1, 0, z1), new THREE.Vector3(x2, 0, z2)],
                    mode: "pingpong",
                    pause: 3 + this.random() * 4,
                    speed: 0.75 + this.random() * 0.3,
                },
                held: "lantern",
                heldLight: w < 2,
                accent: 0xffb45a,
                phase: this.random() * 9,
            });
        }

        for (let i = 0; i < 3; i++) {
            specs.push({
                position: new THREE.Vector3(-14 + i * 13, 0, -26 + i * 2),
                set: "crowd",
                lookAt: new THREE.Vector3(0, 4, MONUMENT_Z),
                pose: "gawk",
                phase: this.random() * 9,
            });
        }

        specs.push({
            position: new THREE.Vector3(FRESH_GRAVE.x + 3.4, 1, FRESH_GRAVE.z + 0.6),
            set: "mourner",
            variantIndex: 2,
            lookAt: new THREE.Vector3(FRESH_GRAVE.x, 0.6, FRESH_GRAVE.z),
            pose: "work",
            held: "wrench",
            accent: 0x6a7a94,
            phase: 1.6,
        });

        for (let i = 0; i < 5; i++) {
            const side = i % 2 === 0 ? -1 : 1;
            specs.push({
                position: new THREE.Vector3(
                    FRESH_GRAVE.x + side * 2.6 + (this.random() - 0.5) * 0.8,
                    0,
                    FRESH_GRAVE.z - 1.8 + Math.floor(i / 2) * 1.9
                ),
                set: "mourner",
                lookAt: new THREE.Vector3(FRESH_GRAVE.x, 0.8, FRESH_GRAVE.z),
                pose: i === 0 ? "pray" : "mourn",
                held: i % 2 === 0 ? "rose" : undefined,
                accent: 0xc2342f,
                phase: this.random() * 9,
            });
        }

        for (let i = 0; i < 3; i++) {
            const angle = 0.6 + i * 0.8;
            specs.push({
                position: new THREE.Vector3(
                    MAUSOLEUM.x + Math.cos(angle) * 7.4,
                    0,
                    MAUSOLEUM.z + Math.sin(angle) * 7.4
                ),
                set: "mourner",
                lookAt: new THREE.Vector3(MAUSOLEUM.x, 3, MAUSOLEUM.z),
                pose: i === 1 ? "gawk" : "mourn",
                held: i === 1 ? "lantern" : "rose",
                heldLight: false,
                accent: i === 1 ? 0x9ec6ff : 0xc2342f,
                phase: this.random() * 9,
            });
        }

        specs.push({
            position: new THREE.Vector3(-11.2, 0, -25.2),
            set: "crowd",
            lookAt: new THREE.Vector3(-7.5, 2.5, -28),
            pose: "gawk",
            phase: 3.1,
        });

        this.crowd.addMany(specs);
    }

    protected tick(delta: number): void {
        const flicker = 0.8 + Math.sin(this.elapsed * 8.4) * 0.12;

        for (let i = 0; i < this.candleMaterials.length; i++) {
            this.candleMaterials[i].opacity = 0.72 + Math.sin(this.elapsed * 9 + i * 1.3) * 0.22;
        }

        for (let i = 0; i < this.candleLights.length; i++) {
            this.candleLights[i].intensity = (i < 8 ? 11 : 14) * (flicker + Math.sin(this.elapsed * 5.5 + i) * 0.12);
        }

        for (let i = 0; i < this.mist.length; i++) {
            const layer = this.mist[i];
            layer.mesh.rotation.z += delta * (0.01 + i * 0.003);
            const t = this.elapsed * layer.driftSpeed + layer.phase;
            layer.mesh.position.x = layer.centerX + Math.cos(t) * layer.driftRadius;
            layer.mesh.position.z = layer.centerZ + Math.sin(t * 0.7) * layer.driftRadius;
            (layer.mesh.material as THREE.MeshBasicMaterial).opacity = layer.baseOpacity + Math.sin(this.elapsed * 0.3 + i * 1.7) * layer.baseOpacity * 0.3;
        }

        this.updateLightning(delta);

        for (let i = 0; i < this.crows.length; i++) {
            this.crows[i].rotation.y = Math.sin(this.elapsed * 0.6 + i * 2.1) * 0.6;
            this.crows[i].position.y += Math.sin(this.elapsed * 3 + i) * delta * 0.05;
        }

        if (this.coffin) {
            this.coffin.position.y = 0.62 + Math.sin(this.elapsed * 0.5) * 0.03;
            this.coffin.rotation.z = Math.sin(this.elapsed * 0.4) * 0.012;
        }

        for (const wisp of this.wisps) {
            const t = this.elapsed * wisp.speed + wisp.phase;
            const x = wisp.center.x + Math.cos(t) * wisp.radius;
            const y = wisp.height + Math.sin(t * 1.7) * 0.6;
            const z = wisp.center.z + Math.sin(t * 0.8) * wisp.radius;

            wisp.mesh.position.set(x, y, z);
            wisp.mesh.scale.setScalar(0.85 + Math.sin(t * 3) * 0.25);
            wisp.light?.position.set(x, y, z);
        }

        if (this.rain) {
            this.rain.visible = isRainEnabled();
        }

        if (this.rain && this.rain.visible) {
            const attribute = this.rain.geometry.getAttribute("position") as THREE.BufferAttribute;
            const array = attribute.array as Float32Array;
            for (let i = 0; i < array.length; i += 3) {
                array[i + 1] -= delta * 9;
                array[i] += delta * 0.6;
                if (array[i + 1] < 0) {
                    array[i] = (this.random() - 0.5) * YARD_RADIUS * 2;
                    array[i + 1] = 34 + this.random() * 8;
                    array[i + 2] = (this.random() - 0.5) * YARD_RADIUS * 2;
                }
            }
            attribute.needsUpdate = true;
        }
    }

    private setLightningLevel(level: number, showBolt: boolean): void {
        if (this.moonLight) this.moonLight.intensity = this.moonBaseIntensity + level * 4.5;
        if (this.ambientLight) this.ambientLight.intensity = this.ambientBaseIntensity + level * 1.4;

        const boltOpacity = showBolt ? level : 0;
        if (this.lightningBoltMaterial) this.lightningBoltMaterial.opacity = boltOpacity;
        if (this.lightningGlowMaterial) this.lightningGlowMaterial.opacity = boltOpacity * 0.75;
    }

    private updateLightning(delta: number): void {
        this.lightningTimer -= delta;
        if (this.lightningTimer > 0 && this.lightningPhase === "idle") return;

        this.lightningStep += delta;

        switch (this.lightningPhase) {
            case "idle":
                this.lightningPhase = "flashA";
                this.lightningStep = 0;
                this.randomizeLightningBolt();
                this.setLightningLevel(1, true);
                break;
            case "flashA":
                if (this.lightningStep >= LIGHTNING_FLASH_DURATION) {
                    this.lightningPhase = "gap";
                    this.lightningStep = 0;
                    this.setLightningLevel(0, false);
                }
                break;
            case "gap":
                if (this.lightningStep >= LIGHTNING_GAP_DURATION) {
                    this.lightningPhase = "flashB";
                    this.lightningStep = 0;
                    this.setLightningLevel(0.7, false);
                }
                break;
            case "flashB":
                if (this.lightningStep >= LIGHTNING_SECOND_DURATION) {
                    this.lightningPhase = "idle";
                    this.lightningStep = 0;
                    this.setLightningLevel(0, false);
                    this.lightningTimer = LIGHTNING_MIN_GAP + this.random() * (LIGHTNING_MAX_GAP - LIGHTNING_MIN_GAP);
                }
                break;
        }
    }
}
