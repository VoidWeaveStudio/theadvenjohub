// src/features/game/ui/SocialWindow.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
    Users,
    Mail as MailIcon,
    User,
    Search,
    UserPlus,
    UserMinus,
    Check,
    X as XIcon,
    Send,
    Copy,
    Inbox,
    ScrollText,
} from "lucide-react";
import { WindowFrame } from "./shell/WindowFrame";
import { FriendEntry, FriendRequestEntry, MailEntry, PlayerProfileData, QuestInfoData } from "../network/NetworkManager";

export type SocialTab = "friends" | "mail" | "account";
type FriendsSubTab = "list" | "search";
type AccountSubTab = "about" | "quests";

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

function formatMailDate(iso: string): string {
    const date = new Date(iso);
    const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString();
}

function resolveTarget(query: string): { wallet?: string; nickname?: string } {
    const trimmed = query.trim();
    return trimmed.length >= 32 ? { wallet: trimmed } : { nickname: trimmed };
}

function SubTabs({
    tabs,
    active,
    onChange,
}: {
    tabs: { id: string; label: string; badge?: number }[];
    active: string;
    onChange: (id: string) => void;
}) {
    return (
        <div className="flex gap-1.5 mb-4">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => onChange(tab.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-colors ${activeClass(active === tab.id)}`}
                >
                    {tab.label}
                    {!!tab.badge && (
                        <span className={`px-1.5 rounded-full text-[10px] ${active === tab.id ? "bg-[#0A0E14] text-[#4FD1FF]" : "bg-[#4FD1FF] text-[#0A0E14]"}`}>
                            {tab.badge}
                        </span>
                    )}
                </button>
            ))}
        </div>
    );
}

function activeClass(isActive: boolean): string {
    return isActive
        ? "text-[#0A0E14] bg-[#4FD1FF]"
        : "text-[#8B8F98] bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.09)] hover:text-[#E5E7EB]";
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
    const [friendsSubTab, setFriendsSubTab] = useState<FriendsSubTab>("list");
    const [accountSubTab, setAccountSubTab] = useState<AccountSubTab>("about");

    const [editingNickname, setEditingNickname] = useState(false);
    const [tempNickname, setTempNickname] = useState(nickname);
    const [walletCopied, setWalletCopied] = useState(false);

    const [friendQuery, setFriendQuery] = useState("");
    const friendSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [isComposing, setIsComposing] = useState(false);
    const [composeTarget, setComposeTarget] = useState("");
    const [composeSubject, setComposeSubject] = useState("");
    const [composeBody, setComposeBody] = useState("");
    const [expandedMailId, setExpandedMailId] = useState<string | null>(null);

    const wasOpenRef = useRef(false);

    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            setActiveTab(initialTab);
        }
        wasOpenRef.current = isOpen;
    }, [isOpen, initialTab]);

    useEffect(() => {
        if (!isOpen) return;
        if (activeTab === "friends") onRequestFriendsList();
        if (activeTab === "mail") onRequestMailInbox();
        if (activeTab === "account" && accountSubTab === "about") onRequestSelfProfile();
    }, [isOpen, activeTab, accountSubTab]);

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

    if (!isOpen) return null;

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

    const handleSendCompose = () => {
        if (!composeTarget.trim() || !composeSubject.trim() || !composeBody.trim()) return;
        onSendMail(resolveTarget(composeTarget), composeSubject.trim(), composeBody.trim());
        setIsComposing(false);
        setComposeTarget("");
        setComposeSubject("");
        setComposeBody("");
    };

    const friendStatus = (userId: string): "friend" | "incoming" | "outgoing" | "none" => {
        if (friends.some((f) => f.userId === userId)) return "friend";
        if (incomingRequests.some((r) => r.userId === userId)) return "incoming";
        if (outgoingRequests.some((r) => r.userId === userId)) return "outgoing";
        return "none";
    };

    return (
        <WindowFrame
            isOpen={isOpen}
            onClose={onClose}
            title="Social"
            icon={<Users className="w-4 h-4" />}
            tabs={[
                { id: "friends", label: "Friends", icon: <Users className="w-3.5 h-3.5" /> },
                { id: "mail", label: "Mail", icon: <MailIcon className="w-3.5 h-3.5" /> },
                { id: "account", label: "Account", icon: <User className="w-3.5 h-3.5" /> },
            ]}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as SocialTab)}
        >
            {activeTab === "friends" && (
                <div>
                    <SubTabs
                        tabs={[
                            { id: "list", label: "Friends", badge: incomingRequests.length },
                            { id: "search", label: "Search" },
                        ]}
                        active={friendsSubTab}
                        onChange={(id) => setFriendsSubTab(id as FriendsSubTab)}
                    />

                    {friendsSubTab === "list" && (
                        <div className="space-y-4">
                            {incomingRequests.length > 0 && (
                                <div>
                                    <span className="text-[#8B8F98] text-xs font-bold tracking-wider">REQUESTS</span>
                                    <div className="mt-2 space-y-2">
                                        {incomingRequests.map((r) => (
                                            <div
                                                key={r.userId}
                                                className="flex items-center justify-between bg-[rgba(255,209,102,0.06)] border border-[rgba(255,209,102,0.2)] rounded-lg p-3"
                                            >
                                                <button
                                                    onClick={() => onViewProfile(r.wallet)}
                                                    className="text-[#E5E7EB] text-sm font-bold hover:underline text-left"
                                                >
                                                    {r.nickname || truncateWallet(r.wallet)}
                                                </button>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => onAcceptFriendRequest(r.userId)}
                                                        className="w-7 h-7 rounded-lg flex items-center justify-center bg-[rgba(74,222,128,0.15)] text-[#4ADE80] hover:bg-[rgba(74,222,128,0.25)] transition-colors"
                                                        title="Accept"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => onDeclineFriendRequest(r.userId)}
                                                        className="w-7 h-7 rounded-lg flex items-center justify-center bg-[rgba(248,113,113,0.15)] text-red-400 hover:bg-[rgba(248,113,113,0.25)] transition-colors"
                                                        title="Decline"
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
                                        <p className="text-[#8B8F98] text-sm text-center py-6">No friends yet. Search to add some.</p>
                                    ) : (
                                        friends.map((f) => (
                                            <div key={f.userId} className="flex items-center justify-between bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${f.online ? "bg-[#4ADE80]" : "bg-[#6B7280]"}`} />
                                                    <button
                                                        onClick={() => onViewProfile(f.wallet)}
                                                        className="text-[#E5E7EB] text-sm font-bold hover:underline truncate text-left"
                                                    >
                                                        {f.nickname || truncateWallet(f.wallet)}
                                                    </button>
                                                    <span className={`text-xs flex-shrink-0 ${f.online ? "text-[#4ADE80]" : "text-[#6B7280]"}`}>
                                                        {f.online ? "Online" : "Offline"}
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => onRemoveFriend(f.userId)}
                                                    className="text-[#8B8F98] hover:text-red-400 transition-colors flex-shrink-0"
                                                    title="Remove friend"
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
                                    <span className="text-[#8B8F98] text-xs font-bold tracking-wider">PENDING</span>
                                    <div className="mt-2 space-y-2">
                                        {outgoingRequests.map((r) => (
                                            <div key={r.userId} className="flex items-center justify-between bg-[rgba(255,255,255,0.03)] rounded-lg p-3">
                                                <span className="text-[#8B8F98] text-sm">{r.nickname || truncateWallet(r.wallet)}</span>
                                                <span className="text-[#6B7280] text-xs">Pending</span>
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
                                    placeholder="Search by wallet or nickname..."
                                    className="w-full bg-zinc-900 text-white pl-9 pr-3 py-2 rounded text-sm border border-zinc-700 focus:border-cyan-500 outline-none"
                                />
                            </div>

                            <div className="space-y-2">
                                {friendQuery.trim().length === 0 ? (
                                    <p className="text-[#8B8F98] text-sm text-center py-6">Search for players to add as friends.</p>
                                ) : friendSearchResults.length === 0 ? (
                                    <p className="text-[#8B8F98] text-sm text-center py-6">No players found.</p>
                                ) : (
                                    friendSearchResults.map((r) => {
                                        const status = friendStatus(r.userId);
                                        return (
                                            <div key={r.userId} className="flex items-center justify-between bg-[rgba(255,255,255,0.04)] rounded-lg p-3">
                                                <button
                                                    onClick={() => onViewProfile(r.wallet)}
                                                    className="text-[#E5E7EB] text-sm font-bold hover:underline text-left truncate"
                                                >
                                                    {r.nickname || truncateWallet(r.wallet)}
                                                </button>
                                                {status === "friend" && <span className="text-[#4ADE80] text-xs flex-shrink-0">Friends</span>}
                                                {status === "outgoing" && <span className="text-[#6B7280] text-xs flex-shrink-0">Pending</span>}
                                                {status === "incoming" && (
                                                    <button
                                                        onClick={() => onAcceptFriendRequest(r.userId)}
                                                        className="btn-primary px-3 py-1.5 text-xs flex-shrink-0"
                                                    >
                                                        Accept
                                                    </button>
                                                )}
                                                {status === "none" && (
                                                    <button
                                                        onClick={() => onSendFriendRequest({ wallet: r.wallet })}
                                                        className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 flex-shrink-0"
                                                    >
                                                        <UserPlus className="w-3.5 h-3.5" />
                                                        Add
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
            )}

            {activeTab === "mail" && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[#8B8F98] text-xs font-bold tracking-wider">
                            INBOX {unreadMailCount > 0 && <span className="text-[#4FD1FF]">({unreadMailCount} unread)</span>}
                        </span>
                        <button
                            onClick={() => setIsComposing((v) => !v)}
                            className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"
                        >
                            <Send className="w-3.5 h-3.5" />
                            Compose
                        </button>
                    </div>

                    {isComposing && (
                        <div className="bg-[rgba(255,255,255,0.04)] rounded-lg p-4 space-y-2.5">
                            <input
                                type="text"
                                value={composeTarget}
                                onChange={(e) => setComposeTarget(e.target.value)}
                                placeholder="Recipient wallet or nickname..."
                                className="w-full bg-zinc-900 text-white px-3 py-2 rounded text-sm border border-zinc-700 focus:border-cyan-500 outline-none"
                            />
                            <input
                                type="text"
                                value={composeSubject}
                                onChange={(e) => setComposeSubject(e.target.value.slice(0, 100))}
                                placeholder="Subject..."
                                className="w-full bg-zinc-900 text-white px-3 py-2 rounded text-sm border border-zinc-700 focus:border-cyan-500 outline-none"
                            />
                            <textarea
                                value={composeBody}
                                onChange={(e) => setComposeBody(e.target.value.slice(0, 2000))}
                                placeholder="Message..."
                                rows={4}
                                className="w-full bg-zinc-900 text-white px-3 py-2 rounded text-sm border border-zinc-700 focus:border-cyan-500 outline-none resize-none"
                            />
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleSendCompose}
                                    disabled={!composeTarget.trim() || !composeSubject.trim() || !composeBody.trim()}
                                    className="btn-primary px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Send
                                </button>
                                <button onClick={() => setIsComposing(false)} className="btn-secondary px-4 py-2 text-sm">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        {mail.length === 0 ? (
                            <div className="text-center py-10">
                                <Inbox className="w-8 h-8 text-[#6B7280] mx-auto mb-2" />
                                <p className="text-[#8B8F98] text-sm">Your inbox is empty.</p>
                            </div>
                        ) : (
                            mail.map((m) => {
                                const isExpanded = expandedMailId === m.id;
                                return (
                                    <div
                                        key={m.id}
                                        className={`rounded-lg p-3 cursor-pointer transition-colors ${m.isRead ? "bg-[rgba(255,255,255,0.03)]" : "bg-[rgba(79,209,255,0.06)] border border-[rgba(79,209,255,0.2)]"
                                            }`}
                                        onClick={() => {
                                            setExpandedMailId(isExpanded ? null : m.id);
                                            if (!m.isRead) onMarkMailRead(m.id);
                                        }}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {!m.isRead && <span className="w-2 h-2 rounded-full bg-[#4FD1FF] flex-shrink-0" />}
                                                <span className="text-[#E5E7EB] text-sm font-bold truncate">{m.subject}</span>
                                            </div>
                                            <span className="text-[#6B7280] text-xs flex-shrink-0">{formatMailDate(m.createdAt)}</span>
                                        </div>
                                        <p className="text-[#8B8F98] text-xs mt-1">From {m.senderNickname || truncateWallet(m.senderWallet)}</p>
                                        {isExpanded && <p className="text-[#E5E7EB] text-sm mt-2 whitespace-pre-wrap">{m.body}</p>}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {activeTab === "account" && (
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
                                            {selfProfile?.faction?.image && (
                                                <img src={selfProfile.faction.image} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                                            )}
                                            <span className="text-[#E5E7EB] text-xl font-bold">{nickname}</span>
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
            )}
        </WindowFrame>
    );
}
