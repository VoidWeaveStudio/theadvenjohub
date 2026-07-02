//src\features\game\mechanics\shooting\models\HitEffect.ts
import * as THREE from 'three';

export class HitEffect {
  private scene: THREE.Scene;
  private effects: Array<{ mesh: THREE.Mesh; life: number }> = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  createHitEffect(position: THREE.Vector3, normal: THREE.Vector3): void {
    const geometry = new THREE.RingGeometry(0.05, 0.15, 8);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff4444,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.position.add(normal.clone().multiplyScalar(0.01));
    mesh.lookAt(position.clone().add(normal));

    this.scene.add(mesh);
    this.effects.push({ mesh, life: 0 });
  }

  update(deltaTime: number): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.life += deltaTime;

      const progress = effect.life / 0.15;
      if (effect.mesh.material instanceof THREE.MeshBasicMaterial) {
        effect.mesh.material.opacity = 1 - progress;
      }
      effect.mesh.scale.setScalar(1 + progress * 0.5);

      if (effect.life >= 0.15) {
        this.scene.remove(effect.mesh);
        effect.mesh.geometry.dispose();
        if (effect.mesh.material instanceof THREE.Material) {
          effect.mesh.material.dispose();
        }
        this.effects.splice(i, 1);
      }
    }
  }

  clear(): void {
    this.effects.forEach((effect) => {
      this.scene.remove(effect.mesh);
      effect.mesh.geometry.dispose();
      if (effect.mesh.material instanceof THREE.Material) {
        effect.mesh.material.dispose();
      }
    });
    this.effects = [];
  }

  dispose(): void {
    this.clear();
  }
}