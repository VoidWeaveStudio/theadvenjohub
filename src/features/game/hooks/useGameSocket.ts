//src\features\game\hooks\useGameSocket.ts
import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { Player } from '../types';

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
    onPlayerShot: (origin: any, direction: any) => void;
    onPlayerHit: (targetId: string, health: number) => void;
    onPlayerRespawned: (id: string, position: any) => void;
    onPlayerJoined: (player: Player, index: number) => void;
    onPlayerLeft: (playerId: string) => void;
    onPlayerMoved: (id: string, position: any, rotation: any) => void;
    onSpawnPosition: (position: any) => void;
    onPositionCorrection: (position: any, rotation: any) => void;
}

export function useGameSocket({
    socket,
    wallet,
    roomId,
    mode,
    onPlayersUpdate,
    onHealthUpdate,
    onKillsUpdate,
    onDeathsUpdate,
    onScoresUpdate,
    onGameEnd,
    onReturnToLobby,
    onPlayerShot,
    onPlayerHit,
    onPlayerRespawned,
    onPlayerJoined,
    onPlayerLeft,
    onPlayerMoved,
    onSpawnPosition,
    onPositionCorrection
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

        const handleJoinedGameRoom = (data: any) => {
            onPlayersUpdate(data.players);
            onHealthUpdate(data.player.health);
            myKillsRef.current = data.player.kills;
            myDeathsRef.current = data.player.deaths;
            onKillsUpdate(data.player.kills);
            onDeathsUpdate(data.player.deaths);
            if (data.scores) onScoresUpdate(data.scores);
            if (data.player.position) onSpawnPosition(data.player.position);

            data.players.forEach((player: Player, index: number) => {
                if (player.id !== socket.id) onPlayerJoined(player, index);
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

        const handlePlayerMoved = (data: any) => onPlayerMoved(data.id, data.position, data.rotation);
        const handlePlayerShot = (data: any) => onPlayerShot(data.origin, data.direction);

        const handlePlayerHit = (data: any) => {
            if (data.targetId === socket.id) {
                onHealthUpdate(data.health);
                onPlayerHit(data.targetId, data.health);
            } else {
                onPlayerHit(data.targetId, data.health);
            }
        };

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
        };

        const handlePlayerRespawned = (data: any) => {
            onPlayerRespawned(data.id, data.position);
            if (data.id === socket.id) onHealthUpdate(100);
        };

        const handleGameEnded = (data: any) => {
            onGameEnd(data.winner, data.scores);
        };

        const handleReturnedToLobby = () => {
            onReturnToLobby();
        };

        const handlePositionCorrection = (data: any) => {
            onPositionCorrection(data.position, data.rotation);
        };

        socket.on('joinedGameRoom', handleJoinedGameRoom);
        socket.on('playerJoinedGame', handlePlayerJoined);
        socket.on('playerLeft', handlePlayerLeft);
        socket.on('playerMoved', handlePlayerMoved);
        socket.on('playerShot', handlePlayerShot);
        socket.on('playerHit', handlePlayerHit);
        socket.on('playerKilled', handlePlayerKilled);
        socket.on('playerRespawned', handlePlayerRespawned);
        socket.on('gameEnded', handleGameEnded);
        socket.on('returnedToLobby', handleReturnedToLobby);
        socket.on('positionCorrection', handlePositionCorrection);

        return () => {
            socket.off('joinedGameRoom', handleJoinedGameRoom);
            socket.off('playerJoinedGame', handlePlayerJoined);
            socket.off('playerLeft', handlePlayerLeft);
            socket.off('playerMoved', handlePlayerMoved);
            socket.off('playerShot', handlePlayerShot);
            socket.off('playerHit', handlePlayerHit);
            socket.off('playerKilled', handlePlayerKilled);
            socket.off('playerRespawned', handlePlayerRespawned);
            socket.off('gameEnded', handleGameEnded);
            socket.off('returnedToLobby', handleReturnedToLobby);
            socket.off('positionCorrection', handlePositionCorrection);
        };
    }, [socket, wallet, roomId, mode]);

    return { myKillsRef, myDeathsRef };
}