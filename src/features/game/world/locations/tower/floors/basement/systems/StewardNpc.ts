// src/features/game/world/locations/tower/floors/basement/systems/StewardNpc.ts
import * as THREE from "three";
import { ResourceManager } from "../../../../../../core/ResourceManager";
import { createNpcModel, NpcHandle } from "../../../../../../entities/npcModel";
import { createNpcNameTag } from "../../../../../../entities/npcNameTag";
import { disposeNpcNameTags } from "../../../../../../entities/npcNameTag";
import { t } from "@/core/i18n";
import type { Basement } from "../Basement";

const STEWARD_POSITION = new THREE.Vector3(-16, 0, 12);

export class StewardNpc {
    public npc: NpcHandle | null = null;
    public group: THREE.Group | null = null;

    private time = 0;

    constructor(private floor: Basement) { }

    create(rm: ResourceManager) {
        const steward = createNpcModel(rm, 0x2f4f4a, (headPos) => {
            const hood = new THREE.Mesh(
                new THREE.ConeGeometry(0.34, 0.46, 12),
                new THREE.MeshStandardMaterial({ color: 0x1d3330, roughness: 0.8 })
            );
            hood.position.set(headPos.x, headPos.y + 0.34, headPos.z);

            const sigil = new THREE.Mesh(
                new THREE.TorusGeometry(0.22, 0.05, 8, 24),
                new THREE.MeshStandardMaterial({
                    color: 0x8ffff0,
                    emissive: 0x3ee0c8,
                    emissiveIntensity: 4,
                    roughness: 0.3,
                })
            );
            sigil.position.set(headPos.x, headPos.y + 0.95, headPos.z);
            sigil.rotation.x = Math.PI / 2;

            return [hood, sigil];
        });

        steward.group.position.copy(STEWARD_POSITION);
        steward.group.userData.interactionId = "gate-steward";
        steward.group.userData.interactionRadius = 5;
        steward.group.add(createNpcNameTag("g.npc.keeper", "#7FE6CF"));

        this.floor.scene.add(steward.group);
        this.floor.collisionGrid.insert(new THREE.Box3(
            new THREE.Vector3(STEWARD_POSITION.x - 0.5, 0, STEWARD_POSITION.z - 0.5),
            new THREE.Vector3(STEWARD_POSITION.x + 0.5, 2.4, STEWARD_POSITION.z + 0.5)
        ));

        this.npc = steward;
        this.group = steward.group;
    }

    update(delta: number) {
        if (!this.npc) return;
        this.time += delta;
        this.npc.group.rotation.y = Math.sin(this.time * 0.35) * 0.35;
        this.npc.update(delta);
    }

    dispose() {
        if (!this.npc) return;
        disposeNpcNameTags(this.npc.group);
        this.npc.group.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (mesh.isMesh) {
                mesh.geometry.dispose();
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach((m) => m.dispose());
                } else if (mesh.material) {
                    (mesh.material as THREE.Material).dispose();
                }
            }
        });
        this.floor.scene.remove(this.npc.group);
        this.npc = null;
        this.group = null;
    }
}
