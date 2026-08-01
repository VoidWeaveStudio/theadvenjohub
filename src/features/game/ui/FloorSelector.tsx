// src/features/game/ui/FloorSelector.tsx
"use client";

import { useState } from "react";
import { X, Building, ArrowDownToLine, ArrowUpToLine, DoorOpen } from "lucide-react";
import { TOWER_FLOORS } from "../world/locations/tower/TowerRegistry";

interface FloorSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectFloor: (floorId: string) => void;
    currentLocationId: string;
}

const iconMap = {
    'building': Building,
    'arrow-down': ArrowDownToLine,
    'arrow-up': ArrowUpToLine,
};

const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
    'tower-main-hall': { x: 50, y: 55 },
    'tower-first-floor': { x: 22, y: 26 },
    'tower-token-gates': { x: 78, y: 26 },
    'tower-basement': { x: 50, y: 88 },
    'main-world': { x: 88, y: 62 },
};

export function FloorSelector({ isOpen, onClose, onSelectFloor, currentLocationId }: FloorSelectorProps) {
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    if (!isOpen) return null;

    const hub = NODE_POSITIONS['tower-main-hall'];

    return (
        <div className="absolute inset-0 bg-[rgba(6,6,8,0.85)] backdrop-blur-md flex items-center justify-center z-50 pointer-events-auto font-oxanium">
            <div className="bg-[rgba(12,12,14,0.92)] border border-[rgba(79,209,255,0.2)] rounded-[16px] p-6 max-w-2xl w-full mx-4 shadow-2xl shadow-[#4FD1FF]/10 relative">
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

                <div className="relative w-full aspect-[4/3] rounded-[12px] bg-[radial-gradient(ellipse_at_center,rgba(79,209,255,0.08)_0%,rgba(6,6,8,0)_70%)] border border-[rgba(255,255,255,0.06)] overflow-hidden">
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {TOWER_FLOORS.filter((f) => f.id !== 'tower-main-hall').map((floor) => {
                            const pos = NODE_POSITIONS[floor.id];
                            if (!pos) return null;
                            const isHighlighted = hoveredId === floor.id;
                            return (
                                <line
                                    key={floor.id}
                                    x1={hub.x}
                                    y1={hub.y}
                                    x2={pos.x}
                                    y2={pos.y}
                                    stroke={isHighlighted ? "#4FD1FF" : "rgba(79,209,255,0.25)"}
                                    strokeWidth={isHighlighted ? 0.6 : 0.35}
                                    strokeDasharray="1.5 1.5"
                                    vectorEffect="non-scaling-stroke"
                                />
                            );
                        })}
                    </svg>

                    {TOWER_FLOORS.map((floor) => {
                        const pos = NODE_POSITIONS[floor.id];
                        if (!pos) return null;

                        const isCurrent = currentLocationId === floor.id;
                        const isHovered = hoveredId === floor.id;
                        const Icon = iconMap[floor.icon] || Building;

                        return (
                            <button
                                key={floor.id}
                                onClick={() => !isCurrent && onSelectFloor(floor.id)}
                                onMouseEnter={() => setHoveredId(floor.id)}
                                onMouseLeave={() => setHoveredId((prev) => (prev === floor.id ? null : prev))}
                                disabled={isCurrent}
                                title={isCurrent ? "You are here" : floor.description}
                                className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 transition-transform duration-200 ease-out ${isCurrent ? "cursor-not-allowed" : "cursor-pointer"
                                    } ${isHovered && !isCurrent ? "scale-125" : "scale-100"}`}
                                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                            >
                                <div
                                    className={`w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${isCurrent
                                            ? "bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.15)]"
                                            : isHovered
                                                ? "bg-[rgba(79,209,255,0.25)] border-[#4FD1FF] shadow-[0_0_22px_rgba(79,209,255,0.6)]"
                                                : "bg-[rgba(79,209,255,0.1)] border-[rgba(79,209,255,0.4)]"
                                        }`}
                                >
                                    <Icon className={`w-6 h-6 ${isCurrent ? "text-[#8B8F98]" : "text-[#4FD1FF]"}`} />
                                </div>
                                <span
                                    className={`text-xs font-bold px-2 py-0.5 rounded-[6px] whitespace-nowrap ${isCurrent ? "text-[#8B8F98]" : "text-[#E5E7EB] bg-[rgba(12,12,14,0.7)]"
                                        }`}
                                >
                                    {floor.name}
                                </span>
                                {isCurrent && (
                                    <span className="text-[10px] text-[#4ADE80] font-bold">You are here</span>
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
        </div>
    );
}
