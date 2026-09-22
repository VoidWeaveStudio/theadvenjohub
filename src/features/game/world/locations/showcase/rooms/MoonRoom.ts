// src/features/game/world/locations/showcase/rooms/MoonRoom.ts
import * as THREE from "three";
import { ShowcaseRoom } from "../ShowcaseRoom";
import { ResourceManager } from "../../../../core/ResourceManager";
import { SHOWCASE_INFO_BY_ID, ShowcaseInfo } from "../config";
import { CrowdSpec } from "../actors/ShowcaseCrowd";
import type { ShowcaseActor } from "../actors/ShowcaseActor";
import type { DirectedActor, DirectedScene } from "../scene/directedScene";
import type { EmblemKind } from "../textures";
import { createNpcNameTag } from "../../../../entities/npcNameTag";
import { getGraphicsSettings, prefersMobileProfile } from "@/features/game/core/graphicsSettings";
import { MoonTerrain, type FlatZone } from "./moon/MoonTerrain";
import { MoonSky } from "./moon/MoonSky";
import { MoonField } from "./moon/MoonField";
import { MoonMission, type MoonStage } from "./moon/MoonMission";
import { Rocket } from "./launch/Rocket";
import { ServiceTower } from "./launch/ServiceTower";
import { TOWER_SPAN } from "./launch/launchLayout";
import { steamSprite } from "./launch/launchTextures";
import { disposeMoonSurfaces, dustSprite, loadMoonSurfaces, type MoonSurfaceTextures } from "./moon/moonTextures";
import {
    ARM_Y,
    CAGE_HIGH_Y,
    CAGE_LOW_Y,
    CONTROL_CENTER,
    EXIT_SPOT,
    FIELD_PADS,
    FLAG_FIELD,
    FLAG_POSITION,
    LANDING_PAD,
    MEET_SPOT,
    NEIGHBOUR_PAD,
    PAD_RADIUS,
    ROCKET_Y,
    SOLAR_CENTER,
    SPAWN,
    TOWER_HEIGHT,
    TOWER_X,
    TOWER_Z,
} from "./moon/moonLayout";

const SURFACE_RADIUS = 78;
const DUST_COUNT = 240;
const BASE_DOMES = new THREE.Vector3(-26, 0, 8);
const SUN_POSITION = new THREE.Vector3(70, 46, -60);
const EARTH_POSITION = new THREE.Vector3(-58, 96, 150);
const EARTH_RADIUS = 26;
const LIFT_CURVE = 520;
const LANDING_DUST = 16;

const FLAT_ZONES: FlatZone[] = [
    { x: 0, z: 0, radius: 54, feather: 18 },
    { x: SOLAR_CENTER.x, z: SOLAR_CENTER.z, radius: 16, feather: 9 },
    { x: LANDING_PAD.x, z: LANDING_PAD.z, radius: 18, feather: 10 },
    ...FIELD_PADS.map((pad) => ({ x: pad.x, z: pad.z, radius: 15, feather: 10 })),
];

const MOON_EXPOSURE = {
    ambient: 0.16,
    hemisphere: 0.22,
    sun: 2.9,
    earthshine: 0.5,
    environment: 0.45,
};

export class MoonRoom extends ShowcaseRoom implements MoonStage {
    private flags: THREE.Group[] = [];
    private controlScreen: THREE.Mesh | null = null;
    private dish: THREE.Object3D | null = null;
    private solarPanels: THREE.Mesh[] = [];
    private dust: THREE.Points | null = null;
    private flagCloth: THREE.Mesh | null = null;
    private roverWheels: THREE.Object3D[] = [];
    private controlDish: THREE.Object3D | null = null;
    private surfaces: MoonSurfaceTextures | null = null;
    private moonTerrain: MoonTerrain | null = null;
    private sky: MoonSky | null = null;
    private field: MoonField | null = null;
    private tower: ServiceTower | null = null;
    private rocket: Rocket | null = null;
    private mission: MoonMission | null = null;
    private environment: THREE.Texture | null = null;

    private landingDust: THREE.Sprite[] = [];
    private landingSeeds: Array<{ angle: number; speed: number; size: number }> = [];
    private radioLight: THREE.PointLight | null = null;
    private padLights: THREE.PointLight[] = [];
    private padBulbs: THREE.MeshBasicMaterial[] = [];
    private busyCrowd: Array<{ actor: ShowcaseActor; pose: CrowdSpec["pose"] }> = [];
    private engineGlow: THREE.PointLight | null = null;

    private blast = 0;
    private lift = 1;
    private dustLevel = 0;
    private neighbourLift = 0;
    private busy = false;

    constructor(info: ShowcaseInfo = SHOWCASE_INFO_BY_ID.get("show-moon") as ShowcaseInfo) {
        super(info, 0x4fc1d7, 76);
        this.exitPosition.copy(EXIT_SPOT);
        this.exitFacing = 0;
        this.spawnPosition.copy(SPAWN);
        this.cameraBounds = { radius: 84, minY: -40, maxY: 420 };
    }

    protected groundHeight(x: number, z: number): number {
        return this.moonTerrain ? this.moonTerrain.heightAt(x, z) : 0;
    }

