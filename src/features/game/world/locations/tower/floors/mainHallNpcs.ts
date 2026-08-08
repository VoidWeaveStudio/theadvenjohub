// src/features/game/world/locations/tower/floors/mainHallNpcs.ts
import * as THREE from "three";
import { CollisionGrid } from "../../../CollisionGrid";
import { ResourceManager } from "../../../../core/ResourceManager";
import { createNpcModel, NpcHandle } from "../../../../entities/npcModel";
import { createNpcNameTag } from "../../../../entities/npcNameTag";
import { MAIN_HALL_BUILDINGS, FACING_ROTATION, npcDoorPosition } from "./mainHallLayout";

export interface MainHallNpc {
    handle: NpcHandle;
    baseRotation: number;
    time: number;
}

type AccessoryBuilder = (headPos: THREE.Vector3, accentHex: number) => THREE.Object3D[];

function markerAndGlow(headPos: THREE.Vector3, accentHex: number, markerColor: number): THREE.Object3D[] {
    const marker = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.18, 0),
        new THREE.MeshStandardMaterial({ color: markerColor, emissive: accentHex, emissiveIntensity: 5 })
    );
    marker.position.set(headPos.x, headPos.y + 0.9, headPos.z);

    const glow = new THREE.PointLight(accentHex, 1.6, 6);
    glow.position.set(headPos.x, headPos.y - 0.2, headPos.z + 0.3);

    return [marker, glow];
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

const BODY_TINTS: Record<string, number> = {
    "token-vendor": 0x7a2f3a,
    "quest-giver-sola": 0x2f6b4a,
    "npc-alfredo": 0x1e6091,
    "faction-broker": 0x8b2fc9,
};

function buildCounter(
    scene: THREE.Scene,
    collisionGrid: CollisionGrid,
    position: THREE.Vector3,
    rotationY: number,
    accentHex: number
) {
    const counterGroup = new THREE.Group();
    counterGroup.position.copy(position);
    counterGroup.rotation.y = rotationY;

    const shell = new THREE.Mesh(
        new THREE.BoxGeometry(5, 1.1, 1.3),
        new THREE.MeshStandardMaterial({ color: 0x0d131c, roughness: 0.45, metalness: 0.85 })
    );
    shell.position.set(0, 0.55, 1.6);
    shell.castShadow = true;
    shell.receiveShadow = true;
    counterGroup.add(shell);

    const trim = new THREE.Mesh(
        new THREE.BoxGeometry(5.1, 0.12, 1.4),
        new THREE.MeshStandardMaterial({ color: 0x0a0f16, emissive: accentHex, emissiveIntensity: 5, roughness: 0.3 })
    );
    trim.position.set(0, 1.16, 1.6);
    counterGroup.add(trim);

    scene.add(counterGroup);

    const inward = position.clone().normalize().negate();
    const center = position.clone().addScaledVector(inward, 1.6);
    const alongZ = Math.abs(inward.z) > 0.5;
    const halfX = alongZ ? 2.55 : 0.7;
    const halfZ = alongZ ? 0.7 : 2.55;

    collisionGrid.insert(new THREE.Box3(
        new THREE.Vector3(center.x - halfX, 0, center.z - halfZ),
        new THREE.Vector3(center.x + halfX, 1.3, center.z + halfZ)
    ));
}

export function createMainHallNpcs(scene: THREE.Scene, collisionGrid: CollisionGrid, rm: ResourceManager): MainHallNpc[] {
    return MAIN_HALL_BUILDINGS.map((building) => {
        const position = npcDoorPosition(building.facing);
        const baseRotation = FACING_ROTATION[building.facing];

        const handle = createNpcModel(rm, BODY_TINTS[building.id], (headPos) =>
            ACCESSORY_BUILDERS[building.id](headPos, building.accentHex)
        );
        handle.group.position.copy(position);
        handle.group.rotation.y = baseRotation;
        handle.group.userData.interactionId = building.id;
        handle.group.add(createNpcNameTag(building.npcName, building.accent));
        scene.add(handle.group);

        if (building.id === "token-vendor") {
            buildCounter(scene, collisionGrid, position, baseRotation, building.accentHex);
        }

        collisionGrid.insert(new THREE.Box3(
            new THREE.Vector3(position.x - 0.5, 0, position.z - 0.5),
            new THREE.Vector3(position.x + 0.5, 2.5, position.z + 0.5)
        ));

        return { handle, baseRotation, time: 0 };
    });
}
