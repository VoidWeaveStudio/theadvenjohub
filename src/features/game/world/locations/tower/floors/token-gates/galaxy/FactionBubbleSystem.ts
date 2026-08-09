// src/features/game/world/locations/tower/floors/token-gates/galaxy/FactionBubbleSystem.ts
import * as THREE from "three";
import { tokenTextureCache } from "../../../../../../utils/TokenTextureCache";
import type { FactionGateData } from "../../../../../../network/NetworkManager";
import { GALAXY, factionBubbleOrbit, orbitPosition, hashString, type BubbleOrbit } from "./GalaxyLayout";
import { AdminCoreBubble } from "./AdminCoreBubble";

const MC_REFRESH_MS = 30000;

interface FactionBubble {
    data: FactionGateData;
    group: THREE.Group;
    orbit: BubbleOrbit | null;
    slotIndex: number;
    radius: number;
    planet: THREE.Mesh | null;
    core: AdminCoreBubble | null;
    logo: THREE.Sprite;
    nameSprite: THREE.Sprite;
    mcSprite: THREE.Sprite | null;
    spin: number;
}

export interface BubbleContact {
    position: THREE.Vector3;
    radius: number;
    orbit: boolean;
}

export interface FactionBubbleSummary {
    factionId: string;
    factionName: string;
    image: string | null;
    isAdmin: boolean;
    position: THREE.Vector3;
}

function formatMC(value: number): string {
    if (value > 1e9) return (value / 1e9).toFixed(1) + "B";
    if (value > 1e6) return (value / 1e6).toFixed(1) + "M";
    if (value > 1e3) return (value / 1e3).toFixed(1) + "K";
    return value.toFixed(0);
}

function createTextSprite(text: string, color: string, fontSize: number, width: number): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 12;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(width, width * 0.1875, 1);
    return sprite;
}

function disposeSprite(sprite: THREE.Sprite) {
    (sprite.material.map as THREE.Texture | null)?.dispose();
    sprite.material.dispose();
}

export class FactionBubbleSystem {
    private bubbles: Map<string, FactionBubble> = new Map();
    private coreFactionId: string | null = null;
    private mcInterval: ReturnType<typeof setInterval> | null = null;
    private orbitTime = 0;

    private contacts: BubbleContact[] = [];

    private static readonly _pos = new THREE.Vector3();

    constructor(private scene: THREE.Object3D) { }

    start() {
        this.mcInterval = setInterval(() => this.refreshAllMarketCaps(), MC_REFRESH_MS);
    }

    public handleFactionGatesState(list: FactionGateData[]) {
        const incoming = new Set(list.map((g) => g.factionId));

        for (const [factionId, bubble] of Array.from(this.bubbles.entries())) {
            if (!incoming.has(factionId)) this.removeBubble(factionId, bubble);
        }

        for (const data of list) {
            const existing = this.bubbles.get(data.factionId);
            if (existing) {
                const authoritativeSlot = data.number != null ? data.number - 1 : existing.slotIndex;
                const shouldBeCore = !!data.isAdmin &&
                    (this.coreFactionId === null || this.coreFactionId === data.factionId);
                const isCoreNow = existing.orbit === null;
                if (authoritativeSlot !== existing.slotIndex || shouldBeCore !== isCoreNow) {
                    this.removeBubble(data.factionId, existing);
                    this.createBubble(data);
                } else {
                    existing.data = data;
                }
                continue;
            }
            this.createBubble(data);
        }
    }

    public addLocalGate(data: FactionGateData) {
        if (this.bubbles.has(data.factionId)) return;
        this.createBubble(data);
    }

    public getFactionGateInfo(factionId: string): FactionGateData | undefined {
        return this.bubbles.get(factionId)?.data;
    }

    public getInteractables(): THREE.Object3D[] {
        return Array.from(this.bubbles.values()).map((b) => b.group);
    }

    public getContacts(): BubbleContact[] {
        this.contacts.length = 0;
        for (const bubble of this.bubbles.values()) {
            this.contacts.push({
                position: bubble.group.position,
                radius: bubble.radius,
                orbit: bubble.orbit !== null,
            });
        }
        return this.contacts;
    }

    public getBubblePosition(factionId: string): THREE.Vector3 | null {
        const bubble = this.bubbles.get(factionId);
        return bubble ? bubble.group.position.clone() : null;
    }

    public getSummaries(): FactionBubbleSummary[] {
        return Array.from(this.bubbles.values()).map((bubble) => ({
            factionId: bubble.data.factionId,
            factionName: bubble.data.factionName,
            image: bubble.data.image,
            isAdmin: bubble.orbit === null,
            position: bubble.group.position.clone(),
        }));
    }

    private isCore(data: FactionGateData): boolean {
        if (!data.isAdmin) return false;
        return this.coreFactionId === null || this.coreFactionId === data.factionId;
    }

