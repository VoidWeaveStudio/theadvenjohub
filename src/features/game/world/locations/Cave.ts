//src\features\game\world\locations\Cave.ts
import * as THREE from "three";
import { Location } from "../Location";
import { ResourceManager } from "../../core/ResourceManager";

export class Cave extends Location {
    constructor() {
        super("cave", "Dark Cave");
    }

    create(rm: ResourceManager) {
        this.scene.background = new THREE.Color(0x0a0a1a);
        this.scene.fog = new THREE.Fog(0x0a0a1a, 10, 80);

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(100, 100),
            new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 1 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2;
            const rock = new THREE.Mesh(
                new THREE.BoxGeometry(10, 15, 10),
                new THREE.MeshStandardMaterial({ color: 0x2a1a0a })
            );
            rock.position.set(Math.cos(angle) * 45, 7, Math.sin(angle) * 45);
            rock.rotation.y = Math.random() * Math.PI;
            rock.castShadow = true;
            rock.receiveShadow = true;
            this.scene.add(rock);
            this.colliders.push(new THREE.Box3().setFromObject(rock));
        }

        const ceiling = new THREE.Mesh(
            new THREE.CircleGeometry(45, 32),
            new THREE.MeshStandardMaterial({ color: 0x1a0a00, side: THREE.DoubleSide })
        );
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = 15;
        this.scene.add(ceiling);

        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const torch = new THREE.PointLight(0xff6600, 1.5, 20);
            torch.position.set(Math.cos(angle) * 30, 5, Math.sin(angle) * 30);
            this.scene.add(torch);
        }

        const portalGeo = new THREE.TorusGeometry(2, 0.3, 8, 16);
        const portalMat = new THREE.MeshStandardMaterial({
            color: 0x00ffff,
            emissive: 0x00ffff,
            emissiveIntensity: 0.5,
        });
        const portal = new THREE.Mesh(portalGeo, portalMat);
        portal.position.set(0, 2, -40);
        this.scene.add(portal);

        const portalLight = new THREE.PointLight(0x00ffff, 2, 10);
        portalLight.position.set(0, 2, -40);
        this.scene.add(portalLight);

        this.addPortal({
            id: "cave-to-main",
            position: new THREE.Vector3(0, 0, -40),
            radius: 2.5,
            targetLocationId: "main-world",
            targetSpawnPoint: new THREE.Vector3(195, 0, -145),
            mesh: portal,
        });
    }

    getSpawnPoint(): THREE.Vector3 {
        return new THREE.Vector3(0, 0, 0);
    }

    dispose() {
    }
}