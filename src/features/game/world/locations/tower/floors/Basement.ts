//src\features\game\world\locations\tower\floors\Basement.ts
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

export interface MemeToken {
    address: string;
    name: string;
    symbol: string;
    image: string;
    chainId?: string;
    url?: string;
}

interface ActiveCoin {
    mesh: THREE.Mesh;
    velocity: number;
    rotationSpeed: number;
}

export class Basement extends TowerFloor {
    private activeCoins: ActiveCoin[] = [];
    private tokenQueue: MemeToken[] = [];
    private textureCache = new Map<string, THREE.Texture>();

    private pollInterval: NodeJS.Timeout | null = null;
    private spawnInterval: NodeJS.Timeout | null = null;
    private clearQueueInterval: NodeJS.Timeout | null = null;

    private readonly MAX_COINS = 50;
    private readonly MAX_QUEUE_SIZE = 200;
    private readonly HOLE_Y = 14.5;

    constructor() {
        super("tower-basement", "Gloomy Tower Basement");
        this.textureCache.set('fallback', createFallbackCoinTexture());
    }

    create(rm: ResourceManager) {
        const bgColor = 0x0f1115;
        this.scene.background = new THREE.Color(bgColor);
        this.scene.fog = new THREE.FogExp2(bgColor, 0.012);

        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient);

        const globalLight = new THREE.HemisphereLight(0xffffff, 0x222233, 0.6);
        this.scene.add(globalLight);

