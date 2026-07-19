//src\features\game\world\locations\tower\floors\Basement.ts
import * as THREE from "three";
import { EquirectangularReflectionMapping } from "three";
import { TowerFloor } from "../TowerFloor";
import { ResourceManager } from "../../../../core/ResourceManager";

function createFallbackCoinTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#DAA520';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = '#FFF8DC';
    ctx.beginPath();
    ctx.arc(64, 64, 45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#DAA520';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MEME', 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function createGlowTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.4, 'rgba(255, 204, 102, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 204, 102, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

export interface MemeToken {
    address: string;
    name: string;
    symbol: string;
    image: string;
    chainId?: string;
    url?: string;
}

interface ActiveCoin {
    mesh: THREE.Object3D;
    velocity: number;
    rotationSpeed: number;
}

interface TokenColumn {
    group: THREE.Group;
    coin: THREE.Group;
    ca: string | null;
    texture?: THREE.Texture;
    mcText?: THREE.Sprite;
    baseCoinY: number;
}

interface OrbitData {
    mesh: THREE.Object3D;
    baseRadius: number;
    speed: number;
    phase: number;
    inclination: number;
    axis: THREE.Vector3;
    trail: {
        line: THREE.Line;
        positions: Float32Array;
    };
}

export class Basement extends TowerFloor {
    private activeCoins: ActiveCoin[] = [];
    private tokenQueue: MemeToken[] = [];
    private textureCache = new Map<string, THREE.Texture>();

    private orbitData: OrbitData[] = [];

    private pollInterval: NodeJS.Timeout | null = null;
    private spawnInterval: NodeJS.Timeout | null = null;
    private clearQueueInterval: NodeJS.Timeout | null = null;

    private readonly MAX_COINS = 50;
    private readonly MAX_QUEUE_SIZE = 200;
    private readonly HOLE_Y = 18.5;

    private wellCenter = new THREE.Vector3(0, 0, 0);
    private sinkPosition = new THREE.Vector3(0, -5, 0);
    private basementCrystal!: THREE.Group;

    private portalLight!: THREE.PointLight;
    private sinkGlow!: THREE.PointLight;

    private portalVFX!: THREE.Group;
    private portalMixer?: THREE.AnimationMixer;
    private skySphere!: THREE.Group;
    private _skyLogged = false;

    private textureLoader = new THREE.TextureLoader();
    private baseGlowMaterial!: THREE.SpriteMaterial;
    private readonly TARGET_SCALE = new THREE.Vector3(1, 1, 1);

    private orbitTime = 0;

    private columnTokens: (string | null)[] = [
        "9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump", "J8PSdNP3QewKq2Z1JJJFDMaqF7KcaiJhR7gbr5KZpump", "CFPkPq1eYPR8GLzEo59wUbbMioX4bshaTQiSGzTSpump",
        "B4ptaVsUe6YbtBwAS38WFeweSrVNfQLCcj9JRrtjU8vn", "Ge87EtsjwRQbHaqQmKRno69RFTwh9bfSsm99XNxTpump", "4MrsXQzaosYNyFd4wKDvgnC5xRtRqgXRrijFTGj9pump", "BTUu1KQ1rhcmtMVGLm7unFbCR4CU6RCwxhTtK2xUpump", "CWZ6BsdnjkDVTGkmL6bGbJXXig6ceef12KvyGQW14cMt", null, null
    ];
    private columns: TokenColumn[] = [];
    private columnUpdateInterval: NodeJS.Timeout | null = null;

    constructor() {
        super("tower-basement", "Gloomy Tower Basement");
        this.textureCache.set('fallback', createFallbackCoinTexture());
    }

    private applyTextureFilters(texture: THREE.Texture) {
        texture.anisotropy = 16;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
    }

    create(rm: ResourceManager) {
        const bgColor = 0x000000;
        this.scene.background = new THREE.Color(bgColor);

        const globalFill = new THREE.AmbientLight(0xffffff, 0.25);
        this.scene.add(globalFill);

        const hemi = new THREE.HemisphereLight(0x66aaff, 0x000000, 0.8);
        this.scene.add(hemi);

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
                        depthTest: false,
                        depthWrite: false,
                        toneMapped: false
                    });
                    mesh.material = mat;
                    mesh.castShadow = false;
                    mesh.receiveShadow = false;
                    mesh.renderOrder = -1000;
                }
            });

            this.scene.add(this.skySphere);

            tex.mapping = EquirectangularReflectionMapping;
            this.scene.environment = tex;
            (this.scene as any).environmentIntensity = 5.0;
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
            map: floorColor || undefined,
            normalMap: floorNormal || undefined,
            roughnessMap: floorRough || undefined,
            roughness: 0.82,
            metalness: 0.08,
        });

        const radius = 40;
        const holeRadius = 2.6;

        const floor = new THREE.Mesh(new THREE.RingGeometry(holeRadius, radius, 64), floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        const holeCollisionRadius = 3.5;
        this.collisionGrid.insert(
            new THREE.Box3(
                new THREE.Vector3(-holeCollisionRadius, -1, -holeCollisionRadius),
                new THREE.Vector3(holeCollisionRadius, 4, holeCollisionRadius)
            )
        );

        const portalData = rm.getModel("portalVFX");
        if (portalData) {
            this.portalVFX = portalData.scene;
            this.portalVFX.scale.set(7.5, 7.5, 7.5);
            this.portalVFX.position.set(0, this.HOLE_Y + 0.05, 0);
            this.portalVFX.rotation.x = -Math.PI / 2;
            this.scene.add(this.portalVFX);

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
                    const action = this.portalMixer!.clipAction(clip);
                    action.play();
                });
            }
        }

        const shadowPlane = new THREE.Mesh(
            new THREE.CircleGeometry(5, 32),
            new THREE.MeshBasicMaterial({
                color: 0x000000,
                transparent: true,
                opacity: 0.25,
                depthWrite: false
            })
        );
        shadowPlane.rotation.x = -Math.PI / 2;
        shadowPlane.position.y = 0.01;
        this.scene.add(shadowPlane);

        const wellDepth = 20;
        const sinkMat = new THREE.ShaderMaterial({
            side: THREE.BackSide,
            uniforms: {
                colorTop: { value: new THREE.Color(0x000000) },
                colorBottom: { value: new THREE.Color(0x000000) },
                glowColor: { value: new THREE.Color(0x2aa8ff) },
                glowHeight: { value: -18.0 }
            },
            vertexShader: `
                varying float vY;
                void main() {
                    vY = position.y;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
                }
            `,
            fragmentShader: `
                varying float vY;
                uniform vec3 glowColor;
                uniform float glowHeight;
                void main() {
                    vec3 col = vec3(0.0);
                    float glow = smoothstep(glowHeight - 4.0, glowHeight + 1.0, vY);
                    glow = 1.0 - glow;
                    glow = pow(glow, 4.0);
                    col += glowColor * glow * 3.5;
                    gl_FragColor = vec4(col, 1.0);
                }
            `
        });

        const sinkWell = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, wellDepth, 32, 1, true), sinkMat);
        sinkWell.position.set(this.wellCenter.x, -wellDepth / 2, this.wellCenter.z);
        this.scene.add(sinkWell);

        const bottomGlow = new THREE.Mesh(
            new THREE.CircleGeometry(2.8, 64),
            new THREE.MeshBasicMaterial({
                color: 0x33bbff,
                transparent: true,
                opacity: 0.6,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );
        bottomGlow.rotation.x = -Math.PI / 2;
        bottomGlow.position.set(0, -19.8, 0);
        this.scene.add(bottomGlow);

        const SINK_Y = -5;
        const sinkHole = new THREE.Mesh(
            new THREE.CircleGeometry(2.6, 32),
            new THREE.MeshBasicMaterial({ color: 0x000000 })
        );
        sinkHole.position.set(0, SINK_Y, 0);
        sinkHole.rotation.x = -Math.PI / 2;
        this.scene.add(sinkHole);

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
            this.collisionGrid.insert(new THREE.Box3(
                new THREE.Vector3(minX, -0.1, minZ),
                new THREE.Vector3(maxX, 0.1, maxZ)
            ));
        }

        this.portalLight = new THREE.PointLight(0xb8e4ff, 70, 110, 1.8);
        this.portalLight.position.set(0, this.HOLE_Y + 2, 0);
        this.portalLight.castShadow = false;
        this.scene.add(this.portalLight);

        const portalGlow = new THREE.PointLight(0x4db8ff, 25, 35, 2);
        portalGlow.position.set(0, this.HOLE_Y + 0.5, 0);
        portalGlow.castShadow = false;
        this.scene.add(portalGlow);

        const portalBloom = new THREE.Mesh(
            new THREE.CircleGeometry(5, 64),
            new THREE.MeshBasicMaterial({
                color: 0x6fc8ff,
                transparent: true,
                opacity: 0.18,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );
        portalBloom.rotation.x = -Math.PI / 2;
        portalBloom.position.set(0, 0.02, 0);
        this.scene.add(portalBloom);

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
        this.scene.add(sun);
        this.scene.add(sun.target);

        const rimLight = new THREE.DirectionalLight(0x66ccff, 0.8);
        rimLight.position.set(-20, 15, -20);
        this.scene.add(rimLight);

        this.sinkGlow = new THREE.PointLight(0x22aaff, 120, 40, 2);
        this.sinkGlow.position.set(0, -18, 0);
        this.sinkGlow.castShadow = false;
        this.scene.add(this.sinkGlow);

        this.createWellFog(wellDepth);
        this.createDustParticles();

        const glowMap = createGlowTexture();
        this.textureCache.set('glow', glowMap);

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
        this.spawnOrbitCoins(rm);
        this.createTokenColumns(rm);
        this.startColumnUpdater();

        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            (window as any).requestIdleCallback(() => {
                this.startMemeCoinPoller();
                this.startCoinSpawner();
                this.startQueueClearer();
            });
        } else {
            setTimeout(() => {
                this.startMemeCoinPoller();
                this.startCoinSpawner();
                this.startQueueClearer();
            }, 100);
        }
    }

    private createCoinMesh(
        texture: THREE.Texture,
        radius: number = 0.4,
        isColumn: boolean = false,
        isOrbit: boolean = false,
        glowType: "none" | "silver" | "gold" = "silver"
    ): THREE.Group {
        const group = new THREE.Group();
        const thickness = isColumn ? radius * 0.08 : (isOrbit ? radius * 0.35 : radius * 0.4);
        const segments = radius > 1 ? 96 : 64;

        let mainMesh: THREE.Mesh;

        if (isOrbit) {
            const geo = new THREE.CylinderGeometry(radius, radius, radius * 0.35, 96);
            const sideMat = new THREE.MeshStandardMaterial({
                color: 0xffd700,
                emissive: 0x332200,
                emissiveIntensity: 0.6,
                metalness: 1.0,
                roughness: 0.25,
                envMapIntensity: 2.5
            });

            const faceMat = new THREE.MeshStandardMaterial({
                map: texture,
                emissiveMap: texture,
                emissive: 0xffffff,
                emissiveIntensity: 0.7,
                metalness: 0.0,
                roughness: 0.3,
                envMapIntensity: 2.0,
                toneMapped: false
            });

            const materials = [sideMat, faceMat, faceMat];
            mainMesh = new THREE.Mesh(geo, materials);
            mainMesh.rotation.x = Math.PI / 2;
            mainMesh.castShadow = false;
            mainMesh.receiveShadow = false;
            group.add(mainMesh);

        } else {
            const geo = new THREE.CylinderGeometry(radius, radius, thickness, segments);
            const sideMat = new THREE.MeshStandardMaterial({
                color: 0xffd700,
                metalness: 0.8,
                roughness: 0.3,
                envMapIntensity: 2.0
            });

            const faceMat = new THREE.MeshStandardMaterial({
                map: texture,
                emissiveMap: texture,
                emissive: 0xffffff,
                emissiveIntensity: 0.7,
                metalness: 0.0,
                roughness: 0.3,
                envMapIntensity: 2.0,
                toneMapped: false
            });

            const materials = [sideMat, faceMat, faceMat];
            mainMesh = new THREE.Mesh(geo, materials);
            mainMesh.rotation.x = Math.PI / 2;
            mainMesh.castShadow = false;
            mainMesh.receiveShadow = false;
            group.add(mainMesh);
        }

        const rimThickness = thickness * 1.05;
        const rim = new THREE.Mesh(
            new THREE.CylinderGeometry(radius * 1.02, radius * 1.02, rimThickness, 64),
            new THREE.MeshBasicMaterial({
                color: 0xffd700,
                transparent: true,
                opacity: 0.15,
                side: THREE.BackSide,
                depthWrite: false
            })
        );
        rim.rotation.x = Math.PI / 2;
        group.add(rim);

        let glowColor = 0xffffff;
        let glowOpacity = 0.25;

        if (glowType === "none") {
            glowOpacity = 0.0;
        } else if (glowType === "silver") {
            glowColor = 0xcceeff;
            glowOpacity = 0.25;
        } else if (glowType === "gold") {
            glowColor = 0xffd700;
            glowOpacity = 0.35;
        }

        if (glowOpacity > 0.0) {
            const glowSphere = new THREE.Mesh(
                new THREE.SphereGeometry(radius * 2.0, 48, 48),
                new THREE.ShaderMaterial({
                    transparent: true,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                    uniforms: {
                        color: { value: new THREE.Color(glowColor) },
                        opacity: { value: glowOpacity }
                    },
                    vertexShader: `
                        varying vec3 vNormal;
                        void main() {
                            vNormal = normalize(normalMatrix * normal);
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                        }
                    `,
                    fragmentShader: `
                        varying vec3 vNormal;
                        uniform vec3 color;
                        uniform float opacity;
                        void main() {
                            float fresnel = dot(vNormal, vec3(0.0, 0.0, 1.0));
                            float intensity = pow(clamp(fresnel, 0.0, 1.0), 2.5);
                            intensity *= smoothstep(0.0, 1.0, intensity);
                            gl_FragColor = vec4(color, intensity * opacity);
                        }
                    `
                })
            );
            glowSphere.userData.isGlow = true;
            group.add(glowSphere);
        }

        if (isOrbit) {
            const trailCount = 20;
            const positions = new Float32Array(trailCount * 3);
            const trailGeo = new THREE.BufferGeometry();
            trailGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

            const trailMat = new THREE.LineBasicMaterial({
                color: 0x66ccff,
                transparent: true,
                opacity: 0.4
            });

            const trailLine = new THREE.Line(trailGeo, trailMat);
            group.add(trailLine);

            (group as any).trail = {
                line: trailLine,
                positions: positions
            };
        }

        return group;
    }

    private createWellFog(depth: number) {
        const count = 150;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 3;
            pos[i * 3 + 1] = -Math.random() * depth;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 3;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({ color: 0x00aaff, size: 0.1, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false });
        const fog = new THREE.Points(geo, mat);
        this.scene.add(fog);
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

        const glowMap = this.textureCache.get('glow')!;
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowMap,
            color: 0x66ccff,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            opacity: 0.6
        }));
        glow.scale.set(4, 4, 4);

        const light = new THREE.PointLight(0x66ccff, 7, 20);
        light.position.set(0, 1.5, 0);
        light.castShadow = false;

        group.add(core);
        group.add(shell);
        group.add(glow);
        group.add(light);

        group.position.set(radius - 6, 1.5, 0);
        group.userData.interactionId = "tower-crystal";

        this.scene.add(group);
        this.basementCrystal = group;

        this.collisionGrid.insert(new THREE.Box3().setFromObject(group));
    }

    private createCoinLogoFallback(name: string, color: number): THREE.Texture {
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext("2d")!;

        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, 256, 256);

        ctx.fillStyle = "#" + color.toString(16).padStart(6, "0");
        ctx.beginPath();
        ctx.arc(128, 128, 110, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.font = "bold 80px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const label = name.toUpperCase();
        ctx.fillText(label, 128, 140);

        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        this.applyTextureFilters(tex);
        return tex;
    }

    private spawnOrbitCoins(rm: ResourceManager) {
        const customLogo = this.textureLoader.load("/logo.png");
        customLogo.colorSpace = THREE.SRGBColorSpace;
        this.applyTextureFilters(customLogo);

        const coins = [
            { key: "btc", fallbackColor: 0xf7931a },
            { key: "eth", fallbackColor: 0x627eea },
            { key: "sol", fallbackColor: 0x14f195 },
            { key: "usdt", fallbackColor: 0x26a17b },
            { key: "bnb", fallbackColor: 0xf3ba2f },
            { key: "xmr", fallbackColor: 0xff6600 },
            { texture: customLogo }
        ];

        coins.forEach((coinData: any, i) => {
            let tex: THREE.Texture;

            if (coinData.texture) {
                tex = coinData.texture;
            } else {
                tex = this.createCoinLogoFallback(
                    coinData.key,
                    coinData.fallbackColor
                );
            }

            this.applyTextureFilters(tex);

            const coinGroup = this.createCoinMesh(tex, 8.5, false, true, "gold");

            this.scene.add(coinGroup);

            this.orbitData.push({
                mesh: coinGroup,
                baseRadius: 80 + i * 10,
                speed: 0.2 + Math.random() * 0.2,
                phase: Math.random() * Math.PI * 2,
                inclination: Math.random() * 0.6,
                axis: new THREE.Vector3(
                    Math.random(),
                    Math.random(),
                    Math.random()
                ).normalize(),
                trail: (coinGroup as any).trail
            });
        });
    }

    public override getInteractables(): THREE.Object3D[] {
        const interactables: THREE.Object3D[] = [];
        if (this.basementCrystal) interactables.push(this.basementCrystal);
        interactables.push(...this.columns.map(c => c.group));
        return interactables;
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
        this.scene.add(particles);
    }

    private startMemeCoinPoller() {
        this.pollInterval = setInterval(async () => {
            try {
                const res = await fetch("/api/new-tokens");
                if (!res.ok) throw new Error("API request failed");
                const tokens: MemeToken[] = await res.json();
                for (const token of tokens) {
                    if (this.tokenQueue.length >= this.MAX_QUEUE_SIZE) break;
                    this.tokenQueue.push(token);
                }
            } catch (e) { }
        }, 10000);
    }

    private startCoinSpawner() {
        this.spawnInterval = setInterval(() => {
            if (this.tokenQueue.length > 0 && this.activeCoins.length < this.MAX_COINS) {
                const token = this.tokenQueue.shift()!;
                this.spawnCoin(token);
            }
        }, 500);
    }

    private startQueueClearer() {
        this.clearQueueInterval = setInterval(() => { this.tokenQueue = []; }, 300000);
    }

    private spawnCoin(token: MemeToken) {
        if (this.activeCoins.length >= this.MAX_COINS) {
            const oldCoin = this.activeCoins.shift();
            if (oldCoin) {
                this.scene.remove(oldCoin.mesh);
                oldCoin.mesh.traverse((child) => {
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
        }

        const fallbackTexture = this.textureCache.get('fallback')!;
        let finalTexture = this.textureCache.get(token.image) || fallbackTexture;

        if (token.image && token.image !== 'fallback' && !this.textureCache.has(token.image)) {
            const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(token.image)}`;
            
            this.textureLoader.load(
                proxyUrl,
                (tex) => {
                    tex.colorSpace = THREE.SRGBColorSpace;
                    this.applyTextureFilters(tex);
                    this.textureCache.set(token.image, tex);
                },
                undefined,
                () => {
                    this.textureCache.set(token.image, fallbackTexture);
                }
            );
        }

        this.applyTextureFilters(finalTexture);

        const coinGroup = this.createCoinMesh(finalTexture, 0.4, false, false, "none");

        const spawnRadius = 2.2;
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * spawnRadius;

        coinGroup.position.set(
            Math.cos(angle) * r,
            this.HOLE_Y + 0.15,
            Math.sin(angle) * r
        );
        coinGroup.scale.set(0.1, 0.1, 0.1);

        coinGroup.castShadow = false;
        coinGroup.receiveShadow = false;

        this.scene.add(coinGroup);
        this.activeCoins.push({
            mesh: coinGroup,
            velocity: -0.04,
            rotationSpeed: 0.8 + Math.random() * 0.6
        });
    }

    update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        super.update(playerPosition, delta, isEPressed);

        this.orbitTime += delta;
        const time = performance.now() * 0.001;

        for (let i = 0; i < this.columns.length; i++) {
            const col = this.columns[i];
            if (!col.coin) continue;

            col.coin.position.y = col.baseCoinY + Math.sin(time * 2 + i) * 0.2;

            const speed = (col.coin as any).rotSpeed || { x: 0, y: 1, z: 0 };
            col.coin.rotation.x += delta * speed.x;
            col.coin.rotation.y += delta * speed.y;
            col.coin.rotation.z += delta * speed.z;

            const glow = col.coin.children.find((c: any) => c.userData.isGlow) as THREE.Mesh;
            if (glow) {
                const mat = glow.material as any;
                if (mat.uniforms && mat.uniforms.opacity) {
                    mat.uniforms.opacity.value = 0.2 + Math.sin(time * 3) * 0.05;
                }
            }
        }

        if (this.skySphere && !this._skyLogged) {
            this._skyLogged = true;
            const sphereRadius = 100 * 100;
            const distToCenter = playerPosition.distanceTo(new THREE.Vector3(0, 0, 0));
            console.log(`[Basement] Camera check: Player dist to center = ${distToCenter.toFixed(1)}. Sphere radius = ${sphereRadius}. Inside? ${distToCenter < sphereRadius ? 'YES' : 'NO'}`);
        }

        if (this.skySphere) {
            this.skySphere.rotation.y += delta * 0.01;
        }

        if (this.basementCrystal) {
            const t = performance.now() * 0.002;
            this.basementCrystal.rotation.y += delta * 0.6;
            this.basementCrystal.position.y = 1.5 + Math.sin(t) * 0.2;

            const glow = this.basementCrystal.children.find(c => c instanceof THREE.Sprite) as THREE.Sprite;
            if (glow) {
                const mat = glow.material as THREE.SpriteMaterial;
                mat.opacity = 0.5 + Math.sin(t * 2) * 0.2;
            }
        }

        if (this.portalMixer) {
            this.portalMixer.update(delta);
        }

        if (this.portalLight) {
            const t = performance.now() * 0.004;
            this.portalLight.intensity = 70 + Math.sin(t) * 12;
        }

        if (this.sinkGlow) {
            this.sinkGlow.intensity = 120 + Math.sin(performance.now() * 0.003) * 15;
        }

        const dust = this.scene.getObjectByName("dustParticles") as THREE.Points;
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

        this.orbitData.forEach((c, i) => {
            const t = this.orbitTime * 0.15 * c.speed + c.phase;

            const pos = new THREE.Vector3(
                Math.cos(t) * c.baseRadius,
                0,
                Math.sin(t) * c.baseRadius
            );

            pos.applyAxisAngle(c.axis, c.inclination);
            pos.multiplyScalar(1 + i * 0.08);

            c.mesh.position.copy(pos);
            c.mesh.rotation.y += delta * 0.4;

            if (c.trail) {
                const p = c.mesh.position;
                c.trail.positions.copyWithin(3, 0, 57);
                c.trail.positions[0] = p.x;
                c.trail.positions[1] = p.y;
                c.trail.positions[2] = p.z;

                c.trail.line.geometry.attributes.position.needsUpdate = true;
            }
        });

        const SINK_Y = -5;

        for (let i = this.activeCoins.length - 1; i >= 0; i--) {
            const coin = this.activeCoins[i];

            coin.velocity -= 1 * delta;
            coin.mesh.position.y += coin.velocity * delta;

            coin.mesh.rotation.y += coin.rotationSpeed * delta;
            coin.mesh.rotation.x += coin.rotationSpeed * 0.4 * delta;

            coin.mesh.scale.lerp(this.TARGET_SCALE, 3 * delta);

            const isSinking = (coin.mesh as THREE.Object3D).position.y < SINK_Y + 2;

            if (isSinking) {
                (coin.mesh as THREE.Object3D).traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        const mat = child.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
                        if (mat.opacity !== undefined) {
                            mat.opacity = Math.max(0, mat.opacity - delta * 1.5);
                            mat.transparent = true;
                        }
                    }
                });
            }

            if (coin.mesh.position.y <= SINK_Y) {
                this.scene.remove(coin.mesh);
                (coin.mesh as THREE.Object3D).traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.geometry.dispose();
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            (child.material as THREE.Material).dispose();
                        }
                    }
                });
                this.activeCoins.splice(i, 1);
            }
        }
    }

    getSpawnPoint(): THREE.Vector3 {
        return new THREE.Vector3(0, 2, 8);
    }

    private createTokenColumns(rm: ResourceManager) {
        const radius = 30;
        const count = 10;

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            const group = new THREE.Group();

            const columnData = rm.getModel("column");
            let pedestalHeight = 4;

            if (columnData) {
                const pedestal = columnData.scene;
                pedestal.scale.set(1, 0.5, 1);

                const box = new THREE.Box3().setFromObject(pedestal);
                pedestal.position.y -= box.min.y;

                const scaledBox = new THREE.Box3().setFromObject(pedestal);
                pedestalHeight = scaledBox.max.y - scaledBox.min.y;

                pedestal.traverse((child) => {
                    if ((child as THREE.Mesh).isMesh) {
                        const mesh = child as THREE.Mesh;
                        if (Array.isArray(mesh.material)) {
                            mesh.material.forEach(m => m.needsUpdate = true);
                        } else {
                            mesh.material.needsUpdate = true;
                        }
                    }
                });
                group.add(pedestal);
            } else {
                console.warn("column model not found, using fallback");
                const column = new THREE.Mesh(
                    new THREE.CylinderGeometry(1.2, 1.5, 2, 32),
                    new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.7, metalness: 0.3 })
                );
                column.position.y = 1;
                group.add(column);
                pedestalHeight = 2;
            }

            const ca = this.columnTokens[i];
            const texture = this.textureCache.get("fallback")!;
            
            const coin = this.createCoinMesh(texture, 1.2, true, false, "silver");

            const baseCoinY = pedestalHeight + 1.6;
            coin.position.set(0, baseCoinY, 0);
            coin.rotation.y = Math.atan2(-x, -z);

            (coin as any).rotSpeed = {
                x: (Math.random() - 0.5) * 1.5,
                y: 1.5 + Math.random() * 1.0,
                z: (Math.random() - 0.5) * 1.5
            };

            group.add(coin);
            group.position.set(x, 0, z);
            group.userData.interactionId = `column-${i}`;
            group.userData.ca = ca;
            group.userData.tokenInfo = ca
                ? { name: "Loading...", symbol: "...", mc: 0 }
                : { name: "Empty Pedestal", symbol: "N/A", mc: 0 };

            this.scene.add(group);
            this.columns.push({ group, coin, ca, baseCoinY });

            const radiusCol = 1.2;
            const heightCol = pedestalHeight;
            const collider = new THREE.Box3(
                new THREE.Vector3(x - radiusCol, 0, z - radiusCol),
                new THREE.Vector3(x + radiusCol, heightCol, z + radiusCol)
            );
            this.collisionGrid.insert(collider);
        }
    }

    private setColumnHighlight(col: TokenColumn, active: boolean) {
        col.coin.traverse((obj) => {
            if ((obj as THREE.Mesh).isMesh) {
                const mat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
                if (active && 'emissive' in mat) {
                    (mat as THREE.MeshStandardMaterial).emissive.set(0x00ffff);
                    (mat as THREE.MeshStandardMaterial).emissiveIntensity = 1.5;
                } else if ('emissiveIntensity' in mat) {
                    (mat as THREE.MeshStandardMaterial).emissiveIntensity = 0;
                }
            }
        });
    }

    private startColumnUpdater() {
        this.columnUpdateInterval = setInterval(async () => {
            for (const col of this.columns) {
                if (!col.ca) continue;

                try {
                    const res = await fetch(`/api/token-by-ca?ca=${col.ca}`);
                    const data = await res.json();

                    if (!data || !data.image) continue;

                    this.textureLoader.load(
                        `/api/image-proxy?url=${encodeURIComponent(data.image)}`,
                        (tex) => {
                            tex.colorSpace = THREE.SRGBColorSpace;
                            this.applyTextureFilters(tex);

                            col.coin.traverse((child) => {
                                if (child instanceof THREE.Mesh) {
                                    const materials = Array.isArray(child.material) 
                                        ? child.material 
                                        : [child.material];

                                    materials.forEach((mat: any) => {
                                        if (mat.map !== undefined && mat.emissiveMap !== undefined) {
                                            mat.map = tex;
                                            mat.emissiveMap = tex;
                                            mat.needsUpdate = true;
                                        }
                                    });
                                }
                            });

                            col.texture = tex;
                        },
                        undefined,
                        () => {
                            console.warn(`[Basement] Column texture load failed: ${data.image}`);
                        }
                    );

                    if (col.mcText) {
                        col.group.remove(col.mcText);
                        (col.mcText.material as THREE.SpriteMaterial).map?.dispose();
                        (col.mcText.material as THREE.Material).dispose();
                    }

                    const sprite = this.createTextSprite(`MC: ${this.formatMC(data.mc || 0)}`);
                    sprite.position.y = col.baseCoinY + 3.4;
                    col.group.add(sprite);
                    col.mcText = sprite;

                    col.group.userData.tokenInfo = data;

                } catch (e) {
                    console.warn(`[Basement] Failed to update column ${col.ca}`, e);
                }
            }
        }, 30000); 
    }

    private createTextSprite(text: string): THREE.Sprite {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 128;

        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px Arial';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 15;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, 256, 64);

        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;

        const mat = new THREE.SpriteMaterial({
            map: tex,
            transparent: true,
            depthTest: false
        });

        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(6, 1.5, 1);
        sprite.renderOrder = 999;

        return sprite;
    }

    private formatMC(value: number): string {
        if (value > 1e9) return (value / 1e9).toFixed(1) + "B";
        if (value > 1e6) return (value / 1e6).toFixed(1) + "M";
        if (value > 1e3) return (value / 1e3).toFixed(1) + "K";
        return value.toFixed(0);
    }

    dispose() {
        if (this.pollInterval) { clearInterval(this.pollInterval); this.pollInterval = null; }
        if (this.spawnInterval) { clearInterval(this.spawnInterval); this.spawnInterval = null; }
        if (this.clearQueueInterval) { clearInterval(this.clearQueueInterval); this.clearQueueInterval = null; }

        if (this.columnUpdateInterval) {
            clearInterval(this.columnUpdateInterval);
            this.columnUpdateInterval = null;
        }

        for (const col of this.columns) {
            this.scene.remove(col.group);
            col.group.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        (child.material as THREE.Material).dispose();
                    }
                }
            });
            if (col.mcText) {
                (col.mcText.material as THREE.SpriteMaterial).map?.dispose();
                (col.mcText.material as THREE.Material).dispose();
            }
            if (col.texture) {
                col.texture.dispose();
            }
        }
        this.columns = [];

        for (const c of this.orbitData) {
            this.scene.remove(c.mesh);
            c.mesh.traverse((child) => {
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
        this.orbitData = [];

        for (const coin of this.activeCoins) {
            this.scene.remove(coin.mesh);
            coin.mesh.traverse((child) => {
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
        this.activeCoins = [];
        this.tokenQueue = [];

        this.baseGlowMaterial.dispose();

        this.textureCache.forEach(texture => texture.dispose());
        this.textureCache.clear();
        super.dispose();
    }
}