// src/features/game/world/locations/showcase/rooms/LaunchRoom.ts
import * as THREE from "three";
import { ShowcaseRoom } from "../ShowcaseRoom";
import { ResourceManager } from "../../../../core/ResourceManager";
import { MOON_SURFACE_ID, SHOWCASE_INFO_BY_ID, ShowcaseInfo } from "../config";
import { CrowdSpec } from "../actors/ShowcaseCrowd";
import type { ShowcaseActor } from "../actors/ShowcaseActor";
import type { DirectedActor, DirectedScene } from "../scene/directedScene";
import type { EmblemKind } from "../textures";
import { getGraphicsSettings, prefersMobileProfile } from "@/features/game/core/graphicsSettings";
import { isCinemaActive } from "../cinemaVisibility";
import { LaunchGround } from "./launch/LaunchGround";
import { LaunchPerimeter } from "./launch/LaunchPerimeter";
import { LaunchSky } from "./launch/LaunchSky";
import { LaunchService, type LaunchStage } from "./launch/LaunchService";
import { Rocket } from "./launch/Rocket";
import { ServiceTower } from "./launch/ServiceTower";
import {
    disposeLaunchSurfaces,
    glowSprite,
    loadLaunchSurfaces,
    steamSprite,
    type ChartMood,
    type LaunchSurfaceTextures,
} from "./launch/launchTextures";
import {
    ARM_Y,
    BUNKER,
    CAGE_HIGH_Y,
    CAGE_LOW_Y,
    EXIT_SPOT,
    FENCE_RADIUS,
    MOON_DIRECTION,
    PAD_DECK_Y,
    PAD_RADIUS,
    RAMP_START_Z,
    RAMP_WIDTH,
    ROCKET_BASE,
    SITE_RADIUS,
    SPAWN,
    STAND_Z,
    TANK_FARM,
    TOWER_HEIGHT,
    TOWER_SPAN,
    TOWER_X,
    TOWER_Z,
    WATER_TOWER,
    groundHeightAt,
} from "./launch/launchLayout";

const LIFT_CURVE = 620;
const SMOKE_COUNT = 22;

const EXPOSURE = {
    ambient: 0.42,
    hemisphere: 0.5,
    moon: 1.85,
    environment: 0.32,
};

export class LaunchRoom extends ShowcaseRoom implements LaunchStage {
    private surfaces: LaunchSurfaceTextures | null = null;
    private ground: LaunchGround | null = null;
    private perimeter: LaunchPerimeter | null = null;
    private sky: LaunchSky | null = null;
    private tower: ServiceTower | null = null;
    private rocket: Rocket | null = null;
    private service: LaunchService | null = null;
    private environment: THREE.Texture | null = null;

    private countBoards: THREE.Group[] = [];
    private floodLights: THREE.SpotLight[] = [];
    private floodCones: THREE.Mesh[] = [];
    private beacons: THREE.MeshBasicMaterial[] = [];
    private smoke: THREE.Sprite[] = [];
    private smokeSeeds: Array<{ angle: number; speed: number; rise: number; size: number }> = [];
    private vents: THREE.Mesh[] = [];
    private launchHaze: THREE.Mesh | null = null;
    private launchGlow: THREE.PointLight | null = null;
    private sirenLights: THREE.PointLight[] = [];

    private blast = 0;
    private lift = 0;
    private flood = 0.5;
    private transferred = false;

    constructor(info: ShowcaseInfo = SHOWCASE_INFO_BY_ID.get("show-launch") as ShowcaseInfo) {
        super(info, 0x2f7de8, SITE_RADIUS);
        this.exitPosition.copy(EXIT_SPOT);
        this.exitFacing = 0;
        this.spawnPosition.copy(SPAWN);
        this.cameraBounds = { radius: 210, minY: -10, maxY: 520 };
    }

    protected groundHeight(x: number, z: number): number {
        return groundHeightAt(x, z);
    }

    protected buildAtmosphere(): void {
        const settings = getGraphicsSettings();

        this.scene.background = new THREE.Color(0x050a14);
        this.scene.fog = new THREE.FogExp2(0x0a1424, 0.0022);

        const anisotropy = this.renderer?.capabilities.getMaxAnisotropy() ?? 4;
        this.surfaces = loadLaunchSurfaces(prefersMobileProfile() ? Math.min(4, anisotropy) : anisotropy);

        this.scene.add(new THREE.AmbientLight(0x1b2740, EXPOSURE.ambient));
        this.scene.add(new THREE.HemisphereLight(0x2c4258, 0x0d1116, EXPOSURE.hemisphere));

        const moonlight = new THREE.DirectionalLight(0xcfe0ff, EXPOSURE.moon);
        moonlight.position.copy(MOON_DIRECTION).multiplyScalar(220);
        moonlight.target.position.set(0, PAD_DECK_Y, 0);
        moonlight.castShadow = settings.shadowRes > 0;
        moonlight.shadow.mapSize.set(Math.max(1024, settings.shadowRes), Math.max(1024, settings.shadowRes));
        moonlight.shadow.camera.left = -80;
        moonlight.shadow.camera.right = 80;
        moonlight.shadow.camera.top = 90;
        moonlight.shadow.camera.bottom = -60;
        moonlight.shadow.camera.near = 20;
        moonlight.shadow.camera.far = 420;
        moonlight.shadow.bias = -0.0005;
        moonlight.shadow.normalBias = 0.05;
        moonlight.shadow.camera.updateProjectionMatrix();
        this.scene.add(moonlight);
        this.scene.add(moonlight.target);

        this.sky = new LaunchSky(this.scene, this.bin, this.random, MOON_DIRECTION);
        this.sky.create();
    }

