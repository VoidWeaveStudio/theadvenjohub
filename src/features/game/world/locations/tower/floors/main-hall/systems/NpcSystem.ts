// src/features/game/world/locations/tower/floors/main-hall/systems/NpcSystem.ts
import * as THREE from "three";
import { CollisionGrid } from "../../../../../CollisionGrid";
import { ResourceManager } from "../../../../../../core/ResourceManager";
import { createNpcModel, NpcHandle } from "../../../../../../entities/npcModel";
import { createNpcNameTag } from "../../../../../../entities/npcNameTag";
import { HALL_NPCS, POST_PLINTH_TOP, POST_RADIUS, inwardRotation, localToWorld } from "../layout";

export interface MainHallNpc {
    handle: NpcHandle;
    baseRotation: number;
    time: number;
}

type AccessoryBuilder = (headPosition: THREE.Vector3, accentHex: number) => THREE.Object3D[];

function markerAndGlow(headPos: THREE.Vector3, accentHex: number, markerColor: number): THREE.Object3D[] {
    const marker = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.18, 0),
        new THREE.MeshStandardMaterial({ color: markerColor, emissive: accentHex, emissiveIntensity: 5 })
    );
    marker.position.set(headPos.x, headPos.y + 0.9, headPos.z);

    return [marker];
}

const ACCESSORY_BUILDERS: Record<string, AccessoryBuilder> = {
    "token-vendor": (headPos, accentHex) => {
        const visor = new THREE.Mesh(
            new THREE.BoxGeometry(0.42, 0.1, 0.06),
            new THREE.MeshStandardMaterial({ color: 0x0b0f16, emissive: accentHex, emissiveIntensity: 4 })
        );
        visor.position.set(headPos.x, headPos.y + 0.08, headPos.z + 0.17);
        return [visor, ...markerAndGlow(headPos, accentHex, 0xffe9b0)];
    },
    "quest-giver-sola": (headPos, accentHex) => {
        const hood = new THREE.Mesh(
            new THREE.ConeGeometry(0.34, 0.5, 12),
            new THREE.MeshStandardMaterial({ color: 0x0f2b20, roughness: 0.8, emissive: accentHex, emissiveIntensity: 0.5 })
        );
        hood.position.set(headPos.x, headPos.y + 0.3, headPos.z);
        return [hood, ...markerAndGlow(headPos, accentHex, 0xd6ffe9)];
    },
    "npc-alfredo": (headPos, accentHex) => {
        const beret = new THREE.Mesh(
            new THREE.SphereGeometry(0.26, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
            new THREE.MeshStandardMaterial({ color: 0x2a1a3a, roughness: 0.75, emissive: accentHex, emissiveIntensity: 0.6 })
        );
        beret.position.set(headPos.x, headPos.y + 0.32, headPos.z);
        beret.rotation.x = Math.PI;

        const palette = new THREE.Mesh(
            new THREE.CircleGeometry(0.16, 16),
            new THREE.MeshStandardMaterial({ color: 0xd9c2a6, roughness: 0.6, side: THREE.DoubleSide })
        );
        palette.position.set(headPos.x + 0.35, headPos.y - 0.1, headPos.z + 0.2);
        palette.rotation.y = Math.PI / 3;

        return [beret, palette, ...markerAndGlow(headPos, accentHex, 0xcdeaff)];
    },
    "faction-broker": (headPos, accentHex) => {
        const circlet = new THREE.Mesh(
            new THREE.TorusGeometry(0.22, 0.03, 8, 16),
            new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.4, metalness: 0.8, emissive: accentHex, emissiveIntensity: 1.2 })
        );
        circlet.rotation.x = Math.PI / 2;
        circlet.position.set(headPos.x, headPos.y + 0.28, headPos.z);
        return [circlet, ...markerAndGlow(headPos, accentHex, 0xe8d0ff)];
    },
};

export function createMainHallNpcs(scene: THREE.Scene, collisionGrid: CollisionGrid, rm: ResourceManager): MainHallNpc[] {
    return HALL_NPCS.map((npc) => {
        const post = localToWorld(npc.angle, POST_RADIUS, 0, POST_PLINTH_TOP, 0.6);
        const position = new THREE.Vector3(post[0], post[1], post[2]);
        const baseRotation = inwardRotation(npc.angle);

        const handle = createNpcModel(rm, npc.bodyTint, (headPos) =>
            ACCESSORY_BUILDERS[npc.id](headPos, npc.accentHex)
        );
        handle.group.position.copy(position);
        handle.group.rotation.y = baseRotation;
        handle.group.userData.interactionId = npc.id;
        handle.group.add(createNpcNameTag(npc.npcName, npc.accent));
        scene.add(handle.group);

        collisionGrid.insertCylinder(
            new THREE.Vector3(position.x, position.y + 1.25, position.z),
            0.55,
            2.5
        );

        return { handle, baseRotation, time: 0 };
    });
}