    protected buildAtmosphere(): void {
        const settings = getGraphicsSettings();

        this.scene.background = new THREE.Color(0x020307);
        this.scene.fog = null;

        const anisotropy = this.renderer?.capabilities.getMaxAnisotropy() ?? 4;
        this.surfaces = loadMoonSurfaces(prefersMobileProfile() ? Math.min(4, anisotropy) : anisotropy);

        this.scene.add(new THREE.AmbientLight(0x252c3c, MOON_EXPOSURE.ambient));
        this.scene.add(new THREE.HemisphereLight(0x3a465e, 0x07080c, MOON_EXPOSURE.hemisphere));

        const sun = new THREE.DirectionalLight(0xfff6ea, MOON_EXPOSURE.sun);
        sun.position.copy(SUN_POSITION);
        sun.target.position.set(0, 0, 8);
        sun.castShadow = settings.shadowRes > 0;
        sun.shadow.mapSize.set(Math.max(1024, settings.shadowRes), Math.max(1024, settings.shadowRes));
        sun.shadow.camera.left = -70;
        sun.shadow.camera.right = 70;
        sun.shadow.camera.top = 70;
        sun.shadow.camera.bottom = -70;
        sun.shadow.camera.near = 5;
        sun.shadow.camera.far = 240;
        sun.shadow.bias = -0.0004;
        sun.shadow.normalBias = 0.04;
        sun.shadow.camera.updateProjectionMatrix();
        this.scene.add(sun);
        this.scene.add(sun.target);

        const earthBounce = new THREE.DirectionalLight(0x5f8fd8, MOON_EXPOSURE.earthshine);
        earthBounce.position.copy(EARTH_POSITION);
        this.scene.add(earthBounce);

        this.sky = new MoonSky(this.scene, this.bin, this.random, SUN_POSITION);
        this.sky.create(EARTH_POSITION, EARTH_RADIUS);
    }

    protected decorate(rm: ResourceManager): void {
        this.moonTerrain = new MoonTerrain(this.scene, this.bin, this.random, FLAT_ZONES);

        this.buildSurface();
        this.buildLandingPad();
        this.buildField();
        this.buildHabitat();
        this.buildFlagField();
        this.buildControl();
        this.buildSolarFarm();
        this.buildRover();
        this.buildFlag();
        this.buildDust();
        this.buildCrowd();

        this.mission = new MoonMission(this.scene, this, this.crowd, this.random);
        this.mission.create(rm, this.collisionGrid);

        this.captureEnvironment();
    }

    private captureEnvironment() {
        if (!this.renderer) return;

        const generator = new THREE.PMREMGenerator(this.renderer);
        const target = generator.fromScene(this.scene, 0, 1, 900, {
            size: 128,
            position: new THREE.Vector3(0, 8, 0),
        });

        this.environment = target.texture;
        this.scene.environment = target.texture;
        this.scene.environmentIntensity = MOON_EXPOSURE.environment;
        generator.dispose();
    }

    private buildSurface() {
        this.moonTerrain!.create(this.surfaces!, prefersMobileProfile());

        const rockMaterial = this.bin.material(new THREE.MeshStandardMaterial({
            map: this.surfaces!.basalt.map,
            normalMap: this.surfaces!.basalt.normal,
            color: 0x9c988f,
            roughness: 0.98,
            metalness: 0.03,
        }));

        const count = prefersMobileProfile() ? 140 : 320;
        const rockGeometry = this.bin.geometry(new THREE.DodecahedronGeometry(1, 0));
        const rocks = new THREE.InstancedMesh(rockGeometry, rockMaterial, count);
        rocks.castShadow = true;
        rocks.receiveShadow = true;

        const matrix = new THREE.Matrix4();
        const quaternion = new THREE.Quaternion();
        const euler = new THREE.Euler();
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3();

        for (let i = 0; i < count; i++) {
            const angle = this.random() * Math.PI * 2;
            const distance = 6 + Math.sqrt(this.random()) * 150;
            const size = 0.3 + this.random() * 2.4;
            const x = Math.cos(angle) * distance;
            const z = Math.sin(angle) * distance;

            position.set(x, this.groundHeight(x, z) + size * 0.24, z);
            euler.set(this.random() * 3, this.random() * 3, this.random() * 3);
            quaternion.setFromEuler(euler);
            scale.set(size, size * 0.68, size);
            matrix.compose(position, quaternion, scale);
            rocks.setMatrixAt(i, matrix);
        }

        rocks.instanceMatrix.needsUpdate = true;
        this.scene.add(rocks);

        this.collisionGrid.insertRingWall(SURFACE_RADIUS, 2, 0, 8);
    }

