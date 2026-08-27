// src/features/game/world/locations/influence/InfluencePoint.ts
import * as THREE from "three";
import { Location } from "../../Location";
import { ResourceManager } from "../../../core/ResourceManager";
import { CollisionGrid } from "../../CollisionGrid";
import { getGraphicsSettings } from "../../../core/graphicsSettings";
import { SoundManager } from "../../../core/SoundManager";
import { CITY_BOSS_ARENA, CITY_CATHEDRAL, CITY_CRYSTAL, CITY_SPAWNS } from "./cityLayout";
import { buildCityMesh, CityMeshResult } from "./cityMesh";
import { CITY_OUTER_RADIUS, outsideCity } from "./cityBounds";
import { TearWallSystem } from "./systems/TearWallSystem";
import { InfluenceCrystalSystem, CrystalPhase } from "./systems/InfluenceCrystalSystem";
import { CityLootSystem } from "./systems/CityLootSystem";

export const INFLUENCE_LOCATION_ID = "influence-point";
export const INFLUENCE_EXIT_INTERACTION = "influence-exit";

const CHUNK_DRAW_DISTANCE = 156;
const LIGHT_POOL = 5;
const LIGHT_RANGE = 62;
const LIGHT_REFRESH = 0.4;
const ASH_COUNT = 420;
const ASH_RADIUS = 42;
const ASH_COLUMN = 26;
const FOG_COLOUR = 0x0c0f15;

const ashVertexShader = /* glsl */`
    attribute float aSize;
    varying float vAlpha;

    void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * (140.0 / -mv.z);
        vAlpha = clamp(1.0 - (-mv.z) / 90.0, 0.0, 1.0);
    }
`;

const ashFragmentShader = /* glsl */`
    uniform vec3 uColor;
    varying float vAlpha;

    void main() {
        vec2 offset = gl_PointCoord - 0.5;
        float d = dot(offset, offset);
        if (d > 0.25) discard;
        gl_FragColor = vec4(uColor, (0.25 - d) * 3.4 * vAlpha);
    }
`;

interface LightAnchor {
    position: THREE.Vector3;
    colour: number;
    intensity: number;
    range: number;
}

export class InfluencePoint extends Location {
    public collisionGrid: CollisionGrid;
    public maxPlayerRadius: number | null = CITY_OUTER_RADIUS + 4;
    public boundsProbe = (x: number, z: number) => outsideCity(x, z);

    public onOpenContainer: ((containerId: string) => void) | null = null;

    private readonly bin: THREE.Object3D[] = [];
    private readonly chunkMeshes: { mesh: THREE.Mesh; x: number; z: number; radius: number }[] = [];
    private mesh: CityMeshResult | null = null;

    private stoneMaterial: THREE.MeshStandardMaterial | null = null;
    private glassMaterial: THREE.MeshBasicMaterial | null = null;
    private groundMaterial: THREE.MeshStandardMaterial | null = null;
    private rimMaterial: THREE.MeshBasicMaterial | null = null;

    private readonly tear: TearWallSystem;
    public readonly crystal: InfluenceCrystalSystem;
    public readonly loot: CityLootSystem;

    private lights: THREE.PointLight[] = [];
    private lightAnchors: LightAnchor[] = [];
    private lightTimer = 0;
    private lightsAllowed = true;

    private ash: THREE.Points | null = null;
    private ashMaterial: THREE.ShaderMaterial | null = null;
    private ashSeeds: Float32Array | null = null;

    private spawnIndex = 0;
    private time = 0;
    private nextTollAt = 26;
    private bossAlive = true;

    constructor() {
        super(INFLUENCE_LOCATION_ID, "The Sundered Ward");
        this.collisionGrid = new CollisionGrid(10);
        this.terrain = { getHeightAt: () => 0 };
        this.tear = new TearWallSystem(this.scene);
        this.crystal = new InfluenceCrystalSystem();
        this.loot = new CityLootSystem(this.scene);
    }

    private addStatic(object: THREE.Object3D) {
        this.scene.add(object);
        this.bin.push(object);
    }

