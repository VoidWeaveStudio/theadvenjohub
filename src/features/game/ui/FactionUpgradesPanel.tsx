// src/features/game/ui/FactionUpgradesPanel.tsx
"use client";

import { Sparkles } from "lucide-react";
import { FactionDetail } from "../network/NetworkManager";
import { FactionHeader } from "./FactionHeader";

interface FactionUpgradesPanelProps {
    faction: FactionDetail;
}

export function FactionUpgradesPanel({ faction }: FactionUpgradesPanelProps) {
    return (
        <div className="space-y-4">
            <FactionHeader faction={faction} />

            <div className="bg-[rgba(255,255,255,0.03)] border border-white/10 rounded-lg p-8 text-center space-y-2">
                <Sparkles className="w-8 h-8 text-[#6B7280] mx-auto" />
                <p className="text-[#8B8F98] text-sm">Faction upgrades are coming soon.</p>
                <p className="text-[#6B7280] text-xs">Spend your faction's Ash to unlock new perks and abilities.</p>
            </div>
        </div>
    );
}
