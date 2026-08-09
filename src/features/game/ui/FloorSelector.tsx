// src/features/game/ui/FloorSelector.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { X, DoorOpen, Lock } from "lucide-react";
import { TOWER_FLOORS } from "../world/locations/tower/TowerRegistry";

interface FloorSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectFloor: (floorId: string) => void;
    currentLocationId: string;
}

const LOCKED_FLOORS = new Set<string>(['tower-token-gates']);

const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
    'tower-events': { x: 66.4, y: 38.1 },
    'tower-first-floor': { x: 21.2, y: 59.1 },
    'tower-token-gates': { x: 75.5, y: 61.0 },
    'tower-basement': { x: 49.2, y: 67.9 },
    'main-world': { x: 28.0, y: 36.6 },
};

const NODE_ICONS: Record<string, string> = {
    'tower-events': '/locations/main-hall.webp',
    'tower-first-floor': '/locations/canyon.webp',
    'tower-token-gates': '/locations/token-gates.webp',
    'tower-basement': '/locations/crypto-universe.webp',
    'main-world': '/locations/open-world.webp',
};

const NODE_GLOW: Record<string, string> = {
    'tower-events': 'radial-gradient(circle, rgba(79,209,255,0.6) 0%, rgba(79,209,255,0) 70%)',
    'tower-first-floor': 'radial-gradient(circle, rgba(255,159,28,0.6) 0%, rgba(255,159,28,0) 70%)',
    'tower-token-gates': 'radial-gradient(circle, rgba(74,222,128,0.6) 0%, rgba(74,222,128,0) 70%)',
    'tower-basement': 'radial-gradient(circle, rgba(168,85,247,0.6) 0%, rgba(168,85,247,0) 70%)',
    'main-world': 'radial-gradient(circle, rgba(250,204,21,0.6) 0%, rgba(250,204,21,0) 70%)',
};

const NODE_DELAY: Record<string, number> = {
    'tower-events': 0,
    'tower-first-floor': 0.45,
    'tower-token-gates': 0.9,
    'tower-basement': 1.35,
    'main-world': 1.8,
};

