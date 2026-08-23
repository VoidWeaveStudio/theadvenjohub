// src/features/game/world/locations/tower/floors/first-floor/systems/CanyonAtmosphereSystem.ts
import * as THREE from "three";
import { CanyonBiome } from "../utils/canyonBiomes";
import { canyonHeight, terrainCenterX, wallCrestHeight, wallFootDistance } from "../utils/canyonTerrain";

const DUST_SPAN_X = 110;
const DUST_SPAN_Y = 46;
const DUST_SPAN_Z = 110;
const DUST_BASE_COUNT = 900;

const SHAFT_COUNT = 7;
const SHAFT_SPACING = 46;
const SHAFT_WIDTH = 22;
const SHAFT_LENGTH = 130;

function createDustSprite(): THREE.Texture {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;

    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.35, "rgba(255,255,255,0.55)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function createShaftTexture(): THREE.Texture {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;

    const vertical = ctx.createLinearGradient(0, 0, 0, 256);
    vertical.addColorStop(0, "rgba(255,255,255,0.95)");
    vertical.addColorStop(0.45, "rgba(255,255,255,0.4)");
    vertical.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = vertical;
    ctx.fillRect(0, 0, 64, 256);

    const horizontal = ctx.createLinearGradient(0, 0, 64, 0);
    horizontal.addColorStop(0, "rgba(0,0,0,1)");
    horizontal.addColorStop(0.5, "rgba(0,0,0,0)");
    horizontal.addColorStop(1, "rgba(0,0,0,1)");
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = horizontal;
    ctx.fillRect(0, 0, 64, 256);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

export class CanyonAtmosphereSystem {
    private readonly dust: THREE.Points;
    private readonly dustMaterial: THREE.PointsMaterial;
    private readonly dustSprite: THREE.Texture;
    private readonly dustVelocity: Float32Array;
    private dustCount: number;

    private readonly shafts: THREE.Mesh[] = [];
    private readonly shaftGroup = new THREE.Group();
    private readonly shaftMaterial: THREE.MeshBasicMaterial | null = null;
    private readonly shaftTexture: THREE.Texture | null = null;

    private readonly sunDirection = new THREE.Vector3(0.4, 0.5, 0.7);
    private readonly center = new THREE.Vector3(NaN, NaN, NaN);
    private shaftSide: -1 | 1 = 1;

    constructor(private readonly scene: THREE.Scene, private readonly highQuality: boolean) {
        this.dustCount = Math.round(DUST_BASE_COUNT * (highQuality ? 1 : 0.35));

        const positions = new Float32Array(this.dustCount * 3);
        this.dustVelocity = new Float32Array(this.dustCount * 3);

        for (let i = 0; i < this.dustCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * DUST_SPAN_X;
            positions[i * 3 + 1] = Math.random() * DUST_SPAN_Y;
            positions[i * 3 + 2] = (Math.random() - 0.5) * DUST_SPAN_Z;

            this.dustVelocity[i * 3] = 0.4 + Math.random() * 1.1;
            this.dustVelocity[i * 3 + 1] = (Math.random() - 0.35) * 0.35;
            this.dustVelocity[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        this.dustSprite = createDustSprite();
        this.dustMaterial = new THREE.PointsMaterial({
            map: this.dustSprite,
            color: 0xe2c79f,
            size: 0.55,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
            fog: true,
        });

        this.dust = new THREE.Points(geometry, this.dustMaterial);
        this.dust.frustumCulled = false;
        this.dust.renderOrder = 5;
        this.scene.add(this.dust);

        if (highQuality) {
            this.shaftTexture = createShaftTexture();
            this.shaftMaterial = new THREE.MeshBasicMaterial({
                map: this.shaftTexture,
                color: 0xffe7c0,
                transparent: true,
                opacity: 0.1,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                fog: false,
                toneMapped: false,
            });

            const geometry = new THREE.PlaneGeometry(SHAFT_WIDTH, SHAFT_LENGTH);
            geometry.translate(0, -SHAFT_LENGTH / 2, 0);

            for (let i = 0; i < SHAFT_COUNT; i++) {
                const shaft = new THREE.Mesh(geometry, this.shaftMaterial);
                shaft.frustumCulled = false;
                shaft.renderOrder = 6;
                this.shafts.push(shaft);
                this.shaftGroup.add(shaft);
            }

            this.scene.add(this.shaftGroup);
        }
    }

    public applyBiome(biome: CanyonBiome, sunDirection: THREE.Vector3) {
        this.sunDirection.copy(sunDirection).normalize();
        this.shaftSide = this.sunDirection.x >= 0 ? 1 : -1;

        this.dustMaterial.color.setHex(biome.dustColor);
        this.dustMaterial.opacity = 0.22 + biome.dustDensity * 0.3;
        this.dustMaterial.size = biome.dustAdditive ? 0.7 : 0.5;
        this.dustMaterial.blending = biome.dustAdditive ? THREE.AdditiveBlending : THREE.NormalBlending;
        this.dustMaterial.toneMapped = !biome.dustAdditive;
        this.dustMaterial.needsUpdate = true;

        if (this.shaftMaterial) {
            this.shaftMaterial.color.setHex(biome.sunColor);
            this.shaftMaterial.opacity = 0.05 + biome.dustDensity * 0.07;
        }
    }

    public getDustOpacity(): number {
        return this.dustMaterial.opacity;
    }

    public setDustOpacity(value: number) {
        this.dustMaterial.opacity = Math.max(0, value);
    }

    public getShaftOpacity(): number {
        return this.shaftMaterial?.opacity ?? 0;
    }

    public setShaftOpacity(value: number) {
        if (this.shaftMaterial) this.shaftMaterial.opacity = Math.max(0, value);
    }

    public update(delta: number, playerPosition: THREE.Vector3, camera: THREE.Camera | undefined) {
        this.updateDust(delta, playerPosition);
        if (this.shafts.length > 0) this.updateShafts(playerPosition, camera);
    }

    private reseedDust(playerPosition: THREE.Vector3) {
        const attribute = this.dust.geometry.getAttribute("position") as THREE.BufferAttribute;
        const array = attribute.array as Float32Array;

        for (let i = 0; i < this.dustCount; i++) {
            const i3 = i * 3;
            array[i3] = playerPosition.x + (Math.random() - 0.5) * DUST_SPAN_X;
            array[i3 + 1] = playerPosition.y - 3 + Math.random() * DUST_SPAN_Y;
            array[i3 + 2] = playerPosition.z + (Math.random() - 0.5) * DUST_SPAN_Z;
        }

        attribute.needsUpdate = true;
    }

    private updateDust(delta: number, playerPosition: THREE.Vector3) {
        if (!Number.isFinite(this.center.x) || this.center.distanceTo(playerPosition) > 140) {
            this.center.copy(playerPosition);
            this.reseedDust(playerPosition);
            return;
        }

        this.center.copy(playerPosition);

        const attribute = this.dust.geometry.getAttribute("position") as THREE.BufferAttribute;
        const array = attribute.array as Float32Array;
        const halfX = DUST_SPAN_X / 2;
        const halfZ = DUST_SPAN_Z / 2;
        const floor = playerPosition.y - 3;

        for (let i = 0; i < this.dustCount; i++) {
            const i3 = i * 3;

            array[i3] += this.dustVelocity[i3] * delta;
            array[i3 + 1] += this.dustVelocity[i3 + 1] * delta;
            array[i3 + 2] += this.dustVelocity[i3 + 2] * delta;

            const localX = array[i3] - playerPosition.x;
            const localZ = array[i3 + 2] - playerPosition.z;

            if (localX > halfX) array[i3] -= DUST_SPAN_X;
            else if (localX < -halfX) array[i3] += DUST_SPAN_X;

            if (localZ > halfZ) array[i3 + 2] -= DUST_SPAN_Z;
            else if (localZ < -halfZ) array[i3 + 2] += DUST_SPAN_Z;

            if (array[i3 + 1] > floor + DUST_SPAN_Y) array[i3 + 1] = floor;
            else if (array[i3 + 1] < floor) array[i3 + 1] = floor + DUST_SPAN_Y;
        }

        attribute.needsUpdate = true;
    }

    private updateShafts(playerPosition: THREE.Vector3, camera: THREE.Camera | undefined) {
        const anchor = Math.round(playerPosition.z / SHAFT_SPACING) * SHAFT_SPACING;
        const cameraX = camera?.position.x ?? playerPosition.x;
        const cameraZ = camera?.position.z ?? playerPosition.z;

        for (let i = 0; i < this.shafts.length; i++) {
            const shaft = this.shafts[i];
            const z = anchor + (i - (this.shafts.length - 1) / 2) * SHAFT_SPACING;
            const side = this.shaftSide;
            const foot = wallFootDistance(z, side);
            const crest = wallCrestHeight(z, side);
            const rimX = terrainCenterX(z) + side * foot;
            const rimY = canyonHeight(rimX, z) + crest * 0.55;

            shaft.position.set(rimX - side * 6, rimY, z);

            const toCamera = Math.atan2(cameraX - shaft.position.x, cameraZ - shaft.position.z);
            shaft.rotation.set(0, toCamera, 0);
            shaft.rotateX(-Math.atan2(this.sunDirection.y, 1) * 0.55);
        }

    }

    public dispose() {
        this.scene.remove(this.dust);
        this.dust.geometry.dispose();
        this.dustMaterial.dispose();
        this.dustSprite.dispose();

        if (this.shafts.length > 0) {
            this.scene.remove(this.shaftGroup);
            this.shafts[0].geometry.dispose();
            this.shaftMaterial?.dispose();
            this.shaftTexture?.dispose();
            this.shafts.length = 0;
        }
    }
}
