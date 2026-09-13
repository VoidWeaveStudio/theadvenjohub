// src/features/game/world/locations/showcase/rooms/CasinoRoom.ts
import * as THREE from "three";
import { ShowcaseRoom } from "../ShowcaseRoom";
import { ResourceManager } from "../../../../core/ResourceManager";
import { SHOWCASE_INFO_BY_ID, ShowcaseInfo } from "../config";
import { CrowdSpec } from "../actors/ShowcaseCrowd";
import { createNpcNameTag } from "../../../../entities/npcNameTag";
import { seatedActorY } from "../actors/poses";

const FLOOR_HALF_X = 42;
const FLOOR_HALF_Z = 32;
const CHART_CENTER = new THREE.Vector3(0, 0, 20);
const CHART_BARS = 11;
const CONFETTI_COUNT = 360;
const LASER_COUNT = 6;

interface ChartBar {
    body: THREE.Mesh;
    wick: THREE.Mesh;
    base: number;
    phase: number;
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

    protected decorate(_rm: ResourceManager): void {
        this.buildFloor();
        this.buildSkyline();
        this.buildChart();
        this.buildTables();
        this.buildBar();
        this.buildLambo();
        this.buildPodium();
        this.buildNeon();
        this.buildLasers();
        this.buildConfetti();
        this.buildCrowd();
    }

    private buildFloor() {
        const marble = this.matte(0x2e2440, 0.32, 0.42);
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

        for (let i = -4; i <= 4; i++) {
            const stripe = this.mesh(new THREE.BoxGeometry(FLOOR_HALF_X * 2 - 4, 0.04, 0.3), inlay, [0, 0.02, i * 7]);
            stripe.castShadow = false;
            this.scene.add(stripe);
        }

        const ring = this.mesh(new THREE.RingGeometry(11.4, 12.6, 64), this.glow(0x4fd1ff, 0.5), [CHART_CENTER.x, 0.03, CHART_CENTER.z], [-Math.PI / 2, 0, 0]);
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
        const felt = this.matte(0x1f6b45, 0.92, 0.02);
        const feltRed = this.matte(0x6b1f35, 0.92, 0.02);
        const wood = this.matte(0x2a1c2e, 0.6, 0.25);
        const gold = this.metal(0xd8b46a, 0.3, 0.92);

        const roulette = new THREE.Group();
        roulette.position.set(-18, 0, 6);

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
        this.collisionGrid.insertCylinder(new THREE.Vector3(-18, 0.6, 6), 2.7, 1.3);

        const tableSpots: Array<[number, number, number]> = [
            [-26, -10, 0.3],
            [-12, -14, -0.4],
            [14, -12, 0.5],
            [24, 4, -0.8],
            [20, -20, 0.2],
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
                const angle = -0.9 + s * 0.9 + rotation;
                const stool = new THREE.Group();
                stool.position.set(Math.cos(angle) * 2.9, 0, Math.sin(angle) * 2.9);

                const seat = this.mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.12, 12), feltRed, [0, 0.66, 0]);
                stool.add(seat);

