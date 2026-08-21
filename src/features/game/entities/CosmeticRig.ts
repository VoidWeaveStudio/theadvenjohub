// src/features/game/entities/CosmeticRig.ts
import * as THREE from "three";
import { CosmeticId, cosmeticSlotOf } from "../data/cosmetics";
import { buildCosmetic, disposeCosmetic, CosmeticTick } from "./cosmeticModels";
import { buildRegionIndex } from "./characterRegions";
import { getRegionSkinTexture } from "./characterSkinTexture";
import { findBoneLast } from "./characterModel";

const CHEST_BONE_NAMES = ["spine002", "spine.002", "spine_002", "chest", "spine001", "spine.001", "spine"];

export interface CosmeticPiece {
    label: string;
    object: THREE.Object3D;
}

export class CosmeticRig {
    private headPiece: THREE.Group | null = null;
    private torsoPiece: THREE.Group | null = null;
    private tick: CosmeticTick | null = null;
    private elapsed = 0;

    private skinId: CosmeticId | null = null;
    private accessoryId: CosmeticId | null = null;

    private readonly headBone: THREE.Object3D | null;
    private readonly chestBone: THREE.Object3D | null;
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
        this.chestBone = CosmeticRig.findChestBone(modelRoot);

        let mesh: THREE.SkinnedMesh | null = null;
        modelRoot.traverse((child) => {
            const candidate = child as THREE.SkinnedMesh;
            if (!mesh && candidate.isSkinnedMesh) mesh = candidate;
        });
        this.skinnedMesh = mesh;

        const standard = material as THREE.MeshStandardMaterial | null;
        this.baseColor = standard?.color ? standard.color.clone() : null;
    }

    private static findChestBone(modelRoot: THREE.Object3D): THREE.Object3D | null {
        for (const name of CHEST_BONE_NAMES) {
            const bone = findBoneLast(modelRoot, (candidate) => candidate === name);
            if (bone) return bone;
        }
        return null;
    }

    apply(skinId: CosmeticId | null, accessoryId: CosmeticId | null) {
        const nextSkin = skinId && cosmeticSlotOf(skinId) === "skin" ? skinId : null;
        const nextAccessory = nextSkin
            ? null
            : (accessoryId && cosmeticSlotOf(accessoryId) === "accessory" ? accessoryId : null);

        if (nextSkin === this.skinId && nextAccessory === this.accessoryId) return;

        this.skinId = nextSkin;
        this.accessoryId = nextAccessory;

        this.clearPieces();

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

        if (built.torso && this.chestBone) {
            this.chestBone.add(built.torso);
            this.torsoPiece = built.torso;
        } else if (built.torso) {
            disposeCosmetic(built.torso);
        }

        this.tick = built.tick;
        this.elapsed = 0;
    }

    update(delta: number) {
        if (!this.tick) return;
        this.elapsed += delta;
        this.tick(this.elapsed);
    }

    getPieces(): CosmeticPiece[] {
        const pieces: CosmeticPiece[] = [];
        if (this.headPiece) pieces.push({ label: "head", object: this.headPiece });
        if (this.torsoPiece) pieces.push({ label: "torso", object: this.torsoPiece });
        return pieces;
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

    private clearPieces() {
        disposeCosmetic(this.headPiece);
        disposeCosmetic(this.torsoPiece);
        this.headPiece = null;
        this.torsoPiece = null;
        this.tick = null;
    }

    dispose() {
        this.clearPieces();
    }
}