    private buildLandingPad() {
        const deck = this.textured(this.tex.panel([5, 1], 0x74777e, 0x41454c, 5), { roughness: 0.9, metalness: 0.14, bump: 0.05 });
        const hazard = this.textured(this.tex.hazard([8, 1], 0xffb547, 0x1c2028), { roughness: 0.8, metalness: 0.1 });
        const steel = this.metal(0x8a919b, 0.44, 0.78);

        const pad = this.mesh(
            new THREE.CylinderGeometry(PAD_RADIUS, PAD_RADIUS + 0.8, 0.9, 40),
            deck,
            [LANDING_PAD.x, 0.45, LANDING_PAD.z]
        );
        pad.receiveShadow = true;
        this.scene.add(pad);
        this.collisionGrid.insertCylinder(new THREE.Vector3(LANDING_PAD.x, 0.45, LANDING_PAD.z), PAD_RADIUS + 0.8, 0.9);

        const ring = this.mesh(
            new THREE.RingGeometry(PAD_RADIUS - 3.4, PAD_RADIUS - 2.2, 36),
            hazard,
            [LANDING_PAD.x, 0.92, LANDING_PAD.z],
            [-Math.PI / 2, 0, 0]
        );
        ring.castShadow = false;
        this.scene.add(ring);

        const scorch = this.mesh(
            new THREE.CircleGeometry(5.4, 30),
            this.matte(0x1b1d21, 0.98, 0.02),
            [LANDING_PAD.x, 0.93, LANDING_PAD.z],
            [-Math.PI / 2, 0, 0]
        );
        scorch.castShadow = false;
        this.scene.add(scorch);

        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const material = this.glow(i % 2 === 0 ? 0x7ce8ff : 0xffd166, 0.9);
            this.padBulbs.push(material);

            const bulb = this.mesh(
                new THREE.SphereGeometry(0.26, 8, 6),
                material,
                [LANDING_PAD.x + Math.cos(angle) * (PAD_RADIUS - 0.8), 1.1, LANDING_PAD.z + Math.sin(angle) * (PAD_RADIUS - 0.8)]
            );
            bulb.castShadow = false;
            this.scene.add(bulb);

            if (i % 3 === 0) {
                const light = new THREE.PointLight(0x7ce8ff, 16, 20, 2);
                light.position.set(bulb.position.x, 1.6, bulb.position.z);
                this.scene.add(light);
                this.padLights.push(light);
            }
        }

        this.tower = new ServiceTower(this.bin, this.tex, {
            height: TOWER_HEIGHT,
            baseY: 0,
            armY: ARM_Y,
            armReach: 6.4,
            cageLowY: CAGE_LOW_Y,
            cageHighY: CAGE_HIGH_Y,
            accent: 0x9ee6ff,
        });

        const towerGroup = this.tower.create();
        towerGroup.position.set(TOWER_X, 0, TOWER_Z);
        this.scene.add(towerGroup);
        this.tower.setArm(1);
        this.tower.setCage(1);

        this.collisionGrid.insertOrientedBox(TOWER_X, TOWER_Z, TOWER_SPAN * 2 + 0.6, TOWER_SPAN * 2 + 0.6, 0, 0, TOWER_HEIGHT);

        this.rocket = new Rocket(this.bin, this.tex, this.random, { ticker: "MOON", legs: true });
        const craft = this.rocket.create();
        craft.position.set(LANDING_PAD.x, ROCKET_Y + LIFT_CURVE, LANDING_PAD.z);
        this.scene.add(craft);
        this.rocket.setHatch(0);
        this.rocket.setCabinLit(true);
        this.rocket.setVents(false);

        this.engineGlow = new THREE.PointLight(0xffa14a, 0, 90, 2);
        this.engineGlow.position.copy(craft.position);
        this.scene.add(this.engineGlow);

        const sprite = steamSprite(this.bin, this.random);
        for (let i = 0; i < LANDING_DUST; i++) {
            const material = this.bin.material(new THREE.SpriteMaterial({
                map: sprite,
                color: 0xbdb6a8,
                transparent: true,
                opacity: 0,
                depthWrite: false,
            }));

            const puff = new THREE.Sprite(material);
            puff.scale.setScalar(8);
            puff.position.set(LANDING_PAD.x, 1, LANDING_PAD.z);
            this.scene.add(puff);
            this.landingDust.push(puff);

            this.landingSeeds.push({
                angle: this.random() * Math.PI * 2,
                speed: 4 + this.random() * 9,
                size: 6 + this.random() * 9,
            });
        }

        const mast = this.mesh(new THREE.CylinderGeometry(0.14, 0.2, 5, 8), steel, [LANDING_PAD.x + 10, 2.5, LANDING_PAD.z - 8]);
        this.scene.add(mast);

