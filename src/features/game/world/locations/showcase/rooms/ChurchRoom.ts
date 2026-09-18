// src/features/game/world/locations/showcase/rooms/ChurchRoom.ts
import * as THREE from "three";
import { ShowcaseRoom } from "../ShowcaseRoom";
import { ResourceManager } from "../../../../core/ResourceManager";
import { SHOWCASE_INFO_BY_ID, ShowcaseInfo } from "../config";
import { CrowdSpec } from "../actors/ShowcaseCrowd";
import type { ShowcaseActor } from "../actors/ShowcaseActor";
import { footRestY, KNEEL_DROP, seatedActorY } from "../actors/poses";
import type { EmblemKind } from "../textures";

const HALF_WIDTH = 15;
const WALL_HEIGHT = 19;
const VAULT_RADIUS = HALF_WIDTH - 0.4;
const NAVE_START = -34;
const NAVE_END = 40;
const NAVE_MID = (NAVE_START + NAVE_END) / 2;
const NAVE_LENGTH = NAVE_END - NAVE_START;
const ALTAR_Z = 30;
const PULPIT_Z = 21;
const PEW_ROWS = 13;
const PEW_FIRST_Z = -22;
const PEW_STEP = 2.9;
const SEAT_TOP = 0.46;
const WINDOW_BAYS = 6;
const COLUMN_X = 11.4;
const CHOIR_Z = 16.5;
const TITHE_Z = 18;
const VOTIVE_Z = -27;
const BOOTH_Z = -29;

const GOSPELS: Array<{ ticker: string; kind: EmblemKind; tint: number }> = [
    { ticker: "$DOGE", kind: "dog", tint: 0xffc43d },
    { ticker: "$PEPE", kind: "frog", tint: 0x4ade80 },
    { ticker: "$MOON", kind: "rocket", tint: 0x67c9ff },
    { ticker: "$HODL", kind: "diamond", tint: 0x9ec6ff },
    { ticker: "$PUMP", kind: "chart", tint: 0xff8f5a },
    { ticker: "$BULL", kind: "bull", tint: 0xff6f61 },
];

const RELICS = ["$LUNA", "$FTT", "$SAFE", "$ICO", "$BITCONNECT", "$SQUID"];

export class ChurchRoom extends ShowcaseRoom {
    private shaftMaterials: THREE.MeshBasicMaterial[] = [];
    private candleLights: THREE.PointLight[] = [];
    private motes: THREE.Points | null = null;
    private idol: THREE.Group | null = null;
    private chartCandles: THREE.Mesh[] = [];
    private chartBaseY: number[] = [];
    private banners: THREE.Group[] = [];
    private tithePile: THREE.Group | null = null;
    private titheLight: THREE.PointLight | null = null;
    private censer: THREE.Group | null = null;
    private preacher: ShowcaseActor | null = null;

    constructor(info: ShowcaseInfo = SHOWCASE_INFO_BY_ID.get("show-church") as ShowcaseInfo) {
        super(info, 0x51a3c7, 60);
        this.exitPosition.set(0, 0, NAVE_START + 3);
        this.exitFacing = 0;
        this.spawnPosition.set(0, 0, NAVE_START + 13);
    }

    protected buildAtmosphere(): void {
        this.scene.background = new THREE.Color(0x120d09);
        this.scene.fog = new THREE.FogExp2(0x1a120c, 0.0105);

        this.scene.add(new THREE.AmbientLight(0x4a3a2c, 0.5));
        this.scene.add(new THREE.HemisphereLight(0x6b5a44, 0x1a1410, 0.55));

        const key = new THREE.DirectionalLight(0xffdca8, 1.5);
        key.position.set(46, 54, 10);
        key.target.position.set(0, 0, 6);
        key.castShadow = true;
        key.shadow.mapSize.set(2048, 2048);
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

        const fill = new THREE.DirectionalLight(0x8fa6d8, 0.32);
        fill.position.set(-40, 26, -30);
        this.scene.add(fill);

        const altarGlow = new THREE.PointLight(0xffc46a, 60, 60, 2);
        altarGlow.position.set(0, 9, ALTAR_Z - 2);
        this.scene.add(altarGlow);
    }

