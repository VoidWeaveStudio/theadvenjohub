//src\features\game\lobby\components\DeathScreen.tsx
"use client";

interface DeathScreenProps {
  visible: boolean;
}

export function DeathScreen({ visible }: DeathScreenProps) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 bg-black/70 flex items-center justify-center flex-col z-50 pointer-events-none">
      <div className="text-red-500 text-6xl font-bold mb-4 drop-shadow-[0_0_10px_rgba(255,0,0,0.5)] animate-pulse">
        YOU DIED
      </div>
      <div className="text-white text-xl">Respawning...</div>
    </div>
  );
}