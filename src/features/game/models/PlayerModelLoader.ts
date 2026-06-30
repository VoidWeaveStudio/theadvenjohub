// src/features/game/models/PlayerModelLoader.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

interface CachedModel {
    root: THREE.Group;
    groundOffset: number;
    height: number;
}

interface ModelStats {
    boneCount: number;
    meshCount: number;
    materialCount: number;
    vertexCount: number;
    triangleCount: number;
}

export class PlayerModelLoader {
    private static loader = new GLTFLoader();
    private static cache = new Map<string, CachedModel>();
    private static loadPromises = new Map<string, Promise<CachedModel>>();

    static async preloadSkin(skinId: string, modelUrl: string): Promise<void> {
        console.log(`📦 [PlayerModelLoader] Starting preload for skin "${skinId}" from "${modelUrl}"`);

        if (this.cache.has(skinId)) {
            console.log(`✅ [PlayerModelLoader] Skin "${skinId}" already cached, skipping`);
            return;
        }

        if (this.loadPromises.has(skinId)) {
            console.log(`⏳ [PlayerModelLoader] Skin "${skinId}" is already loading, waiting...`);
            await this.loadPromises.get(skinId);
            return;
        }

        const startTime = performance.now();
        const promise = this.loadModel(modelUrl, skinId);
        this.loadPromises.set(skinId, promise);

        try {
            const cached = await promise;
            const loadTime = (performance.now() - startTime).toFixed(2);

            console.log(`✅ [PlayerModelLoader] Skin "${skinId}" loaded successfully`);
            console.log(`   ⏱️  Load time: ${loadTime}ms`);
            console.log(`   📏 Height: ${cached.height.toFixed(2)} units`);
            console.log(`   📍 Ground offset: ${cached.groundOffset.toFixed(3)} units`);

            const stats = this.getModelStats(cached.root);
            console.log(`   🦴 Bones: ${stats.boneCount}`);
            console.log(`   🔷 Meshes: ${stats.meshCount}`);
            console.log(`   🎨 Materials: ${stats.materialCount}`);
            console.log(`   🔺 Triangles: ${stats.triangleCount.toLocaleString()}`);
            console.log(`   📊 Vertices: ${stats.vertexCount.toLocaleString()}`);

            this.cache.set(skinId, cached);
        } catch (err) {
            const loadTime = (performance.now() - startTime).toFixed(2);
            console.error(`❌ [PlayerModelLoader] Failed to load skin "${skinId}" after ${loadTime}ms:`, err);
            this.loadPromises.delete(skinId);
            throw err;
        }
    }

    static async preload(): Promise<void> {
        console.log(`🚀 [PlayerModelLoader] Starting default skin preload`);
        await this.preloadSkin('default', '/models/player/character.glb');
        console.log(`🎉 [PlayerModelLoader] Default skin preload complete`);
    }

    static async preloadDefault(): Promise<void> {
        await this.preload();
    }

    static getModelClone(skinId: string = 'default'): THREE.Group | null {
        console.log(`🔄 [PlayerModelLoader] Creating clone for skin "${skinId}"`);

        const cached = this.cache.get(skinId);
        if (!cached) {
            console.warn(`⚠️ [PlayerModelLoader] Skin "${skinId}" not loaded, returning null`);
            return null;
        }

        try {
            const clone = cloneSkeleton(cached.root) as THREE.Group;

            let hasBones = false;
            let boneCount = 0;
            clone.traverse((child) => {
                if (child instanceof THREE.Bone) {
                    hasBones = true;
                    boneCount++;
                }
                if (child instanceof THREE.SkinnedMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            if (!hasBones) {
                console.error(`❌ [PlayerModelLoader] Clone for skin "${skinId}" has no bones`);
                return null;
            }

            console.log(`✅ [PlayerModelLoader] Clone created for skin "${skinId}" with ${boneCount} bones`);
            return clone;
        } catch (err) {
            console.error(`❌ [PlayerModelLoader] Failed to clone skin "${skinId}":`, err);
            return null;
        }
    }

    static getGroundOffset(skinId: string = 'default'): number {
        return this.cache.get(skinId)?.groundOffset ?? 0;
    }

    static getModelHeight(skinId: string = 'default'): number {
        return this.cache.get(skinId)?.height ?? 1.8;
    }

    static isLoaded(skinId: string = 'default'): boolean {
        return this.cache.has(skinId);
    }

    static isSkinLoaded(skinId: string): boolean {
        return this.cache.has(skinId);
    }

    static dispose(skinId?: string): void {
        if (skinId) {
            console.log(`🗑️ [PlayerModelLoader] Disposing skin "${skinId}"`);
            const cached = this.cache.get(skinId);
            if (cached) {
                this.disposeModel(cached.root);
                this.cache.delete(skinId);
                this.loadPromises.delete(skinId);
                console.log(`✅ [PlayerModelLoader] Skin "${skinId}" disposed`);
            }
        } else {
            console.log(`🗑️ [PlayerModelLoader] Disposing all skins (${this.cache.size} cached)`);
            this.cache.forEach(cached => this.disposeModel(cached.root));
            this.cache.clear();
            this.loadPromises.clear();
            console.log(`✅ [PlayerModelLoader] All skins disposed`);
        }
    }

    private static getModelStats(model: THREE.Group): ModelStats {
        let boneCount = 0;
        let meshCount = 0;
        let vertexCount = 0;
        let triangleCount = 0;
        const materials = new Set<THREE.Material>();

        model.traverse((child) => {
            if (child instanceof THREE.Bone) {
                boneCount++;
            }
            if (child instanceof THREE.Mesh) {
                meshCount++;
                const geometry = child.geometry;
                if (geometry) {
                    const position = geometry.getAttribute('position');
                    if (position) {
                        vertexCount += position.count;
                    }
                    if (geometry.index) {
                        triangleCount += geometry.index.count / 3;
                    } else if (position) {
                        triangleCount += position.count / 3;
                    }
                }
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => materials.add(m));
                    } else {
                        materials.add(child.material);
                    }
                }
            }
        });

        return {
            boneCount,
            meshCount,
            materialCount: materials.size,
            vertexCount,
            triangleCount,
        };
    }

