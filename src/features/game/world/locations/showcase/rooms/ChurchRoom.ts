// src/features/game/world/locations/showcase/rooms/ChurchRoom.ts
import * as THREE from "three";
import { ShowcaseRoom } from "../ShowcaseRoom";
import { ResourceManager } from "../../../../core/ResourceManager";
import { SHOWCASE_INFO_BY_ID, ShowcaseInfo } from "../config";
import { CrowdSpec } from "../actors/ShowcaseCrowd";
import { footRestY, seatedActorY } from "../actors/poses";

const HALF_WIDTH = 15;
const WALL_HEIGHT = 21;
const NAVE_START = -34;
const NAVE_END = 40;
const ALTAR_Z = 30;
const PULPIT_Z = 21;
const PEW_ROWS = 13;
const PEW_FIRST_Z = -22;
const PEW_STEP = 2.9;
const SEAT_TOP = 0.46;
const WINDOW_BAYS = 6;
const COLUMN_X = 11.4;

export class ChurchRoom extends ShowcaseRoom {
    private shaftMaterials: THREE.MeshBasicMaterial[] = [];
    private candleLights: THREE.PointLight[] = [];
    private motes: THREE.Points | null = null;
    private idol: THREE.Group | null = null;
    private chartCandles: THREE.Mesh[] = [];
    private chartBaseY: number[] = [];

    constructor(info: ShowcaseInfo = SHOWCASE_INFO_BY_ID.get("show-church") as ShowcaseInfo) {
        super(info, 0x51a3c7, 60);
        this.exitPosition.set(0, 0, NAVE_START + 3);
        this.exitFacing = 0;
        this.spawnPosition.set(0, 0, NAVE_START + 13);
    }

    protected buildAtmosphere(): void {
        this.scene.background = new THREE.Color(0x120d09);
        this.scene.fog = new THREE.FogExp2(0x1a120c, 0.011);

        this.scene.add(new THREE.AmbientLight(0x4a3a2c, 0.55));
        this.scene.add(new THREE.HemisphereLight(0x6b5a44, 0x1a1410, 0.6));

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

        const fill = new THREE.DirectionalLight(0x8fa6d8, 0.35);
        fill.position.set(-40, 26, -30);
        this.scene.add(fill);

        const altarGlow = new THREE.PointLight(0xffc46a, 60, 60, 2);
        altarGlow.position.set(0, 9, ALTAR_Z - 2);
        this.scene.add(altarGlow);
    }

    protected decorate(_rm: ResourceManager): void {
        this.buildShell();
        this.buildColumns();
        this.buildWindows();
        this.buildApse();
        this.buildPulpit();
        this.buildPews();
        this.buildChandeliers();
        this.buildMotes();
        this.buildCrowd();
    }

