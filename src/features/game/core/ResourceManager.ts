//src\features\game\core\ResourceManager.ts
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export class ResourceManager {
  private static instance: ResourceManager | null = null;

  private gltfLoader: GLTFLoader;
  private dracoLoader: DRACOLoader;
  private models: Map<string, { scene: THREE.Group; animations: THREE.AnimationClip[] }> = new Map();
  private textures: Map<string, THREE.Texture> = new Map();
  private modelLoadListeners: Map<string, (() => void)[]> = new Map();

  private loadedCount = 0;
  private totalCount = 0;
  
  public onProgress?: (progress: number, message: string) => void;

  public static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager();
    }
    return ResourceManager.instance;
  }

  constructor() {
    this.gltfLoader = new GLTFLoader();
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
    this.gltfLoader.setDRACOLoader(this.dracoLoader);
  }

  private updateProgress(message: string) {
    this.loadedCount++;
    const progress = this.totalCount > 0 ? (this.loadedCount / this.totalCount) * 100 : 100;
    this.onProgress?.(progress, message);
  }

  async loadCritical() {
    if (this.models.has("player") && this.textures.has("ground-color") && this.models.has("crystal")) {
      this.onProgress?.(100, "Ready (Cached)");
      return;
    }

    this.loadedCount = 0;
    this.totalCount = 6;

    await Promise.all([
      this.loadModel("player", "/models/player/character.glb", "Loading Player"),
      this.loadModel("rifle", "/models/rifle.glb", "Loading Weapon"),
      this.loadModel("crystal", "/models/crystal.glb", "Loading Safe Zone"),
      this.loadTexture("ground-color", "/models/textures/ground/Ground037_1K-JPG_Color.jpg", true, "Loading Ground"),
      this.loadTexture("ground-normal", "/models/textures/ground/Ground037_1K-JPG_NormalGL.jpg", false, "Loading Ground Details"),
      this.loadTexture("ground-roughness", "/models/textures/ground/Ground037_1K-JPG_Roughness.jpg", false, "Loading Ground Physics"),
    ]);
    
    this.onProgress?.(100, "Ready");
  }

  async loadLazy() {
    if (this.models.has("tree") && this.models.has("cosmos")) {
      return;
    }

    const lazyModels = [
      { name: "bullet", url: "/models/bullet.glb" },
      { name: "tree", url: "/models/tree.glb" },
      { name: "rock", url: "/models/rock.glb" },
      { name: "portal", url: "/models/portal.glb" },
      { name: "portalVFX", url: "/models/portal-vfx.glb" },
      { name: "cosmos", url: "/models/cosmos.glb" },
      { name: "column", url: "/models/column.glb" },
    ];

    lazyModels.forEach(({ name, url }) => {
      this.loadModel(name, url).catch(err => console.warn(`Lazy load failed for ${name}:`, err));
    });

    const lazyTextures = [
      { name: "nebula-sky", url: "/models/nebula_7_0.png", isSRGB: true },
      { name: "floor-color", url: "/models/textures/basement_floor/cobblestone_01_diff_1k.jpg", isSRGB: true },
      { name: "floor-normal", url: "/models/textures/basement_floor/cobblestone_01_nor_gl_1k.jpg", isSRGB: false },
      { name: "floor-roughness", url: "/models/textures/basement_floor/cobblestone_01_rough_1k.jpg", isSRGB: false },
      { name: "ground-ao", url: "/models/textures/ground/Ground037_1K-JPG_AmbientOcclusion.jpg", isSRGB: false },
    ];

    lazyTextures.forEach(({ name, url, isSRGB }) => {
      this.loadTexture(name, url, isSRGB).catch(err => console.warn(`Lazy load failed for texture ${name}:`, err));
    });
  }

  async loadAll() {
    await this.loadCritical();
    await this.loadLazy();
  }

  onModelLoaded(name: string, callback: () => void) {
    if (this.models.has(name)) {
      callback();
      return;
    }
    if (!this.modelLoadListeners.has(name)) {
      this.modelLoadListeners.set(name, []);
    }
    this.modelLoadListeners.get(name)!.push(callback);
  }

  private notifyModelLoaded(name: string) {
    const listeners = this.modelLoadListeners.get(name);
    if (listeners) {
      listeners.forEach(cb => cb());
      this.modelLoadListeners.delete(name);
    }
  }

  private async loadTexture(name: string, url: string, isSRGB: boolean, progressMsg?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader();
      loader.load(
        url,
        (texture) => {
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.anisotropy = 4;
          texture.generateMipmaps = true;
          
          if (isSRGB) {
            texture.colorSpace = THREE.SRGBColorSpace;
          }
          
          this.textures.set(name, texture);
          if (progressMsg) this.updateProgress(progressMsg);
          resolve();
        },
        undefined,
        (error) => {
          console.error(`[ResourceManager] Failed texture: ${name}`, error);
          if (progressMsg) this.updateProgress(progressMsg);
          reject(error);
        }
      );
    });
  }

  getTexture(name: string): THREE.Texture | null {
    return this.textures.get(name) || null;
  }

  private async loadModel(name: string, url: string, progressMsg?: string): Promise<void> {
    return new Promise((resolve) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
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
          this.notifyModelLoaded(name);
          if (progressMsg) this.updateProgress(progressMsg);
          resolve();
        },
        undefined,
        (error) => {
          console.error(`[ResourceManager] Failed to load model: ${name}`, error);
          resolve();
        }
      );
    });
  }

  private createProceduralGrass(): THREE.Group {
    const group = new THREE.Group();
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x2d5016, 
      side: THREE.DoubleSide 
    });
    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = -Math.PI / 2;
    group.add(plane);
    return group;
  }

  getModel(name: string): { scene: THREE.Group; animations: THREE.AnimationClip[] } | null {
    if (name === "grass") {
      if (!this.models.has("grass")) {
        const proceduralGrass = this.createProceduralGrass();
        this.models.set("grass", { scene: proceduralGrass, animations: [] });
      }
      const m = this.models.get("grass")!;
      return { scene: m.scene.clone(), animations: m.animations };
    }

    const m = this.models.get(name);
    if (!m) {
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