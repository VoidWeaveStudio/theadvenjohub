//src\features\game\lobby\components\HealthBar.tsx
"use client";

interface HealthBarProps {
  health: number;
  maxHealth?: number;
}

export function HealthBar({ health, maxHealth = 100 }: HealthBarProps) {
  const percentage = (health / maxHealth) * 100;
  
  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-64 h-4 bg-black/50 rounded-full overflow-hidden border border-white/20 pointer-events-none z-30">
      <div 
        className={`h-full transition-all duration-300 ${
          percentage > 50 ? 'bg-green-500' : 
          percentage > 25 ? 'bg-yellow-500' : 'bg-red-500'
        }`} 
        style={{ width: `${percentage}%` }} 
      />
      <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold drop-shadow-md">
        {health} / {maxHealth}
      </div>
    </div>
  );
}