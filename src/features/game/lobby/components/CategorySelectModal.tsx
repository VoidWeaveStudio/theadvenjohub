//src\features\game\lobby\components\CategorySelectModal.tsx
import { GameCategory } from "../types";

interface CategorySelectModalProps {
    onSelect: (category: GameCategory) => void;
    onCancel: () => void;
}

export function CategorySelectModal({ onSelect, onCancel }: CategorySelectModalProps) {
    return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-md z-50">
            <div className="relative bg-gradient-to-br from-zinc-900/95 via-black/95 to-zinc-900/95 border border-cyan-500/30 rounded-2xl p-8 max-w-2xl w-full space-y-6 shadow-2xl">
                <div className="text-center">
                    <h2 className="text-4xl font-black bg-gradient-to-r from-cyan-400 via-white to-purple-400 bg-clip-text text-transparent mb-2">
                        SELECT CATEGORY
                    </h2>
                    <p className="text-zinc-400 text-sm">Choose your game type</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => onSelect('shooter')}
                        className="p-6 bg-gradient-to-br from-red-600/20 to-red-800/20 border-2 border-red-500/50 hover:border-red-400 rounded-xl text-left transition-all group"
                    >
                        <div className="text-4xl mb-3">🔫</div>
                        <div className="text-white text-xl font-black mb-1">Shooter</div>
                        <div className="text-zinc-400 text-sm">Team battles and survival</div>
                    </button>

                    <button
                        onClick={() => onSelect('openworld')}
                        className="p-6 bg-gradient-to-br from-green-600/20 to-green-800/20 border-2 border-green-500/50 hover:border-green-400 rounded-xl text-left transition-all group"
                    >
                        <div className="text-4xl mb-3">🌍</div>
                        <div className="text-white text-xl font-black mb-1">Open World</div>
                        <div className="text-zinc-400 text-sm">Explore and adventure</div>
                    </button>

                    <button
                        onClick={() => onSelect('horror')}
                        className="p-6 bg-gradient-to-br from-purple-600/20 to-purple-800/20 border-2 border-purple-500/50 hover:border-purple-400 rounded-xl text-left transition-all group"
                    >
                        <div className="text-4xl mb-3">👻</div>
                        <div className="text-white text-xl font-black mb-1">Horror</div>
                        <div className="text-zinc-400 text-sm">Survive the nightmare</div>
                    </button>

                    <button
                        onClick={() => onSelect('racing')}
                        className="p-6 bg-gradient-to-br from-yellow-600/20 to-yellow-800/20 border-2 border-yellow-500/50 hover:border-yellow-400 rounded-xl text-left transition-all group"
                    >
                        <div className="text-4xl mb-3">🏎️</div>
                        <div className="text-white text-xl font-black mb-1">Racing</div>
                        <div className="text-zinc-400 text-sm">High-speed competition</div>
                    </button>
                </div>

                <button
                    onClick={onCancel}
                    className="w-full py-2.5 bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-400 hover:text-white rounded-xl transition-all border border-zinc-700/50 font-semibold"
                >
                    Cancel (ESC)
                </button>
            </div>
        </div>
    );
}