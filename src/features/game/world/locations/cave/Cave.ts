// src/features/game/world/locations/cave/Cave.ts
import * as THREE from "three";
import { t } from "@/core/i18n";
import { Location } from "../../Location";
import { ResourceManager } from "../../../core/ResourceManager";
import { CollisionGrid } from "../../CollisionGrid";
import { SoundManager } from "../../../core/SoundManager";
import { createRandom, valueNoise3 } from "../main-world/utils/worldNoise";
import { buildCaveMesh, caveCeilingHeight, caveFloorHeight, caveWallPoint, CaveOpenCell, CAVE_CELL, CAVE_SEED } from "./caveMesh";
import {
    CAVE_BOSS_ARENA,
    CAVE_CHESTS,
    CAVE_ENTRANCE,
    CAVE_ENTRIES,
    CAVE_SECRETS,
    CAVE_SECRET_DOOR_HEIGHT,
    CAVE_SECRET_DOOR_WIDTH,
    CaveSecret,
} from "./caveLayout";

const _beam = new THREE.Vector3();

const INTERACT_RANGE = 4.2;
const LANTERN_HEIGHT = 1.9;
const DUST_COUNT = 340;
const DUST_RADIUS = 20;
const DUST_COLUMN = 9;
const DRIP_COUNT = 18;
const DRIP_RADIUS = 15;
const DRIP_MIN_DELAY = 5;
const DRIP_DELAY_SPREAD = 11;
const DRIP_SOUND_COOLDOWN = 0.55;
const DRIP_SOUND_CHANCE = 0.45;
const CHUNK_DRAW_DISTANCE = 78;
const LIGHT_ACTIVE_RANGE = 46;
const VICTORY_PORTAL_OFFSET = 26;
const AMBIENT_LIGHT_BUDGET = 2;
const MOSS_TEAL = 0x2fd8c4;
const MOSS_LIME = 0x8dff6a;
const MOSS_VIOLET = 0x9a72ff;

interface SecretDoor {
    definition: CaveSecret;
    mesh: THREE.Mesh;
    collider: THREE.Box3;
    opening: number;
    opened: boolean;
}

interface Chest {
    id: string;
    group: THREE.Group;
    lid: THREE.Mesh;
    glow: THREE.PointLight;
    opened: boolean;
    lidAngle: number;
}

export class Cave extends Location {
    public collisionGrid: CollisionGrid;
    public maxPlayerRadius = 350;

    public onOpenChest: ((chestId: string) => void) | null = null;
    public onSecretFound: ((secretId: string) => void) | null = null;

    private readonly bin: THREE.Object3D[] = [];
    private readonly chunks: { mesh: THREE.Mesh; x: number; z: number; radius: number }[] = [];
    private staticColliders: THREE.Box3[] = [];
    private doors: SecretDoor[] = [];
    private chests: Chest[] = [];

    private lantern: THREE.PointLight | null = null;
    private glowPool: THREE.PointLight | null = null;
    private flashlight: THREE.SpotLight | null = null;
    private flashlightTarget: THREE.Object3D | null = null;
    private lanternFlicker = 0;
    private dust: THREE.Points | null = null;
    private dustMaterial: THREE.ShaderMaterial | null = null;
    private dripPoints: THREE.Points | null = null;
    private dripMaterial: THREE.PointsMaterial | null = null;
    private dripSoundCooldown = 0;
    private readonly drips: { x: number; y: number; z: number; velocity: number; floorY: number; splash: number; delay: number }[] = [];
    private moss: THREE.Points | null = null;
    private mossMaterial: THREE.ShaderMaterial | null = null;
    private ambientLights: { light: THREE.PointLight; base: number; phase: number; wx: number; wz: number; distance: number }[] = [];
    private lightOrder: number[] = [];
    private bossDefeated = false;
    private victoryPortalsOpen = false;
    private time = 0;

    private activePrompt: string | null = null;
    private activeSecret: SecretDoor | null = null;
    private activeChest: Chest | null = null;

    constructor() {
        super("cave", "The Hollow");
        this.collisionGrid = new CollisionGrid(12);
        this.terrain = { getHeightAt: (x: number, z: number) => caveFloorHeight(x, z) };
    }

