// src/features/game/world/locations/tower/floors/basement/systems/BasementEnvironmentSystem.ts
import * as THREE from "three";
import { ResourceManager } from "../../../../../../core/ResourceManager";
import { createGlowTexture, createGlowSphere } from "../utils/meshFactory";
import type { Basement } from "../Basement";
import { setupBasementSky, setupBasementFloor, setupBasementPortals } from "./BasementSceneSetup";
import type { ProceduralPortal } from "../utils/proceduralPortal";

export class BasementEnvironmentSystem {
    public basementCrystal!: THREE.Group;

    private portalLight!: THREE.PointLight;
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

        const hemi = new THREE.HemisphereLight(0xddeeff, 0x0a0d14, 0.16);
        this.floor.scene.add(hemi);

        setupBasementSky(this.floor, rm, (skySphere) => {
            this.skySphere = skySphere;
        }, () => this.disposed);

        const { radius } = setupBasementFloor(this.floor, rm, () => this.disposed);

        const portals = setupBasementPortals(this.floor);
        this.sourcePortal = portals.source;
        this.sinkPortal = portals.sink;

        this.portalLight = new THREE.PointLight(0xcfeaff, 1, 0, 2);
        this.portalLight.power = 7000;
        this.portalLight.position.set(0, this.floor.HOLE_Y - 1.5, 0);
        this.portalLight.castShadow = true;
        this.portalLight.shadow.mapSize.set(2048, 2048);
        this.portalLight.shadow.bias = -0.0006;
        this.portalLight.shadow.normalBias = 0.03;
        this.portalLight.shadow.camera.near = 1;
        this.portalLight.shadow.camera.far = 160;
        this.portalLight.shadow.camera.updateProjectionMatrix();
        this.floor.scene.add(this.portalLight);

        this.sinkGlow = new THREE.PointLight(0x22aaff, 1, 60, 2);
        this.sinkGlow.power = 1800;
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
        const particleCount = 200;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(particleCount * 3);
        for (let i = 0; i < particleCount; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 15;
            pos[i * 3 + 1] = Math.random() * 14;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 15;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({ color: 0xffddaa, size: 0.08, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
        const particles = new THREE.Points(geo, mat);
        particles.name = "dustParticles";
        this.floor.scene.add(particles);
    }

    private createBasementCrystal(radius: number) {
        const group = new THREE.Group();

        const core = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.8, 1),
            new THREE.MeshStandardMaterial({
                color: 0x66ccff,
                emissive: 0x3399ff,
                emissiveIntensity: 2,
                metalness: 0,
                roughness: 0.2
            })
        );

        const shell = new THREE.Mesh(
            new THREE.OctahedronGeometry(1.5, 1),
            new THREE.MeshPhysicalMaterial({
                color: 0x99ddff,
                transmission: 1,
                opacity: 0.6,
                transparent: true,
                roughness: 0,
                metalness: 0,
                thickness: 0.5
            })
        );

        const glow = createGlowSphere(1.5, 0x66ccff, 0.6, 1.6);

        const light = new THREE.PointLight(0x66ccff, 7, 20);
        light.position.set(0, 1.5, 0);
        light.castShadow = false;

        group.add(core);
        group.add(shell);
        group.add(glow);
        group.add(light);

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

        if (this.portalLight) {
            const t = performance.now() * 0.004;
            this.portalLight.power = 7000 + Math.sin(t) * 700;
        }

        if (this.sinkGlow) {
            this.sinkGlow.power = 1800 + Math.sin(performance.now() * 0.003) * 250;
        }

        const dust = this.floor.scene.getObjectByName("dustParticles") as THREE.Points;
        if (dust) {
            const positions = dust.geometry.attributes.position.array as Float32Array;
            for (let i = 0; i < positions.length / 3; i++) {
                positions[i * 3 + 1] -= delta * 0.5;
                if (positions[i * 3 + 1] < 0) {
                    positions[i * 3 + 1] = 14;
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
