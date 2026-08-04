// src/features/game/world/locations/tower/floors/token-gates/systems/GateDisplaySystem.ts
import * as THREE from "three";
import type { TokenGatesFloor } from "../../TokenGatesFloor";
import type { GateSlot } from "./GateLayoutSystem";
import { createCoinMesh } from "../../basement/utils/meshFactory";
import { tokenTextureCache } from "../../../../../../utils/TokenTextureCache";
import type { FactionGateData } from "../../../../../../network/NetworkManager";

const MC_REFRESH_MS = 30000;

interface SlotDisplay {
    slot: GateSlot;
    data: FactionGateData;
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

function createTextSprite(text: string, color: string, fontSize: number): THREE.Sprite {
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

export class GateDisplaySystem {
    private displays: Map<string, SlotDisplay> = new Map();
    private mcInterval: ReturnType<typeof setInterval> | null = null;

    constructor(private floor: TokenGatesFloor) { }

    start() {
        this.mcInterval = setInterval(() => this.refreshAllMarketCaps(), MC_REFRESH_MS);
    }

    public handleFactionGatesState(list: FactionGateData[]) {
        const incomingIds = new Set(list.map((g) => g.factionId));

        for (const [factionId, display] of Array.from(this.displays.entries())) {
            if (!incomingIds.has(factionId)) {
                this.clearSlot(factionId, display);
            }
        }

        for (const data of list) {
            if (!this.displays.has(data.factionId)) {
                this.occupySlot(data);
            }
        }
    }

    public addLocalGate(data: FactionGateData) {
        if (this.displays.has(data.factionId)) return;
        this.occupySlot(data);
    }

    public getFactionGateInfo(factionId: string): FactionGateData | undefined {
        return this.displays.get(factionId)?.data;
    }

    private findFreeSlot(): GateSlot | null {
        return this.floor.layout.slots.find((s) => s.occupantFactionId === null) ?? null;
    }

    private occupySlot(data: FactionGateData) {
        const slot = this.findFreeSlot();
        if (!slot) return;
        slot.occupantFactionId = data.factionId;

        const coin = createCoinMesh(new THREE.Texture(), 1.1, false, false, "gold");
        coin.position.set(0, 1.6, 0.3);
        slot.mountPoint.add(coin);

        const nameSprite = createTextSprite(data.factionName, "#E5E7EB", 46);
        nameSprite.position.set(0, 3.6, 0.3);
        slot.mountPoint.add(nameSprite);

        slot.group.userData.interactionId = `faction-gate-${data.factionId}`;
        slot.group.userData.factionName = data.factionName;

        const display: SlotDisplay = { slot, data, coin, nameSprite, mcSprite: null };
        this.displays.set(data.factionId, display);

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

        this.refreshMarketCap(display);
    }

    private clearSlot(factionId: string, display: SlotDisplay) {
        display.slot.mountPoint.remove(display.coin, display.nameSprite);
        display.coin.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if ((mesh as any).isMesh) {
                mesh.geometry?.dispose();
                const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                mats.forEach((m) => (m as THREE.Material)?.dispose());
            }
        });
        (display.nameSprite.material.map as THREE.Texture | null)?.dispose();
        display.nameSprite.material.dispose();
        if (display.mcSprite) {
            display.slot.mountPoint.remove(display.mcSprite);
            (display.mcSprite.material.map as THREE.Texture | null)?.dispose();
            display.mcSprite.material.dispose();
        }

        display.slot.group.userData.interactionId = undefined;
        display.slot.group.userData.factionName = undefined;
        display.slot.occupantFactionId = null;
        this.displays.delete(factionId);
    }

    private async refreshAllMarketCaps() {
        await Promise.all(Array.from(this.displays.values()).map((d) => this.refreshMarketCap(d)));
    }

    private async refreshMarketCap(display: SlotDisplay) {
        if (!display.data.tokenCa) return;
        try {
            const res = await fetch(`/api/token-by-ca?ca=${display.data.tokenCa}`);
            const info = await res.json();
            const mc = info?.mc || 0;

            if (display.mcSprite) {
                display.slot.mountPoint.remove(display.mcSprite);
                (display.mcSprite.material.map as THREE.Texture | null)?.dispose();
                display.mcSprite.material.dispose();
            }
            const sprite = createTextSprite(`MC: ${formatMC(mc)}`, "#FFD166", 40);
            sprite.position.set(0, 2.5, 0.3);
            display.slot.mountPoint.add(sprite);
            display.mcSprite = sprite;
        } catch {
        }
    }

    update(delta: number) {
        const t = performance.now() * 0.001;
        let i = 0;
        for (const display of this.displays.values()) {
            display.coin.rotation.y += delta * 1.2;
            display.coin.position.y = 1.6 + Math.sin(t * 1.5 + i) * 0.15;
            i++;
        }
    }

    public getInteractables(): THREE.Object3D[] {
        return this.floor.layout.slots.map((s) => s.group);
    }

    dispose() {
        if (this.mcInterval) clearInterval(this.mcInterval);
        for (const [factionId, display] of Array.from(this.displays.entries())) {
            this.clearSlot(factionId, display);
        }
    }
}
