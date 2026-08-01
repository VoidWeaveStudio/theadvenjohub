// src/features/admin/ui/AdminDashboard.tsx
"use client";

import { useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AdminPlayersTable } from "./AdminPlayersTable";
import { AdminFactionsTable } from "./AdminFactionsTable";
import { AdminSupportTable } from "./AdminSupportTable";
import { AdminMaintenanceToggle } from "./AdminMaintenanceToggle";
import { AdminTableRef } from "./AdminTableRef";

type AdminTab = "players" | "factions" | "support";

export function AdminDashboard() {
    const [tab, setTab] = useState<AdminTab>("players");

    const playersRef = useRef<AdminTableRef>(null);
    const factionsRef = useRef<AdminTableRef>(null);
    const supportRef = useRef<AdminTableRef>(null);
    const maintenanceRef = useRef<AdminTableRef>(null);

    const tabs: { id: AdminTab; label: string }[] = [
        { id: "players", label: "Players" },
        { id: "factions", label: "Factions" },
        { id: "support", label: "Support" },
    ];

    const handleRefresh = () => {
        maintenanceRef.current?.refresh();
        const activeRef = { players: playersRef, factions: factionsRef, support: supportRef }[tab];
        activeRef.current?.refresh();
    };

    return (
        <div className="space-y-6">
            <AdminMaintenanceToggle ref={maintenanceRef} />

            <div className="flex items-center justify-between border-b border-white/10">
                <div className="flex gap-2">
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${tab === t.id ? "border-cyan-500 text-white" : "border-transparent text-[#8B8F98] hover:text-white"
                                }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                <button
                    onClick={handleRefresh}
                    className="flex items-center gap-1.5 text-[#8B8F98] hover:text-white text-sm px-3 py-2 transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {tab === "players" && <AdminPlayersTable ref={playersRef} />}
            {tab === "factions" && <AdminFactionsTable ref={factionsRef} />}
            {tab === "support" && <AdminSupportTable ref={supportRef} />}
        </div>
    );
}
