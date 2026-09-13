// src/features/game/world/locations/showcase/rooms/WarRoom.ts
import * as THREE from "three";
import { ShowcaseRoom } from "../ShowcaseRoom";
import { ResourceManager } from "../../../../core/ResourceManager";
import { SHOWCASE_INFO_BY_ID, ShowcaseInfo } from "../config";
import { CrowdSpec } from "../actors/ShowcaseCrowd";

const RED_LINE = -16;
const BLUE_LINE = 16;
const STREET_HALF = 74;
const TRACER_COUNT = 26;
const ROCKET_COUNT = 5;
const BLAST_COUNT = 4;
const EMBER_COUNT = 300;

interface Tracer {
    mesh: THREE.Mesh;
    from: THREE.Vector3;
    to: THREE.Vector3;
    life: number;
    duration: number;
}

interface Rocket {
    group: THREE.Group;
    trail: THREE.Mesh;
    from: THREE.Vector3;
    to: THREE.Vector3;
    life: number;
    duration: number;
    height: number;
}

interface Blast {
    core: THREE.Mesh;
    shock: THREE.Mesh;
    light: THREE.PointLight;
    life: number;
    duration: number;
    cooldown: number;
}

export class WarRoom extends ShowcaseRoom {
    private tracers: Tracer[] = [];
    private rockets: Rocket[] = [];
    private blasts: Blast[] = [];
    private fireLights: THREE.PointLight[] = [];
    private fireMaterials: THREE.MeshBasicMaterial[] = [];
    private smokeColumns: THREE.Mesh[] = [];
    private embers: THREE.Points | null = null;
    private emberVelocity: Float32Array = new Float32Array(0);
    private skyFlash: THREE.PointLight | null = null;
    private flashTimer = 0;
    private searchlights: THREE.Mesh[] = [];
    private turrets: THREE.Object3D[] = [];

    constructor(info: ShowcaseInfo = SHOWCASE_INFO_BY_ID.get("show-war") as ShowcaseInfo) {
        super(info, 0x9d34f1, 86);
        this.exitPosition.set(0, 0, -48);
        this.exitFacing = 0;
        this.spawnPosition.set(0, 0, -40);
    }

    protected buildAtmosphere(): void {
        this.scene.background = new THREE.Color(0x14100f);
        this.scene.fog = new THREE.FogExp2(0x1c1410, 0.0135);

        this.scene.add(new THREE.AmbientLight(0x39324a, 0.65));
        this.scene.add(new THREE.HemisphereLight(0x4a4262, 0x1a1512, 0.65));

        const moon = new THREE.DirectionalLight(0x9fb0e8, 0.85);
        moon.position.set(-60, 70, -40);
        moon.target.position.set(0, 0, 0);
        moon.castShadow = true;
        moon.shadow.mapSize.set(2048, 2048);
        moon.shadow.camera.left = -80;
        moon.shadow.camera.right = 80;
        moon.shadow.camera.top = 80;
        moon.shadow.camera.bottom = -80;
        moon.shadow.camera.near = 5;
        moon.shadow.camera.far = 260;
        moon.shadow.bias = -0.0005;
        moon.shadow.normalBias = 0.06;
        moon.shadow.camera.updateProjectionMatrix();
        this.scene.add(moon);
        this.scene.add(moon.target);

        const horizon = new THREE.DirectionalLight(0xff6a33, 0.5);
        horizon.position.set(50, 12, 60);
        this.scene.add(horizon);

        this.skyFlash = new THREE.PointLight(0xffb066, 0, 320, 2);
        this.skyFlash.position.set(0, 90, 40);
        this.scene.add(this.skyFlash);

        const glow = this.mesh(
            new THREE.SphereGeometry(250, 28, 16, 0, Math.PI * 2, Math.PI * 0.455, Math.PI * 0.09),
            this.glow(0xff5a2a, 0.06, false),
            [0, 0, 0]
        );
        glow.castShadow = false;
        glow.receiveShadow = false;
        (glow.material as THREE.Material).side = THREE.BackSide;
        this.scene.add(glow);
    }

