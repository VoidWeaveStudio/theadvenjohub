//src\games\warden-abyss\components\GameArena.tsx
"use client";

interface ArenaProps {
  activeSprite: number;
  onManualClick: () => void;
  balance: number;
  totalEarned: number;
  clickPower: number;
}

export function GameArena({ activeSprite, onManualClick, balance, totalEarned, clickPower }: ArenaProps) {
  const getWardenSprite = () => {
    switch (activeSprite) {
      case 1:
        return "/games/warden-abyss/sprites/warden_attack.png";
      case 2:
        return "/games/warden-abyss/sprites/warden_attack2.png";
      default:
        return "/games/warden-abyss/sprites/warden_idle.png";
    }
  };

  const getBossSprite = () => {
    if (activeSprite !== 0) {
      return Math.random() > 0.5 ? "/games/warden-abyss/sprites/boss_hit1.png" : "/games/warden-abyss/sprites/boss_hit2.png";
    }
    return "/games/warden-abyss/sprites/boss_idle.png";
  };

  return (
    <div 
      className="absolute inset-0 w-full h-full overflow-hidden cursor-pointer select-none" 
      onClick={onManualClick}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.8)_100%)] pointer-events-none z-10" />

      <div className="absolute bottom-0 left-[5%] sm:left-[10%] md:left-[15%] w-[25vw] sm:w-[20vw] md:w-[18vw] max-w-[300px] z-20 transition-transform transform hover:scale-105 active:scale-95">
        <img 
          src={getWardenSprite()} 
          alt="Warden" 
          className="w-full h-auto object-contain drop-shadow-[0_0_20px_rgba(59,130,246,0.4)] pointer-events-none"
          draggable={false}
        />
      </div>

      <div className="absolute bottom-0 right-[5%] sm:right-[10%] md:right-[15%] w-[30vw] sm:w-[25vw] md:w-[22vw] max-w-[350px] z-20 transition-transform transform hover:scale-105 active:scale-95">
        <img 
          src={getBossSprite()} 
          alt="Boss" 
          className="w-full h-auto object-contain drop-shadow-[0_0_20px_rgba(220,38,38,0.4)] pointer-events-none"
          draggable={false}
        />
      </div>

      <div className="absolute top-6 left-6 right-6 flex justify-center gap-4 z-50">
        <div className="bg-black/60 backdrop-blur-md px-6 py-2 rounded-xl border border-zinc-600 shadow-2xl text-center min-w-[120px]">
          <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold mb-1">Баланс</p>
          <p className="text-2xl font-bold text-yellow-500 font-mono">{balance.toLocaleString()}</p>
        </div>

        <div className="bg-black/60 backdrop-blur-md px-6 py-2 rounded-xl border border-zinc-600 shadow-2xl text-center min-w-[120px]">
          <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold mb-1">Всего</p>
          <p className="text-2xl font-bold text-emerald-500 font-mono">{totalEarned.toLocaleString()}</p>
        </div>
      </div>
      
      <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-black/80 px-4 py-1 rounded-full border border-zinc-700 shadow-lg z-50">
        <span className="text-sm text-zinc-300 font-bold">DMG: <span className="text-red-500">+{clickPower}</span></span>
      </div>
    </div>
  );
}