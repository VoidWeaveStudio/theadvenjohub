//src\features\game\lobby\components\QueueStatusPanel.tsx
interface QueueStatusPanelProps {
    mode: string;
    position: number | null;
    onLeave: () => void;
}

const MODE_NAMES: Record<string, string> = {
    '5v5': '5 vs 5',
    'ffa': 'Survival',
    'battleroyale': 'Battle Royale',
};

export function QueueStatusPanel({ mode, position, onLeave }: QueueStatusPanelProps) {
    return (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-gradient-to-br from-black/90 via-zinc-900/90 to-black/90 backdrop-blur-xl px-8 py-5 rounded-2xl border border-cyan-500/40 shadow-2xl">
            <div className="text-white text-lg font-bold">
                Queue: <span className="text-cyan-400 font-black">{MODE_NAMES[mode] || mode}</span>
            </div>
            <div className="text-zinc-400 text-sm mt-1">
                Position: <span className="text-white font-black text-lg">#{position}</span>
            </div>
            <div className="text-zinc-500 text-xs mt-3 flex items-center gap-2">
                <kbd className="px-2 py-0.5 bg-zinc-700 rounded text-white font-mono border border-zinc-600">Q</kbd>
                <span>to leave queue</span>
            </div>
        </div>
    );
}