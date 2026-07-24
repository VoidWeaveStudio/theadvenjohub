// src/features/game/world/locations/token-gates/TokenCanyon.ts
import * as THREE from "three";
import { Location } from "../../Location";
import { ResourceManager } from "../../../core/ResourceManager";
import { CollisionGrid } from "../../CollisionGrid";
import { getGateConfig } from "./GateRegistry";

const SPAWN_POINT = new THREE.Vector3(0, 2, -40);
const CRYSTAL_POSITION = new THREE.Vector3(0, 1.5, 44);
const CANYON_HALF_LENGTH = 100;
const CANYON_HALF_WIDTH = 100;

function mulberry32(seed: number) {
    return function () {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function hashString(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h;
}

export class TokenCanyon extends Location {
    private canyonCrystal!: THREE.Group;
    private sunLight!: THREE.DirectionalLight;
    private gateId: string;
    public collisionGrid: CollisionGrid;

    constructor(locationId: string, gateId: string) {
        const config = getGateConfig(gateId);
        super(locationId, config?.name || 'Open World Canyon');
        this.gateId = gateId;
        this.collisionGrid = new CollisionGrid(250);
    }

    create(resourceManager: ResourceManager): void {
        const config = getGateConfig(this.gateId);
        const isCustom = config?.id === 'token-gate-01' || this.gateId === 'open-world-canyon';
        const rand = mulberry32(hashString(this.gateId));

        const hue = isCustom ? 8 : 34 + (hashString(this.gateId) % 18);
        const wallBaseColor = new THREE.Color().setHSL(hue / 360, 0.55, isCustom ? 0.32 : 0.42);
        const wallAccentColor = new THREE.Color().setHSL(hue / 360, 0.5, isCustom ? 0.22 : 0.3);
        const sandColor = new THREE.Color().setHSL((hue + 6) / 360, 0.5, 0.55);

        this.createSky(hue, isCustom);
        this.createLighting(isCustom);

        const fogColor = new THREE.Color().setHSL((hue + 4) / 360, 0.45, isCustom ? 0.45 : 0.72);
        this.scene.fog = new THREE.FogExp2(fogColor, 0.0055);
        (this.scene.background as any) = fogColor;

        this.createFloor(sandColor, rand);
        this.createWalls(wallBaseColor, wallAccentColor, rand);
        this.createReturnCrystal();
    }

    private createSky(hue: number, isCustom: boolean) {
        const skyGeo = new THREE.SphereGeometry(400, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2 + 0.05);
        const zenith = new THREE.Color().setHSL(isCustom ? 0.02 : 0.58, isCustom ? 0.35 : 0.55, isCustom ? 0.35 : 0.55);
        const horizon = new THREE.Color().setHSL((hue + 8) / 360, 0.6, 0.82);

        const positions = skyGeo.attributes.position;
        const colors: number[] = [];
        const tmp = new THREE.Vector3();
        for (let i = 0; i < positions.count; i++) {
            tmp.fromBufferAttribute(positions, i);
            const t = THREE.MathUtils.clamp(tmp.y / 400, 0, 1);
            const c = horizon.clone().lerp(zenith, Math.pow(t, 0.55));
            colors.push(c.r, c.g, c.b);
        }
        skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const skyMat = new THREE.MeshBasicMaterial({
            vertexColors: true,
            side: THREE.BackSide,
            fog: false,
            depthWrite: false,
        });
        const sky = new THREE.Mesh(skyGeo, skyMat);
        sky.renderOrder = -10;
        this.scene.add(sky);

        const sunDir = new THREE.Vector3(60, 140, -60).normalize().multiplyScalar(350);
        const sunCore = new THREE.Mesh(
            new THREE.SphereGeometry(14, 24, 24),
            new THREE.MeshBasicMaterial({ color: isCustom ? 0xffcf9e : 0xfff6df, fog: false })
        );
        sunCore.position.copy(sunDir);
        this.scene.add(sunCore);

        const sunGlow = new THREE.Mesh(
            new THREE.SphereGeometry(34, 24, 24),
            new THREE.MeshBasicMaterial({
                color: isCustom ? 0xff9d5c : 0xffe9b0,
                transparent: true,
                opacity: 0.35,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                fog: false,
            })
        );
        sunGlow.position.copy(sunDir);
        this.scene.add(sunGlow);
    }

    private createLighting(isCustom: boolean) {
        const skyColor = isCustom ? 0xffb27a : 0xbcd4f0;
        const groundColor = isCustom ? 0x5a2a1a : 0xcfa15c;
        this.scene.add(new THREE.HemisphereLight(skyColor, groundColor, 0.75));

        const sun = new THREE.DirectionalLight(isCustom ? 0xffb37a : 0xfff1d0, 1.35);
        sun.position.set(60, 140, -60);
        sun.target.position.set(0, 0, 0);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.left = -120;
        sun.shadow.camera.right = 120;
        sun.shadow.camera.top = 120;
        sun.shadow.camera.bottom = -120;
        sun.shadow.camera.near = 10;
        sun.shadow.camera.far = 400;
        sun.shadow.bias = -0.0015;
        this.scene.add(sun);
        this.scene.add(sun.target);
        this.sunLight = sun;

        const fill = new THREE.AmbientLight(0xffddaa, 0.18);
        this.scene.add(fill);
    }

    private createFloor(sandColor: THREE.Color, rand: () => number) {
        const width = CANYON_HALF_WIDTH * 2;
        const length = CANYON_HALF_LENGTH * 2;
        const floorGeo = new THREE.PlaneGeometry(width, length, 32, 120);
        floorGeo.rotateX(-Math.PI / 2);

        const pos = floorGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            const bump =
                Math.sin(x * 0.35 + rand() * 0.001) * 0.06 +
                Math.sin(z * 0.12 + x * 0.05) * 0.12;
            pos.setY(i, bump);
        }
        floorGeo.computeVertexNormals();

        const floorMat = new THREE.MeshStandardMaterial({
            color: sandColor,
            roughness: 0.95,
            metalness: 0.0,
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.receiveShadow = true;
        this.scene.add(floor);

        this.collisionGrid.insert(new THREE.Box3(
            new THREE.Vector3(-CANYON_HALF_WIDTH, -1, -CANYON_HALF_LENGTH),
            new THREE.Vector3(CANYON_HALF_WIDTH, 0, CANYON_HALF_LENGTH)
        ));
    }

    private createWalls(baseColor: THREE.Color, accentColor: THREE.Color, rand: () => number) {
        const sides: Array<-1 | 1> = [-1, 1];
        const segmentDepth = 5;
        const segments = Math.ceil((CANYON_HALF_LENGTH * 2) / segmentDepth);
        const baseHeight = 32;

        sides.forEach((side) => {
            const group = new THREE.Group();

            for (let i = 0; i < segments; i++) {
                const z = -CANYON_HALF_LENGTH + i * segmentDepth + segmentDepth / 2;
                const height = baseHeight + rand() * 14 - 4;
                const jitter = rand() * 2.2;
                const depthVariance = segmentDepth + rand() * 1.5;
                const thickness = 3 + rand() * 2;

                const mat = new THREE.MeshStandardMaterial({
                    color: baseColor.clone().lerp(accentColor, rand()),
                    roughness: 0.92 + rand() * 0.06,
                    metalness: 0.0,
                });
                const chunk = new THREE.Mesh(
                    new THREE.BoxGeometry(thickness, height, depthVariance),
                    mat
                );
                const xBase = side * (CANYON_HALF_WIDTH + thickness / 2);
                chunk.position.set(xBase - side * jitter, height / 2, z);
                chunk.rotation.y = (rand() - 0.5) * 0.06;
                chunk.castShadow = true;
                chunk.receiveShadow = true;
                group.add(chunk);

                if (rand() > 0.82) {
                    const spireHeight = 10 + rand() * 16;
                    const spire = new THREE.Mesh(
                        new THREE.ConeGeometry(2 + rand() * 1.5, spireHeight, 6),
                        mat
                    );
                    spire.position.set(chunk.position.x, height + spireHeight / 2 - 2, z);
                    spire.castShadow = true;
                    group.add(spire);
                }
            }

            this.scene.add(group);
        });

        this.collisionGrid.insert(new THREE.Box3(
            new THREE.Vector3(-CANYON_HALF_WIDTH - 6, 0, -CANYON_HALF_LENGTH),
            new THREE.Vector3(-CANYON_HALF_WIDTH, 45, CANYON_HALF_LENGTH)
        ));
        this.collisionGrid.insert(new THREE.Box3(
            new THREE.Vector3(CANYON_HALF_WIDTH, 0, -CANYON_HALF_LENGTH),
            new THREE.Vector3(CANYON_HALF_WIDTH + 6, 45, CANYON_HALF_LENGTH)
        ));
    }

    private createReturnCrystal() {
        const group = new THREE.Group();
        const core = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.8, 1),
            new THREE.MeshStandardMaterial({ color: 0x66ccff, emissive: 0x3399ff, emissiveIntensity: 2 })
        );
        const shell = new THREE.Mesh(
            new THREE.OctahedronGeometry(1.5, 1),
            new THREE.MeshPhysicalMaterial({ color: 0x99ddff, transmission: 1, opacity: 0.6, transparent: true, roughness: 0, thickness: 0.5 })
        );
        const light = new THREE.PointLight(0x66ccff, 7, 20);
        light.position.set(0, 1.5, 0);
        group.add(core, shell, light);
        group.position.copy(CRYSTAL_POSITION);
        group.userData.interactionId = "tower-crystal";
        this.scene.add(group);
        this.canyonCrystal = group;
        this.collisionGrid.insert(new THREE.Box3().setFromObject(group));
    }

    update(playerPosition: THREE.Vector3, delta: number) {
        if (this.canyonCrystal) {
            const t = performance.now() * 0.002;
            this.canyonCrystal.rotation.y += delta * 0.6;
            this.canyonCrystal.position.y = CRYSTAL_POSITION.y + Math.sin(t) * 0.2;
        }
    }

    getSpawnPoint(): THREE.Vector3 {
        return SPAWN_POINT.clone();
    }

    public getInteractables(): THREE.Object3D[] {
        return [this.canyonCrystal];
    }

    public getHeightAt(x: number, z: number): number {
        if (x >= -CANYON_HALF_WIDTH && x <= CANYON_HALF_WIDTH && z >= -CANYON_HALF_LENGTH && z <= CANYON_HALF_LENGTH) return 0;
        return -100;
    }

    dispose() {
        if (this.canyonCrystal) {
            this.canyonCrystal.traverse((c: any) => { if (c.isMesh) { c.geometry.dispose(); c.material.dispose(); } });
            this.scene.remove(this.canyonCrystal);
        }
        this.collisionGrid.clear();
        this.scene.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (mesh.isMesh) {
                mesh.geometry.dispose();
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach((m: THREE.Material) => m.dispose());
                } else if (mesh.material) {
                    mesh.material.dispose();
                }
            }
        });
    }
}