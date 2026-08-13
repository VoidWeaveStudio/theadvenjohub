// src/features/game/world/locations/cave/Cave.ts
import * as THREE from "three";
import { Location } from "../../Location";
import { ResourceManager } from "../../../core/ResourceManager";
import { CollisionGrid } from "../../CollisionGrid";
import { createRandom, valueNoise3 } from "../main-world/utils/worldNoise";
import { buildCaveMesh, caveFloorHeight, CAVE_SEED } from "./caveMesh";
import {
    CAVE_CHESTS,
    CAVE_ENTRANCE,
    CAVE_SECRETS,
    CAVE_SECRET_DOOR_HEIGHT,
    CAVE_SECRET_DOOR_WIDTH,
    CaveSecret,
} from "./caveLayout";

const INTERACT_RANGE = 4.2;
const LANTERN_HEIGHT = 1.9;
const DUST_COUNT = 260;
const DUST_RADIUS = 22;

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
    public maxPlayerRadius = 210;

    public onOpenChest: ((chestId: string) => void) | null = null;
    public onSecretFound: ((secretId: string) => void) | null = null;

    private readonly bin: THREE.Object3D[] = [];
    private staticColliders: THREE.Box3[] = [];
    private doors: SecretDoor[] = [];
    private chests: Chest[] = [];

    private lantern: THREE.PointLight | null = null;
    private lanternFlicker = 0;
    private dust: THREE.Points | null = null;
    private ambientLights: { light: THREE.PointLight; base: number; phase: number }[] = [];
    private bossDefeated = false;
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
        this.scene.background = new THREE.Color(0x04050a);
        this.scene.fog = new THREE.FogExp2(0x04050a, 0.052);

        this.scene.add(new THREE.AmbientLight(0x1b2436, 0.09));

        const mesh = buildCaveMesh();
        this.staticColliders = mesh.colliders;

        const rockMaterial = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.97,
            metalness: 0.03,
            flatShading: true,
        });

        const floorMesh = new THREE.Mesh(mesh.floor, rockMaterial);
        floorMesh.name = "cave-floor";
        floorMesh.receiveShadow = true;
        this.addStatic(floorMesh);

        const ceilingMesh = new THREE.Mesh(mesh.ceiling, rockMaterial);
        ceilingMesh.name = "cave-ceiling";
        this.addStatic(ceilingMesh);

        const wallMesh = new THREE.Mesh(mesh.walls, rockMaterial);
        wallMesh.name = "cave-walls";
        wallMesh.receiveShadow = true;
        this.addStatic(wallMesh);

        this.createFormations(mesh.cells);
        this.createFungi(mesh.cells);
        this.createSecretDoors();
        this.createChests();
        this.createEntrancePortal();
        this.createBossArenaMood();
        this.createLantern();
        this.createDust();

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
                const top = caveFloorHeight(cell.x, cell.z) + cell.ceiling * 0.85;
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

    private createFungi(cells: { x: number; z: number; edge: boolean }[]) {
        const random = createRandom(CAVE_SEED + 9109);
        const matrices: THREE.Matrix4[] = [];
        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();

        for (const cell of cells) {
            if (!cell.edge || random() > 0.12) continue;

            position.set(
                cell.x + (random() - 0.5) * 1.4,
                caveFloorHeight(cell.x, cell.z) + 0.12 + random() * 0.5,
                cell.z + (random() - 0.5) * 1.4
            );
            scale.setScalar(0.1 + random() * 0.16);
            matrices.push(matrix.clone().compose(position, quaternion, scale));
        }

        if (matrices.length === 0) return;

        const instanced = new THREE.InstancedMesh(
            new THREE.IcosahedronGeometry(1, 0),
            new THREE.MeshBasicMaterial({ color: 0x3fe0c8, fog: true, toneMapped: false }),
            matrices.length
        );
        instanced.name = "cave-fungi";
        matrices.forEach((m, i) => instanced.setMatrixAt(i, m));
        instanced.instanceMatrix.needsUpdate = true;
        this.addStatic(instanced);
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

    private createChests() {
        const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.86, metalness: 0.05, flatShading: true });
        const ironMaterial = new THREE.MeshStandardMaterial({ color: 0x6a6f78, roughness: 0.45, metalness: 0.85, flatShading: true });
        const runeMaterial = new THREE.MeshBasicMaterial({ color: 0x8fe9ff, toneMapped: false });

        for (const chest of CAVE_CHESTS) {
            const group = new THREE.Group();
            const floorY = caveFloorHeight(chest.x, chest.z);
            group.position.set(chest.x, floorY, chest.z);
            group.rotation.y = chest.rotation;

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

            const glow = new THREE.PointLight(0x7fe3ff, 1.2, 9, 2);
            glow.position.set(0, 1, 0);
            glow.castShadow = false;
            group.add(glow);

            this.addStatic(group);
            this.chests.push({ id: chest.id, group, lid, glow, opened: false, lidAngle: 0 });
        }
    }

    private createEntrancePortal() {
        const floorY = caveFloorHeight(CAVE_ENTRANCE.x, CAVE_ENTRANCE.z);
        const group = new THREE.Group();
        group.position.set(CAVE_ENTRANCE.x, floorY, CAVE_ENTRANCE.z);

        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(2.6, 0.28, 8, 26),
            new THREE.MeshStandardMaterial({ color: 0x4a4438, roughness: 0.8, metalness: 0.3, flatShading: true })
        );
        ring.position.y = 2.7;
        group.add(ring);

        const veil = new THREE.Mesh(
            new THREE.CircleGeometry(2.4, 28),
            new THREE.MeshBasicMaterial({ color: 0x6fd6ff, transparent: true, opacity: 0.32, side: THREE.DoubleSide, toneMapped: false })
        );
        veil.position.y = 2.7;
        group.add(veil);

        const light = new THREE.PointLight(0x6fd6ff, 3, 20, 2);
        light.position.y = 2.8;
        group.add(light);
        this.ambientLights.push({ light, base: 3, phase: 0 });

        this.addStatic(group);

        this.addPortal({
            id: "cave-to-main",
            position: new THREE.Vector3(CAVE_ENTRANCE.x, floorY, CAVE_ENTRANCE.z),
            radius: 2.6,
            targetLocationId: "main-world",
            targetSpawnPoint: new THREE.Vector3(0, 0, 0),
            mesh: group,
        });
    }

    private createBossArenaMood() {
        const positions = [
            { x: -14, z: -122 },
            { x: 15, z: -126 },
            { x: 0, z: -146 },
        ];

        for (const spot of positions) {
            const floorY = caveFloorHeight(spot.x, spot.z);
            const light = new THREE.PointLight(0xff4530, 1.1, 26, 2);
            light.position.set(spot.x, floorY + 2.4, spot.z);
            light.castShadow = false;
            this.addStatic(light);
            this.ambientLights.push({ light, base: 1.1, phase: Math.random() * Math.PI * 2 });

            const ember = new THREE.Mesh(
                new THREE.IcosahedronGeometry(0.4, 0),
                new THREE.MeshBasicMaterial({ color: 0xff5a34, toneMapped: false })
            );
            ember.position.set(spot.x, floorY + 0.5, spot.z);
            this.addStatic(ember);
        }
    }

    private createLantern() {
        this.lantern = new THREE.PointLight(0xffd2a1, 2.6, 30, 2);
        this.lantern.castShadow = false;
        this.addStatic(this.lantern);
    }

    private createDust() {
        const positions = new Float32Array(DUST_COUNT * 3);
        const random = createRandom(CAVE_SEED + 77);

        for (let i = 0; i < DUST_COUNT; i++) {
            positions[i * 3] = (random() - 0.5) * DUST_RADIUS * 2;
            positions[i * 3 + 1] = random() * 6;
            positions[i * 3 + 2] = (random() - 0.5) * DUST_RADIUS * 2;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        this.dust = new THREE.Points(geometry, new THREE.PointsMaterial({
            color: 0xbcd0e0,
            size: 0.055,
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
            sizeAttenuation: true,
            fog: true,
        }));
        this.dust.frustumCulled = false;
        this.addStatic(this.dust);
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
    }

    public markChestOpened(chestId: string) {
        const chest = this.chests.find((item) => item.id === chestId);
        if (!chest || chest.opened) return;
        chest.opened = true;
    }

    private openSecret(door: SecretDoor) {
        if (door.opened) return;
        if (door.definition.requiresBoss && !this.bossDefeated) return;

        door.opened = true;
        this.rebuildColliders();
        this.onSecretFound?.(door.definition.id);
    }

    update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        this.time += delta;

        this.updateLantern(playerPosition, delta);
        this.updateDust(playerPosition);
        this.updateDoors(delta);
        this.updateChests(delta);
        this.updateInteractions(playerPosition, isEPressed === true);

        for (const entry of this.ambientLights) {
            entry.light.intensity = entry.base * (0.72 + Math.sin(this.time * 2.6 + entry.phase) * 0.28);
        }
    }

    private updateLantern(playerPosition: THREE.Vector3, delta: number) {
        if (!this.lantern) return;

        this.lanternFlicker += delta * 9;
        const flicker = 0.86 + Math.sin(this.lanternFlicker) * 0.06 + Math.sin(this.lanternFlicker * 2.7) * 0.04;

        this.lantern.position.set(playerPosition.x, playerPosition.y + LANTERN_HEIGHT, playerPosition.z);
        this.lantern.intensity = 2.6 * flicker;
    }

    private updateDust(playerPosition: THREE.Vector3) {
        if (!this.dust) return;
        this.dust.position.set(playerPosition.x, playerPosition.y, playerPosition.z);
        this.dust.rotation.y = this.time * 0.02;
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

            const glowTarget = chest.opened ? 3.4 : 1.2;
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
                ? "The seal will not break while the warden lives"
                : door.definition.prompt;
        }

        for (const chest of this.chests) {
            if (chest.opened) continue;
            const distance = Math.hypot(playerPosition.x - chest.group.position.x, playerPosition.z - chest.group.position.z);
            if (distance > bestDistance) continue;

            bestDistance = distance;
            this.activeChest = chest;
            this.activeSecret = null;
            this.activePrompt = "[E] Force the chest open";
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
        this.doors = [];
        this.chests = [];
        this.lantern = null;
        this.dust = null;
        this.ambientLights = [];
        this.collisionGrid.clear();
    }
}
