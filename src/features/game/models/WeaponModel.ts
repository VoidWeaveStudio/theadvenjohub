//src\features\game\models\WeaponModel.ts
import * as THREE from 'three';

export class WeaponModel {
    static create(camera: THREE.PerspectiveCamera): THREE.Group {
        const weaponGroup = new THREE.Group();
        weaponGroup.name = 'weapon';

        const bodyGeometry = new THREE.BoxGeometry(0.08, 0.08, 0.6);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2a2a2a, 
            metalness: 0.8,
            roughness: 0.3,
            flatShading: true 
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.set(0, 0, -0.3);
        body.castShadow = true;
        weaponGroup.add(body);

        const barrelGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8);
        const barrelMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x1a1a1a, 
            metalness: 0.9,
            roughness: 0.2,
            flatShading: true 
        });
        const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.02, -0.7);
        barrel.castShadow = true;
        weaponGroup.add(barrel);

        const gripGeometry = new THREE.BoxGeometry(0.06, 0.15, 0.08);
        const gripMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x3a3a3a, 
            metalness: 0.5,
            roughness: 0.6,
            flatShading: true 
        });
        const grip = new THREE.Mesh(gripGeometry, gripMaterial);
        grip.position.set(0, -0.1, -0.2);
        grip.rotation.x = -0.2;
        grip.castShadow = true;
        weaponGroup.add(grip);

        const sightGeometry = new THREE.BoxGeometry(0.03, 0.04, 0.03);
        const sightMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x1a1a1a, 
            metalness: 0.8,
            roughness: 0.3,
            flatShading: true 
        });
        const sight = new THREE.Mesh(sightGeometry, sightMaterial);
        sight.position.set(0, 0.06, -0.4);
        sight.castShadow = true;
        weaponGroup.add(sight);

        const magazineGeometry = new THREE.BoxGeometry(0.05, 0.12, 0.06);
        const magazineMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2a2a2a, 
            metalness: 0.7,
            roughness: 0.4,
            flatShading: true 
        });
        const magazine = new THREE.Mesh(magazineGeometry, magazineMaterial);
        magazine.position.set(0, -0.08, -0.35);
        magazine.castShadow = true;
        weaponGroup.add(magazine);

        const muzzlePoint = new THREE.Object3D();
        muzzlePoint.name = 'muzzlePoint';
        muzzlePoint.position.set(0, 0.02, -0.9); 
        weaponGroup.add(muzzlePoint);

        weaponGroup.position.set(0.25, -0.2, -0.5); 
        weaponGroup.rotation.set(0, 0, 0);

        camera.add(weaponGroup);

        return weaponGroup;
    }

    static getMuzzlePosition(camera: THREE.PerspectiveCamera): { x: number; y: number; z: number } {
        const weapon = camera.getObjectByName('weapon');
        if (!weapon) {
            return {
                x: camera.position.x,
                y: camera.position.y,
                z: camera.position.z
            };
        }

        const muzzlePoint = weapon.getObjectByName('muzzlePoint');
        if (!muzzlePoint) {
            return {
                x: camera.position.x,
                y: camera.position.y,
                z: camera.position.z
            };
        }

        const worldPosition = new THREE.Vector3();
        muzzlePoint.getWorldPosition(worldPosition);

        return {
            x: worldPosition.x,
            y: worldPosition.y,
            z: worldPosition.z
        };
    }

    static animateRecoil(weapon: THREE.Group, deltaTime: number) {
        const body = weapon.children[0] as THREE.Mesh;
        if (body && body.position.z > -0.3) {
            body.position.z -= deltaTime * 2;
        }
    }
}