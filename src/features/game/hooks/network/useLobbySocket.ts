// src/features/game/hooks/network/useLobbySocket.ts

import { useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { unpackPosition, unpackRotation } from '../../utils/network';

export interface LobbyPlayerData {
    id: string;
    username: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
}

export interface QueueStatus {
    count: number;
    max: number;
}

export interface LobbySocketHandlers {
    onLobbyJoined: (data: {
        lobbyId: string;
        players: LobbyPlayerData[];
        queues: Record<string, QueueStatus>;
        queuePosition: number | null;
        queueMode: string | null;
    }) => void;
    onPlayerJoined: (player: LobbyPlayerData) => void;
    onPlayerLeft: (playerId: string) => void;
    onPlayerMoved: (data: {
        id: string;
        position: any;
        rotation: any;
    }) => void;
    onPlayerUsernameChanged: (data: { id: string; username: string }) => void;
    onQueuesStatusUpdate: (queues: Record<string, QueueStatus>) => void;
    onJoinedQueue: (data: { mode: string; position: number }) => void;
    onQueuePositionUpdate: (data: { position: number }) => void;
    onLeftQueue: () => void;
    onGameStarted: (data: { roomId: string; mode: string; players: any[] }) => void;
    onQueueError: (message: string) => void;
}


export function useLobbySocket(
    socket: Socket | null,
    wallet: string,
    username: string,
    handlers: LobbySocketHandlers,
): void {
    useEffect(() => {
        if (!socket) return;

        const handleConnect = () => {
            socket.emit('joinLobby', { wallet, username });
        };

        const handleLobbyJoined = (data: any) => {
            handlers.onLobbyJoined({
                lobbyId: data.lobbyId,
                players: data.players,
                queues: data.queues,
                queuePosition: data.queuePosition,
                queueMode: data.queueMode,
            });
        };

        const handlePlayerJoined = (player: LobbyPlayerData) => {
            handlers.onPlayerJoined(player);
        };

        const handlePlayerLeft = (playerId: string) => {
            handlers.onPlayerLeft(playerId);
        };

        const handlePlayerMoved = (data: any) => {
            handlers.onPlayerMoved({
                id: data.id,
                position: unpackPosition(data.position),
                rotation: unpackRotation(data.rotation), 
            });
        };

        const handleUsernameChanged = (data: { id: string; username: string }) => {
            handlers.onPlayerUsernameChanged(data);
        };

        socket.on('connect', handleConnect);
        socket.on('lobbyJoined', handleLobbyJoined);
        socket.on('playerJoinedLobby', handlePlayerJoined);
        socket.on('playerLeftLobby', handlePlayerLeft);
        socket.on('playerMovedInLobby', handlePlayerMoved);
        socket.on('playerUsernameChanged', handleUsernameChanged);
        socket.on('queuesStatusUpdate', handlers.onQueuesStatusUpdate);
        socket.on('joinedQueue', handlers.onJoinedQueue);
        socket.on('queuePositionUpdate', handlers.onQueuePositionUpdate);
        socket.on('leftQueue', handlers.onLeftQueue);
        socket.on('gameStarted', handlers.onGameStarted);
        socket.on('joinedFFAGame', handlers.onGameStarted);
        socket.on('queueError', handlers.onQueueError);

        return () => {
            socket.off('connect', handleConnect);
            socket.off('lobbyJoined', handleLobbyJoined);
            socket.off('playerJoinedLobby', handlePlayerJoined);
            socket.off('playerLeftLobby', handlePlayerLeft);
            socket.off('playerMovedInLobby', handlePlayerMoved);
            socket.off('playerUsernameChanged', handleUsernameChanged);
            socket.off('queuesStatusUpdate', handlers.onQueuesStatusUpdate);
            socket.off('joinedQueue', handlers.onJoinedQueue);
            socket.off('queuePositionUpdate', handlers.onQueuePositionUpdate);
            socket.off('leftQueue', handlers.onLeftQueue);
            socket.off('gameStarted', handlers.onGameStarted);
            socket.off('joinedFFAGame', handlers.onGameStarted);
            socket.off('queueError', handlers.onQueueError);
        };
    }, [socket, wallet, username, handlers]);
}