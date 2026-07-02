// src/features/game/lobby/LobbyWorld.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { Socket } from "socket.io-client";

import { VoiceChat } from "../components/VoiceChat";
import { TextChat } from "../components/TextChat";
import { Reticle } from "../components/Reticle";

import { PlayerModelLoader } from "../models/PlayerModelLoader";
import { PlayerAnimator, ProceduralAnimationData } from "../models/PlayerAnimator";

import { useLobbySocket, LobbyPlayerData } from "../hooks/network/useLobbySocket";
import { useBasePlayerController } from "../hooks/useBasePlayerController";

import { SoundManager } from '../SoundManager';
import { CAMERA_CONFIG } from '../camera/config';

import { useShootingSystem } from '../mechanics/shooting';
import { useBuildingSystem } from '../mechanics/building';
import { useEmoteSystem, EmoteWheel } from '../mechanics/social';
import { useSafeZone } from '../mechanics/shared/useSafeZone';
import { MechanicId } from '../mechanics/shared/types';
import { BuildingPieceType } from '../mechanics/building/types';

import { LobbyUI } from './components/LobbyUI';
import { Hotbar, HotbarItem } from './components/Hotbar';
import { Inventory } from './components/Inventory';
import { GameMenu } from './components/GameMenu';
import { WeaponHUD } from './components/WeaponHUD';
import { HitMarker } from './components/HitMarker';
import { BuildingMenu } from '../mechanics/building/components/BuildingMenu';
import { HealthBar } from './components/HealthBar';
import { DeathScreen } from './components/DeathScreen';

import { updateLobbyAnimations } from './LobbyEnvironment';

import { useLobbyScene } from './hooks/useLobbyScene';
import { useLobbyPlayers } from './hooks/useLobbyPlayers';
import { useLobbyNetwork } from './hooks/useLobbyNetwork';

interface LobbyWorldProps {
    wallet: string;
    username: string;
    socket: Socket | null;
    onExit: () => void;
}

const PORTAL_POSITION = new THREE.Vector3(0, 3, -15);
const PORTAL_INTERACT_RADIUS = 6;

const HOTBAR_ITEMS: HotbarItem[] = [
    { id: 'rifle', name: 'Rifle', icon: '🔫', mechanic: 'shooting' },
    { id: 'blueprint', name: 'Blueprint', icon: '📐', mechanic: 'building' },
];

