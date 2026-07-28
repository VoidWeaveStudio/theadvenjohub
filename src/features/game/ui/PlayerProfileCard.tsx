// src/features/game/ui/PlayerProfileCard.tsx
"use client";

import { User, Users, UserPlus } from "lucide-react";
import { WindowFrame } from "./shell/WindowFrame";
import { PlayerTag } from "./shell/PlayerTag";
import { CopyableText } from "./shell/CopyableText";
import { FriendEntry, FriendRequestEntry, PlayerProfileData } from "../network/NetworkManager";

interface PlayerProfileCardProps {
    isOpen: boolean;
    profile: PlayerProfileData | null;
    myWallet: string;
    friends: FriendEntry[];
    outgoingRequests: FriendRequestEntry[];
    onClose: () => void;
    onSendFriendRequest: (target: { wallet?: string; nickname?: string }) => void;
}

function formatPlaytime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

export function PlayerProfileCard({
    isOpen,
    profile,
    myWallet,
    friends,
    outgoingRequests,
    onClose,
    onSendFriendRequest,
}: PlayerProfileCardProps) {
    const isSelf = !!profile && profile.wallet === myWallet;
    const isFriend = !!profile && friends.some((f) => f.wallet === profile.wallet);
    const isPending = !!profile && outgoingRequests.some((r) => r.wallet === profile.wallet);
    const displayedFaction = profile?.factions?.find((f) => f.isDisplayed) ?? profile?.factions?.[0] ?? null;

    return (
        <WindowFrame isOpen={isOpen} onClose={onClose} title="Player" icon={<User className="w-4 h-4" />} size="sm">
            {!profile ? (
                <p className="text-[#8B8F98] text-sm text-center py-8">Player not found.</p>
            ) : (
                <div className="space-y-4">
                    <div className="space-y-1">
                        <PlayerTag
                            nickname={profile.nickname || "Unknown"}
                            faction={displayedFaction}
                            badge={
                                displayedFaction?.verifiedCreatorWallet === profile.wallet
                                    ? "creator"
                                    : displayedFaction?.founderWallet === profile.wallet
                                        ? "founder"
                                        : null
                            }
                        />
                        <CopyableText
                            value={profile.wallet}
                            className="text-[#8B8F98] text-xs"
                            iconClassName="w-3 h-3"
                        />
                    </div>

                    {profile.factions && profile.factions.length > 0 && (
                        <div className="space-y-1">
                            {profile.factions.map((f) => (
                                <div key={f.id} className="flex items-center gap-2 text-sm text-[#4FD1FF]">
                                    <Users className="w-4 h-4 flex-shrink-0" />
                                    {f.name} #{f.number}
                                </div>
                            ))}
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

                    {!isSelf && (
                        <button
                            onClick={() => onSendFriendRequest({ wallet: profile.wallet })}
                            disabled={isFriend || isPending}
                            className="btn-success w-full flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <UserPlus className="w-4 h-4" />
                            {isFriend ? "Already Friends" : isPending ? "Request Sent" : "Add Friend"}
                        </button>
                    )}
                </div>
            )}
        </WindowFrame>
    );
}
