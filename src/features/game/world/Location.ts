//src\features\game\world\Location.ts
import * as THREE from "three";
import { ResourceManager } from "../core/ResourceManager";

export interface Portal {
    id: string;
    position: THREE.Vector3;
    radius: number;
    targetLocationId: string;
    targetSpawnPoint: THREE.Vector3;
    mesh: THREE.Object3D;
}

export abstract class Location {
    public readonly id: string;
    public readonly name: string;
    public scene: THREE.Scene;
    public portals: Portal[] = [];
    public colliders: THREE.Box3[] = [];
    
    public pendingTeleport: string | null = null;

    constructor(id: string, name: string) {
        this.id = id;
        this.name = name;
        this.scene = new THREE.Scene();
    }

    abstract create(resourceManager: ResourceManager): void;
    abstract getSpawnPoint(): THREE.Vector3;
    abstract dispose(): void;

    update?(playerPosition: THREE.Vector3, delta: number): void;

    addPortal(portal: Portal) {
        this.portals.push(portal);
        this.scene.add(portal.mesh);
    }
}