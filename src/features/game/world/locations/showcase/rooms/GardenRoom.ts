// src/features/game/world/locations/showcase/rooms/GardenRoom.ts
import * as THREE from "three";
import { ShowcaseRoom } from "../ShowcaseRoom";
import { ResourceManager } from "../../../../core/ResourceManager";
import { SHOWCASE_INFO_BY_ID, ShowcaseInfo } from "../config";
import { CrowdSpec } from "../actors/ShowcaseCrowd";
import { seatedActorY } from "../actors/poses";

const FIELD_RADIUS = 74;
const POND_CENTER = new THREE.Vector3(6, 0, 14);
const POND_RADIUS = 16;
const BAR_POSITION = new THREE.Vector3(30, 0, -4);
const PETAL_COUNT = 260;
const BUTTERFLY_COUNT = 18;

interface Butterfly {
    group: THREE.Group;
    wings: THREE.Mesh[];
    center: THREE.Vector3;
    radius: number;
    speed: number;
    phase: number;
    height: number;
}

export class GardenRoom extends ShowcaseRoom {
    private petals: THREE.Points | null = null;
    private petalDrift: Float32Array = new Float32Array(0);
    private butterflies: Butterfly[] = [];
    private water: THREE.Mesh | null = null;
    private waterGlints: THREE.Points | null = null;
    private lilies: THREE.Object3D[] = [];
    private hammocks: THREE.Object3D[] = [];

    constructor(info: ShowcaseInfo = SHOWCASE_INFO_BY_ID.get("show-garden") as ShowcaseInfo) {
        super(info, 0x2bd47f, 72);
        this.exitPosition.set(0, 0, -44);
        this.exitFacing = 0;
        this.spawnPosition.set(0, 0, -36);
    }

    protected buildAtmosphere(): void {
        this.scene.background = new THREE.Color(0x9fd8f2);
        this.scene.fog = new THREE.FogExp2(0xbfe6f5, 0.0042);

        this.scene.add(new THREE.AmbientLight(0xdff0ff, 0.42));
        this.scene.add(new THREE.HemisphereLight(0xa8dfff, 0x527f45, 0.68));

        const sun = new THREE.DirectionalLight(0xfff4d6, 1.75);
        sun.position.set(-50, 62, -34);
        sun.target.position.set(0, 0, 6);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.left = -70;
        sun.shadow.camera.right = 70;
        sun.shadow.camera.top = 70;
        sun.shadow.camera.bottom = -70;
        sun.shadow.camera.near = 5;
        sun.shadow.camera.far = 220;
        sun.shadow.bias = -0.0004;
        sun.shadow.normalBias = 0.04;
        sun.shadow.camera.updateProjectionMatrix();
        this.scene.add(sun);
        this.scene.add(sun.target);

        const bounce = new THREE.DirectionalLight(0xbfe8b0, 0.32);
        bounce.position.set(40, 18, 50);
        this.scene.add(bounce);

        const sky = this.mesh(
            new THREE.SphereGeometry(320, 26, 18),
            this.bin.material(new THREE.MeshBasicMaterial({ color: 0xa8ddf5, side: THREE.BackSide, fog: false, toneMapped: false })),
            [0, 0, 0]
        );
        sky.castShadow = false;
        sky.receiveShadow = false;
        this.scene.add(sky);

        for (let i = 0; i < 9; i++) {
            const cloud = new THREE.Group();
            const angle = (i / 9) * Math.PI * 2 + this.random();
            const distance = 110 + this.random() * 90;
            cloud.position.set(Math.cos(angle) * distance, 52 + this.random() * 30, Math.sin(angle) * distance);

            const puffMaterial = this.bin.material(new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.85,
                fog: false,
                toneMapped: false,
            }));

            for (let p = 0; p < 5; p++) {
                const puff = new THREE.Mesh(this.bin.geometry(new THREE.SphereGeometry(8 + this.random() * 7, 12, 8)), puffMaterial);
                puff.position.set((p - 2) * 9 + (this.random() - 0.5) * 5, (this.random() - 0.5) * 4, (this.random() - 0.5) * 7);
                puff.castShadow = false;
                cloud.add(puff);
            }

