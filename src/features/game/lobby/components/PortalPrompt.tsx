//src\features\game\lobby\components\PortalPrompt.tsx
export function PortalPrompt() {
    return (
        <div className="absolute bottom-40 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-600/90 via-blue-600/90 to-purple-600/90 backdrop-blur-xl px-8 py-4 rounded-2xl border border-cyan-400/50 shadow-2xl animate-pulse">
            <div className="text-white text-lg font-black flex items-center gap-3">
                <span className="text-3xl">🌀</span>
                <div>
                    <div className="text-xs text-cyan-200 uppercase tracking-wider">Ready to play?</div>
                    <div>
                        Press <kbd className="px-2 py-0.5 bg-black/30 rounded text-white font-mono mx-1 border border-white/20">E</kbd> to select game mode
                    </div>
                </div>
            </div>
        </div>
    );
}