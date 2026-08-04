// src/features/game/world/locations/tower/floors/token-gates/systems/StewardSystem.ts
import * as THREE from "three";
import type { TokenGatesFloor } from "../../TokenGatesFloor";
import { ResourceManager } from "../../../../../../core/ResourceManager";
import { createNpcModel, NpcHandle } from "../../../../../../entities/npcModel";
import { createNpcNameTag } from "../../../../../../entities/npcNameTag";

const STEWARD_X = -30;
const STEWARD_Z = -36;

export class StewardSystem {
    public npc!: NpcHandle;
    private time = 0;

    constructor(private floor: TokenGatesFloor) { }

    create(rm: ResourceManager) {
        const x = STEWARD_X;
        const z = STEWARD_Z;

        const steward = createNpcModel(rm, 0x6b4a2f, (headPos) => {
            const hood = new THREE.Mesh(
                new THREE.ConeGeometry(0.32, 0.42, 12),
                new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.8 })
            );
            hood.position.set(headPos.x, headPos.y + 0.32, headPos.z);

            const marker = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.18, 0),
                new THREE.MeshStandardMaterial({ color: 0xffd699, emissive: 0xe8a33d, emissiveIntensity: 5 })
            );
            marker.position.set(headPos.x, headPos.y + 0.9, headPos.z);

            const glow = new THREE.PointLight(0xe8a33d, 1.4, 6);
            glow.position.set(headPos.x, headPos.y - 0.2, headPos.z + 0.3);

            return [hood, marker, glow];
        });
        steward.group.position.set(x, 0, z);
        steward.group.userData.interactionId = "gate-steward";
        steward.group.add(createNpcNameTag("Corwin", "#E8A33D"));
        this.floor.scene.add(steward.group);
        this.npc = steward;

        this.floor.collisionGrid.insert(new THREE.Box3(
            new THREE.Vector3(x - 0.5, 0, z - 0.5),
            new THREE.Vector3(x + 0.5, 2.5, z + 0.5)
        ));
    }

    update(delta: number) {
        if (!this.npc) return;
        this.time += delta;
        this.npc.group.rotation.y = Math.sin(this.time * 0.4) * 0.3;
        this.npc.update(delta);
    }

    dispose() {
        if (!this.npc) return;
        this.npc.group.traverse((c: any) => { if (c.isMesh) { c.geometry.dispose(); c.material.dispose(); } });
        this.floor.scene.remove(this.npc.group);
    }
}