export function LobbyWorld({ wallet, username, socket, onExit }: LobbyWorldProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const myPlayerModelRef = useRef<THREE.Group | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(0);
    const startTimeRef = useRef<number>(0);
    const isChatOpenRef = useRef(false);
    const soundManagerRef = useRef<SoundManager | null>(null);
    const activeMechanicRef = useRef<MechanicId>('none');
    const isDeadRef = useRef(false);

    const [showBuildingMenu, setShowBuildingMenu] = useState(false);
    const [selectedBuildingType, setSelectedBuildingType] = useState<BuildingPieceType | null>(null);
    const [players, setPlayers] = useState<LobbyPlayerData[]>([]);
    const [isLocked, setIsLocked] = useState(false);
    const [currentUsername, setCurrentUsername] = useState(username);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [lobbyId, setLobbyId] = useState<string | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [myHealth, setMyHealth] = useState(100);
    const [isDead, setIsDead] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
    const [showInventory, setShowInventory] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showEmoteWheel, setShowEmoteWheel] = useState(false);
    const [playerPosition, setPlayerPosition] = useState<THREE.Vector3 | null>(null);
    const [hitKey, setHitKey] = useState(0);

    const {
        sceneRef, cameraRef, rendererRef, collisionSystemRef,
        tracerSystemRef, hitEffectRef, animatablesRef, sceneReady
    } = useLobbyScene(containerRef);

    const {
        playersRef, interpolatorsRef, createOtherPlayerModel,
        removePlayerModel, updatePlayers, clearPlayers
    } = useLobbyPlayers(sceneRef);

    useEffect(() => { isDeadRef.current = isDead; }, [isDead]);

    const handleHotbarSelect = useCallback((index: number) => {
        setSelectedSlot(prev => prev === index ? null : index);
    }, []);

    useEffect(() => {
        if (selectedSlot !== 1) {
            setSelectedBuildingType(null);
            setShowBuildingMenu(false);
        }
    }, [selectedSlot]);

    useEffect(() => { isChatOpenRef.current = isChatOpen; }, [isChatOpen]);

    useEffect(() => {
        soundManagerRef.current = new SoundManager();
        return () => {
            soundManagerRef.current?.dispose();
            soundManagerRef.current = null;
        };
    }, []);

    useEffect(() => {
        let isMounted = true;
        PlayerModelLoader.preload()
            .then(() => { if (isMounted) setModelLoaded(true); })
            .catch(() => {});
        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        if (!modelLoaded || !sceneReady || !sceneRef.current || myPlayerModelRef.current) return;

        const cloned = PlayerModelLoader.getModelClone();
        if (!cloned) return;

        const groundOffset = PlayerModelLoader.getGroundOffset();
        const animator = new PlayerAnimator(cloned);
        cloned.userData.animator = animator;
        cloned.position.set(0, groundOffset, 0);

        sceneRef.current.add(cloned);
        myPlayerModelRef.current = cloned;

        if (cameraRef.current) {
            cameraRef.current.position.set(
                cloned.position.x,
                cloned.position.y + CAMERA_CONFIG.heightOffset,
                cloned.position.z + CAMERA_CONFIG.distance
            );
            cameraRef.current.lookAt(cloned.position);
        }
    }, [modelLoaded, sceneReady, sceneRef, cameraRef]);

    const { isInSafeZone } = useSafeZone(playerPosition);

    const activeMechanic: MechanicId = isInSafeZone
        ? 'social'
        : selectedSlot !== null
            ? HOTBAR_ITEMS[selectedSlot]?.mechanic ?? 'none'
            : 'none';

    useEffect(() => { activeMechanicRef.current = activeMechanic; }, [activeMechanic]);

    const shooting = useShootingSystem({
        cameraRef, playerModelRef: myPlayerModelRef, sceneRef, soundManagerRef,
        isChatOpenRef, modelLoaded, sceneReady, isActive: activeMechanic === 'shooting',
        socket, isInGame: false, onHit: () => setHitKey(prev => prev + 1),
    });

    const building = useBuildingSystem({
        scene: sceneRef.current, sceneRef, cameraRef, playerModelRef: myPlayerModelRef,
        collisionSystem: collisionSystemRef.current, isChatOpenRef, modelLoaded, sceneReady,
        isActive: activeMechanic === 'building' && !showBuildingMenu,
        selectedType: selectedBuildingType, socket, isInGame: false,
    });

    const emotes = useEmoteSystem({ playerModelRef: myPlayerModelRef, socket, isInGame: false });

    const controller = useBasePlayerController({
        containerRef, cameraRef, playerModelRef: myPlayerModelRef, socket, soundManagerRef, isChatOpenRef,
        bounds: { maxRadius: 100, groundLevel: 0 },
        interaction: { position: PORTAL_POSITION, radius: PORTAL_INTERACT_RADIUS, onActivate: () => {} },
        onLockChange: setIsLocked, onExit,
        onChatToggle: (open) => {
            setIsChatOpen(open);
            if (open && document.pointerLockElement) document.exitPointerLock();
        },
        onProceduralDataUpdate: (data: ProceduralAnimationData) => {
            const myModel = myPlayerModelRef.current;
            if (myModel) {
                const animator = myModel.userData.animator as PlayerAnimator | undefined;
                if (animator) animator.update(1 / 60, data);
            }
        },
    });

    const socketHandlers = useLobbyNetwork({
        socket, myPlayerModelRef, cameraRef, sceneRef, tracerSystemRef, hitEffectRef,
        playersRef, interpolatorsRef, buildingManagerRef: building.buildingManagerRef,
        createOtherPlayerModel, removePlayerModel, setLobbyId, setPlayers,
        setMyHealth, setIsDead, setHitKey,
    });

    useLobbySocket(socket, wallet, currentUsername, socketHandlers.current);

    useEffect(() => {
        if (!sceneReady || !rendererRef.current || !cameraRef.current || !sceneRef.current) return;

        startTimeRef.current = performance.now();
        lastTimeRef.current = performance.now();

        const animate = () => {
            animationFrameRef.current = requestAnimationFrame(animate);
            if (!cameraRef.current || !rendererRef.current || !sceneRef.current) return;

            const currentTime = performance.now();
            const deltaTime = Math.min((currentTime - lastTimeRef.current) / 1000, 0.1);
            const elapsedTime = (currentTime - startTimeRef.current) / 1000;
            lastTimeRef.current = currentTime;

            if (!isDeadRef.current) {
                controller.update(deltaTime);
                shooting.update(deltaTime);
                building.update(deltaTime);
            }

            if (myPlayerModelRef.current) {
                setPlayerPosition(myPlayerModelRef.current.position.clone());
            }

            updatePlayers(deltaTime);

            if (animatablesRef.current) {
                updateLobbyAnimations(animatablesRef.current, elapsedTime, 0);
            }

            if (tracerSystemRef.current) tracerSystemRef.current.update(deltaTime);
            if (hitEffectRef.current) hitEffectRef.current.update(deltaTime);

            rendererRef.current.render(sceneRef.current, cameraRef.current);
        };
        animate();

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            clearPlayers();
        };
    }, [sceneReady, rendererRef, cameraRef, sceneRef, animatablesRef, tracerSystemRef, hitEffectRef, controller, shooting, building, updatePlayers, clearPlayers]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat || isDead) return;

            if (e.code === 'Escape') {
                e.preventDefault();
                if (isChatOpen) return;
                if (showBuildingMenu) { setShowBuildingMenu(false); return; }
                if (showEmoteWheel) { setShowEmoteWheel(false); return; }
                if (showInventory) { setShowInventory(false); return; }
                setShowMenu(prev => !prev);
                return;
            }

            if (isChatOpen || showMenu || showInventory || showEmoteWheel || showBuildingMenu) return;

            if (e.code === 'KeyR' && activeMechanicRef.current === 'shooting' && !isInSafeZone) shooting.onReload();
            if (e.code === 'KeyI') setShowInventory(prev => !prev);
            if (e.code === 'KeyB' && !isInSafeZone) setShowEmoteWheel(prev => !prev);
            if (e.code === 'Digit1') handleHotbarSelect(0);
            if (e.code === 'Digit2') handleHotbarSelect(1);
            if (e.code === 'KeyQ' && activeMechanicRef.current === 'building' && !isInSafeZone) setShowBuildingMenu(prev => !prev);
            if (e.code === 'KeyE' && activeMechanicRef.current === 'building' && !isInSafeZone) building.interactWithDoor();
        };

        const handleMouseDown = (e: MouseEvent) => {
            if (isDead || isChatOpen || showMenu || showInventory || showEmoteWheel || showBuildingMenu) return;
            if (!isInSafeZone && activeMechanic === 'shooting' && e.button === 0) shooting.onMouseDown();
            if (!isInSafeZone && activeMechanic === 'building') {
                if (e.button === 0 && selectedBuildingType) building.placePiece();
                if (e.button === 2) building.removePiece();
            }
        };

        const handleMouseUp = (e: MouseEvent) => { if (e.button === 0) shooting.onMouseUp(); };
        const handleContextMenu = (e: MouseEvent) => { if (activeMechanic === 'building') e.preventDefault(); };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('contextmenu', handleContextMenu);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('contextmenu', handleContextMenu);
        };
    }, [isChatOpen, showMenu, showInventory, showEmoteWheel, showBuildingMenu, isInSafeZone, activeMechanic, selectedBuildingType, shooting, building, handleHotbarSelect, isDead]);

    const handleUsernameChange = useCallback((newUsername: string) => {
        setCurrentUsername(newUsername);
        socket?.emit('changeUsername', { username: newUsername });
    }, [socket]);

    return (
        <div className="relative w-full h-full">
            <div ref={containerRef} className="w-full h-full cursor-pointer" />

            <Reticle
                mode="default" size={24} color="#00ffff" opacity={0.6}
                visible={isLocked && !isChatOpen && !showMenu && !showInventory && !showEmoteWheel && !showBuildingMenu && !isDead}
            />

            <LobbyUI username={currentUsername} playersCount={players.length} isInSafeZone={isInSafeZone} activeMechanic={activeMechanic} />

            {!isInSafeZone && !isDead && <HealthBar health={myHealth} />}
            <DeathScreen visible={isDead} />

            {activeMechanic === 'shooting' && !isInSafeZone && !isDead && (
                <WeaponHUD ammo={shooting.ammo.ammoRef.current} maxAmmo={30} isReloading={shooting.ammo.isReloadingRef.current} />
            )}

            <HitMarker hitKey={hitKey} />

            <VoiceChat socket={socket} channelId={lobbyId} myUsername={currentUsername} isChatOpenRef={isChatOpenRef} />
            <TextChat socket={socket} channelId={lobbyId} myUsername={currentUsername} mode="lobby" isOpen={isChatOpen} onToggle={setIsChatOpen} />

            <Hotbar items={HOTBAR_ITEMS} selectedSlot={selectedSlot ?? -1} onSelect={handleHotbarSelect} />

            {showInventory && <Inventory items={HOTBAR_ITEMS} onClose={() => setShowInventory(false)} />}
            {showMenu && <GameMenu username={currentUsername} onUsernameChange={handleUsernameChange} onExit={onExit} onClose={() => setShowMenu(false)} />}
            {showBuildingMenu && (
                <BuildingMenu
                    isOpen={showBuildingMenu}
                    onSelect={(type) => { setSelectedBuildingType(type); setShowBuildingMenu(false); }}
                    onClose={() => setShowBuildingMenu(false)}
                />
            )}
            {showEmoteWheel && isInSafeZone && <EmoteWheel onSelect={(emoteId) => emotes.playEmote(emoteId)} onClose={() => setShowEmoteWheel(false)} />}
        </div>
    );
}