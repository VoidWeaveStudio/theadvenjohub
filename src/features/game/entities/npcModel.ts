// src/features/game/entities/npcModel.ts
import * as THREE from "three";
import { ResourceManager } from "../core/ResourceManager";
import { CharacterAnimator } from "./CharacterAnimator";
import { scaleAndCenterModel, findBoneLast, reparentPreservingWorldScale } from "./characterModel";

export interface NpcHandle {
    group: THREE.Group;
    update(delta: number): void;
}

function tintMaterials(root: THREE.Object3D, color: THREE.ColorRepresentation) {
    root.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;

        const tint = (mat: THREE.Material) => {
            const cloned = mat.clone();
            if (cloned instanceof THREE.MeshStandardMaterial) {
                cloned.color.set(color);
            }
            return cloned;
        };

        mesh.material = Array.isArray(mesh.material)
            ? mesh.material.map(tint)
            : tint(mesh.material);
    });
}

export function isSharedNpcGeometry(geo: THREE.BufferGeometry): boolean {
    return !!geo.userData?.sharedAsset;
}

function markSharedGeometry(root: THREE.Object3D) {
    root.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh && mesh.geometry) {
            mesh.geometry.userData.sharedAsset = true;
        }
    });
}

export function createNpcModel(
    resourceManager: ResourceManager,
    tintColor: THREE.ColorRepresentation,
    buildAccessories?: (headPosition: THREE.Vector3) => THREE.Object3D[]
): NpcHandle {
    const data = resourceManager.getModel("player");
    if (!data) {
        throw new Error("Player model not found. Cannot build NPC.");
    }

    scaleAndCenterModel(data.scene, 1.8, 0);
    tintMaterials(data.scene, tintColor);
    markSharedGeometry(data.scene);

    const group = new THREE.Group();
    group.add(data.scene);
    group.updateMatrixWorld(true);

    const animator = new CharacterAnimator();
    animator.setup(data.scene, data.animations);
    animator.play("idle", false);

    const headBone = findBoneLast(data.scene, (name) => name.includes("head") && !name.endsWith("_end"));

    const headPosition = new THREE.Vector3(0, 1.7, 0);
    if (headBone) {
        headBone.getWorldPosition(headPosition);
    }

    const accessories = buildAccessories ? buildAccessories(headPosition) : [];
    for (const accessory of accessories) {
        group.add(accessory);
        if (headBone) {
            reparentPreservingWorldScale(accessory, headBone);
        }
    }

    return {
        group,
        update(delta: number) {
            animator.update(delta);
        },
    };
}
