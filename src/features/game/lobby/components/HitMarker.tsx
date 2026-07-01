//src\features\game\lobby\components\HitMarker.tsx
"use client";

import { useEffect, useState } from 'react';

interface HitMarkerProps {
  hitKey: number; 
}

export function HitMarker({ hitKey }: HitMarkerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (hitKey === 0) return;
    
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 150);
    return () => clearTimeout(timer);
  }, [hitKey]);

  if (!visible) return null;

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-40">
      <svg 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        className="animate-[hitMarkerPop_0.2s_ease-out]"
      >
        <line 
          x1="14" y1="10" 
          x2="20" y2="4" 
          stroke="white" 
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line 
          x1="10" y1="10" 
          x2="4" y2="4" 
          stroke="white" 
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line 
          x1="14" y1="14" 
          x2="20" y2="20" 
          stroke="white" 
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line 
          x1="10" y1="14" 
          x2="4" y2="20" 
          stroke="white" 
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      
      <style>{`
        @keyframes hitMarkerPop {
          0% {
            opacity: 1;
            transform: scale(1.3);
          }
          50% {
            opacity: 1;
            transform: scale(1);
          }
          100% {
            opacity: 0.9;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}