// src/features/game/world/locations/showcase/water/SeaPlane.ts
// WATER CODE — PARKED, NOT USED BY ANY ROOM RIGHT NOW.
// A large body of open water: one plane, a scrolling normal map and a low roughness so
// whatever the key light is (sun, full moon, a burning pad) lays a glitter path across
// it. Built for the launch site's coastline and pulled back out when the sea was cut
// from that set, kept because the next room that wants a sea, a lake, a reservoir or a
// flooded floor should not write this again.
// Use it from a room like this:
//   this.water = new SeaPlane(this.scene, this.bin, { center, size, level, tint });
//   this.water.create(anisotropy);          // in decorate()
//   this.water.update(delta);               // in tick()
//   this.water.dispose();                   // in dispose()
// For a small pond with ripples, koi and lilies there is GardenWater instead; this one
// is deliberately dumb and cheap so it can cover kilometres.
import * as THREE from "three";
import { AssetBin } from "../../../AssetBin";

const NORMAL_MAP = "/models/textures/garden/water_nor.webp";

export interface SeaPlaneOptions {
    center: THREE.Vector3;
    size?: [number, number];
    level?: number;
    tint?: number;
    tiling?: number;
    drift?: [number, number];
    roughness?: number;
    metalness?: number;
    normalScale?: number;
}

export class SeaPlane {
    private mesh: THREE.Mesh | null = null;
    private material: THREE.MeshStandardMaterial | null = null;
    private normal: THREE.Texture | null = null;
    private elapsed = 0;

    constructor(
        private readonly scene: THREE.Scene,
        private readonly bin: AssetBin,
        private readonly options: SeaPlaneOptions
    ) { }

    public create(anisotropy = 4) {
        const [width, depth] = this.options.size ?? [1400, 900];

        const normal = new THREE.TextureLoader().load(NORMAL_MAP);
        normal.wrapS = THREE.RepeatWrapping;
        normal.wrapT = THREE.RepeatWrapping;
        normal.anisotropy = anisotropy;
        normal.repeat.setScalar(this.options.tiling ?? 26);
        this.normal = normal;

        const material = this.bin.material(new THREE.MeshStandardMaterial({
            color: this.options.tint ?? 0x0a1526,
            roughness: this.options.roughness ?? 0.07,
            metalness: this.options.metalness ?? 0.42,
            normalMap: normal,
        }));
        const scale = this.options.normalScale ?? 0.42;
        material.normalScale.set(scale, scale);
        this.material = material;

        const mesh = new THREE.Mesh(this.bin.geometry(new THREE.PlaneGeometry(width, depth, 1, 1)), material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(this.options.center.x, this.options.level ?? this.options.center.y, this.options.center.z);
        mesh.receiveShadow = false;
        mesh.castShadow = false;
        this.scene.add(mesh);
        this.mesh = mesh;
    }

    public update(delta: number) {
        this.elapsed += delta;
        if (!this.normal) return;

        const [driftX, driftY] = this.options.drift ?? [0.008, 0.014];
        this.normal.offset.set(this.elapsed * driftX, this.elapsed * driftY);
    }

    public dispose() {
        if (this.mesh) this.scene.remove(this.mesh);
        this.normal?.dispose();
        this.mesh = null;
        this.material = null;
        this.normal = null;
    }
}
