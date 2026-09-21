// src/features/game/world/locations/showcase/rooms/garden/GardenWater.ts
import * as THREE from "three";
import { Water } from "three/examples/jsm/objects/Water.js";
import { AssetBin } from "../../../../AssetBin";
import { GARDEN_SUN_COLOR, GARDEN_SUN_DIRECTION } from "./gardenShading";
import { causticTexture, foamTexture, lilyPadTexture, rippleTexture, type GardenSurfaceTextures } from "./gardenTextures";

const RIPPLE_POOL = 14;
const KOI_COUNT = 11;
const LILY_COUNT = 18;

interface Ripple {
    mesh: THREE.Mesh;
    material: THREE.MeshBasicMaterial;
    life: number;
    duration: number;
    size: number;
    active: boolean;
}

interface Koi {
    group: THREE.Group;
    radius: number;
    speed: number;
    phase: number;
    depth: number;
}

export class GardenWater {
    private water: Water | null = null;
    private caustics: THREE.Mesh | null = null;
    private causticsMap: THREE.CanvasTexture | null = null;
    private foam: THREE.Mesh | null = null;
    private foamMap: THREE.CanvasTexture | null = null;
    private ripples: Ripple[] = [];
    private koi: Koi[] = [];
    private lilies: THREE.Mesh[] = [];
    private rippleTimer = 1.4;
    private elapsed = 0;
    private hidden: THREE.Object3D[] = [];

    constructor(
        private readonly scene: THREE.Scene,
        private readonly bin: AssetBin,
        private readonly random: () => number,
        private readonly center: THREE.Vector3,
        private readonly radius: number,
        private readonly islandRadius: number,
        private readonly reflective: boolean
    ) { }

    public create(textures: GardenSurfaceTextures) {
        this.buildBed(textures);
        this.buildSurface(textures);
        this.buildCaustics();
        this.buildFoam();
        this.buildRipples();
        this.buildLilies();
        this.buildKoi();
    }

    public setReflectionExcludes(objects: THREE.Object3D[]) {
        this.hidden = objects;
    }