    private buildShell() {
        const stone = this.matte(0x6b5f4e, 0.92, 0.05);
        const darkStone = this.matte(0x4c4437, 0.94, 0.04);
        const carpet = this.matte(0x7c2230, 0.96, 0.02);

        const floor = this.mesh(
            new THREE.BoxGeometry(HALF_WIDTH * 2, 0.6, NAVE_END - NAVE_START),
            stone,
            [0, -0.3, (NAVE_START + NAVE_END) / 2]
        );
        floor.receiveShadow = true;
        floor.castShadow = false;
        this.scene.add(floor);

        const runner = this.mesh(
            new THREE.BoxGeometry(5.2, 0.06, NAVE_END - NAVE_START - 10),
            carpet,
            [0, 0.03, (NAVE_START + NAVE_END) / 2 - 2]
        );
        runner.castShadow = false;
        this.scene.add(runner);

        for (const side of [-1, 1]) {
            const wall = this.mesh(
                new THREE.BoxGeometry(1.6, WALL_HEIGHT, NAVE_END - NAVE_START),
                stone,
                [side * HALF_WIDTH, WALL_HEIGHT / 2, (NAVE_START + NAVE_END) / 2]
            );
            this.scene.add(wall);
            this.collisionGrid.insertOrientedBox(side * HALF_WIDTH, (NAVE_START + NAVE_END) / 2, 1.6, NAVE_END - NAVE_START, 0, 0, WALL_HEIGHT);
        }

        const back = this.mesh(
            new THREE.BoxGeometry(HALF_WIDTH * 2 + 1.6, WALL_HEIGHT, 1.6),
            darkStone,
            [0, WALL_HEIGHT / 2, NAVE_START]
        );
        this.scene.add(back);
        this.collisionGrid.insertOrientedBox(0, NAVE_START, HALF_WIDTH * 2 + 1.6, 1.6, 0, 0, WALL_HEIGHT);

        const far = this.mesh(
            new THREE.BoxGeometry(HALF_WIDTH * 2 + 1.6, WALL_HEIGHT + 6, 1.6),
            darkStone,
            [0, (WALL_HEIGHT + 6) / 2, NAVE_END]
        );
        this.scene.add(far);
        this.collisionGrid.insertOrientedBox(0, NAVE_END, HALF_WIDTH * 2 + 1.6, 1.6, 0, 0, WALL_HEIGHT);

        const ceiling = this.mesh(
            new THREE.BoxGeometry(HALF_WIDTH * 2 + 2, 1.2, NAVE_END - NAVE_START + 2),
            darkStone,
            [0, WALL_HEIGHT + 1.2, (NAVE_START + NAVE_END) / 2]
        );
        ceiling.castShadow = false;
        this.scene.add(ceiling);

        const ceilingRib = this.bin.geometry(new THREE.TorusGeometry(HALF_WIDTH - 0.6, 0.62, 8, 20, Math.PI));
        const vaultSkin = this.matte(0x3b342a, 0.95, 0.03);

        for (let z = NAVE_START + 2; z <= NAVE_END - 2; z += 4.5) {
            const rib = new THREE.Mesh(ceilingRib, darkStone);
            rib.position.set(0, WALL_HEIGHT - 0.4, z);
            rib.rotation.y = Math.PI / 2;
            rib.castShadow = true;
            this.scene.add(rib);
        }

        const vault = this.mesh(
            new THREE.CylinderGeometry(HALF_WIDTH - 0.4, HALF_WIDTH - 0.4, NAVE_END - NAVE_START, 22, 1, true, 0, Math.PI),
            vaultSkin,
            [0, WALL_HEIGHT - 0.4, (NAVE_START + NAVE_END) / 2],
            [0, 0, 0]
        );
        vault.rotation.z = Math.PI / 2;
        vault.rotation.y = Math.PI / 2;
        (vault.material as THREE.Material).side = THREE.BackSide;
        vault.castShadow = false;
        this.scene.add(vault);
    }

    private buildColumns() {
        const stone = this.matte(0x7a6d59, 0.9, 0.05);
        const shaft = this.bin.geometry(new THREE.CylinderGeometry(0.92, 1.05, WALL_HEIGHT - 3.5, 14));
        const capital = this.bin.geometry(new THREE.CylinderGeometry(1.35, 0.95, 1.1, 14));
        const plinth = this.bin.geometry(new THREE.BoxGeometry(2.6, 0.8, 2.6));

        for (let z = NAVE_START + 6; z <= ALTAR_Z - 2; z += 7.4) {
            for (const side of [-1, 1]) {
                const x = side * COLUMN_X;

                const base = new THREE.Mesh(plinth, stone);
                base.position.set(x, 0.4, z);
                base.castShadow = true;
                base.receiveShadow = true;
                this.scene.add(base);

                const body = new THREE.Mesh(shaft, stone);
                body.position.set(x, (WALL_HEIGHT - 3.5) / 2 + 0.8, z);
                body.castShadow = true;
                this.scene.add(body);

                const top = new THREE.Mesh(capital, stone);
                top.position.set(x, WALL_HEIGHT - 2.2, z);
                top.castShadow = true;
                this.scene.add(top);

                this.collisionGrid.insertCylinder(new THREE.Vector3(x, WALL_HEIGHT / 2, z), 1.15, WALL_HEIGHT);
            }
        }
    }

