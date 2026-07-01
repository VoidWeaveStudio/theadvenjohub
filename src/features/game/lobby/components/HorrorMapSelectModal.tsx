//src\features\game\lobby\components\HorrorMapSelectModal.tsx
interface HorrorMapSelectModalProps {
    onSelect: (mapName: string) => void;
    onBack: () => void;
}

const HORROR_MAPS = [
    { id: 'abandoned_hospital', name: 'Abandoned Hospital', description: 'Explore the dark corridors' },
    { id: 'haunted_mansion', name: 'Haunted Mansion', description: 'What lurks inside?' },
    { id: 'dark_forest', name: 'Dark Forest', description: 'Something is watching' },
];

export function HorrorMapSelectModal({ onSelect, onBack }: HorrorMapSelectModalProps) {
    return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-md z-50">
            <div className="relative bg-gradient-to-br from-zinc-900/95 via-black/95 to-zinc-900/95 border border-purple-500/30 rounded-2xl p-8 max-w-md w-full space-y-6 shadow-2xl">
                <div className="text-center">
                    <h2 className="text-4xl font-black bg-gradient-to-r from-purple-400 via-white to-purple-400 bg-clip-text text-transparent mb-2">
                        HORROR MAPS
                    </h2>
                    <p className="text-zinc-400 text-sm">Choose your nightmare</p>
                </div>

                <div className="space-y-3">
                    {HORROR_MAPS.map((map) => (
                        <button
                            key={map.id}
                            onClick={() => onSelect(map.name)}
                            className="w-full p-4 bg-gradient-to-br from-purple-600/20 to-purple-800/20 border-2 border-purple-500/50 hover:border-purple-400 rounded-xl text-left transition-all opacity-60 cursor-not-allowed"
                            disabled
                        >
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-white text-xl font-black">{map.name}</span>
                                <span className="text-zinc-500 text-sm font-mono font-bold">SOON</span>
                            </div>
                            <div className="text-zinc-400 text-sm">{map.description}</div>
                        </button>
                    ))}
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