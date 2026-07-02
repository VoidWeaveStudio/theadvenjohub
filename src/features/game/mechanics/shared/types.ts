//src\features\game\mechanics\shared\types.ts
import * as THREE from 'three';

export type MechanicId = 'shooting' | 'building' | 'social' | 'none';

export interface MechanicState {
  activeMechanic: MechanicId;
  enabled: boolean;
}

export interface SafeZoneConfig {
  center: THREE.Vector3;
  radius: number;
}

export interface MechanicContext {
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
  playerModelRef: React.MutableRefObject<THREE.Group | null>;
  soundManagerRef: React.MutableRefObject<any>;
  isChatOpenRef: React.MutableRefObject<boolean>;
  playerPosition: THREE.Vector3;
}