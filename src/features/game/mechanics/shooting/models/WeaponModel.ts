import * as THREE from 'three';

export interface WeaponModelConfig {
  bodyColor: number;
  barrelColor: number;
  gripColor: number;
  bodySize: { x: number; y: number; z: number };
  barrelLength: number;
  barrelRadius: number;
  offset: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
}

export const DEFAULT_WEAPON_CONFIG: WeaponModelConfig = {
  bodyColor: 0x2a2a2a,
  barrelColor: 0x1a1a1a,
  gripColor: 0x3a3a3a,
  bodySize: { x: 0.1, y: 0.1, z: 0.8 },
  barrelLength: 0.5,
  barrelRadius: 0.03,
  offset: { x: 0.05, y: 0, z: 0.1 },
  rotation: { x: Math.PI, y: 0, z: 0 },
};

export class WeaponModel {
  readonly group: THREE.Group;
  private body: THREE.Mesh;
  private barrel: THREE.Mesh;
  private grip: THREE.Mesh;
  private muzzlePoint: THREE.Object3D;
  private recoilOffset = 0;
  private recoilVelocity = 0;
  private config: WeaponModelConfig;
  private attachedTo: THREE.Object3D | null = null;
  private isVisible: boolean = false;

  constructor(config: Partial<WeaponModelConfig> = {}) {
    this.config = { ...DEFAULT_WEAPON_CONFIG, ...config };
    this.group = new THREE.Group();
    this.group.name = 'weapon';
    this.group.visible = false;

    console.log('🔫 Creating weapon model with config:', this.config);

    const bodyGeo = new THREE.BoxGeometry(
      this.config.bodySize.x,
      this.config.bodySize.y,
      this.config.bodySize.z
    );
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.config.bodyColor,
      metalness: 0.8,
      roughness: 0.3,
      flatShading: true,
    });
    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.body.castShadow = true;
    this.body.name = 'body';
    this.group.add(this.body);

    const barrelGeo = new THREE.CylinderGeometry(
      this.config.barrelRadius,
      this.config.barrelRadius,
      this.config.barrelLength,
      8
    );
    const barrelMat = new THREE.MeshStandardMaterial({
      color: this.config.barrelColor,
      metalness: 0.9,
      roughness: 0.2,
      flatShading: true,
    });
    this.barrel = new THREE.Mesh(barrelGeo, barrelMat);
    this.barrel.rotation.x = Math.PI / 2;
    this.barrel.position.z = -this.config.bodySize.z / 2 - this.config.barrelLength / 2;
    this.barrel.castShadow = true;
    this.barrel.name = 'barrel';
    this.group.add(this.barrel);

    const gripGeo = new THREE.BoxGeometry(0.08, 0.2, 0.1);
    const gripMat = new THREE.MeshStandardMaterial({
      color: this.config.gripColor,
      metalness: 0.5,
      roughness: 0.6,
      flatShading: true,
    });
    this.grip = new THREE.Mesh(gripGeo, gripMat);
    this.grip.position.set(0, -0.15, 0.15);
    this.grip.rotation.x = -0.2;
    this.grip.castShadow = true;
    this.grip.name = 'grip';
    this.group.add(this.grip);

    const sightGeo = new THREE.BoxGeometry(0.04, 0.05, 0.04);
    const sightMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      metalness: 0.9,
      roughness: 0.3,
    });
    const sight = new THREE.Mesh(sightGeo, sightMat);
    sight.position.set(0, 0.08, -0.1);
    this.group.add(sight);

    this.muzzlePoint = new THREE.Object3D();
    this.muzzlePoint.name = 'muzzlePoint';
    this.muzzlePoint.position.set(0, 0, -this.config.bodySize.z / 2 - this.config.barrelLength);
    this.group.add(this.muzzlePoint);

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

    console.log('✅ Weapon model created at position:', this.group.position);
  }

  attachToBone(bone: THREE.Bone): void {
    console.log('🔫 Attaching weapon to bone:', bone.name);
    this.attachedTo = bone;
    bone.add(this.group);
    console.log('✅ Weapon attached to bone, bone children count:', bone.children.length);
  }

  attachToPlayer(playerModel: THREE.Group): void {
    console.log('🔫 Attaching weapon to player model');
    this.attachedTo = playerModel;
    playerModel.add(this.group);
    console.log('✅ Weapon attached to player, children count:', playerModel.children.length);
  }

  detach(): void {
    console.log('🔫 Detaching weapon');
    this.group.parent?.remove(this.group);
    this.attachedTo = null;
  }

  setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.group.visible = visible;
    console.log('🔫 Weapon visibility:', visible);
  }

  getVisible(): boolean {
    return this.isVisible;
  }

  getMuzzleWorldPosition(): THREE.Vector3 {
    if (this.group.parent) {
      this.group.parent.updateMatrixWorld(true);
    }
    this.muzzlePoint.updateMatrixWorld(true);
    
    const pos = new THREE.Vector3();
    this.muzzlePoint.getWorldPosition(pos);
    return pos;
  }

  triggerRecoil(): void {
    this.recoilVelocity = -8;
  }

  update(deltaTime: number, isShooting: boolean): void {
    if (!this.isVisible) return;

    const stiffness = 80;
    const damping = 8;
    const springForce = -stiffness * this.recoilOffset;
    const dampingForce = -damping * this.recoilVelocity;
    this.recoilVelocity += (springForce + dampingForce) * deltaTime;
    this.recoilOffset += this.recoilVelocity * deltaTime;

    this.recoilOffset = Math.max(-0.1, Math.min(0.02, this.recoilOffset));

    this.group.position.z = this.config.offset.z + this.recoilOffset;

    if (isShooting) {
      this.group.rotation.x = this.config.rotation.x + Math.sin(Date.now() * 0.05) * 0.01;
    } else {
      const time = Date.now() * 0.001;
      this.group.position.y = this.config.offset.y + Math.sin(time * 1.5) * 0.003;
      this.group.position.x = this.config.offset.x + Math.cos(time * 1.2) * 0.002;
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