// src/features/game/entities/characterModel.ts
import * as THREE from "three";

export function scaleAndCenterModel(
    root: THREE.Object3D,
    targetHeight: number,
    yRotation: number,
    precise = false
) {
    root.rotation.y = yRotation;
    root.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(root, precise);
    const size = box.getSize(new THREE.Vector3());
    if (size.y > 1e-6) root.scale.setScalar(targetHeight / size.y);
    root.updateMatrixWorld(true);

    const scaledBox = new THREE.Box3().setFromObject(root, precise);
    root.position.set(
        -(scaledBox.min.x + scaledBox.max.x) / 2,
        -scaledBox.min.y,
        -(scaledBox.min.z + scaledBox.max.z) / 2
    );
}

export function applyRestPoseCorrection(root: THREE.Object3D, animations: THREE.AnimationClip[]): boolean {
    if (!animations || animations.length === 0) return false;

    const nodes = new Map<string, THREE.Object3D>();
    root.traverse((child) => {
        if (child.name && !nodes.has(child.name)) nodes.set(child.name, child);
    });

    const depthOf = (node: THREE.Object3D): number => {
        let depth = 0;
        let current: THREE.Object3D | null = node.parent;
        while (current && current !== root) {
            depth++;
            current = current.parent;
        }
        return current === root ? depth : Number.MAX_SAFE_INTEGER;
    };

    let shallowest: { node: THREE.Object3D; values: Float32Array | number[]; depth: number } | null = null;

    for (const clip of animations) {
        for (const track of clip.tracks) {
            if (!track.name.endsWith(".quaternion")) continue;
            if (track.values.length < 4) continue;

            const node = nodes.get(track.name.slice(0, -".quaternion".length));
            if (!node) continue;

            const depth = depthOf(node);
            if (depth === Number.MAX_SAFE_INTEGER) continue;
            if (shallowest && depth >= shallowest.depth) continue;

            shallowest = { node, values: track.values, depth };
        }

        if (shallowest) break;
    }

    if (!shallowest) return false;

    shallowest.node.quaternion.set(
        shallowest.values[0],
        shallowest.values[1],
        shallowest.values[2],
        shallowest.values[3]
    );
    root.updateMatrixWorld(true);
    return true;
}

let cachedPoseGroundOffset: number | null = null;

export function alignModelToGround(root: THREE.Object3D) {
    if (cachedPoseGroundOffset === null) {
        root.updateWorldMatrix(true, true);

        const box = new THREE.Box3().setFromObject(root, true);
        if (!Number.isFinite(box.min.y)) return;

        if (root.parent) {
            box.applyMatrix4(new THREE.Matrix4().copy(root.parent.matrixWorld).invert());
        }
        cachedPoseGroundOffset = box.min.y;
    }

    root.position.y -= cachedPoseGroundOffset;
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