        const plate = this.board(
            this.tex.sign("padone", ["PAD 01", "ARRIVALS"], { background: 0x1c2028, color: 0xbfe6ff, accent: 0x7ce8ff, width: 256, height: 160 }),
            4.4,
            2.6,
            [LANDING_PAD.x + 10, 5.4, LANDING_PAD.z - 8],
            -0.8,
            { roughness: 0.6, metalness: 0.3, emissive: 0x7ce8ff, emissiveIntensity: 0.5 }
        );
        this.scene.add(plate);
    }

    private buildField() {
        this.field = new MoonField({
            scene: this.scene,
            bin: this.bin,
            tex: this.tex,
            random: this.random,
            grid: this.collisionGrid,
            groundHeight: (x, z) => this.groundHeight(x, z),
        });

        this.field.create();

        const neighbour = this.field.rocketFor(NEIGHBOUR_PAD.id);
        if (neighbour) {
            neighbour.setBlast(0);
            neighbour.setVents(true);
        }
    }

    private buildHabitat() {
        const shell = this.textured(this.tex.panel([4, 3], 0xd8dee8, 0x8a93a0, 4), { roughness: 0.6, metalness: 0.24, bump: 0.04 });
        const shellDark = this.textured(this.tex.panel([3, 1], 0xa8b2c0, 0x666e7a, 2), { roughness: 0.7, metalness: 0.28, bump: 0.04 });
        const glass = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x6fd6ff,
            roughness: 0.1,
            metalness: 0.3,
            transparent: true,
            opacity: 0.55,
        }));

        const spots: Array<[number, number, number]> = [
            [BASE_DOMES.x, BASE_DOMES.z, 7],
            [BASE_DOMES.x - 8, BASE_DOMES.z - 14, 5.4],
            [BASE_DOMES.x + 8, BASE_DOMES.z - 22, 6.2],
        ];

        for (const [x, z, radius] of spots) {
            const dome = this.mesh(new THREE.SphereGeometry(radius, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2), shell, [x, 0, z]);
            this.scene.add(dome);

            const skylight = this.mesh(new THREE.SphereGeometry(radius * 0.42, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass, [x, radius * 0.72, z]);
            skylight.castShadow = false;
            this.scene.add(skylight);

            const rim = this.mesh(new THREE.TorusGeometry(radius, 0.35, 8, 26), shellDark, [x, 0.2, z], [-Math.PI / 2, 0, 0]);
            this.scene.add(rim);

            const port = this.mesh(new THREE.CircleGeometry(radius * 0.22, 14), glass, [x, radius * 0.35, z + radius * 0.93]);
            port.castShadow = false;
            this.scene.add(port);

            const light = new THREE.PointLight(0x9ee6ff, 20, 26, 2);
            light.position.set(x, radius * 0.8, z);
            this.scene.add(light);

            this.collisionGrid.insertCylinder(new THREE.Vector3(x, radius / 2, z), radius, radius);
        }

        for (let i = 0; i < spots.length - 1; i++) {
            const [x1, z1] = spots[i];
            const [x2, z2] = spots[i + 1];
            const length = Math.hypot(x2 - x1, z2 - z1);

            const tube = this.mesh(
                new THREE.CylinderGeometry(1.5, 1.5, length, 14),
                shellDark,
                [(x1 + x2) / 2, 1.7, (z1 + z2) / 2],
                [Math.PI / 2, 0, 0]
            );
            tube.rotation.y = Math.atan2(x2 - x1, z2 - z1);
            tube.rotation.order = "YXZ";
            this.scene.add(tube);
        }

        const dish = new THREE.Group();
        dish.position.set(-12, 0, 20);

        const mast = this.mesh(new THREE.CylinderGeometry(0.22, 0.3, 6, 8), shellDark, [0, 3, 0]);
        dish.add(mast);

        const bowl = this.mesh(new THREE.SphereGeometry(3, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.4), shell, [0, 6.4, 0], [Math.PI * 0.62, 0, 0]);
        (bowl.material as THREE.Material).side = THREE.DoubleSide;
        dish.add(bowl);

        const feed = this.mesh(new THREE.CylinderGeometry(0.12, 0.12, 2, 6), shellDark, [0, 7.6, 1.4], [0.9, 0, 0]);
        dish.add(feed);

        this.scene.add(dish);
        this.dish = dish;
        this.collisionGrid.insertCylinder(new THREE.Vector3(-12, 3, 20), 1, 6);
    }

    private buildFlagField() {
        const pole = this.metal(0xc8ced8, 0.3, 0.9);
        const banners: Array<[string, EmblemKind, number]> = [
            ["$DOGE", "dog", 0xffc43d],
            ["$PEPE", "frog", 0x3ddc84],
            ["$WIF", "hands", 0xff8fb1],
            ["$BONK", "coin", 0xffa845],
            ["$MOON", "moon", 0xbfe6ff],
            ["$PUMP", "chart", 0xff6f61],
        ];

        for (let i = 0; i < banners.length; i++) {
            const [ticker, kind, tint] = banners[i];
            const angle = -0.9 + i * 0.36;
            const x = FLAG_FIELD.x + Math.cos(angle) * 9;
            const z = FLAG_FIELD.z + Math.sin(angle) * 9;

            const mast = this.mesh(new THREE.CylinderGeometry(0.08, 0.1, 5.4, 8), pole, [x, 2.7, z]);
            this.scene.add(mast);

            const cloth = this.board(
                this.tex.emblem(`moonflag${ticker}`, kind, 0x1c2028, tint, ticker),
                2.2,
                1.4,
                [x + 1.15, 4.6, z],
                0,
                { roughness: 0.7, metalness: 0.1, emissive: tint, emissiveIntensity: 0.25, segments: 5 }
            );
            this.scene.add(cloth);
            this.flags.push(cloth);

            const cairn = this.mesh(
                new THREE.DodecahedronGeometry(0.7, 0),
                this.textured(this.tex.regolith(1, 0x6b6864), { roughness: 0.98, metalness: 0.02 }),
                [x, 0.3, z + 0.6]
            );
            this.scene.add(cairn);
        }

        const plaque = this.board(
            this.tex.sign("moonclaim", ["WE ARE EARLY", "THE MOON WAS NEVER THE TOP"], { background: 0x1c2028, color: 0xbfe6ff, accent: 0x6f8fb8 }),
            7,
            3.5,
            [FLAG_FIELD.x, 2.8, FLAG_FIELD.z - 6],
            Math.PI,
            { roughness: 0.6, metalness: 0.28, emissive: 0xbfe6ff, emissiveIntensity: 0.3 }
        );
        plaque.rotation.x = 0.22;
        this.scene.add(plaque);

        for (const dx of [-3.2, 3.2]) {
            const leg = this.mesh(new THREE.CylinderGeometry(0.14, 0.18, 3, 8), pole, [FLAG_FIELD.x + dx, 1.5, FLAG_FIELD.z - 5.6]);
            this.scene.add(leg);
        }
    }

    private buildControl() {
        const shell = this.textured(this.tex.panel([2, 1], 0xc2c8d2, 0x5a616b, 3), { roughness: 0.55, metalness: 0.5, bump: 0.05 });
        const dark = this.matte(0x2a3038, 0.6, 0.5);

        const group = new THREE.Group();
        group.position.copy(CONTROL_CENTER);
        group.rotation.y = -1.1;

        const base = this.mesh(new THREE.BoxGeometry(11, 0.6, 7), shell, [0, 0.3, 0]);
        group.add(base);

        const body = this.mesh(new THREE.BoxGeometry(10, 4, 6), shell, [0, 2.6, 0]);
        group.add(body);

        const visorSkin = this.textured(this.tex.grid(2, 0x0d1620, 0x4fd1ff, 8), {
            roughness: 0.2,
            metalness: 0.4,
            emissive: 0x4fd1ff,
            emissiveIntensity: 0.9,
        });
        const visor = this.mesh(new THREE.BoxGeometry(8.4, 1.8, 0.2), visorSkin, [0, 3.2, 3.05]);
        visor.castShadow = false;
        group.add(visor);
        this.controlScreen = visor;

        const roof = this.mesh(new THREE.BoxGeometry(11, 0.4, 7), dark, [0, 4.8, 0]);
        group.add(roof);

        const airlock = this.mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.6, 14), shell, [-4, 1.9, 3.4], [Math.PI / 2, 0, 0]);
        group.add(airlock);

        const hatch = this.mesh(new THREE.CircleGeometry(1, 16), dark, [-4, 1.9, 4.72]);
        group.add(hatch);

        const dish = new THREE.Group();
        dish.position.set(3.6, 5.6, 0);
        const mast = this.mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.4, 8), dark, [0, 1.2, 0]);
        dish.add(mast);
        const bowl = this.mesh(new THREE.SphereGeometry(2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.6), shell, [0, 2.6, 0], [1.1, 0, 0]);
        (bowl.material as THREE.Material).side = THREE.DoubleSide;
        dish.add(bowl);
        const feed = this.mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 6), dark, [0, 3.2, 0.9], [1.1, 0, 0]);
        dish.add(feed);
        group.add(dish);
        this.controlDish = dish;

        const mastLight = this.mesh(new THREE.SphereGeometry(0.22, 10, 8), this.glow(0x3ddc84, 0.9), [-4.8, 5.3, 0]);
        mastLight.castShadow = false;
        group.add(mastLight);

        const light = new THREE.PointLight(0x4fd1ff, 26, 22, 2);
        light.position.set(0, 3.4, 5);
        group.add(light);

        this.scene.add(group);
        this.collisionGrid.insertOrientedBox(CONTROL_CENTER.x, CONTROL_CENTER.z, 11, 7, -1.1, 0, 4.8);
    }

    private buildSolarFarm() {
        const frame = this.metal(0x8a8f98, 0.4, 0.7);
        const panelSkin = this.textured(this.tex.grid(2, 0x1a2a44, 0x4f9fd8, 6), {
            roughness: 0.25,
            metalness: 0.5,
            emissive: 0x3a6f9f,
            emissiveIntensity: 0.25,
        });

        for (let i = 0; i < 6; i++) {
            const x = SOLAR_CENTER.x + (i % 3) * 7 - 7;
            const z = SOLAR_CENTER.z + Math.floor(i / 3) * 8 - 4;

            const post = this.mesh(new THREE.CylinderGeometry(0.2, 0.28, 3, 8), frame, [x, 1.5, z]);
            this.scene.add(post);

            const panel = this.mesh(new THREE.BoxGeometry(5.4, 0.2, 3.4), panelSkin, [x, 3.1, z], [-0.62, 0.3, 0]);
            this.scene.add(panel);
            this.solarPanels.push(panel);

            const spine = this.mesh(new THREE.BoxGeometry(5.6, 0.16, 0.16), frame, [x, 2.95, z]);
            this.scene.add(spine);

            this.collisionGrid.insertCylinder(new THREE.Vector3(x, 1.5, z), 0.5, 3);
        }
    }

    private buildRover() {
        const body = this.matte(0xd8dee8, 0.55, 0.3);
        const dark = this.matte(0x3a4048, 0.7, 0.4);

        const rover = new THREE.Group();
        rover.position.set(-4, 0.6, -16);
        rover.rotation.y = 0.7;

        const chassis = this.mesh(new THREE.BoxGeometry(4.2, 0.5, 2.2), body, [0, 0.5, 0]);
        rover.add(chassis);

        const cabin = this.mesh(new THREE.BoxGeometry(1.8, 1, 1.9), body, [-0.6, 1.2, 0]);
        rover.add(cabin);

        const glass = this.mesh(
            new THREE.BoxGeometry(0.12, 0.7, 1.6),
            this.bin.material(new THREE.MeshStandardMaterial({ color: 0x6fd6ff, roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.6 })),
            [0.32, 1.3, 0]
        );
        glass.castShadow = false;
        rover.add(glass);

        const rack = this.mesh(new THREE.BoxGeometry(1.6, 0.14, 1.9), dark, [1.3, 0.85, 0]);
        rover.add(rack);

        for (const [dx, dz] of [[1.5, 1.2], [1.5, -1.2], [-1.5, 1.2], [-1.5, -1.2]] as Array<[number, number]>) {
            const wheel = this.mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.42, 12), dark, [dx, 0.05, dz], [Math.PI / 2, 0, 0]);
            rover.add(wheel);
            this.roverWheels.push(wheel);
        }

        const antenna = this.mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), dark, [-1.6, 2, 0.6], [0.3, 0, 0.2]);
        rover.add(antenna);

        this.scene.add(rover);
        this.collisionGrid.insertOrientedBox(-4, -16, 4.4, 2.6, 0.7, 0, 2);

        const trackMaterial = this.matte(0x6a6764, 0.99, 0.01);
        for (let i = 0; i < 26; i++) {
            const t = i / 26;
            const x = -4 - Math.cos(0.7) * (4 + t * 30);
            const z = -16 - Math.sin(0.7) * (4 + t * 30);

            for (const side of [-1, 1]) {
                const mark = this.mesh(new THREE.BoxGeometry(0.6, 0.02, 0.34), trackMaterial, [x + side * 0.8, 0.012, z], [0, 0.7, 0]);
                mark.castShadow = false;
                this.scene.add(mark);
            }
        }
    }

    private buildFlag() {
        const pole = this.metal(0xd8dee8, 0.4, 0.85);

        const group = new THREE.Group();
        group.position.copy(FLAG_POSITION);

        const mast = this.mesh(new THREE.CylinderGeometry(0.09, 0.11, 6.4, 8), pole, [0, 3.2, 0]);
        group.add(mast);

        const base = this.mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.2, 12), pole, [0, 0.1, 0]);
        group.add(base);

        const cloth = this.mesh(
            new THREE.PlaneGeometry(3.4, 2.1, 10, 4),
            this.bin.material(new THREE.MeshStandardMaterial({
                color: 0x3ddc84,
                emissive: 0x1f7a4a,
                emissiveIntensity: 0.5,
                roughness: 0.8,
                side: THREE.DoubleSide,
            })),
            [1.75, 5.2, 0]
        );
        group.add(cloth);
        this.flagCloth = cloth;

        const emblem = this.mesh(new THREE.CircleGeometry(0.62, 18), this.lit(0xffd166, 0.7), [1.75, 5.2, 0.05]);
        emblem.castShadow = false;
        group.add(emblem);

        const tag = createNpcNameTag("WE ARE HERE", "#3ddc84");
        tag.position.set(0, 7.6, 0);
        tag.scale.set(5.6, 1.4, 1);
        group.add(tag);

        this.scene.add(group);
        this.collisionGrid.insertCylinder(new THREE.Vector3(FLAG_POSITION.x, 3, FLAG_POSITION.z), 0.5, 6);
    }

    private buildDust() {
        const positions = new Float32Array(DUST_COUNT * 3);

        for (let i = 0; i < DUST_COUNT; i++) {
            positions[i * 3] = (this.random() - 0.5) * SURFACE_RADIUS * 1.6;
            positions[i * 3 + 1] = this.random() * 7;
            positions[i * 3 + 2] = (this.random() - 0.5) * SURFACE_RADIUS * 1.6;
        }

        const geometry = this.bin.geometry(new THREE.BufferGeometry());
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        const material = this.bin.material(new THREE.PointsMaterial({
            map: dustSprite(this.bin),
            color: 0xe4ded2,
            size: 0.34,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
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

        specs.push({
            position: new THREE.Vector3(FLAG_POSITION.x + 1.6, 0, FLAG_POSITION.z + 1.2),
            set: "spacer",
            variantIndex: 0,
            lookAt: new THREE.Vector3(FLAG_POSITION.x, 4, FLAG_POSITION.z),
            pose: "salute",
            phase: 1,
        });

        specs.push({
            position: new THREE.Vector3(FLAG_POSITION.x - 2.2, 0, FLAG_POSITION.z + 0.6),
            set: "spacer",
            variantIndex: 1,
            lookAt: new THREE.Vector3(FLAG_POSITION.x, 3, FLAG_POSITION.z),
            pose: "carry",
            held: "flag",
            accent: 0x3ddc84,
            phase: 3,
        });

        for (const pad of FIELD_PADS) {
            const crew = pad.ready >= 0.5 ? 4 : 3;
            for (let i = 0; i < crew; i++) {
                const angle = pad.facing + 1.2 + i * 0.7;
                const distance = 11 + (i % 2) * 2.4;
                const x = pad.x + Math.cos(angle) * distance;
                const z = pad.z + Math.sin(angle) * distance;

                specs.push({
                    position: new THREE.Vector3(x, 0, z),
                    set: "spacer",
                    lookAt: new THREE.Vector3(pad.x, 8, pad.z),
                    pose: i % 3 === 0 ? "work" : i % 3 === 1 ? "carry" : "gawk",
                    held: i % 3 === 0 ? "wrench" : i % 3 === 1 ? "bag" : undefined,
                    accent: pad.tint,
                    phase: this.random() * 9,
                });
            }
        }

        for (let i = 0; i < 3; i++) {
            specs.push({
                position: new THREE.Vector3(
                    CONTROL_CENTER.x - 5 + i * 3.4,
                    0,
                    CONTROL_CENTER.z + 6.4 + (i % 2) * 1.6
                ),
                set: "spacer",
                lookAt: new THREE.Vector3(CONTROL_CENTER.x, 3.2, CONTROL_CENTER.z),
                pose: i === 1 ? "work" : "gawk",
                held: i === 1 ? "wrench" : undefined,
                phase: this.random() * 9,
            });
        }

        for (let i = 0; i < 4; i++) {
            const angle = -0.7 + i * 0.5;
            specs.push({
                position: new THREE.Vector3(
                    FLAG_FIELD.x + Math.cos(angle) * 6.4,
                    0,
                    FLAG_FIELD.z + Math.sin(angle) * 6.4
                ),
                set: "spacer",
                lookAt: new THREE.Vector3(FLAG_FIELD.x + Math.cos(angle) * 9, 4, FLAG_FIELD.z + Math.sin(angle) * 9),
                pose: i % 2 === 0 ? "salute" : "cheer",
                held: i === 1 ? "flag" : undefined,
                accent: 0x3ddc84,
                phase: this.random() * 9,
            });
        }

        const walkers: Array<[number, number, number, number]> = [
            [6, -34, 6, -16],
            [-40, -18, -10, -24],
            [24, -6, 24, -24],
            [2, -30, 2, 6],
            [LANDING_PAD.x - 20, LANDING_PAD.z + 6, MEET_SPOT.x - 8, MEET_SPOT.z - 6],
        ];

        for (const [x1, z1, x2, z2] of walkers) {
            specs.push({
                position: new THREE.Vector3(x1, 0, z1),
                set: "spacer",
                walk: {
                    path: [new THREE.Vector3(x1, 0, z1), new THREE.Vector3(x2, 0, z2)],
                    mode: "pingpong",
                    pause: 2 + this.random() * 3,
                    speed: 0.85 + this.random() * 0.3,
                },
                held: this.random() < 0.4 ? "bag" : undefined,
                phase: this.random() * 9,
            });
        }

        for (const spec of specs) {
            spec.position.y += this.groundHeight(spec.position.x, spec.position.z);
            if (spec.walk) {
                for (const point of spec.walk.path) point.y += this.groundHeight(point.x, point.z);
            }
        }

        this.crowd.addMany(specs);
    }

    public setCage(amount: number): void {
        this.tower?.setCage(amount);
    }

    public setArm(amount: number): void {
        this.tower?.setArm(amount);
    }

    public setHatch(amount: number): void {
        this.rocket?.setHatch(amount);
    }

    public setBlast(amount: number): void {
        this.blast = amount;
        this.rocket?.setBlast(amount);
    }

    public setLift(amount: number): void {
        this.lift = amount;
    }

    public setDust(amount: number): void {
        this.dustLevel = amount;
    }

    public setGalaxy(amount: number): void {
        this.sky?.setGalaxy(amount);
    }

    public setRadio(active: boolean): void {
        if (!this.radioLight) {
            this.radioLight = new THREE.PointLight(0x3ddc84, 0, 8, 2);
            this.radioLight.position.set(MEET_SPOT.x, 1.6, MEET_SPOT.z);
            this.scene.add(this.radioLight);
        }
        this.radioLight.intensity = active ? 6 : 0;
    }

    public setFieldBusy(busy: boolean): void {
        this.busy = busy;

        if (this.busyCrowd.length === 0) {
            for (const actor of this.crowd.actors()) {
                if (actor.isScripted()) continue;
                this.busyCrowd.push({ actor, pose: actor.currentPose() });
            }
        }

        for (let i = 0; i < this.busyCrowd.length; i++) {
            const member = this.busyCrowd[i];
            member.actor.setPose(busy ? (i % 3 === 0 ? "work" : i % 3 === 1 ? "carry" : "hail") : member.pose);
        }
    }

    public setNeighbourBlast(amount: number): void {
        this.field?.rocketFor(NEIGHBOUR_PAD.id)?.setBlast(amount);
    }

    public setNeighbourLift(amount: number): void {
        this.neighbourLift = amount;
    }

    public cageObject(): THREE.Object3D {
        return this.tower!.cage;
    }

    public cabinObject(): THREE.Object3D {
        return this.rocket!.cabin;
    }

    public getDirectedScene(): DirectedScene | null {
        const timeline = this.mission?.getTimeline();
        if (!timeline) return null;

        return {
            timeline,
            actors: () => {
                const list: DirectedActor[] = [];
                const scripted = new Set<ShowcaseActor>();

                for (const id of timeline.actorIds()) {
                    const actor = timeline.getActor(id);
                    if (!actor) continue;
                    list.push({ id, actor });
                    scripted.add(actor);
                }

                let index = 0;
                for (const actor of this.crowd.actors()) {
                    if (scripted.has(actor)) continue;
                    list.push({ id: `extra ${++index}`, actor });
                }

                return list;
            },
        };
    }

    protected override timeScale(): number {
        return this.mission?.getTimeline().isPaused() ? 0 : 1;
    }

    protected tick(delta: number): void {
        this.sky?.update(delta);
        this.mission?.update(delta);
        this.field?.update(delta, this.elapsed);
        this.rocket?.update(delta);
        this.tower?.update(this.elapsed);

        if (this.rocket) {
            const height = ROCKET_Y + this.lift * this.lift * LIFT_CURVE;
            this.rocket.group.position.y = height;
            this.rocket.setVents(this.lift < 0.01 && this.blast < 0.02);

            if (this.engineGlow) {
                this.engineGlow.position.set(LANDING_PAD.x, height, LANDING_PAD.z);
                this.engineGlow.intensity = this.blast * (260 + Math.sin(this.elapsed * 12) * 60);
            }
        }

        const neighbour = this.field?.rocketFor(NEIGHBOUR_PAD.id);
        if (neighbour) {
            neighbour.group.position.y = 2 + this.neighbourLift * this.neighbourLift * 420;
        }

        for (let i = 0; i < this.landingDust.length; i++) {
            const seed = this.landingSeeds[i];
            const sprite = this.landingDust[i];
            const life = (this.elapsed * 0.5 + i / this.landingDust.length) % 1;
            const spread = life * seed.speed;

            sprite.position.set(
                LANDING_PAD.x + Math.cos(seed.angle) * spread,
                1 + life * 1.6,
                LANDING_PAD.z + Math.sin(seed.angle) * spread
            );
            sprite.scale.setScalar(seed.size * (0.3 + life * 1.4));
            (sprite.material as THREE.SpriteMaterial).opacity = this.dustLevel * 0.38 * (1 - life);
        }

        const pulse = 0.55 + Math.sin(this.elapsed * 8) * 0.2;

        for (let i = 0; i < this.padBulbs.length; i++) {
            this.padBulbs[i].opacity = i % 2 === 0 ? pulse : 1 - pulse;
        }

        for (let i = 0; i < this.padLights.length; i++) {
            this.padLights[i].intensity = 10 + (i % 2 === 0 ? pulse : 1 - pulse) * 12;
        }

        if (this.radioLight && this.radioLight.intensity > 0) {
            this.radioLight.intensity = 4 + Math.abs(Math.sin(this.elapsed * 9)) * 5;
        }

        for (let i = 0; i < this.flags.length; i++) {
            this.waveBoard(this.flags[i], this.elapsed * 0.8, 0.05, i);
        }

        if (this.controlScreen) {
            const material = this.controlScreen.material as THREE.MeshStandardMaterial;
            material.emissiveIntensity = 0.7 + Math.sin(this.elapsed * 3.4) * 0.3;
            if (material.map) material.map.offset.y = -this.elapsed * 0.08;
        }

        if (this.controlDish) {
            this.controlDish.rotation.y = Math.sin(this.elapsed * 0.22) * 0.7;
        }

        for (let i = 0; i < this.solarPanels.length; i++) {
            this.solarPanels[i].rotation.y = 0.3 + Math.sin(this.elapsed * 0.16 + i * 0.4) * 0.22;
        }

        if (this.dish) {
            this.dish.rotation.y = Math.sin(this.elapsed * 0.12) * 0.7;
        }

        if (this.flagCloth) {
            this.flagCloth.rotation.y = Math.sin(this.elapsed * 0.8) * 0.12;
            this.flagCloth.rotation.z = Math.sin(this.elapsed * 1.3) * 0.05;
        }

        for (let i = 0; i < this.roverWheels.length; i++) {
            this.roverWheels[i].rotation.y += delta * (this.busy ? 0.9 : 0.2);
        }

        if (this.dust) {
            const attribute = this.dust.geometry.getAttribute("position") as THREE.BufferAttribute;
            const array = attribute.array as Float32Array;
            for (let i = 0; i < array.length; i += 3) {
                array[i] += Math.sin(this.elapsed * 0.3 + i) * delta * 0.25;
                array[i + 1] += delta * 0.08;
                if (array[i + 1] > 8) array[i + 1] = 0.1;
            }
            attribute.needsUpdate = true;
        }
    }

    dispose(): void {
        this.sky?.dispose();
        this.moonTerrain?.dispose();
        this.field?.dispose();
        this.tower?.dispose();
        this.rocket?.dispose();
        this.mission?.dispose();
        if (this.surfaces) disposeMoonSurfaces(this.surfaces);

        this.scene.environment = null;
        this.environment?.dispose();
        this.environment = null;

        this.sky = null;
        this.moonTerrain = null;
        this.field = null;
        this.tower = null;
        this.rocket = null;
        this.mission = null;
        this.surfaces = null;
        this.flags = [];
        this.solarPanels = [];
        this.padLights = [];
        this.padBulbs = [];
        this.roverWheels = [];
        this.landingDust = [];
        this.landingSeeds = [];
        this.busyCrowd = [];
        this.radioLight = null;
        this.engineGlow = null;
        this.dust = null;

        super.dispose();
    }
}
