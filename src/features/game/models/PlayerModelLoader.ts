//src\features\game\models\PlayerModelLoader.ts
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

export class PlayerModelLoader {
    private static loader = new FBXLoader();
    private static modelCache: THREE.Group | null = null;
    private static animationCache: Map<string, THREE.AnimationClip> = new Map();
    private static loadPromise: Promise<void> | null = null;

    static async preload(): Promise<void> {
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = (async () => {
            try {
                const character = await this.loadFBX('/models/player/character.fbx');
                character.scale.setScalar(0.01);
                
                character.traverse((child) => {
                    if (child instanceof THREE.SkinnedMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                this.modelCache = character;

                const animationFiles = {
                    idle: '/models/player/animations/idle.fbx',
                    running: '/models/player/animations/running.fbx',
                    shooting: '/models/player/animations/shooting.fbx',
                    reloading: '/models/player/animations/reloading.fbx',
                    death: '/models/player/animations/death.fbx'
                };

                const entries = Object.entries(animationFiles);
                const results = await Promise.all(
                    entries.map(async ([name, url]) => {
                        const fbx = await this.loadFBX(url);
                        return { name, clip: fbx.animations[0] };
                    })
                );

                for (const { name, clip } of results) {
                    if (clip) {
                        this.animationCache.set(name, clip);
                    }
                }

                console.log('✅ Player model loaded with animations:', Array.from(this.animationCache.keys()));
            } catch (err) {
                console.error('❌ Failed to load player model:', err);
                throw err;
            }
        })();

        return this.loadPromise;
    }

    private static loadFBX(url: string): Promise<THREE.Group> {
        return new Promise((resolve, reject) => {
            this.loader.load(
                url,
                (fbx) => resolve(fbx),
                undefined,
                reject
            );
        });
    }

    static getModelClone(): THREE.Group | null {
        if (!this.modelCache) return null;
        
        const { SkeletonUtils } = require('three/examples/jsm/utils/SkeletonUtils.js');
        return SkeletonUtils.clone(this.modelCache);
    }

    static getAnimation(name: string): THREE.AnimationClip | null {
        return this.animationCache.get(name) || null;
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