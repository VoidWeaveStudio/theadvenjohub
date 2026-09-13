// src/features/game/world/locations/showcase/rooms/BazaarRoom.ts
import * as THREE from "three";
import { ShowcaseRoom } from "../ShowcaseRoom";
import { ResourceManager } from "../../../../core/ResourceManager";
import { SHOWCASE_INFO_BY_ID, ShowcaseInfo } from "../config";
import { CrowdSpec } from "../actors/ShowcaseCrowd";
import { createNpcNameTag } from "../../../../entities/npcNameTag";

const SQUARE_RADIUS = 62;
const FOUNTAIN_CENTER = new THREE.Vector3(0, 0, 22);
const STALL_X = 11.5;
const STALL_FIRST_Z = -26;
const STALL_STEP = 8.5;
const STALL_ROWS = 7;
const DUST_COUNT = 220;

const TICKERS = ["$DOGE", "$PEPE", "$WIF", "$BONK", "$SHIB", "$FLOKI", "$BRETT", "$MOG"];
const AWNING_COLORS = [0xd94f4f, 0x3f8f6b, 0x4f7fd8, 0xf2c53d, 0xa855f7, 0xff8f5a, 0x2fbf9f];

interface Bird {
    group: THREE.Group;
    wings: THREE.Mesh[];
    radius: number;
    height: number;
    speed: number;
    phase: number;
}

export class BazaarRoom extends ShowcaseRoom {
    private awnings: THREE.Mesh[] = [];
    private lanterns: THREE.Mesh[] = [];
    private lanternMaterials: THREE.MeshBasicMaterial[] = [];
    private birds: Bird[] = [];
    private dust: THREE.Points | null = null;
    private water: THREE.Mesh | null = null;
    private coinStatue: THREE.Object3D | null = null;
    private bunting: THREE.Object3D[] = [];

    constructor(info: ShowcaseInfo = SHOWCASE_INFO_BY_ID.get("show-bazaar") as ShowcaseInfo) {
        super(info, 0x1f9ac3, 60);
        this.exitPosition.set(0, 0, -38);
        this.exitFacing = 0;
        this.spawnPosition.set(0, 0, -31);
    }

    protected buildAtmosphere(): void {
        this.scene.background = new THREE.Color(0xd9c39a);
        this.scene.fog = new THREE.FogExp2(0xd4bd92, 0.0068);

        this.scene.add(new THREE.AmbientLight(0xfff0d0, 0.42));
        this.scene.add(new THREE.HemisphereLight(0xffe6bd, 0x8a6a42, 0.55));

        const sun = new THREE.DirectionalLight(0xfff2d0, 1.85);
        sun.position.set(44, 58, -30);
        sun.target.position.set(0, 0, 8);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.left = -60;
        sun.shadow.camera.right = 60;
        sun.shadow.camera.top = 60;
        sun.shadow.camera.bottom = -60;
        sun.shadow.camera.near = 5;
        sun.shadow.camera.far = 200;
        sun.shadow.bias = -0.0004;
        sun.shadow.normalBias = 0.04;
        sun.shadow.camera.updateProjectionMatrix();
        this.scene.add(sun);
        this.scene.add(sun.target);

        const bounce = new THREE.DirectionalLight(0xffd9a0, 0.3);
        bounce.position.set(-40, 16, 40);
        this.scene.add(bounce);

        const sky = this.mesh(
            new THREE.SphereGeometry(280, 24, 16),
            this.bin.material(new THREE.MeshBasicMaterial({ color: 0xd8c49a, side: THREE.BackSide, fog: false, toneMapped: false })),
            [0, 0, 0]
        );
        sky.castShadow = false;
        this.scene.add(sky);
    }

    protected decorate(_rm: ResourceManager): void {
        this.buildGround();
        this.buildWalls();
        this.buildStalls();
        this.buildFountain();
        this.buildBunting();
        this.buildBirds();
        this.buildDust();
        this.buildCrowd();
    }

