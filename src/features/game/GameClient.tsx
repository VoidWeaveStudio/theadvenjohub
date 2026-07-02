// src/features/game/GameClient.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/core/auth/AuthProvider';
import { apiGet } from '@/core/api/client';
import { LobbyWorld } from './lobby/LobbyWorld';

interface GameClientProps {
    slug: string;
}

interface GameFullData {
    id: string;
    slug: string;
    title: string;
    isOwned: boolean;
}

export function GameClient({ slug }: GameClientProps) {
    const router = useRouter();
    const { isAuthorized, userWallet, isLoading: isAuthLoading } = useAuth();
    const [gameData, setGameData] = useState<GameFullData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (isAuthLoading) return;

        if (!isAuthorized) {
            setError('Please login to play');
            setLoading(false);
            return;
        }

        if (!socketRef.current) {
            const serverUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL || 'http://localhost:3001';
            socketRef.current = io(serverUrl);
        }

        checkOwnership();

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [isAuthorized, isAuthLoading, slug]);

    const checkOwnership = async () => {
        setLoading(true);
        try {
            const data = await apiGet<GameFullData>(`/api/games/${slug}/full`);
            setGameData(data);

            if (!data.isOwned) {
                setError("You don't own this game");
                setTimeout(() => router.push(`/games/${slug}`), 2000);
            }
        } catch (err) {
            console.error('Check ownership error:', err);
            setError('Failed to verify ownership');
        } finally {
            setLoading(false);
        }
    };

    const handleEnterGame = (roomId: string, mode: string, players: any[]) => {
        console.log('Entering game:', roomId, 'mode:', mode, 'players:', players.length);
        alert('Game mode coming soon!');
    };

    const handleExit = () => {
        router.push(`/games/${slug}`);
    };

    if (isAuthLoading || loading) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-8 text-center">
                    <div className="text-white text-xl">
                        {isAuthLoading ? 'Loading authorization...' : 'Loading game...'}
                    </div>
                    <div className="text-zinc-400 text-sm mt-2">
                        {isAuthLoading ? 'Please wait...' : 'Checking ownership...'}
                    </div>
                </div>
            </div>
        );
    }

    if (error || !gameData?.isOwned) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                <div className="bg-zinc-900 border border-red-500/30 rounded-xl p-8 text-center">
                    <div className="text-red-500 text-xl">{error || 'Access denied'}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 bg-black" style={{ top: '64px' }}>
            <LobbyWorld
                wallet={userWallet || ''}
                username={`Player_${(userWallet || '').substring(0, 4)}`}
                socket={socketRef.current}
                onExit={() => router.push(`/games/${slug}`)}
            />
        </div>
    );
}