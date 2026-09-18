// src/features/game/world/locations/showcase/rooms/CasinoRoom.ts
import * as THREE from "three";
import { ShowcaseRoom } from "../ShowcaseRoom";
import { ResourceManager } from "../../../../core/ResourceManager";
import { SHOWCASE_INFO_BY_ID, ShowcaseInfo } from "../config";
import { CrowdSpec } from "../actors/ShowcaseCrowd";
import { createNpcNameTag } from "../../../../entities/npcNameTag";
import { seatedActorY } from "../actors/poses";
import type { ShowcaseActor } from "../actors/ShowcaseActor";
import type { EmblemKind } from "../textures";

const FLOOR_HALF_X = 42;
const FLOOR_HALF_Z = 32;
const CHART_CENTER = new THREE.Vector3(0, 0, 20);
const CHART_BARS = 11;
const CONFETTI_COUNT = 360;
const LASER_COUNT = 6;
const SLOT_COUNT = 8;
const SLOT_FIRST_Z = -12;
const CASHIER_CENTER = new THREE.Vector3(-34, 0, 24);
const BOOTH_CENTER = new THREE.Vector3(-30, 0, -26);
const POOL_CENTER = new THREE.Vector3(31, 0, 20);
const LOUNGER_SEAT_Y = 0.52;
const POOL_LOUNGERS: Array<[number, number, number]> = [
    [22.6, 16.4, Math.PI / 2],
    [22.6, 22.6, Math.PI / 2],
    [39.4, 16.4, -Math.PI / 2],
    [39.4, 22.6, -Math.PI / 2],
];

interface ChartBar {
    body: THREE.Mesh;
    wick: THREE.Mesh;
    base: number;
    phase: number;
}

function tableSeat(x: number, z: number, rotation: number, index: number): THREE.Vector3 {
    const angle = -0.9 + index * 0.9 + rotation;
    return new THREE.Vector3(x + Math.cos(angle) * 2.9, 0, z + Math.sin(angle) * 2.9);
}

export class CasinoRoom extends ShowcaseRoom {
    private chartBars: ChartBar[] = [];
    private confetti: THREE.Points | null = null;
    private confettiVelocity: Float32Array = new Float32Array(0);
    private lasers: THREE.Mesh[] = [];
    private spots: THREE.SpotLight[] = [];
    private roulette: THREE.Object3D | null = null;
    private neonMaterials: THREE.MeshBasicMaterial[] = [];
    private windowLights: THREE.InstancedMesh | null = null;
    private slotScreens: THREE.Mesh[] = [];
    private chipPile: THREE.InstancedMesh | null = null;
    private turntables: THREE.Mesh[] = [];
    private danceFloor: THREE.Mesh | null = null;
    private poolWater: THREE.Mesh | null = null;
    private poolFloats: THREE.Mesh[] = [];
    private liquidationBoard: THREE.Group | null = null;
    private paperHands: ShowcaseActor | null = null;

    constructor(info: ShowcaseInfo = SHOWCASE_INFO_BY_ID.get("show-casino") as ShowcaseInfo) {
        super(info, 0x33e1a4, 56);
        this.exitPosition.set(0, 0, -28);
        this.exitFacing = 0;
        this.spawnPosition.set(0, 0, -21);
    }

    protected buildAtmosphere(): void {
        this.scene.background = new THREE.Color(0x0a0713);
        this.scene.fog = new THREE.FogExp2(0x120a1e, 0.0075);

        this.scene.add(new THREE.AmbientLight(0x4a3668, 1.05));
        this.scene.add(new THREE.HemisphereLight(0x8a5fbf, 0x1a1030, 0.95));

        const key = new THREE.DirectionalLight(0xff6fd8, 0.85);
        key.position.set(-40, 40, -30);
        key.castShadow = true;
        key.shadow.mapSize.set(2048, 2048);
        key.shadow.camera.left = -50;
        key.shadow.camera.right = 50;
        key.shadow.camera.top = 50;
        key.shadow.camera.bottom = -50;
        key.shadow.camera.near = 5;
        key.shadow.camera.far = 180;
        key.shadow.bias = -0.0004;
        key.shadow.normalBias = 0.05;
        key.shadow.camera.updateProjectionMatrix();
        this.scene.add(key);

        const fill = new THREE.DirectionalLight(0x4fd1ff, 0.7);
        fill.position.set(46, 26, 40);
        this.scene.add(fill);
    }

    protected decorate(rm: ResourceManager): void {
        this.buildFloor();
        this.buildSkyline();
        this.buildChart();
        this.buildTables();
        this.buildVault();
        this.buildSlots();
        this.buildCashier();
        this.buildBooth();
        this.buildPool();
        this.buildPoolLoungers();
        this.buildTickerWall();
        this.buildBar();
        this.buildLambo();
        this.buildPodium();
        this.buildNeon();
        this.buildLasers();
        this.buildConfetti();
        this.buildCrowd();
        this.buildPaperHands(rm);
    }

    private buildPaperHands(rm: ResourceManager) {
        const spot = new THREE.Vector3(-6.5, 0, 9.5);

        const trader = this.crowd.createActor(rm, {
            position: spot.clone(),
            set: "highRoller",
            variantIndex: 1,
            lookAt: new THREE.Vector3(CHART_CENTER.x, 6, CHART_CENTER.z),
            pose: "phone",
            held: "phone",
            accent: 0x4fd1ff,
            phase: 0.9,
            solid: false,
        }, this.collisionGrid);

        if (!trader) return;
        this.paperHands = trader;

        const watch = this.bubble("JUST A DIP...", "#9ec6ff", { width: 3, tone: "think", y: 2.7, speaker: trader });
        const sell = this.bubble("SOLD!", "#ff4a4a", { width: 2.2, tone: "shout", y: 2.9, speaker: trader });
        const regret = this.bubble("IT PUMPED 40x", "#ffd166", { width: 3.2, y: 2.7, speaker: trader });
        trader.group.add(watch);
        trader.group.add(sell);
        trader.group.add(regret);

        this.addStory([
            {
                duration: 6,
                enter: () => {
                    watch.visible = true;
                    sell.visible = false;
                    regret.visible = false;
                    trader.setPose("phone");
                },
            },
            {
                duration: 2.5,
                enter: () => {
                    watch.visible = false;
                    sell.visible = true;
                    trader.setPose("shout");
                },
            },
            {
                duration: 5,
                enter: () => {
                    sell.visible = false;
                    trader.setPose("grieve");
                    regret.visible = true;
                },
            },
            {
                duration: 4,
                enter: () => {
                    regret.visible = false;
                    trader.setPose("mourn");
                },
            },
        ]);
    }

