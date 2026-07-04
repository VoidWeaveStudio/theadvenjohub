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
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {events.map((event) => (
        <DamageArrow key={event.id} event={event} />
      ))}
    </div>
  );
}

function DamageArrow({ event }: { event: DamageEvent }) {
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setOpacity(0), 1000);
    return () => clearTimeout(timer);
  }, []);

  const rotation = (event.direction * 180) / Math.PI;

  return (
    <div
      className="absolute transition-opacity duration-1000"
      style={{
        opacity,
        transform: `rotate(${rotation}deg) translateY(-80px)`,
      }}
    >
      <div className="flex flex-col items-center">
        <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-b-[24px] border-b-red-500" />
        <div className="text-red-500 font-bold text-sm mt-1 drop-shadow-lg">
          -{event.damage}
        </div>
      </div>
    </div>
  );
}