    protected decorate(_rm: ResourceManager): void {
        this.buildGround();
        this.buildRuins();
        this.buildTrench(RED_LINE, 0xa8392c, -1);
        this.buildTrench(BLUE_LINE, 0x3f5fa8, 1);
        this.buildNoMansLand();
        this.buildTank(-26, RED_LINE - 9, 0.35, 0x5c3226);
        this.buildTank(24, BLUE_LINE + 10, Math.PI - 0.3, 0x2b3950);
        this.buildWreck(-6, 2, 0.9);
        this.buildWreck(14, -3, -0.4);
        this.buildFires();
        this.buildSmoke();
        this.buildEmbers();
        this.buildTracers();
        this.buildRockets();
        this.buildBlasts();
        this.buildSearchlights();
        this.buildCrowd();
    }

    private buildGround() {
        const dirt = this.matte(0x40362c, 0.98, 0.02);
        const ash = this.matte(0x2e2720, 0.99, 0.01);

        const ground = this.mesh(new THREE.BoxGeometry(STREET_HALF * 2 + 40, 1, 150), dirt, [0, -0.5, 0]);
        ground.castShadow = false;
        this.scene.add(ground);

        for (let i = 0; i < 26; i++) {
            const x = (this.random() - 0.5) * STREET_HALF * 1.8;
            const z = (this.random() - 0.5) * 70;
            const radius = 1.8 + this.random() * 4.5;

            const crater = this.mesh(new THREE.CircleGeometry(radius, 16), ash, [x, 0.012, z], [-Math.PI / 2, 0, 0]);
            crater.castShadow = false;
            this.scene.add(crater);

            const lip = this.mesh(new THREE.TorusGeometry(radius, radius * 0.16, 6, 14), dirt, [x, 0.06, z], [-Math.PI / 2, 0, 0]);
            lip.castShadow = false;
            this.scene.add(lip);
        }

        const rubbleGeometry = this.bin.geometry(new THREE.DodecahedronGeometry(1, 0));
        const rubbleMaterial = this.matte(0x3a332c, 0.96, 0.03);
        const rubble = new THREE.InstancedMesh(rubbleGeometry, rubbleMaterial, 240);
        rubble.castShadow = true;
        rubble.receiveShadow = true;

        const matrix = new THREE.Matrix4();
        const quaternion = new THREE.Quaternion();
        const euler = new THREE.Euler();
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3();

        for (let i = 0; i < 240; i++) {
            position.set((this.random() - 0.5) * STREET_HALF * 1.9, this.random() * 0.3, (this.random() - 0.5) * 90);
            euler.set(this.random() * 3, this.random() * 3, this.random() * 3);
            quaternion.setFromEuler(euler);
            const size = 0.25 + this.random() * 1.1;
            scale.set(size, size * 0.7, size);
            matrix.compose(position, quaternion, scale);
            rubble.setMatrixAt(i, matrix);
        }

        rubble.instanceMatrix.needsUpdate = true;
        this.scene.add(rubble);
    }