    private buildFloor() {
        const marble = this.textured(this.tex.marble([7, 6], 0x2e2440, 0x6a4a9a), { roughness: 0.3, metalness: 0.42, bump: 0.02 });
        const inlay = this.glow(0xff4fd8, 0.55);
        const glass = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x6fd6ff,
            roughness: 0.06,
            metalness: 0.3,
            transparent: true,
            opacity: 0.12,
            side: THREE.DoubleSide,
        }));

        const floor = this.mesh(new THREE.BoxGeometry(FLOOR_HALF_X * 2, 1, FLOOR_HALF_Z * 2), marble, [0, -0.5, 0]);
        floor.castShadow = false;
        this.scene.add(floor);

        const carpet = this.textured(this.tex.carpet([6, 5], 0x35164a, 0xff8fd8), { roughness: 0.92, metalness: 0.05 });
        const rug = this.mesh(new THREE.PlaneGeometry(FLOOR_HALF_X * 2 - 8, FLOOR_HALF_Z * 2 - 8), carpet, [0, 0.02, -2], [-Math.PI / 2, 0, 0]);
        rug.castShadow = false;
        this.scene.add(rug);

        for (let i = 0; i < 4; i++) {
            const band = this.mesh(new THREE.RingGeometry(5 + i * 5.5, 5.5 + i * 5.5, 72), inlay, [0, 0.05, -2], [-Math.PI / 2, 0, 0]);
            band.castShadow = false;
            this.scene.add(band);
        }

        for (let i = 0; i < 24; i++) {
            const angle = (i / 24) * Math.PI * 2;
            const spoke = this.mesh(new THREE.BoxGeometry(0.22, 0.04, 3.4), this.glow(0x4fd1ff, 0.5), [Math.cos(angle) * 24, 0.08, -2 + Math.sin(angle) * 24], [0, -angle, 0]);
            spoke.castShadow = false;
            this.scene.add(spoke);
        }

        const ring = this.mesh(new THREE.RingGeometry(11.4, 12.6, 64), this.glow(0x4fd1ff, 0.5), [CHART_CENTER.x, 0.11, CHART_CENTER.z], [-Math.PI / 2, 0, 0]);
        ring.castShadow = false;
        this.scene.add(ring);

        const brass = this.metal(0xd8b46a, 0.3, 0.9);
        const postGeometry = this.bin.geometry(new THREE.CylinderGeometry(0.07, 0.09, 1.35, 8));

        for (const side of [-1, 1]) {
            const panel = this.mesh(new THREE.BoxGeometry(0.12, 1.25, FLOOR_HALF_Z * 2), glass, [side * FLOOR_HALF_X, 0.65, 0]);
            panel.castShadow = false;
            this.scene.add(panel);
            this.collisionGrid.insertOrientedBox(side * FLOOR_HALF_X, 0, 0.6, FLOOR_HALF_Z * 2, 0, 0, 2.2);

            const rail = this.mesh(new THREE.BoxGeometry(0.34, 0.12, FLOOR_HALF_Z * 2), brass, [side * FLOOR_HALF_X, 1.35, 0]);
            this.scene.add(rail);

            for (let z = -FLOOR_HALF_Z; z <= FLOOR_HALF_Z; z += 4) {
                const post = new THREE.Mesh(postGeometry, brass);
                post.position.set(side * FLOOR_HALF_X, 0.67, z);
                post.castShadow = true;
                this.scene.add(post);
            }
        }

        for (const side of [-1, 1]) {
            const panel = this.mesh(new THREE.BoxGeometry(FLOOR_HALF_X * 2, 1.25, 0.12), glass, [0, 0.65, side * FLOOR_HALF_Z]);
            panel.castShadow = false;
            this.scene.add(panel);
            this.collisionGrid.insertOrientedBox(0, side * FLOOR_HALF_Z, FLOOR_HALF_X * 2, 0.6, 0, 0, 2.2);

            const rail = this.mesh(new THREE.BoxGeometry(FLOOR_HALF_X * 2, 0.12, 0.34), brass, [0, 1.35, side * FLOOR_HALF_Z]);
            this.scene.add(rail);

            for (let x = -FLOOR_HALF_X; x <= FLOOR_HALF_X; x += 4) {
                const post = new THREE.Mesh(postGeometry, brass);
                post.position.set(x, 0.67, side * FLOOR_HALF_Z);
                post.castShadow = true;
                this.scene.add(post);
            }
        }
    }

    private buildSkyline() {
        const towerGeometry = this.bin.geometry(new THREE.BoxGeometry(1, 1, 1));
        const towerMaterial = this.matte(0x120e1c, 0.9, 0.1);
        const towers = new THREE.InstancedMesh(towerGeometry, towerMaterial, 90);
        towers.castShadow = false;

        const windowGeometry = this.bin.geometry(new THREE.BoxGeometry(1, 1, 1));
        const windowMaterial = this.bin.material(new THREE.MeshBasicMaterial({ color: 0xffd166, toneMapped: false, fog: false }));
        const windows = new THREE.InstancedMesh(windowGeometry, windowMaterial, 900);
        windows.castShadow = false;

        const matrix = new THREE.Matrix4();
        const quaternion = new THREE.Quaternion();
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3();
        const color = new THREE.Color();

        let windowIndex = 0;

        for (let i = 0; i < 90; i++) {
            const angle = (i / 90) * Math.PI * 2 + this.random() * 0.06;
            const distance = 70 + this.random() * 90;
            const width = 8 + this.random() * 14;
            const height = 20 + this.random() * 90;

            const x = Math.cos(angle) * distance;
            const z = Math.sin(angle) * distance;

            position.set(x, height / 2 - 30, z);
            quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -angle);
            scale.set(width, height, width * 0.8);
            matrix.compose(position, quaternion, scale);
            towers.setMatrixAt(i, matrix);

            const floors = Math.min(10, Math.floor(height / 9));
            for (let f = 0; f < floors && windowIndex < 900; f++) {
                if (this.random() < 0.35) continue;
                position.set(
                    x - Math.cos(angle) * (width * 0.42),
                    height / 2 - 30 - height * 0.4 + f * (height / floors) * 0.85,
                    z - Math.sin(angle) * (width * 0.42)
                );
                scale.set(width * 0.66, 1.4, 0.4);
                matrix.compose(position, quaternion, scale);
                windows.setMatrixAt(windowIndex, matrix);
                color.setHex(this.random() < 0.25 ? 0x6fd6ff : this.random() < 0.5 ? 0xffd166 : 0xff8fb1);
                windows.setColorAt(windowIndex, color);
                windowIndex++;
            }
        }

        for (let i = windowIndex; i < 900; i++) {
            position.set(0, -500, 0);
            scale.setScalar(0.01);
            matrix.compose(position, quaternion, scale);
            windows.setMatrixAt(i, matrix);
        }

        towers.instanceMatrix.needsUpdate = true;
        windows.instanceMatrix.needsUpdate = true;
        if (windows.instanceColor) windows.instanceColor.needsUpdate = true;

        this.scene.add(towers);
        this.scene.add(windows);
        this.windowLights = windows;
    }

    private buildChart() {
        const green = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x3ddc84,
            emissive: 0x1f8f52,
            emissiveIntensity: 2.2,
            roughness: 0.25,
            metalness: 0.1,
            transparent: true,
            opacity: 0.9,
        }));
        const red = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0xff5a4a,
            emissive: 0xb03225,
            emissiveIntensity: 2,
            roughness: 0.25,
            metalness: 0.1,
            transparent: true,
            opacity: 0.9,
        }));

        const pad = this.mesh(new THREE.CylinderGeometry(11, 12, 0.7, 40), this.matte(0x241a34, 0.5, 0.4), [CHART_CENTER.x, 0.35, CHART_CENTER.z]);
        this.scene.add(pad);
        this.collisionGrid.insertCylinder(new THREE.Vector3(CHART_CENTER.x, 0.4, CHART_CENTER.z), 12, 0.8);

        for (let i = 0; i < CHART_BARS; i++) {
            const x = CHART_CENTER.x - 8.4 + i * 1.7;
            const base = 2.2 + i * 1.15;
            const bullish = i % 4 !== 2;

            const body = this.mesh(new THREE.BoxGeometry(1.15, base, 1.15), bullish ? green : red, [x, 1 + base / 2, CHART_CENTER.z]);
            body.castShadow = false;
            this.scene.add(body);

            const wick = this.mesh(new THREE.BoxGeometry(0.22, base * 0.5, 0.22), bullish ? green : red, [x, 1 + base + base * 0.2, CHART_CENTER.z]);
            wick.castShadow = false;
            this.scene.add(wick);

            this.chartBars.push({ body, wick, base, phase: i * 0.4 });
        }

        const glowRing = this.mesh(new THREE.TorusGeometry(11.5, 0.22, 8, 48), this.glow(0x3ddc84, 0.7), [CHART_CENTER.x, 0.9, CHART_CENTER.z], [-Math.PI / 2, 0, 0]);
        glowRing.castShadow = false;
        this.scene.add(glowRing);

        const beam = this.mesh(
            new THREE.CylinderGeometry(6, 11, 40, 24, 1, true),
            this.glow(0x3ddc84, 0.032),
            [CHART_CENTER.x, 22, CHART_CENTER.z]
        );
        beam.castShadow = false;
        this.scene.add(beam);

        const chartLight = new THREE.PointLight(0x3ddc84, 90, 60, 2);
        chartLight.position.set(CHART_CENTER.x, 12, CHART_CENTER.z);
        this.scene.add(chartLight);

        const tag = createNpcNameTag("PUMP IT", "#3ddc84");
        tag.position.set(CHART_CENTER.x, 22, CHART_CENTER.z);
        tag.scale.set(11, 2.75, 1);
        this.scene.add(tag);
    }

    private buildTables() {
        const felt = this.textured(this.tex.felt(1, 0x1f6b45, 0xd8b46a), { roughness: 0.9, metalness: 0.02 });
        const feltRed = this.textured(this.tex.felt(1, 0x6b1f35, 0xd8b46a), { roughness: 0.9, metalness: 0.02 });
        const wood = this.textured(this.tex.planks([2, 1], 0x2a1c2e, 0x150e18, 5), { roughness: 0.55, metalness: 0.3, bump: 0.04 });
        const gold = this.metal(0xd8b46a, 0.3, 0.92);

        const roulette = new THREE.Group();
        roulette.position.set(-17, 0, 7);

        const tableTop = this.mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.3, 28), feltRed, [0, 0.95, 0]);
        roulette.add(tableTop);

        const skirt = this.mesh(new THREE.CylinderGeometry(2.6, 2.2, 0.85, 28), wood, [0, 0.45, 0]);
        roulette.add(skirt);

        const wheel = new THREE.Group();
        wheel.position.set(0, 1.14, 0);

        const wheelBase = this.mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.16, 32), wood, [0, 0, 0]);
        wheel.add(wheelBase);

        for (let i = 0; i < 18; i++) {
            const angle = (i / 18) * Math.PI * 2;
            const pocket = this.mesh(
                new THREE.BoxGeometry(0.42, 0.12, 0.5),
                i % 2 === 0 ? this.lit(0x3ddc84, 0.8) : this.lit(0xff5a4a, 0.8),
                [Math.cos(angle) * 1.1, 0.1, Math.sin(angle) * 1.1],
                [0, -angle, 0]
            );
            wheel.add(pocket);
        }

        const hub = this.mesh(new THREE.ConeGeometry(0.4, 0.7, 12), gold, [0, 0.42, 0]);
        wheel.add(hub);

        roulette.add(wheel);
        this.roulette = wheel;
        this.scene.add(roulette);
        this.collisionGrid.insertCylinder(new THREE.Vector3(-17, 0.6, 7), 2.7, 1.3);

        const tableSpots: Array<[number, number, number]> = [
            [-13, -13, 0.3],
            [-9, -23, -0.4],
            [11, -9, 0.5],
            [24, 6, -0.8],
            [21, -19, 0.2],
        ];

        for (const [x, z, rotation] of tableSpots) {
            const tableLight = new THREE.PointLight(0xffd9a8, 26, 16, 2);
            tableLight.position.set(x, 4.2, z);
            this.scene.add(tableLight);

            const table = new THREE.Group();
            table.position.set(x, 0, z);
            table.rotation.y = rotation;

            const top = this.mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.22, 10), felt, [0, 0.92, 0]);
            table.add(top);

            const rim = this.mesh(new THREE.TorusGeometry(1.9, 0.12, 8, 22), wood, [0, 1.0, 0], [Math.PI / 2, 0, 0]);
            table.add(rim);

            const column = this.mesh(new THREE.CylinderGeometry(0.28, 0.45, 0.9, 10), wood, [0, 0.45, 0]);
            table.add(column);

            for (let c = 0; c < 4; c++) {
                const stack = new THREE.Group();
                const angle = (c / 4) * Math.PI * 2;
                stack.position.set(Math.cos(angle) * 1.1, 1.04, Math.sin(angle) * 1.1);

                for (let s = 0; s < 3 + Math.floor(this.random() * 4); s++) {
                    const chip = this.mesh(
                        new THREE.CylinderGeometry(0.16, 0.16, 0.045, 14),
                        this.lit([0xff4fd8, 0x4fd1ff, 0xffd166, 0x3ddc84][c % 4], 0.6),
                        [0, s * 0.05, 0]
                    );
                    stack.add(chip);
                }

                table.add(stack);
            }

            for (let s = 0; s < 3; s++) {
                const seatPoint = tableSeat(x, z, rotation, s);
                const stool = new THREE.Group();
                stool.position.copy(seatPoint);

                const seat = this.mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.12, 12), feltRed, [0, 0.66, 0]);
                stool.add(seat);

                const leg = this.mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.66, 8), gold, [0, 0.33, 0]);
                stool.add(leg);

                const foot = this.mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.07, 12), gold, [0, 0.04, 0]);
                stool.add(foot);

                this.scene.add(stool);
            }

            this.scene.add(table);
            this.collisionGrid.insertCylinder(new THREE.Vector3(x, 0.6, z), 2, 1.2);
        }
    }

    private buildVault() {
        const gold = this.metal(0xd8b46a, 0.26, 0.95);
        const glass = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x9fe8ff,
            roughness: 0.05,
            metalness: 0.2,
            transparent: true,
            opacity: 0.18,
            side: THREE.DoubleSide,
        }));

        const group = new THREE.Group();
        group.position.set(0, 0, -2);

        const dais = this.mesh(new THREE.CylinderGeometry(4.6, 5.2, 0.6, 28), this.textured(this.tex.marble([3, 1], 0x3a2a54, 0x9a7ad8), { roughness: 0.28, metalness: 0.45 }), [0, 0.3, 0]);
        group.add(dais);
        this.collisionGrid.insertCylinder(new THREE.Vector3(0, 0.3, -2), 5.2, 0.6);

        const trimRing = this.mesh(new THREE.TorusGeometry(4.7, 0.16, 8, 40), gold, [0, 0.62, 0], [Math.PI / 2, 0, 0]);
        group.add(trimRing);

        const chipMaterial = this.lit(0xffd166, 0.7);
        const chipGeometry = this.bin.geometry(new THREE.CylinderGeometry(0.34, 0.34, 0.09, 16));
        const pyramid = new THREE.InstancedMesh(chipGeometry, chipMaterial, 260);
        pyramid.castShadow = true;

        const matrix = new THREE.Matrix4();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3(1, 1, 1);
        const position = new THREE.Vector3();
        let index = 0;

        for (let layer = 0; layer < 12 && index < 260; layer++) {
            const ringRadius = 2.5 - layer * 0.2;
            const perLayer = Math.max(3, Math.round(ringRadius * 7));
            for (let i = 0; i < perLayer && index < 260; i++) {
                const angle = (i / perLayer) * Math.PI * 2 + layer * 0.3;
                position.set(Math.cos(angle) * ringRadius, 0.68 + layer * 0.1, Math.sin(angle) * ringRadius);
                quaternion.setFromEuler(new THREE.Euler(0, angle, 0));
                matrix.compose(position, quaternion, scale);
                pyramid.setMatrixAt(index, matrix);
                index++;
            }
        }

        pyramid.count = index;
        pyramid.instanceMatrix.needsUpdate = true;
        group.add(pyramid);
        this.chipPile = pyramid;

        const dome = this.mesh(new THREE.SphereGeometry(4.2, 26, 16, 0, Math.PI * 2, 0, Math.PI / 2), glass, [0, 0.6, 0]);
        dome.castShadow = false;
        group.add(dome);

        const crown = this.mesh(new THREE.ConeGeometry(1, 2, 12), gold, [0, 3.4, 0]);
        group.add(crown);

        const light = new THREE.PointLight(0xffd166, 44, 26, 2);
        light.position.set(0, 3, 0);
        group.add(light);

        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const post = this.mesh(new THREE.CylinderGeometry(0.09, 0.12, 1.1, 8), gold, [Math.cos(angle) * 6.6, 0.55, Math.sin(angle) * 6.6]);
            group.add(post);

            const knob = this.mesh(new THREE.SphereGeometry(0.16, 10, 8), gold, [Math.cos(angle) * 6.6, 1.2, Math.sin(angle) * 6.6]);
            group.add(knob);

            const nextAngle = ((i + 1) / 8) * Math.PI * 2;
            const from = new THREE.Vector3(Math.cos(angle) * 6.6, 0.95, Math.sin(angle) * 6.6);
            const to = new THREE.Vector3(Math.cos(nextAngle) * 6.6, 0.95, Math.sin(nextAngle) * 6.6);
            const rope = this.mesh(
                new THREE.CylinderGeometry(0.06, 0.06, from.distanceTo(to), 6),
                this.matte(0x8f1f3a, 0.9),
                [(from.x + to.x) / 2, 0.88, (from.z + to.z) / 2]
            );
            rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
            group.add(rope);
        }

        this.scene.add(group);
    }

    private buildSlots() {
        const shell = this.textured(this.tex.panel([1, 1], 0x3a2a44, 0xd8b46a, 2), { roughness: 0.42, metalness: 0.55, bump: 0.05 });
        const trim = this.metal(0xd8b46a, 0.3, 0.92);
        const symbols: Array<[EmblemKind, number]> = [["dog", 0xffc43d], ["frog", 0x3ddc84], ["rocket", 0x4fd1ff], ["coin", 0xffd166]];

        for (let i = 0; i < SLOT_COUNT; i++) {
            const z = SLOT_FIRST_Z + i * 3.4;
            const group = new THREE.Group();
            group.position.set(FLOOR_HALF_X - 5, 0, z);
            group.rotation.y = -Math.PI / 2;

            const body = this.mesh(new THREE.BoxGeometry(1.6, 1.5, 1.1), shell, [0, 0.75, 0]);
            group.add(body);

            const head = this.mesh(new THREE.BoxGeometry(1.7, 1.3, 0.9), shell, [0, 2.05, -0.05], [-0.22, 0, 0]);
            group.add(head);

            const [kind, tint] = symbols[i % symbols.length];
            const screenSkin = this.decal(
                this.tex.emblem(`slot${i % symbols.length}`, kind, 0x160f22, tint, "777"),
                { roughness: 0.3, metalness: 0.2, emissive: tint, emissiveIntensity: 1.1 }
            );
            const screen = this.mesh(new THREE.PlaneGeometry(1.35, 0.95), screenSkin, [0, 2.17, 0.58], [-0.22, 0, 0]);
            screen.castShadow = false;
            group.add(screen);
            this.slotScreens.push(screen);

            const desk = this.mesh(new THREE.BoxGeometry(1.7, 0.16, 0.6), trim, [0, 1.5, 0.6], [-0.35, 0, 0]);
            group.add(desk);

            const lever = this.mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), trim, [0.95, 1.5, 0.1], [0.3, 0, 0.2]);
            group.add(lever);

            const knob = this.mesh(new THREE.SphereGeometry(0.15, 10, 8), this.lit(0xff4a4a, 1.2), [1.12, 1.9, 0.22]);
            group.add(knob);

            const glowMaterial = this.glow(tint, 0.6);
            this.neonMaterials.push(glowMaterial);
            const crown = this.mesh(new THREE.BoxGeometry(1.8, 0.14, 1.1), glowMaterial, [0, 2.78, -0.1]);
            crown.castShadow = false;
            group.add(crown);

            this.scene.add(group);
            this.collisionGrid.insertOrientedBox(FLOOR_HALF_X - 5, z, 1.2, 1.7, 0, 0, 2.8);
        }

        const banner = this.board(
            this.tex.sign("slots", ["1000x SLOTS", "NO REFUNDS"], { background: 0x1d1130, color: 0xffd166, accent: 0xff4fd8 }),
            7,
            3.5,
            [FLOOR_HALF_X - 4.2, 4.6, SLOT_FIRST_Z + SLOT_COUNT * 1.7 - 1.7],
            -Math.PI / 2,
            { roughness: 0.4, metalness: 0.3, emissive: 0xff4fd8, emissiveIntensity: 0.7 }
        );
        this.scene.add(banner);
    }

    private buildCashier() {
        const shell = this.textured(this.tex.panel([2, 1], 0x2a1c2e, 0xd8b46a, 3), { roughness: 0.4, metalness: 0.55, bump: 0.05 });
        const brass = this.metal(0xd8b46a, 0.28, 0.93);

        const group = new THREE.Group();
        group.position.copy(CASHIER_CENTER);
        group.rotation.y = -0.8;

        const counter = this.mesh(new THREE.BoxGeometry(7, 1.2, 1.4), shell, [0, 0.6, 0]);
        group.add(counter);

        const desk = this.mesh(new THREE.BoxGeometry(7.4, 0.2, 1.8), brass, [0, 1.25, 0]);
        group.add(desk);

        const back = this.mesh(new THREE.BoxGeometry(7.4, 4.6, 0.4), shell, [0, 2.3, -1.6]);
        group.add(back);

        for (let i = 0; i < 9; i++) {
            const bar = this.mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), brass, [-3.2 + i * 0.8, 2.5, 0]);
            group.add(bar);
        }

        const lintel = this.mesh(new THREE.BoxGeometry(7.4, 0.3, 0.9), brass, [0, 3.8, 0]);
        group.add(lintel);

        const boardSkin = this.decal(
            this.tex.sign("cashier", ["CASHIER", "CHIPS IN · HOPE OUT"], { background: 0x1a1024, color: 0x3ddc84, accent: 0xd8b46a }),
            { roughness: 0.35, metalness: 0.3, emissive: 0x3ddc84, emissiveIntensity: 0.8 }
        );
        const board = this.mesh(new THREE.PlaneGeometry(5.4, 2.7), boardSkin, [0, 2.5, -1.34]);
        board.castShadow = false;
        group.add(board);

        for (let i = 0; i < 4; i++) {
            const stack = new THREE.Group();
            stack.position.set(-2.4 + i * 1.6, 1.35, 0.3);
            for (let s = 0; s < 4 + Math.floor(this.random() * 5); s++) {
                const chip = this.mesh(
                    new THREE.CylinderGeometry(0.18, 0.18, 0.05, 14),
                    this.lit([0xff4fd8, 0x4fd1ff, 0xffd166, 0x3ddc84][i % 4], 0.6),
                    [0, s * 0.055, 0]
                );
                stack.add(chip);
            }
            group.add(stack);
        }

        const light = new THREE.PointLight(0x3ddc84, 26, 20, 2);
        light.position.set(0, 3, 1.4);
        group.add(light);

        this.scene.add(group);
        this.collisionGrid.insertOrientedBox(CASHIER_CENTER.x, CASHIER_CENTER.z, 7.4, 1.8, -0.8, 0, 1.4);
    }

    private buildBooth() {
        const shell = this.textured(this.tex.panel([2, 1], 0x1d1430, 0x4fd1ff, 3), { roughness: 0.34, metalness: 0.62, bump: 0.05 });

        const group = new THREE.Group();
        group.position.copy(BOOTH_CENTER);

        const riser = this.mesh(new THREE.BoxGeometry(9, 1, 4), shell, [0, 0.5, 0]);
        group.add(riser);
        this.collisionGrid.insertOrientedBox(BOOTH_CENTER.x, BOOTH_CENTER.z, 9, 4, 0, 0, 1);

        const desk = this.mesh(new THREE.BoxGeometry(4.6, 1.1, 1.4), shell, [0, 1.55, 0.8]);
        group.add(desk);

        const faceSkin = this.decal(
            this.tex.emblem("booth", "chart", 0x160f22, 0x4fd1ff, "PUMP FM"),
            { roughness: 0.3, metalness: 0.2, emissive: 0x4fd1ff, emissiveIntensity: 1.2 }
        );
        const face = this.mesh(new THREE.PlaneGeometry(4.2, 1), faceSkin, [0, 1.6, 1.56]);
        face.castShadow = false;
        group.add(face);
        this.slotScreens.push(face);

        for (const side of [-1, 1]) {
            const deck = this.mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.1, 18), this.metal(0x3a3a48, 0.3, 0.8), [side * 1.3, 2.15, 0.6]);
            group.add(deck);

            const disc = this.mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 18), this.lit(0xff4fd8, 0.7), [side * 1.3, 2.22, 0.6]);
            group.add(disc);
            this.turntables.push(disc);

            const stack = this.mesh(new THREE.BoxGeometry(1.2, 2.6, 1.2), this.matte(0x14101c, 0.7, 0.2), [side * 3.4, 2.3, 0]);
            group.add(stack);

            const cone = this.mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 14), this.matte(0x4a4a52, 0.6, 0.3), [side * 3.4, 2.8, 0.62], [Math.PI / 2, 0, 0]);
            group.add(cone);

            const cone2 = this.mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.14, 14), this.matte(0x4a4a52, 0.6, 0.3), [side * 3.4, 1.8, 0.62], [Math.PI / 2, 0, 0]);
            group.add(cone2);
        }

        const truss = this.mesh(new THREE.BoxGeometry(11, 0.3, 0.3), this.metal(0x6a6a78, 0.4, 0.8), [0, 5.4, 0]);
        group.add(truss);

        for (let i = 0; i < 5; i++) {
            const canister = this.mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.6, 10), this.matte(0x22222c, 0.6, 0.4), [-4 + i * 2, 5, 0.1], [0.6, 0, 0]);
            group.add(canister);

            const lens = this.mesh(new THREE.CircleGeometry(0.22, 12), this.glow([0xff4fd8, 0x4fd1ff, 0x3ddc84, 0xffd166, 0xa855f7][i], 0.9), [-4 + i * 2, 4.72, 0.42], [0.6, 0, 0]);
            lens.castShadow = false;
            group.add(lens);
        }

        this.scene.add(group);

        const floorSkin = this.textured(this.tex.grid(4, 0x1a1030, 0xff4fd8, 6), {
            roughness: 0.3,
            metalness: 0.4,
            emissive: 0xff4fd8,
            emissiveIntensity: 0.45,
        });
        const dance = this.mesh(new THREE.CircleGeometry(8.5, 40), floorSkin, [BOOTH_CENTER.x, 0.14, BOOTH_CENTER.z + 11], [-Math.PI / 2, 0, 0]);
        dance.castShadow = false;
        this.scene.add(dance);
        this.danceFloor = dance;
    }

    private buildPool() {
        const rim = this.textured(this.tex.marble([3, 3], 0x2e2440, 0x6a5a8a), { roughness: 0.3, metalness: 0.35, bump: 0.03 });
        const waterSkin = this.textured(this.tex.water(2, 0x4fc8e8, 0xbff2ff), { roughness: 0.1, metalness: 0.3, emissive: 0x4fd1ff, emissiveIntensity: 0.85 });
        waterSkin.transparent = true;
        waterSkin.opacity = 0.85;

        const group = new THREE.Group();
        group.position.copy(POOL_CENTER);

        const basin = this.mesh(new THREE.BoxGeometry(13, 1.4, 9), this.matte(0x140f22, 0.6, 0.2), [0, -0.7, 0]);
        basin.castShadow = false;
        group.add(basin);

        const coping = this.mesh(new THREE.BoxGeometry(14.4, 0.3, 10.4), rim, [0, 0.14, 0]);
        coping.castShadow = false;
        group.add(coping);

        const inner = this.mesh(new THREE.BoxGeometry(12.4, 0.4, 8.4), this.matte(0x0d1a26, 0.5, 0.2), [0, 0.12, 0]);
        inner.castShadow = false;
        group.add(inner);

        const water = this.mesh(new THREE.PlaneGeometry(12.2, 8.2), waterSkin, [0, 0.26, 0], [-Math.PI / 2, 0, 0]);
        water.castShadow = false;
        group.add(water);
        this.poolWater = water;

        const light = new THREE.PointLight(0x4fd1ff, 48, 26, 2);
        light.position.set(0, 1.6, 0);
        group.add(light);

        const floatColors = [0xffd166, 0xff8fb1, 0x3ddc84];
        for (let i = 0; i < 3; i++) {
            const ring = this.mesh(new THREE.TorusGeometry(0.85, 0.28, 8, 18), this.matte(floatColors[i], 0.75), [-3.6 + i * 3.6, 0.34, (this.random() - 0.5) * 4], [Math.PI / 2, 0, 0]);
            ring.castShadow = false;
            group.add(ring);
            this.poolFloats.push(ring);
        }

        this.scene.add(group);
        this.collisionGrid.insertOrientedBox(POOL_CENTER.x, POOL_CENTER.z, 14.4, 10.4, 0, 0, 0.5);
    }

    private buildTickerWall() {
        const frame = this.metal(0x3a3a48, 0.4, 0.82);

        const group = new THREE.Group();
        group.position.set(-9, 0, FLOOR_HALF_Z - 3);

        for (const dx of [-6.4, 6.4]) {
            const post = this.mesh(new THREE.BoxGeometry(0.5, 9, 0.5), frame, [dx, 4.5, 0]);
            group.add(post);
        }

        const beam = this.mesh(new THREE.BoxGeometry(13.6, 0.5, 0.5), frame, [0, 9, 0]);
        group.add(beam);

        const board = this.board(
            this.tex.sign("liquidations", ["LIQUIDATED TODAY", "$4 208 991"], { background: 0x2a0d14, color: 0xff6f61, accent: 0xff4fd8 }),
            12.4,
            6.2,
            [0, 5.4, 0],
            0,
            { roughness: 0.3, metalness: 0.2, emissive: 0xff4a4a, emissiveIntensity: 1.3, offset: 0.3 }
        );
        group.add(board);
        this.liquidationBoard = board;

        const glowMaterial = this.glow(0xff4a4a, 0.4);
        this.neonMaterials.push(glowMaterial);
        const halo = this.mesh(new THREE.PlaneGeometry(14.4, 8), glowMaterial, [0, 5.4, 0.12]);
        halo.castShadow = false;
        group.add(halo);

        this.scene.add(group);
        this.collisionGrid.insertOrientedBox(-9, FLOOR_HALF_Z - 3, 13.6, 0.8, 0, 0, 9);
    }

    private buildBar() {
        const counter = this.textured(this.tex.panel([3, 1], 0x2a1c2e, 0xd8b46a, 3), { roughness: 0.38, metalness: 0.55, bump: 0.04 });
        const neon = this.glow(0xff4fd8, 0.7);

        const bar = new THREE.Group();
        bar.position.set(30, 0, -16);
        bar.rotation.y = -0.5;

        const top = this.mesh(new THREE.BoxGeometry(12, 0.28, 2.4), this.metal(0x3a2a44, 0.25, 0.8), [0, 1.16, 0]);
        bar.add(top);

        const body = this.mesh(new THREE.BoxGeometry(12, 1.15, 2), counter, [0, 0.58, 0]);
        bar.add(body);

        const strip = this.mesh(new THREE.BoxGeometry(12, 0.12, 0.1), neon, [0, 0.42, 1.05]);
        strip.castShadow = false;
        bar.add(strip);
        this.neonMaterials.push(neon);

        const shelf = this.mesh(new THREE.BoxGeometry(12, 0.2, 0.9), counter, [0, 2.4, -1.8]);
        bar.add(shelf);

        const shelf2 = this.mesh(new THREE.BoxGeometry(12, 0.2, 0.9), counter, [0, 3.3, -1.8]);
        bar.add(shelf2);

        for (let i = 0; i < 14; i++) {
            const bottle = this.mesh(
                new THREE.CylinderGeometry(0.12, 0.16, 0.62, 8),
                this.lit([0x3ddc84, 0xff4fd8, 0x4fd1ff, 0xffd166][i % 4], 0.9),
                [-5.4 + i * 0.82, i % 2 === 0 ? 2.8 : 3.7, -1.8]
            );
            bottle.castShadow = false;
            bar.add(bottle);
        }

        const backGlow = this.mesh(new THREE.PlaneGeometry(12, 3.4), this.glow(0xff4fd8, 0.18), [0, 2.8, -2.3]);
        backGlow.castShadow = false;
        bar.add(backGlow);

        const light = new THREE.PointLight(0xff4fd8, 42, 30, 2);
        light.position.set(0, 3, -1);
        bar.add(light);

        this.scene.add(bar);
        this.collisionGrid.insertOrientedBox(30, -16, 12, 2.4, -0.5, 0, 1.3);
    }

    private buildLambo() {
        const body = this.textured(this.tex.panel([2, 1], 0xf2c33d, 0xc08f18, 2), { roughness: 0.22, metalness: 0.72, bump: 0.02 });
        const bodyDark = this.metal(0xc99a1e, 0.28, 0.8);
        const dark = this.matte(0x14101c, 0.38, 0.62);
        const tyre = this.matte(0x101014, 0.85, 0.15);
        const rim = this.metal(0xd8d8e0, 0.2, 0.96);
        const glass = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x18222e,
            roughness: 0.06,
            metalness: 0.7,
            transparent: true,
            opacity: 0.72,
        }));

        const car = new THREE.Group();
        car.position.set(-30, 0.35, 4);
        car.rotation.y = 0.75;

        const pad = this.mesh(new THREE.CylinderGeometry(6.4, 6.8, 0.5, 32), this.matte(0x241a34, 0.4, 0.5), [0, -0.35, 0]);
        car.add(pad);

        const padRing = this.mesh(new THREE.TorusGeometry(6.4, 0.14, 8, 40), this.glow(0xffd166, 0.8), [0, -0.12, 0], [-Math.PI / 2, 0, 0]);
        padRing.castShadow = false;
        car.add(padRing);

        const floor = this.mesh(new THREE.BoxGeometry(4.5, 0.16, 1.86), dark, [0, 0.1, 0]);
        car.add(floor);

        const sill = this.mesh(new THREE.BoxGeometry(4.1, 0.24, 2.02), bodyDark, [0, 0.26, 0]);
        car.add(sill);

        const hull = this.mesh(new THREE.BoxGeometry(3.5, 0.3, 1.92), body, [-0.3, 0.44, 0]);
        car.add(hull);

        const shoulder = this.mesh(new THREE.BoxGeometry(2.6, 0.22, 1.7), body, [-0.9, 0.62, 0]);
        car.add(shoulder);

        const hood = this.mesh(new THREE.BoxGeometry(1.9, 0.2, 1.76), body, [1.65, 0.42, 0], [0, 0, -0.08]);
        car.add(hood);

        const nose = this.mesh(new THREE.BoxGeometry(0.9, 0.16, 1.6), body, [2.72, 0.32, 0], [0, 0, -0.14]);
        car.add(nose);

        const splitter = this.mesh(new THREE.BoxGeometry(1.1, 0.07, 1.9), dark, [2.7, 0.18, 0]);
        car.add(splitter);

        for (const side of [-1, 1]) {
            const cheek = this.mesh(new THREE.BoxGeometry(1.5, 0.24, 0.42), body, [1.9, 0.5, side * 0.76], [0, 0, -0.06]);
            car.add(cheek);

            const arch = this.mesh(new THREE.BoxGeometry(1.3, 0.2, 0.3), bodyDark, [1.5, 0.52, side * 0.88], [0, 0, 0]);
            car.add(arch);

            const archRear = this.mesh(new THREE.BoxGeometry(1.4, 0.22, 0.32), bodyDark, [-1.6, 0.56, side * 0.9], [0, 0, 0]);
            car.add(archRear);

            const intake = this.mesh(new THREE.BoxGeometry(1.1, 0.26, 0.24), dark, [-1.1, 0.46, side * 0.98]);
            car.add(intake);

            const mirror = this.mesh(new THREE.BoxGeometry(0.22, 0.08, 0.36), bodyDark, [0.5, 0.74, side * 1.02]);
            car.add(mirror);
        }

        const windshield = this.mesh(new THREE.BoxGeometry(0.8, 0.44, 1.56), glass, [0.5, 0.76, 0], [0, 0, 0.66]);
        windshield.castShadow = false;
        car.add(windshield);

        const roof = this.mesh(new THREE.BoxGeometry(1.4, 0.12, 1.5), body, [-0.55, 0.94, 0]);
        car.add(roof);

        for (const side of [-1, 1]) {
            const pillar = this.mesh(new THREE.BoxGeometry(1.6, 0.36, 0.14), glass, [-0.5, 0.76, side * 0.76]);
            pillar.castShadow = false;
            car.add(pillar);
        }

        const rearGlass = this.mesh(new THREE.BoxGeometry(1, 0.38, 1.46), glass, [-1.5, 0.78, 0], [0, 0, -0.54]);
        rearGlass.castShadow = false;
        car.add(rearGlass);

        const deck = this.mesh(new THREE.BoxGeometry(1.3, 0.2, 1.86), body, [-2.05, 0.66, 0], [0, 0, 0.09]);
        car.add(deck);

        const engineGrill = this.mesh(new THREE.BoxGeometry(0.9, 0.08, 1.4), dark, [-2.05, 0.77, 0], [0, 0, 0.09]);
        car.add(engineGrill);

        const tail = this.mesh(new THREE.BoxGeometry(0.5, 0.34, 1.9), body, [-2.75, 0.54, 0]);
        car.add(tail);

        const diffuser = this.mesh(new THREE.BoxGeometry(0.5, 0.22, 1.7), dark, [-2.9, 0.3, 0], [0, 0, -0.18]);
        car.add(diffuser);

        const wing = this.mesh(new THREE.BoxGeometry(0.58, 0.07, 2.05), bodyDark, [-2.95, 0.94, 0], [0, 0, 0.16]);
        car.add(wing);

        for (const side of [-1, 1]) {
            const support = this.mesh(new THREE.BoxGeometry(0.12, 0.3, 0.09), bodyDark, [-2.95, 0.79, side * 0.74]);
            car.add(support);

            const exhaust = this.mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 10), rim, [-3, 0.36, side * 0.42], [0, 0, Math.PI / 2]);
            car.add(exhaust);
        }

        for (const [dx, dz] of [[1.5, 1], [1.5, -1], [-1.6, 1], [-1.6, -1]] as Array<[number, number]>) {
            const wheel = this.mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.32, 18), tyre, [dx, 0.16, dz * 0.9], [Math.PI / 2, 0, 0]);
            car.add(wheel);

            const hubCap = this.mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.36, 12), rim, [dx, 0.16, dz * 0.9], [Math.PI / 2, 0, 0]);
            car.add(hubCap);

            const brake = this.mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.38, 10), this.lit(0xff5a2a, 0.5), [dx, 0.16, dz * 0.9], [Math.PI / 2, 0, 0]);
            brake.castShadow = false;
            car.add(brake);
        }

        for (const side of [-1, 1]) {
            const headlight = this.mesh(new THREE.BoxGeometry(0.3, 0.08, 0.46), this.glow(0xfff3c4, 0.95), [2.5, 0.46, side * 0.6], [0, 0, -0.14]);
            headlight.castShadow = false;
            car.add(headlight);
        }

        const taillight = this.mesh(new THREE.BoxGeometry(0.09, 0.1, 1.7), this.glow(0xff4a4a, 0.9), [-2.99, 0.62, 0]);
        taillight.castShadow = false;
        car.add(taillight);

        const spot = new THREE.PointLight(0xffd166, 36, 22, 2);
        spot.position.set(0, 4, 0);
        car.add(spot);

        this.scene.add(car);
        this.collisionGrid.insertCylinder(new THREE.Vector3(-30, 0.8, 4), 6.6, 1.6);
    }

    private buildPoolLoungers() {
        const frame = this.metal(0xdfd6ea, 0.35, 0.6);
        const cloth = this.textured(this.tex.stripes([1, 2], 0x4fd1ff, 0xf2fbff, 8), { roughness: 0.8, metalness: 0.06 });
        const clothWarm = this.textured(this.tex.stripes([1, 2], 0xff8fd8, 0xfff2fb, 8), { roughness: 0.8, metalness: 0.06 });

        for (let i = 0; i < POOL_LOUNGERS.length; i++) {
            const [x, z, rotation] = POOL_LOUNGERS[i];
            const skin = i % 2 === 0 ? cloth : clothWarm;
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.rotation.y = rotation;

            const seat = this.mesh(new THREE.BoxGeometry(1.15, 0.1, 1.7), skin, [0, LOUNGER_SEAT_Y, 0.55]);
            group.add(seat);

            const back = this.mesh(new THREE.BoxGeometry(1.15, 0.1, 1.5), skin, [0, LOUNGER_SEAT_Y + 0.44, -0.91], [0.62, 0, 0]);
            group.add(back);

            const pillow = this.mesh(new THREE.BoxGeometry(0.8, 0.2, 0.44), frame, [0, LOUNGER_SEAT_Y + 0.82, -1.36], [0.62, 0, 0]);
            group.add(pillow);

            for (const side of [-1, 1]) {
                const rail = this.mesh(new THREE.BoxGeometry(0.08, 0.1, 1.9), frame, [side * 0.61, LOUNGER_SEAT_Y - 0.02, 0.45]);
                group.add(rail);

                const backRail = this.mesh(new THREE.BoxGeometry(0.08, 0.1, 1.6), frame, [side * 0.61, LOUNGER_SEAT_Y + 0.42, -0.94], [0.62, 0, 0]);
                group.add(backRail);
            }

            for (const dx of [-0.55, 0.55]) {
                for (const dz of [-0.2, 1.2]) {
                    const leg = this.mesh(new THREE.CylinderGeometry(0.05, 0.05, LOUNGER_SEAT_Y - 0.05, 6), frame, [dx, (LOUNGER_SEAT_Y - 0.05) / 2, dz]);
                    group.add(leg);
                }
            }

            const stand = new THREE.Group();
            stand.position.set(Math.cos(rotation) * 1.3, 0, -Math.sin(rotation) * 1.3);

            const topDisc = this.mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.1, 12), frame, [0, 0.6, 0]);
            stand.add(topDisc);

            const stem = this.mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.6, 8), frame, [0, 0.3, 0]);
            stand.add(stem);

            const flute = this.mesh(
                new THREE.CylinderGeometry(0.09, 0.05, 0.28, 10),
                this.bin.material(new THREE.MeshStandardMaterial({ color: 0xffe066, roughness: 0.1, transparent: true, opacity: 0.85 })),
                [0, 0.79, 0]
            );
            stand.add(flute);

            group.add(stand);

            this.scene.add(group);
            this.collisionGrid.insertOrientedBox(x, z, 1.3, 3, rotation, 0, 0.5);
        }
    }

    private buildPodium() {
        const podium = new THREE.Group();
        podium.position.set(16, 0, 18);

        const base = this.mesh(new THREE.CylinderGeometry(4.4, 4.8, 1.1, 24), this.matte(0x2a1c2e, 0.5, 0.4), [0, 0.55, 0]);
        podium.add(base);

        const deck = this.mesh(new THREE.CylinderGeometry(4.4, 4.4, 0.18, 24), this.glow(0xff4fd8, 0.42), [0, 1.18, 0]);
        deck.castShadow = false;
        podium.add(deck);

        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const pole = this.mesh(new THREE.CylinderGeometry(0.08, 0.08, 5.4, 6), this.glow(0x4fd1ff, 0.6), [Math.cos(angle) * 4.2, 3.8, Math.sin(angle) * 4.2]);
            pole.castShadow = false;
            podium.add(pole);
        }

        const light = new THREE.PointLight(0xff4fd8, 30, 24, 2);
        light.position.set(0, 3, 0);
        podium.add(light);

        this.scene.add(podium);
        this.collisionGrid.insertCylinder(new THREE.Vector3(16, 0.6, 18), 4.8, 1.3);
    }

    private buildNeon() {
        const signs: Array<[string, string, number, number, number, number]> = [
            ["WEN LAMBO", "#ffd166", -30, 7.5, 4, 0.75],
            ["ALL IN", "#ff4fd8", 30, 6.2, -16, -0.5],
            ["HOUSE ALWAYS PUMPS", "#4fd1ff", -18, 5.4, 6, 0.2],
            ["PUMP FM", "#ff4fd8", -30, 7.4, -26, 0],
        ];

        for (const [text, color, x, y, z, rotation] of signs) {
            const tag = createNpcNameTag(text, color);
            tag.position.set(x, y, z);
            tag.scale.set(7.5, 1.9, 1);
            tag.rotation.y = rotation;
            this.scene.add(tag);
        }

        for (let i = 0; i < 5; i++) {
            const material = this.glow([0xff4fd8, 0x4fd1ff, 0x3ddc84, 0xffd166, 0xa855f7][i], 0.55);
            this.neonMaterials.push(material);

            const arch = this.mesh(
                new THREE.TorusGeometry(5 + i * 0.7, 0.12, 8, 30, Math.PI),
                material,
                [0, 0.2, -FLOOR_HALF_Z + 3 + i * 0.6]
            );
            arch.castShadow = false;
            this.scene.add(arch);
        }
    }

    private buildLasers() {
        for (let i = 0; i < LASER_COUNT; i++) {
            const material = this.glow([0xff4fd8, 0x4fd1ff, 0x3ddc84][i % 3], 0.32);
            const beam = this.mesh(
                new THREE.CylinderGeometry(0.09, 0.5, 46, 8, 1, true),
                material,
                [-FLOOR_HALF_X + 6 + i * 13, 12, -FLOOR_HALF_Z + 6]
            );
            beam.castShadow = false;
            beam.renderOrder = 3;
            this.scene.add(beam);
            this.lasers.push(beam);

            const spot = new THREE.SpotLight([0xff4fd8, 0x4fd1ff, 0x3ddc84][i % 3], 60, 60, 0.4, 0.6, 2);
            spot.position.set(-FLOOR_HALF_X + 6 + i * 13, 16, -FLOOR_HALF_Z + 6);
            spot.target.position.set(0, 0, 10);
            this.scene.add(spot);
            this.scene.add(spot.target);
            this.spots.push(spot);
        }
    }

    private buildConfetti() {
        const positions = new Float32Array(CONFETTI_COUNT * 3);
        this.confettiVelocity = new Float32Array(CONFETTI_COUNT * 3);

        for (let i = 0; i < CONFETTI_COUNT; i++) {
            positions[i * 3] = (this.random() - 0.5) * FLOOR_HALF_X * 1.8;
            positions[i * 3 + 1] = this.random() * 26;
            positions[i * 3 + 2] = (this.random() - 0.5) * FLOOR_HALF_Z * 1.8;
            this.confettiVelocity[i * 3] = (this.random() - 0.5) * 0.7;
            this.confettiVelocity[i * 3 + 1] = -(0.7 + this.random() * 1.2);
            this.confettiVelocity[i * 3 + 2] = (this.random() - 0.5) * 0.7;
        }

        const geometry = this.bin.geometry(new THREE.BufferGeometry());
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        const material = this.bin.material(new THREE.PointsMaterial({
            color: 0xffd6f5,
            size: 0.26,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            fog: false,
        }));

        const points = new THREE.Points(geometry, material);
        points.frustumCulled = false;
        this.scene.add(points);
        this.confetti = points;
    }

    private buildCrowd() {
        const specs: CrowdSpec[] = [];

        specs.push({
            position: new THREE.Vector3(-17, 0, 3.4),
            set: "highRoller",
            variantIndex: 0,
            facing: 0,
            pose: "work",
            phase: 0.5,
            solid: false,
        });

        const tableSpots: Array<[number, number, number]> = [
            [-13, -13, 0.3],
            [-9, -23, -0.4],
            [11, -9, 0.5],
            [24, 6, -0.8],
            [21, -19, 0.2],
        ];

        for (let t = 0; t < tableSpots.length; t++) {
            const [x, z, rotation] = tableSpots[t];
            for (let s = 0; s < 3; s++) {
                const seatPoint = tableSeat(x, z, rotation, s);
                specs.push({
                    position: new THREE.Vector3(seatPoint.x, seatedActorY(0.72), seatPoint.z),
                    lookAt: new THREE.Vector3(x, 1, z),
                    set: "highRoller",
                    pose: s === 1 ? "sitSlouch" : "sit",
                    held: s === 0 ? "chips" : s === 2 ? "cash" : undefined,
                    accent: 0xffd166,
                    phase: this.random() * 9,
                    solid: false,
                });
            }
        }

        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            specs.push({
                position: new THREE.Vector3(16 + Math.cos(angle) * 2.2, 1.27, 18 + Math.sin(angle) * 2.2),
                set: "highRoller",
                facing: angle + Math.PI,
                pose: "dance",
                phase: this.random() * 9,
                solid: false,
            });
        }

        for (let i = 0; i < 5; i++) {
            const local = new THREE.Vector3(-4.8 + i * 2.4, 0, 2.2);
            local.applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.5);
            specs.push({
                position: new THREE.Vector3(30 + local.x, 0, -16 + local.z),
                set: "highRoller",
                facing: -0.5 + Math.PI,
                pose: i % 2 === 0 ? "toast" : "haggle",
                held: i % 2 === 0 ? "cocktail" : "cash",
                accent: 0xff4fd8,
                phase: this.random() * 9,
            });
        }

        for (let i = 0; i < 4; i++) {
            const angle = 3.4 + i * 0.45;
            specs.push({
                position: new THREE.Vector3(
                    CHART_CENTER.x + Math.cos(angle) * 14.5,
                    0,
                    CHART_CENTER.z + Math.sin(angle) * 14.5
                ),
                set: "highRoller",
                lookAt: new THREE.Vector3(CHART_CENTER.x, 8, CHART_CENTER.z),
                pose: i % 2 === 0 ? "cheer" : "gawk",
                phase: this.random() * 9,
            });
        }

        specs.push({
            position: new THREE.Vector3(-22, 0, 1),
            set: "highRoller",
            variantIndex: 2,
            lookAt: new THREE.Vector3(-30, 1, 4),
            pose: "gawk",
            phase: 3,
        });

        const walkers: Array<[number, number, number, number]> = [
            [-36, -29.5, -6, -29.5],
            [34, -6, 34, 10],
            [6, -29.5, 34, -29.5],
            [-21, 12, -21, -6],
        ];

        for (const [x1, z1, x2, z2] of walkers) {
            specs.push({
                position: new THREE.Vector3(x1, 0, z1),
                set: "highRoller",
                walk: {
                    path: [new THREE.Vector3(x1, 0, z1), new THREE.Vector3(x2, 0, z2)],
                    mode: "pingpong",
                    pause: 2 + this.random() * 3,
                    speed: 1 + this.random() * 0.5,
                },
                held: this.random() < 0.5 ? "cocktail" : "chips",
                accent: 0x4fd1ff,
                phase: this.random() * 9,
            });
        }

        for (let i = 0; i < SLOT_COUNT; i++) {
            if (i % 2 === 1) continue;
            specs.push({
                position: new THREE.Vector3(FLOOR_HALF_X - 6.8, 0, SLOT_FIRST_Z + i * 3.4),
                set: "highRoller",
                variantIndex: i % 3,
                facing: Math.PI / 2,
                pose: i % 4 === 0 ? "work" : "gawk",
                held: i % 4 === 0 ? undefined : "chips",
                phase: this.random() * 9,
            });
        }

        const teller = new THREE.Vector3(0, 0, -1.05).applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.8);
        specs.push({
            position: new THREE.Vector3(CASHIER_CENTER.x + teller.x, 0, CASHIER_CENTER.z + teller.z),
            set: "highRoller",
            variantIndex: 2,
            facing: -0.8,
            pose: "work",
            phase: 2.4,
            solid: false,
        });

        for (let i = 0; i < 4; i++) {
            const offset = 2.4 + i * 1.5;
            const slot = new THREE.Vector3(0, 0, offset).applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.8);
            specs.push({
                position: new THREE.Vector3(
                    CASHIER_CENTER.x + slot.x + (this.random() - 0.5) * 0.8,
                    0,
                    CASHIER_CENTER.z + slot.z + (this.random() - 0.5) * 0.8
                ),
                set: "highRoller",
                lookAt: new THREE.Vector3(CASHIER_CENTER.x, 1.4, CASHIER_CENTER.z),
                pose: i === 0 ? "haggle" : "gawk",
                held: i % 2 === 0 ? "cash" : "chips",
                phase: this.random() * 9,
            });
        }

        specs.push({
            position: new THREE.Vector3(BOOTH_CENTER.x, 1, BOOTH_CENTER.z + 0.4),
            set: "highRoller",
            variantIndex: 1,
            facing: 0,
            pose: "dance",
            accent: 0x4fd1ff,
            phase: 0.8,
            solid: false,
        });

        for (let i = 0; i < 9; i++) {
            const angle = (i / 9) * Math.PI * 2;
            const radius = 2.6 + this.random() * 5.2;
            specs.push({
                position: new THREE.Vector3(
                    BOOTH_CENTER.x + Math.cos(angle) * radius,
                    0,
                    BOOTH_CENTER.z + 11 + Math.sin(angle) * radius
                ),
                set: "highRoller",
                lookAt: new THREE.Vector3(BOOTH_CENTER.x, 2, BOOTH_CENTER.z),
                pose: i % 3 === 0 ? "cheer" : "dance",
                held: i % 4 === 0 ? "cocktail" : undefined,
                phase: this.random() * 9,
            });
        }

        for (let i = 0; i < POOL_LOUNGERS.length; i++) {
            const [x, z, rotation] = POOL_LOUNGERS[i];
            specs.push({
                position: new THREE.Vector3(
                    x - Math.sin(rotation) * 0.12,
                    seatedActorY(LOUNGER_SEAT_Y) + 0.14,
                    z - Math.cos(rotation) * 0.12
                ),
                set: "highRoller",
                facing: rotation,
                pose: "lounge",
                held: i % 2 === 0 ? "cocktail" : undefined,
                accent: 0x4fd1ff,
                phase: this.random() * 9,
                solid: false,
            });
        }

        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + 0.4;
            specs.push({
                position: new THREE.Vector3(Math.cos(angle) * 7.8, 0, -2 + Math.sin(angle) * 7.8),
                set: "highRoller",
                lookAt: new THREE.Vector3(0, 1.6, -2),
                pose: i % 2 === 0 ? "gawk" : "cheer",
                held: i % 3 === 0 ? "chips" : undefined,
                phase: this.random() * 9,
            });
        }

        for (let i = 0; i < 3; i++) {
            specs.push({
                position: new THREE.Vector3(-18 + i * 4, 0, FLOOR_HALF_Z - 4.5),
                set: "highRoller",
                lookAt: new THREE.Vector3(-9, 5, FLOOR_HALF_Z - 3),
                pose: i === 1 ? "mourn" : "gawk",
                phase: this.random() * 9,
            });
        }

        this.crowd.addMany(specs);
    }

    protected tick(delta: number): void {
        for (let i = 0; i < this.slotScreens.length; i++) {
            const material = this.slotScreens[i].material as THREE.MeshStandardMaterial;
            material.emissiveIntensity = 0.85 + Math.sin(this.elapsed * (5 + i * 0.6) + i) * 0.45;
        }

        for (let i = 0; i < this.turntables.length; i++) {
            this.turntables[i].rotation.y += delta * (3 + i);
        }

        if (this.danceFloor) {
            const material = this.danceFloor.material as THREE.MeshStandardMaterial;
            material.emissiveIntensity = 0.35 + Math.abs(Math.sin(this.elapsed * 2.4)) * 0.5;
        }

        if (this.poolWater) {
            const material = this.poolWater.material as THREE.MeshStandardMaterial;
            if (material.map) {
                material.map.offset.x = this.elapsed * 0.02;
                material.map.offset.y = Math.sin(this.elapsed * 0.4) * 0.02;
            }
            material.emissiveIntensity = 0.3 + Math.sin(this.elapsed * 1.6) * 0.1;
        }

        for (let i = 0; i < this.poolFloats.length; i++) {
            const float = this.poolFloats[i];
            float.position.y = 0.34 + Math.sin(this.elapsed * 0.9 + i) * 0.05;
            float.rotation.z += delta * 0.12;
        }

        if (this.chipPile) {
            this.chipPile.rotation.y += delta * 0.18;
        }

        if (this.liquidationBoard) {
            const panel = this.liquidationBoard.children[0] as THREE.Mesh;
            const material = panel.material as THREE.MeshStandardMaterial;
            material.emissiveIntensity = 1 + Math.abs(Math.sin(this.elapsed * 1.3)) * 0.8;
        }

        for (const bar of this.chartBars) {
            const wave = Math.sin(this.elapsed * 1.2 + bar.phase);
            const height = bar.base * (1 + wave * 0.16);
            bar.body.scale.y = height / bar.base;
            bar.body.position.y = 1 + height / 2;
            bar.wick.position.y = 1 + height + height * 0.2;
        }

        for (let i = 0; i < this.neonMaterials.length; i++) {
            this.neonMaterials[i].opacity = 0.45 + Math.sin(this.elapsed * (2 + i * 0.4)) * 0.2;
        }

        if (this.roulette) this.roulette.rotation.y += delta * 1.6;

        for (let i = 0; i < this.lasers.length; i++) {
            const beam = this.lasers[i];
            beam.rotation.z = Math.sin(this.elapsed * 0.9 + i) * 0.55;
            beam.rotation.x = 0.6 + Math.cos(this.elapsed * 0.7 + i * 1.4) * 0.4;
            (beam.material as THREE.MeshBasicMaterial).opacity = 0.22 + Math.sin(this.elapsed * 5 + i) * 0.12;
        }

        for (let i = 0; i < this.spots.length; i++) {
            const spot = this.spots[i];
            spot.target.position.set(
                Math.sin(this.elapsed * 0.5 + i * 1.2) * 26,
                0,
                10 + Math.cos(this.elapsed * 0.4 + i) * 18
            );
            spot.target.updateMatrixWorld();
            spot.intensity = 50 + Math.sin(this.elapsed * 3 + i) * 22;
        }

        if (this.windowLights) {
            const material = this.windowLights.material as THREE.MeshBasicMaterial;
            material.opacity = 1;
        }

        if (this.confetti) {
            const attribute = this.confetti.geometry.getAttribute("position") as THREE.BufferAttribute;
            const array = attribute.array as Float32Array;
            for (let i = 0; i < array.length; i += 3) {
                array[i] += (this.confettiVelocity[i] + Math.sin(this.elapsed * 2 + i) * 0.4) * delta;
                array[i + 1] += this.confettiVelocity[i + 1] * delta;
                array[i + 2] += this.confettiVelocity[i + 2] * delta;
                if (array[i + 1] < 0.2) {
                    array[i] = (this.random() - 0.5) * FLOOR_HALF_X * 1.8;
                    array[i + 1] = 20 + this.random() * 8;
                    array[i + 2] = (this.random() - 0.5) * FLOOR_HALF_Z * 1.8;
                }
            }
            attribute.needsUpdate = true;
        }
    }
}
