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
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [isWakingUp, setIsWakingUp] = useState(false);
    const connectionAttemptsRef = useRef(0);
    const maxAttempts = 10;

    const createSocket = () => {
        const serverUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL || 'http://localhost:3001';
        return io(serverUrl, {
            timeout: 60000,
            reconnectionAttempts: maxAttempts,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 5000,
            autoConnect: true,
            transports: ['websocket', 'polling'],
        });
    };

    useEffect(() => {
        if (isAuthLoading) return;

        if (!isAuthorized) {
            setError('Please login to play');
            setLoading(false);
            return;
        }

        if (!socket) {
            const newSocket = createSocket();
            setSocket(newSocket);

            newSocket.on('connect', () => {
                console.log('✅ Connected to TANJO World server');
                setIsConnected(true);
                setConnectionError(null);
                setIsWakingUp(false);
                connectionAttemptsRef.current = 0;
            });

            newSocket.on('connect_error', (err) => {
                console.error('❌ Connection error:', err.message);
                connectionAttemptsRef.current += 1;

                if (connectionAttemptsRef.current === 1) {
                    setIsWakingUp(true);
                    setConnectionError('Server is waking up... Please wait 30-60 seconds');
                } else if (connectionAttemptsRef.current < maxAttempts) {
                    setConnectionError(`Connecting... Attempt ${connectionAttemptsRef.current}/${maxAttempts}`);
                } else {
                    setConnectionError('Failed to connect after multiple attempts.');
                    setIsWakingUp(false);
                }

                setIsConnected(false);
            });

            newSocket.on('disconnect', (reason) => {
                console.log('⚠️ Disconnected:', reason);
                setIsConnected(false);
                if (reason === 'io server disconnect') {
                    setConnectionError('Server disconnected you.');
                }
            });

            newSocket.on('reconnect', (attemptNumber) => {
                console.log(`✅ Reconnected after ${attemptNumber} attempts`);
                setIsConnected(true);
                setConnectionError(null);
                setIsWakingUp(false);
            });

            newSocket.on('reconnect_attempt', () => {
                console.log('🔄 Reconnection attempt...');
                setIsWakingUp(true);
            });
        }

        checkOwnership();

        return () => {
            if (socket) {
                socket.removeAllListeners();
                socket.disconnect();
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

    const handleRetryConnection = () => {
        setConnectionError(null);
        setIsWakingUp(false);
        connectionAttemptsRef.current = 0;

        if (socket) {
            socket.removeAllListeners();
            socket.disconnect();
        }

        const newSocket = createSocket();
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('✅ Connected to TANJO World server');
            setIsConnected(true);
            setConnectionError(null);
            setIsWakingUp(false);
        });

        newSocket.on('connect_error', (err) => {
            console.error('❌ Connection error:', err.message);
            connectionAttemptsRef.current += 1;

            if (connectionAttemptsRef.current === 1) {
                setIsWakingUp(true);
                setConnectionError('Server is waking up... Please wait 30-60 seconds');
            } else if (connectionAttemptsRef.current < maxAttempts) {
                setConnectionError(`Connecting... Attempt ${connectionAttemptsRef.current}/${maxAttempts}`);
            } else {
                setConnectionError('Failed to connect after multiple attempts.');
                setIsWakingUp(false);
            }

            setIsConnected(false);
        });

        newSocket.on('disconnect', (reason) => {
            console.log('⚠️ Disconnected:', reason);
            setIsConnected(false);
        });
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

    if (!isConnected || !socket) {
        return (
            <div className="fixed inset-0 z-50 bg-black flex items-center justify-center" style={{ top: '64px' }}>
                <div className="text-center max-w-md px-4">
                    <div className="relative w-24 h-24 mx-auto mb-8">
                        <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-transparent border-t-cyan-500 rounded-full animate-spin"></div>
                        <div className="absolute inset-2 border-4 border-transparent border-b-purple-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-3 h-3 bg-cyan-500 rounded-full animate-pulse"></div>
                        </div>
                    </div>

                    <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 mb-4">
                        TANJO World
                    </h2>

                    {connectionError ? (
                        <div className="space-y-4">
                            {isWakingUp ? (
                                <div className="space-y-3">
                                    <div className="text-yellow-400 text-sm font-semibold">
                                        ⏳ Server is waking up...
                                    </div>
                                    <div className="text-zinc-400 text-xs">
                                        The server needs 30-60 seconds to start.<br />
                                        Connection attempts are automatic.
                                    </div>
                                    <div className="flex items-center justify-center gap-1 mt-4">
                                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="text-red-400 text-sm">{connectionError}</div>
                                    <button
                                        onClick={handleRetryConnection}
                                        className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors font-semibold"
                                    >
                                        Retry Connection
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="text-zinc-400 text-sm animate-pulse">Connecting to server...</div>
                            <div className="flex items-center justify-center gap-1 mt-4">
                                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 bg-black" style={{ top: '64px' }}>
            <LobbyWorld
                wallet={userWallet || ''}
                username={`Player_${(userWallet || '').substring(0, 4)}`}
                socket={socket}
                onExit={() => router.push(`/games/${slug}`)}
            />
        </div>
    );
}