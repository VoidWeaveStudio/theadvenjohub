// src/features/game/ui/FriendsTab.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Search, UserPlus, UserMinus, Check, X as XIcon } from "lucide-react";
import { SubTabs } from "./shell/SubTabs";
import { PlayerTag } from "./shell/PlayerTag";
import { NicknameMenu, NicknameMenuActions } from "./shell/NicknameMenu";
import { FriendEntry, FriendRequestEntry } from "../network/NetworkManager";
import { useLanguage } from "@/core/i18n/LanguageContext";

type FriendsSubTab = "list" | "search";

interface FriendsTabProps {
    friends: FriendEntry[];
    incomingRequests: FriendRequestEntry[];
    outgoingRequests: FriendRequestEntry[];
    friendSearchResults: FriendRequestEntry[];
    onRequestFriendsList: () => void;
    onSearchFriends: (query: string) => void;
    onSendFriendRequest: (target: { wallet?: string; nickname?: string }) => void;
    onAcceptFriendRequest: (requestUserId: string) => void;
    onDeclineFriendRequest: (requestUserId: string) => void;
    onRemoveFriend: (friendUserId: string) => void;
    onViewProfile: (wallet: string) => void;
    getNicknameMenuActions?: (wallet: string, nickname: string) => NicknameMenuActions;
}

