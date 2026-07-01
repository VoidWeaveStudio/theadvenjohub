import * as THREE from 'three';

export interface RaycastResult {
  hit: boolean;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
  object: THREE.Object3D | null;
}

interface UseRaycastProps {
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
  sceneRef: React.MutableRefObject<THREE.Scene | null>;
  maxDistance?: number;
}

export function useRaycast({ cameraRef, sceneRef, maxDistance = 100 }: UseRaycastProps) {
  const raycaster = new THREE.Raycaster();

  const cast = (): RaycastResult => {
    const camera = cameraRef.current;
    const scene = sceneRef.current;

    console.log('🎯 Raycast cast called', {
      hasCamera: !!camera,
      hasScene: !!scene,
      maxDistance,
    });

    if (!camera || !scene) {
      return {
        hit: false,
        point: new THREE.Vector3(),
        normal: new THREE.Vector3(0, 1, 0),
        distance: 0,
        object: null,
      };
    }

    raycaster.camera = camera;

    const origin = new THREE.Vector3();
    camera.getWorldPosition(origin);
    
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(camera.quaternion).normalize();

    raycaster.set(origin, direction);
    raycaster.far = maxDistance;

    console.log('📡 Raycaster set:', {
      origin,
      direction,
      far: maxDistance,
    });

    const meshes: THREE.Mesh[] = [];
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && !(obj instanceof THREE.Sprite)) {
        if (obj.name !== 'weapon' && obj.name !== 'muzzlePoint') {
          meshes.push(obj);
        }
      }
    });

    console.log(' Testing', meshes.length, 'meshes');

    try {
      const intersects = raycaster.intersectObjects(meshes, false);
      console.log('✅ Raycast completed, intersects:', intersects.length);

      if (intersects.length > 0) {
        const hit = intersects[0];
        console.log('🎯 Hit!', {
          distance: hit.distance,
          point: hit.point,
          object: hit.object.name,
        });
        return {
          hit: true,
          point: hit.point.clone(),
          normal: hit.face?.normal.clone() || new THREE.Vector3(0, 1, 0),
          distance: hit.distance,
          object: hit.object,
        };
      }
    } catch (error) {
      console.error('❌ Raycast error:', error);
    }

    const farPoint = origin.clone().add(direction.multiplyScalar(maxDistance));
    console.log('❌ No hit, far point:', farPoint);
    return {
      hit: false,
      point: farPoint,
      normal: new THREE.Vector3(0, 1, 0),
      distance: maxDistance,
      object: null,
    };
  };

  return { cast };
}