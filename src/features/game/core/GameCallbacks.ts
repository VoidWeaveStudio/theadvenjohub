// src/features/game/core/GameCallbacks.ts
import { ChatMessage } from "../ui/Chat";
import type { BuildSessionState } from "../world/building/BuildSession";
import {
    InventoryEntry,
    StorageEntry,
    RespawnOptions,
    DeathLootInfo,
    PartyStateData,
    PartyVitalsData,
    PartyInviteData,
    ArenaStateData,
    ArenaEndedData,
    QuestInfoData,
    QuestUpdateData,
    CanyonSegmentData,
    CanyonMapData,
    FactionSummary,
    FactionDetail,
    FactionTaskDefinition,
    FactionQuestEntry,
    FactionQuestManaged,
    FactionQuestManageData,
    PlayerProfileData,
    LeaderboardEntry,
    FriendEntry,
    FriendRequestEntry,
    MailEntry,
    BlockedEntry,
    TradeSessionData,
    CosmeticStateData,
    FactionGateData,
    ShardStateData,
    ProgressionStateData,
    XpGainData,
    LevelUpData,
    PlayerLevelUpdateData,
    AbilityResultData,
    AbilityMeterData,
    AbilityTriggerData,
    MemeResultData,
} from "../network/NetworkManager";
import type { HUDState, DamageEvent } from "./Game";
import type { BranchId } from "../data/progression";

export interface GameCallbacks {
    onHitMark?: () => void;
    onStateChange?: (state: HUDState) => void;
    onNotification?: (msg: string, duration?: number) => void;
    onLoadStateChange?: (loading: boolean, message?: string, progress?: number) => void;
    onChatMessage?: (message: ChatMessage) => void;
    onNicknameLoaded?: (nickname: string) => void;
    onLocalPlayerId?: (playerId: string) => void;
    onDamageEvent?: (event: DamageEvent) => void;
    onDeathStateChange?: (isDead: boolean, killerName: string | null, options?: RespawnOptions, loot?: DeathLootInfo) => void;
    onAuthError?: (error: string) => void;
    onDamageIndicatorUpdate?: (attackerId: string | null, direction: number) => void;
    onCombatStateChange?: (until: number) => void;
    onStuckStateChange?: (cooldownUntil: number) => void;
    onHomeTeleportChange?: (state: { casting: boolean; castMs: number; cooldownUntil: number; charges: number }) => void;
    onStorageState?: (state: { key: string | null; slots: number; entries: StorageEntry[]; filled: string[] }) => void;
    onPartyState?: (state: PartyStateData) => void;
    onPartyVitals?: (members: PartyVitalsData[]) => void;
    onPartyInvite?: (invite: PartyInviteData) => void;
    onPartyInviteExpired?: (fromId: string) => void;
    onPartyDisbanded?: (reason: string) => void;
    onOpenArenaUI?: () => void;
    onArenaState?: (state: ArenaStateData) => void;
    onArenaEnded?: (data: ArenaEndedData) => void;
    onArenaCandleDamage?: (health: number, maxHealth: number) => void;
    onArenaReviveResult?: (data: { channelling: boolean; targetId?: string; channelMs?: number }) => void;
    onArenaStartResult?: (cooldownUntil: number) => void;

    onFloorSelectorToggle?: (isOpen: boolean) => void;
    onBuildEditorState?: (state: BuildSessionState) => void;
    onLocationChange?: (id: string) => void;

    onOpenTokenUI?: (tokenData: any) => void;
    onOpenVendorUI?: () => void;
    onOpenSolaUI?: () => void;
    onOpenAlfredoUI?: () => void;
    onOpenGateStewardUI?: () => void;
    onOpenPlayerBubbleUI?: (bubbleIndex: number) => void;
    onOpenFactionBubbleUI?: (factionId: string) => void;
    onOpenRoomPortalUI?: () => void;
    onOpenRoomConsoleUI?: (factionId: string | null) => void;
    onFactionGatesChange?: (gates: FactionGateData[]) => void;
    onAccountCountChange?: (count: number) => void;
    onShardStateChange?: (state: ShardStateData) => void;
    onOpenCanyonMapUI?: () => void;
    onEquippedToolChange?: (tool: "weapon" | "blueprint" | null) => void;
    onOpenSignEditorUI?: (signId: string) => void;
    onOpenPosterPaintUI?: (pieceKey: string) => void;
    onOpenSignViewerUI?: (sign: {
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
    onNpcMet?: (metNpcs: string[]) => void;
    onProgressionState?: (data: ProgressionStateData) => void;
    onXpGain?: (data: XpGainData) => void;
    onLevelUp?: (data: LevelUpData) => void;
    onPlayerLevelUpdate?: (data: PlayerLevelUpdateData) => void;
    onBranchSelected?: (branch: BranchId) => void;
    onSkillsRespecced?: (data: { costAsh: number }) => void;
    onSkillLearned?: (data: { nodeId: string; rank: number }) => void;
    onSkillLearnRejected?: (data: { nodeId: string; reason: string }) => void;
    onAbilityResult?: (data: AbilityResultData) => void;
    onAbilityMeter?: (data: AbilityMeterData) => void;
    onAbilityTrigger?: (data: AbilityTriggerData) => void;
    onFireModeChanged?: (mode: string) => void;
    onMemeResult?: (data: MemeResultData) => void;
    onCanyonSegment?: (data: CanyonSegmentData) => void;
    onCanyonMap?: (data: CanyonMapData) => void;

    onOpenFactionBrokerUI?: () => void;
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
    onFactionQuestListResult?: (quests: FactionQuestEntry[]) => void;
    onFactionQuestManageListResult?: (data: FactionQuestManageData) => void;
    onFactionQuestCreated?: (data: { quest: FactionQuestManaged & { factionId: string }; chargedAsh: number }) => void;
    onFactionQuestClaimed?: (data: { questId: string; rewardAsh: number; slotsClaimed: number; slotsTotal: number; status: string }) => void;

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
    onCosmeticState?: (data: CosmeticStateData) => void;
    onSpawnProtectionChange?: (secondsLeft: number) => void;
    onTradeSession?: (data: TradeSessionData) => void;
    onTradeInviteReceived?: (data: { tradeId: string; fromWallet: string; fromNickname: string }) => void;
    onTradeInviteError?: (data: { code: string; toWallet: string }) => void;
}
