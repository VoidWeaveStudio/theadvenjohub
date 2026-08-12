// src/features/game/world/locations/tower/floors/basement/systems/TokenColumnSystem.ts
import * as THREE from "three";
import { ResourceManager } from "../../../../../../core/ResourceManager";
import { createCoinMesh, disposeCoinMesh } from "../utils/meshFactory";
import {
    createColumnField,
    COIN_BASE_Y,
    COLUMN_HEIGHT,
    COLUMN_TOP_RADIUS,
    type ColumnField,
    type ColumnPlacement,
} from "../utils/proceduralColumn";
import type { Basement } from "../Basement";

const COLUMN_COLLIDER_SCALE = 1.9;
const COLUMN_RING_RADIUS = 70;
const COLUMN_COUNT = 10;

interface TokenColumn {
    group: THREE.Group;
    coin: THREE.Group;
    ca: string | null;
    texture?: THREE.Texture;
    mcText?: THREE.Sprite;
    baseCoinY: number;
}

export class TokenColumnSystem {
    private columnTokens: (string | null)[] = new Array(COLUMN_COUNT).fill(null);
    public columns: TokenColumn[] = [];
    private field: ColumnField | null = null;
    private columnUpdateInterval: NodeJS.Timeout | null = null;
    private gameSlug: string | null = null;
    private initialSync: Promise<void> | null = null;
    private pendingColumnLoads: Promise<void>[] = [];

    constructor(private floor: Basement) { }

    public async syncFromServer(gameSlug: string) {
        this.gameSlug = gameSlug;
        this.initialSync = this.refreshAssignments();
        await this.initialSync;
    }

    public async whenReady() {
        if (this.initialSync) await this.initialSync;
        await Promise.all(this.pendingColumnLoads);
    }

    private async refreshAssignments() {
        if (!this.gameSlug) return;

        try {
            const res = await fetch(
                `/api/game/basement-columns?gameSlug=${encodeURIComponent(this.gameSlug)}`,
                { cache: "no-store" }
            );
            if (!res.ok) return;
            const data = await res.json();
            if (!Array.isArray(data?.columns)) return;
            this.applyColumnTokens(data.columns);
        } catch {
            return;
        }
    }

    public applyColumnTokens(next: (string | null)[]) {
        this.pendingColumnLoads = [];

        for (let i = 0; i < this.columns.length; i++) {
            const ca = typeof next[i] === "string" && next[i]!.length > 0 ? next[i]! : null;
            const col = this.columns[i];
            if (col.ca === ca) continue;

            col.ca = ca;
            col.group.userData.ca = ca;
            col.group.userData.tokenInfo = ca
                ? { name: "Loading...", symbol: "...", mc: 0 }
                : { name: "Empty Pedestal", symbol: "N/A", mc: 0 };

            this.clearColumnVisuals(col);
            if (ca) this.pendingColumnLoads.push(this.updateColumn(col));
        }
    }

    private applyCoinTexture(col: TokenColumn, texture: THREE.Texture) {
        col.coin.traverse((child) => {
            if (!(child instanceof THREE.Mesh)) return;

            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((mat: any) => {
                if (!mat?.userData?.perCoin) return;
                mat.map = texture;
                mat.emissiveMap = texture;
                mat.needsUpdate = true;
            });
        });
    }

    private setColumnLabel(col: TokenColumn, text: string | null) {
        if (col.mcText) {
            col.group.remove(col.mcText);
            (col.mcText.material as THREE.SpriteMaterial).map?.dispose();
            (col.mcText.material as THREE.Material).dispose();
            col.mcText = undefined;
        }

        if (!text) return;

        const sprite = this.createTextSprite(text);
        sprite.position.y = col.baseCoinY + 3.4;
        col.group.add(sprite);
        col.mcText = sprite;
    }

    private clearColumnVisuals(col: TokenColumn) {
        this.setColumnLabel(col, null);
        this.applyCoinTexture(col, this.floor.textureCache.get("fallback")!);

        if (col.texture) {
            col.texture.dispose();
            col.texture = undefined;
        }
    }