    create(_rm: ResourceManager) {
        this.bossDefeated = false;
        this.victoryPortalsOpen = false;

        this.scene.background = new THREE.Color(0x010204);
        this.scene.fog = new THREE.FogExp2(0x010204, 0.092);

        this.scene.add(new THREE.AmbientLight(0x0d1422, 0.028));

        const mesh = buildCaveMesh();
        this.staticColliders = mesh.colliders;

        const rockMaterial = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.97,
            metalness: 0.03,
            flatShading: true,
        });

        for (const chunk of mesh.chunks) {
            const chunkMesh = new THREE.Mesh(chunk.geometry, rockMaterial);
            chunkMesh.name = `cave-chunk-${chunk.x}-${chunk.z}`;
            this.addStatic(chunkMesh);
            this.chunks.push({ mesh: chunkMesh, x: chunk.x, z: chunk.z, radius: chunk.radius });
        }

        this.createFormations(mesh.cells);
        this.createFungi(mesh.cells);
        this.createSecretDoors();

        this.createEntrancePortal();
        this.createBossArenaMood();
        this.createLantern();
        this.createDust();
        this.createDrips();

        this.lightOrder = this.ambientLights.map((_, index) => index);

        this.rebuildColliders();
    }

    private addStatic(object: THREE.Object3D) {
        this.scene.add(object);
        this.bin.push(object);
    }

    private createFormations(cells: { x: number; z: number; edge: boolean; ceiling: number }[]) {
        const random = createRandom(CAVE_SEED + 4001);
        const spikes: THREE.Matrix4[] = [];
        const drops: THREE.Matrix4[] = [];

        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        const euler = new THREE.Euler();

        for (const cell of cells) {
            if (!cell.edge) continue;

            if (random() < 0.34) {
                const height = 1.1 + random() * 2.6;
                position.set(cell.x + (random() - 0.5) * 1.2, caveFloorHeight(cell.x, cell.z), cell.z + (random() - 0.5) * 1.2);
                euler.set((random() - 0.5) * 0.16, random() * Math.PI * 2, (random() - 0.5) * 0.16);
                quaternion.setFromEuler(euler);
                scale.set(0.3 + random() * 0.45, height, 0.3 + random() * 0.45);
                spikes.push(matrix.clone().compose(position, quaternion, scale));
            }

            if (random() < 0.3) {
                const height = 1 + random() * 2.4;
                const top = caveCeilingHeight(cell.x, cell.z);
                position.set(cell.x + (random() - 0.5) * 1.4, top, cell.z + (random() - 0.5) * 1.4);
                euler.set(Math.PI + (random() - 0.5) * 0.2, random() * Math.PI * 2, 0);
                quaternion.setFromEuler(euler);
                scale.set(0.24 + random() * 0.4, height, 0.24 + random() * 0.4);
                drops.push(matrix.clone().compose(position, quaternion, scale));
            }
        }

        const spikeGeometry = new THREE.ConeGeometry(1, 1, 6, 1);
        spikeGeometry.translate(0, 0.5, 0);

        const material = new THREE.MeshStandardMaterial({
            color: 0x2a2c33,
            roughness: 0.95,
            metalness: 0.04,
            flatShading: true,
        });

        const build = (matrices: THREE.Matrix4[], name: string) => {
            if (matrices.length === 0) return;
            const instanced = new THREE.InstancedMesh(spikeGeometry, material, matrices.length);
            instanced.name = name;
            matrices.forEach((m, i) => instanced.setMatrixAt(i, m));
            instanced.instanceMatrix.needsUpdate = true;
            instanced.castShadow = false;
            instanced.receiveShadow = true;
            this.addStatic(instanced);
        };

        build(spikes, "cave-stalagmites");
        build(drops, "cave-stalactites");
    }

    private createFungi(cells: CaveOpenCell[]) {
        const random = createRandom(CAVE_SEED + 9109);

        const positions: number[] = [];
        const colors: number[] = [];
        const sizes: number[] = [];
        const phases: number[] = [];

        const color = new THREE.Color();
        const half = CAVE_CELL * 0.5;

        for (const cell of cells) {
            if (!cell.edge) continue;
            if (cell.wallX === 0 && cell.wallZ === 0) continue;
            if (random() > 0.34) continue;

            const anchorX = cell.x + cell.wallX * half;
            const anchorZ = cell.z + cell.wallZ * half;
            const inward = new THREE.Vector3(-cell.wallX, 0, -cell.wallZ).normalize();

            const hue = random();
            color.setHex(hue < 0.52 ? MOSS_TEAL : hue < 0.84 ? MOSS_LIME : MOSS_VIOLET);

            const patchT = 0.16 + random() * 0.5;
            const spread = 0.5 + random() * 0.9;
            const grains = 26 + Math.floor(random() * 44);

            for (let i = 0; i < grains; i++) {
                const t = THREE.MathUtils.clamp(patchT + (random() - 0.5) * 0.24, 0.04, 0.94);
                const surface = caveWallPoint(anchorX, anchorZ, t);

                const along = (random() - 0.5) * CAVE_CELL * spread;
                const bias = 0.4 + random() * 0.5;

                positions.push(
                    surface.x + inward.x * bias - inward.z * along,
                    surface.y + (random() - 0.5) * 0.5,
                    surface.z + inward.z * bias + inward.x * along
                );

                const shade = 0.42 + random() * 0.75;
                colors.push(color.r * shade, color.g * shade, color.b * shade);
                sizes.push(0.05 + random() * 0.13);
                phases.push(random() * Math.PI * 2);
            }
        }

        if (positions.length === 0) return;

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
        geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
        geometry.setAttribute("aPhase", new THREE.Float32BufferAttribute(phases, 1));
        geometry.computeBoundingSphere();

        this.mossMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uScale: { value: 640 },
            },
            vertexShader: /* glsl */`
                attribute float aSize;
                attribute float aPhase;

                uniform float uTime;
                uniform float uScale;

                varying vec3 vColor;
                varying float vGlow;

                void main() {
                    vColor = color;
                    vGlow = 0.55 + sin(uTime * 1.4 + aPhase) * 0.45;

                    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * viewPosition;
                    gl_PointSize = aSize * uScale * (0.75 + vGlow * 0.4) / max(-viewPosition.z, 0.6);
                }
            `,
            fragmentShader: /* glsl */`
                varying vec3 vColor;
                varying float vGlow;

                void main() {
                    vec2 offset = gl_PointCoord - 0.5;
                    float falloff = 1.0 - smoothstep(0.05, 0.5, length(offset));
                    if (falloff <= 0.001) discard;

                    float core = pow(falloff, 3.0);
                    gl_FragColor = vec4(vColor * (0.6 + vGlow * 0.9) * (core + falloff * 0.35), falloff);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            vertexColors: true,
        });

        this.moss = new THREE.Points(geometry, this.mossMaterial);
        this.moss.name = "cave-moss";
        this.moss.frustumCulled = false;
        this.addStatic(this.moss);
    }

    private createSecretDoors() {
        const material = new THREE.MeshStandardMaterial({
            color: 0x24262c,
            roughness: 0.98,
            metalness: 0.02,
            flatShading: true,
        });

        for (const secret of CAVE_SECRETS) {
            const geometry = new THREE.BoxGeometry(CAVE_SECRET_DOOR_WIDTH, CAVE_SECRET_DOOR_HEIGHT, 2.2, 3, 3, 1);
            const position = geometry.getAttribute("position");
            for (let i = 0; i < position.count; i++) {
                const x = position.getX(i);
                const y = position.getY(i);
                const z = position.getZ(i);
                const bump = (valueNoise3(x * 0.7, y * 0.7, z * 0.7, CAVE_SEED + 313) - 0.5) * 0.5;
                position.setXYZ(i, x + bump, y + bump * 0.6, z + bump);
            }
            position.needsUpdate = true;
            geometry.computeVertexNormals();

            const floorY = caveFloorHeight(secret.doorX, secret.doorZ);
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(secret.doorX, floorY + CAVE_SECRET_DOOR_HEIGHT / 2 - 0.4, secret.doorZ);
            mesh.rotation.y = secret.doorAngle;
            mesh.name = `cave-secret-${secret.id}`;
            mesh.receiveShadow = true;
            this.addStatic(mesh);

            const collider = new THREE.Box3(
                new THREE.Vector3(secret.doorX - 3.6, floorY - 2, secret.doorZ - 3.6),
                new THREE.Vector3(secret.doorX + 3.6, floorY + CAVE_SECRET_DOOR_HEIGHT, secret.doorZ + 3.6)
            );

            this.doors.push({ definition: secret, mesh, collider, opening: 0, opened: false });
        }
    }

    public spawnChest(chestId: string, x: number, z: number) {
        if (this.chests.some((entry) => entry.id === chestId)) return;

        const chest = CAVE_CHESTS.find((entry) => entry.id === chestId);

        {
            const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.86, metalness: 0.05, flatShading: true });
            const ironMaterial = new THREE.MeshStandardMaterial({ color: 0x6a6f78, roughness: 0.45, metalness: 0.85, flatShading: true });
            const runeMaterial = new THREE.MeshBasicMaterial({ color: 0x8fe9ff, toneMapped: false });

            const group = new THREE.Group();
            const floorY = caveFloorHeight(x, z);
            group.position.set(x, floorY, z);
            group.rotation.y = chest?.rotation ?? 0;

            const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.95, 1.1), woodMaterial);
            body.position.y = 0.48;
            body.castShadow = true;
            group.add(body);

            for (const offset of [-0.55, 0.55]) {
                const band = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.02, 1.18), ironMaterial);
                band.position.set(offset, 0.5, 0);
                group.add(band);
            }

            const lid = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.34, 1.16), woodMaterial);
            lid.geometry.translate(0, 0.17, 0);
            lid.position.set(0, 0.95, -0.55);
            lid.castShadow = true;
            group.add(lid);

            const rune = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 6, 14), runeMaterial);
            rune.position.set(0, 0.52, 0.58);
            group.add(rune);

            const glow = new THREE.PointLight(0x7fe3ff, 1.5, 14, 0);
            glow.position.set(0, 1, 0);
            glow.castShadow = false;
            group.add(glow);

            this.addStatic(group);
            this.chests.push({ id: chestId, group, lid, glow, opened: false, lidAngle: 0 });
            this.ambientLights.push({ light: glow, base: 1.5, phase: 0, wx: x, wz: z, distance: 0 });
            this.lightOrder.push(this.ambientLights.length - 1);
        }
    }

    private createEntrancePortal() {
        const ringGeometry = new THREE.TorusGeometry(2.6, 0.28, 8, 26);
        const ringMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4438, roughness: 0.8, metalness: 0.3, flatShading: true });
        const veilGeometry = new THREE.CircleGeometry(2.4, 28);
        const veilMaterial = new THREE.MeshBasicMaterial({ color: 0x6fd6ff, transparent: true, opacity: 0.32, side: THREE.DoubleSide, toneMapped: false });

        for (const entry of CAVE_ENTRIES) {
            const floorY = caveFloorHeight(entry.x, entry.z);
            const group = new THREE.Group();
            group.position.set(entry.x, floorY, entry.z);

            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.position.y = 2.7;
            group.add(ring);

            const veil = new THREE.Mesh(veilGeometry, veilMaterial);
            veil.position.y = 2.7;
            group.add(veil);

            this.addStatic(group);

            this.addPortal({
                id: `cave-to-main-${entry.id}`,
                position: new THREE.Vector3(entry.x, floorY, entry.z),
                radius: 2.6,
                targetLocationId: "main-world",
                targetSpawnPoint: new THREE.Vector3(0, 0, 0),
                mesh: group,
            });
        }
    }

    private createBossArenaMood() {
        const emberMaterial = new THREE.MeshBasicMaterial({ color: 0xff5a34, toneMapped: false });
        const emberGeometry = new THREE.IcosahedronGeometry(0.4, 0);

        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + 0.4;
            const radius = CAVE_BOSS_ARENA.radius * 0.82;
            const x = CAVE_BOSS_ARENA.x + Math.cos(angle) * radius;
            const z = CAVE_BOSS_ARENA.z + Math.sin(angle) * radius;
            const floorY = caveFloorHeight(x, z);

            const ember = new THREE.Mesh(emberGeometry, emberMaterial);
            ember.position.set(x, floorY + 0.5, z);
            this.addStatic(ember);

            if (i % 2 !== 0) continue;

            const light = new THREE.PointLight(0xff3d22, 1.15, 34, 0);
            light.position.set(x, floorY + 2.4, z);
            light.castShadow = false;
            this.addStatic(light);
            this.ambientLights.push({ light, base: 1.15, phase: i * 1.3, wx: x, wz: z, distance: 0 });
        }
    }

    private createLantern() {
        this.lantern = new THREE.PointLight(0xffb066, 1.15, 17, 0);
        this.lantern.castShadow = false;
        this.addStatic(this.lantern);

        this.glowPool = new THREE.PointLight(0x2f4560, 0.4, 9, 0);
        this.glowPool.castShadow = false;
        this.addStatic(this.glowPool);

        this.flashlight = new THREE.SpotLight(0xffe4bc, 3.4, 52, 0.44, 0.5, 0.35);
        this.flashlight.castShadow = false;
        this.addStatic(this.flashlight);

        this.flashlightTarget = new THREE.Object3D();
        this.flashlight.target = this.flashlightTarget;
        this.addStatic(this.flashlightTarget);
    }

    private createDust() {
        const random = createRandom(CAVE_SEED + 77);

        const positions = new Float32Array(DUST_COUNT * 3);
        const sizes = new Float32Array(DUST_COUNT);
        const phases = new Float32Array(DUST_COUNT);
        const speeds = new Float32Array(DUST_COUNT);

        for (let i = 0; i < DUST_COUNT; i++) {
            positions[i * 3] = (random() - 0.5) * DUST_RADIUS * 2;
            positions[i * 3 + 1] = random() * DUST_COLUMN;
            positions[i * 3 + 2] = (random() - 0.5) * DUST_RADIUS * 2;
            sizes[i] = 0.02 + random() * 0.055;
            phases[i] = random() * Math.PI * 2;
            speeds[i] = 0.12 + random() * 0.34;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
        geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
        geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), DUST_RADIUS * 2);

        this.dustMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uScale: { value: 620 },
                uColumn: { value: DUST_COLUMN },
                uFogColor: { value: new THREE.Color(0x010204) },
                uFogDensity: { value: 0.092 },
            },
            vertexShader: /* glsl */`
                attribute float aSize;
                attribute float aPhase;
                attribute float aSpeed;

                uniform float uTime;
                uniform float uScale;
                uniform float uColumn;

                varying float vAlpha;
                varying float vDepth;

                void main() {
                    vec3 drift = position;
                    drift.x += sin(uTime * 0.24 + aPhase) * 1.35;
                    drift.z += cos(uTime * 0.19 + aPhase * 1.7) * 1.15;
                    drift.y = mod(position.y + uTime * aSpeed, uColumn);

                    float rise = drift.y / uColumn;
                    float twinkle = 0.45 + sin(uTime * 1.9 + aPhase * 3.1) * 0.55;

                    vAlpha = smoothstep(0.0, 0.16, rise) * (1.0 - smoothstep(0.68, 1.0, rise)) * (0.35 + twinkle * 0.65);

                    vec4 viewPosition = modelViewMatrix * vec4(drift, 1.0);
                    vDepth = -viewPosition.z;
                    gl_Position = projectionMatrix * viewPosition;
                    gl_PointSize = aSize * uScale / max(vDepth, 0.7);
                }
            `,
            fragmentShader: /* glsl */`
                uniform vec3 uFogColor;
                uniform float uFogDensity;

                varying float vAlpha;
                varying float vDepth;

                void main() {
                    float falloff = 1.0 - smoothstep(0.1, 0.5, length(gl_PointCoord - 0.5));
                    if (falloff <= 0.001) discard;

                    float fog = 1.0 - exp(-vDepth * uFogDensity);
                    vec3 tint = mix(vec3(0.72, 0.79, 0.88), uFogColor, fog);

                    gl_FragColor = vec4(tint, falloff * vAlpha * (1.0 - fog * 0.85));
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        this.dust = new THREE.Points(geometry, this.dustMaterial);
        this.dust.frustumCulled = false;
        this.addStatic(this.dust);
    }

    private createDrips() {
        const positions = new Float32Array(DRIP_COUNT * 3);

        for (let i = 0; i < DRIP_COUNT; i++) {
            this.drips.push({ x: 0, y: 0, z: 0, velocity: 0, floorY: 0, splash: 0, delay: i * 0.85 });
            positions[i * 3 + 1] = -999;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

        this.dripMaterial = new THREE.PointsMaterial({
            color: 0x9fc4e8,
            size: 0.09,
            transparent: true,
            opacity: 0.75,
            depthWrite: false,
            sizeAttenuation: true,
            fog: true,
        });

        this.dripPoints = new THREE.Points(geometry, this.dripMaterial);
        this.dripPoints.frustumCulled = false;
        this.addStatic(this.dripPoints);
    }

    private updateDrips(playerPosition: THREE.Vector3, delta: number) {
        if (!this.dripPoints) return;

        if (this.dripSoundCooldown > 0) this.dripSoundCooldown -= delta;

        const attribute = this.dripPoints.geometry.getAttribute("position") as THREE.BufferAttribute;
        const array = attribute.array as Float32Array;

        for (let i = 0; i < this.drips.length; i++) {
            const drip = this.drips[i];

            if (drip.delay > 0) {
                drip.delay -= delta;
                array[i * 3 + 1] = -999;
                continue;
            }

            if (drip.velocity === 0 && drip.splash <= 0) {
                const angle = Math.random() * Math.PI * 2;
                const radius = 3 + Math.random() * DRIP_RADIUS;

                drip.x = playerPosition.x + Math.cos(angle) * radius;
                drip.z = playerPosition.z + Math.sin(angle) * radius;
                drip.floorY = caveFloorHeight(drip.x, drip.z);
                drip.y = caveCeilingHeight(drip.x, drip.z) - 0.25;
                drip.velocity = 0.4;
            }

            if (drip.splash > 0) {
                drip.splash -= delta;
                array[i * 3 + 1] = -999;
                if (drip.splash <= 0) drip.delay = DRIP_MIN_DELAY + Math.random() * DRIP_DELAY_SPREAD;
                continue;
            }

            drip.velocity += 9.81 * delta;
            drip.y -= drip.velocity * delta;

            if (drip.y <= drip.floorY + 0.05) {
                drip.velocity = 0;
                drip.splash = 0.12;
                array[i * 3 + 1] = -999;

                if (this.dripSoundCooldown <= 0 && Math.random() < DRIP_SOUND_CHANCE) {
                    this.dripSoundCooldown = DRIP_SOUND_COOLDOWN;
                    SoundManager.getInstance().playAt("cave-drip", {
                        x: drip.x,
                        z: drip.z,
                        volume: 0.3,
                        rate: 0.75 + Math.random() * 0.6,
                        maxDistance: 24,
                    });
                }
                continue;
            }

            array[i * 3] = drip.x;
            array[i * 3 + 1] = drip.y;
            array[i * 3 + 2] = drip.z;
        }

        attribute.needsUpdate = true;
    }

    private rebuildColliders() {
        this.collisionGrid.clear();

        for (const collider of this.staticColliders) {
            this.collisionGrid.insert(collider);
        }

        for (const door of this.doors) {
            if (!door.opened) this.collisionGrid.insert(door.collider);
        }
    }

    public setBossDefeated(defeated: boolean) {
        this.bossDefeated = defeated;
        if (defeated) this.openVictoryPortals();
    }

    private openVictoryPortals() {
        if (this.victoryPortalsOpen) return;
        this.victoryPortalsOpen = true;

        const exits: { id: string; target: string; angle: number; colour: number }[] = [
            { id: "cave-victory-hall", target: "tower-main-hall", angle: Math.PI * 0.25, colour: 0xffd166 },
            { id: "cave-victory-world", target: "main-world", angle: Math.PI * 1.25, colour: 0x6fd6ff },
        ];

        for (const exit of exits) {
            const x = CAVE_BOSS_ARENA.x + Math.cos(exit.angle) * VICTORY_PORTAL_OFFSET;
            const z = CAVE_BOSS_ARENA.z + Math.sin(exit.angle) * VICTORY_PORTAL_OFFSET;
            const floorY = caveFloorHeight(x, z);

            const group = new THREE.Group();
            group.position.set(x, floorY, z);

            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(2.8, 0.3, 8, 26),
                new THREE.MeshBasicMaterial({ color: exit.colour, toneMapped: false })
            );
            ring.position.y = 2.9;
            group.add(ring);

            const veil = new THREE.Mesh(
                new THREE.CircleGeometry(2.6, 28),
                new THREE.MeshBasicMaterial({
                    color: exit.colour,
                    transparent: true,
                    opacity: 0.34,
                    side: THREE.DoubleSide,
                    toneMapped: false,
                })
            );
            veil.position.y = 2.9;
            group.add(veil);

            this.addStatic(group);

            this.addPortal({
                id: exit.id,
                position: new THREE.Vector3(x, floorY, z),
                radius: 2.8,
                targetLocationId: exit.target,
                targetSpawnPoint: new THREE.Vector3(0, 0, 0),
                mesh: group,
            });
        }
    }

    public markChestOpened(chestId: string) {
        const chest = this.chests.find((item) => item.id === chestId);
        if (!chest || chest.opened) return;
        chest.opened = true;

        SoundManager.getInstance().playAt("chest-open", {
            x: chest.group.position.x,
            z: chest.group.position.z,
            volume: 1,
        });
    }

    private openSecret(door: SecretDoor) {
        if (door.opened) return;
        if (door.definition.requiresBoss && !this.bossDefeated) return;

        door.opened = true;
        this.rebuildColliders();

        SoundManager.getInstance().playAt("secret-door", {
            x: door.definition.doorX,
            z: door.definition.doorZ,
            volume: 1,
        });

        this.onSecretFound?.(door.definition.id);
    }

    update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        this.time += delta;

        this.updateLantern(playerPosition, delta);
        this.updateDust(playerPosition);
        this.updateDrips(playerPosition, delta);
        this.updateDoors(delta);
        this.updateChests(delta);
        this.updateInteractions(playerPosition, isEPressed === true);

        this.updateChunkVisibility(playerPosition);
        this.updateLightBudget(playerPosition);

        if (this.mossMaterial) this.mossMaterial.uniforms.uTime.value = this.time;
    }

    private updateChunkVisibility(playerPosition: THREE.Vector3) {
        for (const chunk of this.chunks) {
            const dx = chunk.x - playerPosition.x;
            const dz = chunk.z - playerPosition.z;
            chunk.mesh.visible = dx * dx + dz * dz < (CHUNK_DRAW_DISTANCE + chunk.radius) ** 2;
        }
    }

    private updateLightBudget(playerPosition: THREE.Vector3) {
        for (const entry of this.ambientLights) {
            const dx = entry.wx - playerPosition.x;
            const dz = entry.wz - playerPosition.z;
            entry.distance = dx * dx + dz * dz;
        }

        this.lightOrder.sort((a, b) => this.ambientLights[a].distance - this.ambientLights[b].distance);

        for (let rank = 0; rank < this.lightOrder.length; rank++) {
            const entry = this.ambientLights[this.lightOrder[rank]];
            const inRange = entry.distance < LIGHT_ACTIVE_RANGE * LIGHT_ACTIVE_RANGE;
            entry.light.visible = rank < AMBIENT_LIGHT_BUDGET && inRange;
            if (entry.light.visible) {
                entry.light.intensity = entry.base * (0.72 + Math.sin(this.time * 2.6 + entry.phase) * 0.28);
            }
        }
    }

    private updateLantern(playerPosition: THREE.Vector3, delta: number) {
        if (!this.lantern) return;

        this.lanternFlicker += delta * 9;
        const flicker = 0.86 + Math.sin(this.lanternFlicker) * 0.06 + Math.sin(this.lanternFlicker * 2.7) * 0.04;

        if (this.camera) this.camera.getWorldDirection(_beam);
        else _beam.set(0, 0, -1);

        _beam.y = _beam.y * 0.6 - 0.1;
        _beam.normalize();

        this.lantern.position.set(
            playerPosition.x + _beam.x * 1.6,
            playerPosition.y + LANTERN_HEIGHT * 0.62,
            playerPosition.z + _beam.z * 1.6
        );
        this.lantern.intensity = 1.15 * flicker;

        if (this.glowPool) {
            this.glowPool.position.set(playerPosition.x, playerPosition.y + 0.5, playerPosition.z);
            this.glowPool.intensity = 0.4 * flicker;
        }

        if (!this.flashlight || !this.flashlightTarget) return;

        this.flashlight.visible = this.camera !== undefined;
        this.flashlight.position.set(
            playerPosition.x + _beam.x * 0.9,
            playerPosition.y + LANTERN_HEIGHT,
            playerPosition.z + _beam.z * 0.9
        );
        this.flashlightTarget.position.copy(this.flashlight.position).addScaledVector(_beam, 20);
        this.flashlight.intensity = 3.4 * (0.94 + flicker * 0.06);
    }

    private updateDust(playerPosition: THREE.Vector3) {
        if (!this.dust) return;
        this.dust.position.set(playerPosition.x, playerPosition.y - DUST_COLUMN * 0.35, playerPosition.z);
        if (this.dustMaterial) this.dustMaterial.uniforms.uTime.value = this.time;
    }

    private updateDoors(delta: number) {
        for (const door of this.doors) {
            if (!door.opened || door.opening >= 1) continue;

            door.opening = Math.min(1, door.opening + delta * 0.75);
            const eased = door.opening * door.opening;
            door.mesh.position.y -= eased * delta * 6.5;
            door.mesh.rotation.z = eased * 0.12;

            if (door.opening >= 1) door.mesh.visible = false;
        }
    }

    private updateChests(delta: number) {
        for (const chest of this.chests) {
            const target = chest.opened ? -1.9 : 0;
            chest.lidAngle += (target - chest.lidAngle) * Math.min(1, delta * 3.4);
            chest.lid.rotation.x = chest.lidAngle;

            const glowTarget = chest.opened ? 4.2 : 1.5;
            chest.glow.intensity += (glowTarget - chest.glow.intensity) * Math.min(1, delta * 2);
        }
    }

    private updateInteractions(playerPosition: THREE.Vector3, isEPressed: boolean) {
        this.activePrompt = null;
        this.activeSecret = null;
        this.activeChest = null;

        let bestDistance = INTERACT_RANGE;

        for (const door of this.doors) {
            if (door.opened) continue;
            const distance = Math.hypot(playerPosition.x - door.definition.doorX, playerPosition.z - door.definition.doorZ);
            if (distance > bestDistance) continue;

            bestDistance = distance;
            this.activeSecret = door;
            this.activeChest = null;
            this.activePrompt = door.definition.requiresBoss && !this.bossDefeated
                ? t("g.cave.wardenAlive")
                : t(door.definition.prompt);
        }

        for (const chest of this.chests) {
            if (chest.opened) continue;
            const distance = Math.hypot(playerPosition.x - chest.group.position.x, playerPosition.z - chest.group.position.z);
            if (distance > bestDistance) continue;

            bestDistance = distance;
            this.activeChest = chest;
            this.activeSecret = null;
            this.activePrompt = t("g.cave.forceChest");
        }

        if (!isEPressed) return;

        if (this.activeSecret) {
            this.openSecret(this.activeSecret);
            return;
        }

        if (this.activeChest) {
            this.onOpenChest?.(this.activeChest.id);
        }
    }

    public getInteractionPrompt(): string | null {
        return this.activePrompt;
    }

    getSpawnPoint(): THREE.Vector3 {
        return new THREE.Vector3(
            CAVE_ENTRANCE.x,
            caveFloorHeight(CAVE_ENTRANCE.x, CAVE_ENTRANCE.z - 6),
            CAVE_ENTRANCE.z - 6
        );
    }

    dispose() {
        for (const object of this.bin) {
            this.scene.remove(object);
            object.traverse((child) => {
                const mesh = child as THREE.Mesh;
                if (!mesh.isMesh && !(child as THREE.Points).isPoints) return;
                mesh.geometry?.dispose();
                const material = mesh.material;
                if (Array.isArray(material)) material.forEach((item) => item.dispose());
                else material?.dispose();
            });
        }

        this.bin.length = 0;
        this.chunks.length = 0;
        this.lightOrder = [];
        this.doors = [];
        this.chests = [];
        this.lantern = null;
        this.glowPool = null;
        this.flashlight = null;
        this.flashlightTarget = null;
        this.moss = null;
        this.mossMaterial = null;
        this.dust = null;
        this.dustMaterial = null;
        this.dripPoints = null;
        this.dripMaterial = null;
        this.drips.length = 0;
        this.ambientLights = [];
        this.collisionGrid.clear();
    }
}
