// src/features/game/world/locations/tower/floors/basement/systems/TokenColumnSystem.ts
import * as THREE from "three";
import { ResourceManager } from "../../../../../../core/ResourceManager";
import { createCoinMesh } from "../utils/meshFactory";
import type { Basement } from "../Basement";

interface TokenColumn {
    group: THREE.Group;
    coin: THREE.Group;
    ca: string | null;
    texture?: THREE.Texture;
    mcText?: THREE.Sprite;
    baseCoinY: number;
}

export class TokenColumnSystem {
    private columnTokens: (string | null)[] = [
        "9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump", "J8PSdNP3QewKq2Z1JJJFDMaqF7KcaiJhR7gbr5KZpump", "CFPkPq1eYPR8GLzEo59wUbbMioX4bshaTQiSGzTSpump",
        "B4ptaVsUe6YbtBwAS38WFeweSrVNfQLCcj9JRrtjU8vn", "Ge87EtsjwRQbHaqQmKRno69RFTwh9bfSsm99XNxTpump", "4MrsXQzaosYNyFd4wKDvgnC5xRtRqgXRrijFTGj9pump", "BTUu1KQ1rhcmtMVGLm7unFbCR4CU6RCwxhTtK2xUpump", "CWZ6BsdnjkDVTGkmL6bGbJXXig6ceef12KvyGQW14cMt", null, null
    ];
    public columns: TokenColumn[] = [];
    private columnUpdateInterval: NodeJS.Timeout | null = null;

    constructor(private floor: Basement) { }

    createColumns(rm: ResourceManager) {
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
            const texture = this.floor.textureCache.get("fallback")!;

            const coin = createCoinMesh(texture, 1.2, true, false, "silver");

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

            this.floor.scene.add(group);
            this.columns.push({ group, coin, ca, baseCoinY });

            const radiusCol = 1.2;
            const heightCol = pedestalHeight;
            const collider = new THREE.Box3(
                new THREE.Vector3(x - radiusCol, 0, z - radiusCol),
                new THREE.Vector3(x + radiusCol, heightCol, z + radiusCol)
            );
            this.floor.collisionGrid.insert(collider);
        }
    }

    private async updateColumnsOnce() {
        for (const col of this.columns) {
            if (!col.ca) continue;

            try {
                const res = await fetch(`/api/token-by-ca?ca=${col.ca}`);
                const data = await res.json();

                if (!data || !data.image) continue;

                this.floor.textureLoader.load(
                    `/api/image-proxy?url=${encodeURIComponent(data.image)}`,
                    (tex) => {
                        tex.colorSpace = THREE.SRGBColorSpace;
                        this.floor.applyTextureFilters(tex);

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
    }

    startUpdater() {
        this.updateColumnsOnce();
        this.columnUpdateInterval = setInterval(() => this.updateColumnsOnce(), 30000);
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
    }
}
