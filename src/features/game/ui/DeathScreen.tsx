// src/features/game/ui/DeathScreen.tsx
"use client";

interface DeathScreenProps {
  isVisible: boolean;
  killerName: string | null;
}

export function DeathScreen({ isVisible, killerName }: DeathScreenProps) {
  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 z-[60] pointer-events-none flex items-center justify-center bg-gradient-to-b from-red-950/40 via-black/60 to-black/80 backdrop-blur-sm">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)]" />

      <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-70" />
      <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-70" />

      <div className="relative flex flex-col items-center gap-6 animate-fade-in">
        <div className="text-center">
          <h1 className="text-7xl md:text-8xl font-black text-red-500 tracking-wider drop-shadow-[0_0_20px_rgba(239,68,68,0.8)] animate-pulse">
            YOU DIED
          </h1>
          <div className="mt-2 h-1 w-64 mx-auto bg-gradient-to-r from-transparent via-red-500 to-transparent" />
        </div>

        {killerName && (
          <div className="bg-black/60 backdrop-blur-md border border-red-500/30 rounded-lg px-6 py-3">
            <div className="text-zinc-400 text-sm text-center mb-1">Killed by</div>
            <div className="text-white text-2xl font-bold text-center">
              {killerName}
            </div>
          </div>
        )}

        <div className="flex flex-col items-center gap-3">
          <div className="bg-black/60 backdrop-blur-md border border-red-500/30 rounded-lg px-6 py-3 animate-pulse">
            <span className="text-white text-xl font-bold tracking-widest">
              Press <span className="text-red-400">SPACE</span> to respawn
            </span>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}