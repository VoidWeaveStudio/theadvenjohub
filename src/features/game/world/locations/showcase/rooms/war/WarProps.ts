// src/features/game/world/locations/showcase/rooms/war/WarProps.ts
import * as THREE from "three";
import { AssetBin } from "../../../../AssetBin";
import { CollisionGrid } from "../../../../CollisionGrid";
import { bannerTexture, MEMECOIN_BANNERS, proceduralSurface, roadTexture, scorchTexture } from "./warTextures";

export interface WarLayout {
    halfWidth: number;
    redLine: number;
    blueLine: number;
    fieldDepth: number;
}

interface Flag {
    group: THREE.Group;
    material: THREE.MeshStandardMaterial;
    phase: number;
    bannerIndex: number;
    nextChangeAt: number;
    snapTimer: number;
}

// The war never settles on one ticker — every banner keeps swapping to a
// different memecoin on its own random clock, forever, so the two sides
// visibly never stop finding a new reason to fight.
const FLAG_CYCLE_MIN = 4;
const FLAG_CYCLE_MAX = 9;
const FLAG_SNAP_DURATION = 0.22;

// Communication gaps through the sandbag line. Both sides use the same x positions so a
// runner crossing from the rear always has an opening straight ahead of it.
export const TRENCH_GAPS = [-64, -32, 0, 32, 64];
const TRENCH_GAP_HALF = 3.6;

export function inTrenchGap(x: number): boolean {
    for (const centre of TRENCH_GAPS) {
        if (Math.abs(x - centre) < TRENCH_GAP_HALF) return true;
    }
    return false;
}

function trenchSolidSpans(halfWidth: number): Array<[number, number]> {
    const spans: Array<[number, number]> = [];
    let cursor = -halfWidth - 3;

    for (const centre of TRENCH_GAPS) {
        const start = centre - TRENCH_GAP_HALF;
        const end = centre + TRENCH_GAP_HALF;
        if (start > cursor) spans.push([cursor, start]);
        cursor = Math.max(cursor, end);
    }

    if (cursor < halfWidth + 3) spans.push([cursor, halfWidth + 3]);
    return spans;
}

export class WarProps {
    public readonly redCover: THREE.Vector3[] = [];
    public readonly blueCover: THREE.Vector3[] = [];
    public readonly firePoints: THREE.Vector3[] = [];
    public readonly smokePoints: THREE.Vector3[] = [];

    private flags: Flag[] = [];
    private bannerTextureCache = new Map<string, THREE.CanvasTexture>();

    private ground!: THREE.MeshStandardMaterial;
    private road!: THREE.MeshStandardMaterial;
    private concrete!: THREE.MeshStandardMaterial;
    private concreteDark!: THREE.MeshStandardMaterial;
    private rust!: THREE.MeshStandardMaterial;
    private sandbag!: THREE.MeshStandardMaterial;
    private wood!: THREE.MeshStandardMaterial;
    private metal!: THREE.MeshStandardMaterial;
    private burnt!: THREE.MeshStandardMaterial;

