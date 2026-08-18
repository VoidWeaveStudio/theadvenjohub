// src/features/game/world/locations/events/systems/LobbyShell.ts
import * as THREE from "three";
import { CollisionGrid } from "../../../CollisionGrid";
import { AssetBin } from "../../../AssetBin";
import { EditorSky } from "../../../building/EditorSky";
import {
    createBronzeMaterial,
    createGildedMaterial,
    createLimestoneMaterial,
    createPaleMarbleMaterial,
    createDomeGlassMaterial,
    makeRandom,
} from "../lobbyTextures";
import {
    BAY_COUNT,
    CLERESTORY_HEIGHT,
    COLUMN_HEIGHT,
    COLUMN_RING_RADIUS,
    COLUMN_SHAFT_RADIUS,
    CORNICE_HEIGHT,
    DOME_BASE_Y,
    DOME_HEIGHT,
    HALL_RADIUS,
    WALL_HEIGHT,
    WALL_THICKNESS,
    bayAngle,
    isLowEndDevice,
    placeOnRing,
} from "../lobbyLayout";

const SUN_ELEVATION = THREE.MathUtils.degToRad(34);
const SUN_AZIMUTH = THREE.MathUtils.degToRad(118);

const WAINSCOT_HEIGHT = 3.6;
const WINDOW_COUNT = BAY_COUNT;

export interface ShellMaterials {
    marble: THREE.MeshStandardMaterial;
    limestone: THREE.MeshStandardMaterial;
    gilded: THREE.MeshStandardMaterial;
    bronze: THREE.MeshStandardMaterial;
}

export class LobbyShell {
    private readonly random = makeRandom(0x3f9a21);

    private sky: EditorSky | null = null;
    private shafts: THREE.Mesh[] = [];
    private windowGlow: THREE.MeshBasicMaterial | null = null;
    private elapsed = 0;

