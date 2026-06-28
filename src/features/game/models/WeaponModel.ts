//src\features\game\models\WeaponModel.ts
import * as THREE from 'three';

export class WeaponModel {
    static createForPlayer(playerModel: THREE.Group): THREE.Group {
        const weaponGroup = new THREE.Group();
        weaponGroup.name = 'weapon';

        const bodyGeometry = new THREE.BoxGeometry(0.08, 0.08, 0.6);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a2a2a, metalness: 0.8, roughness: 0.3, flatShading: true
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        weaponGroup.add(body);

        const barrelGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8);
        const barrelMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a, metalness: 0.9, roughness: 0.2, flatShading: true
        });
        const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.z = -0.4;
        barrel.castShadow = true;
        weaponGroup.add(barrel);

        const gripGeometry = new THREE.BoxGeometry(0.06, 0.15, 0.08);
        const gripMaterial = new THREE.MeshStandardMaterial({
            color: 0x3a3a3a, metalness: 0.5, roughness: 0.6, flatShading: true
        });
        const grip = new THREE.Mesh(gripGeometry, gripMaterial);
        grip.position.set(0, -0.1, 0.1);
        grip.rotation.x = -0.2;
        grip.castShadow = true;
        weaponGroup.add(grip);

        const muzzlePoint = new THREE.Object3D();
        muzzlePoint.name = 'muzzlePoint';
        muzzlePoint.position.set(0, 0, -0.6);
        weaponGroup.add(muzzlePoint);

        weaponGroup.position.set(0.3, 1.3, -0.5);
        weaponGroup.rotation.set(0, 0, 0);

        playerModel.add(weaponGroup);

        return weaponGroup;
    }

    static getMuzzlePosition(playerModel: THREE.Group | null): { x: number; y: number; z: number } {
        if (!playerModel) {
            return { x: 0, y: 1.6, z: 0 };
        }

        const muzzle = playerModel.getObjectByName('muzzlePoint');
        if (muzzle) {
            const worldPos = new THREE.Vector3();
            muzzle.getWorldPosition(worldPos);
            return { x: worldPos.x, y: worldPos.y, z: worldPos.z };
        }

        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerModel.rotation.y);

        return {
            x: playerModel.position.x + forward.x * 0.8,
            y: playerModel.position.y + 1.3,
            z: playerModel.position.z + forward.z * 0.8
        };
    }

    static animateRecoil(weapon: THREE.Group, deltaTime: number) {
        const body = weapon.children[0] as THREE.Mesh;
        if (body && body.position.z > -0.3) {
            body.position.z -= deltaTime * 2;
        }
    }
}