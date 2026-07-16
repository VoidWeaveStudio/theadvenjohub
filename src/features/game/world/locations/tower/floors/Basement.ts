// src/features/game/world/locations/tower/floors/Basement.ts
import * as THREE from "three";
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
    glow?: THREE.Sprite;
    velocity: number;
    rotationSpeed: number;
}

export class Basement extends TowerFloor {
    private activeCoins: ActiveCoin[] = [];
    private tokenQueue: MemeToken[] = [];
    private textureCache = new Map<string, THREE.Texture>();

    private orbitData: {
        mesh: THREE.Object3D;
        baseRadius: number;
        speed: number;
        phase: number;
    }[] = [];

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

    constructor() {
        super("tower-basement", "Gloomy Tower Basement");
        this.textureCache.set('fallback', createFallbackCoinTexture());
    }

    create(rm: ResourceManager) {
        const bgColor = 0x000000;
        this.scene.background = new THREE.Color(bgColor);

        const ambient = new THREE.AmbientLight(0x203040, 0.12);
        this.scene.add(ambient);

        const hemi = new THREE.HemisphereLight(0x3d78ff, 0x030508, 0.20);
        this.scene.add(hemi);

        const cosmosData = rm.getModel("cosmos");
        const nebulaTexture = rm.getTexture("nebula-sky");

        if (cosmosData && nebulaTexture) {
            console.log("[Basement] 🌌 Cosmos data & Nebula texture received. Building skybox...");
            this.skySphere = cosmosData.scene;

            this.skySphere.scale.set(100, 100, 100);
            this.skySphere.position.set(0, 0, 0);
            this.skySphere.renderOrder = -1000;

            this.skySphere.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    const mesh = child as THREE.Mesh;
                    const mat = new THREE.MeshBasicMaterial({
                        map: nebulaTexture,
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
            console.log("[Basement] ✅ HUGE Skybox added! Scale: 100");
        } else {
            console.error("[Basement] ❌ Failed to get cosmos model or nebula texture. Check file paths!");
        }

        const wallMat = new THREE.MeshStandardMaterial({ color: 0x5a5548, roughness: 0.95, metalness: 0.05 });

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
        const height = 15;
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

        const wall = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 32, 1, true), wallMat);
        wall.position.y = height / 2;
        wall.receiveShadow = true;
        this.scene.add(wall);

        const portalData = rm.getModel("portalVFX");
        if (portalData) {
            console.log("[Basement] 🌀 Loading portal VFX...");
            this.portalVFX = portalData.scene;

            this.portalVFX.scale.set(7.5, 7.5, 7.5);
            this.portalVFX.position.set(0, this.HOLE_Y + 0.05, 0);
            this.portalVFX.rotation.x = -Math.PI / 2;
            this.scene.add(this.portalVFX);

            let materialCount = 0;
            this.portalVFX.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) {
                    const mesh = child as THREE.Mesh;
                    const oldMat = mesh.material as THREE.MeshStandardMaterial;
                    materialCount++;

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

            console.log(`[Basement] ✅ Portal loaded with ${materialCount} materials. Scale: 7.5`);

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

        const sun = new THREE.DirectionalLight(0xa8c8ff, 3.5);
        sun.position.set(12, 22, 10);
        sun.castShadow = true;
        sun.shadow.mapSize.set(4096, 4096);
        sun.shadow.radius = 4;
        sun.shadow.bias = -0.00003;
        sun.shadow.normalBias = 0.02;
        sun.shadow.camera.left = -50;
        sun.shadow.camera.right = 50;
        sun.shadow.camera.top = 50;
        sun.shadow.camera.bottom = -50;
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 80;
        this.scene.add(sun);

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

        const wallThicknessOuter = 2;
        const wallSegments = 32;
        for (let i = 0; i < wallSegments; i++) {
            const angle = (i / wallSegments) * Math.PI * 2;
            const nextAngle = ((i + 1) / wallSegments) * Math.PI * 2;
            const x1 = Math.cos(angle) * (radius - wallThicknessOuter / 2);
            const z1 = Math.sin(angle) * (radius - wallThicknessOuter / 2);
            const x2 = Math.cos(nextAngle) * (radius - wallThicknessOuter / 2);
            const z2 = Math.sin(nextAngle) * (radius - wallThicknessOuter / 2);

            this.collisionGrid.insert(new THREE.Box3(
                new THREE.Vector3(Math.min(x1, x2) - wallThicknessOuter, 0, Math.min(z1, z2) - wallThicknessOuter),
                new THREE.Vector3(Math.max(x1, x2) + wallThicknessOuter, height, Math.max(z1, z2) + wallThicknessOuter)
            ));
        }

        this.createBasementCrystal(radius);
        this.spawnOrbitCoins(rm);

        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const x = Math.cos(angle) * (radius - 3);
            const z = Math.sin(angle) * (radius - 3);
            const crate = new THREE.Mesh(
                new THREE.BoxGeometry(2, 2, 2),
                new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.8 })
            );
            crate.position.set(x, 1, z);
            crate.castShadow = true;
            crate.receiveShadow = true;
            this.scene.add(crate);
            this.collisionGrid.insert(new THREE.Box3().setFromObject(crate));
        }

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

    private createCoinMesh(texture: THREE.Texture, radius: number = 0.4): THREE.Group {
        const group = new THREE.Group();
        const thickness = radius * 0.4; 
        const segments = radius > 1 ? 96 : 64; 
        
        const geo = new THREE.CylinderGeometry(radius, radius, thickness, segments);
        const mat = new THREE.MeshPhysicalMaterial({
            map: texture,
            metalness: 1,
            roughness: 0.18,
            clearcoat: 1,
            clearcoatRoughness: 0,
            reflectivity: 1,
            emissive: 0xffffff,
            emissiveMap: texture,
            emissiveIntensity: 0.25
        });
        const mainMesh = new THREE.Mesh(geo, mat);
        mainMesh.rotation.x = Math.PI / 2;
        mainMesh.castShadow = false;
        mainMesh.receiveShadow = false;
        group.add(mainMesh);

        const rimGeo = new THREE.TorusGeometry(radius * 1.02, radius * 0.035, 16, 64);
        const rimMat = new THREE.MeshPhysicalMaterial({
            color: 0xffd44d,
            metalness: 1,
            roughness: 0.08,
            clearcoat: 1
        });
        const rim = new THREE.Mesh(rimGeo, rimMat);
        rim.rotation.x = Math.PI / 2;
        group.add(rim);

        const logoGeo = new THREE.CircleGeometry(radius * 0.8, 64);
        const logoMat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.95
        });
        
        const logo = new THREE.Mesh(logoGeo, logoMat);
        logo.position.y = (thickness / 2) + 0.01;
        logo.rotation.x = -Math.PI / 2;
        mainMesh.add(logo);
        
        const logoBack = new THREE.Mesh(logoGeo, logoMat);
        logoBack.position.y = -(thickness / 2) - 0.01;
        logoBack.rotation.x = Math.PI / 2;
        mainMesh.add(logoBack);

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
        return tex;
    }

    private spawnOrbitCoins(rm: ResourceManager) {
        const customLogo = this.textureLoader.load("/logo.png");
        customLogo.colorSpace = THREE.SRGBColorSpace;

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

            const coinGroup = this.createCoinMesh(tex, 3.5);
            coinGroup.castShadow = false;
            coinGroup.receiveShadow = false;

            this.scene.add(coinGroup);

            this.orbitData.push({
                mesh: coinGroup,
                baseRadius: 45 + i * 6,
                speed: 0.05 + Math.random() * 0.05,
                phase: Math.random() * Math.PI * 2
            });
        });
    }

    public override getInteractables(): THREE.Object3D[] {
        return this.basementCrystal ? [this.basementCrystal] : [];
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
                if (oldCoin.glow) {
                    (oldCoin.glow.material as THREE.Material).dispose();
                }
            }
        }

        const fallbackTexture = this.textureCache.get('fallback')!;
        let texture: THREE.Texture | undefined = this.textureCache.get(token.image);

        if (!texture && token.image && token.image !== 'fallback') {
            const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(token.image)}`;
            texture = this.textureLoader.load(proxyUrl, undefined, undefined, () => {
                this.textureCache.set(token.image, fallbackTexture);
            });
            texture.colorSpace = THREE.SRGBColorSpace;
            this.textureCache.set(token.image, texture);
        }
        const finalTexture = (texture && token.image !== 'fallback') ? texture : fallbackTexture;

        const coinGroup = this.createCoinMesh(finalTexture, 0.4);
        
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

        const glowMat = this.baseGlowMaterial.clone();
        const glow = new THREE.Sprite(glowMat);
        glow.scale.set(1.5, 1.5, 1.5);
        coinGroup.add(glow);

        this.scene.add(coinGroup);
        this.activeCoins.push({
            mesh: coinGroup,
            glow: glow,
            velocity: -0.04,
            rotationSpeed: 1.0 + Math.random() * 2.0
        });
    }

    update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        super.update(playerPosition, delta, isEPressed);

        if (this.skySphere && !this._skyLogged) {
            this._skyLogged = true;
            const sphereRadius = 100 * 100;
            const distToCenter = playerPosition.distanceTo(new THREE.Vector3(0, 0, 0));
            console.log(`[Basement] 🎥 Camera check: Player dist to center = ${distToCenter.toFixed(1)}. Sphere radius = ${sphereRadius}. Inside? ${distToCenter < sphereRadius ? 'YES ✅' : 'NO ❌'}`);
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

        this.orbitData.forEach((c) => {
            const t = performance.now() * 0.0005 * c.speed + c.phase;
            const radius = c.baseRadius + Math.sin(t * 2) * 2;

            c.mesh.position.x = Math.cos(t) * radius;
            c.mesh.position.z = Math.sin(t) * radius;
            c.mesh.position.y = 10 + Math.sin(t * 1.5) * 3;
            c.mesh.rotation.y += 0.003;
        });

        const SINK_Y = -5;

        for (let i = this.activeCoins.length - 1; i >= 0; i--) {
            const coin = this.activeCoins[i];

            coin.velocity -= 1 * delta;
            coin.mesh.position.y += coin.velocity * delta;

            coin.mesh.rotation.y += coin.rotationSpeed * delta;
            coin.mesh.rotation.x += coin.rotationSpeed * 0.5 * delta;

            coin.mesh.scale.lerp(this.TARGET_SCALE, 3 * delta);

            const isSinking = (coin.mesh as THREE.Object3D).position.y < SINK_Y + 2;

            if (isSinking) {
                (coin.mesh as THREE.Object3D).traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        const mat = child.material as THREE.MeshPhysicalMaterial | THREE.MeshBasicMaterial;
                        if (mat.opacity !== undefined) {
                            mat.opacity = Math.max(0, mat.opacity - delta * 1.5);
                            mat.transparent = true;
                        }
                    }
                });

                if (coin.glow) {
                    const glowMat = coin.glow.material as THREE.SpriteMaterial;
                    glowMat.opacity = Math.max(0, glowMat.opacity - delta * 1.5);
                }
            } else {
                if (coin.glow) {
                    const t = performance.now() * 0.003 + i;
                    const glowMat = coin.glow.material as THREE.SpriteMaterial;
                    glowMat.opacity = 0.5 + Math.sin(t) * 0.2;
                }
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
                if (coin.glow) {
                    (coin.glow.material as THREE.Material).dispose();
                }
                this.activeCoins.splice(i, 1);
            }
        }
    }

    getSpawnPoint(): THREE.Vector3 {
        return new THREE.Vector3(0, 2, 8);
    }

    dispose() {
        if (this.pollInterval) { clearInterval(this.pollInterval); this.pollInterval = null; }
        if (this.spawnInterval) { clearInterval(this.spawnInterval); this.spawnInterval = null; }
        if (this.clearQueueInterval) { clearInterval(this.clearQueueInterval); this.clearQueueInterval = null; }

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
            if (coin.glow) {
                (coin.glow.material as THREE.Material).dispose();
            }
        }
        this.activeCoins = [];
        this.tokenQueue = [];

        this.baseGlowMaterial.dispose();

        this.textureCache.forEach(texture => texture.dispose());
        this.textureCache.clear();
        super.dispose();
    }
}