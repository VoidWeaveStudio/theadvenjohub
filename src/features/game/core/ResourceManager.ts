//src\features\game\core\ResourceManager.ts
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
// @ts-ignore
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

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
    return new Promise((resolve) => {
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
          console.warn(`[ResourceManager] Model "${name}" not found, using primitive`);
          const placeholder = this.createPlaceholder(name);
          this.models.set(name, { scene: placeholder, animations: [] });
          resolve();
        }
      );
    });
  }

  private createPlaceholder(name: string): THREE.Group {
    const group = new THREE.Group();

    switch (name) {
      case "player": {
        const mat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.2, 4, 8), mat);
        body.position.y = 1;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);
        break;
      }
      case "rifle": {
        const barrel = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.08, 1.2),
          new THREE.MeshStandardMaterial({ color: 0x222222 })
        );
        const stock = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.15, 0.4),
          new THREE.MeshStandardMaterial({ color: 0x5a3a22 })
        );
        stock.position.set(0, -0.05, 0.5);
        barrel.castShadow = true;
        stock.castShadow = true;
        group.add(barrel, stock);
        break;
      }
      case "bullet": {
        const b = new THREE.Mesh(
          new THREE.SphereGeometry(0.08, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0xffee00 })
        );
        group.add(b);
        break;
      }
      case "crystal": {
        const c = new THREE.Mesh(
          new THREE.OctahedronGeometry(1.5, 0),
          new THREE.MeshStandardMaterial({ 
            color: 0x00ffff, 
            emissive: 0x00ffff, 
            emissiveIntensity: 0.5 
          })
        );
        c.castShadow = true;
        group.add(c);
        break;
      }
      case "tree": {
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.45, 4, 6),
          new THREE.MeshStandardMaterial({ color: 0x4a2511 })
        );
        trunk.position.y = 2;
        const leaves = new THREE.Mesh(
          new THREE.ConeGeometry(2, 5, 8),
          new THREE.MeshStandardMaterial({ color: 0x2d5016 })
        );
        leaves.position.y = 6;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        leaves.castShadow = true;
        leaves.receiveShadow = true;
        group.add(trunk, leaves);
        break;
      }
      case "rock": {
        const r = new THREE.Mesh(
          new THREE.DodecahedronGeometry(1, 0),
          new THREE.MeshStandardMaterial({ color: 0x888888 })
        );
        r.position.y = 0.5;
        r.castShadow = true;
        r.receiveShadow = true;
        group.add(r);
        break;
      }
      default: {
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshStandardMaterial({ color: 0xff00ff })
        );
        group.add(box);
      }
    }

    return group;
  }

  getModel(name: string): { scene: THREE.Group; animations: THREE.AnimationClip[] } | null {
    const m = this.models.get(name);
    if (!m) return null;

    try {
      return {
        scene: SkeletonUtils.clone(m.scene) as THREE.Group,
        animations: m.animations,
      };
    } catch (error) {
      console.warn('[ResourceManager] SkeletonUtils.clone failed, using simple clone:', error);
      return {
        scene: m.scene.clone(),
        animations: m.animations,
      };
    }
  }
}