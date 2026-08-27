// src/features/game/network/NetworkManager.ts
import { t } from "@/core/i18n";
import { EmoteKey, isEmoteKey } from "../data/emotes";
import { CosmeticId, normalizeLoadout } from "../data/cosmetics";
import { COMPANIONS_BY_ID, isCompanionId, type CompanionId, type CompanionRarity } from "../data/companions";
import { BranchId, isBranchId } from "../data/progression";
import type { TournamentEntryView, TournamentSummary } from "@/core/lib/tournaments";

export type { TournamentEntryView, TournamentSummary } from "@/core/lib/tournaments";

// One shape for every player-driven tournament mutation. The extra fields are
// per-action, and the server ignores the ones the action does not use.
export type TournamentActionPayload =
  | { action: "join"; tournamentId: string }
  | { action: "submitSkin"; tournamentId: string; kind: string }
  | { action: "submitShot"; tournamentId: string; shotUrl: string }
  | { action: "setPost"; tournamentId: string; postUrl: string }
  | { action: "like"; tournamentId: string; entryId: string };

export type PlayerNetData = {
  id: string;
  nickname: string;
  factionSymbol?: string | null;
  factionImage?: string | null;
  position: number[];
  rotation: number;
  pitch: number;
  headYaw?: number;
  companionId?: string | null;
  state: 'idle' | 'walk' | 'sprint' | 'jump';
  jumping: boolean;
  velocityY: number;
  health: number;
  alive: boolean;
  weaponEquipped: boolean;
  isShooting: boolean;
  shielded?: boolean;
  locationId?: string;
  isAdmin?: boolean;
  isFactionCreator?: boolean;
  skinTextureUrl?: string | null;
  cosmeticSkinId?: string | null;
  cosmeticAccessoryId?: string | null;
  level?: number;
  tier?: string;
  branch?: BranchId | null;
  weaponTier?: number;
};

export type CombatStatsData = {
  maxHealth: number;
  magSize: number;
  reloadMs: number;
  moveSpeedMult: number;
  maxEnergy: number;
  energyRegen: number;
  boltSpeed: number;
  boltRange: number;
  boltEnergyCost: number;
};

export type ProgressionStateData = {
  level: number;
  totalXp: number;
  xpIntoLevel: number;
  xpForLevel: number;
  branch: BranchId | null;
  branchUnlocked: boolean;
  skills: Record<string, number>;
  loadout: Record<string, string>;
  fireMode: string;
  fireModes: string[];
  weapon: "rifle" | "staff";
  respecCount: number;
  respecCostAsh: number;
  skillPoints: number;
  skillPointsTotal: number;
  tier: string;
  tierIndex: number;
  weaponTier: number;
  memeAbilities: string[];
  memeCooldowns: Record<string, number>;
  stats: CombatStatsData;
  health: number;
  energy: number;
  cooldowns: Record<string, number>;
};

export type AbilityResultData = {
  abilityId: string;
  ok: boolean;
  reason?: string;
  readyAt?: number;
  energy?: number;
  maxEnergy?: number;
  kind?: string;
  position?: number[];
  radius?: number;
  targetId?: string | null;
  chain?: number[][] | null;
  cooldowns?: Record<string, number>;
};

export type AbilityEffectData = {
  casterId: string;
  abilityId: string;
  kind: string;
  position: number[];
  radius: number;
  targetId: string | null;
  chain: number[][] | null;
};

export type AbilityZoneData = {
  zoneId: string;
  casterId: string;
  abilityId: string;
  position: number[];
  radius: number;
  durationMs: number;
  slowPercent?: number;
};

export type AbilityImpactPendingData = {
  casterId: string;
  abilityId: string;
  position: number[];
  radius: number;
  resolveInMs: number;
};

export type AbilityMeterData = {
  energy: number;
  maxEnergy: number;
  shield: number;
  shieldMax: number;
};

export type MemeResultData = {
  memeId: string;
  ok: boolean;
  reason?: string;
  readyAt?: number;
  durationMs?: number;
  cooldowns?: Record<string, number>;
};

export type MemeEffectData = {
  casterId: string;
  memeId: string;
  kind: string;
  position: number[];
  radius: number;
  durationMs: number;
};

export type AbilityTriggerData = {
  triggerId: string;
  health: number;
  invulnerabilityMs: number;
  readyAt: number;
};

export type XpGainData = {
  amount: number;
  source: string;
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  xpForLevel: number;
};

export type LevelUpData = {
  level: number;
  previousLevel: number;
  skillPoints: number;
  tier: string;
  tierName: string;
  tierChanged: boolean;
  newMemeAbility: string | null;
  weaponTier: number;
  weaponTierChanged: boolean;
  branchUnlocked: boolean;
};

export type PlayerLevelUpdateData = {
  playerId: string;
  level: number;
  tier: string;
  branch: BranchId | null;
  weaponTier: number;
};

export type CosmeticStateData = {
  owned: CosmeticId[];
  skinId: CosmeticId | null;
  accessoryId: CosmeticId | null;
};

export type CompanionStackData = {
  itemId: string;
  quantity: number;
};

export type CompanionStateData = {
  owned: CompanionStackData[];
  equipped: CompanionId | null;
  fragments: number;
  crates: number;
};

export type CosmeticCrateStateData = {
  fragments: number;
  crates: number;
};

export type CosmeticCrateOpenedData = {
  itemId: string;
  rarity: string;
};

export type CrateOpenedData = {
  itemId: CompanionId;
  rarity: CompanionRarity;
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
  state?: string | null;
};

export type WorldPortalStatus = "locked" | "active" | "cooldown";

export type WorldMonsterStatus = "dormant" | "stalking" | "hunting";

export type WorldUnlock = {
  id: string;
  mc: number;
  unlocked: boolean;
};

export type WorldStatusData = {
  mc: number;
  mcPeak: number;
  tier: number;
  maxTier: number;
  radius: number | null;
  tierMc: number;
  nextTierMc: number | null;
  portal: {
    status: WorldPortalStatus;
    x: number;
    z: number;
    cooldownUntil: number;
  };
  monster: {
    id: string;
    status: WorldMonsterStatus;
    nextWindowAt: number | null;
  };
  unlocks: WorldUnlock[];
  traders: number;
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
  owned?: boolean;
};