function truncateWallet(wallet: string): string {
    if (wallet.length <= 10) return wallet;
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export function FriendsTab({
    friends,
    incomingRequests,
    outgoingRequests,
    friendSearchResults,
    onRequestFriendsList,
    onSearchFriends,
    onSendFriendRequest,
    onAcceptFriendRequest,
    onDeclineFriendRequest,
    onRemoveFriend,
    onViewProfile,
    getNicknameMenuActions,
}: FriendsTabProps) {
    const { t } = useLanguage();
    const [friendsSubTab, setFriendsSubTab] = useState<FriendsSubTab>("list");
    const [friendQuery, setFriendQuery] = useState("");
    const friendSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        onRequestFriendsList();
    }, []);

    useEffect(() => {
        if (friendSearchDebounceRef.current) clearTimeout(friendSearchDebounceRef.current);
        if (friendQuery.trim().length === 0) return;

        friendSearchDebounceRef.current = setTimeout(() => {
            onSearchFriends(friendQuery.trim());
        }, 300);

        return () => {
            if (friendSearchDebounceRef.current) clearTimeout(friendSearchDebounceRef.current);
        };
    }, [friendQuery]);

    const renderNickname = (
        wallet: string,
        nickname: string | null,
        faction: FriendEntry["faction"] | undefined,
        isAdmin?: boolean,
        isFactionCreator?: boolean
    ) => {
        const displayName = nickname || truncateWallet(wallet);
        const tag = <PlayerTag nickname={displayName} faction={faction ?? null} size="sm" isAdmin={isAdmin} isFactionCreator={isFactionCreator} />;
        if (getNicknameMenuActions) {
            return (
                <NicknameMenu {...getNicknameMenuActions(wallet, displayName)}>
                    {tag}
                </NicknameMenu>
            );
        }
        return (
            <button onClick={() => onViewProfile(wallet)} className="bg-transparent border-0 p-0 hover:underline text-left truncate">
                {tag}
            </button>
        );
    };

    const friendStatus = (userId: string): "friend" | "incoming" | "outgoing" | "none" => {
        if (friends.some((f) => f.userId === userId)) return "friend";
        if (incomingRequests.some((r) => r.userId === userId)) return "incoming";
        if (outgoingRequests.some((r) => r.userId === userId)) return "outgoing";
        return "none";
    };

    return (
        <div>
            <SubTabs
                tabs={[
                    { id: "list", label: t("g.friends.tabFriends"), badge: incomingRequests.length },
                    { id: "search", label: t("g.friends.tabSearch") },
                ]}
                active={friendsSubTab}
                onChange={(id) => setFriendsSubTab(id as FriendsSubTab)}
            />

            {friendsSubTab === "list" && (
                <div className="space-y-4">
                    {incomingRequests.length > 0 && (
                        <div>
                            <span className="text-[#8B8F98] text-xs font-bold tracking-wider">{t("g.friends.requests")}</span>
                            <div className="mt-2 space-y-2">
                                {incomingRequests.map((r) => (
                                    <div
                                        key={r.userId}
                                        className="flex items-center justify-between bg-[rgba(255,209,102,0.06)] border border-[rgba(255,209,102,0.2)] rounded-lg p-3"
                                    >
                                        {renderNickname(r.wallet, r.nickname, r.faction, r.isAdmin, r.isFactionCreator)}
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => onAcceptFriendRequest(r.userId)}
                                                className="w-7 h-7 rounded-lg flex items-center justify-center bg-[rgba(74,222,128,0.15)] text-[#4ADE80] hover:bg-[rgba(74,222,128,0.25)] transition-colors"
                                                title={t("g.common.accept")}
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => onDeclineFriendRequest(r.userId)}
                                                className="w-7 h-7 rounded-lg flex items-center justify-center bg-[rgba(248,113,113,0.15)] text-red-400 hover:bg-[rgba(248,113,113,0.25)] transition-colors"
                                                title={t("g.common.decline")}
                                            >
                                                <XIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <span className="text-[#8B8F98] text-xs font-bold tracking-wider">FRIENDS ({friends.length})</span>
                        <div className="mt-2 space-y-2">
                            {friends.length === 0 ? (
                                <p className="text-[#8B8F98] text-sm text-center py-6">{t("g.friends.none")}</p>
                            ) : (
                                friends.map((f) => (
                                    <div key={f.userId} className="flex items-center justify-between bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${f.online ? "bg-[#4ADE80]" : "bg-[#6B7280]"}`} />
                                            {renderNickname(f.wallet, f.nickname, f.faction, f.isAdmin, f.isFactionCreator)}
                                            <span className={`text-xs flex-shrink-0 ${f.online ? "text-[#4ADE80]" : "text-[#6B7280]"}`}>
                                                {f.online ? t("g.friends.online") : t("g.friends.offline")}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => onRemoveFriend(f.userId)}
                                            className="text-[#8B8F98] hover:text-red-400 transition-colors flex-shrink-0"
                                            title={t("g.friends.remove")}
                                        >
                                            <UserMinus className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {outgoingRequests.length > 0 && (
                        <div>
                            <span className="text-[#8B8F98] text-xs font-bold tracking-wider">{t("g.friends.pendingHeader")}</span>
                            <div className="mt-2 space-y-2">
                                {outgoingRequests.map((r) => (
                                    <div key={r.userId} className="flex items-center justify-between bg-[rgba(255,255,255,0.03)] rounded-lg p-3">
                                        <PlayerTag nickname={r.nickname || truncateWallet(r.wallet)} faction={r.faction ?? null} size="sm" />
                                        <span className="text-[#6B7280] text-xs">{t("g.friends.pending")}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {friendsSubTab === "search" && (
                <div className="space-y-3">
                    <div className="relative">
                        <Search className="w-4 h-4 text-[#8B8F98] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={friendQuery}
                            onChange={(e) => setFriendQuery(e.target.value)}
                            placeholder={t("g.friends.searchPlaceholder")}
                            className="w-full bg-zinc-900 text-white pl-9 pr-3 py-2 rounded text-sm border border-zinc-700 focus:border-cyan-500 outline-none"
                        />
                    </div>

                    <div className="space-y-2">
                        {friendQuery.trim().length === 0 ? (
                            <p className="text-[#8B8F98] text-sm text-center py-6">{t("g.friends.searchHint")}</p>
                        ) : friendSearchResults.length === 0 ? (
                            <p className="text-[#8B8F98] text-sm text-center py-6">{t("g.friends.noPlayers")}</p>
                        ) : (
                            friendSearchResults.map((r) => {
                                const status = friendStatus(r.userId);
                                return (
                                    <div key={r.userId} className="flex items-center justify-between bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                                        {renderNickname(r.wallet, r.nickname, r.faction, r.isAdmin, r.isFactionCreator)}
                                        {status === "friend" && <span className="text-[#4ADE80] text-xs flex-shrink-0">Friends</span>}
                                        {status === "outgoing" && <span className="text-[#6B7280] text-xs flex-shrink-0">Pending</span>}
                                        {status === "incoming" && (
                                            <button
                                                onClick={() => onAcceptFriendRequest(r.userId)}
                                                className="btn-primary px-3 py-1.5 text-xs flex-shrink-0"
                                            >
                                                {t("g.common.accept")}
                                            </button>
                                        )}
                                        {status === "none" && (
                                            <button
                                                onClick={() => onSendFriendRequest({ wallet: r.wallet })}
                                                className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 flex-shrink-0"
                                            >
                                                <UserPlus className="w-3.5 h-3.5" />
                                                {t("g.friends.add")}
                                            </button>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