    public readonly sunDirection = new THREE.Vector3();
    public materials!: ShellMaterials;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly collisionGrid: CollisionGrid,
        private readonly bin: AssetBin
    ) { }

    create(): ShellMaterials {
        this.materials = {
            marble: createPaleMarbleMaterial(this.bin, this.random),
            limestone: createLimestoneMaterial(this.bin, this.random),
            gilded: createGildedMaterial(this.bin),
            bronze: createBronzeMaterial(this.bin),
        };

        this.buildSky();
        this.buildFloor();
        this.buildWall();
        this.buildColonnade();
        this.buildCornice();
        this.buildClerestory();
        this.buildDome();

        return this.materials;
    }

    private buildSky() {
        this.sunDirection.set(
            Math.cos(SUN_ELEVATION) * Math.sin(SUN_AZIMUTH),
            Math.sin(SUN_ELEVATION),
            Math.cos(SUN_ELEVATION) * Math.cos(SUN_AZIMUTH)
        );

        const sky = new EditorSky();
        sky.name = "lobby-sky";
        sky.scale.setScalar(12000);
        sky.renderOrder = -1000;
        sky.frustumCulled = false;

        const uniforms = sky.material.uniforms;
        uniforms.turbidity.value = 4.2;
        uniforms.rayleigh.value = 1.6;
        uniforms.mieCoefficient.value = 0.004;
        uniforms.mieDirectionalG.value = 0.8;
        uniforms.sunPosition.value.copy(this.sunDirection).multiplyScalar(1000);
        uniforms.cloudScale.value = 0.0026;
        uniforms.cloudSpeed.value = 0.00005;
        uniforms.cloudCoverage.value = 0.42;
        uniforms.cloudDensity.value = 0.7;
        uniforms.cloudElevation.value = 0.55;
        uniforms.showSunDisc.value = 1;

        this.scene.add(sky);
        this.sky = sky;
    }

    private buildFloor() {
        const floor = new THREE.Mesh(new THREE.CircleGeometry(HALL_RADIUS + WALL_THICKNESS, 128), this.materials.marble);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        floor.matrixAutoUpdate = false;
        floor.updateMatrix();
        this.scene.add(floor);

        const inlay = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x1f3a34,
            roughness: 0.22,
            metalness: 0.24,
            envMapIntensity: 1.2,
        }));

        for (const [inner, outer] of [[19.4, 20.6], [37, 38.4], [HALL_RADIUS - 5.2, HALL_RADIUS - 4.2]] as const) {
            const band = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 128), inlay);
            band.rotation.x = -Math.PI / 2;
            band.position.y = 0.012;
            band.receiveShadow = false;
            band.matrixAutoUpdate = false;
            band.updateMatrix();
            this.scene.add(band);
        }

        for (const radius of [20, 37.7, HALL_RADIUS - 4.7]) {
            const trim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.1, 6, 128), this.materials.gilded);
            trim.rotation.x = Math.PI / 2;
            trim.position.y = 0.03;
            trim.matrixAutoUpdate = false;
            trim.updateMatrix();
            this.scene.add(trim);
        }

        const rayGeometry = this.bin.geometry(new THREE.BoxGeometry(0.5, 0.06, HALL_RADIUS - 24));
        for (let i = 0; i < BAY_COUNT; i++) {
            const angle = bayAngle(i);
            const ray = new THREE.Mesh(rayGeometry, this.materials.gilded);
            placeOnRing(ray, angle, 20 + (HALL_RADIUS - 24) / 2 + 2, 0.03);
            ray.matrixAutoUpdate = false;
            ray.updateMatrix();
            this.scene.add(ray);
        }
    }

    private buildWall() {
        const wall = new THREE.Mesh(
            new THREE.CylinderGeometry(
                HALL_RADIUS + WALL_THICKNESS,
                HALL_RADIUS + WALL_THICKNESS,
                WALL_HEIGHT,
                96,
                1,
                true
            ),
            this.materials.limestone
        );
        wall.position.y = WALL_HEIGHT / 2;
        wall.receiveShadow = true;
        wall.matrixAutoUpdate = false;
        wall.updateMatrix();
        this.scene.add(wall);

        const wainscot = new THREE.Mesh(
            new THREE.CylinderGeometry(HALL_RADIUS + 0.1, HALL_RADIUS + 0.1, WAINSCOT_HEIGHT, 96, 1, true),
            this.bin.material(new THREE.MeshStandardMaterial({
                color: 0x2c4a44,
                roughness: 0.26,
                metalness: 0.2,
                side: THREE.BackSide,
                envMapIntensity: 1.1,
            }))
        );
        wainscot.position.y = WAINSCOT_HEIGHT / 2;
        wainscot.matrixAutoUpdate = false;
        wainscot.updateMatrix();
        this.scene.add(wainscot);

        const capRail = new THREE.Mesh(
            new THREE.TorusGeometry(HALL_RADIUS + 0.05, 0.16, 6, 128),
            this.materials.gilded
        );
        capRail.rotation.x = Math.PI / 2;
        capRail.position.y = WAINSCOT_HEIGHT;
        capRail.matrixAutoUpdate = false;
        capRail.updateMatrix();
        this.scene.add(capRail);

        this.collisionGrid.insertRingWall(
            HALL_RADIUS + WALL_THICKNESS / 2,
            WALL_THICKNESS / 2 + 0.6,
            0,
            WALL_HEIGHT + CORNICE_HEIGHT
        );
    }

    private buildColonnade() {
        const shaft = this.bin.geometry(
            new THREE.CylinderGeometry(COLUMN_SHAFT_RADIUS * 0.86, COLUMN_SHAFT_RADIUS, COLUMN_HEIGHT, 20, 1, false)
        );
        const flute = this.bin.geometry(new THREE.BoxGeometry(0.16, COLUMN_HEIGHT - 1.2, 0.16));
        const base = this.bin.geometry(new THREE.CylinderGeometry(COLUMN_SHAFT_RADIUS * 1.32, COLUMN_SHAFT_RADIUS * 1.5, 1.1, 20));
        const necking = this.bin.geometry(new THREE.TorusGeometry(COLUMN_SHAFT_RADIUS * 0.92, 0.14, 6, 20));
        const capital = this.bin.geometry(new THREE.CylinderGeometry(COLUMN_SHAFT_RADIUS * 1.62, COLUMN_SHAFT_RADIUS * 0.95, 1.5, 20));
        const abacus = this.bin.geometry(new THREE.BoxGeometry(4.2, 0.5, 4.2));

        for (let i = 0; i < BAY_COUNT; i++) {
            const angle = bayAngle(i) + Math.PI / BAY_COUNT;
            const group = new THREE.Group();
            placeOnRing(group, angle, COLUMN_RING_RADIUS);

            const plinth = new THREE.Mesh(base, this.materials.marble);
            plinth.position.y = 0.55;
            plinth.castShadow = true;
            plinth.receiveShadow = true;
            group.add(plinth);

            const body = new THREE.Mesh(shaft, this.materials.limestone);
            body.position.y = 1.1 + COLUMN_HEIGHT / 2;
            body.castShadow = true;
            body.receiveShadow = true;
            group.add(body);

            for (let f = 0; f < 12; f++) {
                const a = (f / 12) * Math.PI * 2;
                const groove = new THREE.Mesh(flute, this.materials.limestone);
                groove.position.set(
                    Math.cos(a) * COLUMN_SHAFT_RADIUS * 0.94,
                    1.1 + COLUMN_HEIGHT / 2,
                    Math.sin(a) * COLUMN_SHAFT_RADIUS * 0.94
                );
                groove.rotation.y = -a;
                group.add(groove);
            }

            const ring = new THREE.Mesh(necking, this.materials.gilded);
            ring.rotation.x = Math.PI / 2;
            ring.position.y = 1.1 + COLUMN_HEIGHT - 0.4;
            group.add(ring);

            const cap = new THREE.Mesh(capital, this.materials.gilded);
            cap.position.y = 1.1 + COLUMN_HEIGHT + 0.75;
            cap.castShadow = true;
            group.add(cap);

            const top = new THREE.Mesh(abacus, this.materials.marble);
            top.position.y = 1.1 + COLUMN_HEIGHT + 1.75;
            top.castShadow = true;
            group.add(top);

            this.scene.add(group);

            this.collisionGrid.insertCylinder(
                new THREE.Vector3(group.position.x, COLUMN_HEIGHT / 2, group.position.z),
                COLUMN_SHAFT_RADIUS * 1.5,
                COLUMN_HEIGHT + 4
            );
        }
    }

    private buildCornice() {
        const corniceY = WALL_HEIGHT + CORNICE_HEIGHT / 2;

        const cornice = new THREE.Mesh(
            new THREE.CylinderGeometry(HALL_RADIUS + WALL_THICKNESS + 1.2, HALL_RADIUS + WALL_THICKNESS, CORNICE_HEIGHT, 96, 1, true),
            this.materials.marble
        );
        cornice.position.y = corniceY;
        cornice.matrixAutoUpdate = false;
        cornice.updateMatrix();
        this.scene.add(cornice);

        for (const y of [WALL_HEIGHT - 0.1, WALL_HEIGHT + CORNICE_HEIGHT]) {
            const bead = new THREE.Mesh(
                new THREE.TorusGeometry(HALL_RADIUS + WALL_THICKNESS + 0.7, 0.22, 6, 128),
                this.materials.gilded
            );
            bead.rotation.x = Math.PI / 2;
            bead.position.y = y;
            bead.matrixAutoUpdate = false;
            bead.updateMatrix();
            this.scene.add(bead);
        }

        const dentil = this.bin.geometry(new THREE.BoxGeometry(0.9, 0.5, 0.6));
        for (let i = 0; i < 96; i++) {
            const angle = (i / 96) * Math.PI * 2;
            const block = new THREE.Mesh(dentil, this.materials.marble);
            placeOnRing(block, angle, HALL_RADIUS + WALL_THICKNESS + 0.55, WALL_HEIGHT + 0.55);
            block.matrixAutoUpdate = false;
            block.updateMatrix();
            this.scene.add(block);
        }
    }

    private buildClerestory() {
        const baseY = WALL_HEIGHT + CORNICE_HEIGHT;
        const drum = new THREE.Mesh(
            new THREE.CylinderGeometry(HALL_RADIUS + WALL_THICKNESS, HALL_RADIUS + WALL_THICKNESS, CLERESTORY_HEIGHT, 96, 1, true),
            this.materials.limestone
        );
        drum.position.y = baseY + CLERESTORY_HEIGHT / 2;
        drum.matrixAutoUpdate = false;
        drum.updateMatrix();
        this.scene.add(drum);

        this.windowGlow = this.bin.material(new THREE.MeshBasicMaterial({
            color: 0xfff3d8,
            transparent: true,
            opacity: 0.92,
            side: THREE.DoubleSide,
            toneMapped: false,
            fog: false,
        }));

        const paneGeometry = this.bin.geometry(new THREE.PlaneGeometry(9.5, CLERESTORY_HEIGHT - 2));
        const mullionGeometry = this.bin.geometry(new THREE.BoxGeometry(0.28, CLERESTORY_HEIGHT - 2, 0.4));
        const archGeometry = this.bin.geometry(new THREE.TorusGeometry(4.75, 0.34, 8, 22, Math.PI));

        for (let i = 0; i < WINDOW_COUNT; i++) {
            const angle = bayAngle(i) + Math.PI / BAY_COUNT;
            const group = new THREE.Group();
            placeOnRing(group, angle, HALL_RADIUS + WALL_THICKNESS - 0.35, baseY + CLERESTORY_HEIGHT / 2);

            const pane = new THREE.Mesh(paneGeometry, this.windowGlow);
            group.add(pane);

            for (const offset of [-3.2, 0, 3.2]) {
                const mullion = new THREE.Mesh(mullionGeometry, this.materials.gilded);
                mullion.position.set(offset, 0, 0.22);
                group.add(mullion);
            }

            const arch = new THREE.Mesh(archGeometry, this.materials.gilded);
            arch.position.set(0, (CLERESTORY_HEIGHT - 2) / 2, 0.24);
            group.add(arch);

            this.scene.add(group);
        }

        if (!isLowEndDevice()) this.buildShafts(baseY);
    }

    private buildShafts(baseY: number) {
        const geometry = this.bin.geometry(new THREE.PlaneGeometry(11, baseY - 1));
        const material = this.bin.material(new THREE.MeshBasicMaterial({
            color: 0xfff1cf,
            transparent: true,
            opacity: 0.055,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            toneMapped: false,
            fog: false,
        }));

        for (let i = 0; i < WINDOW_COUNT; i++) {
            const angle = bayAngle(i) + Math.PI / BAY_COUNT;
            const shaft = new THREE.Mesh(geometry, material);
            placeOnRing(shaft, angle, HALL_RADIUS - 8, (baseY - 1) / 2 + 0.5);
            shaft.rotateX(THREE.MathUtils.degToRad(21));
            shaft.renderOrder = 6;
            shaft.frustumCulled = false;
            this.scene.add(shaft);
            this.shafts.push(shaft);
        }
    }

    private buildDome() {
        const radius = HALL_RADIUS + WALL_THICKNESS;
        const squash = DOME_HEIGHT / radius;

        const shell = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 72, 32, 0, Math.PI * 2, 0, Math.PI / 2),
            createDomeGlassMaterial(this.bin)
        );
        shell.position.y = DOME_BASE_Y;
        shell.scale.y = squash;
        shell.matrixAutoUpdate = false;
        shell.updateMatrix();
        this.scene.add(shell);

        const ribGeometry = this.bin.geometry(new THREE.TorusGeometry(radius - 0.25, 0.3, 6, 48, Math.PI));
        for (let i = 0; i < 10; i++) {
            const rib = new THREE.Mesh(ribGeometry, this.materials.gilded);
            rib.position.y = DOME_BASE_Y;
            rib.scale.y = squash;
            rib.rotation.y = (i / 10) * Math.PI;
            rib.matrixAutoUpdate = false;
            rib.updateMatrix();
            this.scene.add(rib);
        }

        for (const fraction of [0.4, 0.75]) {
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(radius * Math.sqrt(1 - fraction * fraction), 0.24, 6, 96),
                this.materials.gilded
            );
            ring.rotation.x = Math.PI / 2;
            ring.position.y = DOME_BASE_Y + DOME_HEIGHT * fraction;
            ring.matrixAutoUpdate = false;
            ring.updateMatrix();
            this.scene.add(ring);
        }

        const oculusRadius = 7.4;
        const oculusY = DOME_BASE_Y + DOME_HEIGHT * Math.sqrt(1 - (oculusRadius / radius) ** 2) - 0.4;

        const oculus = new THREE.Mesh(
            new THREE.CircleGeometry(oculusRadius, 48),
            this.bin.material(new THREE.MeshBasicMaterial({
                color: 0xfff8e6,
                transparent: true,
                opacity: 0.85,
                side: THREE.DoubleSide,
                toneMapped: false,
                fog: false,
            }))
        );
        oculus.rotation.x = Math.PI / 2;
        oculus.position.y = oculusY;
        this.scene.add(oculus);

        const collar = new THREE.Mesh(new THREE.TorusGeometry(oculusRadius, 0.4, 8, 48), this.materials.gilded);
        collar.rotation.x = Math.PI / 2;
        collar.position.y = oculusY;
        this.scene.add(collar);

        const lantern = new THREE.PointLight(0xfff2d6, 70, 130, 2);
        lantern.position.y = oculusY - 2;
        this.scene.add(lantern);
    }

    update(delta: number) {
        this.elapsed += delta;
        if (this.sky) this.sky.material.uniforms.time.value = this.elapsed;

        if (this.windowGlow) {
            this.windowGlow.opacity = 0.88 + Math.sin(this.elapsed * 0.5) * 0.05;
        }

        for (let i = 0; i < this.shafts.length; i++) {
            const material = this.shafts[i].material as THREE.MeshBasicMaterial;
            material.opacity = 0.05 + Math.sin(this.elapsed * 0.35 + i) * 0.014;
        }
    }

    setShaftsVisible(visible: boolean) {
        for (const shaft of this.shafts) shaft.visible = visible;
    }

    dispose() {
        if (this.sky) {
            this.scene.remove(this.sky);
            this.sky.geometry.dispose();
            this.sky.material.dispose();
            this.sky = null;
        }
        this.shafts = [];
        this.windowGlow = null;
    }
}
