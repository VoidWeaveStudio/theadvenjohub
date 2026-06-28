//src\features\game\models\PlayerModelLoader.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

export class PlayerModelLoader {
    private static loader = new GLTFLoader();
    private static modelCache: THREE.Group | null = null;
    private static animationCache: Map<string, THREE.AnimationClip> = new Map();
    private static loadPromise: Promise<void> | null = null;

    static async preload(): Promise<void> {
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = (async () => {
            try {
                console.log('📦 Loading player model (GLB)...');
                
                const gltf = await this.loadGLB('/models/player/character.glb');
                const character = gltf.scene;
                
                const originalBox = new THREE.Box3().setFromObject(character);
                const originalSize = originalBox.getSize(new THREE.Vector3());
                console.log(`📏 Original size: ${originalSize.x.toFixed(2)} x ${originalSize.y.toFixed(2)} x ${originalSize.z.toFixed(2)}`);
                
                const targetHeight = 1.8;
                const scale = targetHeight / originalSize.y;
                character.scale.setScalar(scale);
                
                const finalBox = new THREE.Box3().setFromObject(character);
                const finalSize = finalBox.getSize(new THREE.Vector3());
                console.log(`📏 Final size: ${finalSize.x.toFixed(2)} x ${finalSize.y.toFixed(2)} x ${finalSize.z.toFixed(2)}`);
                
                character.position.y = -finalBox.min.y;
                
                let boneCount = 0;
                character.traverse((child: THREE.Object3D) => {
                    if (child instanceof THREE.Bone) boneCount++;
                    if (child instanceof THREE.SkinnedMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                console.log(`🦴 Model has ${boneCount} bones`);
                
                this.modelCache = character;

                const animationFiles = {
                    idle: '/models/player/animations/idle.glb',
                    running: '/models/player/animations/running.glb',
                    shooting: '/models/player/animations/shooting.glb',
                    reloading: '/models/player/animations/reloading.glb',
                    death: '/models/player/animations/death.glb'
                };

                console.log('📦 Loading animations from separate files...');
                
                for (const [name, url] of Object.entries(animationFiles)) {
                    try {
                        const animGltf = await this.loadGLB(url);
                        
                        if (animGltf.animations.length === 0) {
                            console.warn(`⚠️ Animation "${name}" has no clips!`);
                            continue;
                        }
                        
                        const clip = animGltf.animations[0];
                        
                        if (clip.name === 'mixamo.com' || clip.name === 'Take 001') {
                            clip.name = name;
                        }
                        
                        console.log(`🎬 Loaded "${name}": ${clip.tracks.length} tracks, ${clip.duration.toFixed(2)}s`);
                        this.animationCache.set(name, clip);
                    } catch (err) {
                        console.warn(`⚠️ Failed to load animation "${name}":`, err);
                    }
                }

                console.log('✅ Model + animations loaded:', Array.from(this.animationCache.keys()));
            } catch (err) {
                console.error('❌ Failed to load player model:', err);
                throw err;
            }
        })();

        return this.loadPromise;
    }

    static getModelClone(): THREE.Group | null {
        if (!this.modelCache) {
            console.warn('⚠️ Model cache is empty!');
            return null;
        }
        
        try {
            const clone = cloneSkeleton(this.modelCache) as THREE.Group;
            
            let boneCount = 0;
            clone.traverse((child) => {
                if (child instanceof THREE.Bone) boneCount++;
            });
            
            console.log(`📦 Clone created with ${boneCount} bones`);
            
            if (boneCount === 0) {
                console.error('❌ Clone has NO bones!');
                return null;
            }
            
            return clone;
        } catch (err) {
            console.error('❌ Failed to clone model:', err);
            return null;
        }
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
                    console.error(`❌ Failed to load GLB: ${url}`, error);
                    reject(error);
                }
            );
        });
    }
}