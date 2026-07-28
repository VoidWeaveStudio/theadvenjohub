// src/features/game/ui/SocialWindow.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Users, Mail as MailIcon, User } from "lucide-react";
import { WindowFrame } from "./shell/WindowFrame";
import { FriendsTab } from "./FriendsTab";
import { MailTab } from "./MailTab";
import { AccountTab } from "./AccountTab";
import { FriendEntry, FriendRequestEntry, MailEntry, PlayerProfileData, QuestInfoData } from "../network/NetworkManager";

export type SocialTab = "friends" | "mail" | "account";

interface SocialWindowProps {
    isOpen: boolean;
    onClose: () => void;
    initialTab: SocialTab;

    nickname: string;
    wallet: string;
    selfProfile: PlayerProfileData | null;
    onRequestSelfProfile: () => void;
    onNicknameChange: (nickname: string) => void;
    quest: QuestInfoData | null;

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
    quest,
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
}: SocialWindowProps) {
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
            title="Social"
            icon={
                <Image
                    src="/icons/topmenu/social-v2.webp"
                    alt=""
                    width={100}
                    height={200}
                    className="h-11 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
                />
            }
            tabs={[
                { id: "friends", label: "Friends", icon: <Users className="w-3.5 h-3.5" />, badge: incomingRequests.length > 0 },
                { id: "mail", label: "Mail", icon: <MailIcon className="w-3.5 h-3.5" />, badge: unreadMailCount > 0 },
                { id: "account", label: "Account", icon: <User className="w-3.5 h-3.5" /> },
            ]}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as SocialTab)}
        >
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

            {activeTab === "account" && (
                <AccountTab
                    nickname={nickname}
                    wallet={wallet}
                    selfProfile={selfProfile}
                    onRequestSelfProfile={onRequestSelfProfile}
                    onNicknameChange={onNicknameChange}
                    quest={quest}
                />
            )}
        </WindowFrame>
    );
}