    private buildRuins() {
        const concrete = this.matte(0x4a443c, 0.96, 0.03);
        const concreteDark = this.matte(0x35302a, 0.97, 0.02);
        const rebar = this.metal(0x6b5a45, 0.7, 0.5);

        const rows: Array<{ z: number; depth: number }> = [
            { z: -62, depth: 16 },
            { z: 62, depth: 16 },
            { z: -84, depth: 18 },
            { z: 84, depth: 18 },
        ];

        for (const row of rows) {
            for (let x = -STREET_HALF - 20; x <= STREET_HALF + 20; x += 17 + this.random() * 5) {
                if (Math.abs(x) < 13 && Math.abs(row.z) < 70) continue;
                const width = 10 + this.random() * 6;
                const height = 8 + this.random() * 20;
                const broken = this.random() < 0.55;
                const px = x + (this.random() - 0.5) * 4;
                const pz = row.z + (this.random() - 0.5) * 5;

                const shell = this.mesh(
                    new THREE.BoxGeometry(width, height, row.depth),
                    this.random() < 0.5 ? concrete : concreteDark,
                    [px, height / 2, pz],
                    [0, (this.random() - 0.5) * 0.3, broken ? (this.random() - 0.5) * 0.12 : 0]
                );
                this.scene.add(shell);
                this.collisionGrid.insertOrientedBox(px, pz, width, row.depth, 0, 0, height);

                for (let floor = 1; floor * 3.4 < height; floor++) {
                    const slab = this.mesh(
                        new THREE.BoxGeometry(width + 1.2, 0.34, row.depth + 1),
                        concreteDark,
                        [px, floor * 3.4, pz]
                    );
                    this.scene.add(slab);
                }

                if (broken) {
                    const chunk = this.mesh(
                        new THREE.BoxGeometry(width * 0.6, height * 0.35, row.depth * 0.7),
                        concrete,
                        [px + width * 0.3, height * 0.82, pz - row.depth * 0.2],
                        [0.2, 0.4, 0.35]
                    );
                    this.scene.add(chunk);

                    for (let r = 0; r < 4; r++) {
                        const bar = this.mesh(
                            new THREE.CylinderGeometry(0.06, 0.06, 2.2 + this.random() * 1.6, 5),
                            rebar,
                            [px - width * 0.3 + r * 0.7, height + 0.9, pz + (this.random() - 0.5) * 2],
                            [(this.random() - 0.5) * 0.6, 0, (this.random() - 0.5) * 0.7]
                        );
                        this.scene.add(bar);
                    }
                }

                for (let w = 0; w < 4; w++) {
                    if (this.random() < 0.45) continue;
                    const lit = this.random() < 0.25;
                    const window = this.mesh(
                        new THREE.BoxGeometry(1.7, 2.3, 0.3),
                        lit ? this.lit(0xffa14a, 1.6) : concreteDark,
                        [px - width * 0.3 + w * (width * 0.22), 3 + Math.floor(this.random() * 3) * 3.4, pz - row.depth / 2 - 0.1]
                    );
                    this.scene.add(window);
                }
            }
        }
    }

    private buildTrench(z: number, accent: number, facing: number) {
        const sandbag = this.matte(0x5a5140, 0.98, 0.02);
        const plank = this.matte(0x4a3a28, 0.95, 0.03);
        const bagGeometry = this.bin.geometry(new THREE.CapsuleGeometry(0.34, 0.6, 4, 8));

        for (let x = -58; x <= 58; x += 0.78) {
            const rows = 2;
            for (let r = 0; r < rows; r++) {
                const bag = new THREE.Mesh(bagGeometry, sandbag);
                bag.position.set(
                    x + (r % 2) * 0.38,
                    0.24 + r * 0.42,
                    z + facing * (1.8 - r * 0.14) + (this.random() - 0.5) * 0.12
                );
                bag.rotation.z = Math.PI / 2;
                bag.rotation.y = (this.random() - 0.5) * 0.3;
                bag.scale.setScalar(0.72 + this.random() * 0.12);
                bag.castShadow = true;
                bag.receiveShadow = true;
                this.scene.add(bag);
            }
        }

        this.collisionGrid.insertOrientedBox(0, z + facing * 1.8, 120, 1.5, 0, 0, 1.2);

        for (let x = -54; x <= 54; x += 9) {
            const post = this.mesh(new THREE.BoxGeometry(0.3, 2.4, 0.3), plank, [x, 1.2, z - facing * 0.6]);
            this.scene.add(post);
        }

        for (let x = -50; x <= 50; x += 25) {
            const flagPole = this.mesh(new THREE.CylinderGeometry(0.08, 0.1, 6.5, 8), plank, [x, 3.2, z - facing * 1.6]);
            this.scene.add(flagPole);

            const flag = this.mesh(
                new THREE.PlaneGeometry(3.2, 1.9, 6, 3),
                this.bin.material(new THREE.MeshStandardMaterial({ color: accent, roughness: 0.85, side: THREE.DoubleSide })),
                [x + 1.7, 5.4, z - facing * 1.6]
            );
            this.scene.add(flag);
        }

        const wireGeometry = this.bin.geometry(new THREE.TorusGeometry(0.46, 0.035, 4, 10));
        const wireMaterial = this.metal(0x6a6258, 0.6, 0.7);
        for (let x = -56; x <= 56; x += 2.4) {
            const coil = new THREE.Mesh(wireGeometry, wireMaterial);
            coil.position.set(x, 0.44, z + facing * 4.6 + (this.random() - 0.5) * 0.8);
            coil.rotation.y = Math.PI / 2;
            coil.rotation.x = this.random() * 0.4;
            this.scene.add(coil);
        }
    }

