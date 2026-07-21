//src\features\game\ui\DeathScreen.tsx
"use client";

import { useEffect, useState } from "react";

interface DeathScreenProps {
  isVisible: boolean;
  killerName: string | null;
  respawnTime: number;
}

export function DeathScreen({ isVisible, killerName, respawnTime }: DeathScreenProps) {
  const [timeLeft, setTimeLeft] = useState(respawnTime);

  useEffect(() => {
    if (!isVisible) {
      setTimeLeft(respawnTime);
      return;
    }

    setTimeLeft(respawnTime);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible, respawnTime]);

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
          <div className="text-zinc-400 text-sm uppercase tracking-widest">
            Respawning in
          </div>
          <div className="relative w-24 h-24">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="rgba(63, 63, 70, 0.5)"
                strokeWidth="6"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="rgb(239, 68, 68)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - timeLeft / respawnTime)}`}
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-5xl font-black text-white drop-shadow-lg">
                {timeLeft}
              </span>
            </div>
          </div>
        </div>

        <div className="text-zinc-500 text-xs text-center max-w-sm">
          You will respawn in the safe zone automatically
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