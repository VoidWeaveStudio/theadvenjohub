// src/features/game/world/locations/showcase/rooms/war/WarProps.ts
import * as THREE from "three";
import { AssetBin } from "../../../../AssetBin";
import { CollisionGrid } from "../../../../CollisionGrid";
import { bannerTexture, concreteTexture, groundTexture, MEMECOIN_BANNERS, roadTexture, rustTexture, sandbagTexture } from "./warTextures";

export interface WarLayout {
    halfWidth: number;
    redLine: number;
    blueLine: number;
    fieldDepth: number;
}

interface Flag {
    mesh: THREE.Mesh;
    phase: number;
}

export class WarProps {
    public readonly redCover: THREE.Vector3[] = [];
    public readonly blueCover: THREE.Vector3[] = [];
    public readonly firePoints: THREE.Vector3[] = [];
    public readonly smokePoints: THREE.Vector3[] = [];

    private flags: Flag[] = [];

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
        const groundMap = groundTexture(this.bin, this.random, 36);
        const roadMap = roadTexture(this.bin, this.random, 10);
        const concreteMap = concreteTexture(this.bin, this.random, 3);
        const rustMap = rustTexture(this.bin, this.random, 2);
        const sandbagMap = sandbagTexture(this.bin, this.random, 1);

        this.rustMap = rustMap;

        this.ground = this.bin.material(new THREE.MeshStandardMaterial({ map: groundMap, color: 0xc8c2b6, roughness: 0.98, metalness: 0.02 }));
        this.road = this.bin.material(new THREE.MeshStandardMaterial({ map: roadMap, color: 0xbdbdbd, roughness: 0.95, metalness: 0.04 }));
        this.concrete = this.bin.material(new THREE.MeshStandardMaterial({ map: concreteMap, color: 0xb8b2a6, roughness: 0.96, metalness: 0.03 }));
        this.concreteDark = this.bin.material(new THREE.MeshStandardMaterial({ map: concreteMap, color: 0x7c7669, roughness: 0.97, metalness: 0.03 }));
        this.rust = this.bin.material(new THREE.MeshStandardMaterial({ map: rustMap, color: 0xa89c90, roughness: 0.82, metalness: 0.42 }));
        this.sandbag = this.bin.material(new THREE.MeshStandardMaterial({ map: sandbagMap, color: 0xc8bfa6, roughness: 0.98, metalness: 0.02 }));
        this.wood = this.bin.material(new THREE.MeshStandardMaterial({ color: 0x5a4328, roughness: 0.93, metalness: 0.03 }));
        this.metal = this.bin.material(new THREE.MeshStandardMaterial({ map: rustMap, color: 0x7d7a74, roughness: 0.58, metalness: 0.72 }));
        this.burnt = this.bin.material(new THREE.MeshStandardMaterial({ color: 0x2b2724, roughness: 0.98, metalness: 0.12 }));
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

        const craterRim = this.bin.geometry(new THREE.TorusGeometry(1, 0.16, 6, 18));
        const craterFloor = this.bin.geometry(new THREE.CircleGeometry(1, 20));
        const craterMaterial = this.bin.material(new THREE.MeshStandardMaterial({ color: 0x3a3229, roughness: 0.99, metalness: 0.01 }));

