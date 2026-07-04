//src\features\game\ui\DamageIndicator.tsx
"use client";

import { useEffect, useState } from "react";

interface DamageIndicatorProps {
    attackerId: string | null;
    direction: number; 
    }


export function DamageIndicator({ attackerId, direction }: DamageIndicatorProps) {
    const [visible, setVisible] = useState(false);
    const [displayDirection, setDisplayDirection] = useState(0);

    useEffect(() => {
        if (attackerId !== null) {
            setVisible(true);
        } else {
            const t = setTimeout(() => setVisible(false), 100);
            return () => clearTimeout(t);
        }
    }, [attackerId]);

    useEffect(() => {
        if (attackerId !== null) {
            setDisplayDirection(direction);
        }
    }, [direction, attackerId]);

    if (!visible || attackerId === null) return null;


    const rotationDeg = (displayDirection * 180) / Math.PI;

    return (
        <div className="absolute inset-0 pointer-events-none z-30 flex items-start justify-center overflow-hidden">
            <div
                className="absolute top-0 left-1/2 transition-transform duration-75 ease-out"
                style={{
                    transform: `translateX(-50%) rotate(${rotationDeg}deg)`,
                    transformOrigin: '50% 400px',
                }}
            >
                <svg
                    width="600"
                    height="200"
                    viewBox="-300 -200 600 200"
                    className="drop-shadow-[0_0_20px_rgba(239,68,68,0.8)]"
                    style={{
                        transform: 'translateY(-100px)',
                    }}
                >
                    <defs>
                        <linearGradient id="damageGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="rgba(239, 68, 68, 0)" />
                            <stop offset="50%" stopColor="rgba(239, 68, 68, 0.9)" />
                            <stop offset="100%" stopColor="rgba(239, 68, 68, 0.3)" />
                        </linearGradient>
                        <filter id="glow">
                            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    <path
                        d="M -250 -50 A 250 250 0 0 1 250 -50"
                        fill="none"
                        stroke="url(#damageGradient)"
                        strokeWidth="16"
                        strokeLinecap="round"
                        filter="url(#glow)"
                        opacity="0.95"
                    />

                    <path
                        d="M -250 -50 A 250 250 0 0 1 250 -50"
                        fill="none"
                        stroke="rgba(255, 150, 150, 0.6)"
                        strokeWidth="4"
                        strokeLinecap="round"
                    />

                    <g transform="translate(0, -50)">
                        <polygon
                            points="0,-25 -12,0 12,0"
                            fill="rgb(239, 68, 68)"
                            filter="url(#glow)"
                        />
                        <polygon
                            points="0,-20 -7,-3 7,-3"
                            fill="rgba(255, 200, 200, 0.8)"
                        />
                    </g>
                </svg>
            </div>

            <div
                className="absolute inset-0 transition-opacity duration-200"
                style={{
                    opacity: visible ? 0.3 : 0,
                    background: `radial-gradient(ellipse at ${50 + Math.sin(displayDirection) * 30}% ${50 - Math.cos(displayDirection) * 30}%, rgba(239, 68, 68, 0.4) 0%, transparent 50%)`,
                }}
            />
        </div>
    );
}