    create(_rm: ResourceManager) {
        const graphics = getGraphicsSettings();
        this.lightsAllowed = graphics.pointLights;

        this.scene.background = new THREE.Color(FOG_COLOUR);
        this.scene.fog = new THREE.FogExp2(FOG_COLOUR, 0.0185);

        this.scene.add(new THREE.AmbientLight(0x2b3348, 1.5));
        this.scene.add(new THREE.HemisphereLight(0x3d4d70, 0x14151b, 2.3));

        const moon = new THREE.DirectionalLight(0xa8c4f0, 2.6);
        moon.position.set(-120, 210, 90);
        moon.castShadow = graphics.shadowRes > 0;
        if (moon.castShadow) {
            moon.shadow.mapSize.set(graphics.shadowRes, graphics.shadowRes);
            moon.shadow.camera.left = -90;
            moon.shadow.camera.right = 90;
            moon.shadow.camera.top = 90;
            moon.shadow.camera.bottom = -90;
            moon.shadow.camera.near = 40;
            moon.shadow.camera.far = 420;
            moon.shadow.bias = -0.0012;
        }
        this.scene.add(moon);

        this.mesh = buildCityMesh();

        this.stoneMaterial = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.94,
            metalness: 0.02,
            flatShading: true,
        });

        this.groundMaterial = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 1,
            metalness: 0,
        });

        this.glassMaterial = new THREE.MeshBasicMaterial({
            vertexColors: true,
            side: THREE.DoubleSide,
            toneMapped: false,
        });

        this.rimMaterial = new THREE.MeshBasicMaterial({
            vertexColors: true,
            side: THREE.DoubleSide,
            fog: true,
        });

        const ground = new THREE.Mesh(this.mesh.ground, this.groundMaterial);
        ground.name = "influence-ground";
        ground.receiveShadow = moon.castShadow;
        this.addStatic(ground);

        const rim = new THREE.Mesh(this.mesh.rim, this.rimMaterial);
        rim.name = "influence-rim";
        rim.frustumCulled = false;
        this.addStatic(rim);

        for (const chunk of this.mesh.chunks) {
            const chunkMesh = new THREE.Mesh(chunk.geometry, this.stoneMaterial);
            chunkMesh.name = `city-chunk-${Math.round(chunk.x)}-${Math.round(chunk.z)}`;
            chunkMesh.castShadow = moon.castShadow;
            chunkMesh.receiveShadow = moon.castShadow;
            this.addStatic(chunkMesh);
            this.chunkMeshes.push({ mesh: chunkMesh, x: chunk.x, z: chunk.z, radius: chunk.radius });
        }

        const landmark = new THREE.Mesh(this.mesh.landmark, this.stoneMaterial);
        landmark.name = "influence-cathedral";
        landmark.castShadow = moon.castShadow;
        landmark.receiveShadow = moon.castShadow;
        this.addStatic(landmark);

        const glass = new THREE.Mesh(this.mesh.glass, this.glassMaterial);
        glass.name = "influence-glass";
        this.addStatic(glass);

        this.tear.create();
        this.loot.create();
        this.addStatic(this.crystal.group);

        this.createExitRifts();
        this.createLightPool();
        if (graphics.particles) this.createAsh();

        for (const collider of this.mesh.colliders) this.collisionGrid.insert(collider);
    }

    private createExitRifts() {
        const geometry = new THREE.PlaneGeometry(4.4, 6.6);
        const material = new THREE.MeshBasicMaterial({
            color: 0x9d6bff,
            transparent: true,
            opacity: 0.55,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            fog: false,
            toneMapped: false,
        });

        CITY_SPAWNS.forEach((spawn, index) => {
            const group = new THREE.Group();
            group.position.set(spawn.x, 0, spawn.z);
            group.name = `influence-exit-${index}`;
            group.userData.interactionId = INFLUENCE_EXIT_INTERACTION;
            group.userData.interactionRadius = 4.2;

            const sheet = new THREE.Mesh(geometry, material);
            sheet.position.y = 3.3;
            sheet.rotation.y = Math.atan2(-spawn.x, -spawn.z);
            group.add(sheet);

            const back = sheet.clone();
            back.rotation.y += Math.PI / 2;
            back.scale.x = 0.35;
            group.add(back);

            this.addStatic(group);
        });
    }

    private createLightPool() {
        if (!this.mesh) return;

        for (const anchor of this.mesh.brazierAnchors) {
            this.lightAnchors.push({ position: anchor, colour: 0xff9a4a, intensity: 12, range: 26 });
        }
        for (const anchor of this.mesh.lampAnchors) {
            this.lightAnchors.push({ position: anchor, colour: 0xffc07a, intensity: 7, range: 20 });
        }

        if (!this.lightsAllowed) return;

        for (let i = 0; i < LIGHT_POOL; i++) {
            const light = new THREE.PointLight(0xff9a4a, 0, 24, 2);
            light.visible = false;
            this.lights.push(light);
            this.addStatic(light);
        }
    }

    private createAsh() {
        const positions = new Float32Array(ASH_COUNT * 3);
        const sizes = new Float32Array(ASH_COUNT);
        this.ashSeeds = new Float32Array(ASH_COUNT * 3);

        for (let i = 0; i < ASH_COUNT; i++) {
            this.ashSeeds[i * 3] = Math.random() * Math.PI * 2;
            this.ashSeeds[i * 3 + 1] = Math.random();
            this.ashSeeds[i * 3 + 2] = 0.35 + Math.random() * 0.9;
            sizes[i] = 0.6 + Math.random() * 1.5;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
        geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), ASH_RADIUS * 2);

        this.ashMaterial = new THREE.ShaderMaterial({
            uniforms: { uColor: { value: new THREE.Color(0x9aa4b4) } },
            vertexShader: ashVertexShader,
            fragmentShader: ashFragmentShader,
            transparent: true,
            depthWrite: false,
            fog: false,
        });

        this.ash = new THREE.Points(geometry, this.ashMaterial);
        this.ash.name = "influence-ash";
        this.ash.frustumCulled = false;
        this.ash.renderOrder = 4;
        this.addStatic(this.ash);
    }

    public setSpawnIndex(index: number) {
        this.spawnIndex = Math.max(0, Math.min(CITY_SPAWNS.length - 1, index));
    }

    getSpawnPoint(): THREE.Vector3 {
        const spawn = CITY_SPAWNS[this.spawnIndex] ?? CITY_SPAWNS[0];
        return new THREE.Vector3(spawn.x, 0, spawn.z);
    }

    public setCrystalState(phase: CrystalPhase, ownerColour: number | null, healthFraction: number) {
        this.crystal.setPhase(phase, ownerColour);
        this.crystal.setHealth(healthFraction);
        this.bossAlive = phase === "sealed";
    }

    public setCaptureProgress(progress: number) {
        this.crystal.setCaptureProgress(progress);
    }

    public override getInteractables(): THREE.Object3D[] {
        const list: THREE.Object3D[] = [this.crystal.group, ...this.loot.getInteractables()];
        for (const object of this.bin) {
            if (object.name.startsWith("influence-exit-")) list.push(object);
        }
        return list;
    }

    public override getInteractionPrompt(): string | null {
        return null;
    }

    update(playerPosition: THREE.Vector3, delta: number) {
        this.time += delta;

        for (const chunk of this.chunkMeshes) {
            const dx = chunk.x - playerPosition.x;
            const dz = chunk.z - playerPosition.z;
            chunk.mesh.visible = dx * dx + dz * dz < (CHUNK_DRAW_DISTANCE + chunk.radius) ** 2;
        }

        this.tear.update(delta);
        this.crystal.update(delta);
        this.loot.update(delta, this.time);

        this.updateLights(playerPosition, delta);
        this.updateAsh(playerPosition, delta);

        if (this.bossAlive && this.time >= this.nextTollAt) {
            this.nextTollAt = this.time + 38 + Math.random() * 34;
            SoundManager.getInstance().playAt("ward-bell", {
                x: CITY_BOSS_ARENA.x,
                z: CITY_BOSS_ARENA.z,
                volume: 0.5,
                maxDistance: 320,
            });
        }
    }

    private updateLights(playerPosition: THREE.Vector3, delta: number) {
        if (!this.lightsAllowed || this.lights.length === 0) return;

        this.lightTimer -= delta;
        if (this.lightTimer > 0) {
            for (const light of this.lights) {
                if (!light.visible) continue;
                light.intensity = light.userData.baseIntensity * (0.82 + Math.sin(this.time * 6 + light.userData.phase) * 0.18);
            }
            return;
        }
        this.lightTimer = LIGHT_REFRESH;

        const near: { anchor: LightAnchor; distance: number }[] = [];
        for (const anchor of this.lightAnchors) {
            const dx = anchor.position.x - playerPosition.x;
            const dz = anchor.position.z - playerPosition.z;
            const distance = dx * dx + dz * dz;
            if (distance > LIGHT_RANGE * LIGHT_RANGE) continue;
            near.push({ anchor, distance });
        }

        near.sort((a, b) => a.distance - b.distance);

        for (let i = 0; i < this.lights.length; i++) {
            const light = this.lights[i];
            const entry = near[i];

            if (!entry) {
                light.visible = false;
                continue;
            }

            light.visible = true;
            light.position.copy(entry.anchor.position);
            light.color.setHex(entry.anchor.colour);
            light.distance = entry.anchor.range;
            light.userData.baseIntensity = entry.anchor.intensity;
            light.userData.phase = (entry.anchor.position.x + entry.anchor.position.z) * 0.3;
            light.intensity = entry.anchor.intensity;
        }
    }

    private updateAsh(playerPosition: THREE.Vector3, delta: number) {
        if (!this.ash || !this.ashSeeds) return;

        const attribute = this.ash.geometry.getAttribute("position") as THREE.BufferAttribute;
        const array = attribute.array as Float32Array;

        for (let i = 0; i < ASH_COUNT; i++) {
            const angle = this.ashSeeds[i * 3];
            const speed = this.ashSeeds[i * 3 + 2];

            let fall = this.ashSeeds[i * 3 + 1] - delta * speed * 0.045;
            if (fall < 0) fall += 1;
            this.ashSeeds[i * 3 + 1] = fall;

            const drift = angle + this.time * speed * 0.07;
            const radius = ASH_RADIUS * (0.15 + ((i * 37) % 100) / 118);

            array[i * 3] = playerPosition.x + Math.cos(drift) * radius;
            array[i * 3 + 1] = fall * ASH_COLUMN;
            array[i * 3 + 2] = playerPosition.z + Math.sin(drift) * radius;
        }

        attribute.needsUpdate = true;
    }

    public isInsideCathedral(position: THREE.Vector3): boolean {
        return position.x > CITY_CATHEDRAL.minX && position.x < CITY_CATHEDRAL.maxX
            && position.z > CITY_CATHEDRAL.minZ && position.z < CITY_CATHEDRAL.maxZ;
    }

    public distanceToCrystal(position: THREE.Vector3): number {
        return Math.hypot(position.x - CITY_CRYSTAL.x, position.z - CITY_CRYSTAL.z);
    }

    public get bossArena() {
        return CITY_BOSS_ARENA;
    }

    dispose() {
        this.tear.dispose();
        this.loot.dispose();
        this.crystal.dispose();

        for (const object of this.bin) this.scene.remove(object);
        this.bin.length = 0;

        for (const chunk of this.chunkMeshes) chunk.mesh.geometry.dispose();
        this.chunkMeshes.length = 0;

        this.mesh?.landmark.dispose();
        this.mesh?.glass.dispose();
        this.mesh?.ground.dispose();
        this.mesh?.rim.dispose();
        this.mesh = null;

        this.stoneMaterial?.dispose();
        this.glassMaterial?.dispose();
        this.groundMaterial?.dispose();
        this.rimMaterial?.dispose();

        this.ash?.geometry.dispose();
        this.ashMaterial?.dispose();
        this.ash = null;
        this.ashMaterial = null;
        this.ashSeeds = null;

        this.lights.length = 0;
        this.lightAnchors.length = 0;
        this.collisionGrid.clear();
    }
}
