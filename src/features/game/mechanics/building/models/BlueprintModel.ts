import * as THREE from 'three';

export interface BlueprintModelConfig {
  color: number;
  size: { x: number; y: number; z: number };
  offset: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
}

export const DEFAULT_BLUEPRINT_CONFIG: BlueprintModelConfig = {
  color: 0x4488ff,
  size: { x: 0.15, y: 0.02, z: 0.2 },
  offset: { x: 0.05, y: 0, z: 0.1 },
  rotation: { x: 0, y: 0, z: 0 },
};

export class BlueprintModel {
  readonly group: THREE.Group;
  private board: THREE.Mesh;
  private config: BlueprintModelConfig;
  private attachedTo: THREE.Object3D | null = null;
  private isVisible: boolean = false;

  constructor(config: Partial<BlueprintModelConfig> = {}) {
    this.config = { ...DEFAULT_BLUEPRINT_CONFIG, ...config };
    this.group = new THREE.Group();
    this.group.name = 'blueprint';
    this.group.visible = false;

    const boardGeo = new THREE.BoxGeometry(
      this.config.size.x,
      this.config.size.y,
      this.config.size.z
    );
    const boardMat = new THREE.MeshStandardMaterial({
      color: this.config.color,
      metalness: 0.3,
      roughness: 0.7,
      flatShading: true,
    });
    this.board = new THREE.Mesh(boardGeo, boardMat);
    this.board.castShadow = true;
    this.board.name = 'board';
    this.group.add(this.board);

    const lineGeo = new THREE.BoxGeometry(0.12, 0.001, 0.002);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    
    for (let i = 0; i < 3; i++) {
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.position.set(0, 0.011, -0.06 + i * 0.06);
      this.group.add(line);
    }

    this.group.position.set(
      this.config.offset.x,
      this.config.offset.y,
      this.config.offset.z
    );
    this.group.rotation.set(
      this.config.rotation.x,
      this.config.rotation.y,
      this.config.rotation.z
    );
  }

  attachToBone(bone: THREE.Bone): void {
    this.attachedTo = bone;
    bone.add(this.group);
  }

  attachToPlayer(playerModel: THREE.Group): void {
    this.attachedTo = playerModel;
    playerModel.add(this.group);
  }

  detach(): void {
    this.group.parent?.remove(this.group);
    this.attachedTo = null;
  }

  setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.group.visible = visible;
  }

  getVisible(): boolean {
    return this.isVisible;
  }

  update(deltaTime: number, isActive: boolean): void {
    if (!this.isVisible) return;

    if (isActive) {
      const time = Date.now() * 0.001;
      this.group.position.y = this.config.offset.y + Math.sin(time * 2) * 0.002;
    }
  }

  dispose(): void {
    this.detach();
    this.group.traverse((child) => {
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
}