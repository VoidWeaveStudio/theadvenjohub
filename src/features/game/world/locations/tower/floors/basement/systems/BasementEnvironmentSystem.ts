// src/features/game/world/locations/tower/floors/basement/systems/BasementEnvironmentSystem.ts
import * as THREE from "three";
import { ResourceManager } from "../../../../../../core/ResourceManager";
import { createGlowTexture } from "../utils/meshFactory";
import type { Basement } from "../Basement";
import { setupBasementSky, setupBasementFloor, setupBasementPortals } from "./BasementSceneSetup";
import type { ProceduralPortal } from "../utils/proceduralPortal";
import { LiftCrystal } from "../../../../../liftCrystal";

const HEMI_INTENSITY = 0.42;
const PLATFORM_LIGHT_HEIGHT = 52;
const PLATFORM_LIGHT_POWER = 105000;
const PLATFORM_LIGHT_PULSE = 6000;
const PLATFORM_LIGHT_SHADOW_FAR = 220;
const SINK_GLOW_POWER = 2600;
const SINK_GLOW_PULSE = 350;
const DUST_COUNT = 420;
const DUST_RADIUS = 78;
const DUST_CEILING = 26;

export class BasementEnvironmentSystem {
    public basementCrystal!: THREE.Group;
    private crystal: LiftCrystal | null = null;

    private platformLight!: THREE.PointLight;
    private sinkGlow!: THREE.PointLight;

    private sourcePortal?: ProceduralPortal;
    private sinkPortal?: ProceduralPortal;

    private skySphere?: THREE.Group;

    private baseGlowMaterial!: THREE.SpriteMaterial;

    private disposed = false;

    constructor(private floor: Basement) { }

    create(rm: ResourceManager) {
        const bgColor = 0x000000;
        this.floor.scene.background = new THREE.Color(bgColor);

        const hemi = new THREE.HemisphereLight(0xddeeff, 0x141b28, HEMI_INTENSITY);
        this.floor.scene.add(hemi);

        setupBasementSky(this.floor, rm, (skySphere) => {
            this.skySphere = skySphere;
        }, () => this.disposed);

        const { radius } = setupBasementFloor(this.floor, rm, () => this.disposed);

        const portals = setupBasementPortals(this.floor);
        this.sourcePortal = portals.source;
        this.sinkPortal = portals.sink;

        this.platformLight = new THREE.PointLight(0xcfeaff, 1, 0, 2);
        this.platformLight.power = PLATFORM_LIGHT_POWER;
        this.platformLight.position.set(0, PLATFORM_LIGHT_HEIGHT, 0);
        this.platformLight.castShadow = true;
        this.platformLight.shadow.mapSize.set(2048, 2048);
        this.platformLight.shadow.bias = -0.0006;
        this.platformLight.shadow.normalBias = 0.06;
        this.platformLight.shadow.camera.near = 2;
        this.platformLight.shadow.camera.far = PLATFORM_LIGHT_SHADOW_FAR;
        this.platformLight.shadow.camera.updateProjectionMatrix();
        this.floor.scene.add(this.platformLight);

        this.sinkGlow = new THREE.PointLight(0x22aaff, 1, 60, 2);
        this.sinkGlow.power = SINK_GLOW_POWER;
        this.sinkGlow.position.set(0, this.floor.SINK_Y - 3, 0);
        this.sinkGlow.castShadow = false;
        this.floor.scene.add(this.sinkGlow);

        this.createDustParticles();

        const glowMap = createGlowTexture();
        this.floor.textureCache.set('glow', glowMap);

        this.baseGlowMaterial = new THREE.SpriteMaterial({
            map: glowMap,
            color: 0xffcc66,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: true,
            opacity: 0.6
        });

        this.createBasementCrystal(radius);
    }

    private createDustParticles() {
        const particleCount = DUST_COUNT;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(particleCount * 3);
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * DUST_RADIUS;
            pos[i * 3] = Math.cos(angle) * r;
            pos[i * 3 + 1] = Math.random() * DUST_CEILING;
            pos[i * 3 + 2] = Math.sin(angle) * r;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({ color: 0xffddaa, size: 0.14, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
        const particles = new THREE.Points(geo, mat);
        particles.name = "dustParticles";
        this.floor.scene.add(particles);
    }

    private createBasementCrystal(radius: number) {
        this.crystal = new LiftCrystal();
        const group = this.crystal.group;

        group.position.set(radius - 6, 1.5, 0);
        group.userData.interactionId = "tower-crystal";

        this.floor.scene.add(group);
        this.basementCrystal = group;

        this.floor.collisionGrid.insert(new THREE.Box3().setFromObject(group));
    }

    update(delta: number) {
        if (this.skySphere) {
            this.skySphere.rotation.y += delta * 0.01;
        }

        if (this.basementCrystal) {
            const t = performance.now() * 0.002;
            this.basementCrystal.rotation.y += delta * 0.6;
            this.basementCrystal.position.y = 1.5 + Math.sin(t) * 0.2;

            const glow = this.basementCrystal.children.find((c: any) => c.userData.isGlow) as THREE.Mesh;
            if (glow) {
                const mat = glow.material as THREE.ShaderMaterial;
                mat.uniforms.uOpacity.value = 0.5 + Math.sin(t * 2) * 0.2;
            }
        }

        this.sourcePortal?.update(delta);
        this.sinkPortal?.update(delta);

        if (this.platformLight) {
            const t = performance.now() * 0.004;
            this.platformLight.power = PLATFORM_LIGHT_POWER + Math.sin(t) * PLATFORM_LIGHT_PULSE;
        }

        if (this.sinkGlow) {
            this.sinkGlow.power = SINK_GLOW_POWER + Math.sin(performance.now() * 0.003) * SINK_GLOW_PULSE;
        }

        const dust = this.floor.scene.getObjectByName("dustParticles") as THREE.Points;
        if (dust) {
            const positions = dust.geometry.attributes.position.array as Float32Array;
            for (let i = 0; i < positions.length / 3; i++) {
                positions[i * 3 + 1] -= delta * 0.5;
                if (positions[i * 3 + 1] < 0) {
                    positions[i * 3 + 1] = DUST_CEILING;
                }
            }
            dust.geometry.attributes.position.needsUpdate = true;
        }
    }

    dispose() {
        this.disposed = true;

        this.sourcePortal?.dispose();
        this.sinkPortal?.dispose();
        this.baseGlowMaterial.dispose();
    }
}
