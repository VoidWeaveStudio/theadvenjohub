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

interface TokenColumn {
    group: THREE.Group;
    coin: THREE.Group;
    ca: string | null;
    texture?: THREE.Texture;
    mcText?: THREE.Sprite;
    baseCoinY: number;
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

    private columnTokens: (string | null)[] = [
        "9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump", "J8PSdNP3QewKq2Z1JJJFDMaqF7KcaiJhR7gbr5KZpump", "CFPkPq1eYPR8GLzEo59wUbbMioX4bshaTQiSGzTSpump",
        "B4ptaVsUe6YbtBwAS38WFeweSrVNfQLCcj9JRrtjU8vn", null, null, null, null, null, null
    ];
    private columns: TokenColumn[] = [];
    private columnUpdateInterval: NodeJS.Timeout | null = null;

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
        } else {
            console.error("[Basement] Failed to get cosmos model or nebula texture. Check file paths!");
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
        isOrbit: boolean = false
    ): THREE.Group {
        const group = new THREE.Group();
        const thickness = isColumn ? radius * 0.08 : radius * 0.4;
        const segments = radius > 1 ? 96 : 64;

        const geo = new THREE.CylinderGeometry(radius, radius, thickness, segments);
        
        let mat: THREE.MeshPhysicalMaterial;
        if (isColumn) {
            mat = new THREE.MeshPhysicalMaterial({
                map: texture,
                metalness: 0.1,
                roughness: 0,
                transmission: 0.6,
                thickness: 0.6,
                color: 0x99ccff,
                emissive: new THREE.Color(0x000000),
                emissiveIntensity: 0,
            });
        } else {
            mat = new THREE.MeshPhysicalMaterial({
                map: texture,
                metalness: 1,
                roughness: 0.18,
                clearcoat: 1,
                clearcoatRoughness: 0,
                reflectivity: 1,
                emissive: new THREE.Color(0xffffff),
                emissiveIntensity: 0.25,
                emissiveMap: texture
            });
        }

        const mainMesh = new THREE.Mesh(geo, mat);
        mainMesh.rotation.x = Math.PI / 2;
        mainMesh.castShadow = false;
        mainMesh.receiveShadow = false;
        group.add(mainMesh);

        if (isOrbit) {
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
        }

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

            const coinGroup = this.createCoinMesh(tex, 1.2, false, true);
            coinGroup.castShadow = false;
            coinGroup.receiveShadow = false;

            const glow = new THREE.Sprite(this.baseGlowMaterial.clone());
            glow.material.color.set(0xffd700);
            glow.scale.set(3.5, 3.5, 3.5);
            coinGroup.add(glow);

            this.scene.add(coinGroup);

            this.orbitData.push({
                mesh: coinGroup,
                baseRadius: 10 + i * 2.5,
                speed: 0.05 + Math.random() * 0.05,
                phase: Math.random() * Math.PI * 2
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

        const coinGroup = this.createCoinMesh(finalTexture, 0.4, false, false);

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

        const time = performance.now() * 0.001;

        for (let i = 0; i < this.columns.length; i++) {
            const col = this.columns[i];
            if (!col.coin) continue;

            col.coin.position.y = col.baseCoinY + Math.sin(time * 2 + i) * 0.5;

            const speed = (col.coin as any).rotSpeed || { x: 1, y: 1, z: 1 };
            col.coin.rotation.x += delta * speed.x;
            col.coin.rotation.y += delta * speed.y;
            col.coin.rotation.z += delta * speed.z;
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
                const center = new THREE.Vector3();
                box.getCenter(center);
                pedestal.position.sub(center);

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
            const coin = this.createCoinMesh(texture, 1.2, true, false);

            const baseCoinY = pedestalHeight + 0.5;
            coin.position.set(0, baseCoinY, 0);

            coin.lookAt(new THREE.Vector3(-x, baseCoinY, -z));

            const glow = new THREE.Sprite(
                new THREE.SpriteMaterial({
                    map: this.textureCache.get('glow'),
                    color: 0x00ffff,
                    transparent: true,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false,
                    opacity: 0.6
                })
            );
            glow.scale.set(10, 10, 1);
            glow.position.y = baseCoinY;
            group.add(glow);

            (coin as any).rotSpeed = {
                x: Math.random() * 2,
                y: Math.random() * 2,
                z: Math.random() * 2,
            };

            group.add(coin);

            group.position.set(x, 0, z);
            group.userData.interactionId = `column-${i}`;

            group.userData.tokenInfo = ca
                ? { name: "Loading...", symbol: "...", mc: 0 }
                : { name: "Empty Pedestal", symbol: "N/A", mc: 0 };

            this.scene.add(group);
            this.columns.push({ group, coin, ca, baseCoinY });
            this.collisionGrid.insert(new THREE.Box3().setFromObject(group));
        }
    }

    private setColumnHighlight(col: TokenColumn, active: boolean) {
        col.coin.traverse((obj) => {
            if ((obj as THREE.Mesh).isMesh) {
                const mat = (obj as THREE.Mesh).material as THREE.MeshPhysicalMaterial;
                if (active) {
                    mat.emissive.set(0x00ffff);
                    mat.emissiveIntensity = 1.5;
                } else {
                    mat.emissiveIntensity = 0;
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

                    if (!data) continue;

                    if (data.image) {
                        const tex = this.textureLoader.load(
                            `/api/image-proxy?url=${encodeURIComponent(data.image)}`
                        );
                        tex.colorSpace = THREE.SRGBColorSpace;

                        col.coin.traverse((child) => {
                            if (child instanceof THREE.Mesh) {
                                const mat = child.material as any;
                                if (mat.map !== undefined) {
                                    mat.map = tex;
                                    mat.needsUpdate = true;
                                }
                            }
                        });
                        col.texture = tex;
                    }

                    if (col.mcText) {
                        col.group.remove(col.mcText);
                        (col.mcText.material as THREE.SpriteMaterial).map?.dispose();
                        (col.mcText.material as THREE.Material).dispose();
                    }

                    const sprite = this.createTextSprite(`MC: ${this.formatMC(data.mc || 0)}`);
                    sprite.position.y = col.baseCoinY + 2;
                    col.group.add(sprite);
                    col.mcText = sprite;

                    col.group.userData.tokenInfo = data;

                } catch (e) {
                    console.warn(`[Basement] Failed to update column ${col.ca}`, e);
                }
            }
        }, 60000);
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