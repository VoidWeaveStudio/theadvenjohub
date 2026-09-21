// src/features/game/world/locations/showcase/rooms/GardenRoom.ts
import * as THREE from "three";
import { ShowcaseRoom } from "../ShowcaseRoom";
import { ResourceManager } from "../../../../core/ResourceManager";
import { SHOWCASE_INFO_BY_ID, ShowcaseInfo } from "../config";
import { CrowdSpec } from "../actors/ShowcaseCrowd";
import { GROUND_SEAT_Y, seatedActorY } from "../actors/poses";
import type { ShowcaseActor } from "../actors/ShowcaseActor";
import { getGraphicsSettings, prefersMobileProfile } from "@/features/game/core/graphicsSettings";
import { GARDEN_FOG_COLOR, GARDEN_FOG_DENSITY, GARDEN_SKY_COLOR, GardenLighting } from "./garden/gardenShading";
import { GardenSurface, SURFACE_BED, SURFACE_GRASS, SURFACE_PATH, SURFACE_STONE } from "./garden/GardenSurface";
import { GardenGround } from "./garden/GardenGround";
import { GardenGrass } from "./garden/GardenGrass";
import { GardenWater } from "./garden/GardenWater";
import { GardenFlora } from "./garden/GardenFlora";
import { GardenSky } from "./garden/GardenSky";
import { GardenAir } from "./garden/GardenAir";
import { disposeGardenSurfaces, loadGardenSurfaces, type GardenSurfaceTextures } from "./garden/gardenTextures";

const FIELD_RADIUS = 66;
const GROUND_RADIUS = 96;
const MASK_EXTENT = 104;
const MASK_RESOLUTION = 512;
const POND_CENTER = new THREE.Vector3(4, 0, 20);
const POND_RADIUS = 14;
const ISLAND_RADIUS = 4.6;
const BAR_POSITION = new THREE.Vector3(28, 0, -8);
const STAGE_CENTER = new THREE.Vector3(-21, 0, -17);
const TOPIARY_CENTER = new THREE.Vector3(-27, 0, 9);
const PICNIC_CENTER = new THREE.Vector3(17, 0, -24);
const ZEN_CENTER = new THREE.Vector3(-33, 0, 27);
const PLAZA_CENTER = new THREE.Vector3(0, 0, 2);
const DANCE_CENTER = new THREE.Vector3(STAGE_CENTER.x + 9, 0, STAGE_CENTER.z + 9);
const DECK_CENTER = new THREE.Vector3(POND_CENTER.x - POND_RADIUS - 3.6, 0, POND_CENTER.z);

const LOUNGER_SEAT_Y = 0.52;
const LOUNGER_SPOTS: Array<[number, number, number]> = [
    [-6, 4, -0.4],
    [-1.6, 3, -0.15],
    [3.4, 2.4, 0.1],
    [11, 3.4, 0.5],
    [16, 0, 0.9],
    [-12, 1, -0.8],
];

const HEDGE_RUNS: Array<[number, number, number, number]> = [
    [24, 8, 24, 20],
    [14, -2, 14, -10],
    [-36, 18, -24, 18],
    [22, -32, 32, -20],
];

const FLOWER_BEDS: Array<[number, number, number]> = [
    [TOPIARY_CENTER.x, TOPIARY_CENTER.z, 11.4],
    [-14, 22, 6.2],
    [13, 12, 5.4],
    [-9, -28, 5.8],
    [30, 18, 6.6],
    [-40, -6, 7.2],
    [22, 30, 5.6],
];

export class GardenRoom extends ShowcaseRoom {
    private readonly lighting = new GardenLighting();
    private surface!: GardenSurface;
    private surfaces: GardenSurfaceTextures | null = null;
    private ground: GardenGround | null = null;
    private grass: GardenGrass | null = null;
    private pond: GardenWater | null = null;
    private flora: GardenFlora | null = null;
    private sky: GardenSky | null = null;
    private air: GardenAir | null = null;

    private hammocks: THREE.Object3D[] = [];
    private lanterns: THREE.Object3D[] = [];
    private banners: THREE.Group[] = [];
    private guest: ShowcaseActor | null = null;
    private waiter: ShowcaseActor | null = null;
    private guestBubble: THREE.Sprite | null = null;
    private waiterBubble: THREE.Sprite | null = null;

