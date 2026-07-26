// src/features/game/entities/characterModel.ts
import * as THREE from "three";

export function scaleAndCenterModel(root: THREE.Object3D, targetHeight: number, yRotation: number) {
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const scale = targetHeight / size.y;
    root.scale.setScalar(scale);

    const scaledBox = new THREE.Box3().setFromObject(root);
    root.position.set(
        -(scaledBox.min.x + scaledBox.max.x) / 2,
        -scaledBox.min.y,
        -(scaledBox.min.z + scaledBox.max.z) / 2
    );

    root.rotation.y = yRotation;
}

export function findBoneFirst(root: THREE.Object3D, matches: (nameLower: string) => boolean): THREE.Object3D | null {
    let found: THREE.Object3D | null = null;
    root.traverse((child) => {
        if (!found && matches(child.name.toLowerCase())) {
            found = child;
        }
    });
    return found;
}

export function findBoneLast(root: THREE.Object3D, matches: (nameLower: string) => boolean): THREE.Object3D | null {
    let found: THREE.Object3D | null = null;
    root.traverse((child) => {
        if (matches(child.name.toLowerCase())) {
            found = child;
        }
    });
    return found;
}

function updateFullMatrixWorld(object: THREE.Object3D) {
    let root: THREE.Object3D = object;
    while (root.parent) root = root.parent;
    root.updateMatrixWorld(true);
}

export function reparentPreservingWorldScale(object: THREE.Object3D, newParent: THREE.Object3D) {
    updateFullMatrixWorld(object);
    const currentWorldScale = new THREE.Vector3();
    object.getWorldScale(currentWorldScale);

    object.parent?.remove(object);
    newParent.add(object);

    updateFullMatrixWorld(newParent);
    const newParentWorldScale = new THREE.Vector3();
    newParent.getWorldScale(newParentWorldScale);

    if (newParentWorldScale.x > 0) {
        object.scale.multiplyScalar(currentWorldScale.x / newParentWorldScale.x);
    }
}
