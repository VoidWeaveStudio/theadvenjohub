//src\features\game\core\ResourceManager.ts
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

const SkeletonUtils = require('three/examples/jsm/utils/SkeletonUtils.js').SkeletonUtils;

export class ResourceManager {
  private gltfLoader: GLTFLoader;
  private dracoLoader: DRACOLoader;
  private models: Map<string, { scene: THREE.Group; animations: THREE.AnimationClip[] }> = new Map();

  constructor() { 
    this.gltfLoader = new GLTFLoader();
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
    this.gltfLoader.setDRACOLoader(this.dracoLoader);
  }

  async loadAll() {
    await Promise.all([
      this.loadModel("player", "/models/player/character.glb"),
      this.loadModel("rifle", "/models/rifle.glb"),
      this.loadModel("bullet", "/models/bullet.glb"),
      this.loadModel("crystal", "/models/crystal.glb"),
      this.loadModel("tree", "/models/tree.glb"),
      this.loadModel("rock", "/models/rock.glb"),
    ]);
  }

  private async loadModel(name: string, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          gltf.scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          this.models.set(name, { scene: gltf.scene, animations: gltf.animations || [] });
          resolve();
        },
        undefined,
        () => {
          reject(new Error(`Failed to load model: ${name}`));
        }
      );
    });
  }

  getModel(name: string): { scene: THREE.Group; animations: THREE.AnimationClip[] } | null {
    const m = this.models.get(name);
    if (!m) return null;

    return {
      scene: SkeletonUtils.clone(m.scene) as THREE.Group,
      animations: m.animations,
    };
  }
}