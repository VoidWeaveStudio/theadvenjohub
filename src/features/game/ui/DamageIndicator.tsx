//src\features\game\ui\DamageIndicator.tsx
"use client";

import { useEffect, useState } from "react";

export interface DamageEvent {
  id: number;
  direction: number;
  damage: number;
  timestamp: number;
}

interface DamageIndicatorProps {
  events: DamageEvent[];
}

export function DamageIndicator({ events }: DamageIndicatorProps) {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-40">
      {events.map((event) => (
        <DamageArrow key={event.id} event={event} />
      ))}
    </div>
  );
}

function DamageArrow({ event }: { event: DamageEvent }) {
  const [opacity, setOpacity] = useState(1);
  const [offsetY, setOffsetY] = useState(0);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setOpacity(0), 1500);
    const floatTimer = setTimeout(() => setOffsetY(-20), 50);
    
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(floatTimer);
    };
  }, []);

  const rotation = (event.direction * 180) / Math.PI;

  return (
    <div
      className="absolute transition-all duration-1500 ease-out"
      style={{
        opacity,
        transform: `rotate(${rotation}deg) translateY(${-80 + offsetY}px)`,
      }}
    >
      <div className="flex flex-col items-center">
        <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-b-[24px] border-b-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
        <div className="text-red-500 font-bold text-lg mt-1 drop-shadow-[0_0_4px_rgba(0,0,0,0.8)]">
          -{event.damage}
        </div>
      </div>
    </div>
  );
}