    private buildGround() {
        const sand = this.matte(0xc4a473, 0.96, 0.02);
        const cobble = this.matte(0xa98f62, 0.95, 0.03);
        const carpetColors = [0x9c3f4a, 0x3f6b8f, 0x7a5a9c, 0xb8863f];

        const ground = this.mesh(new THREE.CircleGeometry(SQUARE_RADIUS + 18, 56), sand, [0, 0, 0], [-Math.PI / 2, 0, 0]);
        ground.castShadow = false;
        this.scene.add(ground);

        const street = this.mesh(new THREE.PlaneGeometry(20, 84), cobble, [0, 0.02, -4], [-Math.PI / 2, 0, 0]);
        street.castShadow = false;
        this.scene.add(street);

        const plaza = this.mesh(new THREE.CircleGeometry(20, 40), cobble, [FOUNTAIN_CENTER.x, 0.02, FOUNTAIN_CENTER.z], [-Math.PI / 2, 0, 0]);
        plaza.castShadow = false;
        this.scene.add(plaza);

        for (let i = 0; i < 14; i++) {
            const x = (this.random() - 0.5) * 34;
            const z = (this.random() - 0.5) * 60;
            const carpet = this.mesh(
                new THREE.PlaneGeometry(2.6 + this.random() * 2, 3.4 + this.random() * 2),
                this.matte(carpetColors[Math.floor(this.random() * carpetColors.length)], 0.95),
                [x, 0.03, z],
                [-Math.PI / 2, 0, this.random() * Math.PI]
            );
            carpet.castShadow = false;
            this.scene.add(carpet);
        }

        this.collisionGrid.insertRingWall(SQUARE_RADIUS, 2, 0, 10);
    }

    private buildWalls() {
        const clay = this.matte(0xc9a678, 0.95, 0.02);
        const clayDark = this.matte(0xa8865a, 0.96, 0.02);

        for (let i = 0; i < 26; i++) {
            const angle = (i / 26) * Math.PI * 2;
            if (Math.abs(Math.sin(angle)) < 0.18 && Math.cos(angle) < 0) continue;

            const distance = SQUARE_RADIUS - 6 + this.random() * 8;
            const x = Math.sin(angle) * distance;
            const z = Math.cos(angle) * distance;
            const width = 9 + this.random() * 7;
            const height = 6 + this.random() * 9;

            const house = this.mesh(
                new THREE.BoxGeometry(width, height, width * 0.85),
                this.random() < 0.5 ? clay : clayDark,
                [x, height / 2, z],
                [0, -angle, 0]
            );
            this.scene.add(house);
            this.collisionGrid.insertOrientedBox(x, z, width, width * 0.85, -angle, 0, height);

            const parapet = this.mesh(
                new THREE.BoxGeometry(width + 0.6, 0.7, width * 0.85 + 0.6),
                clayDark,
                [x, height + 0.35, z],
                [0, -angle, 0]
            );
            this.scene.add(parapet);

            for (let w = 0; w < 3; w++) {
                const opening = this.mesh(
                    new THREE.BoxGeometry(1.3, 1.9, 0.3),
                    this.matte(0x4a3a2a, 0.95),
                    [x - Math.cos(angle) * 0.2, 2.4 + w * 3, z],
                    [0, -angle, 0]
                );
                opening.position.add(new THREE.Vector3(Math.sin(angle + Math.PI) * (width * 0.44), 0, Math.cos(angle + Math.PI) * (width * 0.44)));
                this.scene.add(opening);
            }
        }
    }

