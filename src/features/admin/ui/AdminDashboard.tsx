// src/features/admin/ui/AdminDashboard.tsx
"use client";

import { useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AdminPlayersTable } from "./AdminPlayersTable";
import { AdminFactionsTable } from "./AdminFactionsTable";
import { AdminSupportTable } from "./AdminSupportTable";
import { AdminChatTable } from "./AdminChatTable";
import { AdminTradeHistoryTable } from "./AdminTradeHistoryTable";
import { AdminFactionQuestsTable } from "./AdminFactionQuestsTable";
import { AdminBasementTable } from "./AdminBasementTable";
import { AdminShopPricesTable } from "./AdminShopPricesTable";
import { AdminMaintenanceToggle } from "./AdminMaintenanceToggle";
import { AdminTableRef } from "./AdminTableRef";

type AdminTab = "players" | "factions" | "quests" | "shop" | "basement" | "support" | "chat" | "trades";

export function AdminDashboard() {
    const [tab, setTab] = useState<AdminTab>("players");

    const playersRef = useRef<AdminTableRef>(null);
    const factionsRef = useRef<AdminTableRef>(null);
    const supportRef = useRef<AdminTableRef>(null);
    const chatRef = useRef<AdminTableRef>(null);
    const tradesRef = useRef<AdminTableRef>(null);
    const questsRef = useRef<AdminTableRef>(null);
    const basementRef = useRef<AdminTableRef>(null);
    const shopRef = useRef<AdminTableRef>(null);
    const maintenanceRef = useRef<AdminTableRef>(null);

    const tabs: { id: AdminTab; label: string }[] = [
        { id: "players", label: "Players" },
        { id: "factions", label: "Factions" },
        { id: "quests", label: "Faction Quests" },
        { id: "shop", label: "Items & Prices" },
        { id: "basement", label: "Basement" },
        { id: "support", label: "Support" },
        { id: "chat", label: "Chat" },
        { id: "trades", label: "Trade History" },
    ];

    const handleRefresh = () => {
        maintenanceRef.current?.refresh();
        const activeRef = { players: playersRef, factions: factionsRef, quests: questsRef, shop: shopRef, basement: basementRef, support: supportRef, chat: chatRef, trades: tradesRef }[tab];
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
            {tab === "quests" && <AdminFactionQuestsTable ref={questsRef} />}
            {tab === "shop" && <AdminShopPricesTable ref={shopRef} />}
            {tab === "basement" && <AdminBasementTable ref={basementRef} />}
            {tab === "support" && <AdminSupportTable ref={supportRef} />}
            {tab === "chat" && <AdminChatTable ref={chatRef} />}
            {tab === "trades" && <AdminTradeHistoryTable ref={tradesRef} />}
        </div>
    );
}
