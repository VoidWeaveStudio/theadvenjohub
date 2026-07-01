//src\features\game\lobby\components\SoonModal.tsx
interface SoonModalProps {
    title: string;
    onClose: () => void;
}

export function SoonModal({ title, onClose }: SoonModalProps) {
    return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-md z-50">
            <div className="relative bg-gradient-to-br from-zinc-900/95 via-black/95 to-zinc-900/95 border border-cyan-500/30 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
                <div className="text-6xl mb-4">🚧</div>
                <h2 className="text-4xl font-black bg-gradient-to-r from-cyan-400 via-white to-purple-400 bg-clip-text text-transparent mb-4">
                    {title}
                </h2>
                <p className="text-zinc-400 text-lg mb-6">Coming Soon!</p>
                <button
                    onClick={onClose}
                    className="w-full py-2.5 bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-400 hover:text-white rounded-xl transition-all border border-zinc-700/50 font-semibold"
                >
                    OK
                </button>
            </div>
        </div>
    );
}