// src/features/game/world/locations/showcase/rooms/GardenRoom.ts
import * as THREE from "three";
import { ShowcaseRoom } from "../ShowcaseRoom";
import { ResourceManager } from "../../../../core/ResourceManager";
import { SHOWCASE_INFO_BY_ID, ShowcaseInfo } from "../config";
import { CrowdSpec } from "../actors/ShowcaseCrowd";
import { GROUND_SEAT_Y, seatedActorY } from "../actors/poses";
import type { ShowcaseActor } from "../actors/ShowcaseActor";

const FIELD_RADIUS = 66;
const POND_CENTER = new THREE.Vector3(4, 0, 20);
const POND_RADIUS = 14;
const ISLAND_RADIUS = 4.6;
const BAR_POSITION = new THREE.Vector3(28, 0, -8);
const STAGE_CENTER = new THREE.Vector3(-21, 0, -17);
const TOPIARY_CENTER = new THREE.Vector3(-27, 0, 9);
const PICNIC_CENTER = new THREE.Vector3(17, 0, -24);
const ZEN_CENTER = new THREE.Vector3(-33, 0, 27);
const PETAL_COUNT = 260;
const BUTTERFLY_COUNT = 18;
const FLOWER_COLORS = [0xff6f9a, 0xffd166, 0xf6f2f2, 0xa855f7, 0xff8f5a, 0x67c9ff];
const LOUNGER_SEAT_Y = 0.52;
const LOUNGER_SPOTS: Array<[number, number, number]> = [
    [-6, 4, -0.4],
    [-1.6, 3, -0.15],
    [3.4, 2.4, 0.1],
    [11, 3.4, 0.5],
    [16, 0, 0.9],
    [-12, 1, -0.8],
];

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
    private spray: THREE.Points | null = null;
    private sprayVelocity: Float32Array = new Float32Array(0);
    private lanterns: THREE.Object3D[] = [];
    private banners: THREE.Group[] = [];
    private koi: THREE.Object3D[] = [];
    private guest: ShowcaseActor | null = null;
    private waiter: ShowcaseActor | null = null;
    private guestBubble: THREE.Sprite | null = null;
    private waiterBubble: THREE.Sprite | null = null;

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

        for (let i = 0; i < 11; i++) {
            const cloud = new THREE.Group();
            const angle = (i / 11) * Math.PI * 2 + this.random();
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

        const hills = this.textured(this.tex.grass(14, 0x5d9a44, 0x86c25c), { roughness: 0.98, metalness: 0 });
        for (let i = 0; i < 14; i++) {
            const angle = (i / 14) * Math.PI * 2 + this.random() * 0.2;
            const distance = FIELD_RADIUS + 26 + this.random() * 30;
            const radius = 16 + this.random() * 22;
            const hill = this.mesh(
                new THREE.SphereGeometry(radius, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
                hills,
                [Math.cos(angle) * distance, -radius * 0.55, Math.sin(angle) * distance]
            );
            hill.castShadow = false;
            hill.receiveShadow = false;
            this.scene.add(hill);
        }
    }

    protected decorate(rm: ResourceManager): void {
        this.buildGround();
        this.buildPond();
        this.buildIsland();
        this.buildBridge();
        this.buildFlowers();
        this.buildGrassTufts();
        this.buildHedges();
        this.buildTrees();
        this.buildPergola();
        this.buildTopiaryChart();
        this.buildStage();
        this.buildPicnic();
        this.buildZenCorner();
        this.buildDeck();
        this.buildBar();
        this.buildLoungers();
        this.buildHammocks();
        this.buildLanterns();
        this.buildButterflies();
        this.buildPetals();
        this.buildCrowd();
        this.buildService(rm);
    }

    private buildService(rm: ResourceManager) {
        const [loungeX, loungeZ, loungeRotation] = LOUNGER_SPOTS[2];
        const seat = new THREE.Vector3(
            loungeX - Math.sin(loungeRotation) * 0.12,
            seatedActorY(LOUNGER_SEAT_Y) + 0.14,
            loungeZ - Math.cos(loungeRotation) * 0.12
        );
        const approach = new THREE.Vector3(5.4, 0, 2.6);
        const leave = new THREE.Vector3(8.5, 0, -9);
        const barHome = new THREE.Vector3(0, 0, -2);
        const serveSpot = new THREE.Vector3(5.8, 0, 1.4);

        const guest = this.crowd.createActor(rm, {
            position: leave.clone(),
            set: "chill",
            variantIndex: 3,
            facing: 0.2,
            held: "cocktail",
            accent: 0x7ce8a8,
            phase: 1.4,
            solid: false,
        }, this.collisionGrid);

        const waiter = this.crowd.createActor(rm, {
            position: barHome.clone(),
            set: "chill",
            variantIndex: 2,
            facing: 0.6,
            pose: "carry",
            held: "cocktail",
            accent: 0xffd166,
            phase: 0.4,
            solid: false,
        }, this.collisionGrid);

        this.guest = guest;
        this.waiter = waiter;

        if (!guest || !waiter) return;

        guest.setHeldVisible(false);

        const guestBubble = this.bubble("DIAMOND HANDS", "#7ce8a8", { width: 3, tone: "shout", y: 1.9 });
        guest.group.add(guestBubble);
        this.guestBubble = guestBubble;

        const waiterBubble = this.bubble("ONE MORE, SIR?", "#ffd166", { width: 2.8, y: 2.9 });
        waiter.group.add(waiterBubble);
        this.waiterBubble = waiterBubble;

        this.addStory([
            {
                duration: 9,
                enter: () => {
                    guest.setPose(undefined);
                    guest.setTilt(0);
                    guest.setHeldVisible(false);
                    guest.moveTo(leave.x, 0, leave.z);
                    guest.setDestination(approach, 1.15);
                    guestBubble.visible = false;
                    waiterBubble.visible = false;
                },
            },
            {
                duration: 3,
                enter: () => {
                    guest.setDestination(null);
                    guest.moveTo(seat.x, seat.y, seat.z);
                    guest.setFacing(loungeRotation);
                    guest.setPose("lounge");
                },
            },
            {
                duration: 7,
                enter: () => {
                    waiter.setPose("carry");
                    waiter.setHeldVisible(true);
                    waiter.setDestination(serveSpot, 1.25);
                },
            },
            {
                duration: 4,
                enter: () => {
                    waiter.setDestination(null);
                    waiter.faceTowards(new THREE.Vector3(seat.x, 1, seat.z));
                    waiter.setPose("haggle");
                    waiterBubble.visible = true;
                },
            },
            {
                duration: 3,
                enter: () => {
                    waiterBubble.visible = false;
                    waiter.setHeldVisible(false);
                    waiter.setPose("carry");
                    guest.setHeldVisible(true);
                    guest.setPose("toast");
                    guestBubble.visible = true;
                },
            },
            {
                duration: 9,
                enter: () => {
                    guest.setPose("lounge");
                    waiter.setDestination(barHome, 1.15);
                },
                update: (elapsed) => {
                    guestBubble.visible = elapsed < 3;
                },
            },
            {
                duration: 8,
                enter: () => {
                    waiter.setDestination(null);
                    waiter.faceTowards(new THREE.Vector3(seat.x, 1, seat.z));
                    guestBubble.visible = false;
                },
            },
            {
                duration: 6,
                enter: () => {
                    guest.setPose(undefined);
                    guest.setHeldVisible(true);
                    guest.moveTo(approach.x, 0, approach.z);
                    guest.setDestination(leave, 1.2);
                },
            },
        ]);
    }

    protected groundHeight(_x: number, _z: number): number {
        return 0;
    }

    private buildGround() {
        const grass = this.textured(this.tex.grass(30, 0x4f8f3c, 0x7fc255), { roughness: 0.98, metalness: 0, bump: 0.04 });
        const grassDark = this.textured(this.tex.grass(6, 0x3f7534, 0x63a545), { roughness: 0.98, metalness: 0 });
        const sand = this.textured(this.tex.sand(10, 0xd9c493), { roughness: 0.96, metalness: 0, bump: 0.03 });
        const stone = this.textured(this.tex.cobble(8, 0xc2b7a2, 0x928878), { roughness: 0.92, metalness: 0.04, bump: 0.05 });

        const field = this.mesh(new THREE.CircleGeometry(FIELD_RADIUS + 26, 72), grass, [0, 0, 0], [-Math.PI / 2, 0, 0]);
        field.castShadow = false;
        this.scene.add(field);

        for (let i = 0; i < 26; i++) {
            const angle = this.random() * Math.PI * 2;
            const distance = this.random() * FIELD_RADIUS;
            const patch = this.mesh(
                new THREE.CircleGeometry(4 + this.random() * 9, 18),
                grassDark,
                [Math.cos(angle) * distance, 0.02, Math.sin(angle) * distance],
                [-Math.PI / 2, 0, 0]
            );
            patch.castShadow = false;
            this.scene.add(patch);
        }

        const shore = this.mesh(
            new THREE.RingGeometry(POND_RADIUS - 0.6, POND_RADIUS + 3.4, 54),
            sand,
            [POND_CENTER.x, 0.04, POND_CENTER.z],
            [-Math.PI / 2, 0, 0]
        );
        shore.castShadow = false;
        this.scene.add(shore);

        const path = this.mesh(new THREE.PlaneGeometry(4.2, 50, 1, 1), stone, [0, 0.08, -20], [-Math.PI / 2, 0, 0]);
        path.castShadow = false;
        this.scene.add(path);

        const ring = this.mesh(new THREE.RingGeometry(5.6, 9.4, 48), stone, [0, 0.1, 2], [-Math.PI / 2, 0, 0]);
        ring.castShadow = false;
        this.scene.add(ring);

        const spurs: Array<[number, number]> = [
            [BAR_POSITION.x, BAR_POSITION.z],
            [STAGE_CENTER.x, STAGE_CENTER.z],
            [TOPIARY_CENTER.x, TOPIARY_CENTER.z],
            [PICNIC_CENTER.x, PICNIC_CENTER.z],
            [ZEN_CENTER.x, ZEN_CENTER.z],
        ];

        for (const [x, z] of spurs) {
            const length = Math.hypot(x, z - 2);
            const spur = this.mesh(
                new THREE.PlaneGeometry(2.8, length),
                sand,
                [x / 2, 0.06, (z + 2) / 2],
                [-Math.PI / 2, 0, 0]
            );
            spur.rotation.z = -Math.atan2(x, z - 2);
            spur.castShadow = false;
            this.scene.add(spur);
        }

        this.collisionGrid.insertRingWall(FIELD_RADIUS + 4, 2, 0, 6);
    }

    private buildPond() {
        const waterMaterial = this.textured(this.tex.water(3, 0x2f9fc4, 0x8fe6f2), {
            roughness: 0.14,
            metalness: 0.25,
        });
        waterMaterial.transparent = true;
        waterMaterial.opacity = 0.84;

        const water = this.mesh(
            new THREE.CircleGeometry(POND_RADIUS, 60),
            waterMaterial,
            [POND_CENTER.x, 0.12, POND_CENTER.z],
            [-Math.PI / 2, 0, 0]
        );
        water.castShadow = false;
        this.scene.add(water);
        this.water = water;

        const bed = this.mesh(
            new THREE.CylinderGeometry(POND_RADIUS, POND_RADIUS - 1.4, 1.4, 52),
            this.textured(this.tex.dirt(5, 0x2f6a58, 0x6b8f7a), { roughness: 0.96, metalness: 0.02 }),
            [POND_CENTER.x, -0.6, POND_CENTER.z]
        );
        bed.castShadow = false;
        this.scene.add(bed);

        const rim = this.textured(this.tex.cobble(6, 0x9b8f7a, 0x5f5648), { roughness: 0.92, metalness: 0.05, bump: 0.06 });
        const rockGeometry = this.bin.geometry(new THREE.DodecahedronGeometry(0.9, 0));
        for (let i = 0; i < 26; i++) {
            const angle = (i / 26) * Math.PI * 2 + this.random() * 0.1;
            const rock = new THREE.Mesh(rockGeometry, rim);
            rock.position.set(
                POND_CENTER.x + Math.cos(angle) * (POND_RADIUS + 0.4),
                0.1 + this.random() * 0.2,
                POND_CENTER.z + Math.sin(angle) * (POND_RADIUS + 0.4)
            );
            rock.rotation.set(this.random(), this.random() * Math.PI, this.random());
            rock.scale.setScalar(0.6 + this.random() * 0.7);
            rock.castShadow = true;
            rock.receiveShadow = true;
            this.scene.add(rock);
        }

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

        for (let i = 0; i < 14; i++) {
            const angle = this.random() * Math.PI * 2;
            const distance = ISLAND_RADIUS + 2 + this.random() * (POND_RADIUS - ISLAND_RADIUS - 4);
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

        const koiMaterials = [this.matte(0xff8f5a, 0.6), this.matte(0xf6f2f2, 0.6), this.matte(0xffd166, 0.6)];
        const koiBody = this.bin.geometry(new THREE.ConeGeometry(0.22, 1.1, 7));
        for (let i = 0; i < 9; i++) {
            const fish = new THREE.Mesh(koiBody, koiMaterials[i % koiMaterials.length]);
            fish.rotation.x = Math.PI / 2;
            fish.castShadow = false;
            const holder = new THREE.Group();
            holder.add(fish);
            holder.position.set(POND_CENTER.x, 0.06, POND_CENTER.z);
            holder.userData.radius = ISLAND_RADIUS + 1.6 + this.random() * (POND_RADIUS - ISLAND_RADIUS - 3);
            holder.userData.speed = 0.22 + this.random() * 0.3;
            holder.userData.phase = this.random() * Math.PI * 2;
            this.scene.add(holder);
            this.koi.push(holder);
        }
    }

    private buildIsland() {
        const sand = this.textured(this.tex.sand(4, 0xe0cfa2), { roughness: 0.95, metalness: 0 });
        const wood = this.textured(this.tex.planks([2, 1], 0xb98a4f, 0x6f4f2a, 6), { roughness: 0.88, metalness: 0.03, bump: 0.04 });
        const roofSkin = this.textured(this.tex.stripes(3, 0x4f9f7a, 0xe8f0e0, 8), { roughness: 0.9, metalness: 0.02 });

        const island = this.mesh(new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS - 0.8, 0.7, 26), sand, [POND_CENTER.x, 0.2, POND_CENTER.z]);
        island.receiveShadow = true;
        this.scene.add(island);
        this.collisionGrid.insertCylinder(new THREE.Vector3(POND_CENTER.x, 0.2, POND_CENTER.z), ISLAND_RADIUS, 0.6);

        const pavilion = new THREE.Group();
        pavilion.position.set(POND_CENTER.x, 0.55, POND_CENTER.z);

        const floor = this.mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.2, 20), wood, [0, 0.1, 0]);
        pavilion.add(floor);

        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const post = this.mesh(new THREE.CylinderGeometry(0.14, 0.16, 3.2, 8), wood, [Math.cos(angle) * 2.9, 1.8, Math.sin(angle) * 2.9]);
            pavilion.add(post);
        }

        const roof = this.mesh(new THREE.ConeGeometry(4.3, 1.8, 6), roofSkin, [0, 4.3, 0]);
        pavilion.add(roof);

        const finial = this.mesh(new THREE.SphereGeometry(0.28, 12, 10), this.lit(0x7ce8a8, 0.8), [0, 5.3, 0]);
        pavilion.add(finial);

        const table = this.mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.14, 16), wood, [0, 0.9, 0]);
        pavilion.add(table);
        const stem = this.mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.8, 8), wood, [0, 0.5, 0]);
        pavilion.add(stem);

        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2 + 0.5;
            const glass = this.mesh(
                new THREE.CylinderGeometry(0.1, 0.08, 0.24, 10),
                this.bin.material(new THREE.MeshStandardMaterial({ color: 0x7ce8a8, roughness: 0.12, transparent: true, opacity: 0.85 })),
                [Math.cos(angle) * 0.6, 1.09, Math.sin(angle) * 0.6]
            );
            pavilion.add(glass);
        }

        this.scene.add(pavilion);
        this.collisionGrid.insertCylinder(new THREE.Vector3(POND_CENTER.x, 1, POND_CENTER.z), 1.2, 1.1);

        const sprayCount = 180;
        const positions = new Float32Array(sprayCount * 3);
        this.sprayVelocity = new Float32Array(sprayCount * 3);
        for (let i = 0; i < sprayCount; i++) {
            this.resetSpray(positions, i);
        }

        const geometry = this.bin.geometry(new THREE.BufferGeometry());
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const material = this.bin.material(new THREE.PointsMaterial({
            color: 0xdff4ff,
            size: 0.16,
            transparent: true,
            opacity: 0.75,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            fog: false,
        }));
        const points = new THREE.Points(geometry, material);
        points.frustumCulled = false;
        this.scene.add(points);
        this.spray = points;
    }

    private resetSpray(array: Float32Array, index: number) {
        const angle = this.random() * Math.PI * 2;
        const speed = 1.6 + this.random() * 1.4;
        array[index * 3] = POND_CENTER.x + Math.cos(angle) * 0.2;
        array[index * 3 + 1] = 5.6;
        array[index * 3 + 2] = POND_CENTER.z + Math.sin(angle) * 0.2;
        this.sprayVelocity[index * 3] = Math.cos(angle) * speed;
        this.sprayVelocity[index * 3 + 1] = 2.4 + this.random() * 1.6;
        this.sprayVelocity[index * 3 + 2] = Math.sin(angle) * speed;
    }

    private buildBridge() {
        const wood = this.textured(this.tex.planks([4, 1], 0xb98a4f, 0x6f4f2a, 6), { roughness: 0.9, metalness: 0.03, bump: 0.04 });
        const rope = this.matte(0xe8dcc0, 0.9);

        const start = new THREE.Vector3(POND_CENTER.x, 0, POND_CENTER.z - POND_RADIUS - 1);
        const end = new THREE.Vector3(POND_CENTER.x, 0, POND_CENTER.z - ISLAND_RADIUS + 0.4);
        const span = start.distanceTo(end);
        const segments = 10;

        const bridge = new THREE.Group();
        bridge.position.set(POND_CENTER.x, 0, (start.z + end.z) / 2);

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const z = (t - 0.5) * span;
            const lift = Math.sin(t * Math.PI) * 1.1;
            const board = this.mesh(new THREE.BoxGeometry(3.2, 0.16, span / segments + 0.06), wood, [0, 0.62 + lift, z]);
            bridge.add(board);

            if (i % 2 === 0) {
                for (const side of [-1, 1]) {
                    const post = this.mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), wood, [side * 1.5, 1.15 + lift, z]);
                    bridge.add(post);

                    const rail = this.mesh(new THREE.CylinderGeometry(0.05, 0.05, span / segments * 2.1, 5), rope, [side * 1.5, 1.68 + lift, z], [Math.PI / 2, 0, 0]);
                    bridge.add(rail);
                }
            }
        }

        this.scene.add(bridge);
        this.collisionGrid.insertOrientedBox(POND_CENTER.x, (start.z + end.z) / 2, 3.2, span, 0, 0, 0.8);
    }

    private buildFlowers() {
        const stemMaterial = this.matte(0x4f8f46, 0.95);
        const stemGeometry = this.bin.geometry(new THREE.CylinderGeometry(0.02, 0.035, 0.5, 5));
        const petalGeometry = this.bin.geometry(new THREE.TorusGeometry(0.11, 0.055, 5, 7));
        const coreGeometry = this.bin.geometry(new THREE.SphereGeometry(0.06, 7, 5));
        const coreMaterial = this.matte(0xffe9a8, 0.7);

        const matrix = new THREE.Matrix4();
        const quaternion = new THREE.Quaternion();
        const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3(1, 1, 1);

        for (const color of FLOWER_COLORS) {
            const material = this.matte(color, 0.72, 0.02);
            const count = 210;
            const stems = new THREE.InstancedMesh(stemGeometry, stemMaterial, count);
            const petals = new THREE.InstancedMesh(petalGeometry, material, count);
            const cores = new THREE.InstancedMesh(coreGeometry, coreMaterial, count);
            stems.castShadow = false;
            petals.castShadow = true;
            cores.castShadow = false;

            for (let i = 0; i < count; i++) {
                const angle = this.random() * Math.PI * 2;
                const distance = Math.sqrt(this.random()) * FIELD_RADIUS;
                let x = Math.cos(angle) * distance;
                let z = Math.sin(angle) * distance;

                if (Math.hypot(x - POND_CENTER.x, z - POND_CENTER.z) < POND_RADIUS + 4) {
                    x += 26;
                    z -= 8;
                }
                if (Math.abs(x) < 3 && z < 4 && z > -46) x += x < 0 ? -5 : 5;

                const height = 0.34 + this.random() * 0.44;

                position.set(x, height * 0.5, z);
                scale.set(1, height / 0.5, 1);
                quaternion.identity();
                matrix.compose(position, quaternion, scale);
                stems.setMatrixAt(i, matrix);

                position.y = height + 0.05;
                scale.set(1, 1, 1);
                quaternion.copy(flat);
                matrix.compose(position, quaternion, scale);
                petals.setMatrixAt(i, matrix);

                quaternion.identity();
                matrix.compose(position, quaternion, scale);
                cores.setMatrixAt(i, matrix);
            }

            stems.instanceMatrix.needsUpdate = true;
            petals.instanceMatrix.needsUpdate = true;
            cores.instanceMatrix.needsUpdate = true;
            this.scene.add(stems);
            this.scene.add(petals);
            this.scene.add(cores);
        }
    }

    private buildGrassTufts() {
        const tuftGeometry = this.bin.geometry(new THREE.ConeGeometry(0.16, 0.6, 4, 1, true));
        const tuftMaterial = this.matte(0x66ab48, 0.96, 0.01);
        tuftMaterial.side = THREE.DoubleSide;
        const count = 900;
        const tufts = new THREE.InstancedMesh(tuftGeometry, tuftMaterial, count);
        tufts.castShadow = false;
        tufts.receiveShadow = false;

        const matrix = new THREE.Matrix4();
        const quaternion = new THREE.Quaternion();
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3(1, 1, 1);

        let placed = 0;
        let guard = 0;
        while (placed < count && guard < count * 12) {
            guard++;
            const angle = this.random() * Math.PI * 2;
            const distance = Math.sqrt(this.random()) * (FIELD_RADIUS + 12);
            const x = Math.cos(angle) * distance;
            const z = Math.sin(angle) * distance;
            if (this.onHardSurface(x, z)) continue;
            const height = 0.4 + this.random() * 0.6;

            position.set(x, height * 0.5, z);
            quaternion.setFromEuler(new THREE.Euler((this.random() - 0.5) * 0.3, this.random() * Math.PI, (this.random() - 0.5) * 0.3));
            scale.set(0.8 + this.random() * 0.7, height / 0.6, 0.8 + this.random() * 0.7);
            matrix.compose(position, quaternion, scale);
            tufts.setMatrixAt(placed, matrix);
            placed++;
        }

        tufts.count = placed;
        tufts.instanceMatrix.needsUpdate = true;
        this.scene.add(tufts);
    }

    private onHardSurface(x: number, z: number): boolean {
        if (Math.abs(x) < 2.6 && z > -46 && z < 4) return true;
        if (Math.hypot(x, z - 2) < 9.8) return true;
        if (Math.hypot(x - POND_CENTER.x, z - POND_CENTER.z) < POND_RADIUS + 3.6) return true;
        if (Math.hypot(x - TOPIARY_CENTER.x, z - TOPIARY_CENTER.z) < 11.8) return true;
        if (Math.hypot(x - ZEN_CENTER.x, z - ZEN_CENTER.z) < 9.6) return true;
        if (Math.hypot(x - STAGE_CENTER.x, z - STAGE_CENTER.z) < 7) return true;
        if (Math.hypot(x - STAGE_CENTER.x - 9, z - STAGE_CENTER.z - 9) < 9.2) return true;
        if (Math.hypot(x - BAR_POSITION.x, z - BAR_POSITION.z) < 7.6) return true;
        if (Math.hypot(x - PICNIC_CENTER.x, z - PICNIC_CENTER.z) < 8.4) return true;
        return false;
    }

    private buildHedges() {
        const hedge = this.textured(this.tex.grass(3, 0x3a7a38, 0x5fa34a), { roughness: 0.97, metalness: 0, bump: 0.08 });
        const segment = this.bin.geometry(new THREE.BoxGeometry(6, 1.5, 1.4));

        const runs: Array<[number, number, number, number]> = [
            [24, 8, 24, 20],
            [14, -2, 14, -10],
            [-36, 18, -24, 18],
            [22, -32, 32, -20],
        ];

        for (const [x1, z1, x2, z2] of runs) {
            const length = Math.hypot(x2 - x1, z2 - z1);
            const steps = Math.max(1, Math.round(length / 6));
            const angle = Math.atan2(x2 - x1, z2 - z1);

            for (let i = 0; i < steps; i++) {
                const t = (i + 0.5) / steps;
                const x = x1 + (x2 - x1) * t;
                const z = z1 + (z2 - z1) * t;
                const bush = new THREE.Mesh(segment, hedge);
                bush.position.set(x, 0.75, z);
                bush.rotation.y = angle + Math.PI / 2;
                bush.castShadow = true;
                bush.receiveShadow = true;
                this.scene.add(bush);
                this.collisionGrid.insertOrientedBox(x, z, 6, 1.4, angle + Math.PI / 2, 0, 1.5);
            }
        }
    }

    private buildTrees() {
        const trunk = this.textured(this.tex.bark([2, 3], 0x6b4a2a), { roughness: 0.96, metalness: 0.02, bump: 0.1 });
        const leaf = this.matte(0x3f8f46, 0.9);
        const leafLight = this.matte(0x5fb85a, 0.88);
        const palmLeaf = this.matte(0x4fa85c, 0.85);
        const blossom = this.matte(0xffb3d9, 0.8);

        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2 + this.random() * 0.3;
            const distance = 30 + this.random() * 30;
            const x = Math.cos(angle) * distance;
            const z = Math.sin(angle) * distance;
            if (Math.hypot(x - POND_CENTER.x, z - POND_CENTER.z) < POND_RADIUS + 6) continue;
            if (Math.abs(x) < 5 && z < 0) continue;

            const height = 5 + this.random() * 4;
            const tree = new THREE.Group();
            tree.position.set(x, 0, z);

            const stem = this.mesh(new THREE.CylinderGeometry(0.28, 0.45, height, 9), trunk, [0, height / 2, 0]);
            tree.add(stem);

            if (i % 4 === 0) {
                for (let f = 0; f < 7; f++) {
                    const frondAngle = (f / 7) * Math.PI * 2;
                    const frond = this.mesh(
                        new THREE.ConeGeometry(0.7, 4.4, 5),
                        palmLeaf,
                        [Math.cos(frondAngle) * 1.6, height + 0.4, Math.sin(frondAngle) * 1.6],
                        [Math.sin(frondAngle) * 0.9, -frondAngle, Math.cos(frondAngle) * 0.9 + Math.PI / 2.4]
                    );
                    tree.add(frond);
                }
            } else {
                const crownMaterial = i % 3 === 0 ? blossom : (i % 2 === 0 ? leaf : leafLight);
                for (let c = 0; c < 4; c++) {
                    const blob = this.mesh(
                        new THREE.IcosahedronGeometry(1.9 + this.random() * 1.1, 0),
                        crownMaterial,
                        [(this.random() - 0.5) * 2.6, height + 0.6 + this.random() * 1.6, (this.random() - 0.5) * 2.6]
                    );
                    tree.add(blob);
                }
            }

            this.scene.add(tree);
            this.collisionGrid.insertCylinder(new THREE.Vector3(x, height / 2, z), 0.5, height);
        }
    }

    private buildPergola() {
        const wood = this.textured(this.tex.planks([1, 2], 0xd8c39a, 0x9a8158, 5), { roughness: 0.9, metalness: 0.02 });
        const vine = this.matte(0x3f8f46, 0.94);
        const bloom = this.matte(0xff8fb1, 0.8);

        for (let i = 0; i < 6; i++) {
            const z = -39 + i * 3.2;
            const frame = new THREE.Group();
            frame.position.set(0, 0, z);

            for (const side of [-1, 1]) {
                const post = this.mesh(new THREE.BoxGeometry(0.34, 4.2, 0.34), wood, [side * 2.9, 2.1, 0]);
                frame.add(post);
                this.collisionGrid.insertOrientedBox(side * 2.9, z, 0.5, 0.5, 0, 0, 4.2);
            }

            const beam = this.mesh(new THREE.BoxGeometry(6.6, 0.3, 0.3), wood, [0, 4.3, 0]);
            frame.add(beam);

            const arch = this.mesh(new THREE.TorusGeometry(2.9, 0.16, 6, 14, Math.PI), wood, [0, 4.2, 0]);
            frame.add(arch);

            for (let v = 0; v < 5; v++) {
                const leafBlob = this.mesh(
                    new THREE.IcosahedronGeometry(0.4 + this.random() * 0.4, 0),
                    v % 3 === 0 ? bloom : vine,
                    [(this.random() - 0.5) * 6, 4.3 + this.random() * 0.8, (this.random() - 0.5) * 0.9]
                );
                frame.add(leafBlob);
            }

            this.scene.add(frame);
        }

        for (let i = 0; i < 5; i++) {
            const rail = this.mesh(new THREE.BoxGeometry(0.22, 0.22, 17), wood, [-2.4 + i * 1.2, 4.5, -32]);
            this.scene.add(rail);
        }
    }

    private buildTopiaryChart() {
        const hedge = this.textured(this.tex.grass(2, 0x3a7a38, 0x63b04c), { roughness: 0.97, metalness: 0, bump: 0.08 });
        const green = this.lit(0x3ddc84, 0.7);
        const soil = this.textured(this.tex.dirt(4, 0x5a4531, 0x8a7a63), { roughness: 0.97, metalness: 0 });

        const bed = this.mesh(new THREE.CylinderGeometry(11, 11.6, 0.4, 32), soil, [TOPIARY_CENTER.x, 0.2, TOPIARY_CENTER.z]);
        bed.receiveShadow = true;
        this.scene.add(bed);

        for (let i = 0; i < 7; i++) {
            const height = 1.8 + i * 1.05;
            const x = TOPIARY_CENTER.x - 7 + i * 2.3;
            const z = TOPIARY_CENTER.z;

            const body = this.mesh(new THREE.BoxGeometry(1.5, height, 1.5), hedge, [x, 0.4 + height / 2, z]);
            this.scene.add(body);
            this.collisionGrid.insertOrientedBox(x, z, 1.5, 1.5, 0, 0, height + 0.4);

            const wick = this.mesh(new THREE.BoxGeometry(0.22, height * 0.4, 0.22), hedge, [x, 0.4 + height + height * 0.2, z]);
            this.scene.add(wick);

            const tail = this.mesh(new THREE.BoxGeometry(0.22, height * 0.3, 0.22), hedge, [x, 0.4 - height * 0.15, z]);
            this.scene.add(tail);

            const tip = this.mesh(new THREE.SphereGeometry(0.28, 10, 8), green, [x, 0.4 + height + height * 0.42, z]);
            this.scene.add(tip);
        }

        const signX = TOPIARY_CENTER.x + 9;
        const signZ = TOPIARY_CENTER.z - 6;
        const facing = Math.atan2(0 - signX, 2 - signZ);

        const board = this.board(
            this.tex.sign("garden-chart", ["GREEN CANDLES ONLY", "NO RED ALLOWED"], { background: 0x2c4a2c, color: 0xd8f6c4, accent: 0x7ce8a8 }),
            6,
            3,
            [signX, 3.4, signZ],
            facing,
            { roughness: 0.9, metalness: 0.05, emissive: 0x7ce8a8, emissiveIntensity: 0.18 }
        );
        this.scene.add(board);

        const woodPost = this.matte(0x7a5a34, 0.92);
        for (const dx of [-2.6, 2.6]) {
            const post = this.mesh(
                new THREE.CylinderGeometry(0.12, 0.14, 3.6, 8),
                woodPost,
                [signX + Math.cos(facing) * dx, 1.8, signZ - Math.sin(facing) * dx]
            );
            this.scene.add(post);
            this.collisionGrid.insertCylinder(new THREE.Vector3(signX + Math.cos(facing) * dx, 1.8, signZ - Math.sin(facing) * dx), 0.3, 3.6);
        }
    }

    private buildStage() {
        const deckSkin = this.textured(this.tex.planks([3, 3], 0xc9a06a, 0x7a5a34, 7), { roughness: 0.9, metalness: 0.03, bump: 0.04 });
        const trim = this.metal(0xd8b46a, 0.35, 0.85);
        const canopy = this.textured(this.tex.stripes(4, 0xe4bfd0, 0xfaf4ee, 10), { roughness: 0.92, metalness: 0.02 });

        const stage = new THREE.Group();
        stage.position.copy(STAGE_CENTER);

        const deck = this.mesh(new THREE.CylinderGeometry(6.4, 6.8, 0.8, 24), deckSkin, [0, 0.4, 0]);
        deck.receiveShadow = true;
        stage.add(deck);
        this.collisionGrid.insertCylinder(new THREE.Vector3(STAGE_CENTER.x, 0.4, STAGE_CENTER.z), 6.5, 0.8);

        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const post = this.mesh(new THREE.CylinderGeometry(0.14, 0.14, 4, 8), trim, [Math.cos(angle) * 5.8, 2.8, Math.sin(angle) * 5.8]);
            stage.add(post);
        }

        const roof = this.mesh(new THREE.ConeGeometry(6.8, 2.6, 8), canopy, [0, 6, 0]);
        stage.add(roof);

        const eaves = this.mesh(new THREE.TorusGeometry(6.6, 0.16, 6, 24), trim, [0, 4.78, 0], [Math.PI / 2, 0, 0]);
        stage.add(eaves);

        const ball = this.mesh(new THREE.IcosahedronGeometry(0.9, 1), this.metal(0xdfe8f0, 0.2, 0.95), [0, 4.4, 0]);
        stage.add(ball);

        for (let i = 0; i < 3; i++) {
            const speaker = this.mesh(new THREE.BoxGeometry(1.1, 1.8, 1), this.matte(0x2a2a30, 0.8, 0.1), [Math.cos(i * 2.1) * 4.6, 1.7, Math.sin(i * 2.1) * 4.6]);
            stage.add(speaker);

            const cone = this.mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 12), this.matte(0x4a4a52, 0.7, 0.2), [Math.cos(i * 2.1) * 4.6, 2, Math.sin(i * 2.1) * 4.6 + 0.52], [Math.PI / 2, 0, 0]);
            stage.add(cone);
        }

        const floorSkin = this.textured(this.tex.checker(4, 0xe8e0d0, 0xb9a98c, 4), { roughness: 0.8, metalness: 0.06 });
        const dance = this.mesh(new THREE.CircleGeometry(9, 32), floorSkin, [STAGE_CENTER.x + 9, 0.14, STAGE_CENTER.z + 9], [-Math.PI / 2, 0, 0]);
        dance.castShadow = false;
        this.scene.add(dance);

        this.scene.add(stage);
    }

    private buildPicnic() {
        const blanketColors = [0xff8fb1, 0x7ce8a8, 0x67c9ff, 0xffd166];
        const basketSkin = this.textured(this.tex.stripes(2, 0xc9a06a, 0x8a6a3a, 8), { roughness: 0.92, metalness: 0.02 });

        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + 0.4;
            const x = PICNIC_CENTER.x + Math.cos(angle) * 5.4;
            const z = PICNIC_CENTER.z + Math.sin(angle) * 5.4;

            const blanketSkin = this.textured(this.tex.checker(2, blanketColors[i], 0xfdf6ef, 4), { roughness: 0.95, metalness: 0 });
            const blanket = this.mesh(new THREE.PlaneGeometry(4.4, 4.4), blanketSkin, [x, 0.12, z], [-Math.PI / 2, 0, this.random()]);
            blanket.castShadow = false;
            this.scene.add(blanket);

            const basket = this.mesh(new THREE.CylinderGeometry(0.44, 0.38, 0.42, 10), basketSkin, [x + 1.4, 0.21, z + 1.1]);
            this.scene.add(basket);

            const handle = this.mesh(new THREE.TorusGeometry(0.4, 0.05, 6, 12, Math.PI), basketSkin, [x + 1.4, 0.42, z + 1.1], [0, Math.PI / 2, 0]);
            this.scene.add(handle);

            for (let c = 0; c < 3; c++) {
                const cushion = this.mesh(
                    new THREE.BoxGeometry(0.8, 0.22, 0.8),
                    this.matte(blanketColors[(i + c) % blanketColors.length], 0.9),
                    [x + Math.cos(c * 2.1) * 1.3, 0.16, z + Math.sin(c * 2.1) * 1.3],
                    [0, this.random(), 0]
                );
                this.scene.add(cushion);
            }
        }

        const tree = new THREE.Group();
        tree.position.set(PICNIC_CENTER.x, 0, PICNIC_CENTER.z);
        const trunk = this.mesh(new THREE.CylinderGeometry(0.5, 0.8, 7, 10), this.textured(this.tex.bark([2, 3], 0x6b4a2a), { roughness: 0.96, metalness: 0.02, bump: 0.1 }), [0, 3.5, 0]);
        tree.add(trunk);
        for (let c = 0; c < 6; c++) {
            const blob = this.mesh(
                new THREE.IcosahedronGeometry(2.6 + this.random() * 1.2, 0),
                this.matte(c % 2 === 0 ? 0x3f8f46 : 0x5fb85a, 0.9),
                [(this.random() - 0.5) * 4.4, 7 + this.random() * 2.2, (this.random() - 0.5) * 4.4]
            );
            tree.add(blob);
        }
        this.scene.add(tree);
        this.collisionGrid.insertCylinder(new THREE.Vector3(PICNIC_CENTER.x, 3.5, PICNIC_CENTER.z), 0.9, 7);
    }

    private buildZenCorner() {
        const sand = this.textured(this.tex.sand(6, 0xe8dcc0), { roughness: 0.97, metalness: 0 });
        const stone = this.textured(this.tex.granite(3, 0x8a8a90), { roughness: 0.86, metalness: 0.08, bump: 0.05 });

        const pad = this.mesh(new THREE.CylinderGeometry(9, 9.4, 0.3, 32), sand, [ZEN_CENTER.x, 0.15, ZEN_CENTER.z]);
        pad.receiveShadow = true;
        this.scene.add(pad);

        for (let i = 1; i <= 4; i++) {
            const ring = this.mesh(new THREE.TorusGeometry(i * 1.8, 0.07, 5, 40), sand, [ZEN_CENTER.x, 0.32, ZEN_CENTER.z], [Math.PI / 2, 0, 0]);
            ring.castShadow = false;
            this.scene.add(ring);
        }

        const rockGeometry = this.bin.geometry(new THREE.DodecahedronGeometry(1, 0));
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2 + 0.7;
            const rock = new THREE.Mesh(rockGeometry, stone);
            rock.position.set(ZEN_CENTER.x + Math.cos(angle) * 4.6, 0.5, ZEN_CENTER.z + Math.sin(angle) * 4.6);
            rock.scale.set(0.7 + this.random() * 0.8, 0.5 + this.random() * 0.6, 0.7 + this.random() * 0.8);
            rock.rotation.set(this.random(), this.random() * Math.PI, this.random());
            rock.castShadow = true;
            this.scene.add(rock);
        }

        const bonsai = new THREE.Group();
        bonsai.position.set(ZEN_CENTER.x, 0.3, ZEN_CENTER.z);
        const pot = this.mesh(new THREE.CylinderGeometry(1, 0.8, 0.6, 14), this.matte(0x6b3a2a, 0.9), [0, 0.3, 0]);
        bonsai.add(pot);
        const stem = this.mesh(new THREE.CylinderGeometry(0.14, 0.24, 1.8, 8), this.matte(0x5a4028, 0.94), [0, 1.5, 0], [0, 0, 0.22]);
        bonsai.add(stem);
        for (let i = 0; i < 3; i++) {
            const canopy = this.mesh(
                new THREE.SphereGeometry(0.9 - i * 0.16, 12, 8),
                this.matte(i === 1 ? 0xffb3d9 : 0x4f9f52, 0.86),
                [(i - 1) * 0.9, 2.4 + i * 0.5, (this.random() - 0.5) * 0.5]
            );
            canopy.scale.y = 0.55;
            bonsai.add(canopy);
        }
        this.scene.add(bonsai);
        this.collisionGrid.insertCylinder(new THREE.Vector3(ZEN_CENTER.x, 0.4, ZEN_CENTER.z), 1.1, 1);
    }

    private buildDeck() {
        const plank = this.textured(this.tex.planks([4, 2], 0xc9a06a, 0x8a6a3a, 7), { roughness: 0.9, metalness: 0.02, bump: 0.04 });
        const deck = new THREE.Group();
        deck.position.set(POND_CENTER.x - POND_RADIUS - 3.6, 0, POND_CENTER.z);
        deck.rotation.y = Math.PI / 2;

        const floor = this.mesh(new THREE.BoxGeometry(11, 0.22, 7), plank, [0, 0.28, 0]);
        floor.receiveShadow = true;
        deck.add(floor);

        for (const dx of [-4.8, 0, 4.8]) {
            for (const dz of [-2.8, 2.8]) {
                const pile = this.mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.2, 8), plank, [dx, 0, dz]);
                deck.add(pile);
            }
        }

        for (const dx of [-5.4, 5.4]) {
            const rail = this.mesh(new THREE.BoxGeometry(0.16, 0.9, 7), plank, [dx, 0.85, 0]);
            deck.add(rail);
        }

        this.scene.add(deck);
        this.collisionGrid.insertOrientedBox(deck.position.x, deck.position.z, 11, 7, Math.PI / 2, 0, 0.4);
    }

    private buildBar() {
        const wood = this.textured(this.tex.planks([3, 1], 0x8a5a32, 0x5a3a1e, 6), { roughness: 0.9, metalness: 0.03, bump: 0.05 });
        const thatch = this.textured(this.tex.stripes(6, 0xd8b46a, 0xb8944a, 12), { roughness: 0.95, metalness: 0.02, bump: 0.06 });
        const counter = this.textured(this.tex.planks([2, 1], 0xb8814a, 0x7a5228, 4), { roughness: 0.68, metalness: 0.08, bump: 0.03 });

        const bar = new THREE.Group();
        bar.position.copy(BAR_POSITION);
        bar.rotation.y = -0.9;

        const top = this.mesh(new THREE.BoxGeometry(9, 0.24, 2.2), counter, [0, 1.1, 0]);
        bar.add(top);

        const front = this.mesh(new THREE.BoxGeometry(9, 1.1, 0.4), wood, [0, 0.55, 0.9]);
        bar.add(front);

        const back = this.mesh(new THREE.BoxGeometry(8, 2.4, 0.35), wood, [0, 1.2, -2.6]);
        bar.add(back);

        const shelf = this.mesh(new THREE.BoxGeometry(7.6, 0.14, 0.7), wood, [0, 1.75, -2.3]);
        bar.add(shelf);

        for (let s = 0; s < 9; s++) {
            const bottle = this.mesh(
                new THREE.CylinderGeometry(0.11, 0.14, 0.62, 8),
                this.lit([0x7ce8a8, 0xffd166, 0xff8fb1, 0x67c9ff, 0xff6f61][s % 5], 0.5),
                [-3.4 + s * 0.85, 2.13, -2.3]
            );
            bar.add(bottle);

            const neck = this.mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.24, 6), this.matte(0x2a2a30, 0.7), [-3.4 + s * 0.85, 2.54, -2.3]);
            bar.add(neck);
        }

        const menu = this.board(
            this.tex.sign("garden-bar", ["GREEN CANDLE BAR", "COCKTAILS · 24/7"], { background: 0x3a2618, color: 0xffe9c4, accent: 0x7ce8a8 }),
            4.2,
            2.1,
            [0, 3.1, -2.6],
            0,
            { roughness: 0.9, metalness: 0.04, emissive: 0x7ce8a8, emissiveIntensity: 0.15 }
        );
        bar.add(menu);

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
        this.collisionGrid.insertOrientedBox(BAR_POSITION.x, BAR_POSITION.z, 9, 2.4, -0.9, 0, 1.3);
    }

    private buildLoungers() {
        const frame = this.matte(0xe8e2d0, 0.7, 0.08);
        const fabric = this.textured(this.tex.stripes([1, 2], 0x67c9ff, 0xf2fbff, 8), { roughness: 0.88, metalness: 0.02 });
        const fabricWarm = this.textured(this.tex.stripes([1, 2], 0xffb3c7, 0xfff2f6, 8), { roughness: 0.88, metalness: 0.02 });
        const umbrella = this.textured(this.tex.stripes(3, 0xff8f5a, 0xfff0e0, 10), { roughness: 0.86, metalness: 0.02 });

        for (let i = 0; i < LOUNGER_SPOTS.length; i++) {
            const [x, z, rotation] = LOUNGER_SPOTS[i];
            const cloth = i % 2 === 0 ? fabric : fabricWarm;
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            group.rotation.y = rotation;

            const seat = this.mesh(new THREE.BoxGeometry(1.15, 0.1, 1.7), cloth, [0, LOUNGER_SEAT_Y, 0.55]);
            group.add(seat);

            const back = this.mesh(new THREE.BoxGeometry(1.15, 0.1, 1.5), cloth, [0, LOUNGER_SEAT_Y + 0.44, -0.91], [0.62, 0, 0]);
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

            this.scene.add(group);
            this.collisionGrid.insertOrientedBox(x, z, 1.3, 3, rotation, 0, 0.5);

            if (i % 2 === 0) {
                const shade = new THREE.Group();
                shade.position.set(x + Math.cos(rotation) * 1.9, 0, z - Math.sin(rotation) * 1.9);

                const pole = this.mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 8), frame, [0, 1.6, 0]);
                shade.add(pole);

                const canopy = this.mesh(new THREE.ConeGeometry(2.4, 0.9, 8), umbrella, [0, 3.3, 0]);
                shade.add(canopy);

                this.scene.add(shade);
                this.collisionGrid.insertCylinder(new THREE.Vector3(shade.position.x, 1.6, shade.position.z), 0.3, 3.2);
            }

            const table = new THREE.Group();
            const tableX = x - Math.cos(rotation) * 1.5;
            const tableZ = z + Math.sin(rotation) * 1.5;
            table.position.set(tableX, 0, tableZ);

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
        const cloth = this.textured(this.tex.stripes(2, 0xffd166, 0xfff6de, 10), { roughness: 0.9, metalness: 0.02 });

        const spans: Array<[number, number, number, number]> = [
            [-26, -2, -26, 6],
            [-34, -14, -26, -20],
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

    private buildLanterns() {
        const poleMaterial = this.matte(0x7a5a34, 0.92);
        const cordMaterial = this.matte(0x8a7a5c, 0.92);
        const colors = [0xff8fb1, 0xffd166, 0x7ce8a8, 0x67c9ff];
        const lanternGeometry = this.bin.geometry(new THREE.SphereGeometry(0.34, 10, 8));

        const ring = 11.5;
        const posts = 8;
        for (let i = 0; i < posts; i++) {
            const angle = (i / posts) * Math.PI * 2;
            const x = Math.cos(angle) * ring;
            const z = 2 + Math.sin(angle) * ring;

            const pole = this.mesh(new THREE.CylinderGeometry(0.1, 0.14, 4.4, 8), poleMaterial, [x, 2.2, z]);
            this.scene.add(pole);

            const nextAngle = ((i + 1) / posts) * Math.PI * 2;
            const nx = Math.cos(nextAngle) * ring;
            const nz = 2 + Math.sin(nextAngle) * ring;
            const span = Math.hypot(nx - x, nz - z);

            const cord = this.mesh(new THREE.CylinderGeometry(0.025, 0.025, span, 5), cordMaterial, [(x + nx) / 2, 4.1, (z + nz) / 2]);
            cord.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(nx - x, 0, nz - z).normalize()
            );
            cord.castShadow = false;
            this.scene.add(cord);

            for (let l = 0; l < 3; l++) {
                const t = (l + 1) / 4;
                const lantern = new THREE.Mesh(lanternGeometry, this.lit(colors[(i + l) % colors.length], 1.1));
                lantern.position.set(x + (nx - x) * t, 3.85 - Math.sin(t * Math.PI) * 0.22, z + (nz - z) * t);
                lantern.castShadow = false;
                this.scene.add(lantern);
                this.lanterns.push(lantern);
            }
        }

        const flagColors = [0x7ce8a8, 0xffd166, 0xff8fb1];
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + 0.3;
            const x = Math.cos(angle) * 16;
            const z = 2 + Math.sin(angle) * 16;

            const pole = this.mesh(new THREE.CylinderGeometry(0.08, 0.1, 6, 8), poleMaterial, [x, 3, z]);
            this.scene.add(pole);

            const flag = this.board(
                this.tex.stripes(1, flagColors[i % 3], 0xfdf6ef, 6, true),
                1.4,
                2.4,
                [x + 0.75, 4.6, z],
                0,
                { roughness: 0.92, metalness: 0.02, segments: 4 }
            );
            this.scene.add(flag);
            this.banners.push(flag);
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
            const distance = 8 + this.random() * 40;
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

        for (let i = 0; i < LOUNGER_SPOTS.length; i++) {
            if (i === 2) continue;
            const [x, z, rotation] = LOUNGER_SPOTS[i];
            specs.push({
                position: new THREE.Vector3(
                    x - Math.sin(rotation) * 0.12,
                    seatedActorY(LOUNGER_SEAT_Y) + 0.14,
                    z - Math.cos(rotation) * 0.12
                ),
                set: "chill",
                facing: rotation,
                pose: "lounge",
                held: i % 2 === 0 ? "cocktail" : undefined,
                accent: [0xff6f61, 0x7ce8a8, 0xffd166, 0x67c9ff, 0xff8fb1, 0xa855f7][i % 6],
                phase: this.random() * 9,
                solid: false,
            });
        }

        const tender = new THREE.Vector3(0, 0, -1.7).applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.9);
        specs.push({
            position: new THREE.Vector3(BAR_POSITION.x + tender.x, 0, BAR_POSITION.z + tender.z),
            set: "chill",
            variantIndex: 2,
            facing: -0.9 + Math.PI,
            pose: "work",
            phase: 1.2,
            solid: false,
        });

        for (let s = 0; s < 4; s++) {
            const local = new THREE.Vector3(-3.6 + s * 2.4, 0, 2.1);
            local.applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.9);
            specs.push({
                position: new THREE.Vector3(BAR_POSITION.x + local.x, seatedActorY(0.69), BAR_POSITION.z + local.z),
                set: "chill",
                facing: -0.9 + Math.PI,
                pose: s % 2 === 0 ? "sit" : "toast",
                held: s % 2 === 0 ? undefined : "cocktail",
                accent: [0x7ce8a8, 0xffd166, 0xff8fb1, 0x67c9ff][s],
                phase: this.random() * 9,
                solid: false,
            });
        }

        const hammockSpots: Array<[number, number, number]> = [
            [-26, 2, 0],
            [-30, -17, 0.6],
        ];

        for (const [x, z, rotation] of hammockSpots) {
            specs.push({
                position: new THREE.Vector3(x, 1.18, z),
                set: "chill",
                facing: rotation,
                pose: "lounge",
                phase: this.random() * 9,
                solid: false,
            });
        }

        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2 + 0.6;
            specs.push({
                position: new THREE.Vector3(STAGE_CENTER.x + Math.cos(angle) * 2.6, 0.8, STAGE_CENTER.z + Math.sin(angle) * 2.6),
                set: "chill",
                variantIndex: i % 3,
                lookAt: new THREE.Vector3(STAGE_CENTER.x + 9, 1, STAGE_CENTER.z + 9),
                pose: i === 0 ? "cheer" : "dance",
                phase: this.random() * 9,
                solid: false,
            });
        }

        for (let i = 0; i < 7; i++) {
            const angle = (i / 7) * Math.PI * 2;
            const radius = 2.8 + this.random() * 3.6;
            specs.push({
                position: new THREE.Vector3(STAGE_CENTER.x + 9 + Math.cos(angle) * radius, 0, STAGE_CENTER.z + 9 + Math.sin(angle) * radius),
                set: "chill",
                facing: angle + Math.PI,
                pose: "dance",
                held: this.random() < 0.4 ? "cocktail" : undefined,
                phase: this.random() * 9,
            });
        }

        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + 0.4;
            const ring = 5.4 + (i % 2) * 1.2;
            specs.push({
                position: new THREE.Vector3(
                    PICNIC_CENTER.x + Math.cos(angle) * ring + (this.random() - 0.5) * 1.6,
                    seatedActorY(GROUND_SEAT_Y),
                    PICNIC_CENTER.z + Math.sin(angle) * ring + (this.random() - 0.5) * 1.6
                ),
                set: "chill",
                facing: angle + Math.PI + (this.random() - 0.5) * 0.5,
                pose: "sitGround",
                held: i % 3 === 0 ? "cocktail" : undefined,
                phase: this.random() * 9,
                solid: false,
            });
        }

        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + 0.9;
            specs.push({
                position: new THREE.Vector3(ZEN_CENTER.x + Math.cos(angle) * 2.8, 0.3, ZEN_CENTER.z + Math.sin(angle) * 2.8),
                set: "chill",
                lookAt: new THREE.Vector3(ZEN_CENTER.x, 1, ZEN_CENTER.z),
                pose: "pray",
                phase: this.random() * 9,
                solid: false,
            });
        }

        for (let i = 0; i < 3; i++) {
            specs.push({
                position: new THREE.Vector3(TOPIARY_CENTER.x - 6 + i * 5, 0.4, TOPIARY_CENTER.z - 4.4),
                set: "chill",
                lookAt: new THREE.Vector3(TOPIARY_CENTER.x, 3, TOPIARY_CENTER.z),
                pose: i === 1 ? "work" : "gawk",
                held: i === 1 ? "wrench" : undefined,
                phase: this.random() * 9,
            });
        }

        specs.push({
            position: new THREE.Vector3(POND_CENTER.x + 1.6, 0.65, POND_CENTER.z + 1.2),
            set: "chill",
            variantIndex: 1,
            lookAt: new THREE.Vector3(POND_CENTER.x, 1, POND_CENTER.z),
            pose: "toast",
            held: "cocktail",
            phase: this.random() * 9,
            solid: false,
        });

        specs.push({
            position: new THREE.Vector3(POND_CENTER.x - 1.8, 0.65, POND_CENTER.z + 0.6),
            set: "chill",
            variantIndex: 2,
            lookAt: new THREE.Vector3(POND_CENTER.x, 1, POND_CENTER.z),
            pose: "sit",
            phase: this.random() * 9,
            solid: false,
        });

        const walkers: Array<[number, number, number, number]> = [
            [-30, -30, -6, -30],
            [24, 30, -18, 30],
            [0, -30, 0, 6],
            [-42, 20, -42, -20],
            [38, -24, 38, 14],
            [-8, -12, 8, -12],
        ];

        for (let i = 0; i < 2; i++) {
            specs.push({
                position: new THREE.Vector3(POND_CENTER.x + (i === 0 ? -0.9 : 0.9), 1.5, POND_CENTER.z - POND_RADIUS + 3.5 + i * 2.4),
                set: "chill",
                facing: i === 0 ? 2.6 : 0.5,
                pose: i === 0 ? "gawk" : "toast",
                held: i === 0 ? undefined : "cocktail",
                phase: this.random() * 9,
                solid: false,
            });
        }

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

        for (let i = 0; i < 4; i++) {
            const angle = 0.6 + i * 0.5;
            specs.push({
                position: new THREE.Vector3(
                    POND_CENTER.x + Math.cos(angle) * (POND_RADIUS + 2.6),
                    0,
                    POND_CENTER.z + Math.sin(angle) * (POND_RADIUS + 2.6)
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
            const material = this.water.material as THREE.MeshStandardMaterial;
            material.opacity = 0.8 + Math.sin(this.elapsed * 0.9) * 0.05;
            if (material.map) {
                material.map.offset.x = this.elapsed * 0.012;
                material.map.offset.y = Math.sin(this.elapsed * 0.3) * 0.01;
            }
        }

        for (let i = 0; i < this.lilies.length; i++) {
            const lily = this.lilies[i];
            lily.position.y = 0.16 + Math.sin(this.elapsed * 0.8 + i) * 0.03;
            lily.rotation.y += delta * 0.05;
        }

        for (let i = 0; i < this.koi.length; i++) {
            const fish = this.koi[i];
            const radius = fish.userData.radius as number;
            const speed = fish.userData.speed as number;
            const phase = fish.userData.phase as number;
            const angle = this.elapsed * speed + phase;
            fish.position.set(
                POND_CENTER.x + Math.cos(angle) * radius,
                0.06 + Math.sin(this.elapsed * 1.6 + phase) * 0.03,
                POND_CENTER.z + Math.sin(angle) * radius
            );
            fish.rotation.y = -angle + Math.PI / 2;
        }

        for (let i = 0; i < this.hammocks.length; i++) {
            this.hammocks[i].rotation.z = Math.sin(this.elapsed * 0.6 + i) * 0.035;
        }

        for (let i = 0; i < this.lanterns.length; i++) {
            this.lanterns[i].position.y += Math.sin(this.elapsed * 1.2 + i) * delta * 0.06;
        }

        for (let i = 0; i < this.banners.length; i++) {
            this.waveBoard(this.banners[i], this.elapsed, 0.06, i);
        }

        if (this.waterGlints) {
            (this.waterGlints.material as THREE.PointsMaterial).opacity = 0.45 + Math.sin(this.elapsed * 2.4) * 0.25;
        }

        if (this.spray) {
            const attribute = this.spray.geometry.getAttribute("position") as THREE.BufferAttribute;
            const array = attribute.array as Float32Array;
            for (let i = 0; i < array.length / 3; i++) {
                this.sprayVelocity[i * 3 + 1] -= delta * 6.4;
                array[i * 3] += this.sprayVelocity[i * 3] * delta;
                array[i * 3 + 1] += this.sprayVelocity[i * 3 + 1] * delta;
                array[i * 3 + 2] += this.sprayVelocity[i * 3 + 2] * delta;
                if (array[i * 3 + 1] < 0.3) this.resetSpray(array, i);
            }
            attribute.needsUpdate = true;
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
