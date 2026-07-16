import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
// @ts-ignore
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export class ResourceManager {
  private gltfLoader: GLTFLoader;
  private dracoLoader: DRACOLoader;
  private models: Map<string, { scene: THREE.Group; animations: THREE.AnimationClip[] }> = new Map();
  private textures: Map<string, THREE.Texture> = new Map();

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
      this.loadModel("portal", "/models/portal.glb"),
      this.loadModel("portalVFX", "/models/portal-vfx.glb"),
      this.loadModel("cosmos", "/models/cosmos.glb"),

      this.loadTexture("nebula-sky", "/models/nebula_7_0.png", true),

      this.loadTexture("floor-color", "/models/textures/basement_floor/cobblestone_01_diff_1k.jpg", true),
      this.loadTexture("floor-normal", "/models/textures/basement_floor/cobblestone_01_nor_gl_1k.jpg", false),
      this.loadTexture("floor-roughness", "/models/textures/basement_floor/cobblestone_01_rough_1k.jpg", false),

      this.loadTexture("ground-color", "/models/textures/ground/Ground037_1K-JPG_Color.jpg", true),
      this.loadTexture("ground-normal", "/models/textures/ground/Ground037_1K-JPG_NormalGL.jpg", false),
      this.loadTexture("ground-roughness", "/models/textures/ground/Ground037_1K-JPG_Roughness.jpg", false),
      this.loadTexture("ground-ao", "/models/textures/ground/Ground037_1K-JPG_AmbientOcclusion.jpg", false),
    ]);
  }

  private async loadTexture(name: string, url: string, isSRGB: boolean): Promise<void> {
    console.log(`[ResourceManager] Start loading texture: ${name}`);
    return new Promise((resolve) => {
      const loader = new THREE.TextureLoader();
      loader.load(
        url,
        (texture) => {
          console.log(`[ResourceManager] ✅ Loaded texture: ${name}`);
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.anisotropy = 8;
          texture.generateMipmaps = true;
          if (isSRGB) {
            texture.colorSpace = THREE.SRGBColorSpace;
          }
          this.textures.set(name, texture);
          resolve();
        },
        undefined,
        (error) => {
          console.error(`[ResourceManager] ❌ Failed texture: ${name}`, error);
          resolve();
        }
      );
    });
  }

  getTexture(name: string): THREE.Texture | null {
    return this.textures.get(name) || null;
  }

  private async loadModel(name: string, url: string): Promise<void> {
    console.log(`[ResourceManager] Start loading model: ${name} (${url})`);
    return new Promise((resolve) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          console.log(`[ResourceManager] ✅ Loaded model: ${name}`);
          
          gltf.scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
            }
          });

          this.models.set(name, { 
            scene: gltf.scene, 
            animations: gltf.animations || [] 
          });
          resolve();
        },
        (progress) => {
          if (progress.total > 0) {
            console.log(`[ResourceManager] ⏳ ${name}: ${((progress.loaded / progress.total) * 100).toFixed(1)}%`);
          }
        },
        (error) => {
          console.error(`[ResourceManager] ❌ Failed to load model: ${name}`, error);
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
        const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.2), new THREE.MeshStandardMaterial({ color: 0x222222 }));
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.4), new THREE.MeshStandardMaterial({ color: 0x5a3a22 }));
        stock.position.set(0, -0.05, 0.5);
        barrel.castShadow = true;
        stock.castShadow = true;
        group.add(barrel, stock);
        break;
      }
      case "bullet": {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffee00 }));
        group.add(b);
        break;
      }
      case "crystal": {
        const c = new THREE.Mesh(new THREE.OctahedronGeometry(1.5, 0), new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.5 }));
        c.castShadow = true;
        group.add(c);
        break;
      }
      case "tree": {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 4, 6), new THREE.MeshStandardMaterial({ color: 0x4a2511 }));
        trunk.position.y = 2;
        const leaves = new THREE.Mesh(new THREE.ConeGeometry(2, 5, 8), new THREE.MeshStandardMaterial({ color: 0x2d5016 }));
        leaves.position.y = 6;
        trunk.castShadow = true; leaves.castShadow = true;
        group.add(trunk, leaves);
        break;
      }
      case "rock": {
        const r = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x888888 }));
        r.position.y = 0.5;
        r.castShadow = true;
        group.add(r);
        break;
      }
      case "portalVFX": {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.1, 8, 16), new THREE.MeshStandardMaterial({ color: 0xffaa33, emissive: 0xffaa33, emissiveIntensity: 2 }));
        group.add(ring);
        break;
      }
      case "cosmos": {
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(200, 32, 32),
          new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.BackSide, depthTest: false, depthWrite: false })
        );
        sphere.renderOrder = -1000;
        group.add(sphere);
        break;
      }
      default: {
        const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xff00ff }));
        group.add(box);
        break;
      }
    }
    return group;
  }

  getModel(name: string): { scene: THREE.Group; animations: THREE.AnimationClip[] } | null {
    const m = this.models.get(name);
    if (!m) {
      console.warn(`[ResourceManager] ⚠️ Model not found: ${name}`);
      return null;
    }
    try {
      return {
        scene: SkeletonUtils.clone(m.scene) as THREE.Group,
        animations: m.animations,
      };
    } catch (error) {
      console.warn(`[ResourceManager] Clone failed for ${name}, fallback to .clone()`);
      return { scene: m.scene.clone(), animations: m.animations };
    }
  }
}