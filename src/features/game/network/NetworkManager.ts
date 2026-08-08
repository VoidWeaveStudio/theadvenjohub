// src/features/game/network/NetworkManager.ts
import { EmoteKey, isEmoteKey } from "../data/emotes";
import { CosmeticId, normalizeLoadout } from "../data/cosmetics";

export type PlayerNetData = {
  id: string;
  nickname: string;
  factionSymbol?: string | null;
  factionImage?: string | null;
  position: number[];
  rotation: number;
  pitch: number;
  state: 'idle' | 'walk' | 'sprint' | 'jump';
  jumping: boolean;
  velocityY: number;
  health: number;
  alive: boolean;
  weaponEquipped: boolean;
  isShooting: boolean;
  locationId?: string;
  isAdmin?: boolean;
  isFactionCreator?: boolean;
  skinTextureUrl?: string | null;
  cosmeticSkinId?: string | null;
  cosmeticAccessoryId?: string | null;
};

export type CosmeticStateData = {
  owned: CosmeticId[];
  skinId: CosmeticId | null;
  accessoryId: CosmeticId | null;
};

export type DayNightSyncData = {
  epoch: number;
  dayDurationMs: number;
  nightDurationMs: number;
};

export type EnemyNetData = {
  id: string;
  type?: string;
  position: number[];
  health: number;
  maxHealth: number;
  alive: boolean;
  targetId: string | null;
};

export type CanyonSegmentData = {
  segment: number;
  maxSegmentReached: number;
  cleared: boolean;
  name: string;
  biome?: string;
};

export type CanyonClearedData = {
  clearedSegment: number;
  segment: number;
  maxSegmentReached: number;
  name: string;
  biome?: string;
};

export type CanyonMapData = {
  segment: number;
  maxSegmentReached: number;
  clearedSegments: number[];
};

export type CanyonHubData = {
  maxSegmentReached: number;
};

export type LootTokenData = {
  address: string;
  name: string;
  symbol: string;
  image: string;
  pickedUpAt?: number;
};

export type LootDropData = {
  id: string;
  position: number[];
  tokens: LootTokenData[];
};

export type SignData = {
  id: string;
  ownerId: string;
  ownerNickname: string;
  position: number[];
  rotation: number;
  contentType: "text" | "draw" | null;
  textContent: string | null;
  drawingUrl: string | null;
  createdAt: string | number;
};

export type FurnitureData = {
  id: string;
  itemId: string;
  ownerId: string;
  ownerNickname: string;
  factionId: string;
  position: number[];
  rotation: number;
  contentType: "text" | "draw" | null;
  textContent: string | null;
  drawingUrl: string | null;
  createdAt: string | number;
};

export type FactionGateData = {
  factionId: string;
  factionName: string;
  symbol: string | null;
  image: string | null;
  tokenCa: string | null;
};

export type QuestStatus = "not_started" | "active" | "ready_to_turn_in" | "completed";

export type QuestInfoData = {
  questId: string;
  npc: string;
  title: string;
  description: string;
  targetCount: number;
  rewardAsh: number;
  status: QuestStatus;
  progress: number;
};

export type QuestUpdateData = {
  questId: string;
  status: QuestStatus;
  progress: number;
  targetCount: number;
  rewardAsh?: number;
};

export type InventoryEntry = {
  address: string;
  name: string;
  symbol: string;
  image: string;
  quantity: number;
};

export type TradePhase =
  | "pending_accept"
  | "negotiating"
  | "awaiting_payment"
  | "settling"
  | "completed"
  | "failed"
  | "declined"
  | "cancelled"
  | "expired";

export type TradeParticipant = {
  userId: string;
  wallet: string;
  nickname: string | null;
  ready: boolean;
};

export type TradeSessionData = {
  tradeId: string;
  phase: TradePhase;
  sellerId: string | null;
  itemId: string | null;
  itemName: string | null;
  priceTnj: number | null;
  participants: TradeParticipant[];
  reason?: string;
  critical?: boolean;
};

export interface GameSession {
  gameToken: string;
  serverUrl: string;
  userId: string;
  wallet: string;
}

export type FactionTaskDefinition = {
  key: string;
  label: string;
  description: string;
  metric: 'kills' | 'shots' | 'ash';
  target: number;
  rewardAsh: number;
};

export type FactionActiveTask = {
  key: string;
  target: number;
  progress: number;
  rewardAsh: number;
  acceptedAt: string | null;
  acceptedByNickname: string | null;
};

export type FactionTaskLogEntry = {
  id: string;
  taskKey: string;
  rewardAsh: number;
  rewardWallet: string;
  rewardNickname: string | null;
  completedAt: string;
};

export type FactionQuestType = {
  key: string;
  label: string;
  description: string;
};

export type FactionQuestEntry = {
  id: string;
  factionId: string;
  factionName: string;
  factionSymbol: string | null;
  factionImage: string | null;
  factionTokenCa: string | null;
  questType: string;
  targetUrl: string;
  rewardAsh: number;
  slotsTotal: number;
  slotsClaimed: number;
  slotsRemaining: number;
  isOwnQuest: boolean;
  completedByMe: boolean;
  createdAt: string;
};

export type FactionQuestManaged = {
  id: string;
  questType: string;
  targetUrl: string;
  rewardAsh: number;
  slotsTotal: number;
  slotsClaimed: number;
  slotsRemaining: number;
  bankAsh: number;
  paidOutAsh: number;
  bankRemainingAsh: number;
  listingFeeAsh: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
};

export type FactionQuestManageData = {
  factionId: string;
  canManage: boolean;
  questTypes: FactionQuestType[];
  listingFeeAsh: number;
  quests: FactionQuestManaged[];
};