    private static disposeModel(root: THREE.Group): void {
        root.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry?.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material?.dispose();
                }
            }
        });
    }

    private static async loadModel(url: string, skinId: string): Promise<CachedModel> {
        console.log(`📥 [PlayerModelLoader] Loading GLB from "${url}"`);
        const gltf = await this.loadGLB(url, skinId);
        const character = gltf.scene;

        const originalBox = new THREE.Box3().setFromObject(character);
        const originalSize = originalBox.getSize(new THREE.Vector3());
        console.log(`📏 [PlayerModelLoader] Original size: ${originalSize.x.toFixed(2)} x ${originalSize.y.toFixed(2)} x ${originalSize.z.toFixed(2)}`);

        const targetHeight = 1.8;
        const scale = targetHeight / originalSize.y;

        if (originalSize.y > 5) {
            console.warn(`⚠️ [PlayerModelLoader] Model is very tall (${originalSize.y.toFixed(2)} units). This may cause camera issues.`);
        }

        character.scale.setScalar(scale);
        console.log(`📐 [PlayerModelLoader] Applied scale: ${scale.toFixed(4)} (target height: ${targetHeight})`);

      
        character.rotation.y = Math.PI;

        const finalBox = new THREE.Box3().setFromObject(character);
        const finalSize = finalBox.getSize(new THREE.Vector3());
        const groundOffset = -finalBox.min.y;
        character.position.y = 0;

        console.log(`📏 [PlayerModelLoader] Final size: ${finalSize.x.toFixed(2)} x ${finalSize.y.toFixed(2)} x ${finalSize.z.toFixed(2)}`);
        console.log(`📍 [PlayerModelLoader] Ground offset: ${groundOffset.toFixed(3)}`);

        if (finalSize.y > 2.5) {
            console.warn(`⚠️ [PlayerModelLoader] Final model is still tall (${finalSize.y.toFixed(2)} units). Consider using a smaller model.`);
        }

        character.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.SkinnedMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        return {
            root: character,
            groundOffset,
            height: targetHeight,
        };
    }

    private static loadGLB(url: string, skinId: string): Promise<GLTF> {
        return new Promise((resolve, reject) => {
            let lastProgress = 0;

            this.loader.load(
                url,
                (gltf) => {
                    console.log(`✅ [PlayerModelLoader] GLB loaded successfully from "${url}"`);
                    resolve(gltf);
                },
                (xhr) => {
                    if (xhr.lengthComputable) {
                        const progress = Math.round((xhr.loaded / xhr.total) * 100);
                        if (progress >= lastProgress + 10 || progress === 100) {
                            lastProgress = progress;
                            console.log(`📊 [PlayerModelLoader] Loading "${skinId}": ${progress}% (${(xhr.loaded / 1024 / 1024).toFixed(2)}MB / ${(xhr.total / 1024 / 1024).toFixed(2)}MB)`);
                        }
                    }
                },
                (error) => {
                    console.error(`❌ [PlayerModelLoader] Failed to load GLB from "${url}":`, error);
                    reject(error);
                },
            );
        });
    }
}