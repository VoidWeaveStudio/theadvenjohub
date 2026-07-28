// src/features/game/ui/PlayerProfileCard.tsx
"use client";

import { User, Users } from "lucide-react";
import { WindowFrame } from "./shell/WindowFrame";
import { PlayerTag } from "./shell/PlayerTag";
import { PlayerProfileData } from "../network/NetworkManager";

interface PlayerProfileCardProps {
    isOpen: boolean;
    profile: PlayerProfileData | null;
    onClose: () => void;
}

function truncateWallet(wallet: string): string {
    if (wallet.length <= 10) return wallet;
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

function formatPlaytime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

export function PlayerProfileCard({ isOpen, profile, onClose }: PlayerProfileCardProps) {
    return (
        <WindowFrame isOpen={isOpen} onClose={onClose} title="Player" icon={<User className="w-4 h-4" />} size="sm">
            {!profile ? (
                <p className="text-[#8B8F98] text-sm text-center py-8">Player not found.</p>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[#E5E7EB]">
                        <PlayerTag
                            nickname={profile.nickname || "Unknown"}
                            faction={profile.faction}
                            badge={
                                profile.faction?.verifiedCreatorWallet === profile.wallet
                                    ? "creator"
                                    : profile.faction?.founderWallet === profile.wallet
                                        ? "founder"
                                        : null
                            }
                        />
                        <p className="text-[#8B8F98] text-xs font-mono">{truncateWallet(profile.wallet)}</p>
                    </div>

                    {profile.faction && (
                        <div className="flex items-center gap-2 text-sm text-[#4FD1FF]">
                            <Users className="w-4 h-4" />
                            {profile.faction.name} #{profile.faction.number}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                            <div className="text-[#8B8F98] text-xs">Kills</div>
                            <div className="text-[#E5E7EB] text-lg font-bold">{profile.kills}</div>
                        </div>
                        <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                            <div className="text-[#8B8F98] text-xs">Deaths</div>
                            <div className="text-[#E5E7EB] text-lg font-bold">{profile.deaths}</div>
                        </div>
                        <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                            <div className="text-[#8B8F98] text-xs">Ash</div>
                            <div className="text-[#FFD166] text-lg font-bold">{profile.ash}</div>
                        </div>
                        <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                            <div className="text-[#8B8F98] text-xs">Playtime</div>
                            <div className="text-[#E5E7EB] text-lg font-bold">{formatPlaytime(profile.playtimeSeconds)}</div>
                        </div>
                    </div>
                </div>
            )}
        </WindowFrame>
    );
}