export type FactionSummary = {
  id: string;
  number: number;
  name: string;
  symbol: string | null;
  image: string | null;
  description: string;
  tokenCa: string | null;
  founderWallet: string;
  memberCount: number;
  rank: number | null;
  role?: string;
  isDisplayed?: boolean;
  tokenCreatorWallet?: string | null;
  verifiedCreatorWallet?: string | null;
  verifiedCreatorUserId?: string | null;
  activeTask?: FactionActiveTask | null;
  taskHistory?: FactionTaskLogEntry[];
  level: number;
  levelProgressAsh: number;
  xpForNextLevel: number;
  promoCode?: string | null;
};

export type FactionRosterEntry = {
  wallet: string;
  role: string;
  nickname: string | null;
  contributionPoints: number;
};

export type FactionDetail = FactionSummary & {
  roster: FactionRosterEntry[];
};

export type FactionTag = {
  name: string;
  symbol: string | null;
  image: string | null;
  number: number;
} | null;

export type PlayerProfileFaction = {
  id: string;
  number: number;
  name: string;
  symbol: string | null;
  image: string | null;
  founderWallet: string;
  verifiedCreatorWallet: string | null;
  isDisplayed: boolean;
};

export type PlayerAchievementEntry = {
  key: string;
  label: string;
  description: string;
  unlockedAt: string;
};

export type PlayerProfileData = {
  wallet: string;
  nickname: string | null;
  kills: number;
  deaths: number;
  playtimeSeconds: number;
  ash: number;
  factions: PlayerProfileFaction[];
  achievements: PlayerAchievementEntry[];
  isAdmin?: boolean;
};

export type LeaderboardEntry = {
  wallet: string;
  nickname: string | null;
  kills: number;
  deaths: number;
  ash: number;
  playtimeSeconds: number;
  score: number;
  faction: FactionTag;
  isAdmin?: boolean;
  isFactionCreator?: boolean;
};

export type FriendEntry = {
  userId: string;
  wallet: string;
  nickname: string | null;
  online: boolean;
  faction?: FactionTag;
  isAdmin?: boolean;
  isFactionCreator?: boolean;
};

export type FriendRequestEntry = {
  userId: string;
  wallet: string;
  nickname: string | null;
  faction?: FactionTag;
  isAdmin?: boolean;
  isFactionCreator?: boolean;
};

export type BlockedEntry = {
  userId: string;
  wallet: string;
  nickname: string | null;
  isAdmin?: boolean;
  isFactionCreator?: boolean;
};

