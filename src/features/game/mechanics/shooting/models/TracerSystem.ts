import * as THREE from 'three';

interface Tracer {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class TracerSystem {
  private tracers: Tracer[] = [];
  private scene: THREE.Scene;
  private geometry: THREE.CylinderGeometry;
  private material: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.geometry = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4);
    this.geometry.rotateX(Math.PI / 2);
    this.material = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 1,
    });
  }

  createTracer(from: THREE.Vector3, to: THREE.Vector3): void {
    const mesh = new THREE.Mesh(this.geometry, this.material.clone());
    mesh.position.copy(from);
    
    const direction = to.clone().sub(from).normalize();
    mesh.lookAt(to);
    
    this.scene.add(mesh);

    const speed = 200;
    const velocity = direction.multiplyScalar(speed);

    this.tracers.push({
      mesh,
      velocity,
      life: 0,
      maxLife: 0.15,
    });
  }

  update(deltaTime: number): void {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tracer = this.tracers[i];
      tracer.life += deltaTime;

      tracer.mesh.position.add(tracer.velocity.clone().multiplyScalar(deltaTime));

      const progress = tracer.life / tracer.maxLife;
      if (tracer.mesh.material instanceof THREE.MeshBasicMaterial) {
        tracer.mesh.material.opacity = 1 - progress;
      }

      if (tracer.life >= tracer.maxLife) {
        this.scene.remove(tracer.mesh);
        if (tracer.mesh.material instanceof THREE.Material) {
          tracer.mesh.material.dispose();
        }
        this.tracers.splice(i, 1);
      }
    }
  }

  clear(): void {
    this.tracers.forEach((tracer) => {
      this.scene.remove(tracer.mesh);
      if (tracer.mesh.material instanceof THREE.Material) {
        tracer.mesh.material.dispose();
      }
    });
    this.tracers = [];
  }

  dispose(): void {
    this.clear();
    this.geometry.dispose();
    this.material.dispose();
  }
}