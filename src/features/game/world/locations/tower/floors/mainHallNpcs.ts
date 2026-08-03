// src/features/game/world/locations/tower/floors/mainHallNpcs.ts
import * as THREE from "three";
import { CollisionGrid } from "../../../CollisionGrid";
import { ResourceManager } from "../../../../core/ResourceManager";
import { createNpcModel, NpcHandle } from "../../../../entities/npcModel";
import { createNpcNameTag } from "../../../../entities/npcNameTag";

export function createVendorNPC(scene: THREE.Scene, collisionGrid: CollisionGrid, rm: ResourceManager): NpcHandle {
    const STALL_Z = -36;

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.85, metalness: 0.05 });
    const clothMat = new THREE.MeshStandardMaterial({ color: 0x7a2f3a, roughness: 0.7, metalness: 0.05 });

    const stallGroup = new THREE.Group();
    stallGroup.position.set(0, 0, STALL_Z);

    const counter = new THREE.Mesh(new THREE.BoxGeometry(4, 1.1, 1.2), woodMat);
    counter.position.set(0, 0.55, 0.6);
    counter.castShadow = true;
    counter.receiveShadow = true;
    stallGroup.add(counter);

    const postGeo = new THREE.CylinderGeometry(0.12, 0.12, 3, 8);
    const postPositions: [number, number][] = [[-1.9, -1.5], [1.9, -1.5], [-1.9, 1.5], [1.9, 1.5]];
    for (const [x, z] of postPositions) {
        const post = new THREE.Mesh(postGeo, woodMat);
        post.position.set(x, 1.5, z);
        post.castShadow = true;
        stallGroup.add(post);
    }

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.15, 3.4), clothMat);
    canopy.position.set(0, 3, 0);
    canopy.castShadow = true;
    stallGroup.add(canopy);

    scene.add(stallGroup);

    const vendorNpc = createNpcModel(rm, 0x7a2f3a, (headPos) => {
        const hat = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.4, 12), woodMat);
        hat.position.set(headPos.x, headPos.y + 0.38, headPos.z);

        const glow = new THREE.PointLight(0xffcc66, 1.5, 6);
        glow.position.set(headPos.x, headPos.y - 0.2, headPos.z + 0.3);

        return [hat, glow];
    });
    vendorNpc.group.position.set(0, 0, STALL_Z - 0.6);
    vendorNpc.group.userData.interactionId = "token-vendor";
    vendorNpc.group.add(createNpcNameTag("Tony", "#ffcc66"));
    scene.add(vendorNpc.group);

    collisionGrid.insert(new THREE.Box3(
        new THREE.Vector3(-2.2, 0, STALL_Z - 1.8),
        new THREE.Vector3(2.2, 3.2, STALL_Z + 1.8)
    ));

    return vendorNpc;
}

export function createSolaNPC(scene: THREE.Scene, collisionGrid: CollisionGrid, rm: ResourceManager): NpcHandle {
    const x = 40;
    const z = 28;

    const solaNpc = createNpcModel(rm, 0x2f6b4a, (headPos) => {
        const hood = new THREE.Mesh(
            new THREE.ConeGeometry(0.34, 0.5, 12),
            new THREE.MeshStandardMaterial({ color: 0x214a35, roughness: 0.8 })
        );
        hood.position.set(headPos.x, headPos.y + 0.3, headPos.z);

        const marker = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.18, 0),
            new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffcc33, emissiveIntensity: 5 })
        );
        marker.position.set(headPos.x, headPos.y + 0.9, headPos.z);

        const glow = new THREE.PointLight(0x66ffb3, 1.4, 6);
        glow.position.set(headPos.x, headPos.y - 0.2, headPos.z + 0.3);

        return [hood, marker, glow];
    });
    solaNpc.group.position.set(x, 0, z);
    solaNpc.group.userData.interactionId = "quest-giver-sola";
    solaNpc.group.add(createNpcNameTag("Sola", "#66ffb3"));
    scene.add(solaNpc.group);

    collisionGrid.insert(new THREE.Box3(
        new THREE.Vector3(x - 0.5, 0, z - 0.5),
        new THREE.Vector3(x + 0.5, 2.5, z + 0.5)
    ));

    return solaNpc;
}

export function createAlfredoNPC(scene: THREE.Scene, collisionGrid: CollisionGrid, rm: ResourceManager): NpcHandle {
    const x = 0;
    const z = 55;

    const alfredoNpc = createNpcModel(rm, 0x1e6091, (headPos) => {
        const beret = new THREE.Mesh(
            new THREE.SphereGeometry(0.26, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
            new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.75 })
        );
        beret.position.set(headPos.x, headPos.y + 0.32, headPos.z);
        beret.rotation.x = Math.PI;

        const palette = new THREE.Mesh(
            new THREE.CircleGeometry(0.16, 16),
            new THREE.MeshStandardMaterial({ color: 0xd9c2a6, roughness: 0.6, side: THREE.DoubleSide })
        );
        palette.position.set(headPos.x + 0.35, headPos.y - 0.1, headPos.z + 0.2);
        palette.rotation.y = Math.PI / 3;

        const marker = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.18, 0),
            new THREE.MeshStandardMaterial({ color: 0xff6b6b, emissive: 0xff3b6b, emissiveIntensity: 5 })
        );
        marker.position.set(headPos.x, headPos.y + 0.9, headPos.z);

        const glow = new THREE.PointLight(0x66ccff, 1.4, 6);
        glow.position.set(headPos.x, headPos.y - 0.2, headPos.z + 0.3);

        return [beret, palette, marker, glow];
    });
    alfredoNpc.group.position.set(x, 0, z);
    alfredoNpc.group.userData.interactionId = "npc-alfredo";
    alfredoNpc.group.add(createNpcNameTag("Alfredo", "#66ccff"));
    scene.add(alfredoNpc.group);

    collisionGrid.insert(new THREE.Box3(
        new THREE.Vector3(x - 0.5, 0, z - 0.5),
        new THREE.Vector3(x + 0.5, 2.5, z + 0.5)
    ));

    return alfredoNpc;
}

export function createFactionBrokerNPC(scene: THREE.Scene, collisionGrid: CollisionGrid, rm: ResourceManager): NpcHandle {
    const x = -40;
    const z = 28;

    const factionBrokerNpc = createNpcModel(rm, 0x8b2fc9, (headPos) => {
        const circlet = new THREE.Mesh(
            new THREE.TorusGeometry(0.22, 0.03, 8, 16),
            new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.4, metalness: 0.8 })
        );
        circlet.rotation.x = Math.PI / 2;
        circlet.position.set(headPos.x, headPos.y + 0.28, headPos.z);

        const marker = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.18, 0),
            new THREE.MeshStandardMaterial({ color: 0xd8a6ff, emissive: 0x8b2fc9, emissiveIntensity: 5 })
        );
        marker.position.set(headPos.x, headPos.y + 0.9, headPos.z);

        const glow = new THREE.PointLight(0xa855f7, 1.4, 6);
        glow.position.set(headPos.x, headPos.y - 0.2, headPos.z + 0.3);

        return [circlet, marker, glow];
    });
    factionBrokerNpc.group.position.set(x, 0, z);
    factionBrokerNpc.group.userData.interactionId = "faction-broker";
    factionBrokerNpc.group.add(createNpcNameTag("Alaric", "#a855f7"));
    scene.add(factionBrokerNpc.group);

    collisionGrid.insert(new THREE.Box3(
        new THREE.Vector3(x - 0.5, 0, z - 0.5),
        new THREE.Vector3(x + 0.5, 2.5, z + 0.5)
    ));

    return factionBrokerNpc;
}
