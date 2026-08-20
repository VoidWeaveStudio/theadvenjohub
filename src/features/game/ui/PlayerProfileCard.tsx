// src/features/game/ui/PlayerProfileCard.tsx
"use client";

import { User, Users, UserPlus, Trophy } from "lucide-react";
import { WindowFrame } from "./shell/WindowFrame";
import { PlayerTag } from "./shell/PlayerTag";
import { CopyableText } from "./shell/CopyableText";
import { FriendEntry, FriendRequestEntry, PlayerProfileData } from "../network/NetworkManager";
import { useLanguage } from "@/core/i18n/LanguageContext";
import type { Translate } from "@/core/i18n/types";

interface PlayerProfileCardProps {
    isOpen: boolean;
    profile: PlayerProfileData | null;
    myWallet: string;
    friends: FriendEntry[];
    outgoingRequests: FriendRequestEntry[];
    onClose: () => void;
    onSendFriendRequest: (target: { wallet?: string; nickname?: string }) => void;
}

function formatPlaytime(seconds: number, t: Translate): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return t("g.time.hm", { hours, minutes });
    return t("g.time.m", { minutes });
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
    const { t } = useLanguage();
    const isSelf = !!profile && profile.wallet === myWallet;
    const isFriend = !!profile && friends.some((f) => f.wallet === profile.wallet);
    const isPending = !!profile && outgoingRequests.some((r) => r.wallet === profile.wallet);
    const displayedFaction = profile?.factions?.find((f) => f.isDisplayed) ?? profile?.factions?.[0] ?? null;
    const isFactionCreator = !!profile && profile.factions.some((f) => f.verifiedCreatorWallet === profile.wallet);

    return (
        <WindowFrame isOpen={isOpen} onClose={onClose} title={t("g.profile.windowTitle")} icon={<User className="w-4 h-4" />} size="sm">
            {!profile ? (
                <p className="text-[#8B8F98] text-sm text-center py-8">{t("g.profile.notFound")}</p>
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
                            isAdmin={profile.isAdmin}
                            isFactionCreator={isFactionCreator}
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
                            <div className="text-[#8B8F98] text-xs">{t("g.stat.kills")}</div>
                            <div className="text-[#E5E7EB] text-lg font-bold">{profile.kills}</div>
                        </div>
                        <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                            <div className="text-[#8B8F98] text-xs">{t("g.stat.deaths")}</div>
                            <div className="text-[#E5E7EB] text-lg font-bold">{profile.deaths}</div>
                        </div>
                        <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                            <div className="text-[#8B8F98] text-xs">{t("g.stat.ash")}</div>
                            <div className="text-[#FFD166] text-lg font-bold">{profile.ash}</div>
                        </div>
                        <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                            <div className="text-[#8B8F98] text-xs">{t("g.stat.playtime")}</div>
                            <div className="text-[#E5E7EB] text-lg font-bold">{formatPlaytime(profile.playtimeSeconds, t)}</div>
                        </div>
                    </div>

                    {profile.achievements && profile.achievements.length > 0 && (
                        <div className="space-y-1.5">
                            <div className="text-[#8B8F98] text-xs font-bold tracking-wider flex items-center gap-1.5">
                                <Trophy className="w-3.5 h-3.5" />
                                ACHIEVEMENTS ({profile.achievements.length})
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {profile.achievements.map((a) => (
                                    <div
                                        key={a.key}
                                        title={a.description}
                                        className="bg-[rgba(255,209,102,0.08)] border border-[rgba(255,209,102,0.2)] rounded-lg px-2.5 py-1.5"
                                    >
                                        <div className="text-[#FFD166] text-xs font-bold truncate">{a.label}</div>
                                        <div className="text-[#8B8F98] text-[10px] truncate">{a.description}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {!isSelf && (
                        <button
                            onClick={() => onSendFriendRequest({ wallet: profile.wallet })}
                            disabled={isFriend || isPending}
                            className="btn-success w-full flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <UserPlus className="w-4 h-4" />
                            {isFriend ? t("g.profile.alreadyFriends") : isPending ? t("g.profile.requestSent") : t("g.profile.addFriend")}
                        </button>
                    )}
                </div>
            )}
        </WindowFrame>
    );
}