    private buildBed(textures: GardenSurfaceTextures) {
        const material = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0x5f7a5c,
            roughness: 0.96,
            metalness: 0,
            side: THREE.DoubleSide,
            map: textures.bed.map.clone(),
            normalMap: textures.bed.normal.clone(),
        }));
        material.map!.repeat.set(5, 5);
        material.map!.needsUpdate = true;
        material.normalMap!.repeat.set(5, 5);
        material.normalMap!.needsUpdate = true;
        this.bin.texture(material.map!);
        this.bin.texture(material.normalMap!);

        const bowl = new THREE.Mesh(
            this.bin.geometry(new THREE.CylinderGeometry(this.radius + 0.2, this.radius - 2.6, 2.2, 64, 1, true)),
            material
        );
        bowl.position.set(this.center.x, -1.0, this.center.z);
        bowl.receiveShadow = true;
        this.scene.add(bowl);

        const floor = new THREE.Mesh(
            this.bin.geometry(new THREE.CircleGeometry(this.radius - 2.4, 56)),
            material
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(this.center.x, -2.05, this.center.z);
        floor.receiveShadow = true;
        this.scene.add(floor);
    }

    private buildSurface(textures: GardenSurfaceTextures) {
        const size = this.reflective ? 256 : 64;
        const normals = textures.waterNormal.clone();
        normals.wrapS = THREE.RepeatWrapping;
        normals.wrapT = THREE.RepeatWrapping;
        this.bin.texture(normals);

        const water = new Water(this.bin.geometry(new THREE.CircleGeometry(this.radius, 72)), {
            textureWidth: size,
            textureHeight: size,
            waterNormals: normals,
            sunDirection: GARDEN_SUN_DIRECTION.clone(),
            sunColor: GARDEN_SUN_COLOR,
            waterColor: 0x1f5b52,
            distortionScale: 1.9,
            alpha: 0.9,
            fog: true,
        });

        water.rotation.x = -Math.PI / 2;
        water.position.set(this.center.x, 0.12, this.center.z);
        water.material.transparent = true;
        water.material.uniforms.size.value = 3.4;
        water.renderOrder = 2;
        this.bin.material(water.material);

        const interval = this.reflective ? 1 : 4;
        const original = water.onBeforeRender;
        let frame = 0;

        water.onBeforeRender = (renderer, scene, camera, geometry, material, group) => {
            if (frame++ % interval !== 0) return;

            const restore: boolean[] = [];
            for (const object of this.hidden) {
                restore.push(object.visible);
                object.visible = false;
            }
            original.call(water, renderer, scene, camera, geometry, material, group);
            for (let i = 0; i < this.hidden.length; i++) this.hidden[i].visible = restore[i];
        };

        this.scene.add(water);
        this.water = water;
    }

    private buildCaustics() {
        const map = causticTexture(this.bin, this.random);
        map.repeat.set(2.6, 2.6);
        this.causticsMap = map;

        const material = this.bin.material(new THREE.MeshBasicMaterial({
            map,
            transparent: true,
            opacity: 0.4,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            fog: false,
        }));

        const mesh = new THREE.Mesh(this.bin.geometry(new THREE.CircleGeometry(this.radius - 2.5, 48)), material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(this.center.x, -1.98, this.center.z);
        mesh.renderOrder = 1;
        this.scene.add(mesh);
        this.caustics = mesh;
    }

    private buildFoam() {
        const map = foamTexture(this.bin, this.random);
        map.repeat.set(16, 1);
        this.foamMap = map;

        const material = this.bin.material(new THREE.MeshBasicMaterial({
            map,
            color: 0xe8f8ff,
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
            toneMapped: false,
            side: THREE.DoubleSide,
        }));

        const mesh = new THREE.Mesh(
            this.bin.geometry(new THREE.RingGeometry(this.radius - 1.5, this.radius + 0.35, 72)),
            material
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(this.center.x, 0.17, this.center.z);
        mesh.renderOrder = 3;
        this.scene.add(mesh);
        this.foam = mesh;
    }

    private buildRipples() {
        const map = rippleTexture(this.bin);
        const geometry = this.bin.geometry(new THREE.PlaneGeometry(1, 1));

        for (let i = 0; i < RIPPLE_POOL; i++) {
            const material = this.bin.material(new THREE.MeshBasicMaterial({
                map,
                transparent: true,
                opacity: 0,
                depthWrite: false,
                toneMapped: false,
                blending: THREE.AdditiveBlending,
            }));

            const mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(this.center.x, 0.19, this.center.z);
            mesh.visible = false;
            mesh.renderOrder = 4;
            this.scene.add(mesh);

            this.ripples.push({ mesh, material, life: 0, duration: 2.6, size: 3, active: false });
        }
    }

    private buildLilies() {
        const map = lilyPadTexture(this.bin, this.random);
        const material = this.bin.material(new THREE.MeshStandardMaterial({
            map,
            transparent: true,
            alphaTest: 0.35,
            roughness: 0.62,
            metalness: 0,
            side: THREE.DoubleSide,
        }));
        const geometry = this.bin.geometry(new THREE.PlaneGeometry(1, 1));
        const bloom = this.bin.material(new THREE.MeshStandardMaterial({
            color: 0xffc2e0,
            emissive: 0xff9fc8,
            emissiveIntensity: 0.22,
            roughness: 0.55,
        }));
        const bloomGeometry = this.bin.geometry(new THREE.SphereGeometry(0.16, 10, 8));

        for (let i = 0; i < LILY_COUNT; i++) {
            const angle = this.random() * Math.PI * 2;
            const distance = this.islandRadius + 1.6 + this.random() * (this.radius - this.islandRadius - 3.4);
            const pad = new THREE.Mesh(geometry, material);
            const size = 1.5 + this.random() * 1.1;

            pad.scale.set(size, size, 1);
            pad.rotation.x = -Math.PI / 2;
            pad.rotation.z = this.random() * Math.PI * 2;
            pad.position.set(
                this.center.x + Math.cos(angle) * distance,
                0.16,
                this.center.z + Math.sin(angle) * distance
            );
            pad.renderOrder = 3;
            pad.receiveShadow = true;
            this.scene.add(pad);
            this.lilies.push(pad);

            if (this.random() < 0.42) {
                const flower = new THREE.Mesh(bloomGeometry, bloom);
                flower.position.set(0, 0, 0.2);
                flower.scale.setScalar(1 / size);
                pad.add(flower);
            }
        }
    }

    private buildKoi() {
        const materials = [
            this.bin.material(new THREE.MeshStandardMaterial({ color: 0xff8a4a, roughness: 0.45, metalness: 0.05 })),
            this.bin.material(new THREE.MeshStandardMaterial({ color: 0xfaf4ee, roughness: 0.45, metalness: 0.05 })),
            this.bin.material(new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.45, metalness: 0.05 })),
            this.bin.material(new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.5, metalness: 0.05 })),
        ];

        const body = this.bin.geometry(new THREE.CapsuleGeometry(0.16, 0.44, 5, 9));
        const tail = this.bin.geometry(new THREE.ConeGeometry(0.2, 0.42, 5, 1, true));
        const fin = this.bin.geometry(new THREE.CircleGeometry(0.15, 7, 0, Math.PI));

        for (let i = 0; i < KOI_COUNT; i++) {
            const material = materials[i % materials.length];
            const group = new THREE.Group();

            const trunk = new THREE.Mesh(body, material);
            trunk.rotation.x = Math.PI / 2;
            trunk.scale.set(1, 1, 0.58);
            group.add(trunk);

            const fan = new THREE.Mesh(tail, material);
            fan.rotation.x = -Math.PI / 2;
            fan.position.z = -0.48;
            fan.scale.set(0.8, 1, 0.35);
            group.add(fan);

            for (const side of [-1, 1]) {
                const wing = new THREE.Mesh(fin, material);
                wing.rotation.set(-Math.PI / 2, 0, side * 1.1);
                wing.position.set(side * 0.13, -0.02, 0.06);
                wing.scale.set(1, 0.7, 1);
                group.add(wing);
            }

            group.scale.setScalar(0.9 + this.random() * 0.7);
            this.scene.add(group);

            this.koi.push({
                radius: this.islandRadius + 1.4 + this.random() * (this.radius - this.islandRadius - 3),
                speed: 0.2 + this.random() * 0.26,
                phase: this.random() * Math.PI * 2,
                depth: -0.18 - this.random() * 0.5,
                group,
            });
        }
    }

    public splash(x: number, z: number, size = 3) {
        for (const ripple of this.ripples) {
            if (ripple.active) continue;
            ripple.active = true;
            ripple.life = 0;
            ripple.duration = 2.2 + this.random() * 1.4;
            ripple.size = size;
            ripple.mesh.position.set(x, 0.19, z);
            ripple.mesh.visible = true;
            return;
        }
    }

    public update(delta: number) {
        this.elapsed += delta;

        if (this.water) {
            this.water.material.uniforms.time.value += delta * 0.42;
        }

        if (this.causticsMap) {
            this.causticsMap.offset.set(
                Math.sin(this.elapsed * 0.12) * 0.09 + this.elapsed * 0.014,
                Math.cos(this.elapsed * 0.16) * 0.09
            );
        }

        if (this.caustics) {
            const material = this.caustics.material as THREE.MeshBasicMaterial;
            material.opacity = 0.3 + Math.sin(this.elapsed * 0.9) * 0.1;
        }

        if (this.foamMap) this.foamMap.offset.x = this.elapsed * 0.035;
        if (this.foam) {
            const material = this.foam.material as THREE.MeshBasicMaterial;
            material.opacity = 0.34 + Math.sin(this.elapsed * 1.3) * 0.12;
            const pulse = 1 + Math.sin(this.elapsed * 0.8) * 0.004;
            this.foam.scale.set(pulse, pulse, 1);
        }

        for (let i = 0; i < this.lilies.length; i++) {
            const pad = this.lilies[i];
            pad.position.y = 0.16 + Math.sin(this.elapsed * 0.7 + i * 1.3) * 0.025;
            pad.rotation.z += delta * 0.03 * (i % 2 === 0 ? 1 : -1);
        }

        for (let i = 0; i < this.koi.length; i++) {
            const fish = this.koi[i];
            const angle = this.elapsed * fish.speed + fish.phase;
            const wobble = Math.sin(this.elapsed * 1.7 + fish.phase) * 0.06;
            fish.group.position.set(
                this.center.x + Math.cos(angle) * fish.radius,
                fish.depth + wobble,
                this.center.z + Math.sin(angle) * fish.radius
            );
            fish.group.rotation.y = -angle + Math.PI / 2;
            fish.group.rotation.z = Math.sin(this.elapsed * 4 + fish.phase) * 0.14;
        }

        this.rippleTimer -= delta;
        if (this.rippleTimer <= 0) {
            this.rippleTimer = 0.7 + this.random() * 2.2;
            const angle = this.random() * Math.PI * 2;
            const distance = this.islandRadius + this.random() * (this.radius - this.islandRadius - 1.5);
            this.splash(
                this.center.x + Math.cos(angle) * distance,
                this.center.z + Math.sin(angle) * distance,
                1.6 + this.random() * 3.4
            );
        }

        for (const ripple of this.ripples) {
            if (!ripple.active) continue;
            ripple.life += delta;
            const t = ripple.life / ripple.duration;
            if (t >= 1) {
                ripple.active = false;
                ripple.mesh.visible = false;
                ripple.material.opacity = 0;
                continue;
            }
            const scale = ripple.size * (0.25 + t * 1.5);
            ripple.mesh.scale.set(scale, scale, 1);
            ripple.material.opacity = (1 - t) * 0.6;
        }
    }

    public dispose() {
        if (this.water) {
            this.scene.remove(this.water);
            this.water.geometry.dispose();
            this.water.material.dispose();
        }
        this.water = null;
        this.caustics = null;
        this.foam = null;
        this.ripples = [];
        this.koi = [];
        this.lilies = [];
        this.hidden = [];
    }
}
