//src\features\game\world\locations\main-world\systems\PortalSystem.ts
import * as THREE from "three";
import { MainWorld } from "../MainWorld";
import { ResourceManager } from "../../../../core/ResourceManager";

interface FogParticle { velocity: THREE.Vector3; life: number; maxLife: number; baseY: number; }

export class PortalSystem {
    private portalMesh: THREE.Object3D | null = null;
    private portalPosition: THREE.Vector3 | null = null;
    private portalLight: THREE.PointLight | null = null;
    private fogInstances: THREE.InstancedMesh | null = null;
    private fogMaterial: THREE.ShaderMaterial | null = null;
    private fogParticles: FogParticle[] = [];
    private readonly FOG_PARTICLE_COUNT = 300;
    private readonly FOG_RADIUS = 1;
    private readonly FOG_HEIGHT = 3;

    constructor(private world: MainWorld) { }

    createCaveEntrance(rm: ResourceManager) {
        const caveX = 50, caveZ = 0, caveY = 0, PORTAL_SINK = 0.5;
        this.portalPosition = new THREE.Vector3(caveX, caveY, caveZ);
        const portalData = rm.getModel("portal");

        if (portalData) {
            this.portalMesh = portalData.scene;
            const box = new THREE.Box3().setFromObject(this.portalMesh);
            const maxDimension = Math.max(box.getSize(new THREE.Vector3()).x, box.getSize(new THREE.Vector3()).z);
            if (maxDimension > 12) this.portalMesh.scale.setScalar(12 / maxDimension);

            this.world.scene.add(this.portalMesh);
            this.portalMesh.position.set(0, 0, 0);
            const scaledBox = new THREE.Box3().setFromObject(this.portalMesh);
            const center = scaledBox.getCenter(new THREE.Vector3());
            this.portalMesh.position.set(caveX - center.x, caveY - scaledBox.min.y - PORTAL_SINK, caveZ - center.z);
            this.portalMesh.updateMatrixWorld(true);

            this.world.vegetation.clearVegetationAroundPortal(caveX, caveZ, 8);

            this.portalMesh.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    const name = child.name.toLowerCase();
                    if (name.includes('base') || name.includes('плита') || name.includes('plate') || name.includes('monolith') || name.includes('stone') || name.includes('камень')) {
                        child.updateMatrixWorld(true);
                        const childBox = new THREE.Box3().setFromObject(child);
                        this.world.collisionGrid.insert(new THREE.Box3(
                            new THREE.Vector3(childBox.min.x, childBox.max.y - 0.01, childBox.min.z),
                            new THREE.Vector3(childBox.max.x, childBox.max.y, childBox.max.z)
                        ));
                    }
                }
            });
        } else {
            this.portalMesh = new THREE.Mesh(new THREE.TorusGeometry(3, 0.5, 8, 16, Math.PI), new THREE.MeshStandardMaterial({ color: 0x555555 }));
            this.portalMesh.position.set(caveX, caveY - PORTAL_SINK, caveZ);
            this.portalMesh.rotation.x = Math.PI;
            this.world.scene.add(this.portalMesh);
        }

        this.portalLight = new THREE.PointLight(0x4488ff, 2, 15);
        this.portalLight.position.set(caveX, caveY + 2 - PORTAL_SINK, caveZ);
        this.world.scene.add(this.portalLight);

        this.createFogParticles(caveX, caveY - PORTAL_SINK, caveZ);
        this.world.addPortal({ id: "main-to-cave", position: new THREE.Vector3(caveX, caveY, caveZ), radius: 3, targetLocationId: "cave", targetSpawnPoint: new THREE.Vector3(0, 0, 0), mesh: this.portalMesh });
    }

    private createFogParticles(centerX: number, centerY: number, centerZ: number) {
        this.fogMaterial = new THREE.ShaderMaterial({
            uniforms: { uColor: { value: new THREE.Color(0x4488ff) } },
            vertexShader: `attribute float aOpacity; attribute float aScale; varying float vOpacity; void main() { vOpacity = aOpacity; vec4 worldPos = instanceMatrix * vec4(position * aScale, 1.0); gl_Position = projectionMatrix * modelViewMatrix * worldPos; }`,
            fragmentShader: `uniform vec3 uColor; varying float vOpacity; void main() { gl_FragColor = vec4(uColor, vOpacity); }`,
            transparent: true, depthWrite: false, side: THREE.FrontSide
        });

        this.fogInstances = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 6, 6), this.fogMaterial, this.FOG_PARTICLE_COUNT);
        this.fogInstances.frustumCulled = false;
        const opacities = new Float32Array(this.FOG_PARTICLE_COUNT), scales = new Float32Array(this.FOG_PARTICLE_COUNT);
        this.fogInstances.geometry.setAttribute('aOpacity', new THREE.InstancedBufferAttribute(opacities, 1));
        this.fogInstances.geometry.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 1));

        const matrix = new THREE.Matrix4();
        for (let i = 0; i < this.FOG_PARTICLE_COUNT; i++) {
            const angle = Math.random() * Math.PI * 2, radius = Math.random() * this.FOG_RADIUS;
            matrix.makeTranslation(centerX + Math.cos(angle) * radius, centerY + (i / this.FOG_PARTICLE_COUNT) * this.FOG_HEIGHT, centerZ + Math.sin(angle) * radius);
            this.fogInstances.setMatrixAt(i, matrix);
            const maxLife = 4 + Math.random() * 2;
            this.fogParticles.push({ velocity: new THREE.Vector3((Math.random() - 0.5) * 0.1, 0.4 + Math.random() * 0.2, (Math.random() - 0.5) * 0.1), life: (i / this.FOG_PARTICLE_COUNT) * maxLife, maxLife, baseY: centerY });
            opacities[i] = 0.25; scales[i] = 1.0;
        }
        this.fogInstances.instanceMatrix.needsUpdate = true;
        (this.fogInstances.geometry.getAttribute('aOpacity') as THREE.InstancedBufferAttribute).needsUpdate = true;
        (this.fogInstances.geometry.getAttribute('aScale') as THREE.InstancedBufferAttribute).needsUpdate = true;
        this.world.scene.add(this.fogInstances);
    }

    updateFogParticles(delta: number) {
        if (!this.portalPosition || !this.fogInstances || !this.fogParticles.length) return;
        const matrix = new THREE.Matrix4(), pos = new THREE.Vector3();
        const opacities = this.fogInstances.geometry.getAttribute('aOpacity') as THREE.InstancedBufferAttribute;
        const scales = this.fogInstances.geometry.getAttribute('aScale') as THREE.InstancedBufferAttribute;

        for (let i = 0; i < this.FOG_PARTICLE_COUNT; i++) {
            const p = this.fogParticles[i]; p.life += delta;
            if (p.life >= p.maxLife) {
                p.life = 0;
                const angle = Math.random() * Math.PI * 2, radius = Math.random() * this.FOG_RADIUS;
                pos.set(this.portalPosition.x + Math.cos(angle) * radius, p.baseY, this.portalPosition.z + Math.sin(angle) * radius);
                p.velocity.set((Math.random() - 0.5) * 0.1, 0.4 + Math.random() * 0.2, (Math.random() - 0.5) * 0.1);
                p.maxLife = 4 + Math.random() * 2;
            } else {
                this.fogInstances.getMatrixAt(i, matrix); pos.setFromMatrixPosition(matrix);
                pos.x += p.velocity.x * delta; pos.y += p.velocity.y * delta; pos.z += p.velocity.z * delta;
            }
            matrix.makeTranslation(pos.x, pos.y, pos.z); this.fogInstances.setMatrixAt(i, matrix);
            const ratio = p.life / p.maxLife;
            opacities.setX(i, ratio < 0.1 ? (ratio / 0.1) * 0.25 : ratio > 0.85 ? ((1 - ratio) / 0.15) * 0.25 : 0.25);
            scales.setX(i, 1.0 + ratio * 0.5);
        }
        this.fogInstances.instanceMatrix.needsUpdate = true; opacities.needsUpdate = true; scales.needsUpdate = true;
    }

    dispose() {
        if (this.portalMesh) { this.world.scene.remove(this.portalMesh); this.portalMesh = null; }
        if (this.portalLight) { this.world.scene.remove(this.portalLight); this.portalLight = null; }
        if (this.fogInstances) { this.world.scene.remove(this.fogInstances); this.fogInstances.dispose(); this.fogInstances = null; }
        if (this.fogMaterial) { this.fogMaterial.dispose(); this.fogMaterial = null; }
        this.fogParticles = [];
    }
}