// src/features/game/core/GameCallbacks.ts
import { ChatMessage } from "../ui/Chat";
import {
    InventoryEntry,
    QuestInfoData,
    QuestUpdateData,
    CanyonSegmentData,
    CanyonMapData,
    FactionSummary,
    FactionDetail,
    FactionTaskDefinition,
    PlayerProfileData,
    LeaderboardEntry,
    FriendEntry,
    FriendRequestEntry,
    MailEntry,
    BlockedEntry,
    TradeSessionData,
} from "../network/NetworkManager";
import type { HUDState, DamageEvent } from "./Game";

export interface GameCallbacks {
    onHitMark?: () => void;
    onStateChange?: (state: HUDState) => void;
    onNotification?: (msg: string, duration?: number) => void;
    onLoadStateChange?: (loading: boolean, message?: string) => void;
    onChatMessage?: (message: ChatMessage) => void;
    onNicknameLoaded?: (nickname: string) => void;
    onDamageEvent?: (event: DamageEvent) => void;
    onDeathStateChange?: (isDead: boolean, killerName: string | null) => void;
    onAuthError?: (error: string) => void;
    onDamageIndicatorUpdate?: (attackerId: string | null, direction: number) => void;

    onFloorSelectorToggle?: (isOpen: boolean) => void;
    onLocationChange?: (id: string) => void;

    onOpenTokenUI?: (tokenData: any) => void;
    onOpenVendorUI?: () => void;
    onOpenSolaUI?: () => void;
    onOpenAlfredoUI?: () => void;
    onOpenGateStewardUI?: () => void;
    onOpenCanyonMapUI?: () => void;
    onEquippedToolChange?: (tool: "weapon" | "blueprint" | null) => void;
    onOpenSignEditorUI?: (signId: string) => void;
    onOpenSignViewerUI?: (sign: {
        id: string;
        ownerNickname: string;
        contentType: "text" | "draw" | null;
        textContent: string | null;
        drawingUrl: string | null;
    }) => void;
    onOpenItemEditorUI?: (itemId: string) => void;
    onOpenItemViewerUI?: (item: {
        id: string;
        ownerNickname: string;
        contentType: "text" | "draw" | null;
        textContent: string | null;
        drawingUrl: string | null;
    }) => void;
    onInventoryChange?: (inventory: InventoryEntry[], ash: number, placeables: Record<string, number>) => void;
    onSellResult?: (data: { address: string; quantitySold: number; ashEarned: number; marketCap: number }) => void;
    onQuestInfo?: (data: QuestInfoData) => void;
    onQuestUpdate?: (data: QuestUpdateData) => void;
    onCanyonSegment?: (data: CanyonSegmentData) => void;
    onCanyonMap?: (data: CanyonMapData) => void;

    onOpenFactionBrokerUI?: () => void;
    onFactionCreated?: (faction: FactionSummary) => void;
    onFactionJoined?: (faction: FactionSummary) => void;
    onFactionLeft?: (factionId: string) => void;
    onFactionSearchResult?: (results: FactionSummary[]) => void;
    onFactionListResult?: (data: { results: FactionSummary[]; page: number }) => void;
    onFactionInfo?: (faction: FactionDetail | null) => void;
    onFactionMyListResult?: (factions: FactionSummary[]) => void;
    onFactionDisplayedSet?: (faction: FactionSummary) => void;
    onSelfProfile?: (profile: PlayerProfileData | null) => void;
    onViewedProfile?: (profile: PlayerProfileData | null) => void;
    onLeaderboardResult?: (leaderboard: LeaderboardEntry[]) => void;
    onFactionLeaderboardResult?: (leaderboard: FactionSummary[]) => void;
    onFactionTaskListResult?: (tasks: FactionTaskDefinition[]) => void;
    onFactionTaskAccepted?: (faction: FactionSummary) => void;
    onFactionTaskCompleted?: (data: { taskKey: string; label: string; rewardAsh: number; rewardNickname: string | null }) => void;
    onFactionCreatorClaimResult?: (data: { isCreator: boolean; faction: FactionSummary }) => void;
    onFactionCreatorVerified?: (faction: FactionSummary) => void;

    onFriendRequestSent?: (friend: FriendRequestEntry, status: string) => void;
    onFriendRequestAccepted?: (friend: FriendEntry) => void;
    onFriendRequestDeclined?: (requestUserId: string) => void;
    onFriendRemoved?: (friendUserId: string) => void;
    onFriendsListResult?: (data: { friends: FriendEntry[]; incoming: FriendRequestEntry[]; outgoing: FriendRequestEntry[] }) => void;
    onFriendSearchResult?: (results: FriendRequestEntry[]) => void;
    onMailSent?: (mailId: string) => void;
    onMailInboxResult?: (data: { mail: MailEntry[]; unreadCount: number }) => void;
    onMailMarkedRead?: (mailId: string) => void;
    onMailReceived?: (data: { mailId: string; senderNickname: string; subject: string }) => void;
    onFriendRequestReceived?: (friend: FriendRequestEntry) => void;
    onVoiceCapturingChange?: (capturing: boolean) => void;

    onUserBlocked?: (entry: BlockedEntry) => void;
    onUserUnblocked?: (blockedUserId: string) => void;
    onBlockedListResult?: (blocked: BlockedEntry[]) => void;
    onPrivateMessage?: (data: { fromWallet: string; fromNickname: string; text: string; timestamp: number }) => void;
    onPrivateMessageSent?: (data: { toWallet: string; toNickname: string; text: string; timestamp: number }) => void;
    onPrivateMessageError?: (data: { code: string; toWallet: string }) => void;
    onFactionChatMessage?: (data: ChatMessage & { factionId: string }) => void;
    onFactionInviteSent?: (toWallet: string) => void;
    onMySkinChange?: (url: string | null) => void;
    onTradeSession?: (data: TradeSessionData) => void;
    onTradeInviteReceived?: (data: { tradeId: string; fromWallet: string; fromNickname: string }) => void;
    onTradeInviteError?: (data: { code: string; toWallet: string }) => void;
}
