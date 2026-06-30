// src/features/game/hooks/network/useSocketConnection.ts
import { useEffect } from 'react';
import { Socket } from 'socket.io-client';

interface UseSocketConnectionProps {
    socket: Socket | null;
    wallet: string;
    roomId: string;
    onJoined?: (data: any) => void;
}

export function useSocketConnection({
    socket,
    wallet,
    roomId,
    onJoined,
}: UseSocketConnectionProps): void {
    useEffect(() => {
        if (!socket) return;

        socket.emit('joinGameRoom', {
            wallet,
            username: `Player_${wallet.substring(0, 4)}`,
            roomId,
        });

        const handleJoined = (data: any) => onJoined?.(data);

        socket.on('joinedGameRoom', handleJoined);
        return () => {
            socket.off('joinedGameRoom', handleJoined);
        };
    }, [socket, wallet, roomId, onJoined]);
}