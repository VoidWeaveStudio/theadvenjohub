// src/features/game/ui/AccountTab.tsx
"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ScrollText } from "lucide-react";
import { SubTabs } from "./shell/SubTabs";
import { PlayerTag } from "./shell/PlayerTag";
import { PlayerProfileData, QuestInfoData } from "../network/NetworkManager";

type AccountSubTab = "about" | "quests";

interface AccountTabProps {
    nickname: string;
    wallet: string;
    selfProfile: PlayerProfileData | null;
    onRequestSelfProfile: () => void;
    onNicknameChange: (nickname: string) => void;
    quest: QuestInfoData | null;
}

function formatPlaytime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

export function AccountTab({ nickname, wallet, selfProfile, onRequestSelfProfile, onNicknameChange, quest }: AccountTabProps) {
    const [accountSubTab, setAccountSubTab] = useState<AccountSubTab>("about");
    const [editingNickname, setEditingNickname] = useState(false);
    const [tempNickname, setTempNickname] = useState(nickname);
    const [walletCopied, setWalletCopied] = useState(false);

    useEffect(() => {
        if (accountSubTab === "about") onRequestSelfProfile();
    }, [accountSubTab]);

    const handleSaveNickname = () => {
        if (tempNickname.trim().length > 0) {
            onNicknameChange(tempNickname.trim());
        }
        setEditingNickname(false);
    };

    const handleCopyWallet = () => {
        navigator.clipboard.writeText(wallet).then(() => {
            setWalletCopied(true);
            setTimeout(() => setWalletCopied(false), 1500);
        });
    };

    return (
        <div>
            <SubTabs
                tabs={[
                    { id: "about", label: "About Account" },
                    { id: "quests", label: "Quests" },
                ]}
                active={accountSubTab}
                onChange={(id) => setAccountSubTab(id as AccountSubTab)}
            />

            {accountSubTab === "about" && (
                <div className="space-y-6">
                    <div>
                        <span className="text-[#8B8F98] text-xs font-bold tracking-wider">NICKNAME</span>
                        <div className="mt-2 flex items-center gap-2">
                            {editingNickname ? (
                                <>
                                    <input
                                        type="text"
                                        value={tempNickname}
                                        onChange={(e) => setTempNickname(e.target.value.slice(0, 30))}
                                        onKeyDown={(e) => e.key === "Enter" && handleSaveNickname()}
                                        autoFocus
                                        className="flex-1 bg-zinc-900 text-white px-3 py-2 rounded text-sm border border-zinc-700 focus:border-cyan-500 outline-none"
                                    />
                                    <button onClick={handleSaveNickname} className="btn-primary px-4 py-2 text-sm">
                                        Save
                                    </button>
                                </>
                            ) : (
                                <>
                                    <PlayerTag
                                        nickname={nickname}
                                        faction={selfProfile?.faction ?? null}
                                        badge={
                                            selfProfile?.faction?.verifiedCreatorWallet === wallet
                                                ? "creator"
                                                : selfProfile?.faction?.founderWallet === wallet
                                                    ? "founder"
                                                    : null
                                        }
                                    />
                                    <button
                                        onClick={() => {
                                            setTempNickname(nickname);
                                            setEditingNickname(true);
                                        }}
                                        className="text-[#4FD1FF] text-xs font-bold hover:underline"
                                    >
                                        Edit
                                    </button>
                                </>
                            )}
                        </div>
                        {selfProfile?.faction && (
                            <p className="mt-1 text-[#4FD1FF] text-xs">
                                {selfProfile.faction.name} #{selfProfile.faction.number}
                            </p>
                        )}
                    </div>

                    <div>
                        <span className="text-[#8B8F98] text-xs font-bold tracking-wider">WALLET</span>
                        <div className="mt-1 flex items-center gap-2">
                            <p className="text-[#E5E7EB] text-sm font-mono break-all">{wallet}</p>
                            <button
                                onClick={handleCopyWallet}
                                className="text-[#8B8F98] hover:text-[#4FD1FF] transition-colors flex-shrink-0"
                                title="Copy address"
                            >
                                {walletCopied ? <Check className="w-4 h-4 text-[#4ADE80]" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <span className="text-[#8B8F98] text-xs font-bold tracking-wider">STATS</span>
                        {selfProfile ? (
                            <div className="mt-2 grid grid-cols-2 gap-3">
                                <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                                    <div className="text-[#8B8F98] text-xs">Kills</div>
                                    <div className="text-[#E5E7EB] text-lg font-bold">{selfProfile.kills}</div>
                                </div>
                                <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                                    <div className="text-[#8B8F98] text-xs">Deaths</div>
                                    <div className="text-[#E5E7EB] text-lg font-bold">{selfProfile.deaths}</div>
                                </div>
                                <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                                    <div className="text-[#8B8F98] text-xs">Ash</div>
                                    <div className="text-[#FFD166] text-lg font-bold">{selfProfile.ash}</div>
                                </div>
                                <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                                    <div className="text-[#8B8F98] text-xs">Playtime</div>
                                    <div className="text-[#E5E7EB] text-lg font-bold">{formatPlaytime(selfProfile.playtimeSeconds)}</div>
                                </div>
                            </div>
                        ) : (
                            <p className="mt-2 text-[#8B8F98] text-sm">Loading...</p>
                        )}
                    </div>
                </div>
            )}

            {accountSubTab === "quests" && (
                <div className="space-y-3">
                    {!quest ? (
                        <div className="text-center py-10">
                            <ScrollText className="w-8 h-8 text-[#6B7280] mx-auto mb-2" />
                            <p className="text-[#8B8F98] text-sm">No quests yet. Talk to an NPC to find one.</p>
                        </div>
                    ) : (
                        <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-4">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="text-[#E5E7EB] font-bold">{quest.title}</h3>
                                <span
                                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${quest.status === "completed"
                                        ? "bg-[rgba(74,222,128,0.15)] text-[#4ADE80]"
                                        : quest.status === "ready_to_turn_in"
                                            ? "bg-[rgba(255,209,102,0.15)] text-[#FFD166]"
                                            : "bg-[rgba(79,209,255,0.15)] text-[#4FD1FF]"
                                        }`}
                                >
                                    {quest.status === "completed" ? "Completed" : quest.status === "ready_to_turn_in" ? "Ready to turn in" : "Active"}
                                </span>
                            </div>
                            <p className="text-[#8B8F98] text-sm mb-3">{quest.description}</p>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-[#E5E7EB]">
                                    Progress: {quest.progress}/{quest.targetCount}
                                </span>
                                <span className="text-[#FFD166] font-bold">+{quest.rewardAsh} ash</span>
                            </div>
                        </div>
                    )}
                    <p className="text-[#6B7280] text-xs text-center pt-2">Faction quests are coming soon.</p>
                </div>
            )}
        </div>
    );
}