    private buildNoMansLand() {
        const steel = this.metal(0x4a453d, 0.75, 0.6);
        const concrete = this.matte(0x4a443c, 0.96, 0.03);

        for (let i = 0; i < 11; i++) {
            const x = (this.random() < 0.5 ? -1 : 1) * (13 + this.random() * 40);
            const z = (this.random() - 0.5) * 22;
            const width = 3 + this.random() * 3.4;
            const height = 1.5 + this.random() * 2.2;

            const wall = this.mesh(
                new THREE.BoxGeometry(width, height, 0.7),
                concrete,
                [x, height / 2, z],
                [0, this.random() * Math.PI, (this.random() - 0.5) * 0.16]
            );
            this.scene.add(wall);
            this.collisionGrid.insertOrientedBox(x, z, width, 0.9, 0, 0, height);
        }

        for (let i = 0; i < 14; i++) {
            const x = (this.random() - 0.5) * 100;
            const z = (this.random() - 0.5) * 22;

            const hedgehog = new THREE.Group();
            hedgehog.position.set(x, 0.9, z);
            hedgehog.rotation.y = this.random() * Math.PI;

            for (let b = 0; b < 3; b++) {
                const bar = this.mesh(new THREE.BoxGeometry(0.3, 3.4, 0.3), steel, [0, 0, 0], [
                    b === 0 ? 0.9 : b === 1 ? -0.9 : 0,
                    (b / 3) * Math.PI,
                    b === 2 ? 0.9 : 0,
                ]);
                hedgehog.add(bar);
            }

            this.scene.add(hedgehog);
            this.collisionGrid.insertCylinder(new THREE.Vector3(x, 1, z), 1.4, 2.6);
        }
    }