export type DeathCrateData = {
  id: string;
  position: number[];
  stacks: number;
  ownerNickname: string;
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

export type RoomBuildOp =
  | { kind: "place"; piece: { t: string; x: number; z: number; l: number; r: number; d?: string } }
  | { kind: "erase"; key: string }
  | { kind: "env"; sky: string; light: string }
  | { kind: "clear" };

export type FactionGateData = {
  factionId: string;
  factionName: string;
  number?: number | null;
  symbol: string | null;
  image: string | null;
  tokenCa: string | null;
  roomAccess?: string | null;
  isAdmin?: boolean;
};

export type ShardStateData = {
  locationId: string;
  instance: number;
  capacity: number;
  shards: Array<{ instance: number; count: number }>;
};

export type QuestStatus = "not_started" | "active" | "ready_to_turn_in" | "completed" | "none";

export type QuestTarget = {
  id: string;
  name: string;
  role: string;
  locationId: string;
};

export type QuestInfoData = {
  questId: string;
  npc: string;
  questType?: "kill_enemies" | "visit_npcs";
  title: string;
  description: string;
  targetCount: number;
  rewardAsh: number;
  rewardXp?: number;
  status: QuestStatus;
  progress: number;
  targets?: QuestTarget[] | null;
  visited?: string[];
};

export type QuestUpdateData = {
  questId: string;
  status: QuestStatus;
  progress: number;
  targetCount: number;
  rewardAsh?: number;
  rewardXp?: number;
  visited?: string[];
  visitedName?: string;
};

export type InventoryEntry = {
  address: string;
  name: string;
  symbol: string;
  image: string;
  quantity: number;
};

export type StorageEntry = InventoryEntry;

export type RespawnTarget = "hall" | "home" | "canyon_hub";

export type RespawnOptions = Record<RespawnTarget, boolean>;

export type PartyMemberData = {
  id: string;
  nickname: string;
  level: number;
  health: number;
  maxHealth: number;
  alive: boolean;
  locationId: string | null;
};

export type PartyStateData = {
  partyId: string | null;
  leaderId: string | null;
  members: PartyMemberData[];
};

export type PartyVitalsData = {
  id: string;
  health: number;
  maxHealth: number;
  alive: boolean;
  locationId: string | null;
};

export type PartyInviteData = {
  fromId: string;
  fromNickname: string;
  expiresAt: number;
};

export type ArenaPhase = "prep" | "wave" | "pause" | "over";

export type ArenaMemberData = {
  id: string;
  nickname: string;
  down: boolean;
  left: boolean;
};

export type ArenaStateData = {
  runId: string;
  phase: ArenaPhase;
  wave: number;
  phaseUntil: number;
  candleHealth: number;
  candleMaxHealth: number;
  members: ArenaMemberData[];
};

export type DefusalSide = "t" | "ct";
export type DefusalPhase = "warmup" | "freeze" | "live" | "planted" | "over" | "ended";
export type DefusalScore = { t: number; ct: number };

export type DefusalRosterEntry = {
  id: string;
  nickname: string;
  side: DefusalSide;
  alive: boolean;
  hasBomb: boolean;
  money: number;
  armor: string | null;
  helmet: boolean;
  held: "primary" | "pistol" | "melee" | "grenade1" | "grenade2";
  primary: string | null;
  pistol: string | null;
  grenades: string[];
  kit: boolean;
};

export type DefusalBombData = {
  state: "carried" | "planted" | "defused" | "exploded";
  site: string | null;
  x: number;
  z: number;
  explodesAt: number;
  carrierId: string | null;
  planting: { playerId: string; until: number } | null;
  defusing: { playerId: string; until: number } | null;
};

export type DefusalStateData = {
  matchId: string;
  round: number;
  phase: DefusalPhase;
  phaseUntil: number;
  score: DefusalScore;
  roundsToWin: number;
  swapped: boolean;
  bomb: DefusalBombData | null;
  roster: DefusalRosterEntry[];
};

export type DefusalQueueData = {
  queued: number;
  needed: number;
  minimum: number;
};

export type GrinderPhase = "live" | "over";

export type GrinderRosterEntry = {
  id: string;
  nickname: string;
  kills: number;
  deaths: number;
  streak: number;
  alive: boolean;
  armor: string | null;
  helmet: boolean;
  held: "primary" | "pistol" | "melee" | "grenade1" | "grenade2";
  primary: string | null;
  pistol: string | null;
  grenades: string[];
  kit: boolean;
};

export type GrinderStateData = {
  matchId: string;
  phase: GrinderPhase;
  phaseUntil: number;
  round: number;
  roundMs: number;
  roster: GrinderRosterEntry[];
};

export type GrinderStandingEntry = {
  id: string;
  nickname: string;
  kills: number;
  deaths: number;
  bestStreak: number;
};

export type GrinderRoundEndData = {
  round: number;
  winnerId: string | null;
  winnerName: string | null;
  standings: GrinderStandingEntry[];
};

export type ArenaEndedData = {
  reason: string;
  wavesCleared: number;
  ash: number;
  xp: number;
  bestWave: number;
  cooldownUntil: number;
};

export type ArenaReviveState = {
  channelling: boolean;
  targetId: string | null;
  channelMs: number;
};

export type DeathLootOutcome = "empty" | "kept" | "insured" | "crate";

export type DeathLootInfo = {
  outcome: DeathLootOutcome;
  stacks?: number;
  expiresAt?: number;
  segment?: number | null;
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
  subjectKey?: string | null;
  bodyKey?: string | null;
  bodyVars?: Record<string, string | number> | null;
  isRead: boolean;
  createdAt: string;
};


export type InfluenceStatus = "closed" | "open" | "collapsing";
export type InfluencePhase = "sealed" | "claimable" | "owned" | "siege" | "collapse";
export type InfluenceFeeCurrency = "none" | "ash" | "tnj" | "faction";

export interface InfluenceStateData {
    status: InfluenceStatus;
    phase: InfluencePhase;
    breach: { x: number; y: number; z: number; spawnedAt: number };
    ownerFactionId: string | null;
    ownerFactionName: string | null;
    ownerFactionSymbol: string | null;
    ownerFactionImage: string | null;
    feeCurrency: InfluenceFeeCurrency;
    feeAmount: number;
    bossDefeated: boolean;
    crystalHealth: number;
    crystalMaxHealth: number;
    nextSiegeAt: number;
    occupants: number;
    capacity: number;
    siegeWave: number;
}

export interface InfluenceGateData {
    allowed: boolean;
    reason: string | null;
    messageKey: string | null;
    fee: { currency: InfluenceFeeCurrency; amount: number; tokenCa: string | null; wallet: string | null } | null;
    factionId: string | null;
    factionName: string | null;
    ownerFactionId: string | null;
    ownerFactionName: string | null;
    occupants: number;
    capacity: number;
    phase: InfluencePhase;
}

export interface InfluenceCrystalPanelData {
    inRange: boolean;
    canCapture: boolean;
    canManage: boolean;
    bossDefeated: boolean;
    ownerFactionId: string | null;
    ownerFactionName: string | null;
    feeCurrency: InfluenceFeeCurrency;
    feeAmount: number;
    crystalHealth: number;
    crystalMaxHealth: number;
    nextSiegeAt: number;
    captureMs: number;
}

export interface InfluenceCaptureData {
    factionId: string | null;
    factionName: string | null;
    playerId: string | null;
    until: number;
    duration: number;
    contested: boolean;
}

export interface InfluenceLootResultData {
    containerId: string;
    tier: number;
    ash: number;
    companionFragments: number;
    cosmeticFragments: number;
    taken: number;
    perVisit: number;
}

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
  private authWaiters: Array<() => void> = [];

  private lastUpdateSent: number = 0;
  private lastUpdateForced: number = 0;
  private lastUpdateState: {
    position: number[]; rotation: number; pitch: number; headYaw: number; state: string;
    jumping: boolean; weaponEquipped: boolean; isShooting: boolean;
  } | null = null;
  private updateThrottleMs: number = 50;
  private idleKeepaliveMs: number = 1000;

  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private lastPong: number = Date.now();
  private heartbeatTimeoutMs: number = 20000;

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
  public onCompanionState?: (data: CompanionStateData) => void;
  public onCrateOpened?: (data: CrateOpenedData) => void;
  public onCosmeticCrateState?: (data: CosmeticCrateStateData) => void;
  public onCosmeticCrateOpened?: (data: CosmeticCrateOpenedData) => void;
  public onCompanionDusted?: (data: { itemId: CompanionId; gained: number }) => void;
  public onSpawnProtection?: (data: { untilMs: number; durationMs: number }) => void;
  public onCosmeticUpdate?: (data: { playerId: string; skinId: CosmeticId | null; accessoryId: CosmeticId | null }) => void;
  public onShoot?: (data: {
    id: string;
    origin: number[];
    direction: number[];
    directions?: number[][];
    weapon?: string;
    mode?: string;
    speed?: number;
  }) => void;
  public onDisconnected?: () => void;
  public onCount?: (count: number, here: number) => void;
  public onChatMessage?: (data: { id: string; sender: string; senderWallet?: string; senderFactionSymbol?: string | null; senderFactionImage?: string | null; senderIsAdmin?: boolean; senderIsFactionCreator?: boolean; message: string; timestamp: number }) => void;
  public onVoiceOffer?: (data: { fromId: string; sdp: string }) => void;
  public onVoiceAnswer?: (data: { fromId: string; sdp: string }) => void;
  public onVoiceIceCandidate?: (data: { fromId: string; candidate: RTCIceCandidateInit }) => void;
  public onAuthenticated?: (data: { playerId: string; nickname: string; skinTextureUrl?: string | null; locationId?: string; instance?: number; position?: number[] }) => void;
  public onLocationSync?: (data: { locationId: string; instance: number; position?: number[] }) => void;
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
    killerId: string | null;
    position: number[];
    options?: RespawnOptions;
    loot?: DeathLootInfo;
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

  public onCombatState?: (data: { until: number }) => void;

  public onHomeTeleportResult?: (data: {
    casting: boolean;
    done?: boolean;
    cancelled?: boolean;
    reason?: string | null;
    castMs?: number;
    cooldownUntil?: number;
    charges?: number;
    locationId?: string;
    position?: number[];
    sameRoom?: boolean;
  }) => void;

  public onStorageState?: (data: {
    key: string | null;
    slots: number;
    entries: StorageEntry[];
    filled: string[];
  }) => void;

  public onStuckResult?: (data: {
    ok: boolean;
    reason: string | null;
    cooldownUntil: number;
    locationId?: string;
  }) => void;

  public onDayNightSync?: (data: DayNightSyncData) => void;
  public onWorldStatus?: (data: WorldStatusData) => void;

  public onEnemyState?: (enemies: EnemyNetData[]) => void;
  public onEnemyDamaged?: (data: {
    id: string;
    health: number;
    attackerId: string;
    point: number[];
    abilityId?: string | null;
  }) => void;
  public onEnemyDeath?: (data: { id: string; killerId: string }) => void;
  public onBossCast?: (data: { enemyId: string; attack: string; windup: number; aim: number[]; radius: number }) => void;
  public onBossProjectile?: (data: { enemyId: string; attack: string; origin: number[]; target: number[]; travel: number; radius: number }) => void;
  public onBossPool?: (data: { enemyId: string; x: number; z: number; radius: number; duration: number }) => void;

  public onLootState?: (loot: LootDropData[]) => void;
  public onLootSpawn?: (loot: LootDropData) => void;
  public onLootDespawn?: (id: string) => void;
  public onCrateState?: (crates: DeathCrateData[]) => void;
  public onCrateSpawn?: (crate: DeathCrateData) => void;
  public onCrateDespawn?: (id: string) => void;
  public onCrateLootResult?: (data: { id: string; moved: number; remaining: number }) => void;
  public onInsuranceConsumed?: () => void;
  public onPartyState?: (state: PartyStateData) => void;
  public onPartyVitals?: (members: PartyVitalsData[]) => void;
  public onPartyInviteReceived?: (invite: PartyInviteData) => void;
  public onPartyInviteExpired?: (data: { fromId: string }) => void;
  public onPartyDisbanded?: (data: { reason: string }) => void;
  public onInfluenceState?: (state: InfluenceStateData) => void;
  public onInfluenceGate?: (data: InfluenceGateData) => void;
  public onInfluenceCrystalPanel?: (data: InfluenceCrystalPanelData) => void;
  public onInfluenceCapture?: (data: InfluenceCaptureData) => void;
  public onInfluenceCaptured?: (data: { factionId: string; factionName: string }) => void;
  public onInfluenceCrystal?: (data: { health: number; maxHealth: number; sourceId: string | null }) => void;
  public onInfluenceWave?: (data: { wave: number; collapse: boolean; total: number }) => void;
  public onInfluenceBossDown?: (data: { killerFactionId: string | null; killerFactionName: string | null }) => void;
  public onInfluenceBossReward?: (data: { ash: number; killer: boolean }) => void;
  public onInfluenceContainerOpened?: (data: { containerId: string; playerId: string }) => void;
  public onInfluenceLootResult?: (data: InfluenceLootResultData) => void;
  public onInfluenceLootState?: (data: { opened: string[]; taken: number; perVisit: number }) => void;
  public onInfluenceToll?: (data: { amount: number; currency: string; payer: string }) => void;
  public onWardAmbush?: (data: { enemyId: string; x: number; z: number }) => void;
  public onWardBossPhase?: (data: { enemyId: string; phase: string; health: number; maxHealth: number }) => void;
  public onArenaState?: (state: ArenaStateData) => void;
  public onArenaStartResult?: (data: { ok: boolean; reason: string | null; cooldownUntil: number }) => void;
  public onDefusalState?: (data: DefusalStateData) => void;
  public onDefusalQueueState?: (data: DefusalQueueData) => void;
  public onDefusalRoundEnd?: (data: { round: number; side: DefusalSide; reason: string; score: DefusalScore }) => void;
  public onDefusalBombPlanted?: (data: { site: string; x: number; z: number; explodesAt: number }) => void;
  public onDefusalBombDefused?: () => void;
  public onDefusalGrenadeThrown?: (data: { id: string; itemId: string; x: number; y: number; z: number }) => void;
  public onDefusalGrenades?: (data: { grenades: { id: string; itemId: string; x: number; y: number; z: number }[] }) => void;
  public onDefusalGrenadeBurst?: (data: { id: string; itemId: string; x: number; y: number; z: number }) => void;
  public onDefusalCloud?: (data: { x: number; z: number; radius: number; untilMs: number }) => void;
  public onDefusalFlashed?: (data: { durationMs: number }) => void;
  public onDefusalSwing?: (data: { playerId: string }) => void;
  public onDefusalBombExploded?: (data: { x: number; z: number }) => void;
  public onDefusalSideSwap?: () => void;
  public onDefusalMatchEnd?: (data: { winner: DefusalSide; score: DefusalScore }) => void;
  public onDefusalRespawn?: (data: { position: number[]; health: number; side: DefusalSide }) => void;
  public onGrinderState?: (data: GrinderStateData) => void;
  public onGrinderRespawn?: (data: { position: number[]; health: number }) => void;
  public onGrinderDeath?: (data: { killerId: string | null; killerName: string | null }) => void;
  public onGrinderRoundEnd?: (data: GrinderRoundEndData) => void;
  public onForceTeleport?: (data: { locationId: string; position?: number[] }) => void;
  public onArenaWaveStart?: (data: { wave: number; boss: boolean; biome: string; enemies: number }) => void;
  public onArenaWaveEnd?: (data: { wave: number; pauseUntil: number }) => void;
  public onArenaCandleDamage?: (data: { damage: number; health: number; maxHealth: number }) => void;
  public onArenaPlayerDown?: (data: { playerId: string }) => void;
  public onArenaPlayerRevived?: (data: { playerId: string; byId: string }) => void;
  public onArenaReviveResult?: (data: { channelling: boolean; targetId?: string; channelMs?: number; done?: boolean; cancelled?: boolean; reason?: string }) => void;
  public onArenaEnded?: (data: ArenaEndedData) => void;
  public onFactionGatesState?: (gates: FactionGateData[]) => void;
  public onAccountCount?: (count: number) => void;
  public onShardState?: (state: ShardStateData) => void;
  public onCaveChestOpened?: (data: { chestId: string; ash: number }) => void;
  public onCaveChestSpawn?: (data: { chestId: string; x: number; z: number }) => void;
  public onBossWave?: (data: { enemyId: string; x: number; z: number; radius: number; windup: number; silent: boolean }) => void;
  public onCaveBossReward?: (data: { slime: boolean; companionFragments: number; cosmeticFragments: number; ash: number }) => void;
  public onCompanionShot?: (data: { ownerId: string; enemyId: string; origin: number[]; target: number[]; travel: number }) => void;
  public onCaveBossState?: (data: { defeated: boolean }) => void;
  public onShardTeleport?: (data: { position: number[]; instance: number }) => void;
  public onSignState?: (signs: SignData[]) => void;
  public onSignSpawn?: (sign: SignData) => void;
  public onSignContentSet?: (data: { id: string; contentType: "text" | "draw"; textContent?: string; drawingUrl?: string }) => void;
  public onSignDespawn?: (id: string) => void;

  public onRoomBuildOp?: (op: RoomBuildOp) => void;
  public onInventoryUpdate?: (data: { inventory: InventoryEntry[]; ash: number; placeables: Record<string, number> }) => void;
  public onSellResult?: (data: {
    address: string;
    quantitySold: number;
    ashEarned: number;
    marketCap: number;
  }) => void;
  public onQuestInfo?: (data: QuestInfoData) => void;
  public onQuestUpdate?: (data: QuestUpdateData) => void;
  public onNpcMet?: (metNpcs: string[]) => void;
  public onProgressionState?: (data: ProgressionStateData) => void;
  public onXpGain?: (data: XpGainData) => void;
  public onLevelUp?: (data: LevelUpData) => void;
  public onPlayerLevelUpdate?: (data: PlayerLevelUpdateData) => void;
  public onPlayerShield?: (data: { playerId: string; active: boolean }) => void;
  public onPlayerControl?: (data: { slowPercent: number; durationMs: number }) => void;
  public onBranchSelected?: (branch: BranchId) => void;
  public onSkillsRespecced?: (data: { costAsh: number }) => void;
  public onSkillLearned?: (data: { nodeId: string; rank: number }) => void;
  public onSkillLearnRejected?: (data: { nodeId: string; reason: string }) => void;
  public onPlayerHealed?: (data: { health: number; maxHealth: number }) => void;
  public onAbilityResult?: (data: AbilityResultData) => void;
  public onAbilityEffect?: (data: AbilityEffectData) => void;
  public onAbilityZone?: (data: AbilityZoneData) => void;
  public onAbilityZoneEnded?: (zoneId: string) => void;
  public onAbilityImpactPending?: (data: AbilityImpactPendingData) => void;
  public onAbilityMeter?: (data: AbilityMeterData) => void;
  public onAbilityTrigger?: (data: AbilityTriggerData) => void;
  public onFireModeChanged?: (mode: string) => void;
  public onMemeResult?: (data: MemeResultData) => void;
  public onMemeEffect?: (data: MemeEffectData) => void;
  public onCanyonSegment?: (data: CanyonSegmentData) => void;
  public onCanyonCleared?: (data: CanyonClearedData) => void;
  public onCanyonMap?: (data: CanyonMapData) => void;
  public onCanyonHub?: (data: CanyonHubData) => void;
  public onServerError?: (message: string) => void;
  public onPositionCorrection?: (data: { position: number[] }) => void;

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
  public onTournamentListResult?: (tournaments: TournamentSummary[]) => void;
  public onTournamentEntriesResult?: (data: { tournamentId: string; kind: string | null; entries: TournamentEntryView[] }) => void;
  public onTournamentActionResult?: (data: { action: string; tournamentId: string }) => void;
  public onFragmentsGranted?: (data: { amount: number; source: string }) => void;

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
  public onPlayerCompanion?: (data: { playerId: string; companionId: string | null }) => void;

  public onPlayerFactionIdentity?: (data: {
    id: string;
    factionSymbol: string | null;
    factionImage: string | null;
    isFactionCreator: boolean;
  }) => void;
  public onFactionRosterChanged?: (data: { factionId: string; mine: boolean }) => void;

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

  public whenAuthenticated(): Promise<void> {
    if (this.authenticated) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.authWaiters.push(resolve);
    });
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


  public queryInfluenceGate() {
    this.send({ type: "influenceGateQuery" });
  }

  public enterInfluence(tx?: string) {
    this.send(tx ? { type: "influenceEnter", tx } : { type: "influenceEnter" });
  }

  public leaveInfluence() {
    this.send({ type: "influenceLeave" });
  }

  public queryInfluenceCrystal() {
    this.send({ type: "influenceCrystalQuery" });
  }

  public startInfluenceCapture() {
    this.send({ type: "influenceCaptureStart" });
  }

  public stopInfluenceCapture() {
    this.send({ type: "influenceCaptureStop" });
  }

  public setInfluenceFee(currency: InfluenceFeeCurrency, amount: number) {
    this.send({ type: "influenceFee", currency, amount });
  }

  public lootInfluenceContainer(containerId: string) {
    this.send({ type: "influenceLoot", containerId });
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
        this.authWaiters.forEach((waiter) => waiter());
        this.authWaiters = [];
        this.onAuthenticated?.({
          playerId: data.playerId,
          nickname: data.nickname,
          skinTextureUrl: data.skinTextureUrl ?? null,
          locationId: typeof data.locationId === "string" ? data.locationId : undefined,
          instance: typeof data.instance === "number" ? data.instance : undefined,
          position: Array.isArray(data.position) ? data.position : undefined,
        });
        if (typeof data.daySyncEpoch === "number") {
          this.onDayNightSync?.({
            epoch: data.daySyncEpoch,
            dayDurationMs: data.dayDurationMs,
            nightDurationMs: data.nightDurationMs,
          });
        }
        if (typeof data.stuckCooldownUntil === "number") {
          this.onStuckResult?.({ ok: false, reason: "state", cooldownUntil: data.stuckCooldownUntil });
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
              headYaw: p.headYaw || 0,
              companionId: p.companionId ?? null,
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
      case "companionState": {
        const owned = Array.isArray(data.owned)
          ? data.owned
              .filter((entry: any) => isCompanionId(entry?.itemId) && Number(entry?.quantity) > 0)
              .map((entry: any) => ({ itemId: entry.itemId as CompanionId, quantity: Math.floor(Number(entry.quantity)) }))
          : [];
        this.onCompanionState?.({
          owned,
          equipped: isCompanionId(data.equipped) ? data.equipped : null,
          fragments: Math.max(0, Math.floor(Number(data.fragments) || 0)),
          crates: Math.max(0, Math.floor(Number(data.crates) || 0)),
        });
        break;
      }
      case "cosmeticCrateState":
        this.onCosmeticCrateState?.({
          fragments: Math.max(0, Math.floor(Number(data.fragments) || 0)),
          crates: Math.max(0, Math.floor(Number(data.crates) || 0)),
        });
        break;
      case "cosmeticCrateOpened":
        if (typeof data.itemId !== "string") break;
        this.onCosmeticCrateOpened?.({
          itemId: data.itemId,
          rarity: typeof data.rarity === "string" ? data.rarity : "common",
        });
        break;
      case "crateOpened": {
        if (!isCompanionId(data.itemId)) break;
        const rarity = COMPANIONS_BY_ID.get(data.itemId)?.rarity ?? "common";
        this.onCrateOpened?.({ itemId: data.itemId, rarity });
        break;
      }
      case "companionDusted": {
        if (!isCompanionId(data.itemId)) break;
        this.onCompanionDusted?.({ itemId: data.itemId, gained: Math.max(0, Math.floor(Number(data.gained) || 0)) });
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
      case "caveChestOpened":
        this.onCaveChestOpened?.({ chestId: data.chestId, ash: data.ash ?? 0 });
        break;
      case "caveChestSpawn":
        this.onCaveChestSpawn?.({ chestId: data.chestId, x: data.x ?? 0, z: data.z ?? 0 });
        break;
      case "companionShot":
        this.onCompanionShot?.({
          ownerId: data.ownerId,
          enemyId: data.enemyId,
          origin: data.origin ?? [0, 0, 0],
          target: data.target ?? [0, 0, 0],
          travel: data.travel ?? 200,
        });
        break;
      case "caveBossReward":
        this.onCaveBossReward?.({
          slime: !!data.slime,
          companionFragments: data.companionFragments ?? 0,
          cosmeticFragments: data.cosmeticFragments ?? 0,
          ash: data.ash ?? 0,
        });
        break;
      case "bossWave":
        this.onBossWave?.({
          enemyId: data.enemyId,
          x: data.x ?? 0,
          z: data.z ?? 0,
          radius: data.radius ?? 0,
          windup: data.windup ?? 0,
          silent: data.silent === true,
        });
        break;
      case "caveBossState":
        this.onCaveBossState?.({ defeated: !!data.defeated });
        break;
      case "snapshot":
        if (Array.isArray(data.players)) {
          for (const entry of data.players) {
            this.onPlayerUpdate?.({
              ...entry,
              health: entry.health ?? 100,
              alive: entry.alive ?? true,
              weaponEquipped: entry.weaponEquipped !== false,
              isShooting: entry.isShooting || false,
              locationId: entry.locationId || 'main-world',
            });
          }
        }
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
      case "combatState":
        this.onCombatState?.({ until: typeof data.until === "number" ? data.until : 0 });
        break;
      case "homeTeleportResult":
        this.onHomeTeleportResult?.(data);
        break;
      case "storageState":
        this.onStorageState?.({
          key: typeof data.key === "string" ? data.key : null,
          slots: typeof data.slots === "number" ? data.slots : 0,
          entries: Array.isArray(data.entries) ? data.entries : [],
          filled: Array.isArray(data.filled) ? data.filled : [],
        });
        break;
      case "stuckResult":
        this.onStuckResult?.({
          ok: data.ok === true,
          reason: typeof data.reason === "string" ? data.reason : null,
          cooldownUntil: typeof data.cooldownUntil === "number" ? data.cooldownUntil : 0,
          locationId: typeof data.locationId === "string" ? data.locationId : undefined,
        });
        break;
      case "shoot":
        this.onShoot?.(data);
        break;
      case "worldStatus":
        this.onWorldStatus?.({
          mc: data.mc ?? 0,
          mcPeak: data.mcPeak ?? 0,
          tier: data.tier ?? 0,
          maxTier: data.maxTier ?? 0,
          radius: data.radius ?? null,
          tierMc: data.tierMc ?? 0,
          nextTierMc: data.nextTierMc ?? null,
          portal: {
            status: data.portal?.status ?? "locked",
            x: data.portal?.x ?? 0,
            z: data.portal?.z ?? 0,
            cooldownUntil: data.portal?.cooldownUntil ?? 0,
          },
          monster: {
            id: data.monster?.id ?? "redwick",
            status: data.monster?.status ?? "dormant",
            nextWindowAt: data.monster?.nextWindowAt ?? null,
          },
          unlocks: Array.isArray(data.unlocks) ? data.unlocks : [],
          traders: data.traders ?? 0,
        });
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
      case "bossCast":
        this.onBossCast?.({
          enemyId: data.enemyId,
          attack: data.attack,
          windup: data.windup,
          aim: data.aim,
          radius: data.radius,
        });
        break;
      case "bossProjectile":
        this.onBossProjectile?.({
          enemyId: data.enemyId,
          attack: data.attack,
          origin: data.origin,
          target: data.target,
          travel: data.travel,
          radius: data.radius,
        });
        break;
      case "bossPool":
        this.onBossPool?.({
          enemyId: data.enemyId,
          x: data.x,
          z: data.z,
          radius: data.radius,
          duration: data.duration,
        });
        break;
      case "lootState":
        if (Array.isArray(data.loot)) {
          this.onLootState?.(data.loot);
        }
        break;
      case "shardState":
        this.onShardState?.({
          locationId: data.locationId,
          instance: data.instance,
          capacity: data.capacity,
          shards: Array.isArray(data.shards) ? data.shards : [],
        });
        break;
      case "shardTeleport":
        this.onShardTeleport?.({ position: data.position, instance: data.instance });
        break;
      case "factionGatesState":
        if (Array.isArray(data.gates)) {
          this.onFactionGatesState?.(data.gates);
        }
        if (typeof data.accountCount === "number") {
          this.onAccountCount?.(data.accountCount);
        }
        break;
      case "lootSpawn":
        this.onLootSpawn?.({ id: data.id, position: data.position, tokens: data.tokens, owned: data.owned === true });
        break;
      case "lootDespawn":
        this.onLootDespawn?.(data.id);
        break;
      case "crateState":
        if (Array.isArray(data.crates)) {
          this.onCrateState?.(data.crates);
        }
        break;
      case "crateSpawn":
        this.onCrateSpawn?.(data.crate);
        break;
      case "crateDespawn":
        this.onCrateDespawn?.(data.id);
        break;
      case "crateLootResult":
        this.onCrateLootResult?.({
          id: data.id,
          moved: typeof data.moved === "number" ? data.moved : 0,
          remaining: typeof data.remaining === "number" ? data.remaining : 0,
        });
        break;
      case "insuranceConsumed":
        this.onInsuranceConsumed?.();
        break;
      case "partyState":
        this.onPartyState?.({
          partyId: typeof data.partyId === "string" ? data.partyId : null,
          leaderId: typeof data.leaderId === "string" ? data.leaderId : null,
          members: Array.isArray(data.members) ? data.members : [],
        });
        break;
      case "partyVitals":
        if (Array.isArray(data.members)) {
          this.onPartyVitals?.(data.members);
        }
        break;
      case "partyInviteReceived":
        this.onPartyInviteReceived?.({
          fromId: data.fromId,
          fromNickname: data.fromNickname,
          expiresAt: typeof data.expiresAt === "number" ? data.expiresAt : 0,
        });
        break;
      case "partyInviteExpired":
        this.onPartyInviteExpired?.({ fromId: data.fromId });
        break;
      case "partyDisbanded":
        this.onPartyDisbanded?.({ reason: typeof data.reason === "string" ? data.reason : "disbanded" });
        break;
      case "influenceState":
        this.onInfluenceState?.(data as InfluenceStateData);
        break;
      case "influenceGate":
        this.onInfluenceGate?.(data as InfluenceGateData);
        break;
      case "influenceCrystalPanel":
        this.onInfluenceCrystalPanel?.(data as InfluenceCrystalPanelData);
        break;
      case "influenceCapture":
        this.onInfluenceCapture?.(data as InfluenceCaptureData);
        break;
      case "influenceCaptured":
        this.onInfluenceCaptured?.({ factionId: data.factionId, factionName: data.factionName });
        break;
      case "influenceCrystal":
        this.onInfluenceCrystal?.({
          health: typeof data.health === "number" ? data.health : 0,
          maxHealth: typeof data.maxHealth === "number" ? data.maxHealth : 1,
          sourceId: typeof data.sourceId === "string" ? data.sourceId : null,
        });
        break;
      case "influenceWave":
        this.onInfluenceWave?.({
          wave: typeof data.wave === "number" ? data.wave : 0,
          collapse: data.collapse === true,
          total: typeof data.total === "number" ? data.total : 0,
        });
        break;
      case "influenceBossDown":
        this.onInfluenceBossDown?.({
          killerFactionId: typeof data.killerFactionId === "string" ? data.killerFactionId : null,
          killerFactionName: typeof data.killerFactionName === "string" ? data.killerFactionName : null,
        });
        break;
      case "influenceBossReward":
        this.onInfluenceBossReward?.({
          ash: typeof data.ash === "number" ? data.ash : 0,
          killer: data.killer === true,
        });
        break;
      case "influenceContainerOpened":
        this.onInfluenceContainerOpened?.({ containerId: data.containerId, playerId: data.playerId });
        break;
      case "influenceLootResult":
        this.onInfluenceLootResult?.(data as InfluenceLootResultData);
        break;
      case "influenceLootState":
        this.onInfluenceLootState?.({
          opened: Array.isArray(data.opened) ? data.opened : [],
          taken: typeof data.taken === "number" ? data.taken : 0,
          perVisit: typeof data.perVisit === "number" ? data.perVisit : 0,
        });
        break;
      case "influenceToll":
        this.onInfluenceToll?.({
          amount: typeof data.amount === "number" ? data.amount : 0,
          currency: typeof data.currency === "string" ? data.currency : "ash",
          payer: typeof data.payer === "string" ? data.payer : "",
        });
        break;
      case "wardAmbush":
        this.onWardAmbush?.({ enemyId: data.enemyId, x: data.x, z: data.z });
        break;
      case "wardBossPhase":
        this.onWardBossPhase?.({
          enemyId: data.enemyId,
          phase: typeof data.phase === "string" ? data.phase : "litany",
          health: typeof data.health === "number" ? data.health : 0,
          maxHealth: typeof data.maxHealth === "number" ? data.maxHealth : 1,
        });
        break;
      case "arenaState":
        this.onArenaState?.({
          runId: data.runId,
          phase: data.phase,
          wave: typeof data.wave === "number" ? data.wave : 0,
          phaseUntil: typeof data.phaseUntil === "number" ? data.phaseUntil : 0,
          candleHealth: typeof data.candleHealth === "number" ? data.candleHealth : 0,
          candleMaxHealth: typeof data.candleMaxHealth === "number" ? data.candleMaxHealth : 1,
          members: Array.isArray(data.members) ? data.members : [],
        });
        break;
      case "defusalState":
        this.onDefusalState?.(data as DefusalStateData);
        break;
      case "defusalQueueState":
        this.onDefusalQueueState?.({
          queued: typeof data.queued === "number" ? data.queued : 0,
          needed: typeof data.needed === "number" ? data.needed : 10,
          minimum: typeof data.minimum === "number" ? data.minimum : 4,
        });
        break;
      case "defusalRoundEnd":
        this.onDefusalRoundEnd?.({
          round: data.round,
          side: data.side,
          reason: data.reason,
          score: data.score,
        });
        break;
      case "defusalBombPlanted":
        this.onDefusalBombPlanted?.({ site: data.site, x: data.x, z: data.z, explodesAt: data.explodesAt });
        break;
      case "defusalBombDefused":
        this.onDefusalBombDefused?.();
        break;
      case "defusalGrenadeThrown":
        this.onDefusalGrenadeThrown?.({ id: data.id, itemId: data.itemId, x: data.x, y: data.y, z: data.z });
        break;
      case "defusalGrenades":
        this.onDefusalGrenades?.({ grenades: Array.isArray(data.grenades) ? data.grenades : [] });
        break;
      case "defusalGrenadeBurst":
        this.onDefusalGrenadeBurst?.({ id: data.id, itemId: data.itemId, x: data.x, y: data.y, z: data.z });
        break;
      case "defusalCloud":
        this.onDefusalCloud?.({ x: data.x, z: data.z, radius: data.radius, untilMs: data.untilMs });
        break;
      case "defusalFlashed":
        this.onDefusalFlashed?.({ durationMs: data.durationMs });
        break;
      case "defusalSwing":
        this.onDefusalSwing?.({ playerId: data.playerId });
        break;
      case "defusalBombExploded":
        this.onDefusalBombExploded?.({ x: data.x, z: data.z });
        break;
      case "defusalSideSwap":
        this.onDefusalSideSwap?.();
        break;
      case "defusalMatchEnd":
        this.onDefusalMatchEnd?.({ winner: data.winner, score: data.score });
        break;
      case "defusalRespawn":
        this.onDefusalRespawn?.({ position: data.position, health: data.health, side: data.side });
        break;
      case "grinderState":
        this.onGrinderState?.(data as GrinderStateData);
        break;
      case "grinderRespawn":
        this.onGrinderRespawn?.({ position: data.position, health: data.health });
        break;
      case "grinderDeath":
        this.onGrinderDeath?.({
          killerId: data.killerId ?? null,
          killerName: typeof data.killerName === "string" ? data.killerName : null,
        });
        break;
      case "grinderRoundEnd":
        this.onGrinderRoundEnd?.({
          round: data.round,
          winnerId: data.winnerId ?? null,
          winnerName: typeof data.winnerName === "string" ? data.winnerName : null,
          standings: Array.isArray(data.standings) ? data.standings : [],
        });
        break;
      case "forceTeleport":
        this.onForceTeleport?.({ locationId: data.locationId, position: data.position });
        break;
      case "arenaStartResult":
        this.onArenaStartResult?.({
          ok: data.ok === true,
          reason: typeof data.reason === "string" ? data.reason : null,
          cooldownUntil: typeof data.cooldownUntil === "number" ? data.cooldownUntil : 0,
        });
        break;
      case "arenaWaveStart":
        this.onArenaWaveStart?.({
          wave: data.wave,
          boss: data.boss === true,
          biome: typeof data.biome === "string" ? data.biome : "",
          enemies: typeof data.enemies === "number" ? data.enemies : 0,
        });
        break;
      case "arenaWaveEnd":
        this.onArenaWaveEnd?.({ wave: data.wave, pauseUntil: data.pauseUntil });
        break;
      case "arenaCandleDamage":
        this.onArenaCandleDamage?.({ damage: data.damage, health: data.health, maxHealth: data.maxHealth });
        break;
      case "arenaPlayerDown":
        this.onArenaPlayerDown?.({ playerId: data.playerId });
        break;
      case "arenaPlayerRevived":
        this.onArenaPlayerRevived?.({ playerId: data.playerId, byId: data.byId });
        break;
      case "arenaReviveResult":
        this.onArenaReviveResult?.(data);
        break;
      case "arenaEnded":
        this.onArenaEnded?.({
          reason: typeof data.reason === "string" ? data.reason : "over",
          wavesCleared: typeof data.wavesCleared === "number" ? data.wavesCleared : 0,
          ash: typeof data.ash === "number" ? data.ash : 0,
          xp: typeof data.xp === "number" ? data.xp : 0,
          bestWave: typeof data.bestWave === "number" ? data.bestWave : 0,
          cooldownUntil: typeof data.cooldownUntil === "number" ? data.cooldownUntil : 0,
        });
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
      case "roomBuildOp":
        if (data.op) this.onRoomBuildOp?.(data.op);
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
      case "npcMetState":
        this.onNpcMet?.(Array.isArray(data.metNpcs) ? data.metNpcs : []);
        break;
      case "progressionState":
        this.onProgressionState?.({
          ...data,
          branch: isBranchId(data.branch) ? data.branch : null,
          skills: data.skills && typeof data.skills === "object" ? data.skills : {},
          loadout: data.loadout && typeof data.loadout === "object" ? data.loadout : {},
          memeAbilities: Array.isArray(data.memeAbilities) ? data.memeAbilities : [],
          memeCooldowns: data.memeCooldowns && typeof data.memeCooldowns === "object" ? data.memeCooldowns : {},
          fireModes: Array.isArray(data.fireModes) ? data.fireModes : [],
          weapon: data.weapon === "staff" ? "staff" : "rifle",
        });
        break;
      case "fireModeChanged":
        this.onFireModeChanged?.(data.mode ?? "single");
        break;
      case "memeResult":
        this.onMemeResult?.(data);
        break;
      case "memeEffect":
        this.onMemeEffect?.({
          casterId: data.casterId,
          memeId: data.memeId,
          kind: data.kind ?? "self",
          position: Array.isArray(data.position) ? data.position : [0, 0, 0],
          radius: data.radius ?? 0,
          durationMs: data.durationMs ?? 1000,
        });
        break;
      case "xpGain":
        this.onXpGain?.(data);
        break;
      case "levelUp":
        this.onLevelUp?.(data);
        break;
      case "playerLevelUpdate":
        this.onPlayerLevelUpdate?.(data);
        break;
      case "playerShield":
        this.onPlayerShield?.({ playerId: data.playerId, active: !!data.active });
        break;
      case "playerControl":
        this.onPlayerControl?.({ slowPercent: data.slowPercent ?? 0, durationMs: data.durationMs ?? 0 });
        break;
      case "branchSelected":
        if (isBranchId(data.branch)) this.onBranchSelected?.(data.branch);
        break;
      case "skillsRespecced":
        this.onSkillsRespecced?.({ costAsh: data.costAsh ?? 0 });
        break;
      case "skillLearned":
        this.onSkillLearned?.({ nodeId: data.nodeId, rank: data.rank ?? 1 });
        break;
      case "skillLearnRejected":
        this.onSkillLearnRejected?.({ nodeId: data.nodeId, reason: data.reason ?? "unknown" });
        break;
      case "playerHealed":
        this.onPlayerHealed?.({ health: data.health ?? 0, maxHealth: data.maxHealth ?? 100 });
        break;
      case "abilityResult":
        this.onAbilityResult?.({
          ...data,
          cooldowns: data.cooldowns && typeof data.cooldowns === "object" ? data.cooldowns : undefined,
        });
        break;
      case "abilityEffect":
        this.onAbilityEffect?.({
          casterId: data.casterId,
          abilityId: data.abilityId,
          kind: data.kind ?? "self",
          position: Array.isArray(data.position) ? data.position : [0, 0, 0],
          radius: data.radius ?? 0,
          targetId: data.targetId ?? null,
          chain: Array.isArray(data.chain) ? data.chain : null,
        });
        break;
      case "abilityZone":
        this.onAbilityZone?.(data);
        break;
      case "abilityZoneEnded":
        this.onAbilityZoneEnded?.(data.zoneId);
        break;
      case "abilityImpactPending":
        this.onAbilityImpactPending?.(data);
        break;
      case "abilityMeter":
        this.onAbilityMeter?.({
          energy: data.energy ?? 0,
          maxEnergy: data.maxEnergy ?? 100,
          shield: data.shield ?? 0,
          shieldMax: data.shieldMax ?? 0,
        });
        break;
      case "abilityTrigger":
        this.onAbilityTrigger?.(data);
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
        this.onServerError?.(
          data.messageKey ? t(data.messageKey, data.messageVars) : data.message || "Server error"
        );
        break;
      case "locationSync":
        if (typeof data.locationId === "string") {
          this.onLocationSync?.({
            locationId: data.locationId,
            instance: typeof data.instance === "number" ? data.instance : 1,
            position: Array.isArray(data.position) ? data.position : undefined,
          });
        }
        break;
      case "count":
        this.onCount?.(data.count, typeof data.here === "number" ? data.here : data.count);
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
      case "playerCompanion":
        this.onPlayerCompanion?.({
          playerId: data.playerId,
          companionId: typeof data.companionId === "string" ? data.companionId : null,
        });
        break;
      case "playerFactionIdentity":
        this.onPlayerFactionIdentity?.({
          id: data.id,
          factionSymbol: data.factionSymbol ?? null,
          factionImage: data.factionImage ?? null,
          isFactionCreator: !!data.isFactionCreator,
        });
        break;
      case "factionRosterChanged":
        this.onFactionRosterChanged?.({ factionId: data.factionId, mine: !!data.mine });
        break;
      case "positionCorrection":
        if (Array.isArray(data.position) && data.position.length === 3) {
          this.onPositionCorrection?.({ position: data.position });
        }
        break;
      case "serverShutdown":
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
      case "tournamentListResult":
        this.onTournamentListResult?.(Array.isArray(data.tournaments) ? data.tournaments : []);
        break;
      case "tournamentEntriesResult":
        this.onTournamentEntriesResult?.({
          tournamentId: data.tournamentId,
          kind: typeof data.kind === "string" ? data.kind : null,
          entries: Array.isArray(data.entries) ? data.entries : [],
        });
        break;
      case "tournamentActionResult":
        this.onTournamentActionResult?.({ action: data.action, tournamentId: data.tournamentId });
        break;
      case "fragmentsGranted":
        this.onFragmentsGranted?.({
          amount: Math.max(0, Math.floor(Number(data.amount) || 0)),
          source: typeof data.source === "string" ? data.source : "unknown",
        });
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
    this.stopHeartbeat();
    this.lastPong = Date.now();
    this.heartbeatInterval = setInterval(() => {
      if (!this.authenticated) return;

      if (Date.now() - this.lastPong > this.heartbeatTimeoutMs) {
        this.ws?.close(4000, "Heartbeat timeout");
      }
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
    headYaw: number;
    state: string;
    jumping: boolean;
    velocityY: number;
    weaponEquipped: boolean;
    isShooting: boolean;
  }) {
    if (!this.authenticated) return;

    const now = performance.now();
    if (now - this.lastUpdateSent < this.updateThrottleMs) return;

    const previous = this.lastUpdateState;
    const still = previous !== null
      && Math.abs(previous.position[0] - data.position[0]) < 0.02
      && Math.abs(previous.position[1] - data.position[1]) < 0.02
      && Math.abs(previous.position[2] - data.position[2]) < 0.02
      && Math.abs(previous.rotation - data.rotation) < 0.01
      && Math.abs(previous.pitch - data.pitch) < 0.01
      && Math.abs(previous.headYaw - data.headYaw) < 0.01
      && previous.state === data.state
      && previous.jumping === data.jumping
      && previous.weaponEquipped === data.weaponEquipped
      && previous.isShooting === data.isShooting;

    if (still && now - this.lastUpdateForced < this.idleKeepaliveMs) return;

    this.lastUpdateSent = now;
    if (!still) this.lastUpdateForced = now;
    this.lastUpdateState = { ...data, position: [...data.position] };
    this.send({ type: "playerUpdate", ...data });
  }

  sendShoot(data: { origin: number[]; direction: number[]; directions?: number[][] }) {
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

  sendLootPickup(id: string, byPet = false) {
    if (!this.authenticated) return;
    this.send({ type: "lootPickup", id, ...(byPet ? { byPet: true } : {}) });
  }

  sendCrateLoot(id: string) {
    if (!this.authenticated) return;
    this.send({ type: "crateLoot", id });
  }

  sendPartyInvite(toWallet: string) {
    if (!this.authenticated) return;
    this.send({ type: "partyInvite", toWallet });
  }

  sendPartyAccept(fromId: string) {
    if (!this.authenticated) return;
    this.send({ type: "partyAccept", fromId });
  }

  sendPartyDecline(fromId: string) {
    if (!this.authenticated) return;
    this.send({ type: "partyDecline", fromId });
  }

  sendPartyLeave() {
    if (!this.authenticated) return;
    this.send({ type: "partyLeave" });
  }

  sendPartyKick(targetId: string) {
    if (!this.authenticated) return;
    this.send({ type: "partyKick", targetId });
  }

  sendArenaStart() {
    if (!this.authenticated) return;
    this.send({ type: "arenaStart" });
  }

  sendArenaJoin() {
    if (!this.authenticated) return;
    this.send({ type: "arenaJoin" });
  }

  sendArenaLeave() {
    if (!this.authenticated) return;
    this.send({ type: "arenaLeave" });
  }

  sendArenaRevive(targetId: string) {
    if (!this.authenticated) return;
    this.send({ type: "arenaRevive", targetId });
  }

  sendReload() {
    if (!this.authenticated) return;
    this.send({ type: "reload" });
  }

  sendDefusalQueue() {
    if (!this.authenticated) return;
    this.send({ type: "defusalQueue" });
  }

  sendDefusalLeaveQueue() {
    if (!this.authenticated) return;
    this.send({ type: "defusalLeaveQueue" });
  }

  sendDefusalPlant() {
    if (!this.authenticated) return;
    this.send({ type: "defusalPlant" });
  }

  sendDefusalDefuse() {
    if (!this.authenticated) return;
    this.send({ type: "defusalDefuse" });
  }

  sendDefusalCancel() {
    if (!this.authenticated) return;
    this.send({ type: "defusalCancel" });
  }

  sendDefusalBuy(itemId: string) {
    if (!this.authenticated) return;
    this.send({ type: "defusalBuy", itemId });
  }

  sendDefusalSwitch(slot: string) {
    if (!this.authenticated) return;
    this.send({ type: "defusalSwitch", slot });
  }

  sendDefusalThrow(direction: number[]) {
    if (!this.authenticated) return;
    this.send({ type: "defusalThrow", direction });
  }

  sendDefusalMelee() {
    if (!this.authenticated) return;
    this.send({ type: "defusalMelee" });
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

  sendRoomBuildOp(op: RoomBuildOp) {
    if (!this.authenticated) return;
    this.send({ type: "roomBuildOp", op });
  }

  sendQuestInteract(questId: string) {
    if (!this.authenticated) return;
    this.send({ type: "questInteract", questId });
  }

  sendNpcQuestInteract(npc: string) {
    if (!this.authenticated) return;
    this.send({ type: "questInteract", npc });
  }

  sendNpcVisit(npcId: string) {
    if (!this.authenticated) return;
    this.send({ type: "npcVisit", npcId });
  }

  sendNpcMet(npcId: string) {
    if (!this.authenticated) return;
    this.send({ type: "npcMet", npcId });
  }

  sendBranchSelect(branch: BranchId) {
    if (!this.authenticated) return;
    this.send({ type: "branchSelect", branch });
  }

  sendSkillRespec() {
    if (!this.authenticated) return;
    this.send({ type: "skillRespec" });
  }

  sendSkillLearn(nodeId: string) {
    if (!this.authenticated) return;
    this.send({ type: "skillLearn", nodeId });
  }

  sendAbilityBind(slot: string, abilityId: string | null) {
    if (!this.authenticated) return;
    this.send({ type: "abilityBind", slot, abilityId });
  }

  sendFireModeSet(mode: string) {
    if (!this.authenticated) return;
    this.send({ type: "fireModeSet", mode });
  }

  sendMemeCast(memeId: string) {
    if (!this.authenticated) return;
    this.send({ type: "memeCast", memeId });
  }

  sendAbilityCast(abilityId: string, aim: { origin: number[]; direction: number[] } | null) {
    if (!this.authenticated) return;
    this.send({ type: "abilityCast", abilityId, aim });
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

  sendTournamentListRequest() {
    if (!this.authenticated) return;
    this.send({ type: "tournamentListRequest" });
  }

  sendTournamentEntriesRequest(tournamentId: string) {
    if (!this.authenticated) return;
    this.send({ type: "tournamentEntriesRequest", tournamentId });
  }

  sendTournamentAction(payload: TournamentActionPayload) {
    if (!this.authenticated) return;
    this.send({ type: "tournamentAction", ...payload });
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

  sendRespawnRequest(target: RespawnTarget = "hall") {
    if (!this.authenticated) return;
    this.send({ type: "respawnRequest", target });
  }

  sendStuckTeleport() {
    if (!this.authenticated) return;
    this.send({ type: "stuckTeleport" });
  }

  sendHomeTeleport() {
    if (!this.authenticated) return;
    this.send({ type: "homeTeleport" });
  }

  sendStorageOpen(key: string) {
    if (!this.authenticated) return;
    this.send({ type: "storageOpen", key });
  }

  sendStorageDeposit(key: string, address: string, quantity: number) {
    if (!this.authenticated) return;
    this.send({ type: "storageDeposit", key, address, quantity });
  }

  sendStorageWithdraw(key: string, address: string, quantity: number) {
    if (!this.authenticated) return;
    this.send({ type: "storageWithdraw", key, address, quantity });
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

  sendCompanionListRequest() {
    if (!this.authenticated) return;
    this.send({ type: "companionListRequest" });
  }

  sendCompanionEquip(companionId: CompanionId | null) {
    if (!this.authenticated) return;
    this.send({ type: "companionEquip", companionId });
  }

  sendCompanionDust(itemId: CompanionId) {
    if (!this.authenticated) return;
    this.send({ type: "companionDust", itemId });
  }

  sendCompanionCombine() {
    if (!this.authenticated) return;
    this.send({ type: "companionCombine" });
  }

  sendCrateOpen() {
    if (!this.authenticated) return;
    this.send({ type: "crateOpen" });
  }

  sendCosmeticCrateRequest() {
    if (!this.authenticated) return;
    this.send({ type: "cosmeticCrateRequest" });
  }

  sendCosmeticCombine() {
    if (!this.authenticated) return;
    this.send({ type: "cosmeticCombine" });
  }

  sendCosmeticCrateOpen() {
    if (!this.authenticated) return;
    this.send({ type: "cosmeticCrateOpen" });
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

  sendLocationChange(locationId: string, instance?: number) {
    if (!this.authenticated) return;
    this.send({ type: 'locationChange', locationId, instance });
  }

  sendCaveChestOpen(chestId: string) {
    if (!this.authenticated) return;
    this.send({ type: 'caveChestOpen', chestId });
  }

  sendClientReady() {
    if (!this.authenticated) return;
    this.send({ type: 'clientReady', snapshots: true });
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