    private buildStalls() {
        const wood = this.matte(0x8a6136, 0.94, 0.02);
        const woodDark = this.matte(0x6b4a28, 0.95, 0.02);
        const coinGold = this.metal(0xe0b552, 0.32, 0.9);
        const coinSilver = this.metal(0xc8ccd4, 0.3, 0.9);

        for (let row = 0; row < STALL_ROWS; row++) {
            for (const side of [-1, 1]) {
                const x = side * STALL_X;
                const z = STALL_FIRST_Z + row * STALL_STEP + (side > 0 ? 3.5 : 0);
                const color = AWNING_COLORS[(row + (side > 0 ? 3 : 0)) % AWNING_COLORS.length];

                const stall = new THREE.Group();
                stall.position.set(x, 0, z);
                stall.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;

                const counter = this.mesh(new THREE.BoxGeometry(5.2, 0.9, 1.5), wood, [0, 0.95, 1]);
                stall.add(counter);

                const counterTop = this.mesh(new THREE.BoxGeometry(5.6, 0.16, 1.9), woodDark, [0, 1.45, 1]);
                stall.add(counterTop);

                for (const dx of [-2.4, 2.4]) {
                    const post = this.mesh(new THREE.CylinderGeometry(0.11, 0.13, 3.4, 8), woodDark, [dx, 1.7, 0.4]);
                    stall.add(post);

                    const postBack = this.mesh(new THREE.CylinderGeometry(0.11, 0.13, 3.8, 8), woodDark, [dx, 1.9, -1.8]);
                    stall.add(postBack);
                }

                const awningMaterial = this.bin.material(new THREE.MeshStandardMaterial({
                    color,
                    roughness: 0.88,
                    side: THREE.DoubleSide,
                }));

                const awning = this.mesh(new THREE.PlaneGeometry(5.8, 3.4, 6, 3), awningMaterial, [0, 3.5, -0.5], [-1.15, 0, 0]);
                stall.add(awning);
                this.awnings.push(awning);

                const stripe = this.mesh(new THREE.BoxGeometry(5.8, 0.2, 0.14), woodDark, [0, 3.02, 0.92]);
                stall.add(stripe);

                const backWall = this.mesh(new THREE.BoxGeometry(5.4, 2.6, 0.16), woodDark, [0, 1.3, -1.9]);
                stall.add(backWall);

                for (let p = 0; p < 4; p++) {
                    const pile = new THREE.Group();
                    pile.position.set(-1.9 + p * 1.3, 1.53, 0.9);

                    const count = 3 + Math.floor(this.random() * 4);
                    for (let c = 0; c < count; c++) {
                        const coin = this.mesh(
                            new THREE.CylinderGeometry(0.22, 0.22, 0.06, 14),
                            p % 2 === 0 ? coinGold : coinSilver,
                            [(this.random() - 0.5) * 0.1, c * 0.07, (this.random() - 0.5) * 0.1]
                        );
                        pile.add(coin);
                    }

                    stall.add(pile);
                }

                for (let s = 0; s < 3; s++) {
                    const sack = this.mesh(
                        new THREE.SphereGeometry(0.45, 10, 8),
                        this.matte(0xc9a86a, 0.95),
                        [-2 + s * 1.9, 0.45, 2.1]
                    );
                    sack.scale.y = 1.2;
                    stall.add(sack);
                }

                const crate = this.mesh(new THREE.BoxGeometry(1.1, 0.9, 1.1), woodDark, [2.4, 0.45, 2.2], [0, 0.4, 0]);
                stall.add(crate);

                const tag = createNpcNameTag(TICKERS[(row + (side > 0 ? 4 : 0)) % TICKERS.length], `#${color.toString(16).padStart(6, "0")}`);
                tag.position.set(0, 4.6, 0.4);
                tag.scale.set(4.4, 1.1, 1);
                stall.add(tag);

                this.scene.add(stall);
                this.collisionGrid.insertOrientedBox(x, z, 2.4, 5.6, 0, 0, 1.6);
            }
        }
    }