            this.scene.add(cloud);
        }
    }

    protected decorate(_rm: ResourceManager): void {
        this.buildGround();
        this.buildPond();
        this.buildFlowers();
        this.buildTrees();
        this.buildDeck();
        this.buildBar();
        this.buildLoungers();
        this.buildHammocks();
        this.buildButterflies();
        this.buildPetals();
        this.buildCrowd();
    }

    protected groundHeight(_x: number, _z: number): number {
        return 0;
    }

    private buildGround() {
        const grass = this.matte(0x4f8f3c, 0.96, 0.02);
        const grassDark = this.matte(0x3f7534, 0.97, 0.02);
        const sand = this.matte(0xd9c493, 0.95, 0.02);

        const field = this.mesh(new THREE.CircleGeometry(FIELD_RADIUS + 18, 64), grass, [0, 0, 0], [-Math.PI / 2, 0, 0]);
        field.castShadow = false;
        this.scene.add(field);

        for (let i = 0; i < 24; i++) {
            const angle = this.random() * Math.PI * 2;
            const distance = this.random() * FIELD_RADIUS;
            const patch = this.mesh(
                new THREE.CircleGeometry(4 + this.random() * 9, 18),
                grassDark,
                [Math.cos(angle) * distance, 0.01, Math.sin(angle) * distance],
                [-Math.PI / 2, 0, 0]
            );
            patch.castShadow = false;
            this.scene.add(patch);
        }

        const shore = this.mesh(
            new THREE.RingGeometry(POND_RADIUS - 0.6, POND_RADIUS + 3.4, 48),
            sand,
            [POND_CENTER.x, 0.02, POND_CENTER.z],
            [-Math.PI / 2, 0, 0]
        );
        shore.castShadow = false;
        this.scene.add(shore);

        const path = this.mesh(new THREE.PlaneGeometry(3.6, 84, 1, 1), sand, [0, 0.03, -6], [-Math.PI / 2, 0, 0]);
        path.castShadow = false;
        this.scene.add(path);

        this.collisionGrid.insertRingWall(FIELD_RADIUS + 2, 2, 0, 6);
    }

    private buildPond() {
        const waterMaterial = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x3fb8d8,
            roughness: 0.12,
            metalness: 0.2,
            transparent: true,
            opacity: 0.82,
        }));

        const water = this.mesh(
            new THREE.CircleGeometry(POND_RADIUS, 54),
            waterMaterial,
            [POND_CENTER.x, 0.12, POND_CENTER.z],
            [-Math.PI / 2, 0, 0]
        );
        water.castShadow = false;
        this.scene.add(water);
        this.water = water;

        const bed = this.mesh(
            new THREE.CylinderGeometry(POND_RADIUS, POND_RADIUS - 1.4, 1.4, 48),
            this.matte(0x2f6a58, 0.95),
            [POND_CENTER.x, -0.6, POND_CENTER.z]
        );
        bed.castShadow = false;
        this.scene.add(bed);

        const glintCount = 160;
        const positions = new Float32Array(glintCount * 3);
        for (let i = 0; i < glintCount; i++) {
            const angle = this.random() * Math.PI * 2;
            const distance = Math.sqrt(this.random()) * (POND_RADIUS - 1);
            positions[i * 3] = POND_CENTER.x + Math.cos(angle) * distance;
            positions[i * 3 + 1] = 0.16;
            positions[i * 3 + 2] = POND_CENTER.z + Math.sin(angle) * distance;
        }

        const geometry = this.bin.geometry(new THREE.BufferGeometry());
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const glintMaterial = this.bin.material(new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.22,
            transparent: true,
            opacity: 0.7,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            fog: false,
        }));
        const glints = new THREE.Points(geometry, glintMaterial);
        glints.frustumCulled = false;
        this.scene.add(glints);
        this.waterGlints = glints;

        const padMaterial = this.matte(0x4f9f52, 0.9);
        const flowerMaterial = this.matte(0xffb3d9, 0.7);

        for (let i = 0; i < 12; i++) {
            const angle = this.random() * Math.PI * 2;
            const distance = 3 + this.random() * (POND_RADIUS - 5);
            const pad = new THREE.Group();
            pad.position.set(POND_CENTER.x + Math.cos(angle) * distance, 0.16, POND_CENTER.z + Math.sin(angle) * distance);

            const disc = this.mesh(new THREE.CircleGeometry(0.9 + this.random() * 0.5, 14, 0.4, Math.PI * 1.8), padMaterial, [0, 0, 0], [-Math.PI / 2, 0, 0]);
            disc.castShadow = false;
            pad.add(disc);

            if (this.random() < 0.5) {
                const bloom = this.mesh(new THREE.SphereGeometry(0.24, 10, 8), flowerMaterial, [0, 0.16, 0]);
                pad.add(bloom);
            }

            this.scene.add(pad);
            this.lilies.push(pad);
        }
    }

    private buildFlowers() {
        const palettes = [0xff6f9a, 0xffd166, 0xf2f2f2, 0xa855f7, 0xff8f5a, 0x67c9ff];
        const stemMaterial = this.matte(0x4f8f46, 0.95);
        const stemGeometry = this.bin.geometry(new THREE.CylinderGeometry(0.02, 0.03, 0.5, 5));
        const headGeometry = this.bin.geometry(new THREE.SphereGeometry(0.11, 8, 6));

        for (const color of palettes) {
            const material = this.matte(color, 0.72, 0.02);
            const count = 190;
            const stems = new THREE.InstancedMesh(stemGeometry, stemMaterial, count);
            const heads = new THREE.InstancedMesh(headGeometry, material, count);
            stems.castShadow = false;
            heads.castShadow = true;

            const matrix = new THREE.Matrix4();
            const quaternion = new THREE.Quaternion();
            const position = new THREE.Vector3();
            const scale = new THREE.Vector3(1, 1, 1);

            for (let i = 0; i < count; i++) {
                const angle = this.random() * Math.PI * 2;
                const distance = Math.sqrt(this.random()) * FIELD_RADIUS;
                const x = Math.cos(angle) * distance;
                const z = Math.sin(angle) * distance;
                const inPond = Math.hypot(x - POND_CENTER.x, z - POND_CENTER.z) < POND_RADIUS + 4;
                const height = 0.34 + this.random() * 0.4;

                position.set(inPond ? x + 30 : x, height * 0.5, z);
                scale.set(1, height / 0.5, 1);
                matrix.compose(position, quaternion, scale);
                stems.setMatrixAt(i, matrix);

                position.y = height + 0.06;
                scale.set(1, 1, 1);
                matrix.compose(position, quaternion, scale);
                heads.setMatrixAt(i, matrix);
            }

            stems.instanceMatrix.needsUpdate = true;
            heads.instanceMatrix.needsUpdate = true;
            this.scene.add(stems);
            this.scene.add(heads);
        }
    }

    private buildTrees() {
        const trunk = this.matte(0x6b4a2a, 0.95);
        const leaf = this.matte(0x3f8f46, 0.9);
        const leafLight = this.matte(0x5fb85a, 0.88);
        const palmLeaf = this.matte(0x4fa85c, 0.85);

        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2 + this.random() * 0.3;
            const distance = 30 + this.random() * 34;
            const x = Math.cos(angle) * distance;
            const z = Math.sin(angle) * distance;
            if (Math.hypot(x - POND_CENTER.x, z - POND_CENTER.z) < POND_RADIUS + 6) continue;

            const height = 5 + this.random() * 4;
            const tree = new THREE.Group();
            tree.position.set(x, 0, z);

            const stem = this.mesh(new THREE.CylinderGeometry(0.28, 0.45, height, 9), trunk, [0, height / 2, 0]);
            tree.add(stem);

            for (let c = 0; c < 3; c++) {
                const crown = this.mesh(
                    new THREE.IcosahedronGeometry(2.1 + this.random() * 1.3, 0),
                    c % 2 === 0 ? leaf : leafLight,
                    [(this.random() - 0.5) * 1.6, height + c * 1.1, (this.random() - 0.5) * 1.6]
                );
                crown.scale.y = 0.85;
                tree.add(crown);
            }

            this.scene.add(tree);
            this.collisionGrid.insertCylinder(new THREE.Vector3(x, height / 2, z), 0.6, height);
        }

        for (let i = 0; i < 7; i++) {
            const angle = -0.4 + (i / 7) * 2.6;
            const distance = POND_RADIUS + 5 + this.random() * 4;
            const x = POND_CENTER.x + Math.cos(angle) * distance;
            const z = POND_CENTER.z + Math.sin(angle) * distance;
            const height = 7 + this.random() * 3;

            const palm = new THREE.Group();
            palm.position.set(x, 0, z);
            palm.rotation.z = (this.random() - 0.5) * 0.24;

            const stem = this.mesh(new THREE.CylinderGeometry(0.22, 0.36, height, 8), trunk, [0, height / 2, 0]);
            palm.add(stem);

            for (let f = 0; f < 7; f++) {
                const frond = this.mesh(
                    new THREE.CircleGeometry(2.6, 7, 0, 0.7),
                    palmLeaf,
                    [0, height, 0],
                    [-Math.PI / 2 + 0.5, (f / 7) * Math.PI * 2, 0]
                );
                (frond.material as THREE.Material).side = THREE.DoubleSide;
                palm.add(frond);
            }

            const coconuts = this.mesh(new THREE.SphereGeometry(0.3, 8, 6), trunk, [0.2, height - 0.3, 0.2]);
            palm.add(coconuts);

            this.scene.add(palm);
            this.collisionGrid.insertCylinder(new THREE.Vector3(x, height / 2, z), 0.5, height);
        }
    }

    private buildDeck() {
        const plank = this.matte(0xc9a06a, 0.9, 0.02);
        const deck = new THREE.Group();
        deck.position.set(POND_CENTER.x - 4, 0, POND_CENTER.z - POND_RADIUS - 1);

        for (let i = 0; i < 12; i++) {
            const board = this.mesh(new THREE.BoxGeometry(13, 0.16, 0.9), plank, [0, 0.22, i * 1.0]);
            deck.add(board);
        }

        for (const dx of [-6, 0, 6]) {
            for (let i = 0; i < 3; i++) {
                const pile = this.mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.4, 8), plank, [dx, 0.0, i * 5]);
                deck.add(pile);
            }
        }

        this.scene.add(deck);
        this.collisionGrid.insertOrientedBox(deck.position.x, deck.position.z + 5.5, 13, 12, 0, 0, 0.34);
    }

    private buildBar() {
        const wood = this.matte(0x8a5a32, 0.9, 0.03);
        const thatch = this.matte(0xd8b46a, 0.95, 0.02);
        const counter = this.matte(0xb8814a, 0.75, 0.06);

        const bar = new THREE.Group();
        bar.position.copy(BAR_POSITION);
        bar.rotation.y = -0.6;

        const top = this.mesh(new THREE.BoxGeometry(9, 0.24, 2.2), counter, [0, 1.1, 0]);
        bar.add(top);

        const front = this.mesh(new THREE.BoxGeometry(9, 1.1, 0.4), wood, [0, 0.55, 0.9]);
        bar.add(front);

        const back = this.mesh(new THREE.BoxGeometry(8, 2.4, 0.35), wood, [0, 1.2, -2.6]);
        bar.add(back);

        for (let s = 0; s < 5; s++) {
            const bottle = this.mesh(
                new THREE.CylinderGeometry(0.12, 0.14, 0.6, 8),
                this.lit([0x7ce8a8, 0xffd166, 0xff8fb1, 0x67c9ff, 0xff6f61][s], 0.5),
                [-2.6 + s * 1.3, 2.0, -2.5]
            );
            bar.add(bottle);
        }

        for (const dx of [-4.2, 4.2]) {
            const post = this.mesh(new THREE.CylinderGeometry(0.18, 0.22, 3.6, 8), wood, [dx, 1.8, -0.6]);
            bar.add(post);
        }

        const roof = this.mesh(new THREE.ConeGeometry(7.4, 2.2, 4), thatch, [0, 4.4, -0.6], [0, Math.PI / 4, 0]);
        bar.add(roof);

        for (let s = 0; s < 4; s++) {
            const stool = new THREE.Group();
            stool.position.set(-3.6 + s * 2.4, 0, 2.1);

            const seat = this.mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 12), counter, [0, 0.62, 0]);
            stool.add(seat);

            const leg = this.mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.62, 8), wood, [0, 0.31, 0]);
            stool.add(leg);

            bar.add(stool);
        }

        this.scene.add(bar);
        this.collisionGrid.insertOrientedBox(BAR_POSITION.x, BAR_POSITION.z, 9, 2.4, -0.6, 0, 1.3);
    }

    private buildLoungers() {
        const frame = this.matte(0xe8e2d0, 0.7, 0.08);
        const fabric = this.matte(0x67c9ff, 0.86, 0.02);
        const fabricWarm = this.matte(0xffb3c7, 0.86, 0.02);
        const umbrella = this.matte(0xff8f5a, 0.85, 0.02);

        const spots: Array<[number, number, number]> = [
            [-6, 26, -0.4],
            [-1, 28, -0.15],
            [4, 29, 0.1],
            [12, 27, 0.5],
            [18, 21, 0.9],
            [-12, 22, -0.8],
        ];

        for (let i = 0; i < spots.length; i++) {
            const [x, z, rotation] = spots[i];
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.rotation.y = rotation + Math.PI;

            const seat = this.mesh(new THREE.BoxGeometry(1.1, 0.12, 2.3), i % 2 === 0 ? fabric : fabricWarm, [0, 0.5, 0], [-0.16, 0, 0]);
            group.add(seat);

            const backRest = this.mesh(new THREE.BoxGeometry(1.1, 0.12, 1.1), i % 2 === 0 ? fabric : fabricWarm, [0, 0.82, -1.2], [-0.75, 0, 0]);
            group.add(backRest);

            for (const dx of [-0.48, 0.48]) {
                for (const dz of [-0.9, 0.9]) {
                    const leg = this.mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.45, 6), frame, [dx, 0.22, dz]);
                    group.add(leg);
                }
            }

            this.scene.add(group);

            if (i % 2 === 0) {
                const shade = new THREE.Group();
                shade.position.set(x + 1.6, 0, z + 0.4);

                const pole = this.mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 8), frame, [0, 1.6, 0]);
                shade.add(pole);

                const canopy = this.mesh(new THREE.ConeGeometry(2.4, 0.9, 8), umbrella, [0, 3.3, 0]);
                shade.add(canopy);

                this.scene.add(shade);
            }

            const table = new THREE.Group();
            table.position.set(x - 1.4, 0, z - 0.2);

            const topDisc = this.mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 12), frame, [0, 0.62, 0]);
            table.add(topDisc);

            const stem = this.mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.6, 8), frame, [0, 0.3, 0]);
            table.add(stem);

            const glass = this.mesh(
                new THREE.CylinderGeometry(0.09, 0.07, 0.22, 10),
                this.bin.material(new THREE.MeshStandardMaterial({ color: 0xffe066, roughness: 0.12, transparent: true, opacity: 0.8 })),
                [0.12, 0.78, 0.05]
            );
            table.add(glass);

            this.scene.add(table);
        }
    }

    private buildHammocks() {
        const rope = this.matte(0xe8dcc0, 0.9);
        const cloth = this.matte(0xffd166, 0.88, 0.02);

        const spans: Array<[number, number, number, number]> = [
            [-26, 6, -26, 14],
            [-32, -8, -24, -14],
        ];

        for (const [x1, z1, x2, z2] of spans) {
            const group = new THREE.Group();
            const midX = (x1 + x2) / 2;
            const midZ = (z1 + z2) / 2;
            const length = Math.hypot(x2 - x1, z2 - z1);

            group.position.set(midX, 0, midZ);
            group.rotation.y = Math.atan2(x2 - x1, z2 - z1);

            for (const end of [-1, 1]) {
                const post = this.mesh(new THREE.CylinderGeometry(0.22, 0.3, 3.4, 8), this.matte(0x6b4a2a, 0.95), [0, 1.7, end * length / 2]);
                group.add(post);
            }

            const bed = this.mesh(new THREE.CylinderGeometry(0.72, 0.72, length - 1.2, 12, 1, true, 0, Math.PI), cloth, [0, 1.5, 0], [0, 0, Math.PI / 2]);
            (bed.material as THREE.Material).side = THREE.DoubleSide;
            group.add(bed);

            for (const end of [-1, 1]) {
                const line = this.mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 5), rope, [0, 2.0, end * (length / 2 - 0.4)], [end * 0.5, 0, 0]);
                group.add(line);
            }

            this.scene.add(group);
            this.hammocks.push(group);
        }
    }

    private buildButterflies() {
        const wingMaterial = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0xffd0f0,
            roughness: 0.6,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.92,
        }));
        const wingMaterialAlt = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0xa8e6ff,
            roughness: 0.6,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.92,
        }));
        const wingGeometry = this.bin.geometry(new THREE.CircleGeometry(0.16, 8, 0, Math.PI));

        for (let i = 0; i < BUTTERFLY_COUNT; i++) {
            const group = new THREE.Group();
            const angle = this.random() * Math.PI * 2;
            const distance = 8 + this.random() * 44;
            const center = new THREE.Vector3(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);

            const wings: THREE.Mesh[] = [];
            for (const side of [-1, 1]) {
                const wing = new THREE.Mesh(wingGeometry, i % 2 === 0 ? wingMaterial : wingMaterialAlt);
                wing.position.x = side * 0.05;
                wing.rotation.y = side * 0.6;
                wing.castShadow = false;
                group.add(wing);
                wings.push(wing);
            }

            this.scene.add(group);
            this.butterflies.push({
                group,
                wings,
                center,
                radius: 1.4 + this.random() * 3.4,
                speed: 0.5 + this.random() * 0.9,
                phase: this.random() * 9,
                height: 1 + this.random() * 2.4,
            });
        }
    }

    private buildPetals() {
        const positions = new Float32Array(PETAL_COUNT * 3);
        this.petalDrift = new Float32Array(PETAL_COUNT * 3);

        for (let i = 0; i < PETAL_COUNT; i++) {
            positions[i * 3] = (this.random() - 0.5) * FIELD_RADIUS * 2;
            positions[i * 3 + 1] = this.random() * 16;
            positions[i * 3 + 2] = (this.random() - 0.5) * FIELD_RADIUS * 2;
            this.petalDrift[i * 3] = 0.4 + this.random() * 0.8;
            this.petalDrift[i * 3 + 1] = -(0.25 + this.random() * 0.4);
            this.petalDrift[i * 3 + 2] = (this.random() - 0.5) * 0.6;
        }

        const geometry = this.bin.geometry(new THREE.BufferGeometry());
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        const material = this.bin.material(new THREE.PointsMaterial({
            color: 0xffd7ea,
            size: 0.2,
            transparent: true,
            opacity: 0.85,
            depthWrite: false,
            toneMapped: false,
        }));

        const points = new THREE.Points(geometry, material);
        points.frustumCulled = false;
        this.scene.add(points);
        this.petals = points;
    }

    private buildCrowd() {
        const specs: CrowdSpec[] = [];

        const loungeSpots: Array<[number, number, number]> = [
            [-6, 26, -0.4],
            [-1, 28, -0.15],
            [4, 29, 0.1],
            [12, 27, 0.5],
            [18, 21, 0.9],
            [-12, 22, -0.8],
        ];

        for (let i = 0; i < loungeSpots.length; i++) {
            const [x, z, rotation] = loungeSpots[i];
            specs.push({
                position: new THREE.Vector3(x, 0.12, z),
                set: "chill",
                facing: rotation + Math.PI,
                pose: "lounge",
                tilt: -0.42,
                held: i % 2 === 0 ? "cocktail" : undefined,
                accent: [0xff6f61, 0x7ce8a8, 0xffd166, 0x67c9ff, 0xff8fb1, 0xa855f7][i % 6],
                phase: this.random() * 9,
                solid: false,
            });
        }

        specs.push({
            position: new THREE.Vector3(BAR_POSITION.x - 0.4, 0, BAR_POSITION.z - 1.4),
            set: "chill",
            variantIndex: 2,
            facing: -0.6 + Math.PI,
            pose: "work",
            phase: 1.2,
        });

        for (let s = 0; s < 4; s++) {
            const local = new THREE.Vector3(-3.6 + s * 2.4, 0, 2.1);
            local.applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.6);
            specs.push({
                position: new THREE.Vector3(BAR_POSITION.x + local.x, seatedActorY(0.69), BAR_POSITION.z + local.z),
                set: "chill",
                facing: -0.6 + Math.PI,
                pose: s % 2 === 0 ? "sit" : "toast",
                held: s % 2 === 0 ? undefined : "cocktail",
                accent: [0x7ce8a8, 0xffd166, 0xff8fb1, 0x67c9ff][s],
                phase: this.random() * 9,
                solid: false,
            });
        }

        const hammockSpots: Array<[number, number, number]> = [
            [-26, 10, 0],
            [-28, -11, 0.6],
        ];

        for (const [x, z, rotation] of hammockSpots) {
            specs.push({
                position: new THREE.Vector3(x, 1.35, z),
                set: "chill",
                facing: rotation,
                pose: "lounge",
                tilt: -0.95,
                phase: this.random() * 9,
                solid: false,
            });
        }

        const walkers: Array<[number, number, number, number]> = [
            [-30, -28, 24, -20],
            [26, 34, -18, 30],
            [0, -30, 0, 30],
            [-40, 12, -10, -22],
            [34, -24, 40, 18],
        ];

        for (const [x1, z1, x2, z2] of walkers) {
            specs.push({
                position: new THREE.Vector3(x1, 0, z1),
                set: "chill",
                walk: {
                    path: [new THREE.Vector3(x1, 0, z1), new THREE.Vector3(x2, 0, z2)],
                    mode: "pingpong",
                    pause: 2 + this.random() * 4,
                    speed: 0.9 + this.random() * 0.5,
                },
                held: this.random() < 0.5 ? "cocktail" : undefined,
                accent: 0xff8fb1,
                phase: this.random() * 9,
            });
        }

        const dancers: Array<[number, number]> = [[-16, 2], [-13, 4], [-18, 6]];
        for (const [x, z] of dancers) {
            specs.push({
                position: new THREE.Vector3(x, 0, z),
                set: "chill",
                facing: this.random() * Math.PI * 2,
                pose: "dance",
                phase: this.random() * 9,
            });
        }

        for (let i = 0; i < 4; i++) {
            const angle = 0.6 + i * 0.5;
            specs.push({
                position: new THREE.Vector3(
                    POND_CENTER.x + Math.cos(angle) * (POND_RADIUS + 2.2),
                    0,
                    POND_CENTER.z + Math.sin(angle) * (POND_RADIUS + 2.2)
                ),
                set: "chill",
                lookAt: POND_CENTER,
                pose: i % 2 === 0 ? "gawk" : "toast",
                held: i % 2 === 0 ? undefined : "cocktail",
                phase: this.random() * 9,
            });
        }

        this.crowd.addMany(specs);
    }

    protected tick(delta: number): void {
        if (this.water) {
            this.water.position.y = 0.12 + Math.sin(this.elapsed * 0.7) * 0.02;
            (this.water.material as THREE.MeshStandardMaterial).opacity = 0.78 + Math.sin(this.elapsed * 0.9) * 0.05;
        }

        for (let i = 0; i < this.lilies.length; i++) {
            const lily = this.lilies[i];
            lily.position.y = 0.16 + Math.sin(this.elapsed * 0.8 + i) * 0.03;
            lily.rotation.y += delta * 0.05;
        }

        for (let i = 0; i < this.hammocks.length; i++) {
            this.hammocks[i].rotation.z = Math.sin(this.elapsed * 0.6 + i) * 0.035;
        }

        if (this.waterGlints) {
            (this.waterGlints.material as THREE.PointsMaterial).opacity = 0.45 + Math.sin(this.elapsed * 2.4) * 0.25;
        }

        for (const butterfly of this.butterflies) {
            const t = this.elapsed * butterfly.speed + butterfly.phase;
            butterfly.group.position.set(
                butterfly.center.x + Math.cos(t) * butterfly.radius,
                butterfly.height + Math.sin(t * 2.1) * 0.45,
                butterfly.center.z + Math.sin(t * 1.3) * butterfly.radius
            );
            butterfly.group.rotation.y = -t;

            const flap = Math.sin(this.elapsed * 14 + butterfly.phase) * 0.8;
            butterfly.wings[0].rotation.y = 0.6 + flap;
            butterfly.wings[1].rotation.y = -0.6 - flap;
        }

        if (this.petals) {
            const attribute = this.petals.geometry.getAttribute("position") as THREE.BufferAttribute;
            const array = attribute.array as Float32Array;
            for (let i = 0; i < array.length; i += 3) {
                array[i] += this.petalDrift[i] * delta;
                array[i + 1] += this.petalDrift[i + 1] * delta;
                array[i + 2] += (this.petalDrift[i + 2] + Math.sin(this.elapsed * 0.6 + i) * 0.3) * delta;

                if (array[i + 1] < 0.1) {
                    array[i] = (this.random() - 0.5) * FIELD_RADIUS * 2;
                    array[i + 1] = 12 + this.random() * 6;
                    array[i + 2] = (this.random() - 0.5) * FIELD_RADIUS * 2;
                }
            }
            attribute.needsUpdate = true;
        }
    }
}
