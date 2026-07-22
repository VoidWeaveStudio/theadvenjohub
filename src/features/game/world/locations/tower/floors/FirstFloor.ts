import * as THREE from "three";
import { TowerFloor } from "../TowerFloor";
import { ResourceManager } from "../../../../core/ResourceManager";
import { CollisionGrid } from "../../../CollisionGrid";
import { GATE_REGISTRY, getGateConfig } from "../../token-gates/GateRegistry";

interface GateGlowInfo {
    light: THREE.PointLight;
    panel: THREE.Mesh;
    baseIntensity: number;
    phase: number;
}

export class FirstFloor extends TowerFloor {
    private firstFloorCrystal!: THREE.Group;
    private gateCoins: Map<string, THREE.Group> = new Map();
    private gateGlows: GateGlowInfo[] = [];
    
    private readonly CANYON_HALF_LENGTH = 100;
    private readonly CANYON_HALF_WIDTH = 40;
    private exitZone!: THREE.Box3;

    constructor() {
        super('tower-first-floor', 'First Floor');
        this.collisionGrid = new CollisionGrid(300);
    }

    create(resourceManager: ResourceManager): void {
        const skyColor = 0x87CEEB;
        const groundColor = 0xC2B280;
        this.scene.add(new THREE.HemisphereLight(skyColor, groundColor, 0.8));
        this.scene.background = new THREE.Color(skyColor);
        
        const sun = new THREE.DirectionalLight(0xffffff, 1.2);
        sun.position.set(100, 200, 100);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.left = -150;
        sun.shadow.camera.right = 150;
        sun.shadow.camera.top = 150;
        sun.shadow.camera.bottom = -150;
        sun.shadow.camera.near = 10;
        sun.shadow.camera.far = 500;
        this.scene.add(sun);

        this.scene.fog = new THREE.FogExp2(0xE6D5B8, 0.005);

        const floorMat = new THREE.MeshStandardMaterial({ color: 0xC2B280, roughness: 1.0, metalness: 0.0 });
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(this.CANYON_HALF_WIDTH * 2, this.CANYON_HALF_LENGTH * 2, 32, 64), floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        floor.receiveShadow = true;
        this.scene.add(floor);
        
        this.collisionGrid.insert(new THREE.Box3(
            new THREE.Vector3(-this.CANYON_HALF_WIDTH, -0.5, -this.CANYON_HALF_LENGTH),
            new THREE.Vector3(this.CANYON_HALF_WIDTH, -0.1, this.CANYON_HALF_LENGTH)
        ));

        this.createWalls();
        this.createGatesAlongWalls();
        this.createFirstFloorCrystal();

        this.exitZone = new THREE.Box3(
            new THREE.Vector3(-15, 0, this.CANYON_HALF_LENGTH - 15),
            new THREE.Vector3(15, 20, this.CANYON_HALF_LENGTH + 5)
        );
    }

