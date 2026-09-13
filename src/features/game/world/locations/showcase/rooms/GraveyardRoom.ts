// src/features/game/world/locations/showcase/rooms/GraveyardRoom.ts
import * as THREE from "three";
import { ShowcaseRoom } from "../ShowcaseRoom";
import { ResourceManager } from "../../../../core/ResourceManager";
import { SHOWCASE_INFO_BY_ID, ShowcaseInfo } from "../config";
import { CrowdSpec } from "../actors/ShowcaseCrowd";
import { createNpcNameTag } from "../../../../entities/npcNameTag";

const YARD_RADIUS = 66;
const MONUMENT_Z = 34;
const WISP_COUNT = 22;
const MIST_LAYERS = 3;

const DEAD_TICKERS = [
    "$MOONZ", "$SAFU", "$LUNC", "$RUGME", "$PEPE2", "$ELONX", "$HODL", "$DOGE9",
    "$GEMZ", "$APE3", "$WOJAK", "$FOMO", "$BONKZ", "$SHIBX", "$CUM", "$LAMBO",
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

export class GraveyardRoom extends ShowcaseRoom {
    private wisps: Wisp[] = [];
    private candleMaterials: THREE.MeshBasicMaterial[] = [];
    private candleLights: THREE.PointLight[] = [];
    private mist: THREE.Mesh[] = [];
    private crows: THREE.Object3D[] = [];
    private monumentShard: THREE.Object3D | null = null;
    private rain: THREE.Points | null = null;

    constructor(info: ShowcaseInfo = SHOWCASE_INFO_BY_ID.get("show-graveyard") as ShowcaseInfo) {
        super(info, 0x7b21a9, 64);
        this.exitPosition.set(0, 0, -42);
        this.exitFacing = 0;
        this.spawnPosition.set(0, 0, -34);
    }

    protected buildAtmosphere(): void {
        this.scene.background = new THREE.Color(0x0b1018);
        this.scene.fog = new THREE.FogExp2(0x10161f, 0.017);

        this.scene.add(new THREE.AmbientLight(0x28324a, 0.7));
        this.scene.add(new THREE.HemisphereLight(0x3b4a6b, 0x0c1016, 0.75));

        const moon = new THREE.DirectionalLight(0xb8cdf2, 1.1);
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
    }

    protected decorate(_rm: ResourceManager): void {
        this.buildGround();
        this.buildFence();
        this.buildGraves();
        this.buildMonument();
        this.buildTrees();
        this.buildMist();
        this.buildWisps();
        this.buildRain();
        this.buildCrowd();
    }

    private buildGround() {
        const soil = this.matte(0x232a25, 0.98, 0.01);
        const grass = this.matte(0x2c3a2e, 0.98, 0.01);
        const gravel = this.matte(0x2e3136, 0.96, 0.02);

        const field = this.mesh(new THREE.CircleGeometry(YARD_RADIUS + 16, 56), grass, [0, 0, 0], [-Math.PI / 2, 0, 0]);
        field.castShadow = false;
        this.scene.add(field);

        const path = this.mesh(new THREE.PlaneGeometry(6, 90), gravel, [0, 0.02, -2], [-Math.PI / 2, 0, 0]);
        path.castShadow = false;
        this.scene.add(path);

        for (let i = 0; i < 28; i++) {
            const angle = this.random() * Math.PI * 2;
            const distance = this.random() * YARD_RADIUS;
            const mound = this.mesh(
                new THREE.SphereGeometry(1.4 + this.random() * 1.4, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
                soil,
                [Math.cos(angle) * distance, 0.02, Math.sin(angle) * distance]
            );
            mound.scale.y = 0.28;
            mound.castShadow = false;
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
        const stone = this.matte(0x5a5f68, 0.94, 0.05);
        const stoneDark = this.matte(0x424750, 0.95, 0.04);
        const plaque = this.metal(0x8a8f98, 0.5, 0.6);

        const shapes = [
            () => this.bin.geometry(new THREE.BoxGeometry(1.5, 2.1, 0.32)),
            () => this.bin.geometry(new THREE.CylinderGeometry(0.78, 0.78, 2.2, 16, 1, false, 0, Math.PI)),
            () => this.bin.geometry(new THREE.BoxGeometry(1.8, 1.5, 0.36)),
        ];

        let tickerIndex = 0;

        for (let row = 0; row < 9; row++) {
            for (let column = 0; column < 14; column++) {
                const side = column < 7 ? -1 : 1;
                const x = side * (5 + (column % 7) * 4.4 + (this.random() - 0.5) * 0.8);
                const z = -18 + row * 5.4 + (this.random() - 0.5) * 1.1;
                const tilt = (this.random() - 0.5) * 0.22;

                const shape = shapes[Math.floor(this.random() * shapes.length)]();
                const grave = new THREE.Mesh(shape, this.random() < 0.5 ? stone : stoneDark);
                grave.position.set(x, 1.05, z);
                grave.rotation.set(tilt, (this.random() - 0.5) * 0.5, tilt * 0.6);
                grave.castShadow = true;
                grave.receiveShadow = true;
                this.scene.add(grave);

                const base = this.mesh(new THREE.BoxGeometry(2, 0.28, 0.9), stoneDark, [x, 0.14, z]);
                this.scene.add(base);

                this.collisionGrid.insertOrientedBox(x, z, 2, 0.9, 0, 0, 2.2);

                if (this.random() < 0.55) {
                    const label = this.mesh(new THREE.BoxGeometry(1.1, 0.42, 0.06), plaque, [x, 1.4, z + 0.2]);
                    this.scene.add(label);

                    const tag = createNpcNameTag(DEAD_TICKERS[tickerIndex % DEAD_TICKERS.length], "#9ec6ff");
                    tag.position.set(x, 2.9, z);
                    tag.scale.set(2.6, 0.65, 1);
                    this.scene.add(tag);
                    tickerIndex++;
                }

                if (this.random() < 0.5) {
                    const candleMaterial = this.glow(0xff4a4a, 0.9);
                    this.candleMaterials.push(candleMaterial);

                    const candleBody = this.mesh(new THREE.BoxGeometry(0.36, 0.7 + this.random() * 0.8, 0.36), this.lit(0xc2342f, 1.1), [x + 0.9, 0.6, z + 0.7]);
                    this.scene.add(candleBody);

                    const flame = this.mesh(new THREE.ConeGeometry(0.16, 0.42, 8), candleMaterial, [x + 0.9, 1.35, z + 0.7]);
                    flame.castShadow = false;
                    this.scene.add(flame);

                    if (this.candleLights.length < 14) {
                        const light = new THREE.PointLight(0xff5a4a, 12, 12, 2);
                        light.position.set(x + 0.9, 1.4, z + 0.7);
                        this.scene.add(light);
                        this.candleLights.push(light);
                    }
                }

                if (this.random() < 0.28) {
                    const wreath = this.mesh(new THREE.TorusGeometry(0.42, 0.1, 6, 14), this.matte(0x3f5f3a, 0.95), [x, 0.55, z + 0.55], [Math.PI / 2 - 0.4, 0, 0]);
                    this.scene.add(wreath);
                }
            }
        }
    }

    private buildMonument() {
        const group = new THREE.Group();
        group.position.set(0, 0, MONUMENT_Z);

        const plinth = this.mesh(new THREE.CylinderGeometry(7.5, 8.6, 1.6, 8), this.matte(0x3a3f48, 0.95), [0, 0.8, 0]);
        group.add(plinth);

        const step = this.mesh(new THREE.CylinderGeometry(5.6, 6.4, 0.9, 8), this.matte(0x4a505a, 0.94), [0, 1.9, 0]);
        group.add(step);

        const redBody = this.lit(0xc2342f, 0.75);
        const lower = this.mesh(new THREE.BoxGeometry(4.2, 9, 4.2), redBody, [0, 6.6, 0]);
        group.add(lower);

        const shard = this.mesh(new THREE.BoxGeometry(4.2, 7.4, 4.2), redBody, [1.7, 13.4, 0.5], [0.2, 0.3, 0.55]);
        group.add(shard);
        this.monumentShard = shard;

        const wickTop = this.mesh(new THREE.BoxGeometry(0.9, 3.4, 0.9), redBody, [2.9, 17.4, 0.9], [0.2, 0.3, 0.55]);
        group.add(wickTop);

        const wickBottom = this.mesh(new THREE.BoxGeometry(0.9, 3.2, 0.9), redBody, [0, 1.9, 0]);
        group.add(wickBottom);

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

        const light = new THREE.PointLight(0xff5a4a, 50, 60, 2);
        light.position.set(0, 9, 4);
        group.add(light);

        const tag = createNpcNameTag("R.I.P. 2021—2026", "#ff8f8f");
        tag.position.set(0, 20.5, 0);
        tag.scale.set(9, 2.25, 1);
        group.add(tag);

        this.scene.add(group);
        this.collisionGrid.insertCylinder(new THREE.Vector3(0, 4, MONUMENT_Z), 8.6, 8);
    }

    private buildTrees() {
        const bark = this.matte(0x2e2a26, 0.97, 0.02);
        const crowBody = this.matte(0x14161a, 0.9, 0.1);

        for (let i = 0; i < 13; i++) {
            const angle = (i / 13) * Math.PI * 2 + this.random() * 0.4;
            const distance = 26 + this.random() * 32;
            const x = Math.cos(angle) * distance;
            const z = Math.sin(angle) * distance;
            const height = 6 + this.random() * 5;

            const tree = new THREE.Group();
            tree.position.set(x, 0, z);
            tree.rotation.y = this.random() * Math.PI;

            const trunk = this.mesh(new THREE.CylinderGeometry(0.28, 0.55, height, 8), bark, [0, height / 2, 0]);
            tree.add(trunk);

            const branchCount = 5 + Math.floor(this.random() * 4);
            for (let b = 0; b < branchCount; b++) {
                const branchLength = 2 + this.random() * 3;
                const branchY = height * (0.55 + this.random() * 0.4);
                const branchAngle = this.random() * Math.PI * 2;

                const branch = this.mesh(
                    new THREE.CylinderGeometry(0.07, 0.16, branchLength, 6),
                    bark,
                    [Math.cos(branchAngle) * branchLength * 0.4, branchY, Math.sin(branchAngle) * branchLength * 0.4],
                    [Math.cos(branchAngle) * 0.9, 0, -Math.sin(branchAngle) * 0.9]
                );
                tree.add(branch);

                if (this.random() < 0.3) {
                    const crow = new THREE.Group();
                    crow.position.set(Math.cos(branchAngle) * branchLength * 0.8, branchY + branchLength * 0.35, Math.sin(branchAngle) * branchLength * 0.8);

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
            this.collisionGrid.insertCylinder(new THREE.Vector3(x, height / 2, z), 0.6, height);
        }
    }

    private buildMist() {
        for (let i = 0; i < MIST_LAYERS; i++) {
            const material = this.glow(0x8fa6c8, 0.03, false);
            const plane = this.mesh(
                new THREE.CircleGeometry(YARD_RADIUS * 0.9 - i * 5, 40),
                material,
                [0, 0.4 + i * 0.55, 4],
                [-Math.PI / 2, 0, 0]
            );
            plane.castShadow = false;
            plane.renderOrder = 2;
            this.scene.add(plane);
            this.mist.push(plane);
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
            if (i < 6) {
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
        this.scene.add(points);
        this.rain = points;
    }

    private buildCrowd() {
        const specs: CrowdSpec[] = [];

        const mourners: Array<[number, number, number]> = [
            [-5.4, 6, 0.1],
            [-4.2, 6.4, 0.3],
            [6.2, -2, -0.2],
            [9.4, 12.5, 0.15],
            [-9.8, 18, 0.4],
            [4.6, 22, -0.3],
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
            [0, -30, 0, 26],
            [-24, -12, -24, 20],
            [22, 24, 22, -16],
            [-34, 6, 30, 6],
        ];

        for (const [x1, z1, x2, z2] of walkers) {
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
                heldLight: true,
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

        this.crowd.addMany(specs);
    }

    protected tick(delta: number): void {
        const flicker = 0.8 + Math.sin(this.elapsed * 8.4) * 0.12;

        for (let i = 0; i < this.candleMaterials.length; i++) {
            this.candleMaterials[i].opacity = 0.72 + Math.sin(this.elapsed * 9 + i * 1.3) * 0.22;
        }

        for (let i = 0; i < this.candleLights.length; i++) {
            this.candleLights[i].intensity = 11 * (flicker + Math.sin(this.elapsed * 5.5 + i) * 0.12);
        }

        for (let i = 0; i < this.mist.length; i++) {
            const layer = this.mist[i];
            layer.rotation.z += delta * (0.01 + i * 0.004);
            (layer.material as THREE.MeshBasicMaterial).opacity = 0.026 + Math.sin(this.elapsed * 0.4 + i) * 0.01;
        }

        for (let i = 0; i < this.crows.length; i++) {
            this.crows[i].rotation.y = Math.sin(this.elapsed * 0.6 + i * 2.1) * 0.6;
            this.crows[i].position.y += Math.sin(this.elapsed * 3 + i) * delta * 0.05;
        }

        if (this.monumentShard) {
            this.monumentShard.rotation.z = 0.55 + Math.sin(this.elapsed * 0.4) * 0.012;
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
}
