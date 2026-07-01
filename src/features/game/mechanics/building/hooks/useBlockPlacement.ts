import * as THREE from 'three';
import { BuildingPieceType } from '../types';
import { PIECE_CONFIGS } from '../config';

interface UseBlockPlacementProps {
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
  sceneRef: React.MutableRefObject<THREE.Scene | null>;
  maxDistance: number;
}

export function useBlockPlacement({ cameraRef, sceneRef, maxDistance }: UseBlockPlacementProps) {
  const raycaster = new THREE.Raycaster();

  const getPlacementPosition = (
    pieceType: BuildingPieceType,
    existingPieceIds: string[] = []
  ): { position: THREE.Vector3; rotation: number; isValid: boolean } | null => {
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    if (!camera || !scene) return null;

    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    const objectsToTest = scene.children.filter(child => {
      if (!child.name.startsWith('piece_')) return true;
      return !existingPieceIds.some(id => child.name === `piece_${id}`);
    });

    const intersects = raycaster.intersectObjects(objectsToTest, true);

    const config = PIECE_CONFIGS[pieceType];
    const rotation = camera.rotation.y;

    if (intersects.length > 0 && intersects[0].distance < maxDistance) {
      const hit = intersects[0];
      const position = hit.point.clone();

      if (pieceType === 'floor') {
        position.y = Math.round(position.y);
      } else {
        position.y = 0;
      }

      const gridSize = 1;
      position.x = Math.round(position.x / gridSize) * gridSize;
      position.z = Math.round(position.z / gridSize) * gridSize;

      const snappedRotation = Math.round(rotation / (Math.PI / 2)) * (Math.PI / 2);

      return {
        position,
        rotation: snappedRotation,
        isValid: true,
      };
    }

    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(camera.quaternion);
    
    const position = camera.position.clone().add(direction.multiplyScalar(Math.min(maxDistance, 5)));
    position.y = pieceType === 'floor' ? Math.round(position.y) : 0;
    
    const gridSize = 1;
    position.x = Math.round(position.x / gridSize) * gridSize;
    position.z = Math.round(position.z / gridSize) * gridSize;

    const snappedRotation = Math.round(rotation / (Math.PI / 2)) * (Math.PI / 2);

    return {
      position,
      rotation: snappedRotation,
      isValid: intersects.length === 0 || intersects[0].distance >= maxDistance,
    };
  };

  return { getPlacementPosition };
}