        const fillLight = new THREE.PointLight(0xffcc88, 4, 30);
        fillLight.position.set(0, 5, 0);
        this.scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xffeecc, 2);
        rimLight.position.set(5, 10, 5);
        this.scene.add(rimLight);

        const wallMat = new THREE.MeshStandardMaterial({ color: 0x5a5548, roughness: 0.95, metalness: 0.05 });
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x3a3528, roughness: 0.9, metalness: 0.1 });
        const holeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

        const radius = 20;
        const height = 15;

        const floor = new THREE.Mesh(new THREE.CircleGeometry(radius, 32), floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        const wall = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 32, 1, true), wallMat);
        wall.position.y = height / 2;
        wall.receiveShadow = true;
        this.scene.add(wall);

        const hole = new THREE.Mesh(new THREE.CircleGeometry(2.5, 32), holeMat);
        hole.position.set(0, this.HOLE_Y + 0.1, 0);
        hole.rotation.x = Math.PI / 2;
        this.scene.add(hole);

        const vaultLight = new THREE.SpotLight(0xffddaa, 20, 30, 0.9, 0.3, 1);
        vaultLight.position.set(0, this.HOLE_Y, 0);
        vaultLight.target.position.set(0, 0, 0);
        vaultLight.castShadow = true;
        vaultLight.shadow.mapSize.width = 512;
        vaultLight.shadow.mapSize.height = 512;
        this.scene.add(vaultLight);
        this.scene.add(vaultLight.target);

        this.createDustParticles();

        const floorCollider = new THREE.Box3(
            new THREE.Vector3(-radius, -0.1, -radius),
            new THREE.Vector3(radius, 0.1, radius)
        );
        this.collisionGrid.insert(floorCollider);

        const wallThickness = 2;
        const wallSegments = 16;
        for (let i = 0; i < wallSegments; i++) {
            const angle = (i / wallSegments) * Math.PI * 2;
            const nextAngle = ((i + 1) / wallSegments) * Math.PI * 2;
            const x1 = Math.cos(angle) * (radius - wallThickness / 2);
            const z1 = Math.sin(angle) * (radius - wallThickness / 2);
            const x2 = Math.cos(nextAngle) * (radius - wallThickness / 2);
            const z2 = Math.sin(nextAngle) * (radius - wallThickness / 2);

            this.collisionGrid.insert(new THREE.Box3(
                new THREE.Vector3(Math.min(x1, x2) - wallThickness, 0, Math.min(z1, z2) - wallThickness),
                new THREE.Vector3(Math.max(x1, x2) + wallThickness, height, Math.max(z1, z2) + wallThickness)
            ));
        }

        this.createCentralCrystal();

        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
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

    private createDustParticles() {
        const particleCount = 200;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 6;
            pos[i * 3 + 1] = Math.random() * 14;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 6;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

        const mat = new THREE.PointsMaterial({
            color: 0xffddaa,
            size: 0.08,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

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
                    if (this.tokenQueue.length >= this.MAX_QUEUE_SIZE) {
                        break;
                    }
                    this.tokenQueue.push(token);
                }
            } catch (e) {
                // Silent fail for polling
            }
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
        this.clearQueueInterval = setInterval(() => {
            this.tokenQueue = [];
        }, 300000);
    }

    private spawnCoin(token: MemeToken) {
        if (this.activeCoins.length >= this.MAX_COINS) {
            const oldCoin = this.activeCoins.shift();
            if (oldCoin) {
                this.scene.remove(oldCoin.mesh);
                oldCoin.mesh.geometry.dispose();
                (oldCoin.mesh.material as THREE.Material).dispose();
            }
        }

        const fallbackTexture = this.textureCache.get('fallback')!;
        let texture: THREE.Texture | undefined = this.textureCache.get(token.image);

        if (!texture && token.image && token.image !== 'fallback') {
            const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(token.image)}`;

            texture = new THREE.TextureLoader().load(
                proxyUrl,
                undefined,
                undefined,
                () => {
                    this.textureCache.set(token.image, fallbackTexture);
                }
            );
            texture.colorSpace = THREE.SRGBColorSpace;
            this.textureCache.set(token.image, texture);
        }

        const finalTexture = (texture && token.image !== 'fallback') ? texture : fallbackTexture;

        const mat = new THREE.MeshStandardMaterial({
            map: finalTexture,
            metalness: 0.4,
            roughness: 0.4,
            emissive: 0xffffff,
            emissiveMap: finalTexture,
            emissiveIntensity: 0.3
        });

        const geo = new THREE.CylinderGeometry(0.4, 0.4, 0.05, 32);
        const coin = new THREE.Mesh(geo, mat);

        coin.position.set(
            (Math.random() - 0.5) * 3,
            this.HOLE_Y,
            (Math.random() - 0.5) * 3
        );

        coin.castShadow = true;
        coin.receiveShadow = true;
        this.scene.add(coin);

        this.activeCoins.push({
            mesh: coin,
            velocity: -(2.0 + Math.random() * 1.5),
            rotationSpeed: 1.0 + Math.random() * 2.0
        });
    }

    update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        super.update(playerPosition, delta, isEPressed);

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

        for (let i = this.activeCoins.length - 1; i >= 0; i--) {
            const coin = this.activeCoins[i];

            coin.mesh.position.y += coin.velocity * delta;
            coin.mesh.rotation.y += coin.rotationSpeed * delta;
            coin.mesh.rotation.x += coin.rotationSpeed * 0.5 * delta;

            if (coin.mesh.position.y <= 0.5) {
                this.scene.remove(coin.mesh);
                coin.mesh.geometry.dispose();
                (coin.mesh.material as THREE.Material).dispose();
                this.activeCoins.splice(i, 1);
            }
        }
    }

    getSpawnPoint(): THREE.Vector3 {
        return new THREE.Vector3(0, 2, 8);
    }

    dispose() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        if (this.spawnInterval) {
            clearInterval(this.spawnInterval);
            this.spawnInterval = null;
        }
        if (this.clearQueueInterval) {
            clearInterval(this.clearQueueInterval);
            this.clearQueueInterval = null;
        }

        for (const coin of this.activeCoins) {
            this.scene.remove(coin.mesh);
            coin.mesh.geometry.dispose();
            (coin.mesh.material as THREE.Material).dispose();
        }
        this.activeCoins = [];
        this.tokenQueue = [];

        this.textureCache.forEach(texture => texture.dispose());
        this.textureCache.clear();

        super.dispose();
    }
}