    private readonly cameraProbe = new THREE.Vector3(0, 2, 0);
    private readonly playerProbe = new THREE.Vector3();
    private readonly blockers: Array<[number, number, number]> = [];

    constructor(info: ShowcaseInfo = SHOWCASE_INFO_BY_ID.get("show-garden") as ShowcaseInfo) {
        super(info, 0x2bd47f, 72);
        this.exitPosition.set(0, 0, -44);
        this.exitFacing = 0;
        this.spawnPosition.set(0, 0, -36);
    }

    protected buildAtmosphere(): void {
        const settings = getGraphicsSettings();
        const mobile = prefersMobileProfile();

        this.scene.background = new THREE.Color(GARDEN_SKY_COLOR);
        this.scene.fog = new THREE.FogExp2(GARDEN_FOG_COLOR, GARDEN_FOG_DENSITY);

        const anisotropy = this.renderer?.capabilities.getMaxAnisotropy() ?? 4;
        this.surfaces = loadGardenSurfaces(mobile ? Math.min(4, anisotropy) : anisotropy);

        this.sky = new GardenSky(this.scene, this.bin, this.random, FIELD_RADIUS, settings.shadowRes);
        this.sky.create(this.renderer, this.surfaces);
    }

    protected decorate(rm: ResourceManager): void {
        const settings = getGraphicsSettings();
        const mobile = prefersMobileProfile();
        const textures = this.surfaces!;

        this.surface = new GardenSurface(MASK_EXTENT, MASK_RESOLUTION);
        this.paintSurface();

        this.ground = new GardenGround(this.scene, this.bin, this.surface, textures, GROUND_RADIUS, mobile);
        this.ground.create([{ x: POND_CENTER.x, z: POND_CENTER.z, radius: POND_RADIUS - 0.6 }]);

        this.grass = new GardenGrass(
            this.scene,
            this.lighting,
            this.surface,
            this.random,
            settings.grassDensity,
            GROUND_RADIUS
        );
        this.grass.create(this.renderer);

        this.pond = new GardenWater(
            this.scene,
            this.bin,
            this.random,
            POND_CENTER,
            POND_RADIUS,
            ISLAND_RADIUS,
            !mobile && settings.renderScale >= 0.75
        );
        this.pond.create(textures);

        this.buildPondRim();
        this.buildIsland();
        this.buildBridge();
        this.buildPlaza();
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

        this.flora = new GardenFlora(
            this.scene,
            this.surface,
            this.random,
            (x, z, radius) => this.blocked(x, z, radius),
            mobile ? 0.45 : 1
        );
        this.plantFlora();
        this.flora.create(this.collisionGrid);

        this.air = new GardenAir(this.scene, this.bin, this.lighting, this.random, FIELD_RADIUS, settings.particles);
        this.air.create();

        this.pond.setReflectionExcludes([...this.grass.objects(), ...this.air.objects()]);

        this.buildCrowd();
        this.buildService(rm);

        this.collisionGrid.insertRingWall(FIELD_RADIUS + 4, 2, 0, 6);
    }

    protected groundHeight(_x: number, _z: number): number {
        return 0;
    }

    private block(x: number, z: number, radius: number) {
        this.blockers.push([x, z, radius]);
    }

    private blocked(x: number, z: number, radius: number): boolean {
        for (let i = 0; i < this.blockers.length; i++) {
            const blocker = this.blockers[i];
            const reach = blocker[2] + radius;
            const dx = x - blocker[0];
            const dz = z - blocker[1];
            if (dx * dx + dz * dz < reach * reach) return true;
        }
        return false;
    }