    protected decorate(rm: ResourceManager): void {
        this.ground = new LaunchGround(this.scene, this.bin);
        this.ground.create(this.surfaces!, prefersMobileProfile());

        this.buildPad();
        this.buildTower();
        this.buildRocket();
        this.buildFloods();
        this.buildCountdown();
        this.buildWaterTower();
        this.buildTanks();
        this.buildBunker();
        this.buildFence();
        this.buildStands();
        this.buildPerimeter();
        this.buildSmoke();
        this.buildCrowd();

        this.service = new LaunchService(this.scene, this, this.crowd, this.random);
        this.service.create(rm, this.collisionGrid);

        this.captureEnvironment();
    }

    private captureEnvironment() {
        if (!this.renderer) return;

        const generator = new THREE.PMREMGenerator(this.renderer);
        const target = generator.fromScene(this.scene, 0, 1, 900, {
            size: 128,
            position: new THREE.Vector3(0, PAD_DECK_Y + 10, 0),
        });

        this.environment = target.texture;
        this.scene.environment = target.texture;
        this.scene.environmentIntensity = EXPOSURE.environment;
        generator.dispose();
    }

    private buildPad() {
        const concrete = this.textured(this.tex.panel([6, 1], 0x9aa0a0, 0x6a7070, 6), { roughness: 0.94, metalness: 0.03, bump: 0.05 });
        const steel = this.metal(0x7a818b, 0.44, 0.78);
        const hazard = this.textured(this.tex.hazard([8, 1], 0xffb547, 0x1c2028), { roughness: 0.8, metalness: 0.1 });
        const dark = this.matte(0x1a1e24, 0.9, 0.2);

        const rim = this.mesh(
            new THREE.CylinderGeometry(PAD_RADIUS, PAD_RADIUS + 0.6, PAD_DECK_Y, 64, 1, true),
            concrete,
            [0, PAD_DECK_Y / 2, 0]
        );
        (rim.material as THREE.Material).side = THREE.DoubleSide;
        this.scene.add(rim);

        this.collisionGrid.insertRingWall(PAD_RADIUS, 1.4, 0, PAD_DECK_Y, [{ angle: 0, halfAngle: 0.26 }]);

        const trench = this.mesh(new THREE.RingGeometry(4.6, 8.4, 40), dark, [0, PAD_DECK_Y + 0.02, 0], [-Math.PI / 2, 0, 0]);
        trench.castShadow = false;
        this.scene.add(trench);

        const chute = this.mesh(new THREE.BoxGeometry(9, 0.4, 24), dark, [16, PAD_DECK_Y + 0.02, 0], [0, 0.4, 0]);
        chute.castShadow = false;
        this.scene.add(chute);

        const stripe = this.mesh(new THREE.RingGeometry(9.2, 10.4, 44), hazard, [0, PAD_DECK_Y + 0.03, 0], [-Math.PI / 2, 0, 0]);
        stripe.castShadow = false;
        this.scene.add(stripe);

        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const clamp = this.mesh(
                new THREE.BoxGeometry(1.2, 3.4, 1.2),
                steel,
                [Math.cos(angle) * 4.2, PAD_DECK_Y + 1.7, Math.sin(angle) * 4.2],
                [0, -angle, 0]
            );
            this.scene.add(clamp);
        }

        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const x = Math.cos(angle) * (PAD_RADIUS - 3);
            const z = Math.sin(angle) * (PAD_RADIUS - 3);

            const mast = this.mesh(new THREE.CylinderGeometry(0.2, 0.34, 34, 8), steel, [x, PAD_DECK_Y + 17, z]);
            this.scene.add(mast);

            const tip = this.mesh(new THREE.ConeGeometry(0.3, 1.6, 8), steel, [x, PAD_DECK_Y + 34.6, z]);
            tip.castShadow = false;
            this.scene.add(tip);

