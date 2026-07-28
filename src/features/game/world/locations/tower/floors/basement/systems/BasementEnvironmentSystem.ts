// src/features/game/world/locations/tower/floors/basement/systems/BasementEnvironmentSystem.ts
import * as THREE from "three";
import { EquirectangularReflectionMapping } from "three";
import { ResourceManager } from "../../../../../../core/ResourceManager";
import { createGlowTexture, createGlowSphere } from "../utils/meshFactory";
import type { Basement } from "../Basement";

export class BasementEnvironmentSystem {
    public basementCrystal!: THREE.Group;

    private portalLight!: THREE.PointLight;
    private sinkGlow!: THREE.PointLight;

    private portalVFX!: THREE.Group;
    private portalMixer?: THREE.AnimationMixer;

    private sinkPortal?: THREE.Group;
    private sinkPortalMixer?: THREE.AnimationMixer;

    private skySphere!: THREE.Group;

    private baseGlowMaterial!: THREE.SpriteMaterial;

    constructor(private floor: Basement) { }

    create(rm: ResourceManager) {
        const bgColor = 0x000000;
        this.floor.scene.background = new THREE.Color(bgColor);

        const globalFill = new THREE.AmbientLight(0xffffff, 0.25);
        this.floor.scene.add(globalFill);

        const hemi = new THREE.HemisphereLight(0x66aaff, 0x000000, 0.8);
        this.floor.scene.add(hemi);

        const cosmosData = rm.getModel("cosmos");
        const nebulaTexture = rm.getTexture("nebula-sky");

        const setupSky = (data: any, tex: THREE.Texture) => {
            this.skySphere = data.scene;
            this.skySphere.scale.set(100, 100, 100);
            this.skySphere.position.set(0, 0, 0);
            this.skySphere.renderOrder = -1000;

            this.skySphere.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    const mesh = child as THREE.Mesh;
                    const mat = new THREE.MeshBasicMaterial({
                        map: tex,
                        color: 0xffffff,
                        side: THREE.BackSide,
                        depthTest: true,
                        depthWrite: false,
                        toneMapped: false
                    });
                    mesh.material = mat;
                    mesh.castShadow = false;
                    mesh.receiveShadow = false;
                    mesh.renderOrder = -1000;
                }
            });

            this.floor.scene.add(this.skySphere);

            tex.mapping = EquirectangularReflectionMapping;
            this.floor.scene.environment = tex;
            (this.floor.scene as any).environmentIntensity = 5.0;
        };

        if (cosmosData && nebulaTexture) {
            setupSky(cosmosData, nebulaTexture);
        } else {
            console.warn("[Basement] Cosmos or nebula not loaded yet, waiting for lazy load...");

            let cData = cosmosData;
            let nTex = nebulaTexture;

            const trySetup = () => {
                if (!cData) cData = rm.getModel("cosmos");
                if (!nTex) nTex = rm.getTexture("nebula-sky");

                if (cData && nTex) {
                    setupSky(cData, nTex);
                }
            };

            if (!cosmosData) {
                rm.onModelLoaded("cosmos", () => {
                    cData = rm.getModel("cosmos");
                    trySetup();
                });
            }
            if (!nebulaTexture) {
                rm.onTextureLoaded("nebula-sky", () => {
                    nTex = rm.getTexture("nebula-sky");
                    trySetup();
                });
            }
        }

        const floorColor = rm.getTexture("floor-color");
        const floorNormal = rm.getTexture("floor-normal");
        const floorRough = rm.getTexture("floor-roughness");

        if (floorColor) floorColor.repeat.set(20, 20);
        if (floorNormal) floorNormal.repeat.set(20, 20);
        if (floorRough) floorRough.repeat.set(20, 20);

        const floorMat = new THREE.MeshStandardMaterial({
            roughness: 0.82,
            metalness: 0.08,
        });
        if (floorColor) floorMat.map = floorColor;
        if (floorNormal) floorMat.normalMap = floorNormal;
        if (floorRough) floorMat.roughnessMap = floorRough;

        // Floor textures are lazy-loaded and may not be ready yet when the player
        // reaches the basement — upgrade the material in place once each arrives,
        // same pattern as the cosmos sky sphere above.
        if (!floorColor) {
            rm.onTextureLoaded("floor-color", () => {
                const tex = rm.getTexture("floor-color");
                if (!tex) return;
                tex.repeat.set(20, 20);
                floorMat.map = tex;
                floorMat.needsUpdate = true;
            });
        }
        if (!floorNormal) {
            rm.onTextureLoaded("floor-normal", () => {
                const tex = rm.getTexture("floor-normal");
                if (!tex) return;
                tex.repeat.set(20, 20);
                floorMat.normalMap = tex;
                floorMat.needsUpdate = true;
            });
        }
        if (!floorRough) {
            rm.onTextureLoaded("floor-roughness", () => {
                const tex = rm.getTexture("floor-roughness");
                if (!tex) return;
                tex.repeat.set(20, 20);
                floorMat.roughnessMap = tex;
                floorMat.needsUpdate = true;
            });
        }

        const radius = 40;
        const holeRadius = 3.6;

        const outerFloor = new THREE.Mesh(
            new THREE.RingGeometry(holeRadius, radius, 64),
            floorMat
        );
        outerFloor.rotation.x = -Math.PI / 2;
        outerFloor.position.y = 0;
        outerFloor.receiveShadow = true;
        this.floor.scene.add(outerFloor);

        const wellDepth = Math.abs(this.floor.SINK_Y) + 1;
        const wellGeo = new THREE.CylinderGeometry(
            holeRadius,
            holeRadius,
            wellDepth,
            64,
            1,
            true
        );

        const wellMat = new THREE.MeshStandardMaterial({
            color: 0x000000,
            roughness: 1,
            metalness: 0,
            side: THREE.BackSide
        });

        const well = new THREE.Mesh(wellGeo, wellMat);
        well.position.y = -wellDepth / 2;
        well.receiveShadow = false;
        well.castShadow = false;
        this.floor.scene.add(well);

        this.floor.collisionGrid.insertCylinder(
            new THREE.Vector3(0, 0, 0),
            3.8,
            4
        );

        const portalData = rm.getModel("portalVFX");
        if (portalData) {
            this.portalVFX = portalData.scene;
            this.portalVFX.scale.set(7.5, 7.5, 7.5);
            this.portalVFX.position.set(0, this.floor.HOLE_Y + 0.05, 0);
            this.portalVFX.rotation.x = -Math.PI / 2;
            this.floor.scene.add(this.portalVFX);

            this.portalVFX.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    const mesh = child as THREE.Mesh;
                    const oldMat = mesh.material as THREE.MeshStandardMaterial;
                    const newMat = new THREE.MeshBasicMaterial({
                        map: oldMat.map || null,
                        color: oldMat.color.clone(),
                        transparent: true,
                        opacity: oldMat.opacity,
                        blending: THREE.AdditiveBlending,
                        depthWrite: false,
                        side: THREE.DoubleSide
                    });
                    mesh.material = newMat;
                    mesh.castShadow = false;
                    mesh.receiveShadow = false;
                }
            });

            if (portalData.animations.length > 0) {
                this.portalMixer = new THREE.AnimationMixer(this.portalVFX);
                portalData.animations.forEach((clip) => {
                    this.portalMixer!.clipAction(clip).play();
                });
            }

            this.sinkPortal = portalData.scene.clone(true) as THREE.Group;
            this.sinkPortal.scale.set(7.5, 7.5, 7.5);
            this.sinkPortal.position.set(0, this.floor.SINK_Y, 0);
            this.sinkPortal.rotation.x = Math.PI / 2;
            this.floor.scene.add(this.sinkPortal);

            this.sinkPortal.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    const mesh = child as THREE.Mesh;
                    const oldMat = mesh.material as THREE.MeshStandardMaterial;
                    mesh.material = new THREE.MeshBasicMaterial({
                        map: oldMat.map || null,
                        color: oldMat.color.clone(),
                        transparent: true,
                        opacity: oldMat.opacity,
                        blending: THREE.AdditiveBlending,
                        depthWrite: false,
                        side: THREE.DoubleSide
                    });
                    mesh.castShadow = false;
                    mesh.receiveShadow = false;
                }
            });

            if (portalData.animations.length > 0) {
                this.sinkPortalMixer = new THREE.AnimationMixer(this.sinkPortal);
                portalData.animations.forEach((clip) => {
                    this.sinkPortalMixer!.clipAction(clip).play();
                });
            }
        }

        const floorSegments = 32;
        for (let i = 0; i < floorSegments; i++) {
            const angle1 = (i / floorSegments) * Math.PI * 2;
            const angle2 = ((i + 1) / floorSegments) * Math.PI * 2;
            const pts = [
                new THREE.Vector3(Math.cos(angle1) * holeRadius, 0, Math.sin(angle1) * holeRadius),
                new THREE.Vector3(Math.cos(angle2) * holeRadius, 0, Math.sin(angle2) * holeRadius),
                new THREE.Vector3(Math.cos(angle1) * radius, 0, Math.sin(angle1) * radius),
                new THREE.Vector3(Math.cos(angle2) * radius, 0, Math.sin(angle2) * radius)
            ];
            let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
            for (const p of pts) {
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.z < minZ) minZ = p.z;
                if (p.z > maxZ) maxZ = p.z;
            }
            this.floor.collisionGrid.insert(new THREE.Box3(
                new THREE.Vector3(minX, -0.1, minZ),
                new THREE.Vector3(maxX, 0.1, maxZ)
            ));
        }

        this.portalLight = new THREE.PointLight(0xb8e4ff, 70, 110, 1.8);
        this.portalLight.position.set(0, this.floor.HOLE_Y + 2, 0);
        this.portalLight.castShadow = false;
        this.floor.scene.add(this.portalLight);

        const portalGlow = new THREE.PointLight(0x4db8ff, 25, 35, 2);
        portalGlow.position.set(0, this.floor.HOLE_Y + 0.5, 0);
        portalGlow.castShadow = false;
        this.floor.scene.add(portalGlow);

        const sun = new THREE.DirectionalLight(0xffffff, 1.2);
        sun.position.set(15, 30, 15);
        sun.target.position.set(0, 0, 0);
        sun.castShadow = true;
        sun.shadow.mapSize.set(4096, 4096);
        sun.shadow.radius = 4;
        sun.shadow.bias = -0.00003;
        sun.shadow.normalBias = 0.02;
        sun.shadow.camera.left = -60;
        sun.shadow.camera.right = 60;
        sun.shadow.camera.top = 60;
        sun.shadow.camera.bottom = -60;
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 120;
        sun.shadow.camera.updateProjectionMatrix();
        this.floor.scene.add(sun);
        this.floor.scene.add(sun.target);

        const rimLight = new THREE.DirectionalLight(0x66ccff, 0.8);
        rimLight.position.set(-20, 15, -20);
        this.floor.scene.add(rimLight);

        this.sinkGlow = new THREE.PointLight(0x22aaff, 120, 40, 2);
        this.sinkGlow.position.set(0, -18, 0);
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

        if (this.portalMixer) {
            this.portalMixer.update(delta);
        }

        if (this.sinkPortalMixer) {
            this.sinkPortalMixer.update(delta);
        }

        if (this.portalLight) {
            const t = performance.now() * 0.004;
            this.portalLight.intensity = 70 + Math.sin(t) * 12;
        }

        if (this.sinkGlow) {
            this.sinkGlow.intensity = 120 + Math.sin(performance.now() * 0.003) * 15;
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
        if (this.sinkPortal) {
            this.floor.scene.remove(this.sinkPortal);
            this.sinkPortal.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        (child.material as THREE.Material).dispose();
                    }
                }
            });
        }

        this.baseGlowMaterial.dispose();
    }
}
