// src/features/game/world/locations/main-world/utils/propModels.ts
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export interface PropPart {
    geometry: THREE.BufferGeometry;
    material: THREE.Material;
}

export interface PropModel {
    parts: PropPart[];
    radius: number;
    height: number;
}

const KEEP_ATTRIBUTES = new Set(["position", "normal", "uv", "uv1"]);

const loader = new GLTFLoader();

function stripAttributes(geometry: THREE.BufferGeometry) {
    for (const name of Object.keys(geometry.attributes)) {
        if (!KEEP_ATTRIBUTES.has(name)) geometry.deleteAttribute(name);
    }
    if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();

    const count = geometry.getAttribute("position").count;
    if (!geometry.getAttribute("uv")) {
        geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    if (!geometry.getAttribute("uv1")) {
        geometry.setAttribute("uv1", geometry.getAttribute("uv").clone());
    }
}

function prepareMaterial(material: THREE.Material): THREE.Material {
    const standard = material as THREE.MeshStandardMaterial;
    standard.side = THREE.DoubleSide;
    standard.shadowSide = THREE.DoubleSide;

    if (standard.transparent && standard.alphaTest === 0) {
        standard.alphaTest = 0.4;
        standard.transparent = false;
        standard.depthWrite = true;
    }

    return standard;
}

function collectRoots(scene: THREE.Object3D, split: boolean): THREE.Object3D[] {
    let node: THREE.Object3D = scene;
    while (!(node instanceof THREE.Mesh) && node.children.length === 1) {
        node = node.children[0];
    }

    if (split && node.children.length > 1) return [...node.children];
    return [node];
}

function buildModel(root: THREE.Object3D): PropModel | null {
    const collected: PropPart[] = [];

    root.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const material = Array.isArray(child.material) ? child.material[0] : child.material;
        const geometry = child.geometry.clone().applyMatrix4(child.matrixWorld);
        stripAttributes(geometry);
        collected.push({ geometry, material });
    });

    if (collected.length === 0) return null;

    const bounds = new THREE.Box3();
    for (const part of collected) {
        part.geometry.computeBoundingBox();
        bounds.union(part.geometry.boundingBox!);
    }

    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const longest = Math.max(size.x, size.y, size.z);
    const scale = longest > 1e-4 ? 1 / longest : 1;

    const transform = new THREE.Matrix4()
        .makeScale(scale, scale, scale)
        .multiply(new THREE.Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z));

    const grouped = new Map<THREE.Material, THREE.BufferGeometry[]>();
    for (const part of collected) {
        part.geometry.applyMatrix4(transform);
        const bucket = grouped.get(part.material) ?? [];
        bucket.push(part.geometry);
        grouped.set(part.material, bucket);
    }

    const parts: PropPart[] = [];
    for (const [material, geometries] of grouped) {
        const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
        if (!merged) continue;
        if (geometries.length > 1) geometries.forEach((geometry) => geometry.dispose());

        merged.computeBoundingSphere();
        parts.push({ geometry: merged, material: prepareMaterial(material) });
    }

    if (parts.length === 0) return null;

    return {
        parts,
        radius: Math.max(size.x, size.z) * scale * 0.5,
        height: size.y * scale,
    };
}

export async function loadPropModels(url: string, split: boolean): Promise<PropModel[]> {
    const gltf = await loader.loadAsync(url);
    gltf.scene.updateMatrixWorld(true);

    const models: PropModel[] = [];
    for (const root of collectRoots(gltf.scene, split)) {
        const model = buildModel(root);
        if (model) models.push(model);
    }

    return models;
}

export async function loadPropSet(sources: { url: string; split?: boolean }[]): Promise<PropModel[]> {
    const batches = await Promise.all(
        sources.map((source) =>
            loadPropModels(source.url, source.split ?? false).catch((error) => {
                console.error(`Failed to load prop model ${source.url}:`, error);
                return [] as PropModel[];
            })
        )
    );

    return batches.flat();
}
