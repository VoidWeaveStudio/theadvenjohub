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
                
                character.scale.setScalar(0.01);
                
                const box = new THREE.Box3().setFromObject(character);
                const size = box.getSize(new THREE.Vector3());
                console.log(`📏 GLB model size AFTER scaling: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);
                
                character.traverse((child: THREE.Object3D) => {
                    if (child instanceof THREE.SkinnedMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                this.modelCache = character;
                console.log('✅ Character loaded and scaled');

                const animationFiles = {
                    idle: '/models/player/animations/idle.glb',
                    running: '/models/player/animations/running.glb',
                    shooting: '/models/player/animations/shooting.glb',
                    reloading: '/models/player/animations/reloading.glb',
                    death: '/models/player/animations/death.glb'
                };

                const entries = Object.entries(animationFiles);
                const results = await Promise.all(
                    entries.map(async ([name, url]) => {
                        try {
                            const gltfAnim = await this.loadGLB(url);
                            if (gltfAnim.animations.length === 0) {
                                console.warn(`⚠️ Animation "${name}" has no clips!`);
                                return { name, clip: null };
                            }
                            const clip = gltfAnim.animations[0];
                            return { name, clip };
                        } catch (err) {
                            console.warn(`⚠️ Failed to load animation "${name}":`, err);
                            return { name, clip: null };
                        }
                    })
                );

                for (const { name, clip } of results) {
                    if (clip) this.animationCache.set(name, clip);
                }

                console.log('✅ Player model loaded with animations:', Array.from(this.animationCache.keys()));
            } catch (err) {
                console.error('❌ Failed to load player model:', err);
                throw err;
            }
        })();

        return this.loadPromise;
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

    static getModelClone(): THREE.Group | null {
        if (!this.modelCache) {
            console.warn('⚠️ Model cache is empty!');
            return null;
        }
        
        try {
            const clone = cloneSkeleton(this.modelCache) as THREE.Group;
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
}