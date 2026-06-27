//src\features\game\components\GameOverlay.tsx
'use client';

interface GameOverlayProps {
    isLocked: boolean;
    gameStatus: 'waiting' | 'playing' | 'ended';
    playersCount: number;
    maxPlayers: number;
    winner: any;
    mode: '5v5' | 'ffa';
    scores: Record<string | number, number>;
    mySocketId: string | undefined;
    ammo: number;
    isReloading: boolean;
}

export function GameOverlay({
    isLocked,
    gameStatus,
    playersCount,
    maxPlayers,
    winner,
    mode,
    scores,
    mySocketId,
    ammo,
    isReloading
}: GameOverlayProps) {
    return (
        <>
            {ammo === 0 && !isReloading && gameStatus === 'playing' && (
                <div className="absolute bottom-40 left-1/2 -translate-x-1/2 bg-red-900/80 backdrop-blur px-6 py-3 rounded-lg animate-pulse pointer-events-none">
                    <div className="text-red-300 text-lg font-bold">NO AMMO - Press R to Reload</div>
                </div>
            )}

            {isReloading && (
                <div className="absolute bottom-40 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur px-6 py-3 rounded-lg pointer-events-none">
                    <div className="text-white text-lg font-bold">Reloading...</div>
                    <div className="w-full h-2 bg-zinc-700 rounded-full mt-2 overflow-hidden">
                        <div className="h-full bg-yellow-400 animate-[loading_2s_linear]" style={{
                            animation: 'loading 2s linear forwards',
                        }} />
                    </div>
                    <style>{`
                        @keyframes loading {
                            from { width: 0%; }
                            to { width: 100%; }
                        }
                    `}</style>
                </div>
            )}

            {gameStatus === 'waiting' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center bg-black/80 p-8 rounded-lg">
                        <div className="text-white text-3xl font-bold mb-4">Waiting for players...</div>
                        <div className="text-zinc-400 text-lg">
                            {playersCount}/{maxPlayers} players in room
                        </div>
                    </div>
                </div>
            )}

            {gameStatus === 'ended' && winner && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center bg-black/80 p-8 rounded-lg">
                        {mode === '5v5' ? (
                            <>
                                <div className="text-white text-4xl font-bold mb-4">
                                    {winner.team === 1 ? '🔵 Blue Team Wins!' : '🔴 Red Team Wins!'}
                                </div>
                                <div className="text-zinc-400 text-xl mb-4">
                                    Score: {scores[1]} - {scores[2]}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="text-yellow-400 text-4xl font-bold mb-4">
                                    🏆 {winner.username} Wins!
                                </div>
                                <div className="text-zinc-400 text-xl mb-4">
                                    {winner.playerId === mySocketId ? 'YOU ARE #1!' : `${winner.username} got 50 kills`}
                                </div>
                            </>
                        )}
                        <div className="text-zinc-500 text-sm">Returning to lobby...</div>
                    </div>
                </div>
            )}

            {!isLocked && gameStatus === 'playing' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center bg-black/70 p-8 rounded-lg">
                        <div className="text-white text-3xl font-bold mb-4 animate-pulse">Click to Start</div>
                        <div className="text-zinc-400 text-sm">Click anywhere to capture mouse</div>
                    </div>
                </div>
            )}
        </>
    );
}