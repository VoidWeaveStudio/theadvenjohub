import { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { useAmmoSystem } from './useAmmoSystem';
import { useAutoFire } from './useAutoFire';
import { useRaycast } from './useRaycast';
import { WeaponModel } from '../models/WeaponModel';
import { TracerSystem } from '../models/TracerSystem';
import { HitEffect } from '../models/HitEffect';

interface UseShootingSystemProps {
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
  playerModelRef: React.MutableRefObject<THREE.Group | null>;
  sceneRef: React.MutableRefObject<THREE.Scene | null>;
  soundManagerRef: React.MutableRefObject<any>;
  isChatOpenRef: React.MutableRefObject<boolean>;
  modelLoaded: boolean;
  sceneReady: boolean;
  isActive: boolean;
  onAmmoChange?: (ammo: number) => void;
  onReloadChange?: (isReloading: boolean) => void;
  onHit?: () => void;
}

export function useShootingSystem({
  cameraRef,
  playerModelRef,
  sceneRef,
  soundManagerRef,
  isChatOpenRef,
  modelLoaded,
  sceneReady,
  isActive,
  onAmmoChange,
  onReloadChange,
  onHit,
}: UseShootingSystemProps) {
  const ammo = useAmmoSystem(onAmmoChange, onReloadChange);
  const weaponRef = useRef<WeaponModel | null>(null);
  const tracerSystemRef = useRef<TracerSystem | null>(null);
  const hitEffectRef = useRef<HitEffect | null>(null);
  const isShootingRef = useRef(false);
  const [weaponReady, setWeaponReady] = useState(false);

  const { cast } = useRaycast({
    cameraRef,
    sceneRef,
    maxDistance: 100,
  });

  useEffect(() => {
    const player = playerModelRef.current;
    const scene = sceneRef.current;
    
    if (!player || !scene || !modelLoaded || !sceneReady) {
      return;
    }

    if (weaponRef.current) {
      return;
    }

    weaponRef.current = new WeaponModel();
    
    const rightHandBone = findBone(player, 'rightHand');
    if (rightHandBone) {
      weaponRef.current.attachToBone(rightHandBone);
    } else {
      weaponRef.current.attachToPlayer(player);
    }

    tracerSystemRef.current = new TracerSystem(scene);
    hitEffectRef.current = new HitEffect(scene);

    setWeaponReady(true);

    return () => {
      weaponRef.current?.dispose();
      weaponRef.current = null;
      tracerSystemRef.current?.dispose();
      tracerSystemRef.current = null;
      hitEffectRef.current?.dispose();
      hitEffectRef.current = null;
      setWeaponReady(false);
    };
  }, [playerModelRef, sceneRef, modelLoaded, sceneReady]);

  useEffect(() => {
    if (weaponRef.current && weaponReady) {
      weaponRef.current.setVisible(isActive);
    }
  }, [isActive, weaponReady]);

  const performShoot = useCallback(() => {
    if (isChatOpenRef.current) return;
    if (!isActive) return;
    
    if (!ammo.consumeAmmo()) {
      autoFire.stop();
      return;
    }

    const camera = cameraRef.current;
    const player = playerModelRef.current;
    const scene = sceneRef.current;
    if (!camera || !player || !scene) return;

    soundManagerRef.current?.playShoot();

    weaponRef.current?.triggerRecoil();
    isShootingRef.current = true;
    setTimeout(() => {
      isShootingRef.current = false;
    }, 100);

    scene.updateMatrixWorld(true);

    const result = cast();

    const muzzlePos = weaponRef.current?.getMuzzleWorldPosition() || new THREE.Vector3();
    tracerSystemRef.current?.createTracer(muzzlePos, result.point);

    if (result.hit) {
      hitEffectRef.current?.createHitEffect(result.point, result.normal);
      onHit?.();
    }
  }, [ammo, cast, cameraRef, playerModelRef, sceneRef, soundManagerRef, isChatOpenRef, onHit, isActive]);

  const autoFire = useAutoFire(performShoot);

  const onMouseDown = useCallback(() => {
    if (isChatOpenRef.current) return;
    if (!isActive) return;
    autoFire.start();
  }, [autoFire, isChatOpenRef, isActive]);

  const onMouseUp = useCallback(() => {
    autoFire.stop();
  }, [autoFire]);

  const onReload = useCallback(() => {
    if (isChatOpenRef.current) return;
    if (!isActive) return;
    ammo.reload();
  }, [ammo, isChatOpenRef, isActive]);

  const update = useCallback((deltaTime: number) => {
    weaponRef.current?.update(deltaTime, isShootingRef.current);
    tracerSystemRef.current?.update(deltaTime);
    hitEffectRef.current?.update(deltaTime);
  }, []);

  return {
    ammo,
    autoFire,
    onMouseDown,
    onMouseUp,
    onReload,
    update,
    weaponRef,
    weaponReady,
  };
}

function findBone(root: THREE.Object3D, boneName: string): THREE.Bone | null {
  let found: THREE.Bone | null = null;
  
  root.traverse((child) => {
    if (found) return;
    if (child instanceof THREE.Bone && child.name.toLowerCase().includes(boneName.toLowerCase())) {
      found = child;
    }
  });
  
  return found;
}