    private buildFountain() {
        const stone = this.matte(0xc2b08a, 0.92, 0.04);
        const stoneDark = this.matte(0x9a8a68, 0.94, 0.03);

        const group = new THREE.Group();
        group.position.copy(FOUNTAIN_CENTER);

        const basin = this.mesh(new THREE.CylinderGeometry(7, 7.5, 1.1, 32), stone, [0, 0.55, 0]);
        group.add(basin);

        const rim = this.mesh(new THREE.TorusGeometry(7, 0.42, 10, 36), stoneDark, [0, 1.1, 0], [-Math.PI / 2, 0, 0]);
        group.add(rim);

        const waterMaterial = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x4fc8e8,
            roughness: 0.1,
            metalness: 0.2,
            transparent: true,
            opacity: 0.82,
        }));

        const water = this.mesh(new THREE.CircleGeometry(6.8, 36), waterMaterial, [0, 1.02, 0], [-Math.PI / 2, 0, 0]);
        water.castShadow = false;
        group.add(water);
        this.water = water;

        const column = this.mesh(new THREE.CylinderGeometry(1.1, 1.6, 3.2, 16), stone, [0, 2.6, 0]);
        group.add(column);

        const bowl = this.mesh(new THREE.CylinderGeometry(2.8, 1.2, 0.7, 20), stoneDark, [0, 4.4, 0]);
        group.add(bowl);

        const statue = new THREE.Group();
        statue.position.set(0, 6.6, 0);

        const coin = this.mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.5, 32), this.metal(0xe0b552, 0.3, 0.94), [0, 0, 0], [Math.PI / 2, 0, 0]);
        statue.add(coin);

        const coinRim = this.mesh(new THREE.TorusGeometry(2.4, 0.2, 8, 32), this.metal(0xb8882f, 0.4, 0.85), [0, 0, 0]);
        statue.add(coinRim);

        const symbol = this.mesh(new THREE.BoxGeometry(0.6, 2.4, 0.3), this.metal(0xb8882f, 0.4, 0.85), [0, 0, 0.3]);
        statue.add(symbol);

        const symbolArc = this.mesh(new THREE.TorusGeometry(0.75, 0.22, 8, 16, Math.PI), this.metal(0xb8882f, 0.4, 0.85), [0, 0.5, 0.3], [0, 0, -Math.PI / 2]);
        statue.add(symbolArc);

        const symbolArc2 = this.mesh(new THREE.TorusGeometry(0.75, 0.22, 8, 16, Math.PI), this.metal(0xb8882f, 0.4, 0.85), [0, -0.5, 0.3], [0, 0, Math.PI / 2]);
        statue.add(symbolArc2);

        group.add(statue);
        this.coinStatue = statue;

        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const jet = this.mesh(
                new THREE.CylinderGeometry(0.06, 0.14, 2.4, 6),
                this.glow(0x9fe8ff, 0.45),
                [Math.cos(angle) * 2.2, 3.4, Math.sin(angle) * 2.2],
                [Math.cos(angle) * 0.5, 0, -Math.sin(angle) * 0.5]
            );
            jet.castShadow = false;
            group.add(jet);
        }

        this.scene.add(group);
        this.collisionGrid.insertCylinder(new THREE.Vector3(FOUNTAIN_CENTER.x, 0.8, FOUNTAIN_CENTER.z), 7.5, 1.6);
    }

    private buildBunting() {
        const poleMaterial = this.matte(0x6b4a28, 0.95);

        for (let row = 0; row < STALL_ROWS - 1; row++) {
            const z = STALL_FIRST_Z + row * STALL_STEP + 4;
            const group = new THREE.Group();
            group.position.set(0, 0, z);

            for (const side of [-1, 1]) {
                const pole = this.mesh(new THREE.CylinderGeometry(0.12, 0.16, 7.4, 8), poleMaterial, [side * 14, 3.7, 0]);
                group.add(pole);
            }

            const flagCount = 13;
            for (let f = 0; f < flagCount; f++) {
                const t = f / (flagCount - 1);
                const x = -14 + t * 28;
                const sag = Math.sin(t * Math.PI) * 1.4;

                const flag = this.mesh(
                    new THREE.ConeGeometry(0.24, 0.6, 3),
                    this.matte(AWNING_COLORS[f % AWNING_COLORS.length], 0.88),
                    [x, 7 - sag - 0.45, 0],
                    [Math.PI, 0, 0]
                );
                flag.castShadow = false;
                group.add(flag);
            }

            if (row % 2 === 0) {
                for (let l = 0; l < 5; l++) {
                    const t = (l + 0.5) / 5;
                    const x = -13 + t * 26;
                    const sag = Math.sin(t * Math.PI) * 1.4;

                    const material = this.glow(0xffc46a, 0.85);
                    this.lanternMaterials.push(material);

                    const lantern = this.mesh(new THREE.SphereGeometry(0.22, 12, 8), material, [x, 6.4 - sag, 0]);
                    lantern.castShadow = false;
                    group.add(lantern);
                    this.lanterns.push(lantern);
                }
            }

            this.scene.add(group);
            this.bunting.push(group);
        }
    }

    private buildBirds() {
        const bodyMaterial = this.matte(0x5a5148, 0.9);
        const wingGeometry = this.bin.geometry(new THREE.CircleGeometry(0.34, 6, 0, Math.PI));

        for (let i = 0; i < 9; i++) {
            const group = new THREE.Group();

            const body = this.mesh(new THREE.SphereGeometry(0.16, 8, 6), bodyMaterial, [0, 0, 0]);
            body.scale.set(1, 0.8, 1.7);
            body.castShadow = false;
            group.add(body);

            const wings: THREE.Mesh[] = [];
            for (const side of [-1, 1]) {
                const wing = new THREE.Mesh(wingGeometry, bodyMaterial);
                wing.rotation.x = -Math.PI / 2;
                wing.rotation.z = side * 0.3;
                wing.position.x = side * 0.16;
                wing.castShadow = false;
                group.add(wing);
                wings.push(wing);
            }

            this.scene.add(group);
            this.birds.push({
                group,
                wings,
                radius: 14 + this.random() * 26,
                height: 12 + this.random() * 12,
                speed: 0.24 + this.random() * 0.24,
                phase: this.random() * 9,
            });
        }
    }

    private buildDust() {
        const positions = new Float32Array(DUST_COUNT * 3);

        for (let i = 0; i < DUST_COUNT; i++) {
            positions[i * 3] = (this.random() - 0.5) * 90;
            positions[i * 3 + 1] = this.random() * 12;
            positions[i * 3 + 2] = (this.random() - 0.5) * 90;
        }

        const geometry = this.bin.geometry(new THREE.BufferGeometry());
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        const material = this.bin.material(new THREE.PointsMaterial({
            color: 0xfff0cc,
            size: 0.13,
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
            toneMapped: false,
            fog: false,
        }));

        const points = new THREE.Points(geometry, material);
        points.frustumCulled = false;
        this.scene.add(points);
        this.dust = points;
    }

    private buildCrowd() {
        const specs: CrowdSpec[] = [];

        for (let row = 0; row < STALL_ROWS; row++) {
            for (const side of [-1, 1]) {
                const x = side * STALL_X;
                const z = STALL_FIRST_Z + row * STALL_STEP + (side > 0 ? 3.5 : 0);
                const inward = side > 0 ? -Math.PI / 2 : Math.PI / 2;

                const behind = new THREE.Vector3(x + side * 1.9, 0, z);
                specs.push({
                    position: behind,
                    set: "trader",
                    facing: inward,
                    pose: row % 3 === 0 ? "haggle" : row % 3 === 1 ? "work" : "carry",
                    held: row % 3 === 2 ? "basket" : undefined,
                    accent: AWNING_COLORS[row % AWNING_COLORS.length],
                    phase: this.random() * 9,
                });

                if (this.random() < 0.7) {
                    specs.push({
                        position: new THREE.Vector3(x - side * 2.6, 0, z + (this.random() - 0.5) * 2),
                        set: "crowd",
                        facing: inward + Math.PI,
                        pose: this.random() < 0.5 ? "haggle" : "gawk",
                        held: this.random() < 0.4 ? "bag" : undefined,
                        phase: this.random() * 9,
                    });
                }
            }
        }

        specs.push({
            position: new THREE.Vector3(-4.5, 0.95, 12),
            set: "trader",
            variantIndex: 0,
            facing: 0.4,
            pose: "preach",
            held: "sign",
            heldHand: "left",
            accent: 0xf2c53d,
            phase: 2,
            solid: false,
        });

        const crate = this.mesh(new THREE.BoxGeometry(1.6, 0.95, 1.6), this.matte(0x6b4a28, 0.95), [-4.5, 0.47, 12]);
        this.scene.add(crate);
        this.collisionGrid.insertOrientedBox(-4.5, 12, 1.6, 1.6, 0, 0, 0.95);

        for (let i = 0; i < 5; i++) {
            const angle = -0.6 + i * 0.34;
            specs.push({
                position: new THREE.Vector3(-4.5 + Math.sin(angle) * 4.5, 0, 12 - Math.cos(angle) * 4.5),
                set: "crowd",
                lookAt: new THREE.Vector3(-4.5, 1.5, 12),
                pose: i % 2 === 0 ? "gawk" : "cheer",
                phase: this.random() * 9,
            });
        }

        for (let i = 0; i < 3; i++) {
            const angle = 1.2 + i * 0.9;
            specs.push({
                position: new THREE.Vector3(
                    FOUNTAIN_CENTER.x + Math.cos(angle) * 9,
                    0,
                    FOUNTAIN_CENTER.z + Math.sin(angle) * 9
                ),
                set: "crowd",
                lookAt: FOUNTAIN_CENTER,
                pose: i === 1 ? "dance" : "toast",
                held: i === 1 ? undefined : "cocktail",
                accent: 0xff8f5a,
                phase: this.random() * 9,
            });
        }

        const walkers: Array<[number, number, number, number, number]> = [
            [-6, -32, -6, 30, 1],
            [6, 32, 6, -30, 1],
            [-2, -20, -2, 16, 1],
            [3, 14, 3, -26, 1],
            [-18, 30, 16, 34, 1],
            [20, -20, -20, -24, 1],
            [-8, 6, 8, 6, 0.72],
            [9, -8, -9, -10, 0.72],
        ];

        for (const [x1, z1, x2, z2, scale] of walkers) {
            specs.push({
                position: new THREE.Vector3(x1, 0, z1),
                set: scale < 1 ? "crowd" : "trader",
                scale,
                walk: {
                    path: [new THREE.Vector3(x1, 0, z1), new THREE.Vector3(x2, 0, z2)],
                    mode: "pingpong",
                    pause: 1.5 + this.random() * 3,
                    speed: scale < 1 ? 2.4 : 1.05 + this.random() * 0.4,
                    run: scale < 1,
                },
                held: this.random() < 0.5 ? "basket" : this.random() < 0.5 ? "bag" : undefined,
                phase: this.random() * 9,
            });
        }

        this.crowd.addMany(specs);
    }

    protected tick(delta: number): void {
        for (let i = 0; i < this.awnings.length; i++) {
            this.awnings[i].rotation.z = Math.sin(this.elapsed * 0.9 + i * 0.7) * 0.022;
        }

        for (let i = 0; i < this.bunting.length; i++) {
            this.bunting[i].rotation.z = Math.sin(this.elapsed * 0.6 + i) * 0.012;
        }

        for (let i = 0; i < this.lanterns.length; i++) {
            this.lanterns[i].position.y += Math.sin(this.elapsed * 1.4 + i) * delta * 0.05;
            this.lanternMaterials[i].opacity = 0.7 + Math.sin(this.elapsed * 2.2 + i * 1.4) * 0.2;
        }

        if (this.water) {
            (this.water.material as THREE.MeshStandardMaterial).opacity = 0.78 + Math.sin(this.elapsed * 1.6) * 0.06;
            this.water.position.y = 1.02 + Math.sin(this.elapsed * 1.1) * 0.015;
        }

        if (this.coinStatue) {
            this.coinStatue.rotation.y += delta * 0.32;
        }

        for (const bird of this.birds) {
            const t = this.elapsed * bird.speed + bird.phase;
            bird.group.position.set(
                Math.cos(t) * bird.radius,
                bird.height + Math.sin(t * 2.3) * 1.6,
                FOUNTAIN_CENTER.z * 0.4 + Math.sin(t) * bird.radius
            );
            bird.group.rotation.y = -t + Math.PI / 2;

            const flap = Math.sin(this.elapsed * 9 + bird.phase) * 0.7;
            bird.wings[0].rotation.z = 0.3 + flap;
            bird.wings[1].rotation.z = -0.3 - flap;
        }

        if (this.dust) {
            const attribute = this.dust.geometry.getAttribute("position") as THREE.BufferAttribute;
            const array = attribute.array as Float32Array;
            for (let i = 0; i < array.length; i += 3) {
                array[i] += delta * 0.45;
                array[i + 1] += Math.sin(this.elapsed * 0.5 + i) * delta * 0.12;
                if (array[i] > 45) array[i] = -45;
            }
            attribute.needsUpdate = true;
        }
    }
}
