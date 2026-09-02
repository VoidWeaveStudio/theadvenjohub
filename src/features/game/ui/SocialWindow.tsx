// src/features/game/ui/SocialWindow.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Users, Mail as MailIcon, User, UserX, ArrowLeftRight, PawPrint, Shirt, Swords, Zap } from "lucide-react";
import { WindowFrame } from "./shell/WindowFrame";
import { FriendsTab } from "./FriendsTab";
import { MailTab } from "./MailTab";
import { AccountTab } from "./AccountTab";
import { BlockedTab } from "./BlockedTab";
import { TradeHistoryTab } from "./TradeHistoryTab";
import { AppearanceTab } from "./AppearanceTab";
import { CompanionsTab } from "./CompanionsTab";
import { CosmeticId } from "../data/cosmetics";
import { CompanionId, FRAGMENTS_PER_CRATE } from "../data/companions";
import { NicknameMenuActions } from "./shell/NicknameMenu";
import { PartyPanel } from "./PartyPanel";
import { SkillTreePanel } from "./SkillTreePanel";
import { FriendEntry, FriendRequestEntry, MailEntry, PartyStateData, PlayerProfileData, ProgressionStateData, QuestInfoData, BlockedEntry, CosmeticStateData, CompanionStateData } from "../network/NetworkManager";
import { useLanguage } from "@/core/i18n/LanguageContext";

export type SocialTab = "skills" | "friends" | "party" | "mail" | "account" | "appearance" | "companions" | "blocked" | "trades";

interface SocialWindowProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab: SocialTab;

    nickname: string;
    wallet: string;
    selfProfile: PlayerProfileData | null;
    onRequestSelfProfile: () => void;
    onNicknameChange: (nickname: string) => void;
    quests: QuestInfoData[];

    progression: ProgressionStateData | null;
    onLearnSkill: (nodeId: string) => void;
    onBindAbility: (slot: string, abilityId: string | null) => void;
    onOpenSpecialization: () => void;

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

    mail: MailEntry[];
    unreadMailCount: number;
    onRequestMailInbox: () => void;
    onSendMail: (recipient: { wallet?: string; nickname?: string }, subject: string, body: string) => void;
    onMarkMailRead: (mailId: string) => void;

    cosmetics: CosmeticStateData;
    onRequestCosmetics: () => void;
    onEquipCosmetics: (skinId: CosmeticId | null, accessoryId: CosmeticId | null) => void;

    companions: CompanionStateData;
    onRequestCompanions: () => void;
    onEquipCompanion: (companionId: CompanionId | null) => void;
    onDustCompanion: (itemId: CompanionId) => void;
    onCombineFragments: () => void;
    onOpenCrate: () => void;

    blocked: BlockedEntry[];
    onRequestBlockedList: () => void;
    onUnblockUser: (blockedUserId: string) => void;
    getNicknameMenuActions?: (wallet: string, nickname: string) => NicknameMenuActions;

    party: PartyStateData;
    localPlayerId: string | null;
    onPartyLeave: () => void;
    onPartyKick: (memberId: string) => void;
}