    protected decorate(rm: ResourceManager): void {
        this.buildShell();
        this.buildColumns();
        this.buildWindows();
        this.buildBanners();
        this.buildApse();
        this.buildTithe();
        this.buildPulpit();
        this.buildChoir();
        this.buildPews();
        this.buildVotives();
        this.buildConfessional();
        this.buildRelicWall();
        this.buildChandeliers();
        this.buildMotes();
        this.buildCrowd();
        this.buildBlessing(rm);
    }

    private buildBlessing(rm: ResourceManager) {
        const kneelSpot = new THREE.Vector3(-6.2, 0, PULPIT_Z - 3.2);
        const queueSpot = new THREE.Vector3(-6.2, 0, PULPIT_Z - 9.4);

        const preacher = this.crowd.createActor(rm, {
            position: new THREE.Vector3(-6.4, 1.58, PULPIT_Z),
            set: "clergy",
            variantIndex: 0,
            facing: Math.PI * 0.94,
            pose: "preach",
            held: "book",
            heldHand: "left",
            accent: 0xffd166,
            solid: false,
        }, this.collisionGrid);

        const pilgrim = this.crowd.createActor(rm, {
            position: queueSpot.clone(),
            set: "flock",
            variantIndex: 1,
            facing: 0,
            phase: 3.2,
            solid: false,
        }, this.collisionGrid);

        if (!preacher || !pilgrim) return;
        this.preacher = preacher;

        const ask = this.bubble("BLESS MY BAGS", "#ffd489", { width: 3, y: 2.3, speaker: pilgrim });
        pilgrim.group.add(ask);

        const answer = this.bubble("JUST HOLD", "#ffe9a8", { width: 2.8, tone: "shout", y: 2.6, speaker: preacher });
        preacher.group.add(answer);

        const amen = this.bubble("AMEN", "#7ce8a8", { width: 1.8, y: 2.3, speaker: pilgrim });
        pilgrim.group.add(amen);

        this.addStory([
            {
                duration: 6,
                enter: () => {
                    ask.visible = false;
                    answer.visible = false;
                    amen.visible = false;
                    pilgrim.setPose(undefined);
                    pilgrim.moveTo(queueSpot.x, 0, queueSpot.z);
                    pilgrim.setDestination(kneelSpot, 1.1);
                },
            },
            {
                duration: 3,
                enter: () => {
                    pilgrim.setDestination(null);
                    pilgrim.moveTo(kneelSpot.x, -KNEEL_DROP, kneelSpot.z);
                    pilgrim.faceTowards(new THREE.Vector3(-6.4, 1.6, PULPIT_Z));
                    pilgrim.setPose("kneel");
                    ask.visible = true;
                },
            },
            {
                duration: 4,
                enter: () => {
                    ask.visible = false;
                    preacher.setPose("bless");
                    answer.visible = true;
                },
            },
            {
                duration: 3,
                enter: () => {
                    answer.visible = false;
                    preacher.setPose("preach");
                    amen.visible = true;
                },
            },
            {
                duration: 6,
                enter: () => {
                    amen.visible = false;
                    pilgrim.setPose(undefined);
                    pilgrim.moveTo(kneelSpot.x, 0, kneelSpot.z);
                    pilgrim.setDestination(queueSpot, 1.1);
                },
            },
        ]);
    }

