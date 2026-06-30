// src/features/game/hooks/network/useGameEvents.ts
import { useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { Player } from '../../types';

export interface GameEventHandlers {
    onPlayersUpdate: (updater: (prev: Player[]) => Player[]) => void;
    onHealthUpdate: (health: number) => void;
    onKillsUpdate: (kills: number) => void;
    onDeathsUpdate: (deaths: number) => void;
    onScoresUpdate: (scores: any) => void;
    onGameEnd: (winner: any, scores: any) => void;
    onPlayerShot: (shooterId: string, origin: any, direction: any) => void;
    onPlayerHit: (targetId: string, health: number) => void;
    onPlayerKilled: (victimId: string) => void;
    onPlayerRespawned: (id: string, position: any, spawnProtectionUntil?: number) => void;
    onPlayerMoved: (id: string, position: any, rotation: any, serverTime?: number) => void;
    onPositionCorrection: (position: any, rotation: any, serverTime: number) => void;
}

function unpackPosition(pos: any): { x: number; y: number; z: number } {
    return Array.isArray(pos) ? { x: pos[0], y: pos[1], z: pos[2] } : pos;
}

export function useGameEvents(
    socket: Socket | null,
    handlers: GameEventHandlers,
): void {
    useEffect(() => {
        if (!socket) return;

        const handlePlayerKilled = (data: any) => {
            if (data.killerId === socket.id) handlers.onKillsUpdate(data.killerKills);
            if (data.victimId === socket.id) handlers.onDeathsUpdate(data.deaths ?? 0);
            if (data.scores) handlers.onScoresUpdate(data.scores);

            handlers.onPlayersUpdate((prev) =>
                prev.map((p) => {
                    if (p.id === data.killerId) return { ...p, kills: data.killerKills };
                    if (p.id === data.victimId) return { ...p, deaths: (p.deaths || 0) + 1 };
                    return p;
                }),
            );
            handlers.onPlayerKilled(data.victimId);
        };

        const handlePlayerMoved = (data: any) => {
            handlers.onPlayerMoved(
                data.id,
                unpackPosition(data.position),
                unpackPosition(data.rotation),
                data.serverTime,
            );
        };

        const handlePlayerHit = (data: any) => {
            if (data.targetId === socket.id) handlers.onHealthUpdate(data.health);
            handlers.onPlayerHit(data.targetId, data.health);
        };

        const handlePlayerRespawned = (data: any) => {
            const pos = unpackPosition(data.position);
            handlers.onPlayerRespawned(data.id, pos, data.spawnProtectionUntil);
            if (data.id === socket.id) handlers.onHealthUpdate(100);
        };

        const handlePositionCorrection = (data: any) => {
            handlers.onPositionCorrection(
                unpackPosition(data.position),
                unpackPosition(data.rotation),
                data.serverTime || Date.now(),
            );
        };

        socket.on('playerKilled', handlePlayerKilled);
        socket.on('playerMoved', handlePlayerMoved);
        socket.on('playerShot', (d: any) => handlers.onPlayerShot(d.shooterId, d.origin, d.direction));
        socket.on('playerHit', handlePlayerHit);
        socket.on('playerRespawned', handlePlayerRespawned);
        socket.on('gameEnded', (d: any) => handlers.onGameEnd(d.winner, d.scores));
        socket.on('positionCorrection', handlePositionCorrection);

        return () => {
            socket.off('playerKilled', handlePlayerKilled);
            socket.off('playerMoved', handlePlayerMoved);
            socket.off('playerShot');
            socket.off('playerHit', handlePlayerHit);
            socket.off('playerRespawned', handlePlayerRespawned);
            socket.off('gameEnded');
            socket.off('positionCorrection', handlePositionCorrection);
        };
    }, [socket, handlers]);
}