        for (let i = 0; i < 44; i++) {
            const x = (this.random() - 0.5) * halfWidth * 2;
            const z = (this.random() - 0.5) * fieldDepth * 1.5;
            const radius = 2 + this.random() * 6;

            const floor = new THREE.Mesh(craterFloor, craterMaterial);
            floor.position.set(x, 0.04, z);
            floor.rotation.x = -Math.PI / 2;
            floor.scale.setScalar(radius);
            floor.receiveShadow = true;
            this.add(floor);

            const rim = new THREE.Mesh(craterRim, this.ground);
            rim.position.set(x, 0.12, z);
            rim.rotation.x = -Math.PI / 2;
            rim.scale.setScalar(radius);
            this.add(rim);

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
        const bagCount = bagColumns * 2;
        const bags = new THREE.InstancedMesh(bagGeometry, this.sandbag, bagCount);
        bags.castShadow = true;
        bags.receiveShadow = true;

        const matrix = new THREE.Matrix4();
        const quaternion = new THREE.Quaternion();
        const euler = new THREE.Euler();
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3();

        let index = 0;
        for (let column = 0; column < bagColumns; column++) {
            const x = -halfWidth + column * 0.82;

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

        grid.insertOrientedBox(0, z + facing * 1.9, halfWidth * 2 + 6, 1.6, 0, 0, 1.3);

        for (let x = -halfWidth + 4; x <= halfWidth; x += 7.5) {
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

        for (let i = 0; i < wireCount; i++) {
            position.set(-halfWidth + i * 2.1, 0.48, z + facing * (4.6 + (this.random() - 0.5) * 0.7));
            euler.set(this.random() * 0.5, Math.PI / 2, 0);
            quaternion.setFromEuler(euler);
            scale.setScalar(1);
            matrix.compose(position, quaternion, scale);
            wire.setMatrixAt(i, matrix);
        }

        wire.instanceMatrix.needsUpdate = true;
        this.add(wire);

        const cover = team === 0 ? this.redCover : this.blueCover;
        for (let x = -halfWidth + 6; x <= halfWidth - 6; x += 9.5) {
            cover.push(new THREE.Vector3(x, 0, z - facing * 0.6));
        }
        for (let i = 0; i < 6; i++) {
            cover.push(new THREE.Vector3(
                (this.random() - 0.5) * halfWidth * 1.6,
                0,
                z + facing * (6 + this.random() * 8)
            ));
        }
    }

    public buildBanners(z: number, facing: number, count: number) {
        const { halfWidth } = this.layout;

        for (let i = 0; i < count; i++) {
            const banner = MEMECOIN_BANNERS[(i + (facing > 0 ? 3 : 0)) % MEMECOIN_BANNERS.length];
            const x = -halfWidth + 12 + (i / Math.max(1, count - 1)) * (halfWidth * 2 - 24);

            const pole = this.mesh(new THREE.CylinderGeometry(0.1, 0.13, 8.4, 8), this.metal, x, 4.2, z - facing * 2.4);
            this.add(pole);

            const material = this.bin.material(new THREE.MeshStandardMaterial({
                map: bannerTexture(this.bin, banner),
                color: 0xffffff,
                roughness: 0.88,
                metalness: 0.02,
                side: THREE.DoubleSide,
            }));

            const cloth = new THREE.Mesh(this.bin.geometry(new THREE.PlaneGeometry(3.8, 2.4, 10, 5)), material);
            cloth.position.set(x + 1.95, 6.9, z - facing * 2.4);
            cloth.castShadow = true;
            this.add(cloth);

            this.flags.push({ mesh: cloth, phase: this.random() * 9 });
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

            const body = this.mesh(new THREE.BoxGeometry(4.4, 1.1, 2.1), this.burnt, 0, 0.85, 0);
            wreck.add(body);

            const cabin = this.mesh(new THREE.BoxGeometry(2.2, 1, 1.9), this.burnt, -0.3, 1.75, 0);
            wreck.add(cabin);

            const hood = this.mesh(new THREE.BoxGeometry(1.5, 0.2, 1.9), this.rust, 1.6, 1.45, 0);
            hood.rotation.z = 0.5;
            wreck.add(hood);

            for (const [dx, dz] of [[-1.5, -1], [-1.5, 1], [1.5, -1], [1.5, 1]] as Array<[number, number]>) {
                const wheel = this.mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 10), this.burnt, dx, 0.45, dz);
                wheel.rotation.x = Math.PI / 2;
                wreck.add(wheel);
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
            flag.mesh.rotation.y = Math.sin(elapsed * 1.1 + flag.phase) * 0.22;
            flag.mesh.rotation.z = Math.sin(elapsed * 1.7 + flag.phase) * 0.06;
            flag.mesh.rotation.x = Math.sin(elapsed * 0.9 + flag.phase * 0.5) * 0.04;
        }
    }
}
