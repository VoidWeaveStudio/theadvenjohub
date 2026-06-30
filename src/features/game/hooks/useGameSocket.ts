// src/features/game/hooks/network/useGameSocket.ts

import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { Player } from '../types';
import { unpackPosition, unpackRotation } from '../utils/network';

interface UseGameSocketProps {
    socket: Socket | null;
    wallet: string;
    roomId: string;
    mode: '5v5' | 'ffa';
    onPlayersUpdate: (players: Player[] | ((prev: Player[]) => Player[])) => void;
    onHealthUpdate: (health: number) => void;
    onKillsUpdate: (kills: number) => void;
    onDeathsUpdate: (deaths: number) => void;
    onScoresUpdate: (scores: any) => void;
    onGameEnd: (winner: any, scores: any) => void;
    onReturnToLobby: () => void;
    onPlayerShot: (shooterId: string, origin: any, direction: any) => void;
    onPlayerHit: (targetId: string, health: number) => void;
    onPlayerKilled: (victimId: string) => void;
    onPlayerRespawned: (id: string, position: any, spawnProtectionUntil?: number) => void;
    onPlayerJoined: (player: Player, index: number) => void;
    onPlayerLeft: (playerId: string) => void;
    onPlayerMoved: (id: string, position: any, rotation: any, serverTime?: number) => void;
    onSpawnPosition: (position: any) => void;
    onPositionCorrection: (position: any, rotation: any, serverTime: number) => void;
    onMatchEndTime?: (endTime: number) => void;
    onSpawnProtectionUpdate?: (until: number) => void;
    onUsernameChanged?: (id: string, username: string) => void;
}

