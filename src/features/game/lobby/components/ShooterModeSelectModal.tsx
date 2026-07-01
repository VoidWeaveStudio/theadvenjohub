//src\features\game\lobby\components\ShooterModeSelectModal.tsx
import { ShooterMode, Queues } from "../types";

interface ShooterModeSelectModalProps {
    queues: Queues;
    onSelect: (mode: ShooterMode) => void;
    onBack: () => void;
}

export function ShooterModeSelectModal({ queues, onSelect, onBack }: ShooterModeSelectModalProps) {
    return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-md z-50">
            <div className="relative bg-gradient-to-br from-zinc-900/95 via-black/95 to-zinc-900/95 border border-red-500/30 rounded-2xl p-8 max-w-md w-full space-y-6 shadow-2xl">
                <div className="text-center">
                    <h2 className="text-4xl font-black bg-gradient-to-r from-red-400 via-white to-red-400 bg-clip-text text-transparent mb-2">
                        SHOOTER MODE
                    </h2>
                    <p className="text-zinc-400 text-sm">Choose your battle style</p>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={() => onSelect('5v5')}
                        className="w-full p-4 bg-gradient-to-br from-blue-600/20 to-blue-800/20 border-2 border-blue-500/50 hover:border-blue-400 rounded-xl text-left transition-all"
                    >
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-white text-xl font-black">5 vs 5</span>
                            <span className="text-cyan-400 text-sm font-mono font-bold">
                                {queues['5v5'].count}/{queues['5v5'].max}
                            </span>
                        </div>
                        <div className="text-zinc-300 text-sm font-semibold">Team Deathmatch</div>
                        <div className="text-zinc-500 text-xs mt-1">10 players • 50 kills to win • 10 min</div>
                    </button>

                    <button
                        onClick={() => onSelect('survival')}
                        className="w-full p-4 bg-gradient-to-br from-red-600/20 to-red-800/20 border-2 border-red-500/50 hover:border-red-400 rounded-xl text-left transition-all"
                    >
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-white text-xl font-black">Survival</span>
                            <span className="text-cyan-400 text-sm font-mono font-bold">
                                {queues['ffa'].count}/{queues['ffa'].max}
                            </span>
                        </div>
                        <div className="text-zinc-300 text-sm font-semibold">Free-for-All</div>
                        <div className="text-zinc-500 text-xs mt-1">20 players • 50 kills to win • 10 min</div>
                    </button>

                    <button
                        onClick={() => onSelect('battleroyale')}
                        className="w-full p-4 bg-gradient-to-br from-purple-600/20 to-purple-800/20 border-2 border-purple-500/50 hover:border-purple-400 rounded-xl text-left transition-all opacity-60 cursor-not-allowed"
                        disabled
                    >
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-white text-xl font-black">Battle Royale</span>
                            <span className="text-zinc-500 text-sm font-mono font-bold">SOON</span>
                        </div>
                        <div className="text-zinc-400 text-sm font-semibold">100 players • Last one standing</div>
                    </button>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={onBack}
                        className="flex-1 py-2.5 bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-400 hover:text-white rounded-xl transition-all border border-zinc-700/50 font-semibold"
                    >
                        ← Back
                    </button>
                    <button
                        onClick={onBack}
                        className="flex-1 py-2.5 bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-400 hover:text-white rounded-xl transition-all border border-zinc-700/50 font-semibold"
                    >
                        Cancel (ESC)
                    </button>
                </div>
            </div>
        </div>
    );
}