import { useMemo } from 'react';
import * as THREE from 'three';
import { SafeZoneConfig } from './types';

export const SAFE_ZONE_CONFIG: SafeZoneConfig = {
  center: new THREE.Vector3(0, 0, -15),
  radius: 30,
};

export function useSafeZone(playerPosition: THREE.Vector3 | null) {
  return useMemo(() => {
    if (!playerPosition) return { isInSafeZone: false, distance: Infinity };
    const distance = playerPosition.distanceTo(SAFE_ZONE_CONFIG.center);
    return {
      isInSafeZone: distance < SAFE_ZONE_CONFIG.radius,
      distance,
    };
  }, [playerPosition]);
}