// src/features/game/entities/CosmeticRig.ts
import * as THREE from "three";
import { CosmeticId, cosmeticSlotOf } from "../data/cosmetics";
import { buildCosmetic, disposeCosmetic } from "./cosmeticModels";
import { buildRegionIndex } from "./characterRegions";
import { getRegionSkinTexture } from "./characterSkinTexture";
import { findBoneLast } from "./characterModel";

export class CosmeticRig {
    private headPiece: THREE.Group | null = null;
    private skinId: CosmeticId | null = null;
    private accessoryId: CosmeticId | null = null;

    private readonly headBone: THREE.Object3D | null;
    private readonly skinnedMesh: THREE.SkinnedMesh | null;
    private readonly baseColor: THREE.Color | null;

    private regionIndex: Uint8Array | null = null;
    private regionIndexReady = false;
    private restoreMap: THREE.Texture | null = null;
    private overriding = false;

    constructor(
        modelRoot: THREE.Object3D,
        private readonly material: THREE.Material | null
    ) {
        this.headBone = findBoneLast(modelRoot, (name) => name === "head");

        let mesh: THREE.SkinnedMesh | null = null;
        modelRoot.traverse((child) => {
            const candidate = child as THREE.SkinnedMesh;
            if (!mesh && candidate.isSkinnedMesh) mesh = candidate;
        });
        this.skinnedMesh = mesh;

        const standard = material as THREE.MeshStandardMaterial | null;
        this.baseColor = standard?.color ? standard.color.clone() : null;
    }

    apply(skinId: CosmeticId | null, accessoryId: CosmeticId | null) {
        const nextSkin = skinId && cosmeticSlotOf(skinId) === "skin" ? skinId : null;
        const nextAccessory = nextSkin
            ? null
            : (accessoryId && cosmeticSlotOf(accessoryId) === "accessory" ? accessoryId : null);

        if (nextSkin === this.skinId && nextAccessory === this.accessoryId) return;

        this.skinId = nextSkin;
        this.accessoryId = nextAccessory;

        disposeCosmetic(this.headPiece);
        this.headPiece = null;

        const active = nextSkin ?? nextAccessory;
        if (!active) {
            this.restoreBaseLook();
            return;
        }

        const built = buildCosmetic(active);

        if (built.palette) {
            this.applySkinTexture(active, built.palette);
        } else {
            this.restoreBaseLook();
        }

        if (built.head && this.headBone) {
            this.headBone.add(built.head);
            this.headPiece = built.head;
        } else if (built.head) {
            disposeCosmetic(built.head);
        }
    }

    private applySkinTexture(id: CosmeticId, palette: Parameters<typeof getRegionSkinTexture>[3]) {
        const mesh = this.skinnedMesh;
        const standard = this.material as THREE.MeshStandardMaterial | null;
        if (!mesh || !standard) return;

        if (!this.regionIndexReady) {
            this.regionIndex = buildRegionIndex(mesh);
            this.regionIndexReady = true;
        }
        if (!this.regionIndex) return;

        const texture = getRegionSkinTexture(id, mesh.geometry, this.regionIndex, palette);
        if (!texture) return;

        if (!this.overriding) {
            this.restoreMap = standard.map ?? null;
            this.overriding = true;
        }

        standard.map = texture;
        standard.color.set(0xffffff);
        standard.needsUpdate = true;
    }

    private restoreBaseLook() {
        const standard = this.material as THREE.MeshStandardMaterial | null;
        if (!standard) return;

        if (this.overriding) {
            standard.map = this.restoreMap;
            this.restoreMap = null;
            this.overriding = false;
        }

        if (this.baseColor) standard.color.copy(this.baseColor);
        standard.needsUpdate = true;
    }

    dispose() {
        disposeCosmetic(this.headPiece);
        this.headPiece = null;
    }
}