    private buildTank(x: number, z: number, rotation: number, color: number) {
        const hullMaterial = this.matte(color, 0.72, 0.35);
        const trackMaterial = this.matte(0x1e1b18, 0.9, 0.2);
        const group = new THREE.Group();
        group.position.set(x, 0, z);
        group.rotation.y = rotation;

        const hull = this.mesh(new THREE.BoxGeometry(7.2, 1.5, 3.6), hullMaterial, [0, 1.55, 0]);
        group.add(hull);

        const glacis = this.mesh(new THREE.BoxGeometry(2.4, 1.2, 3.5), hullMaterial, [3.2, 1.5, 0], [0, 0, -0.5]);
        group.add(glacis);

        for (const side of [-1, 1]) {
            const track = this.mesh(new THREE.BoxGeometry(7.6, 1.1, 0.95), trackMaterial, [0, 0.6, side * 1.75]);
            group.add(track);

            for (let w = 0; w < 5; w++) {
                const wheel = this.mesh(
                    new THREE.CylinderGeometry(0.55, 0.55, 0.5, 12),
                    trackMaterial,
                    [-2.8 + w * 1.4, 0.6, side * 1.75],
                    [Math.PI / 2, 0, 0]
                );
                group.add(wheel);
            }
        }

        const turret = new THREE.Group();
        turret.position.set(-0.4, 2.45, 0);

        const dome = this.mesh(new THREE.CylinderGeometry(1.5, 1.75, 1.1, 12), hullMaterial, [0, 0, 0]);
        turret.add(dome);

        const barrel = this.mesh(new THREE.CylinderGeometry(0.22, 0.26, 5.4, 10), hullMaterial, [3.1, 0.05, 0], [0, 0, Math.PI / 2]);
        turret.add(barrel);

        const brake = this.mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.7, 10), trackMaterial, [5.6, 0.05, 0], [0, 0, Math.PI / 2]);
        turret.add(brake);

        const hatch = this.mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.22, 10), trackMaterial, [-0.6, 0.62, 0.3]);
        turret.add(hatch);

        group.add(turret);
        this.turrets.push(turret);

        this.scene.add(group);
        this.collisionGrid.insertOrientedBox(x, z, 7.6, 4, rotation, 0, 3.2);
    }

    private buildWreck(x: number, z: number, rotation: number) {
        const burnt = this.matte(0x2a2622, 0.98, 0.08);
        const group = new THREE.Group();
        group.position.set(x, 0, z);
        group.rotation.set(0.12, rotation, 0.22);

        const body = this.mesh(new THREE.BoxGeometry(4.2, 1.1, 2), burnt, [0, 0.8, 0]);
        group.add(body);

        const cabin = this.mesh(new THREE.BoxGeometry(2.1, 0.9, 1.85), burnt, [-0.3, 1.6, 0]);
        group.add(cabin);

        for (const [dx, dz] of [[-1.4, -1], [-1.4, 1], [1.4, -1], [1.4, 1]] as Array<[number, number]>) {
            const wheel = this.mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 10), burnt, [dx, 0.45, dz], [Math.PI / 2, 0, 0]);
            group.add(wheel);
        }

        this.scene.add(group);
        this.collisionGrid.insertOrientedBox(x, z, 4.6, 2.4, rotation, 0, 2.2);
    }

    private buildFires() {
        const barrelMaterial = this.matte(0x3a332c, 0.9, 0.3);

        const spots: Array<[number, number]> = [
            [-34, -20], [-12, -19], [10, -21], [30, -18],
            [-28, 20], [-4, 21], [18, 19], [36, 22],
            [-46, 4], [44, -6],
        ];

        for (const [x, z] of spots) {
            const barrel = this.mesh(new THREE.CylinderGeometry(0.7, 0.75, 1.5, 12), barrelMaterial, [x, 0.75, z]);
            this.scene.add(barrel);

            const fireMaterial = this.glow(0xff8a2a, 0.85);
            this.fireMaterials.push(fireMaterial);

            const flame = this.mesh(new THREE.ConeGeometry(0.42, 1.25, 10), fireMaterial, [x, 2.05, z]);
            flame.castShadow = false;
            this.scene.add(flame);

            const light = new THREE.PointLight(0xff7a2a, 15, 18, 2);
            light.position.set(x, 2.4, z);
            this.scene.add(light);
            this.fireLights.push(light);
        }
    }

    private buildSmoke() {
        const spots: Array<[number, number, number]> = [
            [-58, -56, 12], [34, 58, 16], [72, -48, 10], [-78, 46, 14], [8, -62, 9],
        ];

        for (const [x, z, height] of spots) {
            const material = this.glow(0x5a5048, 0.09, false);
            const column = this.mesh(
                new THREE.CylinderGeometry(height * 0.5, height * 0.16, height * 3.4, 12, 1, true),
                material,
                [x, height * 1.7, z]
            );
            column.castShadow = false;
            column.renderOrder = 2;
            this.scene.add(column);
            this.smokeColumns.push(column);
        }
    }

    private buildEmbers() {
        const positions = new Float32Array(EMBER_COUNT * 3);
        this.emberVelocity = new Float32Array(EMBER_COUNT * 3);

        for (let i = 0; i < EMBER_COUNT; i++) {
            positions[i * 3] = (this.random() - 0.5) * 120;
            positions[i * 3 + 1] = this.random() * 26;
            positions[i * 3 + 2] = (this.random() - 0.5) * 90;
            this.emberVelocity[i * 3] = (this.random() - 0.5) * 1.4;
            this.emberVelocity[i * 3 + 1] = 0.9 + this.random() * 2.4;
            this.emberVelocity[i * 3 + 2] = (this.random() - 0.5) * 1.4;
        }

        const geometry = this.bin.geometry(new THREE.BufferGeometry());
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        const material = this.bin.material(new THREE.PointsMaterial({
            color: 0xff9a4a,
            size: 0.17,
            transparent: true,
            opacity: 0.8,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            fog: false,
        }));

        const points = new THREE.Points(geometry, material);
        points.frustumCulled = false;
        this.scene.add(points);
        this.embers = points;
    }

    private buildTracers() {
        const geometry = this.bin.geometry(new THREE.CylinderGeometry(0.055, 0.055, 2.6, 5));

        for (let i = 0; i < TRACER_COUNT; i++) {
            const fromRed = i % 2 === 0;
            const material = this.glow(fromRed ? 0xff7a4a : 0x7ac8ff, 0.95);
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = false;
            mesh.visible = false;
            this.scene.add(mesh);

            this.tracers.push({
                mesh,
                from: new THREE.Vector3(),
                to: new THREE.Vector3(),
                life: this.random() * 2,
                duration: 0.35 + this.random() * 0.5,
            });
        }
    }

    private buildRockets() {
        for (let i = 0; i < ROCKET_COUNT; i++) {
            const group = new THREE.Group();
            group.visible = false;

            const body = this.mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.5, 8), this.matte(0x6a6258, 0.6, 0.5), [0, 0, 0], [Math.PI / 2, 0, 0]);
            group.add(body);

            const nose = this.mesh(new THREE.ConeGeometry(0.2, 0.5, 8), this.matte(0x8a8278, 0.5, 0.6), [0, 0, 0.95], [Math.PI / 2, 0, 0]);
            group.add(nose);

            const trail = this.mesh(
                new THREE.CylinderGeometry(0.06, 0.55, 7, 8, 1, true),
                this.glow(0xffb066, 0.35),
                [0, 0, -3.6],
                [Math.PI / 2, 0, 0]
            );
            trail.castShadow = false;
            group.add(trail);

            const light = new THREE.PointLight(0xffa14a, 10, 18, 2);
            group.add(light);

            this.scene.add(group);
            this.rockets.push({
                group,
                trail,
                from: new THREE.Vector3(),
                to: new THREE.Vector3(),
                life: this.random() * 6,
                duration: 2.4 + this.random() * 1.6,
                height: 18 + this.random() * 10,
            });
        }
    }

    private buildBlasts() {
        for (let i = 0; i < BLAST_COUNT; i++) {
            const core = this.mesh(new THREE.SphereGeometry(1, 14, 10), this.glow(0xffd08a, 0.9), [0, -50, 0]);
            core.castShadow = false;
            core.visible = false;
            this.scene.add(core);

            const shock = this.mesh(new THREE.TorusGeometry(1, 0.16, 8, 24), this.glow(0xffe0b0, 0.6), [0, -50, 0], [-Math.PI / 2, 0, 0]);
            shock.castShadow = false;
            shock.visible = false;
            this.scene.add(shock);

            const light = new THREE.PointLight(0xffb066, 0, 60, 2);
            this.scene.add(light);

            this.blasts.push({
                core,
                shock,
                light,
                life: 0,
                duration: 0.85,
                cooldown: 1 + this.random() * 5,
            });
        }
    }

    private buildSearchlights() {
        for (let i = 0; i < 3; i++) {
            const x = -50 + i * 50;
            const z = i % 2 === 0 ? -52 : 52;

            const base = this.mesh(new THREE.BoxGeometry(2, 1.2, 2), this.matte(0x3a342c, 0.9), [x, 0.6, z]);
            this.scene.add(base);

            const beam = this.mesh(
                new THREE.CylinderGeometry(0.8, 6.5, 60, 14, 1, true),
                this.glow(0xbfd6ff, 0.07),
                [x, 26, z]
            );
            beam.castShadow = false;
            beam.renderOrder = 2;
            this.scene.add(beam);
            this.searchlights.push(beam);
        }
    }

    private buildCrowd() {
        const specs: CrowdSpec[] = [];

        for (let i = 0; i < 11; i++) {
            const x = -46 + i * 9 + (this.random() - 0.5) * 3;
            specs.push({
                position: new THREE.Vector3(x, 0, RED_LINE + 0.1),
                set: "soldierRed",
                facing: 0,
                pose: this.random() < 0.32 ? "crouchAim" : "aim",
                held: "rifle",
                phase: this.random() * 8,
                solid: false,
            });
        }

        for (let i = 0; i < 11; i++) {
            const x = -44 + i * 9 + (this.random() - 0.5) * 3;
            specs.push({
                position: new THREE.Vector3(x, 0, BLUE_LINE - 0.1),
                set: "soldierBlue",
                facing: Math.PI,
                pose: this.random() < 0.32 ? "crouchAim" : "aim",
                held: "rifle",
                phase: this.random() * 8,
                solid: false,
            });
        }

        const runners: Array<[number, number, number, number, boolean]> = [
            [-30, RED_LINE - 6, 10, RED_LINE - 6, true],
            [26, RED_LINE - 10, -18, RED_LINE - 10, true],
            [-20, BLUE_LINE + 7, 22, BLUE_LINE + 7, true],
            [34, BLUE_LINE + 11, -8, BLUE_LINE + 11, true],
            [-52, RED_LINE - 14, -52, -40, false],
            [46, BLUE_LINE + 15, 46, 40, false],
        ];

        for (const [x1, z1, x2, z2, red] of runners) {
            specs.push({
                position: new THREE.Vector3(x1, 0, z1),
                set: red ? "soldierRed" : "soldierBlue",
                walk: {
                    path: [new THREE.Vector3(x1, 0, z1), new THREE.Vector3(x2, 0, z2)],
                    mode: "pingpong",
                    run: true,
                    pause: 1.5 + this.random() * 2,
                },
                held: "rifle",
                phase: this.random() * 8,
            });
        }

        const crews: Array<[number, number, number, "work" | "salute" | "carry"]> = [
            [-26, RED_LINE - 12, 0.6, "work"],
            [-23, RED_LINE - 13, 1.2, "carry"],
            [24, BLUE_LINE + 13, Math.PI - 0.5, "work"],
            [21, BLUE_LINE + 14, Math.PI, "salute"],
            [-48, RED_LINE - 20, 0.2, "work"],
        ];

        for (const [x, z, facing, pose] of crews) {
            specs.push({
                position: new THREE.Vector3(x, 0, z),
                set: z < 0 ? "soldierRed" : "soldierBlue",
                facing,
                pose,
                held: pose === "carry" ? "bag" : undefined,
                phase: this.random() * 8,
            });
        }

        this.crowd.addMany(specs);
    }

    private resetTracer(tracer: Tracer) {
        const fromRed = this.random() < 0.5;
        const startZ = fromRed ? RED_LINE - 1 : BLUE_LINE + 1;
        const endZ = fromRed ? BLUE_LINE + 2 : RED_LINE - 2;

        tracer.from.set((this.random() - 0.5) * 100, 1.6 + this.random() * 1.2, startZ);
        tracer.to.set(tracer.from.x + (this.random() - 0.5) * 26, 1.2 + this.random() * 2.4, endZ);
        tracer.duration = 0.3 + this.random() * 0.45;
        tracer.life = 0;

        const material = tracer.mesh.material as THREE.MeshBasicMaterial;
        material.color.setHex(fromRed ? 0xff7a4a : 0x7ac8ff);
    }

    private updateTracers(delta: number) {
        const direction = new THREE.Vector3();
        const position = new THREE.Vector3();

        for (const tracer of this.tracers) {
            tracer.life += delta;

            if (tracer.life >= tracer.duration) {
                if (this.random() < 0.4) {
                    this.resetTracer(tracer);
                    tracer.mesh.visible = true;
                } else {
                    tracer.mesh.visible = false;
                    tracer.life = 0;
                    tracer.duration = 0.2 + this.random() * 0.6;
                }
                continue;
            }

            if (!tracer.mesh.visible) continue;

            const t = tracer.life / tracer.duration;
            position.lerpVectors(tracer.from, tracer.to, t);
            direction.subVectors(tracer.to, tracer.from).normalize();

            tracer.mesh.position.copy(position);
            tracer.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
        }
    }

    private updateRockets(delta: number) {
        const position = new THREE.Vector3();
        const direction = new THREE.Vector3();
        const previous = new THREE.Vector3();

        for (const rocket of this.rockets) {
            rocket.life += delta;

            if (rocket.life >= rocket.duration) {
                rocket.life = -1.5 - this.random() * 5;
                rocket.group.visible = false;

                const fromRed = this.random() < 0.5;
                rocket.from.set((this.random() - 0.5) * 90, 2.4, fromRed ? RED_LINE - 8 : BLUE_LINE + 8);
                rocket.to.set((this.random() - 0.5) * 90, 0.6, fromRed ? BLUE_LINE + 12 : RED_LINE - 12);
                rocket.duration = 2.4 + this.random() * 1.5;
                rocket.height = 16 + this.random() * 12;
                continue;
            }

            if (rocket.life < 0) continue;

            rocket.group.visible = true;
            const t = rocket.life / rocket.duration;
            position.lerpVectors(rocket.from, rocket.to, t);
            position.y += Math.sin(t * Math.PI) * rocket.height;

            const previousT = Math.max(0, t - 0.02);
            previous.lerpVectors(rocket.from, rocket.to, previousT);
            previous.y += Math.sin(previousT * Math.PI) * rocket.height;

            direction.subVectors(position, previous).normalize();
            rocket.group.position.copy(position);
            rocket.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
            (rocket.trail.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(this.elapsed * 22) * 0.08;
        }
    }

    private updateBlasts(delta: number) {
        for (const blast of this.blasts) {
            if (blast.cooldown > 0) {
                blast.cooldown -= delta;
                if (blast.cooldown <= 0) {
                    const x = (this.random() - 0.5) * 110;
                    const z = (this.random() - 0.5) * 60;
                    blast.core.position.set(x, 1.4, z);
                    blast.shock.position.set(x, 0.5, z);
                    blast.light.position.set(x, 3.5, z);
                    blast.core.visible = true;
                    blast.shock.visible = true;
                    blast.life = 0;
                    this.flashTimer = 0.16;
                }
                continue;
            }

            blast.life += delta;
            const t = blast.life / blast.duration;

            if (t >= 1) {
                blast.core.visible = false;
                blast.shock.visible = false;
                blast.light.intensity = 0;
                blast.cooldown = 1.5 + this.random() * 6;
                continue;
            }

            const scale = 1 + t * 4.5;
            blast.core.scale.setScalar(scale * 0.7);
            blast.shock.scale.setScalar(scale * 1.5);
            blast.light.intensity = 300 * (1 - t);
            (blast.core.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t);
            (blast.shock.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - t * t);
        }
    }

    protected tick(delta: number): void {
        const flicker = 0.8 + Math.sin(this.elapsed * 9.1) * 0.12 + Math.sin(this.elapsed * 3.7) * 0.08;

        for (let i = 0; i < this.fireLights.length; i++) {
            this.fireLights[i].intensity = 14 * (flicker + Math.sin(this.elapsed * 6 + i * 1.7) * 0.14);
            this.fireMaterials[i].opacity = 0.75 + Math.sin(this.elapsed * 11 + i) * 0.18;
        }

        for (let i = 0; i < this.smokeColumns.length; i++) {
            this.smokeColumns[i].rotation.y += delta * (0.05 + i * 0.01);
        }

        for (let i = 0; i < this.searchlights.length; i++) {
            const beam = this.searchlights[i];
            beam.rotation.z = Math.sin(this.elapsed * 0.25 + i * 2) * 0.5;
            beam.rotation.x = Math.cos(this.elapsed * 0.19 + i) * 0.35;
        }

        for (let i = 0; i < this.turrets.length; i++) {
            this.turrets[i].rotation.y = Math.sin(this.elapsed * 0.22 + i * 1.6) * 0.22;
        }

        this.updateTracers(delta);
        this.updateRockets(delta);
        this.updateBlasts(delta);

        if (this.skyFlash) {
            if (this.flashTimer > 0) {
                this.flashTimer -= delta;
                this.skyFlash.intensity = 260 * Math.max(0, this.flashTimer / 0.16);
            } else {
                this.skyFlash.intensity = 18 + Math.sin(this.elapsed * 0.7) * 10;
            }
        }

        if (this.embers) {
            const attribute = this.embers.geometry.getAttribute("position") as THREE.BufferAttribute;
            const array = attribute.array as Float32Array;
            for (let i = 0; i < array.length; i += 3) {
                array[i] += this.emberVelocity[i] * delta;
                array[i + 1] += this.emberVelocity[i + 1] * delta;
                array[i + 2] += this.emberVelocity[i + 2] * delta;
                if (array[i + 1] > 30) {
                    array[i] = (this.random() - 0.5) * 120;
                    array[i + 1] = 0.4;
                    array[i + 2] = (this.random() - 0.5) * 90;
                }
            }
            attribute.needsUpdate = true;
        }
    }
}