    private createBubble(data: FactionGateData) {
        const asCore = this.isCore(data);
        if (asCore) this.coreFactionId = data.factionId;

        const radius = asCore ? GALAXY.coreBubbleRadius : GALAXY.factionBubbleRadius;
        const slotIndex = Math.max(0, (data.number ?? this.bubbles.size + 1) - 1);
        const orbit = asCore ? null : factionBubbleOrbit(slotIndex);

        const group = new THREE.Group();
        group.userData.interactionId = `faction-gate-${data.factionId}`;
        group.userData.factionName = data.factionName;
        group.userData.isAdminFaction = asCore;
        group.userData.interactionRadius = radius * 1.45;

        let planet: THREE.Mesh | null = null;
        let core: AdminCoreBubble | null = null;

        if (asCore) {
            core = new AdminCoreBubble(radius);
            group.add(core.group);
        } else {
            const hue = (hashString(data.factionId) % 360) / 360;
            const surface = new THREE.Color().setHSL(hue, 0.5, 0.48);
            planet = new THREE.Mesh(
                new THREE.SphereGeometry(radius, 40, 28),
                new THREE.MeshStandardMaterial({
                    color: surface,
                    roughness: 0.82,
                    metalness: 0.12,
                    emissive: surface.clone().multiplyScalar(0.22),
                    emissiveIntensity: 0.6,
                })
            );
            planet.castShadow = false;
            group.add(planet);
        }

        const labelBase = radius * 1.25;
        const logo = new THREE.Sprite(
            new THREE.SpriteMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.98,
                depthTest: true,
                depthWrite: false,
            })
        );
        logo.scale.setScalar(radius * 1.15);
        logo.position.y = labelBase + radius * 1.5;
        logo.visible = false;
        group.add(logo);

        const nameSprite = createTextSprite(
            data.factionName,
            asCore ? "#FFD27A" : "#E5E7EB",
            48,
            radius * 3.2
        );
        nameSprite.position.y = labelBase + radius * 0.55;
        group.add(nameSprite);

        this.scene.add(group);

        const bubble: FactionBubble = {
            data,
            group,
            orbit,
            slotIndex,
            radius,
            planet,
            core,
            logo,
            nameSprite,
            mcSprite: null,
            spin: 0,
        };
        this.bubbles.set(data.factionId, bubble);

        this.positionBubble(bubble);
        this.loadLogo(bubble);
        this.refreshMarketCap(bubble);
    }

    private loadLogo(bubble: FactionBubble) {
        const image = bubble.data.image;
        if (!image) return;
        const url = image.startsWith("data:") ? image : `/api/image-proxy?url=${encodeURIComponent(image)}`;
        tokenTextureCache.load(url, (texture) => {
            bubble.logo.material.map = texture;
            bubble.logo.material.needsUpdate = true;
            bubble.logo.visible = true;
        });
    }

    private removeBubble(factionId: string, bubble: FactionBubble) {
        this.scene.remove(bubble.group);
        bubble.core?.dispose();
        bubble.group.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (mesh.isMesh) {
                mesh.geometry.dispose();
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach((m) => m.dispose());
                } else if (mesh.material) {
                    (mesh.material as THREE.Material).dispose();
                }
            }
        });
        bubble.logo.material.dispose();
        disposeSprite(bubble.nameSprite);
        if (bubble.mcSprite) disposeSprite(bubble.mcSprite);

        this.bubbles.delete(factionId);
        if (this.coreFactionId === factionId) this.coreFactionId = null;
    }

    private positionBubble(bubble: FactionBubble) {
        if (!bubble.orbit) {
            bubble.group.position.set(0, 0, 0);
            return;
        }
        orbitPosition(bubble.orbit, this.orbitTime, FactionBubbleSystem._pos);
        bubble.group.position.copy(FactionBubbleSystem._pos);
    }

    private async refreshAllMarketCaps() {
        await Promise.all(Array.from(this.bubbles.values()).map((b) => this.refreshMarketCap(b)));
    }

    private async refreshMarketCap(bubble: FactionBubble) {
        if (!bubble.data.tokenCa) return;
        try {
            const res = await fetch(`/api/token-by-ca?ca=${bubble.data.tokenCa}`);
            const info = await res.json();
            const mc = info?.mc || 0;

            if (bubble.mcSprite) {
                bubble.group.remove(bubble.mcSprite);
                disposeSprite(bubble.mcSprite);
            }

            const sprite = createTextSprite(`MC: ${formatMC(mc)}`, "#FFD166", 42, bubble.radius * 2.4);
            sprite.position.y = bubble.radius * 1.25;
            bubble.group.add(sprite);
            bubble.mcSprite = sprite;
        } catch {
        }
    }

    update(delta: number, orbitTime: number) {
        this.orbitTime = orbitTime;

        for (const bubble of this.bubbles.values()) {
            this.positionBubble(bubble);

            bubble.spin += delta;
            bubble.core?.update(delta);
            if (bubble.planet) bubble.planet.rotation.y += delta * 0.14;
        }
    }

    dispose() {
        if (this.mcInterval) clearInterval(this.mcInterval);
        this.mcInterval = null;
        for (const [factionId, bubble] of Array.from(this.bubbles.entries())) {
            this.removeBubble(factionId, bubble);
        }
        this.coreFactionId = null;
    }
}