                const leg = this.mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.66, 8), gold, [0, 0.33, 0]);
                stool.add(leg);

                table.add(stool);
            }

            this.scene.add(table);
            this.collisionGrid.insertCylinder(new THREE.Vector3(x, 0.6, z), 2, 1.2);
        }
    }

    private buildBar() {
        const counter = this.matte(0x2a1c2e, 0.4, 0.5);
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
        const body = this.lit(0xffd166, 0.35);
        const dark = this.matte(0x14101c, 0.4, 0.6);
        const glass = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x1a2430,
            roughness: 0.08,
            metalness: 0.6,
            transparent: true,
            opacity: 0.75,
        }));

        const car = new THREE.Group();
        car.position.set(-30, 0.55, 20);
        car.rotation.y = 0.75;

        const pad = this.mesh(new THREE.CylinderGeometry(6.4, 6.8, 0.5, 32), this.matte(0x241a34, 0.4, 0.5), [0, -0.55, 0]);
        car.add(pad);

        const padRing = this.mesh(new THREE.TorusGeometry(6.4, 0.14, 8, 40), this.glow(0xffd166, 0.8), [0, -0.32, 0], [-Math.PI / 2, 0, 0]);
        padRing.castShadow = false;
        car.add(padRing);

        const hull = this.mesh(new THREE.BoxGeometry(4.6, 0.5, 2.1), body, [0, 0.45, 0]);
        car.add(hull);

        const nose = this.mesh(new THREE.BoxGeometry(1.6, 0.34, 2), body, [2.6, 0.4, 0], [0, 0, -0.06]);
        car.add(nose);

        const tail = this.mesh(new THREE.BoxGeometry(1.3, 0.42, 2.05), body, [-2.4, 0.48, 0]);
        car.add(tail);

        const cabin = this.mesh(new THREE.BoxGeometry(2.2, 0.5, 1.75), glass, [-0.2, 0.92, 0]);
        car.add(cabin);

        const wing = this.mesh(new THREE.BoxGeometry(0.7, 0.1, 2.2), dark, [-3, 1.05, 0]);
        car.add(wing);

        for (const side of [-1, 1]) {
            const support = this.mesh(new THREE.BoxGeometry(0.16, 0.5, 0.16), dark, [-3, 0.8, side * 0.8]);
            car.add(support);
        }

        for (const [dx, dz] of [[1.6, 1], [1.6, -1], [-1.6, 1], [-1.6, -1]] as Array<[number, number]>) {
            const wheel = this.mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.36, 14), dark, [dx, 0.15, dz * 1.05], [Math.PI / 2, 0, 0]);
            car.add(wheel);

            const hubCap = this.mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.4, 10), this.metal(0xd8d8e0, 0.25, 0.95), [dx, 0.15, dz * 1.05], [Math.PI / 2, 0, 0]);
            car.add(hubCap);
        }

        const headlight = this.mesh(new THREE.BoxGeometry(0.2, 0.14, 1.5), this.glow(0xfff3c4, 0.95), [3.35, 0.45, 0]);
        headlight.castShadow = false;
        car.add(headlight);

        const taillight = this.mesh(new THREE.BoxGeometry(0.16, 0.12, 1.6), this.glow(0xff4a4a, 0.9), [-3.05, 0.6, 0]);
        taillight.castShadow = false;
        car.add(taillight);

        const spot = new THREE.PointLight(0xffd166, 36, 22, 2);
        spot.position.set(0, 4, 0);
        car.add(spot);

        this.scene.add(car);
        this.collisionGrid.insertCylinder(new THREE.Vector3(-30, 0.8, 20), 6.6, 1.6);
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
            ["WEN LAMBO", "#ffd166", -30, 7.5, 20, 0.75],
            ["ALL IN", "#ff4fd8", 30, 6.2, -16, -0.5],
            ["HOUSE ALWAYS PUMPS", "#4fd1ff", -18, 5.4, 6, 0.2],
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
            position: new THREE.Vector3(-18, 0, 3.2),
            set: "highRoller",
            variantIndex: 0,
            facing: 0,
            pose: "work",
            phase: 0.5,
        });

        const tableSpots: Array<[number, number, number]> = [
            [-26, -10, 0.3],
            [-12, -14, -0.4],
            [14, -12, 0.5],
            [24, 4, -0.8],
            [20, -20, 0.2],
        ];

        for (let t = 0; t < tableSpots.length; t++) {
            const [x, z, rotation] = tableSpots[t];
            for (let s = 0; s < 3; s++) {
                const angle = -0.9 + s * 0.9 + rotation;
                specs.push({
                    position: new THREE.Vector3(x + Math.cos(angle) * 2.9, seatedActorY(0.72), z + Math.sin(angle) * 2.9),
                    set: "highRoller",
                    lookAt: new THREE.Vector3(x, 1, z),
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
            const angle = 0.5 + i * 0.7;
            specs.push({
                position: new THREE.Vector3(
                    CHART_CENTER.x + Math.cos(angle) * 13.5,
                    0,
                    CHART_CENTER.z + Math.sin(angle) * 13.5
                ),
                set: "highRoller",
                lookAt: new THREE.Vector3(CHART_CENTER.x, 8, CHART_CENTER.z),
                pose: i % 2 === 0 ? "cheer" : "gawk",
                phase: this.random() * 9,
            });
        }

        specs.push({
            position: new THREE.Vector3(-26, 0, 17),
            set: "highRoller",
            variantIndex: 2,
            lookAt: new THREE.Vector3(-30, 1, 20),
            pose: "gawk",
            phase: 3,
        });

        const walkers: Array<[number, number, number, number]> = [
            [-36, -24, 34, -24],
            [36, 22, -36, 26],
            [0, -24, 0, 6],
            [-20, 26, 22, 28],
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

        this.crowd.addMany(specs);
    }

    protected tick(delta: number): void {
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