    private buildWindows() {
        const frame = this.matte(0x3e372c, 0.9, 0.05);
        const glassColors = [0x4fd1ff, 0x4ade80, 0xffd166, 0xff6f61, 0xa855f7, 0x67c9ff];
        const spacing = (ALTAR_Z - 4 - (NAVE_START + 6)) / (WINDOW_BAYS - 1);

        for (let i = 0; i < WINDOW_BAYS; i++) {
            const z = NAVE_START + 6 + i * spacing;

            for (const side of [-1, 1]) {
                const x = side * (HALF_WIDTH - 0.7);
                const group = new THREE.Group();
                group.position.set(x, 11.5, z);
                group.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;

                const casing = new THREE.Mesh(this.bin.geometry(new THREE.BoxGeometry(4.6, 9.4, 0.5)), frame);
                group.add(casing);

                const glassMaterial = this.bin.material(new THREE.MeshStandardMaterial({
                    color: glassColors[(i + (side > 0 ? 3 : 0)) % glassColors.length],
                    emissive: glassColors[(i + (side > 0 ? 3 : 0)) % glassColors.length],
                    emissiveIntensity: 2.6,
                    roughness: 0.3,
                    metalness: 0,
                    toneMapped: false,
                }));

                const pane = new THREE.Mesh(this.bin.geometry(new THREE.BoxGeometry(3.5, 8.1, 0.24)), glassMaterial);
                pane.position.z = 0.2;
                group.add(pane);

                const rose = new THREE.Mesh(
                    this.bin.geometry(new THREE.TorusGeometry(1.1, 0.18, 8, 18)),
                    this.metal(0xd8b46a, 0.35, 0.8)
                );
                rose.position.set(0, 1.6, 0.34);
                group.add(rose);

                for (let s = 0; s < 4; s++) {
                    const spoke = new THREE.Mesh(this.bin.geometry(new THREE.BoxGeometry(0.14, 2.2, 0.12)), frame);
                    spoke.position.set(0, 1.6, 0.34);
                    spoke.rotation.z = (s / 4) * Math.PI;
                    group.add(spoke);
                }

                const mullion = new THREE.Mesh(this.bin.geometry(new THREE.BoxGeometry(0.2, 8.1, 0.3)), frame);
                mullion.position.z = 0.26;
                group.add(mullion);

                this.scene.add(group);

                const shaftMaterial = this.glow(glassColors[(i + (side > 0 ? 3 : 0)) % glassColors.length], 0.03);
                this.shaftMaterials.push(shaftMaterial);

                const beam = new THREE.Mesh(
                    this.bin.geometry(new THREE.CylinderGeometry(1.9, 4.4, 26, 14, 1, true)),
                    shaftMaterial
                );
                beam.position.set(x - side * 7, 5.4, z + 2.4);
                beam.rotation.z = side * 0.52;
                beam.rotation.x = -0.14;
                beam.renderOrder = 3;
                this.scene.add(beam);
            }
        }
    }