    createColumns(_rm: ResourceManager) {
        const placements: ColumnPlacement[] = [];
        for (let i = 0; i < COLUMN_COUNT; i++) {
            const angle = (i / COLUMN_COUNT) * Math.PI * 2;
            placements.push({
                x: Math.cos(angle) * COLUMN_RING_RADIUS,
                z: Math.sin(angle) * COLUMN_RING_RADIUS,
                seed: i,
            });
        }

        this.field = createColumnField(placements);
        this.floor.scene.add(this.field.group);

        for (let i = 0; i < COLUMN_COUNT; i++) {
            const { x, z } = placements[i];
            const group = new THREE.Group();
            const ca = this.columnTokens[i];
            const texture = this.floor.textureCache.get("fallback")!;

            const coin = createCoinMesh(texture, 1.2, true, false, "silver");
            coin.traverse((child) => {
                const mesh = child as THREE.Mesh;
                if (mesh.isMesh) mesh.castShadow = false;
            });

            const baseCoinY = COIN_BASE_Y;
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

            this.floor.scene.add(group);
            this.columns.push({ group, coin, ca, baseCoinY });

            const radiusCol = COLUMN_TOP_RADIUS * COLUMN_COLLIDER_SCALE;
            const collider = new THREE.Box3(
                new THREE.Vector3(x - radiusCol, 0, z - radiusCol),
                new THREE.Vector3(x + radiusCol, COLUMN_HEIGHT, z + radiusCol)
            );
            this.floor.collisionGrid.insert(collider);
        }
    }

    private async updateColumnsOnce() {
        await Promise.all(this.columns.map((col) => this.updateColumn(col)));
    }

    private async updateColumn(col: TokenColumn) {
        const ca = col.ca;
        if (!ca) return;

        try {
            const res = await fetch(`/api/token-by-ca?ca=${encodeURIComponent(ca)}`, { cache: "no-store" });
            const data = res.ok ? await res.json() : null;

            if (col.ca !== ca) return;

            if (!data) {
                this.setColumnLabel(col, "Unknown token");
                col.group.userData.tokenInfo = { name: "Unknown token", symbol: "?", mc: 0 };
                return;
            }

            this.setColumnLabel(col, `MC: ${this.formatMC(data.mc || 0)}`);
            col.group.userData.tokenInfo = data;

            if (!data.image) return;

            await new Promise<void>((resolve) => {
                this.floor.textureLoader.load(
                    `/api/image-proxy?url=${encodeURIComponent(data.image)}`,
                    (tex) => {
                        if (col.ca !== ca) {
                            tex.dispose();
                            resolve();
                            return;
                        }

                        tex.colorSpace = THREE.SRGBColorSpace;
                        this.floor.applyTextureFilters(tex);
                        this.applyCoinTexture(col, tex);

                        col.texture?.dispose();
                        col.texture = tex;
                        resolve();
                    },
                    undefined,
                    () => {
                        console.warn(`[Basement] Column texture load failed: ${data.image}`);
                        resolve();
                    }
                );
            });
        } catch (e) {
            console.warn(`[Basement] Failed to update column ${ca}`, e);
        }
    }

    startUpdater() {
        this.updateColumnsOnce();
        this.columnUpdateInterval = setInterval(async () => {
            await this.refreshAssignments();
            await this.updateColumnsOnce();
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
            depthTest: true
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

    update(delta: number) {
        const time = performance.now() * 0.001;
        this.field?.update(time);

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
                const mat = glow.material as THREE.ShaderMaterial;
                mat.uniforms.uOpacity.value = 0.2 + Math.sin(time * 3) * 0.05;
            }
        }
    }

    dispose() {
        if (this.columnUpdateInterval) {
            clearInterval(this.columnUpdateInterval);
            this.columnUpdateInterval = null;
        }
        for (const col of this.columns) {
            this.floor.scene.remove(col.group);
            disposeCoinMesh(col.coin);
            if (col.mcText) {
                (col.mcText.material as THREE.SpriteMaterial).map?.dispose();
                (col.mcText.material as THREE.Material).dispose();
            }
            if (col.texture) {
                col.texture.dispose();
            }
        }
        this.columns = [];
        this.field?.dispose();
        this.field = null;
    }
}
