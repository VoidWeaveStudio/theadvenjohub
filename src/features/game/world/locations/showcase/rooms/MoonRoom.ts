// src/features/game/world/locations/showcase/rooms/MoonRoom.ts
import * as THREE from "three";
import { ShowcaseRoom } from "../ShowcaseRoom";
import { ResourceManager } from "../../../../core/ResourceManager";
import { SHOWCASE_INFO_BY_ID, ShowcaseInfo } from "../config";
import { CrowdSpec } from "../actors/ShowcaseCrowd";
import type { ShowcaseActor } from "../actors/ShowcaseActor";
import type { EmblemKind } from "../textures";
import { createNpcNameTag } from "../../../../entities/npcNameTag";

const SURFACE_RADIUS = 78;
const ROCKET_POSITION = new THREE.Vector3(14, 0, 26);
const FLAG_POSITION = new THREE.Vector3(-7, 0, 1);
const DUST_COUNT = 240;
const MINE_CENTER = new THREE.Vector3(-40, 0, 26);
const FLAG_FIELD = new THREE.Vector3(-12, 0, 14);
const CONTROL_CENTER = new THREE.Vector3(34, 0, 10);
const SOLAR_CENTER = new THREE.Vector3(46, 0, 36);
const SCOPE_CENTER = new THREE.Vector3(-30, 0, -26);
const CONSOLE_SPOT = new THREE.Vector3(0, 0, 20);

export class MoonRoom extends ShowcaseRoom {
    private mineBeacon: THREE.Mesh | null = null;
    private drill: THREE.Object3D | null = null;
    private oreNuggets: THREE.Mesh[] = [];
    private flags: THREE.Group[] = [];
    private controlScreen: THREE.Mesh | null = null;
    private dish: THREE.Object3D | null = null;
    private solarPanels: THREE.Mesh[] = [];
    private telescope: THREE.Object3D | null = null;
    private rocket: THREE.Group | null = null;
    private exhaustCore: THREE.Mesh | null = null;
    private launchButton: THREE.Mesh | null = null;
    private countdown: THREE.Group[] = [];
    private launchLift = 0;
    private launchBlast = 0;
    private exhaust: THREE.Mesh | null = null;
    private exhaustLight: THREE.PointLight | null = null;
    private steamPuffs: THREE.Mesh[] = [];
    private padLights: THREE.PointLight[] = [];
    private padBulbs: THREE.MeshBasicMaterial[] = [];
    private dust: THREE.Points | null = null;
    private stars: THREE.Points | null = null;
    private earth: THREE.Object3D | null = null;
    private flagCloth: THREE.Mesh | null = null;
    private roverWheels: THREE.Object3D[] = [];
    private controlDish: THREE.Object3D | null = null;

    constructor(info: ShowcaseInfo = SHOWCASE_INFO_BY_ID.get("show-moon") as ShowcaseInfo) {
        super(info, 0x4fc1d7, 76);
        this.exitPosition.set(0, 0, -40);
        this.exitFacing = 0;
        this.spawnPosition.set(0, 0, -32);
    }

    protected buildAtmosphere(): void {
        this.scene.background = new THREE.Color(0x03040a);
        this.scene.fog = null;

        this.scene.add(new THREE.AmbientLight(0x2c3444, 0.55));
        this.scene.add(new THREE.HemisphereLight(0x44506b, 0x0a0c12, 0.45));

        const sun = new THREE.DirectionalLight(0xffffff, 2.6);
        sun.position.set(70, 46, -60);
        sun.target.position.set(0, 0, 8);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
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

        const earthBounce = new THREE.DirectionalLight(0x5a8fd8, 0.4);
        earthBounce.position.set(-40, 50, 70);
        this.scene.add(earthBounce);

        this.buildStars();
        this.buildEarth();
    }

    private buildStars() {
        const count = 1400;
        const positions = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            const theta = this.random() * Math.PI * 2;
            const phi = Math.acos(this.random() * 0.9);
            const radius = 300;
            positions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
            positions[i * 3 + 1] = Math.cos(phi) * radius;
            positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
        }

        const geometry = this.bin.geometry(new THREE.BufferGeometry());
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        const material = this.bin.material(new THREE.PointsMaterial({
            color: 0xffffff,
            size: 1.4,
            sizeAttenuation: false,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
            toneMapped: false,
            fog: false,
        }));