export function SocialWindow({
    isOpen,
    onClose,
    initialTab,
    nickname,
    wallet,
    selfProfile,
    onRequestSelfProfile,
    onNicknameChange,
    quests,
    progression,
    onLearnSkill,
    onBindAbility,
    onOpenSpecialization,
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
    mail,
    unreadMailCount,
    onRequestMailInbox,
    onSendMail,
    onMarkMailRead,
    cosmetics,
    onRequestCosmetics,
    onEquipCosmetics,
    companions,
    onRequestCompanions,
    onEquipCompanion,
    onDustCompanion,
    onCombineFragments,
    onOpenCrate,
    blocked,
    onRequestBlockedList,
    onUnblockUser,
    getNicknameMenuActions,
    party,
    localPlayerId,
    onPartyLeave,
    onPartyKick,
}: SocialWindowProps) {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<SocialTab>(initialTab);
    const wasOpenRef = useRef(false);

    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            setActiveTab(initialTab);
        }
        wasOpenRef.current = isOpen;
    }, [isOpen, initialTab]);

    if (!isOpen) return null;

    return (
        <WindowFrame
            isOpen={isOpen}
            onClose={onClose}
            title={t("g.social.title")}
            icon={
                <Image
                    src="/icons/topmenu/social-v3.webp"
                    alt=""
                    width={100}
                    height={200}
                    className="h-11 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
                />
            }
            tabs={[
                { id: "skills", label: t("g.skill.title"), icon: <Zap className="w-3.5 h-3.5" />, badge: (progression?.skillPoints ?? 0) > 0 },
                { id: "friends", label: t("g.social.tab.friends"), icon: <Users className="w-3.5 h-3.5" />, badge: incomingRequests.length > 0 },
                { id: "party", label: t("g.social.tab.party"), icon: <Swords className="w-3.5 h-3.5" />, badge: party.members.length > 0 },
                { id: "mail", label: t("g.social.tab.mail"), icon: <MailIcon className="w-3.5 h-3.5" />, badge: unreadMailCount > 0 },
                { id: "blocked", label: t("g.social.tab.blockList"), icon: <UserX className="w-3.5 h-3.5" /> },
                { id: "trades", label: t("g.social.tab.trades"), icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
                { id: "appearance", label: t("g.social.tab.appearance"), icon: <Shirt className="w-3.5 h-3.5" /> },
                { id: "companions", label: t("g.social.tab.companions"), icon: <PawPrint className="w-3.5 h-3.5" />, badge: companions.crates > 0 || companions.fragments >= FRAGMENTS_PER_CRATE },
                { id: "account", label: t("g.social.tab.account"), icon: <User className="w-3.5 h-3.5" /> },
            ]}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as SocialTab)}
        >
            {activeTab === "skills" && (
                <SkillTreePanel
                    active={activeTab === "skills"}
                    progression={progression}
                    onLearn={onLearnSkill}
                    onBind={onBindAbility}
                    onOpenSpecialization={onOpenSpecialization}
                />
            )}

            {activeTab === "party" && (
                <PartyPanel
                    party={party}
                    localPlayerId={localPlayerId}
                    onLeave={onPartyLeave}
                    onKick={onPartyKick}
                />
            )}

            {activeTab === "friends" && (
                <FriendsTab
                    friends={friends}
                    incomingRequests={incomingRequests}
                    outgoingRequests={outgoingRequests}
                    friendSearchResults={friendSearchResults}
                    onRequestFriendsList={onRequestFriendsList}
                    onSearchFriends={onSearchFriends}
                    onSendFriendRequest={onSendFriendRequest}
                    onAcceptFriendRequest={onAcceptFriendRequest}
                    onDeclineFriendRequest={onDeclineFriendRequest}
                    onRemoveFriend={onRemoveFriend}
                    onViewProfile={onViewProfile}
                    getNicknameMenuActions={getNicknameMenuActions}
                />
            )}

            {activeTab === "blocked" && (
                <BlockedTab
                    blocked={blocked}
                    onRequestBlockedList={onRequestBlockedList}
                    onUnblockUser={onUnblockUser}
                />
            )}

            {activeTab === "mail" && (
                <MailTab
                    mail={mail}
                    unreadMailCount={unreadMailCount}
                    onRequestMailInbox={onRequestMailInbox}
                    onSendMail={onSendMail}
                    onMarkMailRead={onMarkMailRead}
                />
            )}

            {activeTab === "trades" && <TradeHistoryTab />}

            {activeTab === "appearance" && (
                <AppearanceTab
                    cosmetics={cosmetics}
                    onRequestCosmetics={onRequestCosmetics}
                    onEquip={onEquipCosmetics}
                />
            )}

            {activeTab === "companions" && (
                <CompanionsTab
                    companions={companions}
                    onRequestCompanions={onRequestCompanions}
                    onEquip={onEquipCompanion}
                    onDust={onDustCompanion}
                    onCombine={onCombineFragments}
                    onOpenCrate={onOpenCrate}
                />
            )}

            {activeTab === "account" && (
                <AccountTab
                    nickname={nickname}
                    wallet={wallet}
                    selfProfile={selfProfile}
                    onRequestSelfProfile={onRequestSelfProfile}
                    onNicknameChange={onNicknameChange}
                    quests={quests}
                />
            )}
        </WindowFrame>
    );
}
