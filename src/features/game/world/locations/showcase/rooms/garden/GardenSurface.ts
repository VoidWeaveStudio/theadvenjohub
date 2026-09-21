// src/features/game/world/locations/showcase/rooms/garden/GardenSurface.ts
import * as THREE from "three";

export const SURFACE_PATH = 0;
export const SURFACE_BED = 1;
export const SURFACE_STONE = 2;
export const SURFACE_GRASS = 3;

export class GardenSurface {
    private readonly channels: Float32Array[] = [];
    private readonly step: number;
    private texture: THREE.DataTexture | null = null;

    constructor(private readonly extent: number, private readonly resolution: number) {
        this.step = (extent * 2) / resolution;
        for (let i = 0; i < 4; i++) this.channels.push(new Float32Array(resolution * resolution));
        this.channels[SURFACE_GRASS].fill(1);
    }

    private indexOf(ix: number, iz: number): number {
        return iz * this.resolution + ix;
    }

    private toCell(world: number): number {
        return (world + this.extent) / this.step;
    }

    private paint(channel: number, ix: number, iz: number, value: number) {
        if (ix < 0 || iz < 0 || ix >= this.resolution || iz >= this.resolution) return;
        const target = this.channels[channel];
        const index = this.indexOf(ix, iz);
        if (channel === SURFACE_GRASS) target[index] = Math.min(target[index], value);
        else target[index] = Math.max(target[index], value);
    }

    public disc(channel: number, x: number, z: number, radius: number, feather = 2, strength = 1) {
        const outer = radius + feather;
        const minX = Math.max(0, Math.floor(this.toCell(x - outer)));
        const maxX = Math.min(this.resolution - 1, Math.ceil(this.toCell(x + outer)));
        const minZ = Math.max(0, Math.floor(this.toCell(z - outer)));
        const maxZ = Math.min(this.resolution - 1, Math.ceil(this.toCell(z + outer)));
        const clear = channel === SURFACE_GRASS;

        for (let iz = minZ; iz <= maxZ; iz++) {
            const wz = -this.extent + (iz + 0.5) * this.step;
            for (let ix = minX; ix <= maxX; ix++) {
                const wx = -this.extent + (ix + 0.5) * this.step;
                const distance = Math.hypot(wx - x, wz - z);
                if (distance > outer) continue;
                const falloff = 1 - THREE.MathUtils.smoothstep(distance, radius - feather, outer);
                this.paint(channel, ix, iz, clear ? 1 - falloff * strength : falloff * strength);
            }
        }
    }

    public stripe(
        channel: number,
        x1: number,
        z1: number,
        x2: number,
        z2: number,
        halfWidth: number,
        feather = 1.6,
        strength = 1
    ) {
        const outer = halfWidth + feather;
        const minX = Math.max(0, Math.floor(this.toCell(Math.min(x1, x2) - outer)));
        const maxX = Math.min(this.resolution - 1, Math.ceil(this.toCell(Math.max(x1, x2) + outer)));
        const minZ = Math.max(0, Math.floor(this.toCell(Math.min(z1, z2) - outer)));
        const maxZ = Math.min(this.resolution - 1, Math.ceil(this.toCell(Math.max(z1, z2) + outer)));
        const dx = x2 - x1;
        const dz = z2 - z1;
        const lengthSquared = Math.max(1e-5, dx * dx + dz * dz);
        const clear = channel === SURFACE_GRASS;

        for (let iz = minZ; iz <= maxZ; iz++) {
            const wz = -this.extent + (iz + 0.5) * this.step;
            for (let ix = minX; ix <= maxX; ix++) {
                const wx = -this.extent + (ix + 0.5) * this.step;
                const t = THREE.MathUtils.clamp(((wx - x1) * dx + (wz - z1) * dz) / lengthSquared, 0, 1);
                const distance = Math.hypot(wx - (x1 + dx * t), wz - (z1 + dz * t));
                if (distance > outer) continue;
                const wobble = 1 - Math.sin((t * 17 + distance * 2.3) * 1.9) * 0.12;
                const falloff = (1 - THREE.MathUtils.smoothstep(distance, halfWidth - feather, outer)) * wobble;
                this.paint(channel, ix, iz, clear ? 1 - falloff * strength : Math.min(1, falloff * strength));
            }
        }
    }

    public box(channel: number, x: number, z: number, halfX: number, halfZ: number, rotation: number, feather = 1) {
        const reach = Math.hypot(halfX, halfZ) + feather;
        const minX = Math.max(0, Math.floor(this.toCell(x - reach)));
        const maxX = Math.min(this.resolution - 1, Math.ceil(this.toCell(x + reach)));
        const minZ = Math.max(0, Math.floor(this.toCell(z - reach)));
        const maxZ = Math.min(this.resolution - 1, Math.ceil(this.toCell(z + reach)));
        const cos = Math.cos(-rotation);
        const sin = Math.sin(-rotation);
        const clear = channel === SURFACE_GRASS;

        for (let iz = minZ; iz <= maxZ; iz++) {
            const wz = -this.extent + (iz + 0.5) * this.step;
            for (let ix = minX; ix <= maxX; ix++) {
                const wx = -this.extent + (ix + 0.5) * this.step;
                const rx = (wx - x) * cos - (wz - z) * sin;
                const rz = (wx - x) * sin + (wz - z) * cos;
                const edge = Math.max(Math.abs(rx) - halfX, Math.abs(rz) - halfZ);
                if (edge > feather) continue;
                const falloff = 1 - THREE.MathUtils.smoothstep(edge, -feather, feather);
                this.paint(channel, ix, iz, clear ? 1 - falloff : falloff);
            }
        }
    }

    public sample(channel: number, x: number, z: number): number {
        const ix = Math.round(this.toCell(x) - 0.5);
        const iz = Math.round(this.toCell(z) - 0.5);
        if (ix < 0 || iz < 0 || ix >= this.resolution || iz >= this.resolution) return channel === SURFACE_GRASS ? 1 : 0;
        return this.channels[channel][this.indexOf(ix, iz)];
    }

    public build(): THREE.DataTexture {
        if (this.texture) return this.texture;

        const size = this.resolution;
        const data = new Uint8Array(size * size * 4);

        for (let i = 0; i < size * size; i++) {
            const path = this.channels[SURFACE_PATH][i];
            const bed = this.channels[SURFACE_BED][i];
            const stone = this.channels[SURFACE_STONE][i];
            const hard = Math.max(stone, Math.max(path * 0.85, bed * 0.6));
            const grass = this.channels[SURFACE_GRASS][i] * (1 - hard);

            data[i * 4] = Math.round(THREE.MathUtils.clamp(path, 0, 1) * 255);
            data[i * 4 + 1] = Math.round(THREE.MathUtils.clamp(bed, 0, 1) * 255);
            data[i * 4 + 2] = Math.round(THREE.MathUtils.clamp(stone, 0, 1) * 255);
            data[i * 4 + 3] = Math.round(THREE.MathUtils.clamp(grass, 0, 1) * 255);
        }

        const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        this.texture = texture;
        return texture;
    }

    public get origin(): number {
        return -this.extent;
    }

    public get scale(): number {
        return 1 / (this.extent * 2);
    }

    public dispose() {
        this.texture?.dispose();
        this.texture = null;
    }
}