    private paintSurface() {
        const surface = this.surface;

        surface.stripe(SURFACE_STONE, 0, -46, PLAZA_CENTER.x, PLAZA_CENTER.z, 2.3, 1.4);
        surface.disc(SURFACE_STONE, PLAZA_CENTER.x, PLAZA_CENTER.z, 9.2, 2.2);
        surface.disc(SURFACE_GRASS, PLAZA_CENTER.x, PLAZA_CENTER.z, 8.4, 2.6);
        surface.stripe(SURFACE_GRASS, 0, -46, PLAZA_CENTER.x, PLAZA_CENTER.z, 2.1, 1.3);

        const walkways: Array<Array<[number, number]>> = [
            [[PLAZA_CENTER.x, PLAZA_CENTER.z], [18, -4], [BAR_POSITION.x, BAR_POSITION.z]],
            [[PLAZA_CENTER.x, PLAZA_CENTER.z], [-9, -9], [DANCE_CENTER.x, DANCE_CENTER.z], [STAGE_CENTER.x, STAGE_CENTER.z]],
            [[PLAZA_CENTER.x, PLAZA_CENTER.z], [-14, 2], [TOPIARY_CENTER.x, TOPIARY_CENTER.z]],
            [[TOPIARY_CENTER.x, TOPIARY_CENTER.z], [-34, 17], [ZEN_CENTER.x, ZEN_CENTER.z]],
            [[PLAZA_CENTER.x, PLAZA_CENTER.z], [9, -13], [PICNIC_CENTER.x, PICNIC_CENTER.z]],
            [[-14, 4], [-15, 13], [DECK_CENTER.x - 2, DECK_CENTER.z]],
        ];

        for (const line of walkways) {
            for (let i = 1; i < line.length; i++) {
                surface.stripe(SURFACE_PATH, line[i - 1][0], line[i - 1][1], line[i][0], line[i][1], 1.5, 1.7);
                surface.stripe(SURFACE_GRASS, line[i - 1][0], line[i - 1][1], line[i][0], line[i][1], 1.1, 1.5, 0.85);
            }
        }

        const loop = POND_RADIUS + 2.4;
        for (let i = 0; i < 48; i++) {
            const angle = (i / 48) * Math.PI * 2;
            const next = ((i + 1) / 48) * Math.PI * 2;
            surface.stripe(
                SURFACE_PATH,
                POND_CENTER.x + Math.cos(angle) * loop,
                POND_CENTER.z + Math.sin(angle) * loop,
                POND_CENTER.x + Math.cos(next) * loop,
                POND_CENTER.z + Math.sin(next) * loop,
                1.7,
                2.1,
                0.9
            );
        }

        surface.disc(SURFACE_GRASS, POND_CENTER.x, POND_CENTER.z, POND_RADIUS + 2.4, 2.2);

        for (const [x, z, radius] of FLOWER_BEDS) {
            surface.disc(SURFACE_BED, x, z, radius, 2.6);
            surface.disc(SURFACE_GRASS, x, z, radius - 1.4, 3.2, 0.82);
        }

        surface.disc(SURFACE_STONE, DANCE_CENTER.x, DANCE_CENTER.z, 9, 1.6);
        surface.disc(SURFACE_GRASS, DANCE_CENTER.x, DANCE_CENTER.z, 8.6, 1.4);
        surface.disc(SURFACE_GRASS, STAGE_CENTER.x, STAGE_CENTER.z, 7, 1.2);
        surface.disc(SURFACE_GRASS, ZEN_CENTER.x, ZEN_CENTER.z, 9.6, 1.4);
        surface.disc(SURFACE_GRASS, BAR_POSITION.x, BAR_POSITION.z, 6.4, 2);
        surface.disc(SURFACE_PATH, BAR_POSITION.x, BAR_POSITION.z, 6.8, 2.4, 0.8);
        surface.disc(SURFACE_PATH, PICNIC_CENTER.x, PICNIC_CENTER.z, 7.4, 3, 0.55);
        surface.box(SURFACE_GRASS, DECK_CENTER.x, DECK_CENTER.z, 3.8, 5.8, Math.PI / 2, 1.2);

        for (const [x1, z1, x2, z2] of HEDGE_RUNS) {
            surface.stripe(SURFACE_GRASS, x1, z1, x2, z2, 1.1, 0.8);
            surface.stripe(SURFACE_BED, x1, z1, x2, z2, 1.3, 1.1, 0.7);
        }

        for (let i = 0; i < 6; i++) {
            const z = -39 + i * 3.2;
            surface.box(SURFACE_GRASS, 0, z, 3.4, 0.9, 0, 0.8);
        }
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

        const guestBubble = this.bubble("DIAMOND HANDS", "#7ce8a8", { width: 3, tone: "shout", y: 1.9, speaker: guest });
        guest.group.add(guestBubble);
        this.guestBubble = guestBubble;

        const waiterBubble = this.bubble("ONE MORE, SIR?", "#ffd166", { width: 2.8, y: 2.9, speaker: waiter });
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

    private buildPlaza() {
        const stone = this.textured(this.tex.cobble(3, 0xb9ae98, 0x8a8172), { roughness: 0.88, metalness: 0.05, bump: 0.06 });

        const rim = this.mesh(new THREE.TorusGeometry(9.2, 0.26, 8, 60), stone, [PLAZA_CENTER.x, 0.1, PLAZA_CENTER.z], [Math.PI / 2, 0, 0]);
        rim.receiveShadow = true;
        this.scene.add(rim);

        const basin = new THREE.Group();
        basin.position.copy(PLAZA_CENTER);

        const pedestal = this.mesh(new THREE.CylinderGeometry(2.1, 2.6, 0.7, 24), stone, [0, 0.35, 0]);
        basin.add(pedestal);

        const bowl = this.mesh(new THREE.CylinderGeometry(1.7, 1.2, 0.5, 20), stone, [0, 0.95, 0]);
        basin.add(bowl);

        const stem = this.mesh(new THREE.CylinderGeometry(0.22, 0.32, 1.4, 12), stone, [0, 1.6, 0]);
        basin.add(stem);

        const cup = this.mesh(new THREE.SphereGeometry(0.85, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), stone, [0, 2.3, 0]);
        cup.scale.y = 0.6;
        basin.add(cup);

        const drop = this.mesh(new THREE.OctahedronGeometry(0.42, 0), this.lit(0x9fe8ff, 0.9), [0, 2.9, 0]);
        basin.add(drop);

        this.scene.add(basin);
        this.block(PLAZA_CENTER.x, PLAZA_CENTER.z, 3.2);
        this.collisionGrid.insertCylinder(new THREE.Vector3(PLAZA_CENTER.x, 0.7, PLAZA_CENTER.z), 2.4, 1.4);
    }

    private buildPondRim() {
        const rim = this.textured(this.tex.weatheredGranite(4, 0x93897a, 0x5f7a4a), { roughness: 0.92, metalness: 0.05, bump: 0.07 });
        const rockGeometry = this.bin.geometry(new THREE.DodecahedronGeometry(0.9, 0));

        for (let i = 0; i < 34; i++) {
            const angle = (i / 34) * Math.PI * 2 + this.random() * 0.12;
            const x = POND_CENTER.x + Math.cos(angle) * (POND_RADIUS + 0.35);
            const z = POND_CENTER.z + Math.sin(angle) * (POND_RADIUS + 0.35);
            const rock = new THREE.Mesh(rockGeometry, rim);
            rock.position.set(x, 0.06 + this.random() * 0.22, z);
            rock.rotation.set(this.random(), this.random() * Math.PI, this.random());
            rock.scale.set(0.6 + this.random() * 0.8, 0.5 + this.random() * 0.5, 0.6 + this.random() * 0.8);
            rock.castShadow = true;
            rock.receiveShadow = true;
            this.scene.add(rock);
        }

        this.block(POND_CENTER.x, POND_CENTER.z, POND_RADIUS + 1.6);

        const reeds = this.matte(0x5f9a3e, 0.94);
        const reedGeometry = this.bin.geometry(new THREE.ConeGeometry(0.06, 1.9, 4, 1, true));
        const clumps = new THREE.InstancedMesh(reedGeometry, reeds, 260);
        clumps.castShadow = false;
        (clumps.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;

        const matrix = new THREE.Matrix4();
        const quaternion = new THREE.Quaternion();
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3();

        for (let i = 0; i < 260; i++) {
            const angle = this.random() * Math.PI * 2;
            const distance = POND_RADIUS - 0.4 + this.random() * 2.4;
            position.set(
                POND_CENTER.x + Math.cos(angle) * distance,
                0.85,
                POND_CENTER.z + Math.sin(angle) * distance
            );
            quaternion.setFromEuler(new THREE.Euler((this.random() - 0.5) * 0.32, this.random() * Math.PI, (this.random() - 0.5) * 0.32));
            scale.set(0.7 + this.random() * 0.7, 0.6 + this.random() * 0.9, 0.7 + this.random() * 0.7);
            matrix.compose(position, quaternion, scale);
            clumps.setMatrixAt(i, matrix);
        }

        clumps.instanceMatrix.needsUpdate = true;
        this.scene.add(clumps);
    }

    private buildIsland() {
        const soil = this.textured(this.tex.dirt(4, 0x6f5c3f, 0x93825f), { roughness: 0.96, metalness: 0 });
        const wood = this.textured(this.tex.planks([2, 1], 0xb98a4f, 0x6f4f2a, 6), { roughness: 0.88, metalness: 0.03, bump: 0.04 });
        const roofSkin = this.textured(this.tex.stripes(3, 0x4f9f7a, 0xe8f0e0, 8), { roughness: 0.9, metalness: 0.02 });

        const island = this.mesh(new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS - 0.8, 0.8, 30), soil, [POND_CENTER.x, 0.2, POND_CENTER.z]);
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

            const brace = this.mesh(new THREE.TorusGeometry(0.75, 0.05, 5, 10, Math.PI / 2), wood, [Math.cos(angle) * 2.6, 3.3, Math.sin(angle) * 2.6], [0, -angle, 0]);
            pavilion.add(brace);
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

            for (let v = 0; v < 7; v++) {
                const leafBlob = this.mesh(
                    new THREE.IcosahedronGeometry(0.4 + this.random() * 0.4, 0),
                    v % 3 === 0 ? bloom : vine,
                    [(this.random() - 0.5) * 6, 4.3 + this.random() * 0.8, (this.random() - 0.5) * 0.9]
                );
                frame.add(leafBlob);
            }

            for (let h = 0; h < 4; h++) {
                const hanger = this.mesh(
                    new THREE.SphereGeometry(0.12 + this.random() * 0.1, 7, 6),
                    bloom,
                    [(this.random() - 0.5) * 5.4, 3.5 + this.random() * 0.7, (this.random() - 0.5) * 0.6]
                );
                hanger.scale.y = 2.2;
                frame.add(hanger);
            }

            this.scene.add(frame);
            this.block(0, z, 3.4);
        }

        for (let i = 0; i < 5; i++) {
            const rail = this.mesh(new THREE.BoxGeometry(0.22, 0.22, 17), wood, [-2.4 + i * 1.2, 4.5, -32]);
            this.scene.add(rail);
        }
    }

