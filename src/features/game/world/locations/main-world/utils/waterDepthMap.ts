// src/features/game/world/locations/main-world/utils/waterDepthMap.ts
import * as THREE from "three";

export interface DepthMap {
    texture: THREE.DataTexture;
    origin: number;
    scale: number;
}

export function bakeTerrainDepthMap(
    heightAt: (x: number, z: number) => number,
    extent: number,
    resolution: number
): DepthMap {
    const data = new Uint16Array(resolution * resolution);
    const half = extent / 2;
    const step = extent / (resolution - 1);

    for (let iz = 0; iz < resolution; iz++) {
        const worldZ = -half + iz * step;
        const row = iz * resolution;

        for (let ix = 0; ix < resolution; ix++) {
            const worldX = -half + ix * step;
            data[row + ix] = THREE.DataUtils.toHalfFloat(heightAt(worldX, worldZ));
        }
    }

    const texture = new THREE.DataTexture(
        data,
        resolution,
        resolution,
        THREE.RedFormat,
        THREE.HalfFloatType
    );

    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;

    return { texture, origin: -half, scale: 1 / extent };
}

export function createWaterNormalTexture(size = 256): THREE.DataTexture {
    const data = new Uint8Array(size * size * 4);

    const hash = (x: number, y: number, seed: number) => {
        let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed, 362437);
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
    };

    const noise = (x: number, y: number, seed: number, period: number) => {
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const fx = x - ix;
        const fy = y - iy;
        const ux = fx * fx * (3 - 2 * fx);
        const uy = fy * fy * (3 - 2 * fy);

        const wrap = (v: number) => ((v % period) + period) % period;

        const a = hash(wrap(ix), wrap(iy), seed);
        const b = hash(wrap(ix + 1), wrap(iy), seed);
        const c = hash(wrap(ix), wrap(iy + 1), seed);
        const d = hash(wrap(ix + 1), wrap(iy + 1), seed);

        return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy;
    };

    const heightAt = (px: number, py: number) => {
        const u = px / size;
        const v = py / size;
        let value = 0;
        let amplitude = 1;
        let total = 0;
        let period = 8;

        for (let octave = 0; octave < 4; octave++) {
            value += amplitude * noise(u * period, v * period, 91 + octave * 57, period);
            total += amplitude;
            amplitude *= 0.5;
            period *= 2;
        }

        return value / total;
    };

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const left = heightAt((x - 1 + size) % size, y);
            const right = heightAt((x + 1) % size, y);
            const down = heightAt(x, (y - 1 + size) % size);
            const up = heightAt(x, (y + 1) % size);

            const nx = (left - right) * 2.6;
            const ny = (down - up) * 2.6;
            const nz = 1;
            const length = Math.hypot(nx, ny, nz);

            const offset = (y * size + x) * 4;
            data[offset] = Math.round(((nx / length) * 0.5 + 0.5) * 255);
            data[offset + 1] = Math.round(((ny / length) * 0.5 + 0.5) * 255);
            data[offset + 2] = Math.round(((nz / length) * 0.5 + 0.5) * 255);
            data[offset + 3] = 255;
        }
    }

    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;

    return texture;
}