export function FloorSelector({ isOpen, onClose, onSelectFloor, currentLocationId }: FloorSelectorProps) {
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 bg-[rgba(6,6,8,0.85)] backdrop-blur-md flex items-center justify-center z-50 pointer-events-auto font-oxanium p-4">
            <div className="bg-[rgba(12,12,14,0.92)] border border-[rgba(79,209,255,0.2)] rounded-[16px] p-6 max-w-[1100px] w-full mx-4 shadow-2xl shadow-[#4FD1FF]/10 relative">
                <button onClick={onClose} className="absolute top-4 right-4 z-10 bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                    <X className="w-6 h-6" />
                </button>

                <div className="text-center mb-4">
                    <h2 className="text-3xl font-black bg-gradient-to-r from-[#4FD1FF] to-[#3B82F6] bg-clip-text text-transparent mb-1">
                        Select Destination
                    </h2>
                    <p className="text-[#8B8F98] text-sm font-medium">
                        The crystal portal is ready for transportation.
                    </p>
                </div>

                <div className="relative w-full aspect-[3/2] rounded-[12px] overflow-hidden border border-[rgba(255,255,255,0.08)]">
                    <Image
                        src="/locations/background.webp"
                        alt=""
                        fill
                        priority
                        sizes="(max-width: 1100px) 100vw, 1100px"
                        className="object-cover select-none pointer-events-none"
                    />

                    {TOWER_FLOORS.map((floor) => {
                        const pos = NODE_POSITIONS[floor.id];
                        const icon = NODE_ICONS[floor.id];
                        if (!pos || !icon) return null;

                        const isCurrent = currentLocationId === floor.id;
                        const isLocked = LOCKED_FLOORS.has(floor.id);
                        const isHovered = hoveredId === floor.id;

                        return (
                            <button
                                key={floor.id}
                                onClick={() => !isCurrent && !isLocked && onSelectFloor(floor.id)}
                                onMouseEnter={() => setHoveredId(floor.id)}
                                onMouseLeave={() => setHoveredId((prev) => (prev === floor.id ? null : prev))}
                                disabled={isCurrent || isLocked}
                                title={isLocked ? "Sealed — under reconstruction" : isCurrent ? "You are here" : floor.description}
                                className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 bg-transparent border-0 p-0 ${isCurrent || isLocked ? "cursor-not-allowed" : "cursor-pointer"}`}
                                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                            >
                                <div
                                    className={`portal-node relative flex items-center justify-center ${isHovered && !isCurrent && !isLocked ? "portal-node-hovered" : ""} ${isCurrent ? "portal-node-current" : ""}`}
                                    style={{ animationDelay: `${NODE_DELAY[floor.id] ?? 0}s` }}
                                >
                                    {!isLocked && <span className="portal-glow" style={{ background: NODE_GLOW[floor.id] }} />}
                                    <Image
                                        src={icon}
                                        alt={floor.name}
                                        width={112}
                                        height={112}
                                        priority
                                        className={`portal-icon relative ${isLocked ? "grayscale opacity-40" : ""}`}
                                    />
                                    {isLocked && (
                                        <span className="absolute inset-0 flex items-center justify-center">
                                            <Lock className="w-8 h-8 text-[#E5E7EB] drop-shadow-[0_0_6px_rgba(0,0,0,0.9)]" />
                                        </span>
                                    )}
                                </div>
                                <span
                                    className={`text-xs font-bold px-2.5 py-1 rounded-[6px] whitespace-nowrap backdrop-blur-sm ${isCurrent || isLocked ? "text-[#8B8F98] bg-[rgba(12,12,14,0.55)]" : "text-[#E5E7EB] bg-[rgba(12,12,14,0.75)]"}`}
                                >
                                    {floor.name}
                                </span>
                                {isCurrent && (
                                    <span className="text-[10px] text-[#4ADE80] font-bold">You are here</span>
                                )}
                                {isLocked && !isCurrent && (
                                    <span className="text-[10px] text-[#8B8F98] font-bold">Sealed</span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="mt-4 pt-3 border-t border-[rgba(255,255,255,0.08)] text-center flex items-center justify-center gap-2 text-[#8B8F98] text-xs">
                    <DoorOpen className="w-3.5 h-3.5" />
                    <span>
                        press <kbd className="bg-[rgba(79,209,255,0.15)] border border-[rgba(79,209,255,0.3)] px-2 py-0.5 rounded text-[#4FD1FF] font-bold text-[10px]">ESC</kbd> to cancel
                    </span>
                </div>
            </div>

            <style jsx>{`
                @keyframes portal-float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-7px); }
                }
                @keyframes portal-pulse {
                    0%, 100% { transform: scale(0.9); }
                    50% { transform: scale(1.08); }
                }
                .portal-node {
                    animation: portal-float 3.4s ease-in-out infinite;
                    transition: transform 0.25s ease-out, filter 0.25s ease-out;
                    filter: drop-shadow(0 4px 10px rgba(0,0,0,0.55));
                }
                .portal-node-current {
                    opacity: 0.88;
                }
                .portal-node-hovered {
                    transform: scale(1.14);
                    filter: drop-shadow(0 6px 18px rgba(0,0,0,0.65)) brightness(1.18);
                }
                .portal-icon {
                    width: 84px;
                    height: 84px;
                    display: block;
                }
                @media (min-width: 640px) {
                    .portal-icon {
                        width: 112px;
                        height: 112px;
                    }
                }
                .portal-glow {
                    position: absolute;
                    inset: -22%;
                    border-radius: 9999px;
                    opacity: 0;
                    filter: blur(14px);
                    pointer-events: none;
                    transition: opacity 0.3s ease-out;
                    animation: portal-pulse 2.6s ease-in-out infinite;
                }
                .portal-node-current .portal-glow {
                    opacity: 0.32;
                }
                .portal-node-hovered .portal-glow {
                    opacity: 0.85;
                }
            `}</style>
        </div>
    );
}
