import { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { BuildingManager } from '../models/BuildingManager';
import { BuildingPreview } from '../models/BuildingPreview';
import { BuildingPiece } from '../pieces/BuildingPiece';
import { DoorPiece } from '../pieces/DoorPiece';
import { useBlockPlacement } from './useBlockPlacement';
import { BUILDING_CONFIG } from '../config';
import { BuildingPieceType } from '../types';
import { CollisionSystem } from '../../../map/CollisionSystem';

interface UseBuildingSystemProps {
  scene: THREE.Scene | null;
  sceneRef: React.MutableRefObject<THREE.Scene | null>;
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
  playerModelRef: React.MutableRefObject<THREE.Group | null>;
  collisionSystem: CollisionSystem | null;
  isChatOpenRef: React.MutableRefObject<boolean>;
  modelLoaded: boolean;
  sceneReady: boolean;
  isActive: boolean;
  selectedType: BuildingPieceType | null;
}

export function useBuildingSystem({
  scene,
  sceneRef,
  cameraRef,
  playerModelRef,
  collisionSystem,
  isChatOpenRef,
  modelLoaded,
  sceneReady,
  isActive,
  selectedType,
}: UseBuildingSystemProps) {
  const buildingManagerRef = useRef<BuildingManager | null>(null);
  const previewRef = useRef<BuildingPreview | null>(null);
  const [buildingReady, setBuildingReady] = useState(false);
  const [pieceCount, setPieceCount] = useState(0);

  useEffect(() => {
    const sceneObj = sceneRef.current;
    
    if (!sceneObj || !collisionSystem || !modelLoaded || !sceneReady) {
      return;
    }

    if (buildingManagerRef.current) {
      return;
    }

    buildingManagerRef.current = new BuildingManager(sceneObj, collisionSystem);
    previewRef.current = new BuildingPreview(sceneObj, buildingManagerRef.current);

    setBuildingReady(true);

    return () => {
      buildingManagerRef.current?.dispose();
      buildingManagerRef.current = null;
      previewRef.current?.dispose();
      previewRef.current = null;
      setBuildingReady(false);
    };
  }, [sceneRef, collisionSystem, modelLoaded, sceneReady]);

  const { getPlacementPosition } = useBlockPlacement({
    cameraRef,
    sceneRef,
    maxDistance: BUILDING_CONFIG.placeDistance,
  });

  const updatePreview = useCallback(() => {
    if (!previewRef.current || !buildingManagerRef.current || !selectedType || !isActive) {
      if (previewRef.current) {
        previewRef.current.hide();
      }
      return;
    }

    previewRef.current.show(selectedType);

    const existingIds = buildingManagerRef.current.getAllPieces().map(p => p.id);
    const placement = getPlacementPosition(selectedType, existingIds);

    if (placement) {
      previewRef.current.updatePosition(
        placement.position.x,
        placement.position.y,
        placement.position.z,
        placement.rotation
      );
      previewRef.current.setValid(placement.isValid);
    }
  }, [selectedType, isActive, getPlacementPosition]);

  const placePiece = useCallback((): boolean => {
    if (isChatOpenRef.current) return false;
    if (!isActive) return false;
    if (!selectedType) return false;
    if (!buildingManagerRef.current) return false;
    if (pieceCount >= BUILDING_CONFIG.maxPieces) return false;

    const existingIds = buildingManagerRef.current.getAllPieces().map(p => p.id);
    const placement = getPlacementPosition(selectedType, existingIds);

    if (!placement || !placement.isValid) return false;

    const piece = buildingManagerRef.current.createPiece(selectedType);
    buildingManagerRef.current.placePiece(
      piece,
      placement.position.x,
      placement.position.y,
      placement.position.z,
      placement.rotation
    );

    setPieceCount(buildingManagerRef.current.getPieceCount());
    return true;
  }, [selectedType, pieceCount, getPlacementPosition, isChatOpenRef, isActive]);

  const removePiece = useCallback((): boolean => {
    if (isChatOpenRef.current) return false;
    if (!isActive) return false;
    if (!buildingManagerRef.current || !cameraRef.current) return false;

    const camera = cameraRef.current;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    const pieces = buildingManagerRef.current.getAllPieces();
    const meshes = pieces.map(p => p.group);
    const intersects = raycaster.intersectObjects(meshes, true);

    if (intersects.length > 0) {
      let target = intersects[0].object;
      while (target.parent && !target.name.startsWith('piece_')) {
        target = target.parent;
      }

      if (target.name.startsWith('piece_')) {
        const id = target.name.replace('piece_', '');
        if (buildingManagerRef.current.removePiece(id)) {
          setPieceCount(buildingManagerRef.current.getPieceCount());
          return true;
        }
      }
    }

    return false;
  }, [cameraRef, isChatOpenRef, isActive]);

  const interactWithDoor = useCallback((): boolean => {
    if (isChatOpenRef.current) return false;
    if (!buildingManagerRef.current || !playerModelRef.current) return false;

    const playerPos = playerModelRef.current.position;
    const door = buildingManagerRef.current.findNearestDoor(playerPos, 2);

    if (door) {
      door.toggle();
      return true;
    }

    return false;
  }, [playerModelRef, isChatOpenRef]);

  const update = useCallback((deltaTime: number) => {
    buildingManagerRef.current?.update(deltaTime);
    updatePreview();
  }, [updatePreview]);

  return {
    placePiece,
    removePiece,
    interactWithDoor,
    update,
    buildingManagerRef,
    previewRef,
    buildingReady,
    pieceCount,
    maxPieces: BUILDING_CONFIG.maxPieces,
  };
}