    private buildTopiaryChart() {
        const hedge = this.textured(this.tex.grass(2, 0x336b30, 0x5da045), { roughness: 0.97, metalness: 0, bump: 0.1 });
        const green = this.lit(0x3ddc84, 0.7);

        for (let i = 0; i < 7; i++) {
            const height = 1.8 + i * 1.05;
            const x = TOPIARY_CENTER.x - 7 + i * 2.3;
            const z = TOPIARY_CENTER.z;

            const body = this.mesh(new THREE.BoxGeometry(1.5, height, 1.5), hedge, [x, 0.25 + height / 2, z]);
            this.scene.add(body);
            this.collisionGrid.insertOrientedBox(x, z, 1.5, 1.5, 0, 0, height + 0.25);
            this.block(x, z, 1.4);

            const wick = this.mesh(new THREE.BoxGeometry(0.22, height * 0.4, 0.22), hedge, [x, 0.25 + height + height * 0.2, z]);
            this.scene.add(wick);

            const tail = this.mesh(new THREE.BoxGeometry(0.22, height * 0.3, 0.22), hedge, [x, 0.25 - height * 0.15, z]);
            this.scene.add(tail);

            const tip = this.mesh(new THREE.SphereGeometry(0.28, 10, 8), green, [x, 0.25 + height + height * 0.42, z]);
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
            const x = signX + Math.cos(facing) * dx;
            const z = signZ - Math.sin(facing) * dx;
            const post = this.mesh(new THREE.CylinderGeometry(0.12, 0.14, 3.6, 8), woodPost, [x, 1.8, z]);
            this.scene.add(post);
            this.collisionGrid.insertCylinder(new THREE.Vector3(x, 1.8, z), 0.3, 3.6);
            this.block(x, z, 0.9);
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
        this.block(STAGE_CENTER.x, STAGE_CENTER.z, 7.4);

        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const post = this.mesh(new THREE.CylinderGeometry(0.14, 0.14, 4, 8), trim, [Math.cos(angle) * 5.8, 2.8, Math.sin(angle) * 5.8]);
            stage.add(post);
        }

        const roof = this.mesh(new THREE.ConeGeometry(6.8, 2.6, 8), canopy, [0, 6, 0]);
        stage.add(roof);

        const eaves = this.mesh(new THREE.TorusGeometry(6.6, 0.16, 6, 24), trim, [0, 4.78, 0], [Math.PI / 2, 0, 0]);
        stage.add(eaves);

        const ball = this.mesh(new THREE.IcosahedronGeometry(0.9, 1), this.metal(0xdfe8f0, 0.16, 0.98), [0, 4.4, 0]);
        stage.add(ball);

        for (let i = 0; i < 3; i++) {
            const speaker = this.mesh(new THREE.BoxGeometry(1.1, 1.8, 1), this.matte(0x2a2a30, 0.8, 0.1), [Math.cos(i * 2.1) * 4.6, 1.7, Math.sin(i * 2.1) * 4.6]);
            stage.add(speaker);

            const cone = this.mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 12), this.matte(0x4a4a52, 0.7, 0.2), [Math.cos(i * 2.1) * 4.6, 2, Math.sin(i * 2.1) * 4.6 + 0.52], [Math.PI / 2, 0, 0]);
            stage.add(cone);
        }

        const floorSkin = this.textured(this.tex.checker(4, 0xe8e0d0, 0xb9a98c, 4), { roughness: 0.78, metalness: 0.06 });
        const dance = this.mesh(new THREE.CircleGeometry(9, 32), floorSkin, [DANCE_CENTER.x, 0.12, DANCE_CENTER.z], [-Math.PI / 2, 0, 0]);
        dance.castShadow = false;
        dance.receiveShadow = true;
        this.scene.add(dance);
        this.block(DANCE_CENTER.x, DANCE_CENTER.z, 9.4);

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
            const blanket = this.mesh(new THREE.PlaneGeometry(4.4, 4.4), blanketSkin, [x, 0.1, z], [-Math.PI / 2, 0, this.random()]);
            blanket.castShadow = false;
            blanket.receiveShadow = true;
            this.scene.add(blanket);
            this.block(x, z, 2.6);

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

        this.block(PICNIC_CENTER.x, PICNIC_CENTER.z, 2.4);
        this.collisionGrid.insertCylinder(new THREE.Vector3(PICNIC_CENTER.x, 3.5, PICNIC_CENTER.z), 0.9, 7);
    }

    private buildZenCorner() {
        const sand = this.textured(this.tex.sand(6, 0xe8dcc0), { roughness: 0.97, metalness: 0 });
        const stone = this.textured(this.tex.granite(3, 0x8a8a90), { roughness: 0.86, metalness: 0.08, bump: 0.05 });

        const pad = this.mesh(new THREE.CylinderGeometry(9, 9.4, 0.3, 40), sand, [ZEN_CENTER.x, 0.13, ZEN_CENTER.z]);
        pad.receiveShadow = true;
        this.scene.add(pad);
        this.block(ZEN_CENTER.x, ZEN_CENTER.z, 9.6);

        for (let i = 1; i <= 4; i++) {
            const ring = this.mesh(new THREE.TorusGeometry(i * 1.8, 0.07, 5, 40), sand, [ZEN_CENTER.x, 0.3, ZEN_CENTER.z], [Math.PI / 2, 0, 0]);
            ring.castShadow = false;
            ring.receiveShadow = true;
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
            rock.receiveShadow = true;
            this.scene.add(rock);
        }

        const bonsai = new THREE.Group();
        bonsai.position.set(ZEN_CENTER.x, 0.28, ZEN_CENTER.z);
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
        deck.position.copy(DECK_CENTER);
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
        this.collisionGrid.insertOrientedBox(DECK_CENTER.x, DECK_CENTER.z, 11, 7, Math.PI / 2, 0, 0.4);
        this.block(DECK_CENTER.x, DECK_CENTER.z, 6.4);
    }

    private buildBar() {
        const wood = this.textured(this.tex.planks([3, 1], 0x8a5a32, 0x5a3a1e, 6), { roughness: 0.9, metalness: 0.03, bump: 0.05 });
        const thatch = this.textured(this.tex.stripes(6, 0xd8b46a, 0xb8944a, 12), { roughness: 0.95, metalness: 0.02, bump: 0.06 });
        const counter = this.textured(this.tex.planks([2, 1], 0xb8814a, 0x7a5228, 4), { roughness: 0.55, metalness: 0.1, bump: 0.03 });

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
        this.block(BAR_POSITION.x, BAR_POSITION.z, 6.6);
    }

    private buildLoungers() {
        const frame = this.matte(0xe8e2d0, 0.6, 0.1);
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
            this.block(x, z, 2.2);

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
            this.block(midX, midZ, length * 0.5 + 1);
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
            this.block(x, z, 0.8);

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
            this.block(x, z, 0.9);

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

    private plantFlora() {
        const flora = this.flora!;

        this.block(0, -44, 6);
        this.block(0, -36, 3.5);

        const featureTrees: Array<[number, number, number]> = [
            [PICNIC_CENTER.x, PICNIC_CENTER.z, 9.4],
            [-30, 30, 8.6],
            [30, 34, 9.8],
            [-44, -22, 8.2],
            [40, -34, 8.8],
            [-46, 6, 7.6],
            [18, 44, 8.4],
            [-16, 40, 7.8],
        ];

        for (const [x, z, height] of featureTrees) {
            flora.place("canopy", x, z, height, { tilt: 0.05 });
            this.block(x, z, height * 0.28);
        }

        for (let i = 0; i < 26; i++) {
            const angle = (i / 26) * Math.PI * 2 + this.random() * 0.22;
            const distance = 34 + this.random() * 30;
            const x = Math.cos(angle) * distance;
            const z = Math.sin(angle) * distance;
            const height = 6.5 + this.random() * 5;
            if (this.blocked(x, z, height * 0.3)) continue;
            flora.place("canopy", x, z, height, { tilt: 0.06 });
            this.block(x, z, height * 0.26);
        }

        flora.scatter("understory", 34, 18, FIELD_RADIUS, 1.6, 2.4, { clearance: 1.5, tilt: 0.12 });
        flora.scatter("bush", 180, 6, FIELD_RADIUS + 6, 0.9, 1.5, { clearance: 1, tilt: 0.14 });
        flora.scatter("rock", 90, 10, FIELD_RADIUS + 10, 0.5, 1.6, { clearance: 0.9, tilt: 0.5, sink: 0.22, needsGrass: 0.2 });
        flora.scatter("tuft", 620, 2, FIELD_RADIUS + 8, 0.5, 0.8, { clearance: 0.35, tilt: 0.2 });
        flora.scatter("bloom", 360, 3, FIELD_RADIUS, 0.4, 0.55, { clearance: 0.3, tilt: 0.25 });

        for (const [x, z, radius] of FLOWER_BEDS) {
            flora.scatter("bloom", 150, 0, radius + 1, 0.45, 0.6, {
                clearance: 0.22,
                prefersBed: true,
                tilt: 0.24,
                center: new THREE.Vector3(x, 0, z),
            });
        }

        for (const [x1, z1, x2, z2] of HEDGE_RUNS) {
            const length = Math.hypot(x2 - x1, z2 - z1);
            const steps = Math.max(2, Math.round(length / 1.25));
            const angle = Math.atan2(x2 - x1, z2 - z1);

            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const x = x1 + (x2 - x1) * t;
                const z = z1 + (z2 - z1) * t;
                for (const side of [-0.42, 0.42]) {
                    flora.place(
                        "bush",
                        x + Math.cos(angle) * side,
                        z - Math.sin(angle) * side,
                        1.5 + this.random() * 0.5,
                        { tilt: 0.1 }
                    );
                }
            }

            const steps2 = Math.max(1, Math.round(length / 6));
            for (let i = 0; i < steps2; i++) {
                const t = (i + 0.5) / steps2;
                this.collisionGrid.insertOrientedBox(
                    x1 + (x2 - x1) * t,
                    z1 + (z2 - z1) * t,
                    6,
                    1.4,
                    angle + Math.PI / 2,
                    0,
                    1.5
                );
            }
        }

        for (let i = 0; i < 44; i++) {
            const angle = this.random() * Math.PI * 2;
            const distance = POND_RADIUS + 1.4 + this.random() * 3.6;
            const x = POND_CENTER.x + Math.cos(angle) * distance;
            const z = POND_CENTER.z + Math.sin(angle) * distance;
            flora.place("bush", x, z, 0.8 + this.random() * 0.9, { tilt: 0.2 });
        }

        for (let i = 0; i < 24; i++) {
            const angle = this.random() * Math.PI * 2;
            const distance = 9.6 + this.random() * 3;
            flora.place(
                "rock",
                ZEN_CENTER.x + Math.cos(angle) * distance,
                ZEN_CENTER.z + Math.sin(angle) * distance,
                0.5 + this.random() * 1.1,
                { tilt: 0.6, sink: 0.2 }
            );
        }
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
                lookAt: new THREE.Vector3(DANCE_CENTER.x, 1, DANCE_CENTER.z),
                pose: i === 0 ? "cheer" : "dance",
                phase: this.random() * 9,
                solid: false,
            });
        }

        for (let i = 0; i < 7; i++) {
            const angle = (i / 7) * Math.PI * 2;
            const radius = 2.8 + this.random() * 3.6;
            specs.push({
                position: new THREE.Vector3(DANCE_CENTER.x + Math.cos(angle) * radius, 0, DANCE_CENTER.z + Math.sin(angle) * radius),
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
                position: new THREE.Vector3(ZEN_CENTER.x + Math.cos(angle) * 2.8, 0.28, ZEN_CENTER.z + Math.sin(angle) * 2.8),
                set: "chill",
                lookAt: new THREE.Vector3(ZEN_CENTER.x, 1, ZEN_CENTER.z),
                pose: "pray",
                phase: this.random() * 9,
                solid: false,
            });
        }

        for (let i = 0; i < 3; i++) {
            specs.push({
                position: new THREE.Vector3(TOPIARY_CENTER.x - 6 + i * 5, 0.25, TOPIARY_CENTER.z - 4.4),
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

        const walkers: Array<[number, number, number, number]> = [
            [-30, -30, -6, -30],
            [24, 30, -18, 30],
            [0, -30, 0, 6],
            [-42, 20, -42, -20],
            [38, -24, 38, 14],
            [-8, -12, 8, -12],
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

    public override async whenReady() {
        await this.flora?.whenReady();
    }

    override update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean): void {
        this.playerProbe.copy(playerPosition);
        super.update(playerPosition, delta, isEPressed);
    }

    protected tick(delta: number): void {
        const camera = this.camera;
        if (camera) camera.getWorldPosition(this.cameraProbe);

        this.lighting.update(delta, this.cameraProbe);
        this.sky?.update(delta);
        this.pond?.update(delta);
        this.air?.update(delta);
        if (camera) this.grass?.update(delta, camera, this.playerProbe);

        for (let i = 0; i < this.hammocks.length; i++) {
            this.hammocks[i].rotation.z = Math.sin(this.elapsed * 0.6 + i) * 0.035;
        }

        for (let i = 0; i < this.lanterns.length; i++) {
            this.lanterns[i].position.y += Math.sin(this.elapsed * 1.2 + i) * delta * 0.06;
        }

        for (let i = 0; i < this.banners.length; i++) {
            this.waveBoard(this.banners[i], this.elapsed, 0.06 + this.lighting.uniforms.uWindStrength.value * 0.08, i);
        }
    }

    dispose(): void {
        this.air?.dispose();
        this.flora?.dispose();
        this.pond?.dispose();
        this.grass?.dispose();
        this.ground?.dispose();
        this.sky?.dispose();
        this.surface?.dispose();
        if (this.surfaces) disposeGardenSurfaces(this.surfaces);

        this.air = null;
        this.flora = null;
        this.pond = null;
        this.grass = null;
        this.ground = null;
        this.sky = null;
        this.surfaces = null;
        this.hammocks = [];
        this.lanterns = [];
        this.banners = [];
        this.guest = null;
        this.waiter = null;
        this.guestBubble = null;
        this.waiterBubble = null;
        this.blockers.length = 0;

        super.dispose();
    }
}
