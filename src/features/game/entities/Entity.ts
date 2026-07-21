//src\features\game\entities\Entity.ts
import * as THREE from "three";

export abstract class Entity {
    public mesh: THREE.Group;
    public id: string;
    public position: THREE.Vector3 = new THREE.Vector3();
    public velocity: THREE.Vector3 = new THREE.Vector3();

    constructor(id: string) {
        this.id = id;
        this.mesh = new THREE.Group();
    }

    abstract create(scene: THREE.Scene, ...args: any[]): void;
    abstract update(delta: number): void;

    dispose(scene: THREE.Scene) {
        scene.remove(this.mesh);
        this.mesh.traverse((obj) => {
            if ((obj as THREE.Mesh).isMesh) {
                const mesh = obj as THREE.Mesh;
                mesh.geometry?.dispose();
                const mat = mesh.material;
                if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
                else mat?.dispose();
            }
        });
    }
}