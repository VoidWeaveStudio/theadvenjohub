// src/features/game/world/locations/showcase/rooms/MoonRoom.ts
import * as THREE from "three";
import { ShowcaseRoom } from "../ShowcaseRoom";
import { ResourceManager } from "../../../../core/ResourceManager";
import { SHOWCASE_INFO_BY_ID, ShowcaseInfo } from "../config";
import { CrowdSpec } from "../actors/ShowcaseCrowd";
import { createNpcNameTag } from "../../../../entities/npcNameTag";

const SURFACE_RADIUS = 78;
const ROCKET_POSITION = new THREE.Vector3(14, 0, 26);
const FLAG_POSITION = new THREE.Vector3(-7, 0, 1);
const DUST_COUNT = 240;

export class MoonRoom extends ShowcaseRoom {
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
    private dish: THREE.Object3D | null = null;

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

    protected decorate(_rm: ResourceManager): void {
        this.buildSurface();
        this.buildRocket();
        this.buildPad();
        this.buildHabitat();
        this.buildRover();
        this.buildFlag();
        this.buildArrow();
        this.buildDust();
        this.buildCrowd();
    }

    private buildSurface() {
        const regolith = this.matte(0x7d7a76, 0.99, 0.02);
        const regolithDark = this.matte(0x615f5c, 0.99, 0.02);

        const ground = this.mesh(new THREE.CircleGeometry(SURFACE_RADIUS + 40, 64), regolith, [0, 0, 0], [-Math.PI / 2, 0, 0]);
        ground.castShadow = false;
        this.scene.add(ground);

        for (let i = 0; i < 34; i++) {
            const angle = this.random() * Math.PI * 2;
            const distance = 10 + this.random() * (SURFACE_RADIUS + 20);
            const radius = 2 + this.random() * 8;
            const x = Math.cos(angle) * distance;
            const z = Math.sin(angle) * distance;

            const bowl = this.mesh(new THREE.CircleGeometry(radius, 20), regolithDark, [x, 0.01, z], [-Math.PI / 2, 0, 0]);
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
        const hull = this.matte(0xe8edf5, 0.42, 0.35);
        const trim = this.matte(0xd94f4f, 0.5, 0.3);
        const dark = this.matte(0x2a3038, 0.6, 0.5);

        const rocket = new THREE.Group();
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

        this.exhaust = this.mesh(
            new THREE.ConeGeometry(3.1, 9, 18, 1, true),
            this.glow(0xffb45a, 0.55),
            [0, -3.4, 0],
            [Math.PI, 0, 0]
        );
        this.exhaust.castShadow = false;
        rocket.add(this.exhaust);

        this.exhaustLight = new THREE.PointLight(0xffa14a, 70, 50, 2);
        this.exhaustLight.position.set(0, 1, 0);
        rocket.add(this.exhaustLight);

        const tag = createNpcNameTag("$MOON — T-00:09", "#bfe6ff");
        tag.position.set(0, 40, 0);
        tag.scale.set(10, 2.5, 1);
        rocket.add(tag);

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
        const shell = this.matte(0xd8dee8, 0.6, 0.2);
        const shellDark = this.matte(0xa8b2c0, 0.7, 0.25);
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
            [ROCKET_POSITION.x - 13, ROCKET_POSITION.z + 4, "work"],
            [ROCKET_POSITION.x - 11.5, ROCKET_POSITION.z - 5, "work"],
            [ROCKET_POSITION.x + 12, ROCKET_POSITION.z - 3, "gawk"],
            [ROCKET_POSITION.x + 9, ROCKET_POSITION.z + 9, "haggle"],
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
            [-30, 14, -6, -12],
            [6, -26, 26, -8],
            [-40, -18, -10, -24],
            [30, 12, 4, 34],
            [-2, -30, -2, 12],
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

        this.crowd.addMany(specs);
    }

    protected tick(delta: number): void {
        const pulse = 0.55 + Math.sin(this.elapsed * 8) * 0.2;

        if (this.exhaust) {
            const material = this.exhaust.material as THREE.MeshBasicMaterial;
            material.opacity = 0.35 + Math.sin(this.elapsed * 13) * 0.16;
            this.exhaust.scale.y = 0.85 + Math.sin(this.elapsed * 9) * 0.18;
        }

        if (this.exhaustLight) {
            this.exhaustLight.intensity = 60 + Math.sin(this.elapsed * 11) * 26;
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