export type MailEntry = {
  id: string;
  senderUserId: string;
  senderWallet: string;
  senderNickname: string | null;
  senderFactionName?: string | null;
  senderFactionSymbol?: string | null;
  senderFactionImage?: string | null;
  senderFactionNumber?: number | null;
  subject: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

export class NetworkManager {
  private ws: WebSocket | null = null;
  private readonly baseReconnectInterval: number = 3000;
  private readonly maxReconnectInterval: number = 30000;
  private readonly maxReconnectAttempts: number = 8;
  private reconnectAttempts: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshSession: (() => Promise<GameSession | null>) | null = null;
  private nickname: string = "Player";
  private session: GameSession | null = null;
  private authenticated: boolean = false;

  private lastUpdateSent: number = 0;
  private updateThrottleMs: number = 50;

  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private lastPong: number = Date.now();
  private heartbeatTimeoutMs: number = 15000;

  public onPlayerLocationChange?: (data: {
    playerId: string;
    fromLocation: string;
    toLocation: string;
  }) => void;

  public onPlayerJoinLocation?: (data: PlayerNetData) => void;
  public onPlayerLeaveLocation?: (data: {
    playerId: string;
    fromLocation: string;
    toLocation: string;
  }) => void;

  public onInit?: (playerIds: string[]) => void;
  public onPlayerJoin?: (data: PlayerNetData) => void;
  public onPlayerLeave?: (playerId: string) => void;
  public onPlayerUpdate?: (data: PlayerNetData) => void;
  public onRemoteEmote?: (data: { playerId: string; key: EmoteKey }) => void;
  public onCosmeticState?: (data: CosmeticStateData) => void;
  public onSpawnProtection?: (data: { untilMs: number; durationMs: number }) => void;
  public onCosmeticUpdate?: (data: { playerId: string; skinId: CosmeticId | null; accessoryId: CosmeticId | null }) => void;
  public onShoot?: (data: { id: string; origin: number[]; direction: number[] }) => void;
  public onDisconnected?: () => void;
  public onCount?: (count: number) => void;
  public onChatMessage?: (data: { id: string; sender: string; senderWallet?: string; senderFactionSymbol?: string | null; senderFactionImage?: string | null; senderIsAdmin?: boolean; senderIsFactionCreator?: boolean; message: string; timestamp: number }) => void;
  public onVoiceOffer?: (data: { fromId: string; sdp: string }) => void;
  public onVoiceAnswer?: (data: { fromId: string; sdp: string }) => void;
  public onVoiceIceCandidate?: (data: { fromId: string; candidate: RTCIceCandidateInit }) => void;
  public onAuthenticated?: (data: { playerId: string; nickname: string; skinTextureUrl?: string | null }) => void;
  public onProgressLoaded?: (data: any) => void;
  public onAuthError?: (error: string) => void;
  public onSessionRevoked?: () => void;
  public onReconnectFailed?: () => void;

  public onPlayerDamaged?: (data: {
    targetId: string;
    attackerId: string;
    damage: number;
    health: number;
    point: number[];
    historicalPosition?: number[];
  }) => void;

  public onPlayerDeath?: (data: {
    playerId: string;
    killerId: string;
    position: number[];
  }) => void;

  public onPlayerRespawn?: (data: {
    id: string;
    position: number[];
    health: number;
  }) => void;

  public onRespawn?: (data: {
    position: number[];
    health: number;
  }) => void;

  public onDayNightSync?: (data: DayNightSyncData) => void;

  public onEnemyState?: (enemies: EnemyNetData[]) => void;
  public onEnemyDamaged?: (data: {
    id: string;
    health: number;
    attackerId: string;
    point: number[];
  }) => void;
  public onEnemyDeath?: (data: { id: string; killerId: string }) => void;
  public onEnemyRespawn?: (data: {
    id: string;
    position: number[];
    health: number;
    maxHealth: number;
  }) => void;

  public onLootState?: (loot: LootDropData[]) => void;
  public onLootSpawn?: (loot: LootDropData) => void;
  public onLootDespawn?: (id: string) => void;
  public onFactionGatesState?: (gates: FactionGateData[]) => void;
  public onSignState?: (signs: SignData[]) => void;
  public onSignSpawn?: (sign: SignData) => void;
  public onSignContentSet?: (data: { id: string; contentType: "text" | "draw"; textContent?: string; drawingUrl?: string }) => void;
  public onSignDespawn?: (id: string) => void;

  public onFurnitureState?: (items: FurnitureData[]) => void;
  public onFurnitureSpawn?: (item: FurnitureData) => void;
  public onFurnitureContentSet?: (data: { id: string; contentType: "text" | "draw"; textContent?: string; drawingUrl?: string }) => void;
  public onFurnitureDespawn?: (id: string) => void;
  public onInventoryUpdate?: (data: { inventory: InventoryEntry[]; ash: number; placeables: Record<string, number> }) => void;
  public onSellResult?: (data: {
    address: string;
    quantitySold: number;
    ashEarned: number;
    marketCap: number;
  }) => void;
  public onQuestInfo?: (data: QuestInfoData) => void;
  public onQuestUpdate?: (data: QuestUpdateData) => void;
  public onCanyonSegment?: (data: CanyonSegmentData) => void;
  public onCanyonCleared?: (data: CanyonClearedData) => void;
  public onCanyonMap?: (data: CanyonMapData) => void;
  public onCanyonHub?: (data: CanyonHubData) => void;
  public onServerError?: (message: string) => void;
  public onPositionCorrection?: (data: { position: number[] }) => void;

  public onFactionCreated?: (faction: FactionSummary) => void;
  public onFactionJoined?: (faction: FactionSummary) => void;
  public onFactionLeft?: (factionId: string) => void;
  public onFactionSearchResult?: (results: FactionSummary[]) => void;
  public onFactionListResult?: (data: { results: FactionSummary[]; page: number }) => void;
  public onFactionInfo?: (faction: FactionDetail | null) => void;
  public onFactionMyListResult?: (factions: FactionSummary[]) => void;
  public onFactionDisplayedSet?: (faction: FactionSummary) => void;
  public onPlayerProfile?: (profile: PlayerProfileData | null) => void;
  public onLeaderboardResult?: (leaderboard: LeaderboardEntry[]) => void;
  public onFactionLeaderboardResult?: (leaderboard: FactionSummary[]) => void;
  public onFactionTaskListResult?: (tasks: FactionTaskDefinition[]) => void;
  public onFactionTaskAccepted?: (faction: FactionSummary) => void;
  public onFactionTaskCompleted?: (data: { taskKey: string; label: string; rewardAsh: number; rewardNickname: string | null }) => void;
  public onFactionCreatorClaimResult?: (data: { isCreator: boolean; faction: FactionSummary }) => void;
  public onFactionCreatorVerified?: (faction: FactionSummary) => void;
  public onFactionQuestListResult?: (quests: FactionQuestEntry[]) => void;
  public onFactionQuestManageListResult?: (data: FactionQuestManageData) => void;
  public onFactionQuestCreated?: (data: { quest: FactionQuestManaged & { factionId: string }; chargedAsh: number }) => void;
  public onFactionQuestClaimed?: (data: { questId: string; rewardAsh: number; slotsClaimed: number; slotsTotal: number; status: string }) => void;

  public onMailReceived?: (data: { mailId: string; senderNickname: string; subject: string }) => void;
  public onFriendRequestReceived?: (friend: FriendRequestEntry) => void;

  public onFriendRequestSent?: (friend: FriendRequestEntry, status: string) => void;
  public onFriendRequestAccepted?: (friend: FriendEntry) => void;
  public onFriendRequestDeclined?: (requestUserId: string) => void;
  public onFriendRemoved?: (friendUserId: string) => void;
  public onFriendsListResult?: (data: { friends: FriendEntry[]; incoming: FriendRequestEntry[]; outgoing: FriendRequestEntry[] }) => void;
  public onFriendSearchResult?: (results: FriendRequestEntry[]) => void;

  public onMailSent?: (mailId: string) => void;
  public onMailInboxResult?: (data: { mail: MailEntry[]; unreadCount: number }) => void;
  public onMailMarkedRead?: (mailId: string) => void;
  public onTokenInfoSent?: (mailId: string) => void;
  public onSupportTicketSent?: () => void;
  public onAchievementsUnlocked?: (achievements: { key: string; label: string }[]) => void;
  public onNicknameChanged?: (nickname: string) => void;
  public onOtherPlayerNicknameChange?: (data: { id: string; nickname: string }) => void;
  public onSkinUpdate?: (data: { playerId: string; url: string | null }) => void;

  public onWeaponForceUnequip?: () => void;
  public onUserBlocked?: (entry: BlockedEntry) => void;
  public onUserUnblocked?: (blockedUserId: string) => void;
  public onBlockedListResult?: (blocked: BlockedEntry[]) => void;
  public onPrivateMessage?: (data: { fromWallet: string; fromNickname: string; text: string; timestamp: number }) => void;
  public onPrivateMessageSent?: (data: { toWallet: string; toNickname: string; text: string; timestamp: number }) => void;
  public onPrivateMessageError?: (data: { code: string; toWallet: string }) => void;
  public onFactionChatMessage?: (data: { id: string; factionId: string; sender: string; senderWallet?: string; senderFactionSymbol?: string | null; senderFactionImage?: string | null; senderIsAdmin?: boolean; senderIsFactionCreator?: boolean; message: string; timestamp: number }) => void;
  public onFactionInviteSent?: (toWallet: string) => void;

  public onTradeSession?: (data: TradeSessionData) => void;
  public onTradeInviteReceived?: (data: { tradeId: string; fromWallet: string; fromNickname: string }) => void;
  public onTradeInviteError?: (data: { code: string; toWallet: string }) => void;

  setSessionRefresher(fn: () => Promise<GameSession | null>) {
    this.refreshSession = fn;
  }

  connect(session: GameSession) {
    this.session = session;
    this.authenticated = false;

    try {
      this.ws = new WebSocket(session.serverUrl);

      this.ws.onopen = () => {
        this.send({
          type: "auth",
          token: session.gameToken,
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (e) {
        }
      };

      this.ws.onclose = (event) => {
        this.stopHeartbeat();
        this.authenticated = false;

        if (event.code === 1000) return;

        if (event.code === 4009) {
          this.onSessionRevoked?.();
          return;
        }

        this.onDisconnected?.();
        const needsFreshToken = event.code === 4001 || event.code === 4003;
        this.scheduleReconnect(needsFreshToken);
      };

      this.ws.onerror = () => { };
    } catch (e) {
    }
  }

  private scheduleReconnect(needsFreshToken: boolean) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.onReconnectFailed?.();
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.baseReconnectInterval * 2 ** (this.reconnectAttempts - 1),
      this.maxReconnectInterval
    );

    this.reconnectTimer = setTimeout(async () => {
      if (!this.session) return;

      if (needsFreshToken) {
        if (!this.refreshSession) {
          this.onReconnectFailed?.();
          return;
        }
        const fresh = await this.refreshSession().catch(() => null);
        if (!fresh) {
          this.onReconnectFailed?.();
          return;
        }
        this.session = fresh;
      }

      this.connect(this.session);
    }, delay);
  }

  private handleMessage(data: any) {
    switch (data.type) {
      case "ping":
        this.lastPong = Date.now();
        this.send({ type: "pong", t: data.t });
        break;
      case "pong":
        this.lastPong = Date.now();
        break;
      case "auth_success":
        this.authenticated = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.onAuthenticated?.({
          playerId: data.playerId,
          nickname: data.nickname,
          skinTextureUrl: data.skinTextureUrl ?? null,
        });
        if (typeof data.daySyncEpoch === "number") {
          this.onDayNightSync?.({
            epoch: data.daySyncEpoch,
            dayDurationMs: data.dayDurationMs,
            nightDurationMs: data.nightDurationMs,
          });
        }
        break;
      case "auth_error":
        this.onAuthError?.(data.error || "Authentication failed");
        break;
      case "progress_loaded":
        this.onProgressLoaded?.(data.progress);
        break;
      case "init":
        this.onInit?.(Array.isArray(data.players) ? data.players.map((p: any) => p.id) : []);
        if (data.players && Array.isArray(data.players)) {
          for (const p of data.players) {
            this.onPlayerJoin?.({
              id: p.id,
              nickname: p.nickname,
              factionSymbol: p.factionSymbol ?? null,
              factionImage: p.factionImage ?? null,
              position: p.position,
              rotation: p.rotation,
              pitch: p.pitch || 0,
              state: p.state || 'idle',
              jumping: !!p.jumping,
              velocityY: p.velocityY || 0,
              health: p.health ?? 100,
              alive: p.alive ?? true,
              weaponEquipped: p.weaponEquipped !== false,
              isShooting: p.isShooting || false,
              locationId: p.locationId || 'main-world',
              isAdmin: !!p.isAdmin,
              isFactionCreator: !!p.isFactionCreator,
              skinTextureUrl: p.skinTextureUrl ?? null,
            });
          }
        }
        break;
      case "playerJoin":
        this.onPlayerJoin?.({
          ...data,
          health: data.health ?? 100,
          alive: data.alive ?? true,
          weaponEquipped: data.weaponEquipped !== false,
          isShooting: data.isShooting || false,
          locationId: data.locationId || 'main-world',
        });
        break;
      case "emote":
        if (isEmoteKey(data.key)) this.onRemoteEmote?.({ playerId: data.playerId, key: data.key });
        break;
      case "spawnProtection":
        this.onSpawnProtection?.({
          untilMs: typeof data.untilMs === "number" ? data.untilMs : 0,
          durationMs: typeof data.durationMs === "number" ? data.durationMs : 0,
        });
        break;
      case "cosmeticState": {
        const loadout = normalizeLoadout(data.skinId, data.accessoryId);
        this.onCosmeticState?.({
          owned: Array.isArray(data.owned) ? data.owned : [],
          skinId: loadout.skinId,
          accessoryId: loadout.accessoryId,
        });
        break;
      }
      case "cosmeticUpdate": {
        const loadout = normalizeLoadout(data.skinId, data.accessoryId);
        this.onCosmeticUpdate?.({ playerId: data.playerId, ...loadout });
        break;
      }
      case "playerLeave":
        this.onPlayerLeave?.(data.playerId);
        break;
      case "playerUpdate":
        this.onPlayerUpdate?.({
          ...data,
          health: data.health ?? 100,
          alive: data.alive ?? true,
          weaponEquipped: data.weaponEquipped !== false,
          isShooting: data.isShooting || false,
          locationId: data.locationId || 'main-world',
        });
        break;
      case 'playerLeaveLocation':
        this.onPlayerLeaveLocation?.(data);
        break;
      case 'playerJoinLocation':
        this.onPlayerJoinLocation?.({
          ...data,
          health: data.health ?? 100,
          alive: data.alive ?? true,
          weaponEquipped: data.weaponEquipped !== false,
          isShooting: data.isShooting || false,
        });
        break;
      case "playerDamaged":
        this.onPlayerDamaged?.(data);
        break;
      case "playerDeath":
        this.onPlayerDeath?.(data);
        break;
      case "playerRespawn":
        this.onPlayerRespawn?.(data);
        break;
      case "respawn":
        this.onRespawn?.(data);
        break;
      case "shoot":
        this.onShoot?.(data);
        break;
      case "enemyState":
        if (Array.isArray(data.enemies)) {
          this.onEnemyState?.(data.enemies);
        }
        break;
      case "enemyDamaged":
        this.onEnemyDamaged?.(data);
        break;
      case "enemyDeath":
        this.onEnemyDeath?.(data);
        break;
      case "enemyRespawn":
        this.onEnemyRespawn?.(data);
        break;
      case "lootState":
        if (Array.isArray(data.loot)) {
          this.onLootState?.(data.loot);
        }
        break;
      case "factionGatesState":
        if (Array.isArray(data.gates)) {
          this.onFactionGatesState?.(data.gates);
        }
        break;
      case "lootSpawn":
        this.onLootSpawn?.({ id: data.id, position: data.position, tokens: data.tokens });
        break;
      case "lootDespawn":
        this.onLootDespawn?.(data.id);
        break;
      case "signState":
        if (Array.isArray(data.signs)) {
          this.onSignState?.(data.signs);
        }
        break;
      case "signSpawn":
        this.onSignSpawn?.(data.sign);
        break;
      case "signContentSet":
        this.onSignContentSet?.(data);
        break;
      case "signDespawn":
        this.onSignDespawn?.(data.id);
        break;
      case "furnitureState":
        if (Array.isArray(data.items)) {
          this.onFurnitureState?.(data.items);
        }
        break;
      case "furnitureSpawn":
        this.onFurnitureSpawn?.(data.item);
        break;
      case "furnitureContentSet":
        this.onFurnitureContentSet?.(data);
        break;
      case "furnitureDespawn":
        this.onFurnitureDespawn?.(data.id);
        break;
      case "inventoryUpdate":
        if (Array.isArray(data.inventory)) {
          this.onInventoryUpdate?.({ inventory: data.inventory, ash: data.ash ?? 0, placeables: data.placeables ?? {} });
        }
        break;
      case "sellResult":
        this.onSellResult?.(data);
        break;
      case "questInfo":
        this.onQuestInfo?.(data);
        break;
      case "questUpdate":
        this.onQuestUpdate?.(data);
        break;
      case "canyonSegment":
        this.onCanyonSegment?.(data);
        break;
      case "canyonCleared":
        this.onCanyonCleared?.(data);
        break;
      case "canyonMap":
        this.onCanyonMap?.(data);
        break;
      case "canyonHub":
        this.onCanyonHub?.(data);
        break;
      case "error":
        this.onServerError?.(data.message || "Server error");
        break;
      case "count":
        this.onCount?.(data.count);
        break;
      case "chat":
        this.onChatMessage?.(data);
        break;
      case "voiceOffer":
        this.onVoiceOffer?.(data);
        break;
      case "voiceAnswer":
        this.onVoiceAnswer?.(data);
        break;
      case "voiceIceCandidate":
        this.onVoiceIceCandidate?.(data);
        break;
      case "nicknameChange":
        this.onOtherPlayerNicknameChange?.(data);
        break;
      case "nicknameChanged":
        this.onNicknameChanged?.(data.nickname);
        break;
      case "skinUpdate":
        this.onSkinUpdate?.({ playerId: data.playerId, url: data.url ?? null });
        break;
      case "positionCorrection":
        if (Array.isArray(data.position) && data.position.length === 3) {
          this.onPositionCorrection?.({ position: data.position });
        }
        break;
      case "serverShutdown":
        break;
      case "factionCreated":
        this.onFactionCreated?.(data.faction);
        break;
      case "factionJoined":
        this.onFactionJoined?.(data.faction);
        break;
      case "factionLeft":
        this.onFactionLeft?.(data.factionId);
        break;
      case "factionMyListResult":
        this.onFactionMyListResult?.(Array.isArray(data.factions) ? data.factions : []);
        break;
      case "factionDisplayedSet":
        this.onFactionDisplayedSet?.(data.faction);
        break;
      case "factionSearchResult":
        this.onFactionSearchResult?.(Array.isArray(data.results) ? data.results : []);
        break;
      case "factionListResult":
        this.onFactionListResult?.({
          results: Array.isArray(data.results) ? data.results : [],
          page: data.page ?? 1,
        });
        break;
      case "factionInfo":
        this.onFactionInfo?.(data.faction ?? null);
        break;
      case "playerProfile":
        this.onPlayerProfile?.(data.profile ?? null);
        break;
      case "leaderboardResult":
        this.onLeaderboardResult?.(Array.isArray(data.leaderboard) ? data.leaderboard : []);
        break;
      case "factionLeaderboardResult":
        this.onFactionLeaderboardResult?.(Array.isArray(data.leaderboard) ? data.leaderboard : []);
        break;
      case "factionTaskListResult":
        this.onFactionTaskListResult?.(Array.isArray(data.tasks) ? data.tasks : []);
        break;
      case "factionTaskAccepted":
        this.onFactionTaskAccepted?.(data.faction);
        break;
      case "factionTaskCompleted":
        this.onFactionTaskCompleted?.(data);
        break;
      case "factionCreatorClaimResult":
        this.onFactionCreatorClaimResult?.({ isCreator: !!data.isCreator, faction: data.faction });
        break;
      case "factionCreatorVerified":
        this.onFactionCreatorVerified?.(data.faction);
        break;
      case "factionQuestListResult":
        this.onFactionQuestListResult?.(Array.isArray(data.quests) ? data.quests : []);
        break;
      case "factionQuestManageListResult":
        this.onFactionQuestManageListResult?.({
          factionId: data.factionId,
          canManage: !!data.canManage,
          questTypes: Array.isArray(data.questTypes) ? data.questTypes : [],
          listingFeeAsh: typeof data.listingFeeAsh === "number" ? data.listingFeeAsh : 0,
          quests: Array.isArray(data.quests) ? data.quests : [],
        });
        break;
      case "factionQuestCreated":
        this.onFactionQuestCreated?.({ quest: data.quest, chargedAsh: data.chargedAsh });
        break;
      case "factionQuestClaimed":
        this.onFactionQuestClaimed?.(data);
        break;
      case "friendRequestSent":
        this.onFriendRequestSent?.(data.friend, data.status);
        break;
      case "friendRequestAccepted":
        this.onFriendRequestAccepted?.(data.friend);
        break;
      case "friendRequestDeclined":
        this.onFriendRequestDeclined?.(data.requestUserId);
        break;
      case "friendRemoved":
        this.onFriendRemoved?.(data.friendUserId);
        break;
      case "friendsListResult":
        this.onFriendsListResult?.({
          friends: Array.isArray(data.friends) ? data.friends : [],
          incoming: Array.isArray(data.incoming) ? data.incoming : [],
          outgoing: Array.isArray(data.outgoing) ? data.outgoing : [],
        });
        break;
      case "friendSearchResult":
        this.onFriendSearchResult?.(Array.isArray(data.results) ? data.results : []);
        break;
      case "mailSent":
        this.onMailSent?.(data.mailId);
        break;
      case "mailInboxResult":
        this.onMailInboxResult?.({
          mail: Array.isArray(data.mail) ? data.mail : [],
          unreadCount: data.unreadCount ?? 0,
        });
        break;
      case "mailMarkedRead":
        this.onMailMarkedRead?.(data.mailId);
        break;
      case "mailReceived":
        this.onMailReceived?.(data);
        break;
      case "tokenInfoSent":
        this.onTokenInfoSent?.(data.mailId);
        break;
      case "supportTicketSent":
        this.onSupportTicketSent?.();
        break;
      case "achievementsUnlocked":
        this.onAchievementsUnlocked?.(Array.isArray(data.achievements) ? data.achievements : []);
        break;
      case "friendRequestReceived":
        this.onFriendRequestReceived?.(data.friend);
        break;
      case "weaponForceUnequip":
        this.onWeaponForceUnequip?.();
        break;
      case "userBlocked":
        this.onUserBlocked?.({ userId: data.userId, wallet: data.wallet, nickname: data.nickname ?? null });
        break;
      case "userUnblocked":
        this.onUserUnblocked?.(data.blockedUserId);
        break;
      case "blockedListResult":
        this.onBlockedListResult?.(Array.isArray(data.blocked) ? data.blocked : []);
        break;
      case "privateMessage":
        this.onPrivateMessage?.(data);
        break;
      case "privateMessageSent":
        this.onPrivateMessageSent?.(data);
        break;
      case "privateMessageError":
        this.onPrivateMessageError?.(data);
        break;
      case "factionChat":
        this.onFactionChatMessage?.(data);
        break;
      case "factionInviteSent":
        this.onFactionInviteSent?.(data.toWallet);
        break;
      case "tradeSession":
        this.onTradeSession?.(data);
        break;
      case "tradeInviteReceived":
        this.onTradeInviteReceived?.(data);
        break;
      case "tradeInviteError":
        this.onTradeInviteError?.(data);
        break;
    }
  }

  private startHeartbeat() {
    this.lastPong = Date.now();
    this.heartbeatInterval = setInterval(() => {
      if (!this.authenticated) return;

      if (Date.now() - this.lastPong > this.heartbeatTimeoutMs) {
        this.ws?.close(4000, "Heartbeat timeout");
        return;
      }

      this.send({ type: "pong", t: Date.now() });
    }, 5000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
      } catch (e) {
      }
    }
  }

  sendPlayerUpdate(data: {
    position: number[];
    rotation: number;
    pitch: number;
    state: string;
    jumping: boolean;
    velocityY: number;
    weaponEquipped: boolean;
    isShooting: boolean;
  }) {
    if (!this.authenticated) return;

    const now = performance.now();
    if (now - this.lastUpdateSent < this.updateThrottleMs) return;
    this.lastUpdateSent = now;
    this.send({ type: "playerUpdate", ...data });
  }

  sendShoot(data: { origin: number[]; direction: number[] }) {
    if (!this.authenticated) return;
    this.send({ type: "shoot", ...data });
  }

  sendHit(data: { target: string | null; point: number[] }) {
    if (!this.authenticated) return;
    this.send({ type: "hit", ...data });
  }

  sendEnemyHit(data: { target: string; point: number[] }) {
    if (!this.authenticated) return;
    this.send({ type: "enemyHit", ...data });
  }

  sendLootPickup(id: string) {
    if (!this.authenticated) return;
    this.send({ type: "lootPickup", id });
  }

  sendSellToken(address: string, quantity?: number) {
    if (!this.authenticated) return;
    this.send({ type: "sellToken", address, quantity });
  }

  sendShopBuyItem(itemId: string, quantity: number = 1) {
    if (!this.authenticated) return;
    this.send({ type: "shopBuyItem", itemId, quantity });
  }

  sendSignPlace(position: number[], rotation: number) {
    if (!this.authenticated) return;
    this.send({ type: "signPlace", position, rotation });
  }

  sendSignRemove(id: string) {
    if (!this.authenticated) return;
    this.send({ type: "signRemove", id });
  }

  sendSignSetText(id: string, text: string) {
    if (!this.authenticated) return;
    this.send({ type: "signSetText", id, text });
  }

  sendSignSetDrawingUrl(id: string, url: string) {
    if (!this.authenticated) return;
    this.send({ type: "signSetDrawingUrl", id, url });
  }

  sendItemPlace(itemId: string, position: number[], rotation: number) {
    if (!this.authenticated) return;
    this.send({ type: "itemPlace", itemId, position, rotation });
  }

  sendItemRemove(id: string) {
    if (!this.authenticated) return;
    this.send({ type: "itemRemove", id });
  }

  sendItemSetText(id: string, text: string) {
    if (!this.authenticated) return;
    this.send({ type: "itemSetText", id, text });
  }

  sendItemSetDrawingUrl(id: string, url: string) {
    if (!this.authenticated) return;
    this.send({ type: "itemSetDrawingUrl", id, url });
  }

  sendQuestInteract(questId: string) {
    if (!this.authenticated) return;
    this.send({ type: "questInteract", questId });
  }

  sendQuestAccept(questId: string) {
    if (!this.authenticated) return;
    this.send({ type: "questAccept", questId });
  }

  sendQuestTurnIn(questId: string) {
    if (!this.authenticated) return;
    this.send({ type: "questTurnIn", questId });
  }

  sendCanyonWarp(segment: number) {
    if (!this.authenticated) return;
    this.send({ type: "canyonWarp", segment });
  }

  sendCanyonMapRequest() {
    if (!this.authenticated) return;
    this.send({ type: "canyonMapRequest" });
  }

  sendCanyonEnterDungeon() {
    if (!this.authenticated) return;
    this.send({ type: "canyonEnterDungeon" });
  }

  sendCanyonReturnToHub() {
    if (!this.authenticated) return;
    this.send({ type: "canyonReturnToHub" });
  }

  sendCanyonCrossThreshold() {
    if (!this.authenticated) return;
    this.send({ type: "canyonCrossThreshold" });
  }

  sendChatMessage(message: string) {
    if (!this.authenticated) return;
    this.send({
      type: "chat",
      message: message.slice(0, 200),
      timestamp: Date.now(),
    });
  }

  sendVoiceOffer(targetId: string, sdp: string) {
    if (!this.authenticated) return;
    this.send({ type: "voiceOffer", targetId, sdp });
  }

  sendVoiceAnswer(targetId: string, sdp: string) {
    if (!this.authenticated) return;
    this.send({ type: "voiceAnswer", targetId, sdp });
  }

  sendVoiceIceCandidate(targetId: string, candidate: RTCIceCandidateInit) {
    if (!this.authenticated) return;
    this.send({ type: "voiceIceCandidate", targetId, candidate });
  }

  sendFactionJoin(factionId: string) {
    if (!this.authenticated) return;
    this.send({ type: "factionJoin", factionId });
  }

  sendFactionLeave(factionId: string) {
    if (!this.authenticated) return;
    this.send({ type: "factionLeave", factionId });
  }

  sendFactionSetDisplayed(factionId: string) {
    if (!this.authenticated) return;
    this.send({ type: "factionSetDisplayed", factionId });
  }

  sendFactionMyListRequest() {
    if (!this.authenticated) return;
    this.send({ type: "factionMyListRequest" });
  }

  sendFactionSearch(ca?: string, name?: string) {
    if (!this.authenticated) return;
    this.send({ type: "factionSearch", ca: ca || "", name: name || "" });
  }

  sendFactionList(page?: number) {
    if (!this.authenticated) return;
    this.send({ type: "factionList", page: page || 1 });
  }

  sendFactionInfo(factionId?: string) {
    if (!this.authenticated) return;
    this.send({ type: "factionInfo", factionId: factionId || null });
  }

  sendPlayerProfileRequest(wallet: string) {
    if (!this.authenticated) return;
    this.send({ type: "playerProfileRequest", wallet });
  }

  sendLeaderboardRequest(limit?: number) {
    if (!this.authenticated) return;
    this.send({ type: "leaderboardRequest", limit: limit || 20 });
  }

  sendFactionLeaderboardRequest(limit?: number) {
    if (!this.authenticated) return;
    this.send({ type: "factionLeaderboardRequest", limit: limit || 50 });
  }

  sendFactionTaskListRequest() {
    if (!this.authenticated) return;
    this.send({ type: "factionTaskListRequest" });
  }

  sendFactionAcceptTask(factionId: string, taskKey: string) {
    if (!this.authenticated) return;
    this.send({ type: "factionAcceptTask", factionId, taskKey });
  }

  sendFactionClaimCreator(factionId: string) {
    if (!this.authenticated) return;
    this.send({ type: "factionClaimCreator", factionId });
  }

  sendFactionQuestListRequest() {
    if (!this.authenticated) return;
    this.send({ type: "factionQuestListRequest" });
  }

  sendFactionQuestManageListRequest(factionId: string) {
    if (!this.authenticated) return;
    this.send({ type: "factionQuestManageListRequest", factionId });
  }

  sendFactionQuestCreate(factionId: string, targetUrl: string, slotsTotal: number, rewardAsh: number) {
    if (!this.authenticated) return;
    this.send({ type: "factionQuestCreate", factionId, targetUrl, slotsTotal, rewardAsh });
  }

  sendFactionQuestClaim(questId: string) {
    if (!this.authenticated) return;
    this.send({ type: "factionQuestClaim", questId });
  }

  sendFriendRequest(walletOrNickname: { wallet?: string; nickname?: string }) {
    if (!this.authenticated) return;
    this.send({ type: "friendRequestSend", wallet: walletOrNickname.wallet, nickname: walletOrNickname.nickname });
  }

  sendFriendRequestAccept(requestUserId: string) {
    if (!this.authenticated) return;
    this.send({ type: "friendRequestAccept", requestUserId });
  }

  sendFriendRequestDecline(requestUserId: string) {
    if (!this.authenticated) return;
    this.send({ type: "friendRequestDecline", requestUserId });
  }

  sendFriendRemove(friendUserId: string) {
    if (!this.authenticated) return;
    this.send({ type: "friendRemove", friendUserId });
  }

  sendFriendsListRequest() {
    if (!this.authenticated) return;
    this.send({ type: "friendsListRequest" });
  }

  sendFriendSearch(query: string) {
    if (!this.authenticated) return;
    this.send({ type: "friendSearch", query });
  }

  sendMail(recipient: { wallet?: string; nickname?: string }, subject: string, body: string) {
    if (!this.authenticated) return;
    this.send({ type: "mailSend", wallet: recipient.wallet, nickname: recipient.nickname, subject, body });
  }

  sendMailInboxRequest() {
    if (!this.authenticated) return;
    this.send({ type: "mailInboxRequest" });
  }

  sendMailMarkRead(mailId: string) {
    if (!this.authenticated) return;
    this.send({ type: "mailMarkRead", mailId });
  }

  sendRespawnRequest() {
    if (!this.authenticated) return;
    this.send({ type: "respawnRequest" });
  }

  sendEmote(key: EmoteKey) {
    if (!this.authenticated) return;
    this.send({ type: "emote", key });
  }

  sendCosmeticListRequest() {
    if (!this.authenticated) return;
    this.send({ type: "cosmeticListRequest" });
  }

  sendCosmeticBuy(itemId: CosmeticId) {
    if (!this.authenticated) return;
    this.send({ type: "cosmeticBuy", itemId });
  }

  sendCosmeticEquip(skinId: CosmeticId | null, accessoryId: CosmeticId | null) {
    if (!this.authenticated) return;
    this.send({ type: "cosmeticEquip", skinId, accessoryId });
  }

  requestTokenInfo(ca: string) {
    if (!this.authenticated) return;
    this.send({ type: "tokenInfoRequest", ca });
  }

  sendSupportTicket(subject: string, message: string) {
    if (!this.authenticated) return;
    this.send({ type: "supportTicketSend", subject, message });
  }

  sendBlockUser(target: { wallet?: string; nickname?: string }) {
    if (!this.authenticated) return;
    this.send({ type: "blockUser", wallet: target.wallet, nickname: target.nickname });
  }

  sendUnblockUser(blockedUserId: string) {
    if (!this.authenticated) return;
    this.send({ type: "unblockUser", blockedUserId });
  }

  sendBlockedListRequest() {
    if (!this.authenticated) return;
    this.send({ type: "blockedListRequest" });
  }

  sendPrivateMessage(toWallet: string, text: string) {
    if (!this.authenticated) return;
    this.send({ type: "privateMessage", toWallet, text: text.slice(0, 500) });
  }

  sendFactionChatMessage(factionId: string, message: string) {
    if (!this.authenticated) return;
    this.send({ type: "factionChat", factionId, message: message.slice(0, 200) });
  }

  sendFactionInvite(toWallet: string, factionId: string) {
    if (!this.authenticated) return;
    this.send({ type: "factionInvite", toWallet, factionId });
  }

  sendTradeInvite(toWallet: string) {
    if (!this.authenticated) return;
    this.send({ type: "tradeInvite", toWallet });
  }

  sendTradeInviteRespond(tradeId: string, accept: boolean) {
    if (!this.authenticated) return;
    this.send({ type: "tradeInviteRespond", tradeId, accept });
  }

  sendTradeSetOffer(tradeId: string, itemId: string | null, priceTnj: number | null) {
    if (!this.authenticated) return;
    this.send({ type: "tradeSetOffer", tradeId, itemId, priceTnj });
  }

  sendTradeSetReady(tradeId: string, ready: boolean) {
    if (!this.authenticated) return;
    this.send({ type: "tradeSetReady", tradeId, ready });
  }

  sendTradeSubmitPayment(tradeId: string, signature: string) {
    if (!this.authenticated) return;
    this.send({ type: "tradeSubmitPayment", tradeId, signature });
  }

  sendTradeCancel(tradeId: string) {
    if (!this.authenticated) return;
    this.send({ type: "tradeCancel", tradeId });
  }

  sendLocationChange(locationId: string) {
    if (!this.authenticated) return;
    this.send({ type: 'locationChange', locationId });
  }

  sendProgressSave(progressData: any) {
    if (!this.authenticated) return;
    this.send({
      type: "saveProgress",
      ...progressData,
    });
  }

  setNickname(nickname: string) {
    this.nickname = nickname;
    if (this.authenticated) {
      this.send({ type: "nicknameChange", nickname });
    }
  }

  sendSkinUpdate(url: string) {
    if (!this.authenticated) return;
    this.send({ type: "skinUpdate", url });
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectAttempts = 0;
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
    this.authenticated = false;
  }
}