export function useGameSocket({
    socket, wallet, roomId, mode,
    onPlayersUpdate, onHealthUpdate, onKillsUpdate, onDeathsUpdate,
    onScoresUpdate, onGameEnd, onReturnToLobby,
    onPlayerShot, onPlayerHit, onPlayerKilled, onPlayerRespawned,
    onPlayerJoined, onPlayerLeft, onPlayerMoved,
    onSpawnPosition, onPositionCorrection, onMatchEndTime,
    onSpawnProtectionUpdate, onUsernameChanged
}: UseGameSocketProps) {
    const myKillsRef = useRef(0);
    const myDeathsRef = useRef(0);

    useEffect(() => {
        if (!socket) return;

        socket.emit('joinGameRoom', {
            wallet,
            username: `Player_${wallet.substring(0, 4)}`,
            roomId
        });

        const handlePlayerKilled = (data: any) => {
            if (data.killerId === socket.id) {
                myKillsRef.current += 1;
                onKillsUpdate(myKillsRef.current);
            }
            if (data.victimId === socket.id) {
                myDeathsRef.current += 1;
                onDeathsUpdate(myDeathsRef.current);
            }
            if (data.scores) onScoresUpdate(data.scores);

            onPlayersUpdate((prev: Player[]) => prev.map(p => {
                if (p.id === data.killerId) return { ...p, kills: data.killerKills };
                if (p.id === data.victimId) return { ...p, deaths: (p.deaths || 0) + 1 };
                return p;
            }));

            onPlayerKilled(data.victimId);
        };

        const handleJoinedGameRoom = (data: any) => {
            onPlayersUpdate(data.players);
            onHealthUpdate(data.player.health);
            myKillsRef.current = data.player.kills;
            myDeathsRef.current = data.player.deaths;
            onKillsUpdate(data.player.kills);
            onDeathsUpdate(data.player.deaths);
            if (data.scores) onScoresUpdate(data.scores);
            if (data.player.position) onSpawnPosition(unpackPosition(data.player.position)); 
            if (data.matchEndTime && onMatchEndTime) onMatchEndTime(data.matchEndTime);
            
            if (data.player.spawnProtectionUntil && onSpawnProtectionUpdate) {
                onSpawnProtectionUpdate(data.player.spawnProtectionUntil);
            }

            data.players.forEach((player: Player, index: number) => {
                if (player.id !== socket.id) {
                    onPlayerJoined(player, index);
                }
            });
        };

        const handlePlayerJoined = (player: Player) => {
            onPlayersUpdate((prev: Player[]) => [...prev, player]);
            onPlayerJoined(player, 0);
        };

        const handlePlayerLeft = (playerId: string) => {
            onPlayersUpdate((prev: Player[]) => prev.filter((p: Player) => p.id !== playerId));
            onPlayerLeft(playerId);
        };

        const handlePlayerMoved = (data: any) => {
            const pos = unpackPosition(data.position); 
            const rot = unpackRotation(data.rotation);
            onPlayerMoved(data.id, pos, rot, data.serverTime);
        };

        const handlePlayerShot = (data: any) => 
            onPlayerShot(data.shooterId, data.origin, data.direction);

        const handlePlayerHit = (data: any) => {
            if (data.targetId === socket.id) {
                onHealthUpdate(data.health);
            }
            onPlayerHit(data.targetId, data.health);
        };

        const handlePlayerRespawned = (data: any) => {
            const pos = unpackPosition(data.position); 
            onPlayerRespawned(data.id, pos, data.spawnProtectionUntil);
            if (data.id === socket.id) {
                onHealthUpdate(100);
                if (data.spawnProtectionUntil && onSpawnProtectionUpdate) {
                    onSpawnProtectionUpdate(data.spawnProtectionUntil);
                }
            }
        };

        const handleGameEnded = (data: any) => {
            onGameEnd(data.winner, data.scores);
        };

        const handleReturnedToLobby = () => {
            onReturnToLobby();
        };

        const handlePositionCorrection = (data: any) => {
            const pos = unpackPosition(data.position); 
            const rot = unpackRotation(data.rotation);
            onPositionCorrection(pos, rot, data.serverTime || Date.now());
        };

        const handleUsernameChanged = (data: { id: string; username: string }) => {
            onPlayersUpdate((prev: Player[]) => 
                prev.map(p => p.id === data.id ? { ...p, username: data.username } : p)
            );
            onUsernameChanged?.(data.id, data.username);
        };

        socket.on('joinedGameRoom', handleJoinedGameRoom);
        socket.on('playerJoinedGame', handlePlayerJoined);
        socket.on('playerJoinedFFAGame', handlePlayerJoined);
        socket.on('playerLeft', handlePlayerLeft);
        socket.on('playerMoved', handlePlayerMoved);
        socket.on('playerShot', handlePlayerShot);
        socket.on('playerHit', handlePlayerHit);
        socket.on('playerKilled', handlePlayerKilled);
        socket.on('playerRespawned', handlePlayerRespawned);
        socket.on('gameEnded', handleGameEnded);
        socket.on('returnedToLobby', handleReturnedToLobby);
        socket.on('positionCorrection', handlePositionCorrection);
        socket.on('playerUsernameChanged', handleUsernameChanged);

        return () => {
            socket.off('joinedGameRoom', handleJoinedGameRoom);
            socket.off('playerJoinedGame', handlePlayerJoined);
            socket.off('playerJoinedFFAGame', handlePlayerJoined);
            socket.off('playerLeft', handlePlayerLeft);
            socket.off('playerMoved', handlePlayerMoved);
            socket.off('playerShot', handlePlayerShot);
            socket.off('playerHit', handlePlayerHit);
            socket.off('playerKilled', handlePlayerKilled);
            socket.off('playerRespawned', handlePlayerRespawned);
            socket.off('gameEnded', handleGameEnded);
            socket.off('returnedToLobby', handleReturnedToLobby);
            socket.off('positionCorrection', handlePositionCorrection);
            socket.off('playerUsernameChanged', handleUsernameChanged);
        };
    }, [socket, wallet, roomId, mode]);

    return { myKillsRef, myDeathsRef };
}