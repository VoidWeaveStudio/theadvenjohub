// src/features/game/world/locations/tower/floors/TokenGatesFloor.ts
import * as THREE from "three";
import { TowerFloor } from "../TowerFloor";
import { ResourceManager } from "../../../../core/ResourceManager";
import { createNpcModel, NpcHandle } from "../../../../entities/npcModel";
import { createNpcNameTag } from "../../../../entities/npcNameTag";
import { createCoinMesh } from "./basement/utils/meshFactory";
import { tokenTextureCache } from "../../../../utils/TokenTextureCache";
import type { FactionGateData } from "../../../../network/NetworkManager";

const HALL_HALF_WIDTH = 50;
const HALL_HALF_LENGTH = 35;
const GATE_SPACING = 10;
const GATE_SLOTS_PER_SIDE = 5;
const MC_REFRESH_MS = 30000;

let sharedPillarGeometry: THREE.BoxGeometry | null = null;
let sharedLintelGeometry: THREE.BoxGeometry | null = null;
let sharedPillarMaterial: THREE.MeshStandardMaterial | null = null;

function getPillarGeometry(): THREE.BoxGeometry {
    if (!sharedPillarGeometry) sharedPillarGeometry = new THREE.BoxGeometry(1.4, 9, 1.4);
    return sharedPillarGeometry;
}
function getLintelGeometry(): THREE.BoxGeometry {
    if (!sharedLintelGeometry) sharedLintelGeometry = new THREE.BoxGeometry(7.5, 1.3, 1.4);
    return sharedLintelGeometry;
}
function getPillarMaterial(): THREE.MeshStandardMaterial {
    if (!sharedPillarMaterial) {
        sharedPillarMaterial = new THREE.MeshStandardMaterial({ color: 0x8a6d4a, roughness: 0.85, metalness: 0.05 });
    }
    return sharedPillarMaterial;
}

interface GateInstance {
    data: FactionGateData;
    group: THREE.Group;
    coin: THREE.Group;
    nameSprite: THREE.Sprite;
    mcSprite: THREE.Sprite | null;
}

function formatMC(value: number): string {
    if (value > 1e9) return (value / 1e9).toFixed(1) + "B";
    if (value > 1e6) return (value / 1e6).toFixed(1) + "M";
    if (value > 1e3) return (value / 1e3).toFixed(1) + "K";
    return value.toFixed(0);
}

export class TokenGatesFloor extends TowerFloor {
    private stewardNpc!: NpcHandle;
    private stewardTime = 0;
    private gates: Map<string, GateInstance> = new Map();
    private occupiedSlots: Set<number> = new Set();
    private exitZone!: THREE.Box3;
    private mcInterval: ReturnType<typeof setInterval> | null = null;

    constructor() {
        super('tower-token-gates', 'Token Gates');
    }

    create(rm: ResourceManager): void {
        const skyColor = 0x87ceeb;
        const groundColor = 0xc2b280;
        this.scene.add(new THREE.HemisphereLight(skyColor, groundColor, 0.85));
        this.scene.background = new THREE.Color(skyColor);

        const sun = new THREE.DirectionalLight(0xfff1d0, 1.25);
        sun.position.set(80, 120, 60);
        sun.target.position.set(0, 0, 0);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.left = -HALL_HALF_WIDTH;
        sun.shadow.camera.right = HALL_HALF_WIDTH;
        sun.shadow.camera.top = HALL_HALF_LENGTH;
        sun.shadow.camera.bottom = -HALL_HALF_LENGTH;
        sun.shadow.camera.near = 10;
        sun.shadow.camera.far = 300;
        this.scene.add(sun);
        this.scene.add(sun.target);

        this.scene.fog = new THREE.FogExp2(0xe6d5b8, 0.004);

        this.buildFloor();
        this.buildWalls();
        this.buildSteward(rm);
        this.createCentralCrystal();

        this.exitZone = new THREE.Box3(
            new THREE.Vector3(-14, 0, HALL_HALF_LENGTH - 8),
            new THREE.Vector3(14, 20, HALL_HALF_LENGTH + 8)
        );

        this.mcInterval = setInterval(() => this.refreshAllMarketCaps(), MC_REFRESH_MS);
    }

