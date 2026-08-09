// src/features/game/world/locations/tower/floors/roomConsole.ts
import * as THREE from "three";

export interface RoomConsole {
    group: THREE.Group;
    update: (delta: number) => void;
    dispose: () => void;
}

export function createRoomConsole(accent: THREE.Color): RoomConsole {
    const group = new THREE.Group();
    group.userData.interactionId = "room-console";
    group.userData.interactionRadius = 3;

    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x232a35,
        roughness: 0.45,
        metalness: 0.7,
    });
    const trimMaterial = new THREE.MeshStandardMaterial({
        color: accent.getHex(),
        emissive: accent.getHex(),
        emissiveIntensity: 1.4,
        roughness: 0.35,
        metalness: 0.5,
    });

    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.68, 1.05, 16), bodyMaterial);
    pedestal.position.y = 0.52;
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    group.add(pedestal);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.045, 8, 24), trimMaterial);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 1.02;
    group.add(collar);

    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.06, 0.62), bodyMaterial);
    panel.position.y = 1.12;
    panel.rotation.x = -0.42;
    panel.castShadow = true;
    group.add(panel);

    const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 0.5),
        new THREE.MeshBasicMaterial({
            color: accent.getHex(),
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
        })
    );
    screen.position.set(0, 1.17, 0.02);
    screen.rotation.x = -0.42 - Math.PI / 2;
    group.add(screen);

    const holo = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.17, 1),
        new THREE.MeshBasicMaterial({
            color: accent.getHex(),
            wireframe: true,
            transparent: true,
            opacity: 0.75,
            depthWrite: false,
        })
    );
    holo.position.y = 1.62;
    group.add(holo);

    const light = new THREE.PointLight(accent.getHex(), 2.2, 7, 2);
    light.position.y = 1.5;
    light.castShadow = false;
    group.add(light);

    let time = 0;

    return {
        group,
        update: (delta: number) => {
            time += delta;
            holo.rotation.y += delta * 0.9;
            holo.rotation.x += delta * 0.4;
            holo.position.y = 1.62 + Math.sin(time * 1.6) * 0.05;
            trimMaterial.emissiveIntensity = 1.2 + Math.sin(time * 2.1) * 0.35;
            (screen.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(time * 3) * 0.12;
        },
        dispose: () => {
            group.traverse((child) => {
                const mesh = child as THREE.Mesh;
                if (mesh.isMesh) mesh.geometry.dispose();
            });
            bodyMaterial.dispose();
            trimMaterial.dispose();
            (screen.material as THREE.Material).dispose();
            (holo.material as THREE.Material).dispose();
            group.removeFromParent();
        },
    };
}