        const points = new THREE.Points(geometry, material);
        points.frustumCulled = false;
        this.scene.add(points);
        this.stars = points;
    }

    private buildEarth() {
        const group = new THREE.Group();
        group.position.set(-58, 96, 150);

        const globe = this.mesh(
            new THREE.SphereGeometry(26, 36, 24),
            this.bin.material(new THREE.MeshStandardMaterial({
                color: 0x2f6ad8,
                emissive: 0x14305f,
                emissiveIntensity: 0.9,
                roughness: 0.85,
                metalness: 0,
                fog: false,
            })),
            [0, 0, 0]
        );
        globe.castShadow = false;
        globe.receiveShadow = false;
        group.add(globe);

        for (let i = 0; i < 7; i++) {
            const land = this.mesh(
                new THREE.SphereGeometry(26.15, 14, 10, this.random() * Math.PI * 2, 0.5 + this.random() * 0.6, this.random() * 1.4, 0.4 + this.random() * 0.5),
                this.bin.material(new THREE.MeshStandardMaterial({
                    color: 0x4f9f52,
                    emissive: 0x1f4f28,
                    emissiveIntensity: 0.6,
                    roughness: 0.9,
                    fog: false,
                })),
                [0, 0, 0]
            );
            land.castShadow = false;
            group.add(land);
        }

        const clouds = this.mesh(
            new THREE.SphereGeometry(26.8, 26, 18),
            this.bin.material(new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.18,
                fog: false,
                toneMapped: false,
            })),
            [0, 0, 0]
        );
        clouds.castShadow = false;
        group.add(clouds);

        const halo = this.mesh(new THREE.SphereGeometry(29, 24, 16), this.glow(0x6fa8ff, 0.12), [0, 0, 0]);
        halo.castShadow = false;
        group.add(halo);

        this.scene.add(group);
        this.earth = group;
    }

    protected decorate(rm: ResourceManager): void {
        this.buildSurface();
        this.buildRocket();
        this.buildPad();
        this.buildHabitat();
        this.buildMine();
        this.buildFlagField();
        this.buildControl();
        this.buildSolarFarm();
        this.buildTelescope();
        this.buildLaunchConsole(rm);
        this.buildRover();
        this.buildFlag();
        this.buildArrow();
        this.buildDust();
        this.buildCrowd();
    }

    private buildSurface() {
        const regolith = this.textured(this.tex.regolith(30, 0x7d7a76), { roughness: 0.99, metalness: 0.02, bump: 0.08 });
        const regolithDark = this.textured(this.tex.regolith(4, 0x615f5c), { roughness: 0.99, metalness: 0.02, bump: 0.08 });

        const ground = this.mesh(new THREE.CircleGeometry(SURFACE_RADIUS + 40, 64), regolith, [0, 0, 0], [-Math.PI / 2, 0, 0]);
        ground.castShadow = false;
        this.scene.add(ground);

        for (let i = 0; i < 34; i++) {
            const angle = this.random() * Math.PI * 2;
            const distance = 10 + this.random() * (SURFACE_RADIUS + 20);
            const radius = 2 + this.random() * 8;
            const x = Math.cos(angle) * distance;
            const z = Math.sin(angle) * distance;

            const bowl = this.mesh(new THREE.CircleGeometry(radius, 20), regolithDark, [x, 0.03, z], [-Math.PI / 2, 0, 0]);
            bowl.castShadow = false;
            this.scene.add(bowl);

            const lip = this.mesh(new THREE.TorusGeometry(radius, radius * 0.12, 6, 18), regolith, [x, 0.08, z], [-Math.PI / 2, 0, 0]);
            lip.receiveShadow = true;
            this.scene.add(lip);
        }

        const rockGeometry = this.bin.geometry(new THREE.DodecahedronGeometry(1, 0));
        const rocks = new THREE.InstancedMesh(rockGeometry, regolithDark, 160);
        rocks.castShadow = true;
        rocks.receiveShadow = true;

        const matrix = new THREE.Matrix4();
        const quaternion = new THREE.Quaternion();
        const euler = new THREE.Euler();
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3();

        for (let i = 0; i < 160; i++) {
            const angle = this.random() * Math.PI * 2;
            const distance = 6 + this.random() * (SURFACE_RADIUS + 24);
            const size = 0.3 + this.random() * 1.8;
            position.set(Math.cos(angle) * distance, size * 0.3, Math.sin(angle) * distance);
            euler.set(this.random() * 3, this.random() * 3, this.random() * 3);
            quaternion.setFromEuler(euler);
            scale.set(size, size * 0.72, size);
            matrix.compose(position, quaternion, scale);
            rocks.setMatrixAt(i, matrix);
        }

        rocks.instanceMatrix.needsUpdate = true;
        this.scene.add(rocks);

        this.collisionGrid.insertRingWall(SURFACE_RADIUS, 2, 0, 8);
    }

    private buildRocket() {
        const hull = this.textured(this.tex.panel([4, 6], 0xe8edf5, 0x9aa2ae, 3), { roughness: 0.42, metalness: 0.38, bump: 0.03 });
        const trim = this.textured(this.tex.stripes([4, 1], 0xd94f4f, 0xf2f2f2, 8), { roughness: 0.5, metalness: 0.3 });
        const dark = this.matte(0x2a3038, 0.6, 0.5);

        const rocket = new THREE.Group();
        this.rocket = rocket;
        rocket.position.copy(ROCKET_POSITION);

        const body = this.mesh(new THREE.CylinderGeometry(2.4, 2.7, 26, 20), hull, [0, 14.5, 0]);
        rocket.add(body);

        const band = this.mesh(new THREE.CylinderGeometry(2.75, 2.75, 1.6, 20), trim, [0, 9, 0]);
        rocket.add(band);

        const band2 = this.mesh(new THREE.CylinderGeometry(2.55, 2.55, 1.2, 20), trim, [0, 21, 0]);
        rocket.add(band2);

        const nose = this.mesh(new THREE.ConeGeometry(2.4, 7.4, 20), hull, [0, 31.2, 0]);
        rocket.add(nose);

        const tip = this.mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.4, 6), dark, [0, 36, 0]);
        rocket.add(tip);

        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const fin = this.mesh(
                new THREE.BoxGeometry(0.55, 6.4, 3.6),
                trim,
                [Math.cos(angle) * 3, 3.6, Math.sin(angle) * 3],
                [0, -angle, 0]
            );
            rocket.add(fin);
        }

        const skirt = this.mesh(new THREE.CylinderGeometry(2.7, 3.4, 2.4, 20), dark, [0, 1.2, 0]);
        rocket.add(skirt);

        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2;
            const nozzle = this.mesh(
                new THREE.ConeGeometry(0.85, 2.2, 12, 1, true),
                dark,
                [Math.cos(angle) * 1.3, 0.3, Math.sin(angle) * 1.3],
                [Math.PI, 0, 0]
            );
            rocket.add(nozzle);
        }

        const window = this.mesh(new THREE.CircleGeometry(0.8, 16), this.glow(0x9ee6ff, 0.9), [0, 24.5, 2.42]);
        window.castShadow = false;
        rocket.add(window);

        const flameGeometry = new THREE.ConeGeometry(2.5, 9, 20, 1, true);
        flameGeometry.rotateX(Math.PI);
        flameGeometry.translate(0, -4.5, 0);

        this.exhaust = this.mesh(flameGeometry, this.glow(0xffb45a, 0.5), [0, 0.2, 0]);
        this.exhaust.castShadow = false;
        rocket.add(this.exhaust);

        const coreGeometry = new THREE.ConeGeometry(1.3, 6, 16, 1, true);
        coreGeometry.rotateX(Math.PI);
        coreGeometry.translate(0, -3, 0);

        this.exhaustCore = this.mesh(coreGeometry, this.glow(0xfff3c4, 0.85), [0, 0.2, 0]);
        this.exhaustCore.castShadow = false;
        rocket.add(this.exhaustCore);

        this.exhaustLight = new THREE.PointLight(0xffa14a, 70, 50, 2);
        this.exhaustLight.position.set(0, 1, 0);
        rocket.add(this.exhaustLight);

        this.scene.add(rocket);
        this.collisionGrid.insertCylinder(new THREE.Vector3(ROCKET_POSITION.x, 6, ROCKET_POSITION.z), 3.6, 12);
    }

    private buildPad() {
        const steel = this.metal(0x6a7078, 0.55, 0.7);
        const deck = this.matte(0x4a5058, 0.8, 0.3);

        const pad = this.mesh(new THREE.CylinderGeometry(11, 12.5, 1.2, 32), deck, [ROCKET_POSITION.x, 0.6, ROCKET_POSITION.z]);
        this.scene.add(pad);
        this.collisionGrid.insertCylinder(new THREE.Vector3(ROCKET_POSITION.x, 0.6, ROCKET_POSITION.z), 12.5, 1.2);

        const trench = this.mesh(new THREE.RingGeometry(3.8, 6.4, 32), this.matte(0x2a2e34, 0.9), [ROCKET_POSITION.x, 1.22, ROCKET_POSITION.z], [-Math.PI / 2, 0, 0]);
        trench.castShadow = false;
        this.scene.add(trench);

        const tower = new THREE.Group();
        tower.position.set(ROCKET_POSITION.x - 7.5, 0, ROCKET_POSITION.z - 1);

        for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]] as Array<[number, number]>) {
            const leg = this.mesh(new THREE.BoxGeometry(0.4, 32, 0.4), steel, [dx, 16, dz]);
            tower.add(leg);
        }

        for (let level = 0; level < 9; level++) {
            const platform = this.mesh(new THREE.BoxGeometry(3.6, 0.2, 3.6), steel, [0, 3.6 + level * 3.4, 0]);
            tower.add(platform);

            for (const [ax, az] of [[0, -1.7], [0, 1.7], [-1.7, 0], [1.7, 0]] as Array<[number, number]>) {
                const brace = this.mesh(new THREE.BoxGeometry(az === 0 ? 0.2 : 3.4, 0.2, az === 0 ? 3.4 : 0.2), steel, [ax, 5 + level * 3.4, az]);
                tower.add(brace);
            }
        }

        const arm = this.mesh(new THREE.BoxGeometry(6.4, 0.4, 1.4), steel, [3.6, 22, 0]);
        tower.add(arm);

        const arm2 = this.mesh(new THREE.BoxGeometry(6, 0.4, 1.2), steel, [3.4, 12, 0]);
        tower.add(arm2);

        this.scene.add(tower);
        this.collisionGrid.insertOrientedBox(ROCKET_POSITION.x - 7.5, ROCKET_POSITION.z - 1, 3.8, 3.8, 0, 0, 32);

        for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2;
            const material = this.glow(i % 2 === 0 ? 0xff4a4a : 0xffd166, 0.9);
            this.padBulbs.push(material);

            const bulb = this.mesh(
                new THREE.SphereGeometry(0.28, 8, 6),
                material,
                [ROCKET_POSITION.x + Math.cos(angle) * 12, 1.5, ROCKET_POSITION.z + Math.sin(angle) * 12]
            );
            bulb.castShadow = false;
            this.scene.add(bulb);

            if (i % 3 === 0) {
                const light = new THREE.PointLight(i % 2 === 0 ? 0xff4a4a : 0xffd166, 14, 18, 2);
                light.position.set(ROCKET_POSITION.x + Math.cos(angle) * 12, 2, ROCKET_POSITION.z + Math.sin(angle) * 12);
                this.scene.add(light);
                this.padLights.push(light);
            }
        }

        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + 0.4;
            const puff = this.mesh(
                new THREE.SphereGeometry(1.6 + this.random() * 1.2, 12, 8),
                this.glow(0xdfe9f5, 0.22, false),
                [ROCKET_POSITION.x + Math.cos(angle) * 9, 1.4, ROCKET_POSITION.z + Math.sin(angle) * 9]
            );
            puff.castShadow = false;
            this.scene.add(puff);
            this.steamPuffs.push(puff);
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
            [-26, 8, 7],
            [-34, -6, 5.4],
            [-18, -14, 6.2],
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

        for (let i = 0; i < 4; i++) {
            const panel = new THREE.Group();
            panel.position.set(-44 + i * 6, 0, 16);
            panel.rotation.y = -0.4;

            const pole = this.mesh(new THREE.CylinderGeometry(0.14, 0.18, 3, 8), shellDark, [0, 1.5, 0]);
            panel.add(pole);

            const array = this.mesh(
                new THREE.BoxGeometry(4.4, 0.16, 2.6),
                this.bin.material(new THREE.MeshStandardMaterial({
                    color: 0x24407a,
                    emissive: 0x0f2a5a,
                    emissiveIntensity: 0.6,
                    roughness: 0.25,
                    metalness: 0.7,
                })),
                [0, 3.1, 0],
                [-0.6, 0, 0]
            );
            panel.add(array);

            this.scene.add(panel);
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

    private buildMine() {
        const steel = this.textured(this.tex.panel([2, 1], 0x8a8f98, 0x4a4f58, 3), { roughness: 0.55, metalness: 0.62, bump: 0.05 });
        const rust = this.textured(this.tex.dirt(2, 0x6b5a48, 0x9a8a70), { roughness: 0.92, metalness: 0.12, bump: 0.06 });
        const ore = this.lit(0x7ce8ff, 0.85);

        const group = new THREE.Group();
        group.position.copy(MINE_CENTER);
        group.rotation.y = -0.6;

        const pit = this.mesh(new THREE.CylinderGeometry(9, 7.4, 1.6, 26), rust, [0, -0.6, 0]);
        pit.receiveShadow = true;
        group.add(pit);

        const rim = this.mesh(new THREE.TorusGeometry(9, 0.6, 8, 28), rust, [0, 0.1, 0], [-Math.PI / 2, 0, 0]);
        group.add(rim);

        for (let leg = 0; leg < 4; leg++) {
            const angle = (leg / 4) * Math.PI * 2 + Math.PI / 4;
            const post = this.mesh(new THREE.CylinderGeometry(0.28, 0.4, 9, 8), steel, [Math.cos(angle) * 3.4, 4.5, Math.sin(angle) * 3.4], [Math.sin(angle) * 0.14, 0, -Math.cos(angle) * 0.14]);
            group.add(post);
        }

        const head = this.mesh(new THREE.BoxGeometry(4.4, 1.6, 4.4), steel, [0, 9.4, 0]);
        group.add(head);

        const mast = this.mesh(new THREE.CylinderGeometry(0.34, 0.34, 6, 10), steel, [0, 12.8, 0]);
        group.add(mast);

        const beacon = this.mesh(new THREE.SphereGeometry(0.42, 10, 8), this.glow(0xff5a4a, 0.9), [0, 16, 0]);
        beacon.castShadow = false;
        group.add(beacon);
        this.mineBeacon = beacon;

        const drill = new THREE.Group();
        drill.position.set(0, 4.4, 0);
        const shaft = this.mesh(new THREE.CylinderGeometry(0.5, 0.5, 9, 10), steel, [0, 0, 0]);
        drill.add(shaft);
        for (let i = 0; i < 3; i++) {
            const flute = this.mesh(new THREE.BoxGeometry(1.5, 0.3, 0.3), steel, [0, -3.6 + i * 1.1, 0], [0, i * 1.1, 0]);
            drill.add(flute);
        }
        const bit = this.mesh(new THREE.ConeGeometry(0.8, 1.6, 10), steel, [0, -5.2, 0], [Math.PI, 0, 0]);
        drill.add(bit);
        group.add(drill);
        this.drill = drill;

        const glowPit = this.mesh(new THREE.CircleGeometry(2.4, 24), this.glow(0x7ce8ff, 0.5), [0, 0.22, 0], [-Math.PI / 2, 0, 0]);
        glowPit.castShadow = false;
        group.add(glowPit);

        const pitLight = new THREE.PointLight(0x7ce8ff, 30, 20, 2);
        pitLight.position.set(0, 1.6, 0);
        group.add(pitLight);

        for (let i = 0; i < 9; i++) {
            const angle = this.random() * Math.PI * 2;
            const distance = 10 + this.random() * 5;
            const crate = this.mesh(
                new THREE.BoxGeometry(1.5, 1.2, 1.5),
                steel,
                [Math.cos(angle) * distance, 0.6, Math.sin(angle) * distance],
                [0, this.random() * Math.PI, 0]
            );
            group.add(crate);

            const lid = this.mesh(new THREE.BoxGeometry(1.2, 0.18, 1.2), ore, [Math.cos(angle) * distance, 1.26, Math.sin(angle) * distance], [0, this.random() * Math.PI, 0]);
            lid.castShadow = false;
            group.add(lid);
        }

        const conveyor = new THREE.Group();
        conveyor.position.set(11, 0, 0);
        const belt = this.mesh(new THREE.BoxGeometry(14, 0.4, 1.8), steel, [0, 2.4, 0], [0, 0, -0.12]);
        conveyor.add(belt);
        for (let i = 0; i < 6; i++) {
            const leg = this.mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.6 + i * 0.3, 6), steel, [-6 + i * 2.5, (2.6 + i * 0.3) / 2, 0]);
            conveyor.add(leg);
        }
        for (let i = 0; i < 7; i++) {
            const nugget = this.mesh(new THREE.DodecahedronGeometry(0.3, 0), ore, [-6 + i * 2, 2.8 + i * 0.24, 0]);
            nugget.castShadow = false;
            conveyor.add(nugget);
            this.oreNuggets.push(nugget);
        }
        group.add(conveyor);

        const sign = this.board(
            this.tex.sign("mine", ["$MOON MINE", "PROOF OF SHOVEL"], { background: 0x1c2028, color: 0xbfe6ff, accent: 0x7ce8ff }),
            6,
            3,
            [-10.5, 3.4, 0],
            -Math.PI / 2,
            { roughness: 0.6, metalness: 0.3, emissive: 0x7ce8ff, emissiveIntensity: 0.5 }
        );
        group.add(sign);

        for (const dz of [-3, 3]) {
            const post = this.mesh(new THREE.CylinderGeometry(0.16, 0.2, 4, 8), steel, [-10.5, 2, dz]);
            group.add(post);
        }

        this.scene.add(group);
        this.collisionGrid.insertCylinder(new THREE.Vector3(MINE_CENTER.x, 1, MINE_CENTER.z), 9.4, 2);
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

            const cairn = this.mesh(new THREE.DodecahedronGeometry(0.7, 0), this.textured(this.tex.regolith(1, 0x6b6864), { roughness: 0.98, metalness: 0.02 }), [x, 0.3, z + 0.6]);
            this.scene.add(cairn);
        }

        const plaque = this.board(
            this.tex.sign("moonclaim", ["WE ARE EARLY", "CLAIMED IN THE NAME OF THE BAGS"], { background: 0x1c2028, color: 0xbfe6ff, accent: 0x6f8fb8 }),
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

    private buildTelescope() {
        const frame = this.metal(0xa8b2c0, 0.36, 0.78);
        const dark = this.matte(0x2a3038, 0.6, 0.5);

        const group = new THREE.Group();
        group.position.copy(SCOPE_CENTER);

        const deck = this.mesh(new THREE.CylinderGeometry(5, 5.6, 1, 22), this.textured(this.tex.panel([2, 1], 0x9aa2ae, 0x565c66, 3), { roughness: 0.6, metalness: 0.5, bump: 0.04 }), [0, 0.5, 0]);
        deck.receiveShadow = true;
        group.add(deck);
        this.collisionGrid.insertCylinder(new THREE.Vector3(SCOPE_CENTER.x, 0.5, SCOPE_CENTER.z), 5.4, 1);

        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            if (angle > 1.6 && angle < 2.6) continue;
            const post = this.mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 6), frame, [Math.cos(angle) * 4.8, 1.55, Math.sin(angle) * 4.8]);
            group.add(post);
        }

        const rail = this.mesh(new THREE.TorusGeometry(4.8, 0.07, 6, 30), frame, [0, 2.1, 0], [-Math.PI / 2, 0, 0]);
        group.add(rail);

        const mount = this.mesh(new THREE.CylinderGeometry(0.5, 0.8, 1.6, 12), frame, [0, 1.8, 0]);
        group.add(mount);

        const scope = new THREE.Group();
        scope.position.set(0, 2.6, 0);
        const tube = this.mesh(new THREE.CylinderGeometry(0.55, 0.7, 4.6, 14), frame, [0, 0, 0], [0, 0, 0]);
        scope.add(tube);
        const lens = this.mesh(new THREE.CircleGeometry(0.54, 16), this.glow(0xbfe6ff, 0.7), [0, 2.32, 0], [-Math.PI / 2, 0, 0]);
        lens.castShadow = false;
        scope.add(lens);
        const finder = this.mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.4, 8), dark, [0.7, 0.9, 0]);
        scope.add(finder);
        scope.rotation.set(-0.9, 0.4, 0.5);
        group.add(scope);
        this.telescope = scope;

        this.scene.add(group);
    }

    private buildLaunchConsole(rm: ResourceManager) {
        const steel = this.textured(this.tex.panel([2, 1], 0x8a8f98, 0x4a4f58, 3), { roughness: 0.5, metalness: 0.66, bump: 0.04 });
        const dark = this.matte(0x2a3038, 0.6, 0.5);

        const group = new THREE.Group();
        group.position.copy(CONSOLE_SPOT);
        group.rotation.y = Math.PI;

        const base = this.mesh(new THREE.BoxGeometry(2.6, 1.1, 1.6), steel, [0, 0.55, 0]);
        group.add(base);

        const desk = this.mesh(new THREE.BoxGeometry(2.8, 0.22, 1.5), steel, [0, 1.2, 0.1], [0.24, 0, 0]);
        group.add(desk);

        const collar = this.mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.18, 18), dark, [0, 1.32, 0.16]);
        group.add(collar);

        const button = this.mesh(new THREE.SphereGeometry(0.42, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), this.lit(0xff3a2a, 1.1), [0, 1.36, 0.16]);
        group.add(button);
        this.launchButton = button;

        const guard = this.mesh(new THREE.TorusGeometry(0.62, 0.07, 8, 20), steel, [0, 1.36, 0.16], [Math.PI / 2, 0, 0]);
        group.add(guard);

        const plate = this.board(
            this.tex.sign("launch", ["LAUNCH", "TO THE MOON"], { background: 0x1c2028, color: 0xff8f5a, accent: 0xffd166 }),
            2.4,
            1.2,
            [0, 2.35, 0],
            0,
            { roughness: 0.6, metalness: 0.3, emissive: 0xff5a4a, emissiveIntensity: 0.6 }
        );
        group.add(plate);

        for (const dx of [-1.1, 1.1]) {
            const post = this.mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.4, 8), steel, [dx, 1.2, -0.3]);
            group.add(post);
        }

        this.scene.add(group);
        this.collisionGrid.insertOrientedBox(CONSOLE_SPOT.x, CONSOLE_SPOT.z, 2.8, 1.8, Math.PI, 0, 1.3);

        const labels = ["3", "2", "1", "LIFTOFF"];
        for (let i = 0; i < labels.length; i++) {
            const panel = this.board(
                this.tex.sign(`count${labels[i]}`, [labels[i]], { background: 0x140d18, color: 0xffd166, accent: 0xff5a4a }),
                5,
                3,
                [CONSOLE_SPOT.x, 6.4, CONSOLE_SPOT.z - 5],
                0,
                { roughness: 0.4, metalness: 0.2, emissive: 0xffd166, emissiveIntensity: 1.2 }
            );
            panel.visible = false;
            this.scene.add(panel);
            this.countdown.push(panel);
        }

        for (const dx of [-2.2, 2.2]) {
            const mast = this.mesh(new THREE.CylinderGeometry(0.12, 0.16, 5.4, 8), steel, [CONSOLE_SPOT.x + dx, 2.7, CONSOLE_SPOT.z - 5]);
            this.scene.add(mast);
        }

        const operator = this.crowd.createActor(rm, {
            position: new THREE.Vector3(CONSOLE_SPOT.x, 0, CONSOLE_SPOT.z - 8),
            set: "spacer",
            variantIndex: 0,
            facing: 0,
            phase: 0.7,
            solid: false,
        }, this.collisionGrid);

        if (!operator) return;

        const shout = this.bubble("SEND IT", "#ffd166", { width: 2.4, tone: "shout", y: 2.7, speaker: operator });
        operator.group.add(shout);

        const pressSpot = new THREE.Vector3(CONSOLE_SPOT.x, 0, CONSOLE_SPOT.z - 1.6);
        const restSpot = new THREE.Vector3(CONSOLE_SPOT.x, 0, CONSOLE_SPOT.z - 8);
        const show = (index: number) => {
            for (let i = 0; i < this.countdown.length; i++) this.countdown[i].visible = i === index;
        };

        this.addStory([
            {
                duration: 7,
                enter: () => {
                    show(-1);
                    shout.visible = false;
                    this.launchLift = 0;
                    this.launchBlast = 0;
                    operator.setPose(undefined);
                    operator.moveTo(restSpot.x, 0, restSpot.z);
                    operator.setDestination(pressSpot, 1.2);
                    if (this.rocket) {
                        this.rocket.position.copy(ROCKET_POSITION);
                        this.rocket.visible = true;
                    }
                },
            },
            {
                duration: 1.6,
                enter: () => {
                    operator.setDestination(null);
                    operator.setFacing(0);
                    operator.setPose("point");
                    show(0);
                },
            },
            { duration: 1.4, enter: () => show(1) },
            { duration: 1.4, enter: () => show(2) },
            {
                duration: 2,
                enter: () => {
                    show(3);
                    shout.visible = true;
                    operator.setPose("hail");
                    this.launchBlast = 1;
                },
            },
            {
                duration: 11,
                enter: () => {
                    shout.visible = false;
                },
                update: (elapsed) => {
                    const t = Math.min(1, elapsed / 10);
                    this.launchLift = t * t * 240;
                    this.launchBlast = 1 - t * 0.4;
                    if (this.rocket) this.rocket.position.y = ROCKET_POSITION.y + this.launchLift;
                },
            },
            {
                duration: 6,
                enter: () => {
                    show(-1);
                    this.launchBlast = 0;
                    this.launchLift = 0;
                    if (this.rocket) this.rocket.visible = false;
                    operator.setPose(undefined);
                    operator.setDestination(restSpot, 1.2);
                },
            },
        ]);
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

    private buildArrow() {
        const material = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0xbfe6ff,
            emissive: 0x4f9fd8,
            emissiveIntensity: 1.4,
            roughness: 0.3,
            metalness: 0.4,
        }));

        const group = new THREE.Group();
        group.position.set(-22, 0, 34);
        group.rotation.y = -0.6;

        const segments = 16;
        for (let i = 0; i < segments; i++) {
            const t = i / segments;
            const x = -14 + t * 28;
            const y = 2 + Math.pow(t, 1.7) * 26;
            const size = 1.3 - t * 0.5;

            const block = this.mesh(new THREE.BoxGeometry(size * 1.5, size, size), material, [x, y, 0], [0, 0, t * 0.9]);
            block.castShadow = false;
            group.add(block);
        }

        const head = this.mesh(new THREE.ConeGeometry(2.6, 4.4, 4), material, [14.6, 30, 0], [0, Math.PI / 4, -0.85]);
        head.castShadow = false;
        group.add(head);

        const light = new THREE.PointLight(0x6fc4ff, 40, 50, 2);
        light.position.set(6, 20, 0);
        group.add(light);

        this.scene.add(group);
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
            color: 0xd8d2c8,
            size: 0.14,
            transparent: true,
            opacity: 0.55,
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

        const padCrew: Array<[number, number, "work" | "gawk" | "haggle"]> = [
            [ROCKET_POSITION.x - 16, ROCKET_POSITION.z + 6, "work"],
            [ROCKET_POSITION.x - 15, ROCKET_POSITION.z - 8, "work"],
            [ROCKET_POSITION.x + 16, ROCKET_POSITION.z - 6, "gawk"],
            [ROCKET_POSITION.x + 13, ROCKET_POSITION.z + 12, "haggle"],
        ];

        for (const [x, z, pose] of padCrew) {
            specs.push({
                position: new THREE.Vector3(x, 0, z),
                set: "spacer",
                lookAt: new THREE.Vector3(ROCKET_POSITION.x, 10, ROCKET_POSITION.z),
                pose,
                held: pose === "work" ? "wrench" : undefined,
                phase: this.random() * 9,
            });
        }

        for (let i = 0; i < 4; i++) {
            specs.push({
                position: new THREE.Vector3(-16 + i * 7, 0, -6 + (i % 2) * 4),
                set: "spacer",
                lookAt: new THREE.Vector3(-58, 96, 150),
                pose: i % 2 === 0 ? "gawk" : "cheer",
                phase: this.random() * 9,
            });
        }

        const walkers: Array<[number, number, number, number]> = [
            [6, -34, 6, -16],
            [6, -26, 26, -8],
            [-40, -18, -10, -24],
            [24, -6, 24, -24],
            [2, -30, 2, 6],
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

        specs.push({
            position: new THREE.Vector3(-6.2, 0, -14.4),
            set: "spacer",
            variantIndex: 2,
            facing: 0.7,
            pose: "work",
            held: "wrench",
            phase: 5,
        });

        for (let i = 0; i < 5; i++) {
            const angle = -0.4 + i * 0.7;
            specs.push({
                position: new THREE.Vector3(
                    MINE_CENTER.x + Math.cos(angle) * (10.5 + (i % 2) * 2),
                    0,
                    MINE_CENTER.z + Math.sin(angle) * (10.5 + (i % 2) * 2)
                ),
                set: "spacer",
                lookAt: new THREE.Vector3(MINE_CENTER.x, 3, MINE_CENTER.z),
                pose: i % 2 === 0 ? "work" : "carry",
                held: i % 2 === 0 ? "wrench" : "bag",
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

        for (let i = 0; i < 3; i++) {
            const angle = 2.2 + i * 0.5;
            specs.push({
                position: new THREE.Vector3(
                    SCOPE_CENTER.x + Math.cos(angle) * 3.2,
                    1,
                    SCOPE_CENTER.z + Math.sin(angle) * 3.2
                ),
                set: "spacer",
                lookAt: new THREE.Vector3(-58, 96, 150),
                pose: i === 0 ? "work" : "gawk",
                phase: this.random() * 9,
                solid: false,
            });
        }

        this.crowd.addMany(specs);
    }

    protected tick(delta: number): void {
        const pulse = 0.55 + Math.sin(this.elapsed * 8) * 0.2;

        if (this.drill) {
            this.drill.rotation.y += delta * 2.4;
            this.drill.position.y = 4.4 + Math.sin(this.elapsed * 0.8) * 0.5;
        }

        if (this.mineBeacon) {
            (this.mineBeacon.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.abs(Math.sin(this.elapsed * 2.2)) * 0.6;
        }

        for (let i = 0; i < this.oreNuggets.length; i++) {
            this.oreNuggets[i].rotation.x += delta * 1.4;
            this.oreNuggets[i].position.y += Math.sin(this.elapsed * 2 + i) * delta * 0.1;
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

        if (this.telescope) {
            this.telescope.rotation.y = 0.4 + Math.sin(this.elapsed * 0.3) * 0.25;
        }

        if (this.launchButton) {
            const material = this.launchButton.material as THREE.MeshStandardMaterial;
            material.emissiveIntensity = 0.8 + Math.abs(Math.sin(this.elapsed * 2.4)) * 0.8;
        }

        const flicker = 1 + Math.sin(this.elapsed * 13) * 0.12;
        const heat = (0.1 + this.launchBlast * 0.95) * flicker;

        if (this.exhaust) {
            const material = this.exhaust.material as THREE.MeshBasicMaterial;
            material.opacity = 0.2 + this.launchBlast * 0.42;
            this.exhaust.scale.set(0.55 + this.launchBlast * 0.5, heat, 0.55 + this.launchBlast * 0.5);
            this.exhaust.visible = this.launchBlast > 0.02;
        }

        if (this.exhaustCore) {
            const material = this.exhaustCore.material as THREE.MeshBasicMaterial;
            material.opacity = 0.45 + this.launchBlast * 0.45;
            this.exhaustCore.scale.set(0.5 + this.launchBlast * 0.45, heat * 1.1, 0.5 + this.launchBlast * 0.45);
            this.exhaustCore.visible = this.launchBlast > 0.02;
        }

        if (this.exhaustLight) {
            this.exhaustLight.intensity = (60 + Math.sin(this.elapsed * 11) * 26) * (1 + this.launchBlast * 2.2);
        }

        for (let i = 0; i < this.steamPuffs.length; i++) {
            const puff = this.steamPuffs[i];
            const t = (this.elapsed * 0.35 + i * 0.17) % 1;
            puff.position.y = 1.2 + t * 7;
            puff.scale.setScalar(0.6 + t * 1.8);
            (puff.material as THREE.MeshBasicMaterial).opacity = 0.24 * (1 - t);
        }

        for (let i = 0; i < this.padBulbs.length; i++) {
            this.padBulbs[i].opacity = i % 2 === 0 ? pulse : 1 - pulse;
        }

        for (let i = 0; i < this.padLights.length; i++) {
            this.padLights[i].intensity = 10 + (i % 2 === 0 ? pulse : 1 - pulse) * 12;
        }

        if (this.earth) {
            this.earth.rotation.y += delta * 0.012;
        }

        if (this.dish) {
            this.dish.rotation.y = Math.sin(this.elapsed * 0.12) * 0.7;
        }

        if (this.flagCloth) {
            this.flagCloth.rotation.y = Math.sin(this.elapsed * 0.8) * 0.12;
            this.flagCloth.rotation.z = Math.sin(this.elapsed * 1.3) * 0.05;
        }

        for (let i = 0; i < this.roverWheels.length; i++) {
            this.roverWheels[i].rotation.y += delta * 0.2;
        }

        if (this.stars) {
            (this.stars.material as THREE.PointsMaterial).opacity = 0.75 + Math.sin(this.elapsed * 0.6) * 0.12;
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
}
