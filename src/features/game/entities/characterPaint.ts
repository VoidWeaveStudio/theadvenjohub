// src/features/game/entities/characterPaint.ts
import * as THREE from "three";

export function findPaintableMesh(root: THREE.Object3D): THREE.Mesh | null {
    let found: THREE.Mesh | null = null;
    root.traverse((child) => {
        if (found) return;
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) found = mesh;
    });
    return found;
}

export function clonePaintableMaterial(mesh: THREE.Mesh): THREE.Material {
    const source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const cloned = source.clone();
    if ("vertexColors" in cloned) {
        (cloned as THREE.MeshStandardMaterial).vertexColors = false;
    }
    mesh.material = cloned;
    return cloned;
}

export function applySkinTextureUrl(material: THREE.Material | null, url: string | null): void {
    if (!material) return;
    const mat = material as THREE.MeshStandardMaterial;

    if (!url) {
        if (mat.map) {
            mat.map.dispose();
            mat.map = null;
            mat.needsUpdate = true;
        }
        return;
    }

    const loader = new THREE.TextureLoader();
    loader.load(url, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;
        const previous = mat.map;
        mat.map = texture;
        mat.needsUpdate = true;
        previous?.dispose();
    });
}

export function disposePaintableMaterial(material: THREE.Material | null): void {
    if (!material) return;
    const mat = material as THREE.MeshStandardMaterial;
    mat.map?.dispose();
    mat.dispose();
}
