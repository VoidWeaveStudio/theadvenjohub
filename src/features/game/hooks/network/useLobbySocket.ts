// src/features/game/hooks/network/useLobbySocket.ts
import { useEffect } from 'react';
import { Socket } from 'socket.io-client';

export interface LobbyPlayerData {
    id: string;
    username: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
}

export interface LobbySocketHandlers {
    onLobbyJoined: (data: { lobbyId: string; players: LobbyPlayerData[]; playersCount: number }) => void;
    onPlayerJoined: (player: LobbyPlayerData) => void;
    onPlayerLeft: (playerId: string) => void;
    onPlayerMoved: (data: any) => void;
    onPlayerUsernameChanged: (data: { id: string; username: string }) => void;
    onLobbyPlayersCount: (count: number) => void;
    onPlayerShotInLobby: (data: any) => void;
    onPlayerHitInLobby: (data: any) => void;
    onPlayerHealthChanged: (data: any) => void;
    onPlayerDiedInLobby: (data: any) => void;
    onPlayerRespawnedInLobby: (data: any) => void;
    onPlayerBuildInLobby: (data: any) => void;
    onPlayerEmoteInLobby: (data: any) => void;
    onPositionCorrection: (data: any) => void;
}

export function useLobbySocket(
    socket: Socket | null,
    wallet: string,
    username: string,
    handlers: LobbySocketHandlers,
): void {
    useEffect(() => {
        if (!socket) {
            console.log('⚠️ [Socket] useLobbySocket: No socket provided');
            return;
        }

        console.log('🔧 [Socket] useLobbySocket: Setting up listeners for socket:', socket.id);

        const emitJoinLobby = () => {
            console.log('📨 [Socket] Sending joinLobby...', { wallet: wallet?.substring(0, 8), username });
            socket.emit('joinLobby', { wallet, username });
        };

        const handleConnect = () => {
            console.log('✅ [Socket] Connected, joining lobby...');
            emitJoinLobby();
        };

        const handleLobbyJoined = (data: any) => {
            console.log('🎮 [Socket] lobbyJoined received:', data.lobbyId, 'Players:', data.playersCount);
            handlers.onLobbyJoined({
                lobbyId: data.lobbyId,
                players: data.players,
                playersCount: data.playersCount,
            });
        };

        const handlePlayerJoined = (player: LobbyPlayerData) => {
            console.log('👤 [Socket] playerJoinedLobby:', player.username);
            handlers.onPlayerJoined(player);
        };

        const handlePlayerLeft = (playerId: string) => {
            console.log('👋 [Socket] playerLeftLobby:', playerId);
            handlers.onPlayerLeft(playerId);
        };

        const handlePlayerMoved = (data: any) => {
            handlers.onPlayerMoved(data);
        };

        const handleUsernameChanged = (data: { id: string; username: string }) => {
            handlers.onPlayerUsernameChanged(data);
        };

        const handleLobbyPlayersCount = (count: number) => {
            handlers.onLobbyPlayersCount(count);
        };

        const handlePlayerShotInLobby = (data: any) => {
            handlers.onPlayerShotInLobby(data);
        };

        const handlePlayerHitInLobby = (data: any) => {
            handlers.onPlayerHitInLobby(data);
        };

        const handlePlayerHealthChanged = (data: any) => {
            handlers.onPlayerHealthChanged(data);
        };

        const handlePlayerDiedInLobby = (data: any) => {
            handlers.onPlayerDiedInLobby(data);
        };

        const handlePlayerRespawnedInLobby = (data: any) => {
            handlers.onPlayerRespawnedInLobby(data);
        };

        const handlePlayerBuildInLobby = (data: any) => {
            handlers.onPlayerBuildInLobby(data);
        };

        const handlePlayerEmoteInLobby = (data: any) => {
            handlers.onPlayerEmoteInLobby(data);
        };

        const handlePositionCorrection = (data: any) => {
            handlers.onPositionCorrection(data);
        };

        socket.on('connect', handleConnect);
        socket.on('lobbyJoined', handleLobbyJoined);
        socket.on('playerJoinedLobby', handlePlayerJoined);
        socket.on('playerLeftLobby', handlePlayerLeft);
        socket.on('playerMovedInLobby', handlePlayerMoved);
        socket.on('playerUsernameChanged', handleUsernameChanged);
        socket.on('lobbyPlayersCount', handleLobbyPlayersCount);
        socket.on('playerShotInLobby', handlePlayerShotInLobby);
        socket.on('playerHitInLobby', handlePlayerHitInLobby);
        socket.on('playerHealthChanged', handlePlayerHealthChanged);
        socket.on('playerDiedInLobby', handlePlayerDiedInLobby);
        socket.on('playerRespawnedInLobby', handlePlayerRespawnedInLobby);
        socket.on('playerBuildInLobby', handlePlayerBuildInLobby);
        socket.on('playerEmoteInLobby', handlePlayerEmoteInLobby);
        socket.on('positionCorrection', handlePositionCorrection);

        if (socket.connected) {
            console.log('✅ [Socket] Already connected, joining lobby immediately...');
            emitJoinLobby();
        } else {
            console.log('⏳ [Socket] Not connected yet, waiting for connect event...');
        }

        return () => {
            console.log('🧹 [Socket] Cleaning up listeners');
            socket.off('connect', handleConnect);
            socket.off('lobbyJoined', handleLobbyJoined);
            socket.off('playerJoinedLobby', handlePlayerJoined);
            socket.off('playerLeftLobby', handlePlayerLeft);
            socket.off('playerMovedInLobby', handlePlayerMoved);
            socket.off('playerUsernameChanged', handleUsernameChanged);
            socket.off('lobbyPlayersCount', handleLobbyPlayersCount);
            socket.off('playerShotInLobby', handlePlayerShotInLobby);
            socket.off('playerHitInLobby', handlePlayerHitInLobby);
            socket.off('playerHealthChanged', handlePlayerHealthChanged);
            socket.off('playerDiedInLobby', handlePlayerDiedInLobby);
            socket.off('playerRespawnedInLobby', handlePlayerRespawnedInLobby);
            socket.off('playerBuildInLobby', handlePlayerBuildInLobby);
            socket.off('playerEmoteInLobby', handlePlayerEmoteInLobby);
            socket.off('positionCorrection', handlePositionCorrection);
        };
    }, [socket, wallet, username, handlers]);
}