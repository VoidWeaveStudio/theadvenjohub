// src/features/game/ui/BlockedTab.tsx
"use client";

import { useEffect } from "react";
import { UserCheck } from "lucide-react";
import { BlockedEntry } from "../network/NetworkManager";
import { PlayerTag } from "./shell/PlayerTag";

interface BlockedTabProps {
    blocked: BlockedEntry[];
    onRequestBlockedList: () => void;
    onUnblockUser: (blockedUserId: string) => void;
}

function truncateWallet(wallet: string): string {
    if (wallet.length <= 10) return wallet;
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export function BlockedTab({ blocked, onRequestBlockedList, onUnblockUser }: BlockedTabProps) {
    useEffect(() => {
        onRequestBlockedList();
    }, []);

    return (
        <div>
            <span className="text-[#8B8F98] text-xs font-bold tracking-wider">BLOCKED ({blocked.length})</span>
            <div className="mt-2 space-y-2">
                {blocked.length === 0 ? (
                    <p className="text-[#8B8F98] text-sm text-center py-6">You haven't blocked anyone.</p>
                ) : (
                    blocked.map((b) => (
                        <div key={b.userId} className="flex items-center justify-between bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                            <PlayerTag
                                nickname={b.nickname || truncateWallet(b.wallet)}
                                faction={null}
                                size="sm"
                                isAdmin={b.isAdmin}
                                isFactionCreator={b.isFactionCreator}
                            />
                            <button
                                onClick={() => onUnblockUser(b.userId)}
                                className="bg-transparent border-0 p-0 text-[#8B8F98] hover:text-[#4ADE80] transition-colors flex-shrink-0"
                                title="Unblock"
                            >
                                <UserCheck className="w-4 h-4" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