    private buildFloor() {
        const floorMat = new THREE.MeshStandardMaterial({ color: 0xc2b280, roughness: 1.0, metalness: 0.0 });
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALL_HALF_WIDTH * 2, HALL_HALF_LENGTH * 2, 24, 24), floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
    }

    private buildWalls() {
        const wallMat = new THREE.MeshStandardMaterial({ color: 0xb59a6b, roughness: 0.95, metalness: 0.0 });
        const backWall = new THREE.Mesh(new THREE.BoxGeometry(HALL_HALF_WIDTH * 2 + 6, 26, 3), wallMat);
        backWall.position.set(0, 13, -HALL_HALF_LENGTH - 1.5);
        backWall.castShadow = true;
        backWall.receiveShadow = true;
        this.scene.add(backWall);
        this.collisionGrid.insert(new THREE.Box3().setFromObject(backWall));

        const sideDefs: Array<-1 | 1> = [-1, 1];
        sideDefs.forEach((side) => {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(3, 26, HALL_HALF_LENGTH * 2 + 6), wallMat);
            wall.position.set(side * (HALL_HALF_WIDTH + 1.5), 13, 0);
            wall.castShadow = true;
            wall.receiveShadow = true;
            this.scene.add(wall);
            this.collisionGrid.insert(new THREE.Box3().setFromObject(wall));
        });
    }

    private buildSteward(rm: ResourceManager) {
        const x = -10;
        const z = -HALL_HALF_LENGTH + 10;

        const steward = createNpcModel(rm, 0x6b4a2f, (headPos) => {
            const hood = new THREE.Mesh(
                new THREE.ConeGeometry(0.32, 0.42, 12),
                new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.8 })
            );
            hood.position.set(headPos.x, headPos.y + 0.32, headPos.z);

            const marker = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.18, 0),
                new THREE.MeshStandardMaterial({ color: 0xffd699, emissive: 0xe8a33d, emissiveIntensity: 5 })
            );
            marker.position.set(headPos.x, headPos.y + 0.9, headPos.z);

            const glow = new THREE.PointLight(0xe8a33d, 1.4, 6);
            glow.position.set(headPos.x, headPos.y - 0.2, headPos.z + 0.3);

            return [hood, marker, glow];
        });
        steward.group.position.set(x, 0, z);
        steward.group.userData.interactionId = "gate-steward";
        steward.group.add(createNpcNameTag("Corwin", "#E8A33D"));
        this.scene.add(steward.group);
        this.stewardNpc = steward;

        this.collisionGrid.insert(new THREE.Box3(
            new THREE.Vector3(x - 0.5, 0, z - 0.5),
            new THREE.Vector3(x + 0.5, 2.5, z + 0.5)
        ));
    }

    private slotPosition(index: number): { x: number; z: number; rotY: number } {
        const perSide = GATE_SLOTS_PER_SIDE;
        const side = index < perSide ? -1 : 1;
        const localIndex = index % perSide;
        const startZ = -((perSide - 1) * GATE_SPACING) / 2;
        const z = startZ + localIndex * GATE_SPACING;
        const x = side * (HALL_HALF_WIDTH - 4);
        const rotY = side === -1 ? -Math.PI / 2 : Math.PI / 2;
        return { x, z, rotY };
    }

    private nextFreeSlot(): number {
        const maxSlots = GATE_SLOTS_PER_SIDE * 2;
        for (let i = 0; i < maxSlots; i++) {
            if (!this.occupiedSlots.has(i)) return i;
        }
        return this.gates.size % maxSlots;
    }

    public handleFactionGatesState(list: FactionGateData[]) {
        const incomingIds = new Set(list.map((g) => g.factionId));

        for (const [factionId, instance] of Array.from(this.gates.entries())) {
            if (!incomingIds.has(factionId)) {
                this.removeGate(factionId, instance);
            }
        }

        for (const data of list) {
            if (!this.gates.has(data.factionId)) {
                this.spawnGate(data);
            }
        }
    }

    public addLocalGate(data: FactionGateData) {
        if (this.gates.has(data.factionId)) return;
        this.spawnGate(data);
    }

    public getFactionGateInfo(factionId: string): FactionGateData | undefined {
        return this.gates.get(factionId)?.data;
    }

    private spawnGate(data: FactionGateData) {
        const slot = this.nextFreeSlot();
        this.occupiedSlots.add(slot);
        const { x, z, rotY } = this.slotPosition(slot);

        const group = new THREE.Group();
        group.position.set(x, 0, z);
        group.rotation.y = rotY;
        group.userData.interactionId = `faction-gate-${data.factionId}`;
        group.userData.factionName = data.factionName;

        const pillarMat = getPillarMaterial();
        const leftPillar = new THREE.Mesh(getPillarGeometry(), pillarMat);
        leftPillar.position.set(-3, 4.5, 0);
        leftPillar.castShadow = true;
        const rightPillar = new THREE.Mesh(getPillarGeometry(), pillarMat);
        rightPillar.position.set(3, 4.5, 0);
        rightPillar.castShadow = true;
        const lintel = new THREE.Mesh(getLintelGeometry(), pillarMat);
        lintel.position.set(0, 9.3, 0);
        lintel.castShadow = true;
        group.add(leftPillar, rightPillar, lintel);

        const coin = createCoinMesh(new THREE.Texture(), 1.1, false, false, "gold");
        coin.position.set(0, 11, 0);
        group.add(coin);

        const nameSprite = this.createTextSprite(data.factionName, "#E5E7EB", 46);
        nameSprite.position.set(0, 13, 0);
        group.add(nameSprite);

        this.scene.add(group);

        const instance: GateInstance = { data, group, coin, nameSprite, mcSprite: null };
        this.gates.set(data.factionId, instance);

        if (data.image) {
            const url = data.image.startsWith("data:") ? data.image : `/api/image-proxy?url=${encodeURIComponent(data.image)}`;
            tokenTextureCache.load(url, (tex) => {
                coin.traverse((child: THREE.Object3D) => {
                    if (child instanceof THREE.Mesh) {
                        const mats = Array.isArray(child.material) ? child.material : [child.material];
                        mats.forEach((m: any) => {
                            if (m.map !== undefined && m.emissiveMap !== undefined) {
                                m.map = tex;
                                m.emissiveMap = tex;
                                m.needsUpdate = true;
                            }
                        });
                    }
                });
            });
        }

        this.refreshMarketCap(instance);

        const box = new THREE.Box3().setFromObject(group);
        this.collisionGrid.insert(box);
    }

    private removeGate(factionId: string, instance: GateInstance) {
        this.scene.remove(instance.group);
        instance.group.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if ((mesh as any).isMesh) {
                const geo = mesh.geometry;
                if (geo && geo !== sharedPillarGeometry && geo !== sharedLintelGeometry) geo.dispose();
                const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                mats.forEach((m) => { if (m && m !== sharedPillarMaterial) (m as THREE.Material).dispose(); });
            }
            if (obj instanceof THREE.Sprite) {
                (obj.material.map as THREE.Texture | null)?.dispose();
                obj.material.dispose();
            }
        });
        this.gates.delete(factionId);
    }

    private async refreshAllMarketCaps() {
        await Promise.all(Array.from(this.gates.values()).map((instance) => this.refreshMarketCap(instance)));
    }

    private async refreshMarketCap(instance: GateInstance) {
        if (!instance.data.tokenCa) return;
        try {
            const res = await fetch(`/api/token-by-ca?ca=${instance.data.tokenCa}`);
            const info = await res.json();
            const mc = info?.mc || 0;

            if (instance.mcSprite) {
                instance.group.remove(instance.mcSprite);
                (instance.mcSprite.material.map as THREE.Texture | null)?.dispose();
                instance.mcSprite.material.dispose();
            }
            const sprite = this.createTextSprite(`MC: ${formatMC(mc)}`, "#FFD166", 40);
            sprite.position.set(0, 11.9, 0);
            instance.group.add(sprite);
            instance.mcSprite = sprite;
        } catch {
        }
    }

    private createTextSprite(text: string, color: string, fontSize: number): THREE.Sprite {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 96;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = color;
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 6;
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(4, 0.75, 1);
        sprite.renderOrder = 999;
        return sprite;
    }

    update(playerPosition: THREE.Vector3, delta: number, isEPressed?: boolean) {
        super.update(playerPosition, delta, isEPressed);

        if (this.stewardNpc) {
            this.stewardTime += delta;
            this.stewardNpc.group.rotation.y = Math.sin(this.stewardTime * 0.4) * 0.3;
            this.stewardNpc.update(delta);
        }

        const t = performance.now() * 0.001;
        let i = 0;
        for (const instance of this.gates.values()) {
            instance.coin.rotation.y += delta * 1.2;
            instance.coin.position.y = 11 + Math.sin(t * 1.5 + i) * 0.2;
            i++;
        }

        if (this.exitZone.containsPoint(playerPosition)) {
            this.pendingTeleport = 'open-world-canyon';
        }
    }

    public override getInteractables(): THREE.Object3D[] {
        const interactables = [...super.getInteractables(), this.stewardNpc.group];
        for (const instance of this.gates.values()) interactables.push(instance.group);
        return interactables;
    }

    dispose() {
        if (this.mcInterval) clearInterval(this.mcInterval);

        if (this.stewardNpc) {
            this.stewardNpc.group.traverse((c: any) => { if (c.isMesh) { c.geometry.dispose(); c.material.dispose(); } });
            this.scene.remove(this.stewardNpc.group);
        }

        for (const [factionId, instance] of Array.from(this.gates.entries())) {
            this.removeGate(factionId, instance);
        }

        super.dispose();
    }
}