    public rustMap: THREE.Texture | null = null;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly bin: AssetBin,
        private readonly random: () => number,
        private readonly layout: WarLayout
    ) { }

    public prepare() {
        const dirt = proceduralSurface(this.bin, {
            key: "war-dirt",
            repeat: 30,
            seed: 41,
            baseFreq: 4,
            octaves: 5,
            warp: 0.5,
            contrast: 1.25,
            normalStrength: 3.2,
            stops: [
                { at: 0, color: 0x2a231b },
                { at: 0.35, color: 0x453a2c },
                { at: 0.62, color: 0x5d4f3c },
                { at: 0.85, color: 0x6f6047 },
                { at: 1, color: 0x8a795c },
            ],
        });

        const concrete = proceduralSurface(this.bin, {
            key: "war-concrete",
            repeat: 3,
            seed: 907,
            baseFreq: 5,
            octaves: 5,
            warp: 0.22,
            contrast: 0.85,
            normalStrength: 2.2,
            stops: [
                { at: 0, color: 0x38352f },
                { at: 0.4, color: 0x585349 },
                { at: 0.7, color: 0x6d675b },
                { at: 1, color: 0x847d6e },
            ],
        });

        const sandbag = proceduralSurface(this.bin, {
            key: "war-sandbag",
            size: 256,
            repeat: 1,
            seed: 233,
            baseFreq: 6,
            octaves: 4,
            warp: 0.3,
            contrast: 1.1,
            grain: 0.09,
            normalStrength: 3.6,
            stops: [
                { at: 0, color: 0x3d3626 },
                { at: 0.45, color: 0x5e5439 },
                { at: 0.75, color: 0x776a4b },
                { at: 1, color: 0x8e8060 },
            ],
        });

        const steel = proceduralSurface(this.bin, {
            key: "war-steel",
            size: 256,
            repeat: 2,
            seed: 613,
            baseFreq: 5,
            octaves: 5,
            warp: 0.42,
            contrast: 1.3,
            normalStrength: 2.8,
            stops: [
                { at: 0, color: 0x241f1c },
                { at: 0.35, color: 0x413c37 },
                { at: 0.6, color: 0x6b4327 },
                { at: 0.8, color: 0x8a5a2e },
                { at: 1, color: 0x9a8c7e },
            ],
        });

        const roadMap = roadTexture(this.bin, this.random, 10);

        this.rustMap = steel.map;

        this.ground = this.bin.material(new THREE.MeshStandardMaterial({
            map: dirt.map,
            normalMap: dirt.normalMap,
            normalScale: new THREE.Vector2(1.1, 1.1),
            roughness: 0.99,
            metalness: 0.02,
        }));
        this.road = this.bin.material(new THREE.MeshStandardMaterial({ map: roadMap, color: 0x8f8f8f, roughness: 0.96, metalness: 0.04 }));
        this.concrete = this.bin.material(new THREE.MeshStandardMaterial({
            map: concrete.map,
            normalMap: concrete.normalMap,
            normalScale: new THREE.Vector2(0.9, 0.9),
            roughness: 0.97,
            metalness: 0.03,
        }));
        this.concreteDark = this.bin.material(new THREE.MeshStandardMaterial({
            map: concrete.map,
            normalMap: concrete.normalMap,
            normalScale: new THREE.Vector2(0.9, 0.9),
            color: 0x6e695d,
            roughness: 0.98,
            metalness: 0.03,
        }));
        this.rust = this.bin.material(new THREE.MeshStandardMaterial({
            map: steel.map,
            normalMap: steel.normalMap,
            normalScale: new THREE.Vector2(1, 1),
            roughness: 0.78,
            metalness: 0.45,
        }));
        this.sandbag = this.bin.material(new THREE.MeshStandardMaterial({
            map: sandbag.map,
            normalMap: sandbag.normalMap,
            normalScale: new THREE.Vector2(1.3, 1.3),
            roughness: 0.99,
            metalness: 0.01,
        }));
        this.wood = this.bin.material(new THREE.MeshStandardMaterial({ color: 0x4a3722, roughness: 0.95, metalness: 0.03 }));
        this.metal = this.bin.material(new THREE.MeshStandardMaterial({
            map: steel.map,
            normalMap: steel.normalMap,
            color: 0x6e6b66,
            roughness: 0.55,
            metalness: 0.78,
        }));
        this.burnt = this.bin.material(new THREE.MeshStandardMaterial({ color: 0x211d1a, roughness: 0.99, metalness: 0.1 }));
    }

    private getBannerTexture(banner: (typeof MEMECOIN_BANNERS)[number]): THREE.CanvasTexture {
        const cached = this.bannerTextureCache.get(banner.ticker);
        if (cached) return cached;
        const texture = bannerTexture(this.bin, banner);
        this.bannerTextureCache.set(banner.ticker, texture);
        return texture;
    }

    private add(mesh: THREE.Object3D) {
        this.scene.add(mesh);
    }

    private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, rotationY = 0): THREE.Mesh {
        const created = new THREE.Mesh(this.bin.geometry(geometry), material);
        created.position.set(x, y, z);
        created.rotation.y = rotationY;
        created.castShadow = true;
        created.receiveShadow = true;
        return created;
    }

    public buildGround(grid: CollisionGrid) {
        const { halfWidth, fieldDepth } = this.layout;

        const field = this.mesh(new THREE.BoxGeometry(halfWidth * 2 + 120, 1.2, fieldDepth * 2 + 120), this.ground, 0, -0.6, 0);
        field.castShadow = false;
        this.add(field);

        const road = this.mesh(new THREE.PlaneGeometry(halfWidth * 2 + 80, 14), this.road, 0, 0.02, -2);
        road.rotation.x = -Math.PI / 2;
        road.castShadow = false;
        this.add(road);

        const crossRoad = this.mesh(new THREE.PlaneGeometry(16, fieldDepth * 1.7), this.road, -34, 0.03, 0);
        crossRoad.rotation.x = -Math.PI / 2;
        crossRoad.castShadow = false;
        this.add(crossRoad);

        // A soft alpha-blended scorch decal instead of a hard disc + a bright raised rim —
        // the rim was catching firelight and reading as a glowing ring rather than a burn
        // mark in the ground.
        const scorchMap = scorchTexture(this.bin, this.random);
        const craterFloor = this.bin.geometry(new THREE.CircleGeometry(1, 24));
        const craterMaterial = this.bin.material(new THREE.MeshBasicMaterial({
            map: scorchMap,
            transparent: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
        }));
        const debrisGeometry = this.bin.geometry(new THREE.DodecahedronGeometry(1, 0));

        for (let i = 0; i < 44; i++) {
            const x = (this.random() - 0.5) * halfWidth * 2;
            const z = (this.random() - 0.5) * fieldDepth * 1.5;
            const radius = 2 + this.random() * 6;

            const floor = new THREE.Mesh(craterFloor, craterMaterial);
            floor.position.set(x, 0.03, z);
            floor.rotation.x = -Math.PI / 2;
            floor.rotation.z = this.random() * Math.PI * 2;
            floor.scale.setScalar(radius);
            floor.receiveShadow = true;
            floor.castShadow = false;
            this.add(floor);

            const debrisCount = 3 + Math.floor(this.random() * 4);
            for (let d = 0; d < debrisCount; d++) {
                const angle = this.random() * Math.PI * 2;
                const dist = radius * (0.65 + this.random() * 0.4);
                const size = 0.12 + this.random() * 0.3;

                const chunk = new THREE.Mesh(debrisGeometry, this.concreteDark);
                chunk.position.set(x + Math.cos(angle) * dist, size * 0.4, z + Math.sin(angle) * dist);
                chunk.rotation.set(this.random() * 3, this.random() * 3, this.random() * 3);
                chunk.scale.setScalar(size);
                chunk.castShadow = true;
                this.add(chunk);
            }

            if (this.random() < 0.3 && this.firePoints.length < 16) {
                this.firePoints.push(new THREE.Vector3(x, 0.1, z));
            }
        }

        const rubbleGeometry = this.bin.geometry(new THREE.DodecahedronGeometry(1, 0));
        const rubble = new THREE.InstancedMesh(rubbleGeometry, this.concreteDark, 420);
        rubble.castShadow = true;
        rubble.receiveShadow = true;

        const matrix = new THREE.Matrix4();
        const quaternion = new THREE.Quaternion();
        const euler = new THREE.Euler();
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3();

        for (let i = 0; i < 420; i++) {
            position.set(
                (this.random() - 0.5) * (halfWidth * 2 + 60),
                this.random() * 0.35,
                (this.random() - 0.5) * (fieldDepth * 1.8)
            );
            euler.set(this.random() * 3, this.random() * 3, this.random() * 3);
            quaternion.setFromEuler(euler);
            const size = 0.22 + this.random() * 1.3;
            scale.set(size, size * 0.62, size);
            matrix.compose(position, quaternion, scale);
            rubble.setMatrixAt(i, matrix);
        }

        rubble.instanceMatrix.needsUpdate = true;
        this.add(rubble);

        grid.insertRingWall(halfWidth + 26, 3, 0, 12);
    }

    public buildTrench(z: number, facing: number, team: number, grid: CollisionGrid) {
        const { halfWidth } = this.layout;
        const bagGeometry = this.bin.geometry(new THREE.CapsuleGeometry(0.3, 0.62, 4, 8));

        const bagColumns = Math.floor((halfWidth * 2) / 0.82) + 1;
        const columnsX: number[] = [];
        for (let column = 0; column < bagColumns; column++) {
            const x = -halfWidth + column * 0.82;
            if (!inTrenchGap(x)) columnsX.push(x);
        }

        const bags = new THREE.InstancedMesh(bagGeometry, this.sandbag, columnsX.length * 2);
        bags.castShadow = true;
        bags.receiveShadow = true;

        const matrix = new THREE.Matrix4();
        const quaternion = new THREE.Quaternion();
        const euler = new THREE.Euler();
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3();

        let index = 0;
        for (const x of columnsX) {
            for (let row = 0; row < 2; row++) {
                position.set(
                    x + (row % 2) * 0.4,
                    0.26 + row * 0.46,
                    z + facing * (1.9 - row * 0.16) + (this.random() - 0.5) * 0.12
                );
                euler.set(0, (this.random() - 0.5) * 0.35, Math.PI / 2);
                quaternion.setFromEuler(euler);
                scale.setScalar(0.82 + this.random() * 0.16);
                matrix.compose(position, quaternion, scale);
                bags.setMatrixAt(index++, matrix);
            }
        }

        bags.instanceMatrix.needsUpdate = true;
        this.add(bags);

        // One box across the whole field walled the two halves off from each other, so
        // anyone spawning behind the line could never reach cover in front of it and just
        // pressed into the bags forever. The line is collided per solid span instead, with
        // the same openings the bags leave.
        for (const [from, to] of trenchSolidSpans(halfWidth)) {
            grid.insertOrientedBox((from + to) / 2, z + facing * 1.9, to - from, 1.6, 0, 0, 1.3);
        }

        for (let x = -halfWidth + 4; x <= halfWidth; x += 7.5) {
            if (inTrenchGap(x)) continue;

            const post = this.mesh(new THREE.BoxGeometry(0.26, 2.2, 0.26), this.wood, x, 1.1, z - facing * 0.7);
            this.add(post);

            const plank = this.mesh(new THREE.BoxGeometry(7.4, 0.16, 0.9), this.wood, x + 3.6, 0.08, z - facing * 1.6);
            plank.castShadow = false;
            this.add(plank);
        }

        for (let x = -halfWidth + 10; x <= halfWidth - 10; x += 26) {
            const crate = this.mesh(new THREE.BoxGeometry(1.5, 1, 1.1), this.wood, x + this.random() * 3, 0.5, z - facing * (3 + this.random()), this.random());
            this.add(crate);

            const crate2 = this.mesh(new THREE.BoxGeometry(1.2, 0.9, 1), this.wood, x + 1.4, 0.45, z - facing * (4.2 + this.random()), this.random());
            this.add(crate2);

            const barrel = this.mesh(new THREE.CylinderGeometry(0.55, 0.58, 1.2, 12), this.rust, x - 2.2, 0.6, z - facing * 3.4);
            this.add(barrel);

            if (this.smokePoints.length < 10 && this.random() < 0.5) {
                this.smokePoints.push(new THREE.Vector3(x - 2.2, 1.2, z - facing * 3.4));
            }
        }

        const wireGeometry = this.bin.geometry(new THREE.TorusGeometry(0.5, 0.035, 4, 10));
        const wireCount = Math.floor((halfWidth * 2) / 2.1) + 1;
        const wire = new THREE.InstancedMesh(wireGeometry, this.metal, wireCount);
        wire.castShadow = true;

        let wireIndex = 0;
        for (let i = 0; i < wireCount; i++) {
            const x = -halfWidth + i * 2.1;
            if (inTrenchGap(x)) continue;

            position.set(x, 0.48, z + facing * (4.6 + (this.random() - 0.5) * 0.7));
            euler.set(this.random() * 0.5, Math.PI / 2, 0);
            quaternion.setFromEuler(euler);
            scale.setScalar(1);
            matrix.compose(position, quaternion, scale);
            wire.setMatrixAt(wireIndex++, matrix);
        }

        wire.count = wireIndex;
        wire.instanceMatrix.needsUpdate = true;
        this.add(wire);

        const cover = team === 0 ? this.redCover : this.blueCover;
        for (let x = -halfWidth + 6; x <= halfWidth - 6; x += 9.5) {
            cover.push(new THREE.Vector3(x, 0, z - facing * 0.6));
        }
        for (let i = 0; i < 6; i++) {
            cover.push(new THREE.Vector3(
                TRENCH_GAPS[i % TRENCH_GAPS.length] + (this.random() - 0.5) * 3,
                0,
                z + facing * (6 + this.random() * 8)
            ));
        }
    }

    public buildBanners(z: number, facing: number, count: number) {
        const { halfWidth } = this.layout;

        for (let i = 0; i < count; i++) {
            const bannerIndex = (i + (facing > 0 ? 3 : 0)) % MEMECOIN_BANNERS.length;
            const x = -halfWidth + 12 + (i / Math.max(1, count - 1)) * (halfWidth * 2 - 24);

            const pole = this.mesh(new THREE.CylinderGeometry(0.1, 0.13, 8.4, 8), this.metal, x, 4.2, z - facing * 2.4);
            this.add(pole);

            // A single double-sided plane shows the SAME texture mirrored from behind —
            // two single-sided layers, the back one spun 180°, read correctly from both
            // sides instead.
            const material = this.bin.material(new THREE.MeshStandardMaterial({
                map: this.getBannerTexture(MEMECOIN_BANNERS[bannerIndex]),
                color: 0xffffff,
                roughness: 0.88,
                metalness: 0.02,
                side: THREE.FrontSide,
            }));

            const clothGeometry = this.bin.geometry(new THREE.PlaneGeometry(3.8, 2.4, 10, 5));
            const group = new THREE.Group();
            group.position.set(x + 1.95, 6.9, z - facing * 2.4);

            const front = new THREE.Mesh(clothGeometry, material);
            front.position.z = 0.01;
            front.castShadow = true;
            group.add(front);

            const back = new THREE.Mesh(clothGeometry, material);
            back.position.z = -0.01;
            back.rotation.y = Math.PI;
            back.castShadow = true;
            group.add(back);

            this.add(group);

            this.flags.push({
                group,
                material,
                phase: this.random() * 9,
                bannerIndex,
                nextChangeAt: this.random() * FLAG_CYCLE_MAX,
                snapTimer: 0,
            });
        }
    }

    public buildRuins(grid: CollisionGrid) {
        const { halfWidth } = this.layout;
        const rows = [-58, 58, -88, 88, -122, 122];

        for (const rowZ of rows) {
            const depth = 16 + Math.abs(rowZ) * 0.06;

            for (let x = -halfWidth - 40; x <= halfWidth + 40; x += 18 + this.random() * 8) {
                if (Math.abs(x) < 12 && Math.abs(rowZ) < 70) continue;

                const width = 11 + this.random() * 9;
                const floors = 2 + Math.floor(this.random() * 6);
                const height = floors * 3.6;
                const px = x + (this.random() - 0.5) * 5;
                const pz = rowZ + (this.random() - 0.5) * 7;
                const rotation = (this.random() - 0.5) * 0.35;

                const shell = new THREE.Group();
                shell.position.set(px, 0, pz);
                shell.rotation.y = rotation;

                for (const side of [-1, 1]) {
                    const wall = this.mesh(new THREE.BoxGeometry(0.5, height, depth), this.concrete, side * width * 0.5, height / 2, 0);
                    shell.add(wall);
                }

                const back = this.mesh(new THREE.BoxGeometry(width, height, 0.5), this.concrete, 0, height / 2, -depth * 0.5);
                shell.add(back);

                const broken = this.random() < 0.6;
                const frontHeight = broken ? height * (0.35 + this.random() * 0.4) : height;
                const front = this.mesh(new THREE.BoxGeometry(width, frontHeight, 0.5), this.concreteDark, 0, frontHeight / 2, depth * 0.5);
                shell.add(front);

                for (let f = 1; f <= floors; f++) {
                    const slab = this.mesh(new THREE.BoxGeometry(width + 0.8, 0.34, depth + 0.8), this.concreteDark, 0, f * 3.6, 0);
                    slab.castShadow = false;
                    shell.add(slab);

                    const columns = 3;
                    for (let c = 0; c < columns; c++) {
                        if (this.random() < 0.25) continue;
                        const wx = -width * 0.32 + c * (width * 0.32);
                        const frame = this.mesh(new THREE.BoxGeometry(2.1, 2.1, 0.26), this.concreteDark, wx, f * 3.6 - 1.5, depth * 0.5 + 0.1);
                        shell.add(frame);

                        const hole = this.mesh(new THREE.BoxGeometry(1.7, 1.7, 0.12), this.burnt, wx, f * 3.6 - 1.5, depth * 0.5 + 0.2);
                        hole.castShadow = false;
                        shell.add(hole);
                    }
                }

                if (broken) {
                    for (let r = 0; r < 5; r++) {
                        const bar = this.mesh(
                            new THREE.CylinderGeometry(0.05, 0.05, 1.8 + this.random() * 1.8, 5),
                            this.metal,
                            -width * 0.4 + r * (width * 0.2),
                            frontHeight + 1,
                            depth * 0.5 - 0.2
                        );
                        bar.rotation.z = (this.random() - 0.5) * 0.8;
                        bar.rotation.x = (this.random() - 0.5) * 0.5;
                        shell.add(bar);
                    }

                    const chunk = this.mesh(new THREE.BoxGeometry(width * 0.5, 2.2, depth * 0.5), this.concrete, width * 0.2, frontHeight + 1.1, depth * 0.1);
                    chunk.rotation.set(0.24, 0.4, 0.3);
                    shell.add(chunk);
                }

                for (let p = 0; p < 5; p++) {
                    const pile = this.mesh(
                        new THREE.DodecahedronGeometry(0.8 + this.random() * 1.5, 0),
                        this.concreteDark,
                        (this.random() - 0.5) * width * 1.3,
                        0.3,
                        depth * 0.5 + 1 + this.random() * 3
                    );
                    pile.scale.y = 0.55;
                    shell.add(pile);
                }

                this.add(shell);
                grid.insertOrientedBox(px, pz, width, depth, rotation, 0, height);

                if (this.firePoints.length < 18 && this.random() < 0.25) {
                    this.firePoints.push(new THREE.Vector3(px + (this.random() - 0.5) * width, 0.1, pz + depth * 0.5 + 2));
                }
                if (this.smokePoints.length < 12 && this.random() < 0.3) {
                    this.smokePoints.push(new THREE.Vector3(px, height, pz));
                }
            }
        }
    }

    // The row-based ruins in buildRuins() only cover the front/back of the field, leaving
    // the flanks open past halfWidth — enough to see clear sky/neighboring sets past the
    // edge of the room. A ring of plainer silhouettes beyond the player's max radius closes
    // the horizon on every side without needing the same interior/floor detail up close.
    public buildPerimeterRing(grid: CollisionGrid) {
        const ringRadius = 140;
        const count = 30;

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 + this.random() * 0.12;
            const px = Math.sin(angle) * ringRadius;
            const pz = Math.cos(angle) * ringRadius;

            const width = 14 + this.random() * 14;
            const floors = 3 + Math.floor(this.random() * 6);
            const height = floors * 3.6;
            const frontHeight = height * (0.4 + this.random() * 0.5);
            const rotation = angle + Math.PI + (this.random() - 0.5) * 0.3;

            const shell = new THREE.Group();
            shell.position.set(px, 0, pz);
            shell.rotation.y = rotation;

            const back = this.mesh(new THREE.BoxGeometry(width, height, 0.6), this.concreteDark, 0, height / 2, 6);
            back.castShadow = false;
            shell.add(back);

            for (const side of [-1, 1]) {
                const wall = this.mesh(new THREE.BoxGeometry(0.5, height, 12), this.concrete, side * width * 0.5, height / 2, 0);
                wall.castShadow = false;
                shell.add(wall);
            }

            const front = this.mesh(new THREE.BoxGeometry(width, frontHeight, 0.5), this.concreteDark, 0, frontHeight / 2, -6);
            front.castShadow = false;
            shell.add(front);

            for (let f = 1; f <= floors; f++) {
                const slab = this.mesh(new THREE.BoxGeometry(width + 0.6, 0.3, 12.6), this.concreteDark, 0, f * 3.6, 0);
                slab.castShadow = false;
                slab.receiveShadow = false;
                shell.add(slab);
            }

            this.add(shell);
            grid.insertOrientedBox(px, pz, width + 4, 14, rotation, 0, height);

            if (this.random() < 0.18) {
                this.smokePoints.push(new THREE.Vector3(px, height * 0.7, pz));
            }
        }
    }

    public buildBarriers(grid: CollisionGrid) {
        const { halfWidth } = this.layout;

        for (let i = 0; i < 26; i++) {
            const x = (this.random() - 0.5) * halfWidth * 2;
            const z = (this.random() - 0.5) * 30;

            const hedgehog = new THREE.Group();
            hedgehog.position.set(x, 1, z);
            hedgehog.rotation.y = this.random() * Math.PI;

            for (let b = 0; b < 3; b++) {
                const bar = this.mesh(new THREE.BoxGeometry(0.28, 3.4, 0.28), this.metal, 0, 0, 0);
                bar.rotation.set(b === 0 ? 0.9 : b === 1 ? -0.9 : 0, (b / 3) * Math.PI, b === 2 ? 0.9 : 0);
                hedgehog.add(bar);
            }

            this.add(hedgehog);
            grid.insertCylinder(new THREE.Vector3(x, 1, z), 1.3, 2.6);
        }

        for (let i = 0; i < 18; i++) {
            const x = (this.random() < 0.5 ? -1 : 1) * (14 + this.random() * (halfWidth - 20));
            const z = (this.random() - 0.5) * 34;
            const width = 3 + this.random() * 4;
            const height = 1.6 + this.random() * 2.4;

            const wall = this.mesh(new THREE.BoxGeometry(width, height, 0.8), this.concrete, x, height / 2, z, this.random() * Math.PI);
            this.add(wall);
            grid.insertOrientedBox(x, z, width, 1.2, 0, 0, height);
        }
    }

    public buildWrecks(grid: CollisionGrid) {
        const spots: Array<[number, number, number]> = [
            [-18, 6, 0.9], [24, -4, -0.4], [-46, -12, 2.1], [52, 10, 1.2], [8, 16, -1.1], [-64, 18, 0.3],
        ];

        for (const [x, z, rotation] of spots) {
            const wreck = new THREE.Group();
            wreck.position.set(x, 0, z);
            wreck.rotation.set(0.08, rotation, 0.14);

            // Burnt-out truck: chassis rails, a gutted cab and a cargo bed whose ribs are
            // all that is left of the canopy.
            for (const side of [-1, 1]) {
                const rail = this.mesh(new THREE.BoxGeometry(5.2, 0.18, 0.18), this.rust, 0, 0.62, side * 0.7);
                wreck.add(rail);
            }

            const axleFront = this.mesh(new THREE.BoxGeometry(0.2, 0.16, 2.1), this.rust, 1.5, 0.5, 0);
            const axleRear = this.mesh(new THREE.BoxGeometry(0.2, 0.16, 2.1), this.rust, -1.5, 0.5, 0);
            wreck.add(axleFront, axleRear);

            const bed = this.mesh(new THREE.BoxGeometry(2.9, 0.14, 2), this.burnt, -1.1, 0.78, 0);
            wreck.add(bed);

            for (const side of [-1, 1]) {
                const sidePanel = this.mesh(new THREE.BoxGeometry(2.9, 0.5, 0.12), this.burnt, -1.1, 1.03, side * 0.95);
                wreck.add(sidePanel);
            }

            for (let r = 0; r < 4; r++) {
                const rib = this.mesh(new THREE.TorusGeometry(0.92, 0.05, 5, 10, Math.PI), this.rust, -2.2 + r * 0.72, 1.05, 0);
                rib.rotation.y = Math.PI / 2;
                rib.castShadow = false;
                wreck.add(rib);
            }

            const cabFloor = this.mesh(new THREE.BoxGeometry(1.9, 0.14, 1.9), this.burnt, 1.2, 0.8, 0);
            wreck.add(cabFloor);

            const cabBack = this.mesh(new THREE.BoxGeometry(0.14, 1.25, 1.9), this.burnt, 0.35, 1.4, 0);
            wreck.add(cabBack);

            for (const side of [-1, 1]) {
                const pillar = this.mesh(new THREE.BoxGeometry(0.14, 1.2, 0.14), this.rust, 1.95, 1.4, side * 0.85);
                pillar.rotation.z = -0.12;
                wreck.add(pillar);
            }

            const roof = this.mesh(new THREE.BoxGeometry(1.7, 0.12, 1.9), this.burnt, 1.15, 1.98, 0);
            roof.rotation.z = -0.06;
            wreck.add(roof);

            const hood = this.mesh(new THREE.BoxGeometry(1.2, 0.16, 1.8), this.rust, 2.5, 1.32, 0);
            hood.rotation.z = 0.42;
            wreck.add(hood);

            const grille = this.mesh(new THREE.BoxGeometry(0.16, 0.7, 1.7), this.rust, 3.05, 0.95, 0);
            wreck.add(grille);

            const engine = this.mesh(new THREE.BoxGeometry(1.1, 0.7, 1.3), this.burnt, 2.5, 0.95, 0);
            wreck.add(engine);

            for (const [dx, dz, burnt] of [[1.5, -1, false], [1.5, 1, true], [-1.5, -1, true], [-1.5, 1, false]] as Array<[number, number, boolean]>) {
                if (burnt) {
                    // Burnt off the rim: just the hub is left.
                    const hub = this.mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.26, 8), this.rust, dx, 0.5, dz);
                    hub.rotation.x = Math.PI / 2;
                    wreck.add(hub);
                    continue;
                }

                const tyre = this.mesh(new THREE.TorusGeometry(0.42, 0.16, 6, 12), this.burnt, dx, 0.5, dz);
                tyre.rotation.y = Math.PI / 2;
                wreck.add(tyre);

                const hub = this.mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 8), this.rust, dx, 0.5, dz);
                hub.rotation.x = Math.PI / 2;
                wreck.add(hub);
            }

            this.add(wreck);
            grid.insertOrientedBox(x, z, 4.8, 2.6, rotation, 0, 2.4);

            if (this.firePoints.length < 20 && this.random() < 0.6) {
                this.firePoints.push(new THREE.Vector3(x, 0.6, z));
            }
        }
    }

    public update(delta: number, elapsed: number) {
        for (const flag of this.flags) {
            flag.group.rotation.y = Math.sin(elapsed * 1.1 + flag.phase) * 0.22;
            flag.group.rotation.z = Math.sin(elapsed * 1.7 + flag.phase) * 0.06;
            flag.group.rotation.x = Math.sin(elapsed * 0.9 + flag.phase * 0.5) * 0.04;

            if (elapsed >= flag.nextChangeAt) {
                const step = 1 + Math.floor(this.random() * (MEMECOIN_BANNERS.length - 1));
                flag.bannerIndex = (flag.bannerIndex + step) % MEMECOIN_BANNERS.length;
                flag.material.map = this.getBannerTexture(MEMECOIN_BANNERS[flag.bannerIndex]);
                flag.material.needsUpdate = true;
                flag.nextChangeAt = elapsed + FLAG_CYCLE_MIN + this.random() * (FLAG_CYCLE_MAX - FLAG_CYCLE_MIN);
                flag.snapTimer = FLAG_SNAP_DURATION;
            }

            if (flag.snapTimer > 0) {
                flag.snapTimer = Math.max(0, flag.snapTimer - delta);
                const t = flag.snapTimer / FLAG_SNAP_DURATION;
                flag.group.scale.x = 1 - Math.sin(t * Math.PI) * 0.85;
            } else if (flag.group.scale.x !== 1) {
                flag.group.scale.x = 1;
            }
        }
    }
}
