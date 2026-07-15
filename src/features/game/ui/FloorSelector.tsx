// src/features/game/ui/FloorSelector.tsx
"use client";

import { X, Building, ArrowDownToLine, ArrowUpToLine } from "lucide-react";
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
    'arrow-up': ArrowUpToLine
};

export function FloorSelector({ isOpen, onClose, onSelectFloor, currentLocationId }: FloorSelectorProps) {
    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 bg-[rgba(6,6,8,0.85)] backdrop-blur-md flex items-center justify-center z-50 pointer-events-auto font-oxanium">
            <div className="bg-[rgba(12,12,14,0.9)] border border-[rgba(79,209,255,0.2)] rounded-[16px] p-8 max-w-md w-full mx-4 shadow-2xl shadow-[#4FD1FF]/10 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                    <X className="w-6 h-6" />
                </button>

                <div className="text-center mb-8">
                    <h2 className="text-3xl font-black bg-gradient-to-r from-[#4FD1FF] to-[#3B82F6] bg-clip-text text-transparent mb-2">
                        select flor
                    </h2>
                    <p className="text-[#8B8F98] text-sm font-medium">The crystal elevator is ready for transportation.
</p>
                </div>

                <div className="space-y-4">
                    {TOWER_FLOORS.map((floor) => {
                        const isCurrent = currentLocationId === floor.id;
                        const Icon = iconMap[floor.icon] || Building;
                        
                        return (
                            <button
                                key={floor.id}
                                onClick={() => onSelectFloor(floor.id)}
                                disabled={isCurrent}
                                className={`
                                    w-full p-4 rounded-[10px] border flex items-center gap-4 transition-all duration-200 group
                                    ${isCurrent 
                                        ? 'bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.1)] cursor-not-allowed opacity-50' 
                                        : 'bg-[rgba(79,209,255,0.05)] border-[rgba(79,209,255,0.3)] hover:bg-[rgba(79,209,255,0.15)] hover:border-[#4FD1FF] hover:shadow-lg hover:shadow-[#4FD1FF]/10'
                                    }
                                `}
                            >
                                <div className={`p-3 rounded-full ${isCurrent ? 'bg-[rgba(255,255,255,0.05)]' : 'bg-[rgba(79,209,255,0.2)] group-hover:scale-110 transition-transform'}`}>
                                    <Icon className={`w-6 h-6 ${isCurrent ? 'text-[#8B8F98]' : 'text-[#4FD1FF]'}`} />
                                </div>
                                <div className="text-left flex-1">
                                    <div className={`font-bold text-lg ${isCurrent ? 'text-[#8B8F98]' : 'text-[#E5E7EB]'}`}>
                                        {floor.name}
                                    </div>
                                    <div className="text-xs text-[#8B8F98]">
                                        {isCurrent ? 'Вы уже здесь' : floor.description}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                <div className="mt-6 pt-4 border-t border-[rgba(255,255,255,0.08)] text-center">
                    <p className="text-[#8B8F98] text-xs">
                        press <kbd className="bg-[rgba(79,209,255,0.15)] border border-[rgba(79,209,255,0.3)] px-2 py-0.5 rounded text-[#4FD1FF] font-bold text-[10px]">ESC</kbd> for cancel
                    </p>
                </div>
            </div>
        </div>
    );
}