    private buildShell() {
        const slab = this.textured(this.tex.stoneBlock([6, 22], 0x7b6f5c, 0x4f4638, 4), { roughness: 0.94, metalness: 0.03, bump: 0.05 });
        const wallSkin = this.textured(this.tex.stoneBlock([5, 12], 0x6b5f4e, 0x463d30, 6), { roughness: 0.95, metalness: 0.03, bump: 0.08 });
        const endSkin = this.textured(this.tex.stoneBlock([5, 4], 0x574c3d, 0x38301f, 5), { roughness: 0.95, metalness: 0.03, bump: 0.08 });
        const runnerSkin = this.textured(this.tex.carpet([1, 14], 0x7c2230, 0xd8b46a), { roughness: 0.98, metalness: 0 });
        const vaultSkin = this.textured(this.tex.plaster([5, 12], 0x554a3b, 0x241b12), { roughness: 0.97, metalness: 0.02 });
        const ribSkin = this.textured(this.tex.stoneBlock([3, 1], 0x5f5443, 0x3c3428, 3), { roughness: 0.92, metalness: 0.04 });

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
        const shaftSkin = this.textured(this.tex.marble([2, 5], 0x8a7d67, 0x574c3b), { roughness: 0.62, metalness: 0.06, bump: 0.03 });
        const trimSkin = this.textured(this.tex.stoneBlock([2, 1], 0x6f6252, 0x463d30, 2), { roughness: 0.88, metalness: 0.05 });

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
        const frame = this.textured(this.tex.stoneBlock([1, 2], 0x453c2f, 0x2c261d, 3), { roughness: 0.9, metalness: 0.05 });
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

                this.scene.add(group);

                const shaftMaterial = this.glow(gospel.tint, 0.03);
                this.shaftMaterials.push(shaftMaterial);

                const beam = new THREE.Mesh(
                    this.bin.geometry(new THREE.CylinderGeometry(1.9, 4.4, 24, 14, 1, true)),
                    shaftMaterial
                );
                beam.position.set(x - side * 7, 5, z + 2.4);
                beam.rotation.z = side * 0.52;
                beam.rotation.x = -0.14;
                beam.renderOrder = 3;
                this.scene.add(beam);
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
        const stone = this.textured(this.tex.stoneBlock([6, 6], 0x6b5f4e, 0x463d30, 5), { roughness: 0.94, metalness: 0.03, bump: 0.07 });
        const step = this.textured(this.tex.stoneBlock([4, 2], 0x7f7360, 0x4f4638, 2), { roughness: 0.9, metalness: 0.04 });
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

        const idol = new THREE.Group();
        idol.position.set(0, 12.5, NAVE_END - 8);

        const coin = new THREE.Mesh(this.bin.geometry(new THREE.CylinderGeometry(6.4, 6.4, 1.1, 42)), gold);
        coin.rotation.x = Math.PI / 2;
        coin.castShadow = true;
        idol.add(coin);

        const rim = new THREE.Mesh(this.bin.geometry(new THREE.TorusGeometry(6.4, 0.5, 10, 42)), goldDark);
        idol.add(rim);

        const face = new THREE.Mesh(
            this.bin.geometry(new THREE.CircleGeometry(5.7, 40)),
            this.decal(this.tex.emblem("idol", "rocket", 0xb8882f, 0xffe9a8), { roughness: 0.35, metalness: 0.6, emissive: 0xffc46a, emissiveIntensity: 0.35 })
        );
        face.position.z = 0.62;
        idol.add(face);

        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2;
            const ray = new THREE.Mesh(this.bin.geometry(new THREE.BoxGeometry(0.32, 3.6, 0.32)), gold);
            ray.position.set(Math.cos(angle) * 8.4, Math.sin(angle) * 8.4, -0.4);
            ray.rotation.z = angle - Math.PI / 2;
            idol.add(ray);
        }

        const halo = new THREE.Mesh(this.bin.geometry(new THREE.CircleGeometry(11.5, 44)), this.glow(0xffc46a, 0.14));
        halo.position.z = -0.9;
        idol.add(halo);

        this.scene.add(idol);
        this.idol = idol;

        const altarSkin = this.textured(this.tex.marble([3, 1], 0x6d5c42, 0x3b3122), { roughness: 0.55, metalness: 0.08 });
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

            const flame = this.mesh(new THREE.ConeGeometry(0.55, 1.5, 10), this.glow(0xffb45a, 0.9), [0, 4.5, 0]);
            stand.add(flame);

            const light = new THREE.PointLight(0xffa845, 26, 26, 2);
            light.position.set(0, 4.4, 0);
            stand.add(light);
            this.candleLights.push(light);