    private createWalls() {
        const sides: Array<-1 | 1> = [-1, 1];
        const segmentDepth = 5;
        const segments = Math.ceil((this.CANYON_HALF_LENGTH * 2) / segmentDepth);
        const baseHeight = 30;
        const EXIT_START = 70;

        sides.forEach((side) => {
            const group = new THREE.Group();

            for (let i = 0; i < segments; i++) {
                const z = -this.CANYON_HALF_LENGTH + i * segmentDepth + segmentDepth / 2;

                if (z > EXIT_START) continue;

                const height = baseHeight + (Math.random() * 10 - 4);
                const jitter = Math.random() * 2.2;
                const thickness = 4 + Math.random() * 3;

                const widthFactor = z > 40 ? THREE.MathUtils.lerp(1, 0.4, (z - 40) / 30) : 1;
                const dynamicWidth = this.CANYON_HALF_WIDTH * widthFactor;

                const mat = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(0xC2B280).lerp(new THREE.Color(0x8B7355), Math.random()),
                    roughness: 1.0,
                    metalness: 0.0,
                });
                
                const chunk = new THREE.Mesh(
                    new THREE.BoxGeometry(thickness, height, segmentDepth),
                    mat
                );
                
                const xBase = side * (dynamicWidth + thickness / 2);
                chunk.position.set(xBase - side * jitter, height / 2, z);
                chunk.castShadow = true;
                chunk.receiveShadow = true;
                group.add(chunk);

                const wallMinX = side === -1 ? xBase - thickness - 1 : xBase - 1;
                const wallMaxX = side === -1 ? xBase + 1 : xBase + thickness + 1;

                this.collisionGrid.insert(new THREE.Box3(
                    new THREE.Vector3(wallMinX, 0, z - segmentDepth / 2),
                    new THREE.Vector3(wallMaxX, height, z + segmentDepth / 2)
                ));
            }
            this.scene.add(group);
        });

        const backWallGroup = new THREE.Group();
        const backWall = new THREE.Mesh(
            new THREE.BoxGeometry(this.CANYON_HALF_WIDTH * 2 + 10, 40, 5),
            new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 1.0 })
        );
        backWall.position.set(0, 20, -this.CANYON_HALF_LENGTH - 2.5);
        backWall.castShadow = true;
        backWall.receiveShadow = true;
        backWallGroup.add(backWall);
        this.scene.add(backWallGroup);

        this.collisionGrid.insert(new THREE.Box3(
            new THREE.Vector3(-this.CANYON_HALF_WIDTH - 5, 0, -this.CANYON_HALF_LENGTH - 5),
            new THREE.Vector3(this.CANYON_HALF_WIDTH + 5, 40, -this.CANYON_HALF_LENGTH)
        ));
    }

    private createGatesAlongWalls() {
        const gatesCount = 39;
        const usableLength = 130;
        const startZ = -this.CANYON_HALF_LENGTH + 10;
        const spacing = usableLength / (gatesCount / 2);

        for (let i = 0; i < gatesCount; i++) {
            const config = GATE_REGISTRY[i];
            if (!config) continue;

            const side = i % 2 === 0 ? -1 : 1;
            const index = Math.floor(i / 2);
            const z = startZ + index * spacing;
            
            const widthFactor = z > 40 ? THREE.MathUtils.lerp(1, 0.4, (z - 40) / 30) : 1;
            const dynamicWidth = this.CANYON_HALF_WIDTH * widthFactor;
            
            const x = side * (dynamicWidth - 3);
            const rotation = side === -1 ? Math.PI / 2 : -Math.PI / 2;

            this.createGateVisuals(config, x, z, rotation);
            this.createGateCoin(config, x, z);
            this.createGateGlow(config, x, z, rotation);

            this.addPortal({
                id: config.id,
                position: new THREE.Vector3(x, 0, z),
                radius: 4,
                targetLocationId: config.targetLocationId,
                targetSpawnPoint: new THREE.Vector3(0, 0, -40),
                mesh: this.scene.children[this.scene.children.length - 1]
            });
        }
    }

    private createGateVisuals(config: any, x: number, z: number, rotation: number) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);
        group.rotation.y = rotation;
        group.userData.interactionId = config.id;

        const pillarGeo = new THREE.BoxGeometry(2, 8, 2);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x654321, roughness: 1.0 });

        const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
        leftPillar.position.set(-3, 4, 0);
        leftPillar.castShadow = true;

        const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
        rightPillar.position.set(3, 4, 0);
        rightPillar.castShadow = true;

        const topGeo = new THREE.BoxGeometry(8, 1.5, 2);
        const topMesh = new THREE.Mesh(topGeo, pillarMat);
        topMesh.position.set(0, 8.5, 0);
        topMesh.castShadow = true;

        group.add(leftPillar, rightPillar, topMesh);
        this.scene.add(group);
    }

    private createGateCoin(config: any, x: number, z: number) {
        const group = new THREE.Group();
        group.position.set(x, 7, z);
        
        const coinGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.2, 32);
        const coinMat = new THREE.MeshStandardMaterial({ 
            color: 0xffd700, emissive: 0x332200, emissiveIntensity: 0.5, metalness: 1.0, roughness: 0.3 
        });
        const coin = new THREE.Mesh(coinGeo, coinMat);
        coin.rotation.x = Math.PI / 2;
        group.add(coin);

        const glowGeo = new THREE.SphereGeometry(1.6, 16, 16);
        const glowMat = new THREE.MeshBasicMaterial({ color: 0xffcc66, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        group.add(glow);

        group.userData = { isGateCoin: true, ca: config.ca, gateId: config.id };
        this.scene.add(group);
        this.gateCoins.set(config.id, group);
    }

    private createGateGlow(config: any, x: number, z: number, rotation: number) {
        const dirX = Math.cos(rotation);
        const dirZ = Math.sin(rotation);

        const panel = new THREE.Mesh(
            new THREE.PlaneGeometry(5.2, 7.5),
            new THREE.MeshBasicMaterial({
                color: 0xffd39a,
                transparent: true,
                opacity: 0.28,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.DoubleSide,
            })
        );
        panel.position.set(x + dirX * 1.4, 4.2, z + dirZ * 1.4);
        panel.rotation.y = rotation + Math.PI / 2;
        this.scene.add(panel);

        const light = new THREE.PointLight(0xffb870, 2.2, 16, 2);
        light.position.set(x, 4, z);
        this.scene.add(light);

        this.gateGlows.push({ light, panel, baseIntensity: 2.2, phase: Math.random() * Math.PI * 2 });
    }

    private createFirstFloorCrystal() {
        const group = new THREE.Group();
        const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), new THREE.MeshStandardMaterial({ color: 0x66ccff, emissive: 0x3399ff, emissiveIntensity: 2 }));
        const shell = new THREE.Mesh(new THREE.OctahedronGeometry(1.5, 1), new THREE.MeshPhysicalMaterial({ color: 0x99ddff, transmission: 1, opacity: 0.6, transparent: true, roughness: 0, thickness: 0.5 }));
        const light = new THREE.PointLight(0x66ccff, 9, 45);
        light.position.set(0, 1.5, 0);
        group.add(core, shell, light);
        
        group.position.set(0, 1.5, -this.CANYON_HALF_LENGTH + 15);
        group.userData.interactionId = "tower-crystal";
        this.scene.add(group);
        this.firstFloorCrystal = group;
        
        this.collisionGrid.insert(new THREE.Box3(
            new THREE.Vector3(-1, 0, -1),
            new THREE.Vector3(1, 3, 1)
        ).translate(group.position));
    }

    update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        super.update(playerPosition, delta, isEPressed);

        if (this.firstFloorCrystal) {
            const t = performance.now() * 0.002;
            this.firstFloorCrystal.rotation.y += delta * 0.6;
            this.firstFloorCrystal.position.y = 1.5 + Math.sin(t) * 0.2;
        }

        this.gateCoins.forEach((coinGroup) => {
            coinGroup.rotation.y += delta * 1.5;
            coinGroup.position.y = 7 + Math.sin(performance.now() * 0.003 + coinGroup.position.x) * 0.3;
        });

        const now = performance.now() * 0.005;
        this.gateGlows.forEach((glow) => {
            const pulse = Math.sin(now * 0.6 + glow.phase) * 0.15;
            glow.light.intensity = glow.baseIntensity + pulse;
            (glow.panel.material as THREE.MeshBasicMaterial).opacity = 0.28 + pulse * 0.05;
        });

        if (this.exitZone.containsPoint(playerPosition)) {
            this.pendingTeleport = 'open-world-canyon';
        }
    }

    getSpawnPoint(): THREE.Vector3 {
        const crystalPos = this.firstFloorCrystal.position;
        const radius = 8;

        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2;
            const x = crystalPos.x + Math.cos(angle) * radius;
            const z = crystalPos.z + Math.sin(angle) * radius;
            
            const playerBox = new THREE.Box3(
                new THREE.Vector3(x - 0.5, 0.1, z - 0.5),
                new THREE.Vector3(x + 0.5, 2.0, z + 0.5)
            );

            const hasCollision = typeof (this.collisionGrid as any).collides === 'function' 
                ? (this.collisionGrid as any).collides(playerBox)
                : false; 

            if (!hasCollision) {
                return new THREE.Vector3(x, 2, z);
            }
        }

        return new THREE.Vector3(crystalPos.x, 2, crystalPos.z + 10);
    }

    public override getInteractables(): THREE.Object3D[] {
        const interactables = [this.firstFloorCrystal];
        this.gateCoins.forEach(coin => interactables.push(coin));
        return interactables;
    }

    dispose() {
        if (this.firstFloorCrystal) {
            this.firstFloorCrystal.traverse((c: any) => { if(c.isMesh) { c.geometry.dispose(); c.material.dispose(); } });
            this.scene.remove(this.firstFloorCrystal);
        }
        this.gateCoins.forEach(coin => {
            coin.traverse((c: any) => { if(c.isMesh) { c.geometry.dispose(); c.material.dispose(); } });
            this.scene.remove(coin);
        });
        this.gateCoins.clear();
        this.gateGlows = [];

        this.scene.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if ((mesh as any).isMesh) {
                mesh.geometry.dispose();
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach((m: THREE.Material) => m.dispose());
                } else if (mesh.material) {
                    (mesh.material as THREE.Material).dispose();
                }
            }
        });

        super.dispose();
    }
}