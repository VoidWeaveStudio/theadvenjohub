// src/features/game/entities/characterRegions.ts
import * as THREE from "three";

export type BodyRegion = "head" | "torso" | "arms" | "hands" | "legs" | "feet";

export const BODY_REGIONS: BodyRegion[] = ["head", "torso", "arms", "hands", "legs", "feet"];

export type RegionPalette = Record<BodyRegion, number>;

function regionForBone(name: string): BodyRegion {
    const n = name.toLowerCase();
    if (n.startsWith("head") || n.startsWith("neck")) return "head";
    if (n.startsWith("spine")) return "torso";
    if (n.startsWith("hand") || n.startsWith("fingers") || n.startsWith("thumb")) return "hands";
    if (n.startsWith("shoulder") || n.startsWith("upperarm") || n.startsWith("lowerarm")) return "arms";
    if (n.startsWith("foot")) return "feet";
    if (n.startsWith("upperleg") || n.startsWith("lowerleg")) return "legs";
    return "torso";
}

export function buildRegionIndex(mesh: THREE.SkinnedMesh): Uint8Array | null {
    const skinIndex = mesh.geometry.getAttribute("skinIndex");
    const skinWeight = mesh.geometry.getAttribute("skinWeight");
    const bones = mesh.skeleton?.bones;
    if (!skinIndex || !skinWeight || !bones || bones.length === 0) return null;

    const boneRegion = bones.map((bone) => BODY_REGIONS.indexOf(regionForBone(bone.name)));
    const count = skinIndex.count;
    const regions = new Uint8Array(count);

    for (let i = 0; i < count; i++) {
        let bestJoint = 0;
        let bestWeight = -1;
        for (let k = 0; k < 4; k++) {
            const weight = skinWeight.getComponent(i, k);
            if (weight > bestWeight) {
                bestWeight = weight;
                bestJoint = skinIndex.getComponent(i, k);
            }
        }
        const region = boneRegion[bestJoint];
        regions[i] = region >= 0 ? region : BODY_REGIONS.indexOf("torso");
    }

    return regions;
}
