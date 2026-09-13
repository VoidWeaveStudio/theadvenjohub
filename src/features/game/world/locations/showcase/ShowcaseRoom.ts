// src/features/game/world/locations/showcase/ShowcaseRoom.ts
import * as THREE from "three";
import { TowerFloor } from "../tower/TowerFloor";
import { ResourceManager } from "../../../core/ResourceManager";
import { AssetBin } from "../../AssetBin";
import { ShowcaseCrowd } from "./actors/ShowcaseCrowd";
import { SECOND_WORLD_ID, ShowcaseInfo } from "./config";
import type { HeightProvider } from "../../Location";
import { t } from "@/core/i18n";

const EXIT_RANGE = 7.5;

export function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

export abstract class ShowcaseRoom extends TowerFloor {
    protected readonly bin = new AssetBin();
    protected readonly random: () => number;
    protected readonly info: ShowcaseInfo;
    protected readonly crowd: ShowcaseCrowd;
    protected elapsed = 0;

    public terrain: HeightProvider = { getHeightAt: (x, z) => this.groundHeight(x, z) };

    protected exitPosition = new THREE.Vector3(0, 0, 0);
    protected exitFacing = 0;
    protected spawnPosition = new THREE.Vector3(0, 0, 6);
    protected spawnFacing = 0;

    private exitVeil: THREE.MeshBasicMaterial | null = null;
    private exitLight: THREE.PointLight | null = null;

    constructor(info: ShowcaseInfo, seed: number, roomRadius: number) {
        super(info.id, info.nameKey);
        this.info = info;
        this.random = makeRandom(seed);
        this.crowd = new ShowcaseCrowd(this.scene, this.bin, this.random);
        this.maxPlayerRadius = roomRadius;
        this.cameraBounds = { radius: roomRadius + 6, minY: -40, maxY: 220 };
    }

    protected matte(color: number, roughness = 0.85, metalness = 0.04): THREE.MeshStandardMaterial {
        return this.bin.material(new THREE.MeshStandardMaterial({ color, roughness, metalness }));
    }

    protected metal(color: number, roughness = 0.34, metalness = 0.88): THREE.MeshStandardMaterial {
        return this.bin.material(new THREE.MeshStandardMaterial({ color, roughness, metalness }));
    }

    protected lit(color: number, intensity = 1.6): THREE.MeshStandardMaterial {
        return this.bin.material(new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: intensity,
            roughness: 0.4,
            metalness: 0.1,
        }));
    }

    protected glow(color: number, opacity = 0.6, additive = true): THREE.MeshBasicMaterial {
        return this.bin.material(new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
            toneMapped: false,
        }));
    }

    protected mesh(
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        position?: [number, number, number],
        rotation?: [number, number, number]
    ): THREE.Mesh {
        const created = new THREE.Mesh(this.bin.geometry(geometry), material);
        if (position) created.position.set(position[0], position[1], position[2]);
        if (rotation) created.rotation.set(rotation[0], rotation[1], rotation[2]);
        created.castShadow = true;
        created.receiveShadow = true;
        return created;
    }

    protected addSolidBox(
        parent: THREE.Object3D,
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        position: [number, number, number],
        rotationY = 0,
        size?: [number, number, number]
    ): THREE.Mesh {
        const created = this.mesh(geometry, material, position, [0, rotationY, 0]);
        parent.add(created);

        if (size) {
            this.collisionGrid.insertOrientedBox(
                position[0],
                position[2],
                size[0],
                size[2],
                rotationY,
                position[1] - size[1] / 2,
                position[1] + size[1] / 2
            );
        }

        return created;
    }

    protected groundHeight(_x: number, _z: number): number {
        return 0;
    }

    create(rm: ResourceManager): void {
        this.collisionGrid.clear();
        this.crowd.setGroundProvider((x, z) => this.groundHeight(x, z));
        this.buildAtmosphere();
        this.decorate(rm);
        this.buildExitGate();
        this.crowd.create(rm, this.collisionGrid);
    }

    protected abstract buildAtmosphere(): void;
    protected abstract decorate(rm: ResourceManager): void;

    protected tick(_delta: number): void { }

    protected buildExitGate(): void {
        const group = new THREE.Group();
        group.position.copy(this.exitPosition);
        group.rotation.y = this.exitFacing;

        const stone = this.matte(this.info.gateStone, 0.76, 0.14);
        const trim = this.metal(0xd8b46a, 0.3, 0.9);

        for (const side of [-1, 1]) {
            const jamb = this.mesh(new THREE.BoxGeometry(1.1, 7.2, 1.3), stone, [side * 2.6, 3.6, 0]);
            group.add(jamb);

            const base = this.mesh(new THREE.BoxGeometry(1.7, 0.5, 1.9), trim, [side * 2.6, 0.25, 0]);
            group.add(base);
        }

        const arch = this.mesh(new THREE.TorusGeometry(2.6, 0.58, 10, 24, Math.PI), stone, [0, 7.2, 0]);
        group.add(arch);

        const keystone = this.mesh(new THREE.OctahedronGeometry(0.75, 0), trim, [0, 9.9, 0]);
        group.add(keystone);

        this.exitVeil = this.glow(this.info.accent, 0.42);
        const veil = new THREE.Mesh(this.bin.geometry(new THREE.PlaneGeometry(5.1, 7.2)), this.exitVeil);
        veil.position.set(0, 3.6, 0);
        veil.renderOrder = 4;
        group.add(veil);

        const dome = new THREE.Mesh(this.bin.geometry(new THREE.CircleGeometry(2.55, 22, 0, Math.PI)), this.exitVeil);
        dome.position.set(0, 7.2, 0);
        group.add(dome);

        const step = this.mesh(new THREE.BoxGeometry(7.4, 0.28, 2.6), trim, [0, 0.14, 1.4]);
        group.add(step);

        this.exitLight = new THREE.PointLight(this.info.accent, 18, 30, 2);
        this.exitLight.position.set(0, 4.4, 1.2);
        group.add(this.exitLight);

        this.scene.add(group);

        this.collisionGrid.insertOrientedBox(
            this.exitPosition.x,
            this.exitPosition.z,
            7.4,
            1.6,
            this.exitFacing,
            this.exitPosition.y,
            this.exitPosition.y + 8
        );
    }

    public getInteractionPrompt(playerPosition: THREE.Vector3): string | null {
        if (playerPosition.distanceTo(this.exitPosition) > EXIT_RANGE) return null;
        return t("g.showcase.exit");
    }

    override update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean): void {
        this.elapsed += delta;
        this.crowd.update(delta);
        this.tick(delta);

        if (this.exitVeil) this.exitVeil.opacity = 0.36 + Math.sin(this.elapsed * 1.7) * 0.09;
        if (this.exitLight) this.exitLight.intensity = 16 + Math.sin(this.elapsed * 2.3) * 4;

        if (isEPressed && playerPosition.distanceTo(this.exitPosition) <= EXIT_RANGE) {
            this.pendingTeleport = SECOND_WORLD_ID;
        }
    }

    getSpawnPoint(): THREE.Vector3 {
        return this.spawnPosition.clone();
    }

    dispose(): void {
        this.exitVeil = null;
        this.exitLight = null;
        super.dispose();
        this.crowd.dispose();
        this.bin.dispose();
    }
}