            this.collisionGrid.insertCylinder(new THREE.Vector3(x, PAD_DECK_Y + 2, z), 0.6, 4);
        }

        const rampLength = Math.abs(RAMP_START_Z) - PAD_RADIUS;
        const ramp = this.mesh(
            new THREE.BoxGeometry(RAMP_WIDTH, 0.3, rampLength + 1.4),
            concrete,
            [0, PAD_DECK_Y / 2 - 0.1, -(PAD_RADIUS + rampLength / 2)],
            [Math.atan2(PAD_DECK_Y, rampLength), 0, 0]
        );
        ramp.receiveShadow = true;
        this.scene.add(ramp);

        for (const side of [-1, 1]) {
            const kerb = this.mesh(
                new THREE.BoxGeometry(0.5, 0.7, rampLength + 1.4),
                hazard,
                [side * (RAMP_WIDTH / 2), PAD_DECK_Y / 2 + 0.2, -(PAD_RADIUS + rampLength / 2)],
                [Math.atan2(PAD_DECK_Y, rampLength), 0, 0]
            );
            kerb.castShadow = false;
            this.scene.add(kerb);
        }

        const tray = this.mesh(new THREE.BoxGeometry(1.6, 0.5, 30), steel, [-19, PAD_DECK_Y + 0.4, -6]);
        tray.castShadow = false;
        this.scene.add(tray);
    }

    private buildTower() {
        this.tower = new ServiceTower(this.bin, this.tex, {
            height: TOWER_HEIGHT,
            baseY: PAD_DECK_Y,
            armY: ARM_Y,
            armReach: 6.4,
            cageLowY: CAGE_LOW_Y,
            cageHighY: CAGE_HIGH_Y,
            accent: 0xffe6c4,
        });

        const group = this.tower.create();
        group.position.x = TOWER_X;
        group.position.z = TOWER_Z;
        this.scene.add(group);

        this.collisionGrid.insertOrientedBox(TOWER_X, TOWER_Z, TOWER_SPAN * 2 + 0.6, TOWER_SPAN * 2 + 0.6, 0, PAD_DECK_Y, PAD_DECK_Y + TOWER_HEIGHT);
    }

    private buildRocket() {
        this.rocket = new Rocket(this.bin, this.tex, this.random, { ticker: "MOON" });
        const group = this.rocket.create();
        group.position.copy(ROCKET_BASE);
        this.scene.add(group);

        this.rocket.setHatch(1);
        this.rocket.setCabinLit(true);

        this.collisionGrid.insertCylinder(new THREE.Vector3(0, PAD_DECK_Y + 8, 0), 3.4, 16);

        this.launchGlow = new THREE.PointLight(0xffa14a, 0, 160, 2);
        this.launchGlow.position.set(0, PAD_DECK_Y + 2, 0);
        this.scene.add(this.launchGlow);
    }

    private buildFloods() {
        const steel = this.metal(0x6a7078, 0.5, 0.7);
        const lean = prefersMobileProfile();
        const masts = lean ? 3 : 5;

        for (let i = 0; i < masts; i++) {
            const angle = -2.2 + (i / (masts - 1)) * 4.4;
            const x = Math.cos(angle) * (PAD_RADIUS + 14);
            const z = Math.sin(angle) * (PAD_RADIUS + 14);
            const base = groundHeightAt(x, z);

            const mast = this.mesh(new THREE.CylinderGeometry(0.22, 0.34, 20, 8), steel, [x, base + 10, z]);
            this.scene.add(mast);

            const head = this.mesh(new THREE.BoxGeometry(2.6, 1.2, 0.8), steel, [x, base + 20.4, z], [0, -angle, 0]);
            head.castShadow = false;
            this.scene.add(head);

            this.collisionGrid.insertCylinder(new THREE.Vector3(x, base + 2, z), 0.6, 4);

            const lamp = new THREE.SpotLight(0xfff0d4, 60, 120, 0.42, 0.55, 1.4);
            lamp.position.set(x, base + 20.4, z);
            lamp.target.position.set(0, PAD_DECK_Y + 8, 0);
            this.scene.add(lamp);
            this.scene.add(lamp.target);
            this.floodLights.push(lamp);

            if (lean) continue;

            const coneGeometry = new THREE.ConeGeometry(7, 40, 16, 1, true);
            coneGeometry.translate(0, -20, 0);

            const cone = this.mesh(coneGeometry, this.glow(0xfff0d4, 0.045), [x, base + 20.4, z]);
            cone.castShadow = false;
            cone.receiveShadow = false;
            cone.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, -1, 0),
                new THREE.Vector3(-x, PAD_DECK_Y + 8 - (base + 20.4), -z).normalize()
            );
            this.scene.add(cone);
            this.floodCones.push(cone);
        }

        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const material = this.glow(i % 2 === 0 ? 0xff4a4a : 0xffd166, 0.9);
            this.beacons.push(material);

            const bulb = this.mesh(
                new THREE.SphereGeometry(0.24, 8, 6),
                material,
                [Math.cos(angle) * (PAD_RADIUS - 1.4), PAD_DECK_Y + 0.6, Math.sin(angle) * (PAD_RADIUS - 1.4)]
            );
            bulb.castShadow = false;
            this.scene.add(bulb);

            if (i % 4 === 0) {
                const siren = new THREE.PointLight(0xff4a4a, 10, 22, 2);
                siren.position.set(Math.cos(angle) * (PAD_RADIUS - 1.4), PAD_DECK_Y + 1.2, Math.sin(angle) * (PAD_RADIUS - 1.4));
                this.scene.add(siren);
                this.sirenLights.push(siren);
            }
        }
    }

    private buildCountdown() {
        const steel = this.metal(0x6a7078, 0.5, 0.7);
        const x = 26;
        const z = -44;
        const base = groundHeightAt(x, z);

        for (const dx of [-4.4, 4.4]) {
            const mast = this.mesh(new THREE.CylinderGeometry(0.2, 0.26, 12, 8), steel, [x + dx, base + 6, z]);
            this.scene.add(mast);
        }

        const frame = this.mesh(new THREE.BoxGeometry(11, 6.4, 0.5), this.matte(0x14181f, 0.8, 0.2), [x, base + 9, z], [0, -0.7, 0]);
        this.scene.add(frame);

        const labels = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "LIFTOFF"];
        for (let i = 0; i < labels.length; i++) {
            const board = this.board(
                this.tex.sign(`count${labels[i]}`, [labels[i] === "LIFTOFF" ? "LIFTOFF" : `T - ${labels[i]}`], {
                    background: 0x0a0c10,
                    color: labels[i] === "LIFTOFF" ? 0xff6a4a : 0xffd166,
                    accent: 0xff5a4a,
                    width: 320,
                    height: 180,
                }),
                9.6,
                5,
                [x, base + 9, z],
                -0.7,
                { roughness: 0.4, metalness: 0.2, emissive: 0xffd166, emissiveIntensity: 1.3 }
            );
            board.position.add(new THREE.Vector3(Math.sin(-0.7) * 0.4, 0, Math.cos(-0.7) * 0.4));
            board.visible = false;
            this.scene.add(board);
            this.countBoards.push(board);
        }

        this.collisionGrid.insertOrientedBox(x, z, 11, 1.4, -0.7, base, base + 12);
    }

    private buildWaterTower() {
        const steel = this.metal(0x8a919b, 0.46, 0.72);
        const paint = this.textured(this.tex.stripes([2, 1], 0xd94f4f, 0xf2f2f2, 4), { roughness: 0.6, metalness: 0.3 });

        const base = groundHeightAt(WATER_TOWER.x, WATER_TOWER.z);
        const group = new THREE.Group();
        group.position.set(WATER_TOWER.x, base, WATER_TOWER.z);

        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const leg = this.mesh(
                new THREE.CylinderGeometry(0.28, 0.36, 22, 8),
                steel,
                [Math.cos(angle) * 3.4, 11, Math.sin(angle) * 3.4],
                [Math.sin(angle) * 0.1, 0, -Math.cos(angle) * 0.1]
            );
            group.add(leg);
        }

        for (const y of [7, 14]) {
            const hoop = this.mesh(new THREE.TorusGeometry(3.4, 0.1, 6, 20), steel, [0, y, 0], [-Math.PI / 2, 0, 0]);
            hoop.castShadow = false;
            group.add(hoop);
        }

        const tank = this.mesh(new THREE.SphereGeometry(5.4, 26, 18), paint, [0, 26, 0]);
        group.add(tank);

        const pipe = this.mesh(new THREE.CylinderGeometry(0.44, 0.44, 22, 10), steel, [0, 11, 0]);
        pipe.castShadow = false;
        group.add(pipe);

        const outlet = this.mesh(new THREE.CylinderGeometry(0.44, 0.44, 22, 10), steel, [-11, 0.6, 0], [0, 0, Math.PI / 2]);
        outlet.castShadow = false;
        group.add(outlet);

        this.scene.add(group);
        this.collisionGrid.insertCylinder(new THREE.Vector3(WATER_TOWER.x, base + 3, WATER_TOWER.z), 3.8, 6);
    }

    private buildTanks() {
        const shell = this.textured(this.tex.panel([3, 1], 0xdfe6ee, 0x9aa2ae, 3), { roughness: 0.42, metalness: 0.46, bump: 0.03 });
        const steel = this.metal(0x6a7078, 0.5, 0.7);
        const labels: Array<[string, number]> = [["LOX", 0x6fd6ff], ["RP-1", 0xffb547], ["HOPIUM", 0x3ddc84]];

        for (let i = 0; i < 3; i++) {
            const x = TANK_FARM.x + (i % 3) * 9 - 9;
            const z = TANK_FARM.z + (i % 2) * 7;
            const base = groundHeightAt(x, z);

            const tank = this.mesh(new THREE.CylinderGeometry(3.4, 3.4, 13, 22), shell, [x, base + 7, z]);
            this.scene.add(tank);

            const cap = this.mesh(new THREE.SphereGeometry(3.4, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), shell, [x, base + 13.5, z]);
            this.scene.add(cap);

            const skirt = this.mesh(new THREE.CylinderGeometry(3.5, 3.7, 1.2, 22), steel, [x, base + 0.6, z]);
            this.scene.add(skirt);

            const rail = this.mesh(new THREE.TorusGeometry(3.6, 0.08, 6, 22), steel, [x, base + 13.6, z], [-Math.PI / 2, 0, 0]);
            rail.castShadow = false;
            this.scene.add(rail);

            const plate = this.board(
                this.tex.sign(`tank${labels[i][0]}`, [labels[i][0]], {
                    background: 0x1c2028,
                    color: labels[i][1],
                    accent: labels[i][1],
                    width: 256,
                    height: 160,
                }),
                4,
                2.4,
                [x, base + 8.5, z - 3.5],
                Math.PI,
                { roughness: 0.6, metalness: 0.2, emissive: labels[i][1], emissiveIntensity: 0.4 }
            );
            this.scene.add(plate);

            const pipe = this.mesh(new THREE.CylinderGeometry(0.34, 0.34, 26, 10), steel, [x - 13, base + 1.4, z], [0, 0, Math.PI / 2]);
            pipe.castShadow = false;
            this.scene.add(pipe);

            const vent = this.mesh(
                new THREE.SphereGeometry(1.6, 12, 8),
                this.glow(0xdfe9f5, 0.14, false),
                [x, base + 15, z]
            );
            vent.castShadow = false;
            this.scene.add(vent);
            this.vents.push(vent);

            this.collisionGrid.insertCylinder(new THREE.Vector3(x, base + 6, z), 3.6, 14);
        }
    }

    private buildBunker() {
        const concrete = this.textured(this.tex.panel([3, 1], 0x8f958f, 0x5d6360, 3), { roughness: 0.92, metalness: 0.04, bump: 0.05 });
        const dark = this.matte(0x1a1e24, 0.8, 0.2);
        const base = groundHeightAt(BUNKER.x, BUNKER.z);

        const group = new THREE.Group();
        group.position.set(BUNKER.x, base, BUNKER.z);
        group.rotation.y = 0.6;

        const body = this.mesh(new THREE.BoxGeometry(18, 5, 11), concrete, [0, 2.5, 0]);
        group.add(body);

        const roof = this.mesh(new THREE.BoxGeometry(19, 0.6, 12), dark, [0, 5.3, 0]);
        group.add(roof);

        const berm = this.mesh(new THREE.BoxGeometry(21, 2.4, 14), concrete, [0, 1.2, 0]);
        berm.receiveShadow = true;
        group.add(berm);

        const glass = this.textured(this.tex.grid([3, 1], 0x0d1620, 0x4fd1ff, 10), {
            roughness: 0.2,
            metalness: 0.4,
            emissive: 0x4fd1ff,
            emissiveIntensity: 1.1,
        });

        const band = this.mesh(new THREE.BoxGeometry(14.6, 1.6, 0.3), glass, [0, 3.6, 5.6]);
        band.castShadow = false;
        group.add(band);

        const light = new THREE.PointLight(0x4fd1ff, 34, 26, 2);
        light.position.set(0, 3.6, 7);
        group.add(light);

        const door = this.mesh(new THREE.BoxGeometry(2.2, 3, 0.3), dark, [-6.4, 1.5, 5.6]);
        door.castShadow = false;
        group.add(door);

        for (const dx of [-6, 6]) {
            const mast = this.mesh(new THREE.CylinderGeometry(0.16, 0.22, 9, 8), dark, [dx, 9.8, -3]);
            group.add(mast);
        }

        const dish = new THREE.Group();
        dish.position.set(6, 5.8, 2);
        const stand = this.mesh(new THREE.CylinderGeometry(0.22, 0.3, 2.4, 8), dark, [0, 1.2, 0]);
        dish.add(stand);
        const bowl = this.mesh(new THREE.SphereGeometry(2.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.6), concrete, [0, 2.8, 0], [1.05, 0, 0]);
        (bowl.material as THREE.Material).side = THREE.DoubleSide;
        dish.add(bowl);
        group.add(dish);

        const sign = this.board(
            this.tex.sign("complex", ["LAUNCH COMPLEX 01", "TO THE MOON"], {
                background: 0x141820,
                color: 0xbfe6ff,
                accent: 0x4fd1ff,
            }),
            10,
            5,
            [0, 8, 6],
            0,
            { roughness: 0.6, metalness: 0.2, emissive: 0x4fd1ff, emissiveIntensity: 0.5 }
        );
        group.add(sign);

        this.scene.add(group);
        this.collisionGrid.insertOrientedBox(BUNKER.x, BUNKER.z, 21, 14, 0.6, base, base + 5.6);

        for (let i = 0; i < 3; i++) {
            const x = BUNKER.x + 16 + i * 5;
            const z = BUNKER.z - 12;
            const spot = groundHeightAt(x, z);

            const van = this.mesh(new THREE.BoxGeometry(5.4, 2.4, 2.4), this.matte(0xd8dee8, 0.6, 0.2), [x, spot + 1.4, z], [0, 0.3, 0]);
            this.scene.add(van);

            const cabin = this.mesh(new THREE.BoxGeometry(2, 1.4, 2.2), this.matte(0xc2c8d2, 0.6, 0.2), [x - 1.8, spot + 3.1, z], [0, 0.3, 0]);
            cabin.castShadow = false;
            this.scene.add(cabin);

            for (const [dx, dz] of [[-1.8, 1.2], [-1.8, -1.2], [1.8, 1.2], [1.8, -1.2]] as Array<[number, number]>) {
                const wheel = this.mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.4, 10), dark, [x + dx, spot + 0.6, z + dz], [Math.PI / 2, 0, 0.3]);
                wheel.castShadow = false;
                this.scene.add(wheel);
            }

            this.collisionGrid.insertOrientedBox(x, z, 5.6, 2.8, 0.3, spot, spot + 2.8);
        }
    }

    private buildFence() {
        const steel = this.metal(0x6a7078, 0.6, 0.6);
        const wire = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x9aa2ae,
            roughness: 0.7,
            metalness: 0.5,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide,
        }));

        this.collisionGrid.insertRingWall(FENCE_RADIUS, 1.2, 0, 3.4);

        const posts = 56;
        for (let i = 0; i < posts; i++) {
            const angle = (i / posts) * Math.PI * 2;
            const x = Math.cos(angle) * FENCE_RADIUS;
            const z = Math.sin(angle) * FENCE_RADIUS;
            const base = groundHeightAt(x, z);

            const post = this.mesh(new THREE.CylinderGeometry(0.1, 0.12, 3.2, 6), steel, [x, base + 1.6, z]);
            post.castShadow = false;
            this.scene.add(post);

            const next = ((i + 1) / posts) * Math.PI * 2;
            const nx = Math.cos(next) * FENCE_RADIUS;
            const nz = Math.sin(next) * FENCE_RADIUS;
            const span = Math.hypot(nx - x, nz - z);

            const panel = this.mesh(
                new THREE.PlaneGeometry(span, 3),
                wire,
                [(x + nx) / 2, base + 1.6, (z + nz) / 2],
                [0, Math.atan2(nx - x, nz - z) + Math.PI / 2, 0]
            );
            panel.castShadow = false;
            panel.receiveShadow = false;
            this.scene.add(panel);
        }

        const banners: Array<[string, EmblemKind, number]> = [
            ["$MOON", "moon", 0xbfe6ff],
            ["$PUMP", "chart", 0xff6f61],
            ["$DOGE", "dog", 0xffc43d],
            ["$WIF", "hands", 0xff8fb1],
        ];

        for (let i = 0; i < banners.length; i++) {
            const angle = -2.5 + i * 0.42;
            const x = Math.cos(angle) * (FENCE_RADIUS - 0.3);
            const z = Math.sin(angle) * (FENCE_RADIUS - 0.3);
            const base = groundHeightAt(x, z);
            const [ticker, kind, tint] = banners[i];

            const cloth = this.board(
                this.tex.emblem(`padflag${ticker}`, kind, 0x1c2028, tint, ticker),
                3,
                2,
                [x, base + 2, z],
                Math.atan2(-x, -z),
                { roughness: 0.8, metalness: 0.05, emissive: tint, emissiveIntensity: 0.16, segments: 4 }
            );
            this.scene.add(cloth);
        }
    }

    private buildPerimeter() {
        this.perimeter = new LaunchPerimeter({
            scene: this.scene,
            bin: this.bin,
            tex: this.tex,
            random: this.random,
            grid: this.collisionGrid,
            lean: prefersMobileProfile(),
        });

        this.perimeter.create();
    }

    private buildStands() {
        const steel = this.metal(0x6a7078, 0.55, 0.6);
        const plank = this.textured(this.tex.planks([4, 1], 0x8a7a62, 0x5a4c3a, 6), { roughness: 0.86, metalness: 0.04, bump: 0.05 });

        const group = new THREE.Group();
        group.position.set(0, groundHeightAt(0, STAND_Z), STAND_Z);

        for (let row = 0; row < 4; row++) {
            const y = 0.6 + row * 0.7;
            const z = -row * 1.5;

            const deck = this.mesh(new THREE.BoxGeometry(26, 0.24, 1.4), plank, [0, y, z]);
            group.add(deck);

            const bench = this.mesh(new THREE.BoxGeometry(26, 0.2, 0.5), plank, [0, y + 0.5, z - 0.5]);
            bench.castShadow = false;
            group.add(bench);

            for (const dx of [-12, -4, 4, 12]) {
                const post = this.mesh(new THREE.CylinderGeometry(0.1, 0.12, y, 6), steel, [dx, y / 2, z]);
                post.castShadow = false;
                group.add(post);
            }
        }

        const rail = this.mesh(new THREE.BoxGeometry(26, 0.12, 0.12), steel, [0, 1.3, 1.4]);
        rail.castShadow = false;
        group.add(rail);

        this.scene.add(group);
        this.collisionGrid.insertOrientedBox(0, STAND_Z - 2.2, 26, 6.6, 0, 0, 3.4);

        const sign = this.board(
            this.tex.sign("nextstop", ["NEXT STOP: MOON", "THEN WE WILL SEE"], {
                background: 0x141820,
                color: 0xffd166,
                accent: 0xff8f5a,
            }),
            12,
            5,
            [0, groundHeightAt(0, STAND_Z - 9) + 6.4, STAND_Z - 9],
            0,
            { roughness: 0.6, metalness: 0.2, emissive: 0xffd166, emissiveIntensity: 0.5 }
        );
        this.scene.add(sign);

        for (const dx of [-5, 5]) {
            const post = this.mesh(new THREE.CylinderGeometry(0.16, 0.2, 8, 8), steel, [dx, groundHeightAt(dx, STAND_Z - 9) + 4, STAND_Z - 9]);
            this.scene.add(post);
        }
    }

    private buildSmoke() {
        const sprite = steamSprite(this.bin, this.random);

        for (let i = 0; i < SMOKE_COUNT; i++) {
            const material = this.bin.material(new THREE.SpriteMaterial({
                map: sprite,
                color: 0xd8dee8,
                transparent: true,
                opacity: 0,
                depthWrite: false,
                fog: true,
            }));

            const puff = new THREE.Sprite(material);
            puff.scale.setScalar(10);
            puff.position.set(0, PAD_DECK_Y, 0);
            this.scene.add(puff);
            this.smoke.push(puff);

            this.smokeSeeds.push({
                angle: this.random() * Math.PI * 2,
                speed: 5 + this.random() * 11,
                rise: 1.4 + this.random() * 4,
                size: 8 + this.random() * 12,
            });
        }

        const haze = new THREE.Mesh(
            this.bin.geometry(new THREE.PlaneGeometry(90, 90)),
            this.bin.material(new THREE.MeshBasicMaterial({
                map: glowSprite(this.bin, 0xffb45a),
                transparent: true,
                opacity: 0,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                toneMapped: false,
            }))
        );
        haze.rotation.x = -Math.PI / 2;
        haze.position.set(0, PAD_DECK_Y + 0.3, 0);
        this.scene.add(haze);
        this.launchHaze = haze;
    }

    private buildCrowd() {
        const specs: CrowdSpec[] = [];
        const rocketLook = new THREE.Vector3(0, PAD_DECK_Y + 16, 0);

        for (let row = 0; row < 4; row++) {
            for (let i = 0; i < 9; i++) {
                if (row === 0 && Math.abs(i - 4) < 2) continue;
                const x = -11 + i * 2.75 + (row % 2) * 0.7;
                const z = STAND_Z - row * 1.5 - 0.5;
                specs.push({
                    position: new THREE.Vector3(x, groundHeightAt(0, STAND_Z) + 0.74 + row * 0.7, z),
                    set: "crowd",
                    lookAt: rocketLook,
                    pose: i % 3 === 0 ? "gawk" : i % 3 === 1 ? "cheer" : "salute",
                    held: i % 4 === 0 ? "bag" : undefined,
                    phase: this.random() * 9,
                    solid: false,
                });
            }
        }

        const techs: Array<[number, number, "work" | "gawk"]> = [
            [-16, -14, "work"],
            [12, -16, "work"],
            [18, 10, "gawk"],
            [-19, 8, "work"],
        ];

        for (const [x, z, pose] of techs) {
            specs.push({
                position: new THREE.Vector3(x, groundHeightAt(x, z), z),
                set: "spacer",
                lookAt: rocketLook,
                pose,
                held: pose === "work" ? "wrench" : undefined,
                phase: this.random() * 9,
            });
        }

        const walkers: Array<[number, number, number, number]> = [
            [-40, -52, -14, -44],
            [34, -50, 8, -40],
            [-52, -20, -48, -44],
        ];

        for (const [x1, z1, x2, z2] of walkers) {
            specs.push({
                position: new THREE.Vector3(x1, groundHeightAt(x1, z1), z1),
                set: "spacer",
                walk: {
                    path: [
                        new THREE.Vector3(x1, groundHeightAt(x1, z1), z1),
                        new THREE.Vector3(x2, groundHeightAt(x2, z2), z2),
                    ],
                    mode: "pingpong",
                    pause: 2 + this.random() * 3,
                    speed: 0.9 + this.random() * 0.3,
                },
                held: this.random() < 0.4 ? "bag" : undefined,
                phase: this.random() * 9,
            });
        }

        for (let i = 0; i < 5; i++) {
            const angle = -1.3 + i * 0.36;
            const x = Math.cos(angle) * (FENCE_RADIUS - 5);
            const z = Math.sin(angle) * (FENCE_RADIUS - 5);
            specs.push({
                position: new THREE.Vector3(x, groundHeightAt(x, z), z),
                set: "crowd",
                lookAt: rocketLook,
                pose: i % 2 === 0 ? "gawk" : "cheer",
                phase: this.random() * 9,
            });
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

    public setCount(value: number): void {
        for (let i = 0; i < this.countBoards.length; i++) {
            this.countBoards[i].visible = i === value - 1;
        }
    }

    public setBlast(amount: number): void {
        this.blast = amount;
        this.rocket?.setBlast(amount);
    }

    public setLift(amount: number): void {
        this.lift = amount;
    }

    public setCharts(mood: ChartMood): void {
        this.rocket?.setChartMood(mood);
    }

    public setFlood(amount: number): void {
        this.flood = amount;
    }

    public requestTransfer(): void {
        if (this.transferred || isCinemaActive()) return;
        this.transferred = true;
        this.pendingTeleport = MOON_SURFACE_ID;
    }

    public cageObject(): THREE.Object3D {
        return this.tower!.cage;
    }

    public cabinObject(): THREE.Object3D {
        return this.rocket!.cabin;
    }

    public getDirectedScene(): DirectedScene | null {
        const timeline = this.service?.getTimeline();
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
        return this.service?.getTimeline().isPaused() ? 0 : 1;
    }

    protected tick(delta: number): void {
        this.sky?.update(delta);
        this.perimeter?.update(this.elapsed);
        this.tower?.update(this.elapsed);
        this.service?.update(delta);
        this.rocket?.update(delta);

        if (this.rocket) {
            const height = this.lift * this.lift * LIFT_CURVE;
            this.rocket.group.position.y = ROCKET_BASE.y + height;
            this.rocket.group.rotation.z = -this.lift * this.lift * 0.34;
            this.rocket.group.position.x = ROCKET_BASE.x + this.lift * this.lift * 96;
            this.rocket.setVents(this.lift < 0.01);
        }

        const pulse = 0.55 + Math.sin(this.elapsed * 7) * 0.25;
        for (let i = 0; i < this.beacons.length; i++) {
            this.beacons[i].opacity = i % 2 === 0 ? pulse : 1 - pulse;
        }

        for (let i = 0; i < this.sirenLights.length; i++) {
            this.sirenLights[i].intensity = 6 + (i % 2 === 0 ? pulse : 1 - pulse) * 16;
        }

        for (let i = 0; i < this.floodLights.length; i++) {
            this.floodLights[i].intensity = 34 + this.flood * 54 + Math.sin(this.elapsed * 2 + i) * 3;
        }

        for (let i = 0; i < this.floodCones.length; i++) {
            (this.floodCones[i].material as THREE.MeshBasicMaterial).opacity = 0.02 + this.flood * 0.05;
        }

        if (this.launchGlow) {
            this.launchGlow.intensity = this.blast * (420 + Math.sin(this.elapsed * 12) * 90);
            this.launchGlow.position.y = ROCKET_BASE.y + this.lift * this.lift * LIFT_CURVE + 1;
            this.launchGlow.position.x = ROCKET_BASE.x + this.lift * this.lift * 96;
        }

        for (let i = 0; i < this.smoke.length; i++) {
            const seed = this.smokeSeeds[i];
            const sprite = this.smoke[i];
            const life = (this.elapsed * 0.34 + i / this.smoke.length) % 1;
            const spread = life * seed.speed;

            sprite.position.set(
                Math.cos(seed.angle) * spread,
                PAD_DECK_Y + 1 + life * seed.rise + spread * 0.12,
                Math.sin(seed.angle) * spread
            );
            sprite.scale.setScalar(seed.size * (0.3 + life * 1.5));
            (sprite.material as THREE.SpriteMaterial).opacity = this.blast * 0.5 * (1 - life) * (1 - life * 0.3);
        }

        for (let i = 0; i < this.vents.length; i++) {
            const t = (this.elapsed * 0.3 + i * 0.3) % 1;
            this.vents[i].scale.setScalar(0.5 + t * 1.6);
            (this.vents[i].material as THREE.MeshBasicMaterial).opacity = 0.16 * (1 - t);
        }

        if (this.launchHaze) {
            (this.launchHaze.material as THREE.MeshBasicMaterial).opacity = this.blast * 0.5;
        }
    }

    dispose(): void {
        this.sky?.dispose();
        this.ground?.dispose();
        this.perimeter?.dispose();
        this.tower?.dispose();
        this.rocket?.dispose();
        this.service?.dispose();
        if (this.surfaces) disposeLaunchSurfaces(this.surfaces);

        this.scene.environment = null;
        this.environment?.dispose();
        this.environment = null;

        this.sky = null;
        this.ground = null;
        this.perimeter = null;
        this.tower = null;
        this.rocket = null;
        this.service = null;
        this.surfaces = null;
        this.countBoards = [];
        this.floodLights = [];
        this.floodCones = [];
        this.beacons = [];
        this.smoke = [];
        this.smokeSeeds = [];
        this.vents = [];
        this.launchHaze = null;
        this.sirenLights = [];
        this.launchGlow = null;

        super.dispose();
    }
}