    private buildApse() {
        const stone = this.matte(0x6b5f4e, 0.92, 0.05);
        const gold = this.metal(0xe0b552, 0.28, 0.95);
        const goldDark = this.metal(0x8c6b28, 0.5, 0.8);

        const apse = this.mesh(
            new THREE.CylinderGeometry(HALF_WIDTH - 0.6, HALF_WIDTH - 0.6, WALL_HEIGHT, 24, 1, true, -Math.PI / 2, Math.PI),
            stone,
            [0, WALL_HEIGHT / 2, NAVE_END - 6]
        );
        (apse.material as THREE.Material).side = THREE.BackSide;
        this.scene.add(apse);
        this.collisionGrid.insertOrientedBox(0, NAVE_END - 2, HALF_WIDTH * 2, 4, 0, 0, WALL_HEIGHT);

        for (let step = 0; step < 3; step++) {
            const width = 20 - step * 3;
            const depth = 10 - step * 2.2;
            const height = 0.42;
            const y = step * height + height / 2;
            const stair = this.mesh(
                new THREE.BoxGeometry(width, height, depth),
                stone,
                [0, y, ALTAR_Z - 4 + step * 1.1]
            );
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

        const arrowStem = new THREE.Mesh(this.bin.geometry(new THREE.BoxGeometry(1.9, 6.4, 0.9)), goldDark);
        arrowStem.position.set(0, -1.3, 1.2);
        idol.add(arrowStem);

        const arrowHead = new THREE.Mesh(this.bin.geometry(new THREE.ConeGeometry(3.1, 3.6, 3)), goldDark);
        arrowHead.position.set(0, 3.7, 1.2);
        arrowHead.rotation.y = Math.PI;
        idol.add(arrowHead);

        const arrowShadow = new THREE.Mesh(this.bin.geometry(new THREE.CircleGeometry(5.6, 32)), this.matte(0xb8882f, 0.6, 0.6));
        arrowShadow.position.set(0, 0, 0.75);
        idol.add(arrowShadow);

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

        const altarTable = this.mesh(new THREE.BoxGeometry(7.4, 1.5, 3), this.matte(0x5b4a34, 0.85), [0, 2.05, ALTAR_Z]);
        this.scene.add(altarTable);
        this.collisionGrid.insertOrientedBox(0, ALTAR_Z, 7.4, 3, 0, 1.3, 2.8);

        const cloth = this.mesh(new THREE.BoxGeometry(7.8, 0.12, 3.4), this.matte(0x7c2230, 0.9), [0, 2.82, ALTAR_Z]);
        this.scene.add(cloth);

        const chartBase = this.mesh(new THREE.BoxGeometry(9.5, 0.5, 1.6), this.matte(0x3e372c, 0.9), [0, 3.1, ALTAR_Z + 0.2]);
        this.scene.add(chartBase);

        const greenMaterial = this.lit(0x3ddc84, 1.8);
        for (let i = 0; i < 7; i++) {
            const height = 0.9 + i * 0.62 + (i === 6 ? 1.6 : 0);
            const candle = this.mesh(
                new THREE.BoxGeometry(0.85, height, 0.85),
                greenMaterial,
                [3.6 - i * 1.2, 3.35 + height / 2, ALTAR_Z + 0.2]
            );
            this.scene.add(candle);
            this.chartCandles.push(candle);
            this.chartBaseY.push(candle.position.y);

            const wick = this.mesh(
                new THREE.BoxGeometry(0.14, height * 0.45, 0.14),
                greenMaterial,
                [3.6 - i * 1.2, 3.35 + height + height * 0.2, ALTAR_Z + 0.2]
            );
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
    }

    private buildPulpit() {
        const wood = this.matte(0x54402a, 0.86, 0.05);
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

    private buildPews() {
        const wood = this.matte(0x4a3722, 0.9, 0.03);
        const seat = this.bin.geometry(new THREE.BoxGeometry(9, 0.16, 0.72));
        const back = this.bin.geometry(new THREE.BoxGeometry(9, 0.78, 0.16));
        const leg = this.bin.geometry(new THREE.BoxGeometry(0.34, SEAT_TOP - 0.08, 0.66));
        const kneelerHeight = footRestY(SEAT_TOP);
        const kneeler = this.bin.geometry(new THREE.BoxGeometry(9, 0.14, 0.5));
        const kneelerLeg = this.bin.geometry(new THREE.BoxGeometry(0.22, kneelerHeight, 0.4));

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

                const board = new THREE.Mesh(kneeler, wood);
                board.position.set(0, kneelerHeight, 0.95);
                board.receiveShadow = true;
                group.add(board);

                this.scene.add(group);
                this.collisionGrid.insertOrientedBox(cx, z, 9, 0.9, 0, 0, SEAT_TOP + 0.5);
            }
        }
    }

    private buildChandeliers() {
        const iron = this.matte(0x2b2620, 0.8, 0.4);

        for (let i = 0; i < 4; i++) {
            const z = -18 + i * 12;
            const group = new THREE.Group();
            group.position.set(0, 13.4, z);

            const chain = this.mesh(new THREE.CylinderGeometry(0.06, 0.06, 6, 6), iron, [0, 4.2, 0]);
            group.add(chain);

            const ring = this.mesh(new THREE.TorusGeometry(2.5, 0.12, 8, 24), iron, [0, 0, 0], [Math.PI / 2, 0, 0]);
            group.add(ring);

            const innerRing = this.mesh(new THREE.TorusGeometry(1.4, 0.09, 8, 20), iron, [0, 0.6, 0], [Math.PI / 2, 0, 0]);
            group.add(innerRing);

            for (let c = 0; c < 10; c++) {
                const angle = (c / 10) * Math.PI * 2;
                const wax = this.mesh(
                    new THREE.CylinderGeometry(0.11, 0.13, 0.72, 8),
                    this.matte(0xe8dcc0, 0.85),
                    [Math.cos(angle) * 2.5, 0.5, Math.sin(angle) * 2.5]
                );
                group.add(wax);

                const flame = this.mesh(
                    new THREE.ConeGeometry(0.12, 0.36, 8),
                    this.glow(0xffc06a, 0.95),
                    [Math.cos(angle) * 2.5, 1.06, Math.sin(angle) * 2.5]
                );
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
            positions[i * 3 + 2] = NAVE_START + this.random() * (NAVE_END - NAVE_START);
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
                lookAt: new THREE.Vector3(-6.4, 1.6, PULPIT_Z),
                pose: "carry",
                held: "candle",
                heldLight: true,
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

        for (let i = 0; i < 5; i++) {
            const side = i % 2 === 0 ? -1 : 1;
            specs.push({
                position: new THREE.Vector3(side * (HALF_WIDTH - 3.2), 0, -14 + i * 8),
                set: "flock",
                lookAt: altarLook,
                pose: "pray",
                held: "candle",
                heldLight: i < 2,
                phase: this.random() * 10,
            });
        }

        const walkers: Array<[number, number, number, number]> = [
            [-13.2, -26, -13.2, 18],
            [13.2, 16, 13.2, -24],
            [-9.8, 22, 9.8, 22],
            [12.4, -6, 3.4, -28],
        ];

        for (const [x1, z1, x2, z2] of walkers) {
            specs.push({
                position: new THREE.Vector3(x1, 0, z1),
                set: "flock",
                pose: undefined,
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
