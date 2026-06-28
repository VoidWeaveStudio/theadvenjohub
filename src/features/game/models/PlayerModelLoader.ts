// src/features/game/models/PlayerModelLoader.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

export class PlayerModelLoader {
    private static loader = new GLTFLoader();
    private static modelCache: THREE.Group | null = null;
    private static animationCache: Map<string, THREE.AnimationClip> = new Map();
    private static loadPromise: Promise<void> | null = null;
    
    private static groundOffset: number = 0;

    static async preload(): Promise<void> {
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = (async () => {
            try {
                console.log('📦 [PlayerModelLoader] Starting model preload...');
                
                const gltf = await this.loadGLB('/models/player/character.glb');
                const character = gltf.scene;
                
                console.log('📦 [PlayerModelLoader] Raw GLB loaded');
                console.log('📦 [PlayerModelLoader] Character type:', character.type);
                console.log('📦 [PlayerModelLoader] Children count:', character.children.length);
                
                const originalBox = new THREE.Box3().setFromObject(character);
                const originalSize = originalBox.getSize(new THREE.Vector3());
                const originalCenter = originalBox.getCenter(new THREE.Vector3());
                const originalMin = originalBox.min;
                const originalMax = originalBox.max;
                
                console.log('📏 [PlayerModelLoader] === ORIGINAL MODEL INFO ===');
                console.log('📏 [PlayerModelLoader] Size:', `X=${originalSize.x.toFixed(3)}, Y=${originalSize.y.toFixed(3)}, Z=${originalSize.z.toFixed(3)}`);
                console.log('📏 [PlayerModelLoader] Center:', `X=${originalCenter.x.toFixed(3)}, Y=${originalCenter.y.toFixed(3)}, Z=${originalCenter.z.toFixed(3)}`);
                console.log('📏 [PlayerModelLoader] Min:', `X=${originalMin.x.toFixed(3)}, Y=${originalMin.y.toFixed(3)}, Z=${originalMin.z.toFixed(3)}`);
                console.log('📏 [PlayerModelLoader] Max:', `X=${originalMax.x.toFixed(3)}, Y=${originalMax.y.toFixed(3)}, Z=${originalMax.z.toFixed(3)}`);
                console.log('📏 [PlayerModelLoader] Position:', `X=${character.position.x.toFixed(3)}, Y=${character.position.y.toFixed(3)}, Z=${character.position.z.toFixed(3)}`);
                
                const targetHeight = 1.8;
                const scale = targetHeight / originalSize.y;
                character.scale.setScalar(scale);
                
                console.log('📏 [PlayerModelLoader] === AFTER SCALING ===');
                console.log('📏 [PlayerModelLoader] Scale factor:', scale.toFixed(4));
                console.log('📏 [PlayerModelLoader] Target height:', targetHeight);
                
                const finalBox = new THREE.Box3().setFromObject(character);
                const finalSize = finalBox.getSize(new THREE.Vector3());
                const finalCenter = finalBox.getCenter(new THREE.Vector3());
                const finalMin = finalBox.min;
                const finalMax = finalBox.max;
                
                console.log('📏 [PlayerModelLoader] Final size:', `X=${finalSize.x.toFixed(3)}, Y=${finalSize.y.toFixed(3)}, Z=${finalSize.z.toFixed(3)}`);
                console.log('📏 [PlayerModelLoader] Final center:', `X=${finalCenter.x.toFixed(3)}, Y=${finalCenter.y.toFixed(3)}, Z=${finalCenter.z.toFixed(3)}`);
                console.log('📏 [PlayerModelLoader] Final min:', `X=${finalMin.x.toFixed(3)}, Y=${finalMin.y.toFixed(3)}, Z=${finalMin.z.toFixed(3)}`);
                console.log('📏 [PlayerModelLoader] Final max:', `X=${finalMax.x.toFixed(3)}, Y=${finalMax.y.toFixed(3)}, Z=${finalMax.z.toFixed(3)}`);
                console.log('📏 [PlayerModelLoader] Position after scale:', `X=${character.position.x.toFixed(3)}, Y=${character.position.y.toFixed(3)}, Z=${character.position.z.toFixed(3)}`);
                
                const pivotGroup = new THREE.Group();
                pivotGroup.add(character);
                
                const offsetX = -finalCenter.x;
                const offsetZ = -finalCenter.z;
                const offsetY = -finalMin.y;
                
                character.position.x = offsetX;
                character.position.z = offsetZ;
                character.position.y = offsetY;
                
                console.log('📍 [PlayerModelLoader] === PIVOT ADJUSTMENT ===');
                console.log('📍 [PlayerModelLoader] Offset X:', offsetX.toFixed(3));
                console.log('📍 [PlayerModelLoader] Offset Y:', offsetY.toFixed(3));
                console.log('📍 [PlayerModelLoader] Offset Z:', offsetZ.toFixed(3));
                console.log('📍 [PlayerModelLoader] Character position after offset:', `X=${character.position.x.toFixed(3)}, Y=${character.position.y.toFixed(3)}, Z=${character.position.z.toFixed(3)}`);
                
                const adjustedBox = new THREE.Box3().setFromObject(pivotGroup);
                const adjustedSize = adjustedBox.getSize(new THREE.Vector3());
                const adjustedCenter = adjustedBox.getCenter(new THREE.Vector3());
                const adjustedMin = adjustedBox.min;
                const adjustedMax = adjustedBox.max;
                
                console.log('📍 [PlayerModelLoader] === AFTER PIVOT ADJUSTMENT ===');
                console.log('📍 [PlayerModelLoader] Pivot group size:', `X=${adjustedSize.x.toFixed(3)}, Y=${adjustedSize.y.toFixed(3)}, Z=${adjustedSize.z.toFixed(3)}`);
                console.log('📍 [PlayerModelLoader] Pivot group center:', `X=${adjustedCenter.x.toFixed(3)}, Y=${adjustedCenter.y.toFixed(3)}, Z=${adjustedCenter.z.toFixed(3)}`);
                console.log('📍 [PlayerModelLoader] Pivot group min:', `X=${adjustedMin.x.toFixed(3)}, Y=${adjustedMin.y.toFixed(3)}, Z=${adjustedMin.z.toFixed(3)}`);
                console.log('📍 [PlayerModelLoader] Pivot group max:', `X=${adjustedMax.x.toFixed(3)}, Y=${adjustedMax.y.toFixed(3)}, Z=${adjustedMax.z.toFixed(3)}`);
                console.log('📍 [PlayerModelLoader] Pivot group position:', `X=${pivotGroup.position.x.toFixed(3)}, Y=${pivotGroup.position.y.toFixed(3)}, Z=${pivotGroup.position.z.toFixed(3)}`);
                
                this.groundOffset = 0;
                console.log('📍 [PlayerModelLoader] Ground offset set to:', this.groundOffset);
                
                let boneCount = 0;
                let meshCount = 0;
                let totalObjects = 0;
                
                character.traverse((child: THREE.Object3D) => {
                    totalObjects++;
                    if (child instanceof THREE.Bone) boneCount++;
                    if (child instanceof THREE.SkinnedMesh) {
                        meshCount++;
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                console.log('🦴 [PlayerModelLoader] === MODEL STRUCTURE ===');
                console.log('🦴 [PlayerModelLoader] Total objects:', totalObjects);
                console.log('🦴 [PlayerModelLoader] Bones:', boneCount);
                console.log('🦴 [PlayerModelLoader] Skinned meshes:', meshCount);
                
                this.modelCache = pivotGroup;
                console.log('✅ [PlayerModelLoader] Model cached successfully');

                const animationFiles = {
                    idle: '/models/player/animations/idle.glb',
                    running: '/models/player/animations/running.glb',
                    shooting: '/models/player/animations/shooting.glb',
                    reloading: '/models/player/animations/reloading.glb',
                    death: '/models/player/animations/death.glb'
                };

                console.log('📦 [PlayerModelLoader] Loading animations...');
                
                for (const [name, url] of Object.entries(animationFiles)) {
                    try {
                        const animGltf = await this.loadGLB(url);
                        
                        if (animGltf.animations.length === 0) {
                            console.warn(`⚠️ [PlayerModelLoader] Animation "${name}" has no clips!`);
                            continue;
                        }
                        
                        const clip = animGltf.animations[0];
                        
                        if (clip.name === 'mixamo.com' || clip.name === 'Take 001') {
                            clip.name = name;
                        }
                        
                        console.log(`🎬 [PlayerModelLoader] Loaded "${name}": ${clip.tracks.length} tracks, ${clip.duration.toFixed(2)}s`);
                        this.animationCache.set(name, clip);
                    } catch (err) {
                        console.warn(`⚠️ [PlayerModelLoader] Failed to load animation "${name}":`, err);
                    }
                }

                console.log('✅ [PlayerModelLoader] All animations loaded:', Array.from(this.animationCache.keys()));
            } catch (err) {
                console.error('❌ [PlayerModelLoader] Failed to load player model:', err);
                throw err;
            }
        })();

        return this.loadPromise;
    }

    static getModelClone(): THREE.Group | null {
        if (!this.modelCache) {
            console.warn('⚠️ [PlayerModelLoader] Model cache is empty!');
            return null;
        }
        
        try {
            const clone = cloneSkeleton(this.modelCache) as THREE.Group;
            
            let boneCount = 0;
            let meshCount = 0;
            let totalObjects = 0;
            
            clone.traverse((child) => {
                totalObjects++;
                if (child instanceof THREE.Bone) boneCount++;
                if (child instanceof THREE.SkinnedMesh) meshCount++;
            });
            
            console.log('📦 [PlayerModelLoader] === CLONE CREATED ===');
            console.log('📦 [PlayerModelLoader] Total objects:', totalObjects);
            console.log('📦 [PlayerModelLoader] Bones:', boneCount);
            console.log('📦 [PlayerModelLoader] Skinned meshes:', meshCount);
            console.log('📦 [PlayerModelLoader] Clone position:', `X=${clone.position.x.toFixed(3)}, Y=${clone.position.y.toFixed(3)}, Z=${clone.position.z.toFixed(3)}`);
            console.log('📦 [PlayerModelLoader] Clone rotation:', `X=${clone.rotation.x.toFixed(3)}, Y=${clone.rotation.y.toFixed(3)}, Z=${clone.rotation.z.toFixed(3)}`);
            console.log('📦 [PlayerModelLoader] Clone scale:', `X=${clone.scale.x.toFixed(3)}, Y=${clone.scale.y.toFixed(3)}, Z=${clone.scale.z.toFixed(3)}`);
            
            const cloneBox = new THREE.Box3().setFromObject(clone);
            const cloneSize = cloneBox.getSize(new THREE.Vector3());
            const cloneCenter = cloneBox.getCenter(new THREE.Vector3());
            
            console.log('📦 [PlayerModelLoader] Clone size:', `X=${cloneSize.x.toFixed(3)}, Y=${cloneSize.y.toFixed(3)}, Z=${cloneSize.z.toFixed(3)}`);
            console.log('📦 [PlayerModelLoader] Clone center:', `X=${cloneCenter.x.toFixed(3)}, Y=${cloneCenter.y.toFixed(3)}, Z=${cloneCenter.z.toFixed(3)}`);
            
            if (boneCount === 0) {
                console.error('❌ [PlayerModelLoader] Clone has NO bones!');
                return null;
            }
            
            return clone;
        } catch (err) {
            console.error('❌ [PlayerModelLoader] Failed to clone model:', err);
            return null;
        }
    }

    static getGroundOffset(): number {
        return this.groundOffset;
    }

    static getAllAnimations(): Record<string, THREE.AnimationClip> {
        const result: Record<string, THREE.AnimationClip> = {};
        this.animationCache.forEach((clip, name) => {
            result[name] = clip;
        });
        return result;
    }

    static isLoaded(): boolean {
        return this.modelCache !== null;
    }

    private static loadGLB(url: string): Promise<GLTF> {
        return new Promise((resolve, reject) => {
            this.loader.load(
                url,
                (gltf) => resolve(gltf),
                undefined,
                (error) => {
                    console.error(`❌ [PlayerModelLoader] Failed to load GLB: ${url}`, error);
                    reject(error);
                }
            );
        });
    }
}