            this.scene.add(stand);
        }

        const censer = new THREE.Group();
        censer.position.set(0, 9.5, ALTAR_Z - 6);
        const chain = this.mesh(new THREE.CylinderGeometry(0.04, 0.04, 11, 6), goldDark, [0, 5.5, 0]);
        censer.add(chain);
        const bowlBody = this.mesh(new THREE.SphereGeometry(0.42, 14, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), goldDark, [0, 0, 0]);
        censer.add(bowlBody);
        const lid = this.mesh(new THREE.ConeGeometry(0.44, 0.5, 12), gold, [0, 0.26, 0]);
        censer.add(lid);
        const smoke = this.mesh(new THREE.ConeGeometry(0.5, 2.4, 10, 1, true), this.glow(0xd8c8a8, 0.1), [0, 1.4, 0]);
        censer.add(smoke);
        this.scene.add(censer);
        this.censer = censer;
    }

    private buildTithe() {
        const group = new THREE.Group();
        group.position.set(0, 0, TITHE_Z);

        const basin = this.mesh(new THREE.CylinderGeometry(2.6, 2.1, 0.7, 22), this.metal(0x8c6b28, 0.46, 0.85), [0, 0.35, 0]);
        group.add(basin);
        this.collisionGrid.insertCylinder(new THREE.Vector3(0, 0.4, TITHE_Z), 2.7, 0.9);

        const coinGeometry = this.bin.geometry(new THREE.CylinderGeometry(0.26, 0.26, 0.07, 12));
        const coinMaterial = this.lit(0xffcf5a, 0.55);
        const coins = new THREE.InstancedMesh(coinGeometry, coinMaterial, 140);
        coins.castShadow = true;
        const matrix = new THREE.Matrix4();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3(1, 1, 1);
        const position = new THREE.Vector3();

        for (let i = 0; i < 140; i++) {
            const radius = Math.sqrt(this.random()) * 2;
            const angle = this.random() * Math.PI * 2;
            position.set(Math.cos(angle) * radius, 0.72 + (2 - radius) * 0.18 * this.random(), Math.sin(angle) * radius);
            quaternion.setFromEuler(new THREE.Euler(this.random() * 0.5 - 0.25, this.random() * Math.PI, this.random() * 0.5 - 0.25));
            matrix.compose(position, quaternion, scale);
            coins.setMatrixAt(i, matrix);
        }
        coins.instanceMatrix.needsUpdate = true;
        group.add(coins);

        this.titheLight = new THREE.PointLight(0xffc46a, 12, 16, 2);
        this.titheLight.position.set(0, 1.6, 0);
        group.add(this.titheLight);

        const plaque = this.board(
            this.tex.sign("tithe", ["TITHE", "SEND IT"], { background: 0x2a1f16, color: 0xffd489, accent: 0x8c6b28 }),
            2.6,
            1.3,
            [0, 1.2, -2.3],
            0,
            { roughness: 0.8, metalness: 0.1, emissive: 0xffd489, emissiveIntensity: 0.3 }
        );
        plaque.rotation.x = -0.32;
        group.add(plaque);

        this.scene.add(group);
        this.tithePile = group;
    }

    private buildPulpit() {
        const wood = this.textured(this.tex.planks([2, 1], 0x54402a, 0x2e2316, 6), { roughness: 0.88, metalness: 0.04, bump: 0.05 });
        const gold = this.metal(0xd8b46a, 0.3, 0.9);

        const group = new THREE.Group();
        group.position.set(-6.4, 0, PULPIT_Z);
        group.rotation.y = 0.42;

        const drum = this.mesh(new THREE.CylinderGeometry(1.32, 1.5, 1.42, 14), wood, [0, 0.71, 0]);
        group.add(drum);

        const deck = this.mesh(new THREE.CylinderGeometry(1.46, 1.46, 0.16, 14), wood, [0, 1.5, 0]);
        group.add(deck);

        const railBack = this.mesh(new THREE.CylinderGeometry(1.46, 1.46, 0.86, 14, 1, true, Math.PI * 0.2, Math.PI * 1.25), wood, [0, 1.95, 0]);
        (railBack.material as THREE.Material).side = THREE.DoubleSide;
        group.add(railBack);

        const trim = this.mesh(new THREE.TorusGeometry(1.46, 0.07, 8, 20), gold, [0, 2.38, 0], [Math.PI / 2, 0, 0]);
        group.add(trim);

        const crest = this.mesh(
            new THREE.PlaneGeometry(1.5, 1.5),
            this.decal(this.tex.emblem("pulpit", "diamond", 0x3a2c1c, 0xffd489), { roughness: 0.8, metalness: 0.1, emissive: 0xffd489, emissiveIntensity: 0.25 }),
            [0, 1.9, 1.52],
            [0, 0, 0]
        );
        crest.castShadow = false;
        group.add(crest);

        const lectern = this.mesh(new THREE.BoxGeometry(0.95, 0.1, 0.62), wood, [0, 2.2, 1.05], [-0.35, 0, 0]);
        group.add(lectern);

        const lecternBook = this.mesh(new THREE.BoxGeometry(0.62, 0.08, 0.42), this.matte(0xf2e6cc, 0.9), [0, 2.28, 1.02], [-0.35, 0, 0]);
        group.add(lecternBook);

        for (let i = 0; i < 3; i++) {
            const stair = this.mesh(new THREE.BoxGeometry(1.2, 0.24, 0.62), wood, [0, 0.12 + i * 0.46, -1.5 - i * 0.6]);
            group.add(stair);
        }

        this.scene.add(group);
        this.collisionGrid.insertCylinder(new THREE.Vector3(-6.4, 0.8, PULPIT_Z), 1.6, 1.6);
    }

    private buildChoir() {
        const wood = this.textured(this.tex.planks([2, 1], 0x4a3722, 0x2a1f14, 6), { roughness: 0.9, metalness: 0.03 });

        for (let tier = 0; tier < 2; tier++) {
            const height = 0.4 + tier * 0.4;
            const deck = this.mesh(new THREE.BoxGeometry(8.4 - tier * 1.2, height, 2.2), wood, [7.6, height / 2, CHOIR_Z + tier * 2.2]);
            this.scene.add(deck);
            this.collisionGrid.insertOrientedBox(7.6, CHOIR_Z + tier * 2.2, 8.4 - tier * 1.2, 2.2, 0, 0, height);
        }

        const rail = this.mesh(new THREE.BoxGeometry(8.4, 0.14, 0.14), this.metal(0xd8b46a, 0.35, 0.85), [7.6, 1.05, CHOIR_Z - 1.1]);
        this.scene.add(rail);

        for (const dx of [-4.1, 0, 4.1]) {
            const post = this.mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.05, 8), this.metal(0xd8b46a, 0.35, 0.85), [7.6 + dx, 0.52, CHOIR_Z - 1.1]);
            this.scene.add(post);
        }
    }

    private buildPews() {
        const wood = this.textured(this.tex.planks([3, 1], 0x4a3722, 0x291e13, 5), { roughness: 0.9, metalness: 0.03, bump: 0.04 });
        const seat = this.bin.geometry(new THREE.BoxGeometry(9, 0.16, 0.72));
        const back = this.bin.geometry(new THREE.BoxGeometry(9, 0.78, 0.16));
        const leg = this.bin.geometry(new THREE.BoxGeometry(0.34, SEAT_TOP - 0.08, 0.66));
        const kneelerHeight = footRestY(SEAT_TOP);
        const kneeler = this.bin.geometry(new THREE.BoxGeometry(9, 0.14, 0.5));
        const kneelerLeg = this.bin.geometry(new THREE.BoxGeometry(0.22, kneelerHeight, 0.4));
        const finial = this.bin.geometry(new THREE.OctahedronGeometry(0.1, 0));
        const brass = this.metal(0xb8882f, 0.4, 0.85);

        for (let row = 0; row < PEW_ROWS; row++) {
            const z = PEW_FIRST_Z + row * PEW_STEP;

            for (const side of [-1, 1]) {
                const cx = side * 6.6;
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

                for (const dx of [-4.2, 0, 4.2]) {
                    const support = new THREE.Mesh(leg, wood);
                    support.position.set(dx, (SEAT_TOP - 0.08) / 2, 0);
                    group.add(support);

                    const kneelerSupport = new THREE.Mesh(kneelerLeg, wood);
                    kneelerSupport.position.set(dx, kneelerHeight / 2, 0.95);
                    group.add(kneelerSupport);
                }

                const cap = new THREE.Mesh(finial, brass);
                cap.position.set(side * -4.5, SEAT_TOP + 0.76, -0.5);
                group.add(cap);

                const board = new THREE.Mesh(kneeler, wood);
                board.position.set(0, kneelerHeight, 0.95);
                board.receiveShadow = true;
                group.add(board);

                this.scene.add(group);
                this.collisionGrid.insertOrientedBox(cx, z, 9, 0.9, 0, 0, SEAT_TOP + 0.5);
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
        const flameGeometry = this.bin.geometry(new THREE.ConeGeometry(0.09, 0.26, 7));
        const waxMaterial = this.matte(0xe8dcc0, 0.85);
        const flameMaterial = this.glow(0xffb45a, 0.95);

        for (let row = 0; row < 3; row++) {
            for (let i = 0; i < 14; i++) {
                if (this.random() < 0.15) continue;
                const x = -2.4 + i * 0.37;
                const z = -0.45 + row * 0.45;
                const candle = new THREE.Mesh(wax, waxMaterial);
                candle.position.set(x, 1.28, z);
                group.add(candle);

                const flame = new THREE.Mesh(flameGeometry, flameMaterial);
                flame.position.set(x, 1.58, z);
                group.add(flame);
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

    private buildConfessional() {
        const wood = this.textured(this.tex.planks([1, 2], 0x3d2c1c, 0x21180f, 5), { roughness: 0.92, metalness: 0.03 });
        const curtain = this.textured(this.tex.carpet([1, 1], 0x5a1a24, 0x8c6b28), { roughness: 0.96, metalness: 0 });

        const group = new THREE.Group();
        group.position.set(-(HALF_WIDTH - 3), 0, BOOTH_Z);
        group.rotation.y = Math.PI / 2;

        const shell = this.mesh(new THREE.BoxGeometry(4.4, 4.2, 2.2), wood, [0, 2.1, -0.5]);
        group.add(shell);

        const roof = this.mesh(new THREE.BoxGeometry(5, 0.4, 2.8), wood, [0, 4.4, -0.5]);
        group.add(roof);

        const crown = this.mesh(new THREE.OctahedronGeometry(0.4, 0), this.metal(0xd8b46a, 0.32, 0.9), [0, 4.9, -0.5]);
        group.add(crown);

        const alcove = this.mesh(new THREE.BoxGeometry(1.7, 3, 1.4), this.matte(0x120d09, 0.98, 0), [-1.2, 1.5, 0.3]);
        group.add(alcove);

        const drape = this.mesh(new THREE.BoxGeometry(1.8, 3, 0.12), curtain, [1.2, 1.6, 0.62]);
        group.add(drape);

        const grille = this.mesh(new THREE.BoxGeometry(0.9, 0.9, 0.1), this.metal(0x6b5a34, 0.5, 0.7), [0, 2.2, 0.6]);
        group.add(grille);

        for (let i = 0; i < 5; i++) {
            const bar = this.mesh(new THREE.BoxGeometry(0.06, 0.9, 0.14), this.metal(0x2b2620, 0.7, 0.5), [-0.36 + i * 0.18, 2.2, 0.66]);
            group.add(bar);
        }

        const kneelBoard = this.mesh(new THREE.BoxGeometry(1.4, 0.16, 0.6), wood, [1.2, footRestY(SEAT_TOP), 1.1]);
        group.add(kneelBoard);

        this.scene.add(group);
        this.collisionGrid.insertOrientedBox(-(HALF_WIDTH - 3), BOOTH_Z, 2.6, 4.8, 0, 0, 4.4);
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

                const flame = this.mesh(new THREE.ConeGeometry(0.12, 0.36, 8), this.glow(0xffc06a, 0.95), [Math.cos(angle) * 2.5, 1.06, Math.sin(angle) * 2.5]);
                group.add(flame);
            }

            const light = new THREE.PointLight(0xffb45a, 40, 34, 2);
            light.position.y = 0.6;
            group.add(light);
            this.candleLights.push(light);

            this.scene.add(group);
        }
    }

    private buildMotes() {
        const count = 420;
        const positions = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            positions[i * 3] = (this.random() - 0.5) * (HALF_WIDTH * 2 - 4);
            positions[i * 3 + 1] = 0.6 + this.random() * 16;
            positions[i * 3 + 2] = NAVE_START + this.random() * NAVE_LENGTH;
        }

        const geometry = this.bin.geometry(new THREE.BufferGeometry());
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        const material = this.bin.material(new THREE.PointsMaterial({
            color: 0xffe3b0,
            size: 0.09,
            transparent: true,
            opacity: 0.65,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            fog: false,
        }));

        const points = new THREE.Points(geometry, material);
        points.frustumCulled = false;
        this.scene.add(points);
        this.motes = points;
    }

    private buildCrowd() {
        const specs: CrowdSpec[] = [];
        const altarLook = new THREE.Vector3(0, 1.6, ALTAR_Z);
        const pulpitLook = new THREE.Vector3(-6.4, 1.6, PULPIT_Z);

        specs.push({
            position: new THREE.Vector3(-6.4, 1.58, PULPIT_Z),
            set: "clergy",
            variantIndex: 0,
            facing: Math.PI * 0.92,
            pose: "preach",
            held: "book",
            heldHand: "left",
            accent: 0xffd166,
            solid: false,
        });

        for (const side of [-1, 1]) {
            specs.push({
                position: new THREE.Vector3(side * 4.4, 1.26, ALTAR_Z - 3.4),
                set: "clergy",
                variantIndex: 1,
                lookAt: pulpitLook,
                pose: "carry",
                held: "candle",
                heldLight: true,
                solid: false,
            });
        }

        specs.push({
            position: new THREE.Vector3(0, 0, TITHE_Z - 2.4),
            set: "clergy",
            variantIndex: 1,
            facing: Math.PI,
            pose: "carry",
            held: "basket",
            solid: false,
        });

        for (let i = 0; i < 5; i++) {
            specs.push({
                position: new THREE.Vector3(-1.6 + (i % 2) * 3.2, 0, TITHE_Z - 3.8 - Math.floor(i / 2) * 2.2),
                set: "flock",
                facing: 0.05 + (this.random() - 0.5) * 0.2,
                pose: i === 0 ? "cheer" : "carry",
                held: i % 2 === 0 ? "cash" : "bag",
                phase: this.random() * 10,
            });
        }

        for (let i = 0; i < 8; i++) {
            const row = Math.floor(i / 4);
            specs.push({
                position: new THREE.Vector3(4.6 + (i % 4) * 2, 0.4 + row * 0.4, CHOIR_Z + row * 2.2),
                set: "clergy",
                variantIndex: 1,
                facing: Math.PI * 0.82,
                pose: i % 3 === 0 ? "cheer" : "carry",
                held: "book",
                heldHand: "left",
                phase: this.random() * 10,
                solid: false,
            });
        }

        for (let row = 0; row < PEW_ROWS; row++) {
            const z = PEW_FIRST_Z + row * PEW_STEP;

            for (const side of [-1, 1]) {
                const seats = 3 + Math.floor(this.random() * 2);
                for (let s = 0; s < seats; s++) {
                    if (this.random() < 0.18) continue;

                    const x = side * 6.6 + (s - (seats - 1) / 2) * 2.5 + (this.random() - 0.5) * 0.3;
                    const slouch = this.random() < 0.35;

                    specs.push({
                        position: new THREE.Vector3(x, seatedActorY(SEAT_TOP), z + 0.1),
                        set: "flock",
                        facing: 0.02 + (this.random() - 0.5) * 0.25,
                        pose: slouch ? "sitSlouch" : (this.random() < 0.5 ? "sit" : "pray"),
                        held: this.random() < 0.22 ? "candle" : undefined,
                        heldLight: false,
                        phase: this.random() * 10,
                        solid: false,
                    });
                }
            }
        }

        for (let i = 0; i < 4; i++) {
            specs.push({
                position: new THREE.Vector3(HALF_WIDTH - 5.2, 0, VOTIVE_Z - 1.6 + i * 1.1),
                set: "flock",
                facing: Math.PI / 2,
                pose: i === 0 ? "work" : "mourn",
                held: i === 0 ? "candle" : undefined,
                heldLight: i === 0,
                phase: this.random() * 10,
            });
        }

        specs.push({
            position: new THREE.Vector3(-(HALF_WIDTH - 4.4), 0, BOOTH_Z + 1.2),
            set: "flock",
            facing: -Math.PI / 2,
            pose: "pray",
            phase: this.random() * 6,
            solid: false,
        });

        specs.push({
            position: new THREE.Vector3(-(HALF_WIDTH - 3), seatedActorY(SEAT_TOP) + 0.1, BOOTH_Z - 0.9),
            set: "clergy",
            variantIndex: 0,
            facing: Math.PI / 2,
            pose: "sit",
            phase: this.random() * 6,
            solid: false,
        });

        for (let i = 0; i < 5; i++) {
            const side = i % 2 === 0 ? -1 : 1;
            specs.push({
                position: new THREE.Vector3(side * (HALF_WIDTH - 1.6), 0, -14 + i * 8),
                set: "flock",
                lookAt: altarLook,
                pose: "pray",
                held: "candle",
                heldLight: i < 2,
                phase: this.random() * 10,
            });
        }

        const ushers: Array<[number, number, number, number]> = [
            [-1.2, -24, -1.2, 14],
            [1.2, 14, 1.2, -24],
        ];

        for (const [x1, z1, x2, z2] of ushers) {
            specs.push({
                position: new THREE.Vector3(x1, 0, z1),
                set: "clergy",
                variantIndex: 1,
                walk: {
                    path: [new THREE.Vector3(x1, 0, z1), new THREE.Vector3(x2, 0, z2)],
                    mode: "pingpong",
                    pause: 3.5 + this.random() * 3,
                    speed: 0.95 + this.random() * 0.3,
                },
                held: "basket",
                phase: this.random() * 10,
            });
        }

        const walkers: Array<[number, number, number, number]> = [
            [-13.4, -26, -13.4, 18],
            [13.4, 16, 13.4, -22],
            [-9, 25, 9, 25],
            [13.4, -6, 13.4, -28],
        ];

        for (const [x1, z1, x2, z2] of walkers) {
            specs.push({
                position: new THREE.Vector3(x1, 0, z1),
                set: "flock",
                walk: {
                    path: [new THREE.Vector3(x1, 0, z1), new THREE.Vector3(x2, 0, z2)],
                    mode: "pingpong",
                    pause: 2.5 + this.random() * 3,
                    speed: 1.1 + this.random() * 0.4,
                },
                held: this.random() < 0.5 ? "candle" : undefined,
                heldLight: false,
                phase: this.random() * 10,
            });
        }

        for (let i = 0; i < 3; i++) {
            specs.push({
                position: new THREE.Vector3(-4 + i * 4, 0, NAVE_START + 7.5),
                set: "crowd",
                lookAt: altarLook,
                pose: "gawk",
                phase: this.random() * 10,
            });
        }

        this.crowd.addMany(specs);
    }

    protected tick(delta: number): void {
        const flicker = 0.85 + Math.sin(this.elapsed * 7.3) * 0.08 + Math.sin(this.elapsed * 3.1) * 0.05;

        for (let i = 0; i < this.candleLights.length; i++) {
            const light = this.candleLights[i];
            light.intensity = (i < 2 ? 26 : 40) * (flicker + Math.sin(this.elapsed * 5 + i) * 0.06);
        }

        for (let i = 0; i < this.shaftMaterials.length; i++) {
            this.shaftMaterials[i].opacity = 0.026 + Math.sin(this.elapsed * 0.5 + i * 0.7) * 0.008;
        }

        if (this.idol) {
            this.idol.rotation.z = Math.sin(this.elapsed * 0.25) * 0.04;
            this.idol.position.y = 12.5 + Math.sin(this.elapsed * 0.6) * 0.18;
        }

        if (this.censer) {
            this.censer.rotation.z = Math.sin(this.elapsed * 1.1) * 0.28;
            this.censer.rotation.x = Math.sin(this.elapsed * 0.7) * 0.14;
        }

        if (this.titheLight) {
            this.titheLight.intensity = 11 + Math.sin(this.elapsed * 2.2) * 3;
        }

        if (this.tithePile) {
            this.tithePile.rotation.y = Math.sin(this.elapsed * 0.2) * 0.05;
        }

        for (let i = 0; i < this.banners.length; i++) {
            this.waveBoard(this.banners[i], this.elapsed * 0.7, 0.03, i);
        }

        for (let i = 0; i < this.chartCandles.length; i++) {
            this.chartCandles[i].position.y = this.chartBaseY[i] + Math.sin(this.elapsed * 1.6 + i * 0.5) * 0.06;
        }

        if (this.motes) {
            const attribute = this.motes.geometry.getAttribute("position") as THREE.BufferAttribute;
            const array = attribute.array as Float32Array;
            for (let i = 0; i < array.length; i += 3) {
                array[i + 1] += delta * 0.16;
                array[i] += Math.sin(this.elapsed * 0.4 + i) * delta * 0.05;
                if (array[i + 1] > 17) array[i + 1] = 0.4;
            }
            attribute.needsUpdate = true;
        }
    }
}
