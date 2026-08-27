// src/features/game/GameClient.tsx
"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { SoundManager } from "./core/SoundManager";
import { Game } from "./core/Game";
import { HUD } from "./ui/HUD";
import { TopMenu, TopWindowId } from "./ui/TopMenu";
import { Hotbar } from "./ui/Hotbar";
import { Notifications } from "./ui/Notifications";
import { Chat } from "./ui/Chat";
import { DamageIndicator } from "./ui/DamageIndicator";
import { Spinner } from "@/core/ui/Spinner";
import { apiPost } from "@/core/api/client";
import { DeathScreen } from "./ui/DeathScreen";
import { StorageWindow } from "./ui/StorageWindow";
import { PartyInvitePopup } from "./ui/PartyInvitePopup";
import { usePartyState } from "./ui/hooks/usePartyState";
import { ArenaPanel } from "./ui/ArenaPanel";
import { ArenaHUD } from "./ui/ArenaHUD";
import { useArenaState } from "./ui/hooks/useArenaState";
import { FloorSelector } from "./ui/FloorSelector";
import { EventsFactionPicker } from "./ui/EventsFactionPicker";
import { EventDoorPanel } from "./ui/EventDoorPanel";
import { DefusalHUD } from "./ui/DefusalHUD";
import { GrinderHUD } from "./ui/GrinderHUD";
import { Minimap } from "./ui/Minimap";
import { KillFeed, type KillFeedEntry } from "./ui/KillFeed";
import { BuyMenu } from "./ui/BuyMenu";
import { DefusalLoadout, type HeldSlot } from "./ui/DefusalLoadout";
import { ScopeOverlay } from "./ui/ScopeOverlay";
import { FlashOverlay } from "./ui/FlashOverlay";
import { TokenPanel } from "./ui/TokenPanel";
import { Inventory } from "./ui/Inventory";
import { VendorPanel } from "./ui/VendorPanel";
import { SolaPanel } from "./ui/SolaPanel";
import { AlfredoPanel } from "./ui/AlfredoPanel";
import { GateStewardPanel, GateFactionResult } from "./ui/GateStewardPanel";
import { BubbleInfoPanel } from "./ui/BubbleInfoPanel";
import { FactionBubblePanel } from "./ui/FactionBubblePanel";
import { RoomPortalPanel } from "./ui/RoomPortalPanel";
import { InfluenceGatePanel } from "./ui/InfluenceGatePanel";
import { InfluenceCrystalPanel } from "./ui/InfluenceCrystalPanel";
import { InfluenceHud } from "./ui/InfluenceHud";
import { BuildEditorPanel } from "./ui/BuildEditorPanel";
import type { BuildSessionState } from "./world/building/BuildSession";
import { RoomConsolePanel } from "./ui/RoomConsolePanel";
import { BubbleMapPanel } from "./ui/BubbleMapPanel";
import type { FactionGateData, ShardStateData, DefusalStateData, DefusalQueueData, GrinderStateData, InfluenceGateData, InfluenceCrystalPanelData, InfluenceStateData, InfluenceCaptureData } from "./network/NetworkManager";
import { PersonalizationEditor } from "./ui/personalization/PersonalizationEditor";
import { gameFetch, keepSessionAlive } from "./utils/gameFetch";
import { QuestTracker } from "./ui/QuestTracker";
import { LevelUpToast } from "./ui/LevelUpToast";
import { SpecializationModal } from "./ui/SpecializationModal";
import { SkillTreeWindow } from "./ui/SkillTreeWindow";
import { CanyonMapPanel } from "./ui/CanyonMapPanel";
import { AlaricPanel } from "./ui/AlaricPanel";
import { RadialWheel, WheelPage } from "./ui/RadialWheel";
import { NpcDialogueModal } from "./ui/NpcDialogueModal";
import { useNpcDialogue } from "./ui/hooks/useNpcDialogue";
import { NpcId } from "./data/npcDialogues";
import { QuestMarkerKind } from "./entities/questMarker";
import { AbilityBar } from "./ui/AbilityBar";
import { EMOTES, isEmoteKey } from "./data/emotes";
import { MEME_ABILITIES, MEME_ABILITIES_BY_ID, TIERS } from "./data/progression";
import { COSMETICS_BY_ID, CosmeticId } from "./data/cosmetics";
import { useCosmeticState } from "./ui/hooks/useCosmeticState";
import { FactionsWindow } from "./ui/FactionsWindow";
import { QuestsWindow } from "./ui/QuestsWindow";
import { SocialWindow, SocialTab } from "./ui/SocialWindow";
import { ShopWindow } from "./ui/ShopWindow";
import { CrateOpening } from "./ui/CrateOpening";
import { PerfPanel } from "./ui/PerfPanel";
import { useCompanionState } from "./ui/hooks/useCompanionState";
import { useCosmeticCrateState } from "./ui/hooks/useCosmeticCrateState";
import { LeaderboardsWindow } from "./ui/LeaderboardsWindow";
import { SettingsWindow } from "./ui/SettingsWindow";
import { SupportModal } from "./ui/SupportModal";
import { SignEditorModal } from "./ui/SignEditorModal";
import { PosterPaintModal } from "./ui/PosterPaintModal";
import { SignViewerModal, SignViewData } from "./ui/SignViewerModal";
import { PlaceableMenu } from "./ui/PlaceableMenu";
import { PlayerProfileCard } from "./ui/PlayerProfileCard";
import { FactionInvitePicker } from "./ui/FactionInvitePicker";
import { TradeWindow } from "./ui/TradeWindow";
import { TradeInvitePopup } from "./ui/TradeInvitePopup";
import { NicknameMenuActions } from "./ui/shell/NicknameMenu";
import { TradeSessionData, type InventoryEntry } from "./network/NetworkManager";
import { useHudState } from "./ui/hooks/useHudState";
import { useProgressionState } from "./ui/hooks/useProgressionState";
import { useAbilityState, rejectionMessage } from "./ui/hooks/useAbilityState";
import { onLanguageChange, t } from "@/core/i18n";
import { modeById } from "./data/skills";
import { useQuestState, SOLA_NPC_ID } from "./ui/hooks/useQuestState";
import { TouchControls } from "./ui/TouchControls";
import { TouchOnboarding } from "./ui/TouchOnboarding";
import { TouchLandscapeGate } from "./ui/TouchLandscapeGate";
import { useForcedLandscape } from "./ui/hooks/useForcedLandscape";
import { GAME_ROOT_ID, setGameRotated } from "./utils/rotatedViewport";
import { applyUiScale, getUiScale } from "./utils/uiScale";
import { useMobileImmersion } from "./ui/hooks/useMobileImmersion";
import { useDevice } from "@/core/lib/useDevice";
import type { InputManager } from "./core/InputManager";
import { useInventoryState } from "./ui/hooks/useInventoryState";
import { useChatState } from "./ui/hooks/useChatState";
import { usePrivateMessagesState } from "./ui/hooks/usePrivateMessagesState";
import { useNotifications } from "./ui/hooks/useNotifications";
import { useCanyonMapState } from "./ui/hooks/useCanyonMapState";
import { useFactionState } from "./ui/hooks/useFactionState";
import { useFactionQuestState } from "./ui/hooks/useFactionQuestState";
import { useTournamentState } from "./ui/hooks/useTournamentState";
import { TournamentPanel } from "./ui/TournamentPanel";
import { BuildShotPrompt } from "./ui/BuildShotPrompt";
import { useLeaderboardState } from "./ui/hooks/useLeaderboardState";
import { useProfileState } from "./ui/hooks/useProfileState";
import { useSocialState } from "./ui/hooks/useSocialState";

const SESSION_KEEPALIVE_MS = 9 * 60 * 1000;

const ABILITY_KEY_MAP: Record<string, string> = {
  Digit1: "s1",
  Digit2: "s2",
  Digit3: "s3",
  Digit4: "s4",
  Digit5: "s5",
  Digit6: "s6",
};

const HOTBAR_KEYS = ["KeyQ", "KeyF"];

type WheelMode = "tools" | "emotes" | "degen" | "touch" | null;

const SOLA_INTERACTION_ID = "quest-giver-sola";

function fireModeLabel(mode: string): string {
  return mode === "single" ? t("g.fireMode.single") : modeById(mode)?.name ?? mode;
}

interface GameClientProps {
  slug: string;
}

interface GameSession {
  gameToken: string;
  serverUrl: string;
  userId: string;
  wallet: string;
}

interface HotbarSlot {
  id: string;
  icon: string;
  name: string;
  equipped: boolean;
}

export function GameClient({ slug }: GameClientProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);

  // The labels below come from the module level t rather than the context, so a
  // language change has to force a repaint the same way the three.js systems do.
  // The first bump catches the language the provider seeds before this runs.
  const [, bumpLanguage] = useReducer((tick: number) => tick + 1, 0);
  useEffect(() => {
    const unsubscribe = onLanguageChange(bumpLanguage);
    bumpLanguage();
    return unsubscribe;
  }, []);

  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Initializing game...");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [inputManager, setInputManager] = useState<InputManager | null>(null);
  const device = useDevice();
  const touchMode = device.ready && device.isTouch && (device.isMobile || device.isTablet);
  const gameContainerRef = useRef<HTMLDivElement | null>(null);

  const [chatExpanded, setChatExpanded] = useState(false);
  const [buildArmed, setBuildArmed] = useState(false);
  const enterImmersion = useMobileImmersion(touchMode && !authError, gameContainerRef);

  const rotated = useForcedLandscape(touchMode);

  useEffect(() => {
    applyUiScale(touchMode ? getUiScale() : 1);
  }, [touchMode]);

  useEffect(() => {
    setGameRotated(rotated);
    return () => setGameRotated(false);
  }, [rotated]);

  useEffect(() => {
    if (!touchMode) return;

    const frame = requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    return () => cancelAnimationFrame(frame);
  }, [touchMode, rotated]);

  const [showFloorSelector, setShowFloorSelector] = useState(false);
  const [currentLocationId, setCurrentLocationId] = useState("tower-main-hall");
  const [isEventsPickerOpen, setIsEventsPickerOpen] = useState(false);
  const [openEventDoorId, setOpenEventDoorId] = useState<string | null>(null);
  const [defusalMatch, setDefusalMatch] = useState<DefusalStateData | null>(null);
  const [grinderMatch, setGrinderMatch] = useState<GrinderStateData | null>(null);
  const [killFeed, setKillFeed] = useState<KillFeedEntry[]>([]);
  const [defusalQueue, setDefusalQueue] = useState<DefusalQueueData | null>(null);
  const [inDefusalQueue, setInDefusalQueue] = useState(false);
  const [isBuyMenuOpen, setIsBuyMenuOpen] = useState(false);
  const [scopeStep, setScopeStep] = useState(0);
  const [flashUntil, setFlashUntil] = useState(0);

  const [isVendorOpen, setIsVendorOpen] = useState(false);
  const [lastSellResult, setLastSellResult] = useState<{ address: string; at: number } | null>(null);
  const [isSolaOpen, setIsSolaOpen] = useState(false);
  const [isAlfredoOpen, setIsAlfredoOpen] = useState(false);
  const [isGateStewardOpen, setIsGateStewardOpen] = useState(false);
  const [bubbleIndex, setBubbleIndex] = useState<number | null>(null);
  const [gateFactionIds, setGateFactionIds] = useState<string[]>([]);
  const [factionGates, setFactionGates] = useState<FactionGateData[]>([]);
  const [factionBubbleId, setFactionBubbleId] = useState<string | null>(null);
  const [isRoomPortalOpen, setIsRoomPortalOpen] = useState(false);
  const [influenceGate, setInfluenceGate] = useState<InfluenceGateData | null>(null);
  const [influenceCrystal, setInfluenceCrystal] = useState<InfluenceCrystalPanelData | null>(null);
  const [influenceState, setInfluenceState] = useState<InfluenceStateData | null>(null);
  const [influenceCapture, setInfluenceCapture] = useState<InfluenceCaptureData | null>(null);
  const [buildEditorState, setBuildEditorState] = useState<BuildSessionState | null>(null);
  const [isPosterPaintOpen, setIsPosterPaintOpen] = useState(false);
  const [paintTarget, setPaintTarget] = useState<{ key: string; aspect: number; url: string | null } | null>(null);
  const [isRoomConsoleOpen, setIsRoomConsoleOpen] = useState(false);
  const [roomConsoleFactionId, setRoomConsoleFactionId] = useState<string | null>(null);
  const [isBubbleMapOpen, setIsBubbleMapOpen] = useState(false);
  const [ownBubbleIndex, setOwnBubbleIndex] = useState<number | null>(null);
  const [bubbleWaypoint, setBubbleWaypoint] = useState<number | null>(null);
  const [accountCount, setAccountCount] = useState(0);
  const [shardState, setShardState] = useState<ShardStateData | null>(null);
  const [isPersonalizationOpen, setIsPersonalizationOpen] = useState(false);
  const [mySkinUrl, setMySkinUrl] = useState<string | null>(null);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [supportPrefillMessage, setSupportPrefillMessage] = useState("");
  const openSupportWithReport = (wallet: string, nickname: string) => {
    setSupportPrefillMessage(`Reporting player ${nickname} (${wallet}):\n\n`);
    setIsSupportOpen(true);
  };
  const [isVoiceCapturing, setIsVoiceCapturing] = useState(false);
  const [signEditorId, setSignEditorId] = useState<string | null>(null);
  const [viewingSign, setViewingSign] = useState<SignViewData | null>(null);
  const [isPlaceableMenuOpen, setIsPlaceableMenuOpen] = useState(false);
  const [wheelMode, setWheelMode] = useState<WheelMode>(null);
  const [isSpecializationOpen, setIsSpecializationOpen] = useState(false);
  const [isSkillTreeOpen, setIsSkillTreeOpen] = useState(false);
  const [spawnProtectionSeconds, setSpawnProtectionSeconds] = useState(0);
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null);
  const defusalMe = defusalMatch?.roster.find((entry) => entry.id === localPlayerId) ?? null;
  const grinderMe = grinderMatch?.roster.find((entry) => entry.id === localPlayerId) ?? null;
  const dust2Me = defusalMe ?? grinderMe;
  const inDust2Match = defusalMatch !== null || grinderMatch !== null;
  const [homeTeleport, setHomeTeleport] = useState({ casting: false, cooldownUntil: 0 });
  const [storage, setStorage] = useState<{ key: string | null; slots: number; entries: InventoryEntry[] }>({
    key: null,
    slots: 0,
    entries: [],
  });

  const [activeTopWindow, setActiveTopWindow] = useState<TopWindowId | null>(null);
  const [isCreateFactionModalOpen, setIsCreateFactionModalOpen] = useState(false);
  const [factionPanelSkipIntro, setFactionPanelSkipIntro] = useState(false);
  const [socialInitialTab, setSocialInitialTab] = useState<SocialTab>("friends");

  const hud = useHudState();
  const partyState = usePartyState();
  const arenaState = useArenaState();
  const [isArenaPanelOpen, setIsArenaPanelOpen] = useState(false);
  const [arenaBestWave, setArenaBestWave] = useState(0);
  const quest = useQuestState();
  const npcDialogue = useNpcDialogue(useCallback((npcId: NpcId) => {
    gameRef.current?.markNpcMet(npcId);
  }, []));
  const progressionState = useProgressionState();
  const abilityState = useAbilityState(progressionState.progression);
  const inventory = useInventoryState();
  const chat = useChatState();
  const pm = usePrivateMessagesState();
  const notifications = useNotifications();
  const canyonMap = useCanyonMapState();
  const factionState = useFactionState();
  const factionQuestState = useFactionQuestState();
  const tournamentState = useTournamentState();
  const pendingBuildTournament =
    tournamentState.tournaments.find((entry) => entry.id === tournamentState.pendingBuildShot) ?? null;
  const cosmeticState = useCosmeticState();
  const companionState = useCompanionState();
  const cosmeticCrateState = useCosmeticCrateState();
  const profileState = useProfileState();
  const leaderboardState = useLeaderboardState();
  const socialState = useSocialState();

  const [factionInviteTarget, setFactionInviteTarget] = useState<{ wallet: string; nickname: string } | null>(null);
  const [isCrateOpeningVisible, setIsCrateOpeningVisible] = useState(false);
  const [isPerfPanelOpen, setIsPerfPanelOpen] = useState(false);

  const clearCrateDrop = companionState.clearDrop;
  const handleOpenCrate = useCallback(() => {
    clearCrateDrop();
    setIsCrateOpeningVisible(true);
    gameRef.current?.openCrate();
  }, [clearCrateDrop]);

  const [tradeSession, setTradeSession] = useState<TradeSessionData | null>(null);
  const [pendingTradeInvite, setPendingTradeInvite] = useState<{ tradeId: string; fromWallet: string; fromNickname: string } | null>(null);

  const [hotbarSlots, setHotbarSlots] = useState<HotbarSlot[]>([
    { id: "rifle", icon: "🔫", name: t("g.wheel.rifle"), equipped: true },
    { id: "slot2", icon: "", name: "", equipped: false },
    { id: "slot3", icon: "", name: "", equipped: false },
    { id: "slot4", icon: "", name: "", equipped: false },
    { id: "slot5", icon: "", name: "", equipped: false },
  ]);

  const isInOwnFactionRoom = currentLocationId.startsWith("faction-gate-") &&
    factionState.myFactions.some((f) => f.id === currentLocationId.slice("faction-gate-".length));

  const getSlotLockReason = (slotId: string, isEquipped: boolean): string | null => {
    if (slotId === "rifle" && currentLocationId === "tower-main-hall" && !isEquipped) {
      return t("g.lock.noWeaponsMainHall");
    }
    if (slotId === "blueprint" && currentLocationId !== "main-world" && !isInOwnFactionRoom && !isEquipped) {
      return t("g.lock.blueprintPlaces");
    }
    return null;
  };

  const displayHotbarSlots = hotbarSlots.map((slot) => {
    const lockReason = getSlotLockReason(slot.id, slot.equipped);
    return lockReason ? { ...slot, locked: true, lockReason } : slot;
  });

  const handleSlotClick = (index: number) => {
    const slot = hotbarSlots[index];
    if (!slot.icon) return;

    const lockReason = getSlotLockReason(slot.id, slot.equipped);
    if (lockReason) {
      notifications.addNotification(lockReason, 2500);
      return;
    }

    if (slot.id === "rifle") {
      gameRef.current?.setWeaponEquipped(!slot.equipped);
    }
  };

  const isBlueprintEquipped = hud.hudState.equippedTool === "blueprint";

  useEffect(() => {
    const markers: Record<string, QuestMarkerKind> = {};
    const tracker = quest.questTracker;

    if (tracker) {
      if (tracker.status === "not_started") {
        markers[SOLA_INTERACTION_ID] = "available";
      } else if (tracker.status === "ready_to_turn_in") {
        markers[SOLA_INTERACTION_ID] = "turnin";
      } else if (tracker.status === "active") {
        const targets = quest.questInfo?.targets ?? [];
        const visited = tracker.visited ?? [];
        for (const target of targets) {
          if (!visited.includes(target.id)) markers[target.id] = "target";
        }
      }
    }

    gameRef.current?.setQuestMarkers(markers);
  }, [quest.questTracker, quest.questInfo, currentLocationId]);

  const isWeaponEquipped = hud.hudState.equippedTool === "weapon";
  const isArcanist = progressionState.progression?.branch === "arcanist";

  const toolWheelPages: WheelPage[] = [
    {
      id: "tools",
      label: t("g.wheel.tools"),
      items: [
        {
          id: "weapon",
          label: isWeaponEquipped ? t("g.wheel.putAway") : isArcanist ? t("g.wheel.staff") : t("g.wheel.rifle"),
          emoji: isArcanist ? "🪄" : "🔫",
          accent: "#FF7A4D",
          hint: isWeaponEquipped ? t("g.wheel.holster") : t("g.wheel.draw"),
          locked: !!getSlotLockReason("rifle", isWeaponEquipped),
          lockReason: getSlotLockReason("rifle", isWeaponEquipped) ?? undefined,
        },
        {
          id: "blueprint",
          label: isBlueprintEquipped ? t("g.wheel.putAway") : t("g.wheel.blueprint"),
          emoji: "📐",
          accent: "#4FD1FF",
          hint: t("g.wheel.toggleBuild"),
          locked: !!getSlotLockReason("blueprint", isBlueprintEquipped),
          lockReason: getSlotLockReason("blueprint", isBlueprintEquipped) ?? undefined,
        },
        {
          id: "placeables",
          label: t("g.wheel.placeables"),
          emoji: "🪑",
          accent: "#FFD166",
          hint: t("g.wheel.choosePlaceable"),
          locked: !isBlueprintEquipped,
          lockReason: t("g.wheel.equipBlueprint"),
        },
      ],
    },
  ];

  const emoteWheelPages: WheelPage[] = [
    {
      id: "emotes",
      label: t("g.wheel.emotes"),
      items: EMOTES.map((emote) => ({
        id: emote.key,
        label: t(emote.label),
        emoji: emote.emoji,
        accent: emote.accent,
        hint: t(emote.hint),
      })),
    },
  ];

  const degenWheelPages: WheelPage[] = [
    {
      id: "degen",
      label: t("g.wheel.degen"),
      items: MEME_ABILITIES.map((ability) => {
        const unlocked = progressionState.progression?.memeAbilities.includes(ability.id) ?? false;
        const readyAt = progressionState.memeCooldowns[ability.id] ?? 0;
        const remaining = Math.max(0, readyAt - Date.now());

        return {
          id: ability.id,
          label: t(ability.name),
          emoji: ability.emoji,
          accent: TIERS.find((t) => t.memeAbility === ability.id)?.accent ?? "#FFD166",
          hint: remaining > 0 ? t("g.wheel.readyIn", { seconds: Math.ceil(remaining / 1000) }) : t(ability.description),
          locked: !unlocked || remaining > 0,
          lockReason: unlocked
            ? t("g.wheel.recharging", { seconds: Math.ceil(remaining / 1000) })
            : t("g.wheel.unlocksAtLevel", { level: TIERS.find((tier) => tier.memeAbility === ability.id)?.minLevel ?? 1 }),
        };
      }),
    },
  ];

  const touchWheelPages: WheelPage[] = [...toolWheelPages, ...emoteWheelPages, ...degenWheelPages];

  const closeWheel = (relock: boolean = true) => {
    setWheelMode(null);
    if (relock) canvasRef.current?.requestPointerLock().catch(() => { });
  };

  const openWheel = (mode: WheelMode) => {
    setWheelMode(mode);
    document.exitPointerLock();
  };

  const handleWheelSelect = (pageId: string, itemId: string) => {
    if (pageId === "tools") {
      if (itemId === "weapon") {
        gameRef.current?.setWeaponEquipped(!isWeaponEquipped);
        closeWheel();
        return;
      }
      if (itemId === "blueprint") {
        gameRef.current?.setBlueprintEquipped(!isBlueprintEquipped);
        closeWheel();
        return;
      }
      if (itemId === "placeables") {
        closeWheel(false);
        setIsPlaceableMenuOpen(true);
      }
      return;
    }

    if (pageId === "emotes") {
      if (isEmoteKey(itemId)) {
        gameRef.current?.playEmote(itemId);
        closeWheel();
      }
      return;
    }

    if (pageId === "degen") {
      gameRef.current?.castMeme(itemId);
      closeWheel();
    }
  };

  const branchChosen = progressionState.progression?.branch ?? null;
  const branchUnlocked = progressionState.progression?.branchUnlocked ?? false;

  useEffect(() => {
    if (branchChosen !== null || !branchUnlocked) return;
    setIsSpecializationOpen(true);
    document.exitPointerLock();
  }, [branchChosen, branchUnlocked]);

  useEffect(() => {
    void keepSessionAlive();
    const timer = setInterval(() => { void keepSessionAlive(); }, SESSION_KEEPALIVE_MS);
    const onWake = () => { if (document.visibilityState === "visible") void keepSessionAlive(); };

    document.addEventListener("visibilitychange", onWake);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, []);

  useEffect(() => {
    const handleScrollKeys = (e: KeyboardEvent) => {
      if (!document.pointerLockElement) return;
      const scrollKeys = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End"];
      if (scrollKeys.includes(e.code)) {
        e.preventDefault();
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (document.pointerLockElement) {
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleScrollKeys, { passive: false });
    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("keydown", handleScrollKeys);
      window.removeEventListener("wheel", handleWheel);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let localGame: Game | null = null;

    const initGame = async () => {
      try {
        setLoadingMessage("Authenticating with game server...");
        const session = await apiPost<GameSession>("/api/game/session", { gameSlug: slug });
        if (cancelled) return;

        if (!canvasRef.current) throw new Error("Canvas element not found");
        canvasRef.current.tabIndex = 0;
        canvasRef.current.style.outline = "none";
        setLoadingMessage("Creating game world...");

        const game = new Game(canvasRef.current, slug, {
          gameToken: session.gameToken,
          serverUrl: session.serverUrl,
          userId: session.userId,
          wallet: session.wallet,
        });
        localGame = game;
        gameRef.current = game;
        setInputManager(game.getInputManager());

        game.onStateChange = (state) => { if (!cancelled) hud.handleStateChange(state); };
        game.onLoadStateChange = (loading, message, progress) => {
          if (cancelled) return;
          setLoading(loading);
          if (message) setLoadingMessage(message);
          if (typeof progress === "number") setLoadingProgress(progress);
        };
        game.onNotification = (msg, duration = 3000) => {
          if (cancelled) return;
          notifications.addNotification(msg, duration);
        };
        game.onChatMessage = (message) => { if (!cancelled) chat.handleChatMessage(message); };
        game.onNicknameLoaded = (nick: string) => { if (!cancelled) chat.handleNicknameLoaded(nick); };
        game.onLocationChange = (id: string) => {
          if (cancelled) return;
          setCurrentLocationId(id);
          if (id !== "tower-basement") {
            setIsBubbleMapOpen(false);
          }
        };
        game.onBuildEditorState = (state) => {
          if (cancelled) return;
          setBuildEditorState(state);
        };

        game.onFloorSelectorToggle = (isOpen: boolean) => {
          if (cancelled) return;
          setShowFloorSelector(isOpen);
          if (isOpen) document.exitPointerLock();
        };
        game.onInventoryChange = (inv, ashValue, placeablesValue) => {
          if (cancelled) return;
          inventory.handleInventoryChange(inv, ashValue, placeablesValue);
        };
        game.onBuildArmedChange = (armed) => {
          if (cancelled) return;
          setBuildArmed(armed);
        };
        game.onOpenTokenUI = (tokenData) => {
          if (cancelled) return;
          inventory.handleOpenTokenUI(tokenData);
        };
        game.onNpcMet = (metNpcs) => {
          if (cancelled) return;
          npcDialogue.handleMetNpcs(metNpcs);
        };
        game.onOpenVendorUI = () => {
          if (cancelled) return;
          npcDialogue.greet("token-vendor", () => {
            setIsVendorOpen(true);
            document.exitPointerLock();
          });
        };
        game.onOpenSolaUI = () => {
          if (cancelled) return;
          npcDialogue.greet("quest-giver-sola", () => {
            quest.resetQuestInfo();
            setIsSolaOpen(true);
            gameRef.current?.talkToQuestGiver(SOLA_NPC_ID);
            document.exitPointerLock();
          });
        };
        game.onOpenAlfredoUI = () => {
          if (cancelled) return;
          npcDialogue.greet("npc-alfredo", () => {
            setIsAlfredoOpen(true);
            document.exitPointerLock();
          });
        };
        game.onOpenGateStewardUI = () => {
          if (cancelled) return;
          npcDialogue.greet("gate-steward", () => {
            setIsGateStewardOpen(true);
            document.exitPointerLock();
          });
        };
        game.onOpenTournamentBoardUI = () => {
          if (cancelled) return;
          tournamentState.setIsTournamentBoardOpen(true);
          document.exitPointerLock();
        };
        game.onOpenPlayerBubbleUI = (index) => {
          if (cancelled) return;
          setBubbleIndex(index);
          document.exitPointerLock();
        };
        game.onFactionGatesChange = (gates) => {
          if (cancelled) return;
          setFactionGates(gates);
          setGateFactionIds(gates.map((g) => g.factionId));
        };
        game.onOpenFactionBubbleUI = (factionId) => {
          if (cancelled) return;
          setFactionBubbleId(factionId);
          document.exitPointerLock();
        };
        game.onOpenRoomPortalUI = () => {
          if (cancelled) return;
          setIsRoomPortalOpen(true);
          document.exitPointerLock();
        };
        game.onOpenInfluenceGateUI = (data) => {
          if (cancelled) return;
          setInfluenceGate(data);
          document.exitPointerLock();
        };
        game.onOpenInfluenceCrystalUI = (data) => {
          if (cancelled) return;
          setInfluenceCrystal(data);
          document.exitPointerLock();
        };
        game.onInfluenceStateChange = (data) => {
          if (cancelled) return;
          setInfluenceState(data);
        };
        game.onInfluenceCaptureChange = (data) => {
          if (cancelled) return;
          setInfluenceCapture(data);
        };
        game.onOpenRoomConsoleUI = (consoleFactionId) => {
          if (cancelled) return;
          setRoomConsoleFactionId(consoleFactionId);
          setIsRoomConsoleOpen(true);
          document.exitPointerLock();
        };
        game.onAccountCountChange = (count) => {
          if (!cancelled) setAccountCount(count);
        };
        game.onShardStateChange = (state) => {
          if (!cancelled) setShardState(state);
        };

        gameFetch("/api/game/my-bubble")
          .then((res) => res.json())
          .then((data) => {
            if (cancelled || typeof data?.bubbleIndex !== "number") return;
            setOwnBubbleIndex(data.bubbleIndex);
            game.setOwnBubbleIndex(data.bubbleIndex);
          })
          .catch(() => { });
        game.onOpenSignEditorUI = (signId) => {
          if (cancelled) return;
          setSignEditorId(signId);
          document.exitPointerLock();
        };
        game.onSellResult = (data) => {
          if (cancelled) return;
          setLastSellResult({ address: data.address, at: Date.now() });
        };
        game.onOpenPosterPaintUI = (pieceKey) => {
          if (cancelled) return;
          const target = game.buildSession.getPaintTarget(pieceKey);
          if (!target) return;
          setPaintTarget({ key: pieceKey, ...target });
          setIsPosterPaintOpen(true);
          document.exitPointerLock();
        };
        game.onOpenSignViewerUI = (sign) => {
          if (cancelled) return;
          setViewingSign(sign);
          document.exitPointerLock();
        };
        game.onEquippedToolChange = (tool) => {
          if (cancelled) return;
          setHotbarSlots((prev) =>
            prev.map((s) => ({
              ...s,
              equipped: (s.id === "rifle" && tool === "weapon") || (s.id === "blueprint" && tool === "blueprint"),
            }))
          );
        };
        game.onMySkinChange = (url) => { if (!cancelled) setMySkinUrl(url); };
        game.onQuestInfo = (data) => { if (!cancelled) quest.handleQuestInfo(data); };
        game.onQuestUpdate = (data) => { if (!cancelled) quest.handleQuestUpdate(data); };
        game.onProgressionState = (data) => { if (!cancelled) progressionState.handleProgressionState(data); };
        game.onBranchSelected = (branch) => {
          if (cancelled) return;
          setIsSpecializationOpen(false);
          notifications.addNotification(t("g.notify.specSet", { branch: branch === "gunslinger" ? t("g.spec.gunslinger") : t("g.spec.arcanist") }), 3500);
        };
        game.onSkillLearnRejected = (data) => {
          if (cancelled) return;
          const reasons: Record<string, string> = {
            level_too_low: "g.skillReject.levelTooLow",
            column_points_too_low: "g.skillReject.columnPoints",
            no_points: "g.skillReject.noPoints",
            max_rank: "g.skillReject.maxRank",
            wrong_branch: "g.skillReject.wrongBranch",
          };
          notifications.addNotification(t(reasons[data.reason] ?? "g.skillReject.default"), 2500);
        };
        game.onSkillsRespecced = (data) => {
          if (cancelled) return;
          notifications.addNotification(
            data.costAsh > 0 ? t("g.notify.respecPaid", { amount: data.costAsh }) : t("g.notify.respec"),
            3500
          );
        };
        game.onAbilityResult = (data) => {
          if (cancelled) return;
          abilityState.handleAbilityResult(data);
          if (!data.ok) notifications.addNotification(t(rejectionMessage(data.reason)), 2000);
        };
        game.onAbilityMeter = (data) => { if (!cancelled) abilityState.handleAbilityMeter(data); };
        game.onFireModeChanged = (mode) => {
          if (cancelled) return;
          notifications.addNotification(t("g.notify.fireMode", { mode: fireModeLabel(mode) }), 2000);
        };
        game.onMemeResult = (data) => {
          if (cancelled) return;
          progressionState.handleMemeResult(data);
          if (data.ok) return;

          const meme = MEME_ABILITIES_BY_ID.get(data.memeId);
          notifications.addNotification(
            data.reason === "cooldown"
              ? t("g.notify.memeCooldown", { emoji: meme?.emoji ?? "🚧", name: meme ? t(meme.name) : t("g.notify.thatAbility") })
              : data.reason === "locked"
                ? t("g.notify.memeLocked", { name: meme ? t(meme.name) : t("g.notify.thatAbility") })
                : t("g.notify.memeFailed"),
            2000
          );
        };
        game.onAbilityTrigger = (data) => {
          if (cancelled) return;
          notifications.addNotification(
            data.triggerId === "second_wind" ? t("g.notify.secondWind") : t("g.notify.soulTether"),
            3500
          );
        };
        game.onXpGain = (data) => { if (!cancelled) progressionState.handleXpGain(data); };
        game.onLevelUp = (data) => { if (!cancelled) progressionState.handleLevelUp(data); };
        game.onPlayerLevelUpdate = (data) => { if (!cancelled) progressionState.handlePlayerLevelUpdate(data); };
        game.onOpenCanyonMapUI = () => {
          if (cancelled) return;
          npcDialogue.greet("canyon-dispatcher", () => {
            canyonMap.openWithReset();
            gameRef.current?.talkToDispatcher();
            document.exitPointerLock();
          });
        };
        game.onCanyonMap = (data) => { if (!cancelled) canyonMap.handleCanyonMap(data); };
        game.onOpenFactionBrokerUI = () => {
          if (cancelled) return;
          npcDialogue.greet("faction-broker", () => {
            setFactionPanelSkipIntro(false);
            setIsCreateFactionModalOpen(true);
            document.exitPointerLock();
          });
        };
        game.onFactionJoined = (f) => { if (!cancelled) factionState.handleFactionJoined(f); };
        game.onFactionLeft = (factionId) => { if (!cancelled) factionState.handleFactionLeft(factionId); };
        game.onFactionMyListResult = (list) => { if (!cancelled) factionState.handleFactionMyListResult(list); };
        game.onFactionDisplayedSet = (f) => { if (!cancelled) factionState.handleFactionDisplayedSet(f); };
        game.onFactionSearchResult = (results) => { if (!cancelled) factionState.handleFactionSearchResult(results); };
        game.onFactionListResult = (data) => { if (!cancelled) factionState.handleFactionListResult(data); };
        game.onFactionInfo = (f) => { if (!cancelled) factionState.handleFactionInfo(f); };
        game.onFactionTaskListResult = (tasks) => { if (!cancelled) factionState.handleFactionTaskListResult(tasks); };
        game.onFactionTaskAccepted = (f) => { if (!cancelled) factionState.handleFactionTaskAccepted(f); };
        game.onFactionCreatorClaimResult = (data) => { if (!cancelled) factionState.handleFactionCreatorClaimResult(data); };
        game.onFactionCreatorVerified = (f) => { if (!cancelled) factionState.handleFactionCreatorVerified(f); };
        game.onFactionQuestListResult = (quests) => { if (!cancelled) factionQuestState.handleFactionQuestListResult(quests); };
        game.onFactionQuestManageListResult = (data) => { if (!cancelled) factionQuestState.handleFactionQuestManageListResult(data); };
        game.onFactionQuestCreated = (data) => { if (!cancelled) factionQuestState.handleFactionQuestCreated(data); };
        game.onFactionQuestClaimed = (data) => { if (!cancelled) factionQuestState.handleFactionQuestClaimed(data); };
        game.onTournamentListResult = (list) => { if (!cancelled) tournamentState.handleTournamentListResult(list); };
        game.onTournamentEntriesResult = (data) => { if (!cancelled) tournamentState.handleTournamentEntriesResult(data); };
        game.onTournamentActionResult = (data) => { if (!cancelled) gameRef.current?.requestTournamentEntries(data.tournamentId); };
        game.onCosmeticState = (data) => { if (!cancelled) cosmeticState.handleCosmeticState(data); };
        game.onCompanionState = (data) => { if (!cancelled) companionState.handleCompanionState(data); };
        game.onCrateOpened = (data) => { if (!cancelled) companionState.handleCrateOpened(data); };
        game.onCosmeticCrateState = (data) => { if (!cancelled) cosmeticCrateState.handleState(data); };
        game.onCosmeticCrateOpened = (data) => {
          if (cancelled) return;
          cosmeticCrateState.handleOpened(data);
          const definition = COSMETICS_BY_ID.get(data.itemId as CosmeticId);
          notifications.addNotification(t("g.skinCrate.dropped", { name: definition ? t(definition.name) : data.itemId }), 3500);
        };
        game.onCompanionDusted = (data) => {
          if (cancelled) return;
          companionState.handleCompanionDusted(data);
          notifications.addNotification(`+${data.gained} ${t("g.fragments.title")}`, 2500);
        };
        game.onSpawnProtectionChange = (seconds) => { if (!cancelled) setSpawnProtectionSeconds(seconds); };
        game.onSelfProfile = (p) => { if (!cancelled) profileState.handleSelfProfile(p); };
        game.onViewedProfile = (p) => { if (!cancelled) profileState.handleViewedProfile(p); };
        game.onLeaderboardResult = (results) => { if (!cancelled) leaderboardState.handlePlayerLeaderboardResult(results); };
        game.onFactionLeaderboardResult = (results) => { if (!cancelled) leaderboardState.handleFactionLeaderboardResult(results); };
        game.onFriendRequestSent = (friend, status) => { if (!cancelled) socialState.handleFriendRequestSent(friend, status); };
        game.onFriendRequestAccepted = (friend) => { if (!cancelled) socialState.handleFriendRequestAccepted(friend); };
        game.onFriendRequestDeclined = (requestUserId) => { if (!cancelled) socialState.handleFriendRequestDeclined(requestUserId); };
        game.onFriendRemoved = (friendUserId) => { if (!cancelled) socialState.handleFriendRemoved(friendUserId); };
        game.onFriendsListResult = (data) => { if (!cancelled) socialState.handleFriendsListResult(data); };
        game.onFriendSearchResult = (results) => { if (!cancelled) socialState.handleFriendSearchResult(results); };
        game.onMailSent = (mailId) => { if (!cancelled) socialState.handleMailSent(mailId); };
        game.onMailInboxResult = (data) => { if (!cancelled) socialState.handleMailInboxResult(data); };
        game.onMailMarkedRead = (mailId) => { if (!cancelled) socialState.handleMailMarkedRead(mailId); };
        game.onMailReceived = () => {
          if (cancelled) return;
          socialState.handleMailReceived();
          gameRef.current?.requestMailInbox();
        };
        game.onFriendRequestReceived = (friend) => { if (!cancelled) socialState.handleFriendRequestReceived(friend); };
        game.onUserBlocked = (entry) => { if (!cancelled) socialState.handleUserBlocked(entry); };
        game.onUserUnblocked = (blockedUserId) => { if (!cancelled) socialState.handleUserUnblocked(blockedUserId); };
        game.onBlockedListResult = (list) => { if (!cancelled) socialState.handleBlockedListResult(list); };
        game.onPrivateMessage = (data) => { if (!cancelled) pm.handlePrivateMessage(data); };
        game.onPrivateMessageSent = (data) => { if (!cancelled) pm.handlePrivateMessageSent(data); };
        game.onPrivateMessageError = (data) => {
          if (cancelled) return;
          if (data.code === 'offline') notifications.addNotification(t("g.notify.playerOffline"), 2500);
          else notifications.addNotification(t("g.notify.messageUndelivered"), 2500);
        };
        game.onFactionChatMessage = (message) => { if (!cancelled) chat.handleFactionChatMessage(message); };
        game.onTradeSession = (data) => {
          if (cancelled) return;
          setTradeSession(data);
          if (data.phase === 'completed') {
            notifications.addNotification(t("g.notify.tradeCompleted", { item: data.itemName ? t(data.itemName) : t("g.notify.anItem") }), 3000);
          } else if (data.phase === 'failed') {
            notifications.addNotification(
              data.critical ? t("g.notify.tradeCritical") : t("g.notify.tradeFailed"),
              3500
            );
          } else if (data.phase === 'declined') {
            notifications.addNotification(t("g.notify.tradeDeclined"), 2200);
          } else if (data.phase === 'cancelled') {
            notifications.addNotification(t("g.notify.tradeCancelled"), 2200);
          } else if (data.phase === 'expired') {
            notifications.addNotification(t("g.notify.tradeExpired"), 2200);
          }
        };
        game.onTradeInviteReceived = (data) => { if (!cancelled) setPendingTradeInvite(data); };
        game.onTradeInviteError = (data) => {
          if (cancelled) return;
          const messages: Record<string, string> = {
            offline: "g.notify.playerOffline",
            self: "g.tradeInvite.self",
            already_active: "g.tradeInvite.alreadyActive",
            target_busy: "g.tradeInvite.targetBusy",
            blocked: "g.tradeInvite.blocked",
            rate_limited: "g.tradeInvite.rateLimited",
          };
          notifications.addNotification(t(messages[data.code] || "g.tradeInvite.default"), 2500);
        };
        game.onDamageEvent = (event) => { if (!cancelled) hud.handleDamageEvent(event); };
        game.onDeathStateChange = (dead, killer, options, loot) => { if (!cancelled) hud.handleDeathStateChange(dead, killer, options, loot); };
        game.onCombatStateChange = (until) => { if (!cancelled) hud.handleCombatState(until); };
        game.onLocalPlayerId = (id) => { if (!cancelled) setLocalPlayerId(id); };
        game.onPartyState = (state) => { if (!cancelled) partyState.handlePartyState(state); };
        game.onPartyVitals = (members) => { if (!cancelled) partyState.handlePartyVitals(members); };
        game.onPartyInvite = (invite) => { if (!cancelled) partyState.handlePartyInvite(invite); };
        game.onPartyInviteExpired = (fromId) => { if (!cancelled) partyState.handleInviteExpired(fromId); };
        game.onPartyDisbanded = () => { if (!cancelled) partyState.dismissInvite(); };
        game.onArenaState = (state) => { if (!cancelled) arenaState.handleArenaState(state); };
        game.onArenaCandleDamage = (health, maxHealth) => { if (!cancelled) arenaState.handleCandleDamage(health, maxHealth); };
        game.onArenaReviveResult = (data) => { if (!cancelled) arenaState.handleReviveResult(data); };
        game.onArenaStartResult = (cooldownUntil) => { if (!cancelled) arenaState.handleStartResult(cooldownUntil); };
        game.onArenaEnded = (data) => {
          if (cancelled) return;
          arenaState.handleArenaEnded(data);
          setArenaBestWave(data.bestWave);
          if (data.reason !== 'left') {
            setIsArenaPanelOpen(true);
            document.exitPointerLock();
          }
        };
        game.onOpenArenaUI = () => {
          if (cancelled) return;
          setIsArenaPanelOpen(true);
          document.exitPointerLock();
        };
        game.onDefusalState = (state) => {
          if (cancelled) return;
          setDefusalMatch(state);
          if (state) setInDefusalQueue(false);
        };
        game.onDefusalQueueState = (state) => { if (!cancelled) setDefusalQueue(state); };
        game.onGrinderState = (state) => {
          if (cancelled) return;
          setGrinderMatch(state);
          if (!state) setIsBuyMenuOpen(false);
        };
        game.onKillFeed = (entry) => {
          if (!cancelled) setKillFeed((prev) => [...prev.slice(-9), entry]);
        };
        game.onScopeStep = (step) => { if (!cancelled) setScopeStep(step); };
        game.onFlashed = (durationMs) => { if (!cancelled) setFlashUntil(Date.now() + durationMs); };
        game.onOpenEventDoorUI = (eventId) => {
          if (cancelled) return;
          setOpenEventDoorId(eventId);
          document.exitPointerLock();
        };
        game.onStuckStateChange = (cooldownUntil) => { if (!cancelled) hud.handleStuckState(cooldownUntil); };
        game.onHomeTeleportChange = (state) => {
          if (cancelled) return;
          setHomeTeleport({ casting: state.casting, cooldownUntil: state.cooldownUntil });
        };
        game.onStorageState = (state) => {
          if (cancelled) return;
          if (state.key === null) return;
          setStorage({ key: state.key, slots: state.slots, entries: state.entries });
          document.exitPointerLock();
        };
        game.onAuthError = (error) => {
          if (cancelled) return;
          if (error === 'banned') {
            setAuthError("🚫 You have been banned from this game.");
            setLoading(false);
          } else if (error === 'license_revoked') {
            setAuthError("Your access to this game was revoked because you no longer meet the requirements of the faction promo code that granted it (left the faction or lost its token).");
            setLoading(false);
          }
        };
        game.onDamageIndicatorUpdate = (attackerId, direction) => { if (!cancelled) hud.handleDamageIndicatorUpdate(attackerId, direction); };
        game.onHitMark = () => { if (!cancelled) hud.handleHitMark(); };
        game.onVoiceCapturingChange = (capturing) => { if (!cancelled) setIsVoiceCapturing(capturing); };

        await game.init();

        if (cancelled) {
          game.dispose();
        }
      } catch (error: any) {
        if (cancelled) return;
        if (error.message === "assets_load_failed") {
          setAuthError("Failed to load game assets. Please check your connection and try again.");
        } else if (error.message?.includes("no_license")) {
          setAuthError("You don't own this game. Please purchase it first.");
        } else if (error.message?.includes("license_expired")) {
          setAuthError("Your license has expired.");
        } else if (error.message?.includes("Unauthorized")) {
          setAuthError("Please log in to play.");
        } else if (error.message?.includes("banned")) {
          setAuthError("🚫 You have been banned from this game.");
        } else if (error.message?.includes("maintenance")) {
          setAuthError("🛠️ The game is currently down for maintenance. Please check back later.");
        } else {
          setAuthError(error.message || "Failed to start game");
        }
        setLoading(false);
      }
    };

    initGame();

    return () => {
      cancelled = true;
      setInputManager(null);
      localGame?.dispose();
      if (gameRef.current === localGame) {
        gameRef.current = null;
      }
    };
  }, [slug]);

  useEffect(() => {
    const handleLockChange = () => {
      const locked = !!document.pointerLockElement;
      setIsPointerLocked(locked);
    };
    document.addEventListener("pointerlockchange", handleLockChange);
    return () => document.removeEventListener("pointerlockchange", handleLockChange);
  }, []);

  useEffect(() => {
    if (!inputManager) return;

    inputManager.setTouchControlActive(touchMode);
    if (touchMode) setIsPointerLocked(true);

    return () => inputManager.setTouchControlActive(false);
  }, [inputManager, touchMode]);

  useEffect(() => {
    const handleUiClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const control = target?.closest("button, [role=\"button\"], a[href]");
      if (!control || control.hasAttribute("disabled")) return;
      SoundManager.getInstance().play("ui-click", { volume: 0.32 });
    };

    let hovered: Element | null = null;
    const handleUiHover = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const control = target?.closest("button, [role=\"button\"]") ?? null;
      if (control === hovered) return;
      hovered = control;
      if (control && !control.hasAttribute("disabled")) {
        SoundManager.getInstance().play("ui-hover", { volume: 0.14 });
      }
    };

    window.addEventListener("click", handleUiClick);
    window.addEventListener("mouseover", handleUiHover);
    return () => {
      window.removeEventListener("click", handleUiClick);
      window.removeEventListener("mouseover", handleUiHover);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (inventory.activeTokenData) return;

      if (e.code === "Escape") {
        if (showFloorSelector) {
          setShowFloorSelector(false);
          gameRef.current?.closeFloorSelector();
          return;
        }
        if (isVendorOpen) {
          setIsVendorOpen(false);
          return;
        }
        if (isSolaOpen) {
          setIsSolaOpen(false);
          return;
        }
        if (isPersonalizationOpen) {
          setIsPersonalizationOpen(false);
          return;
        }
        if (isAlfredoOpen) {
          setIsAlfredoOpen(false);
          return;
        }
        if (isGateStewardOpen) {
          setIsGateStewardOpen(false);
          return;
        }
        if (bubbleIndex !== null) {
          setBubbleIndex(null);
          return;
        }
        if (factionBubbleId !== null) {
          setFactionBubbleId(null);
          return;
        }
        if (isRoomPortalOpen) {
          setIsRoomPortalOpen(false);
          return;
        }
        if (isRoomConsoleOpen) {
          setIsRoomConsoleOpen(false);
          return;
        }
        if (isBubbleMapOpen) {
          setIsBubbleMapOpen(false);
          return;
        }
        if (tradeSession && tradeSession.phase !== 'settling') {
          gameRef.current?.cancelTrade(tradeSession.tradeId);
          return;
        }
        if (pendingTradeInvite) {
          gameRef.current?.respondToTradeInvite(pendingTradeInvite.tradeId, false);
          setPendingTradeInvite(null);
          return;
        }
        if (signEditorId !== null) {
          setSignEditorId(null);
          return;
        }
        if (viewingSign !== null) {
          setViewingSign(null);
          return;
        }
        if (wheelMode !== null) {
          setWheelMode(null);
          return;
        }
        if (isSpecializationOpen) {
          setIsSpecializationOpen(false);
          return;
        }
        if (isSkillTreeOpen) {
          setIsSkillTreeOpen(false);
          return;
        }
        if (isPlaceableMenuOpen) {
          setIsPlaceableMenuOpen(false);
          return;
        }
        if (canyonMap.isCanyonMapOpen) {
          canyonMap.setIsCanyonMapOpen(false);
          return;
        }
        if (isCreateFactionModalOpen) {
          setIsCreateFactionModalOpen(false);
          return;
        }
        if (isEventsPickerOpen) {
          setIsEventsPickerOpen(false);
          return;
        }
        if (openEventDoorId !== null) {
          setOpenEventDoorId(null);
          return;
        }
        if (isBuyMenuOpen) {
          setIsBuyMenuOpen(false);
          return;
        }
        if (activeTopWindow !== null) {
          setActiveTopWindow(null);
          return;
        }
        if (inventory.isInventoryOpen) {
          inventory.setIsInventoryOpen(false);
          return;
        }
        if (!document.pointerLockElement) {
          canvasRef.current?.requestPointerLock().catch(() => { });
        }
        return;
      }

      if (buildEditorState?.active) return;

      if (isVendorOpen || isSolaOpen || isAlfredoOpen || isGateStewardOpen || bubbleIndex !== null || factionBubbleId !== null || isRoomPortalOpen || isRoomConsoleOpen || isBubbleMapOpen || isPersonalizationOpen || canyonMap.isCanyonMapOpen || isCreateFactionModalOpen || isEventsPickerOpen || openEventDoorId !== null || isBuyMenuOpen || activeTopWindow !== null || signEditorId !== null || viewingSign !== null || isPlaceableMenuOpen || wheelMode !== null || isSpecializationOpen || isSkillTreeOpen || npcDialogue.dialogue !== null || tradeSession !== null || pendingTradeInvite !== null) return;

      if (e.code === "Enter" && isPointerLocked) {
        chat.setIsChatVisible((prev) => !prev);
      }

      if (e.code === "KeyI" && !showFloorSelector) {
        const activeTag = document.activeElement?.tagName;
        if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;
        inventory.setIsInventoryOpen((prev) => {
          const next = !prev;
          if (next) document.exitPointerLock();
          return next;
        });
        return;
      }

      if (e.code === "KeyK" && !showFloorSelector) {
        const activeTag = document.activeElement?.tagName;
        if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;
        setIsSkillTreeOpen((prev) => {
          const next = !prev;
          if (next) document.exitPointerLock();
          return next;
        });
        return;
      }

      if (e.code === "KeyM" && !showFloorSelector) {
        const activeTag = document.activeElement?.tagName;
        if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;
        if (currentLocationId !== "tower-basement") return;
        setIsBubbleMapOpen((prev) => {
          const next = !prev;
          if (next) document.exitPointerLock();
          return next;
        });
        return;
      }

      if (e.code === "F9") {
        e.preventDefault();
        setIsPerfPanelOpen((prev) => !prev);
        return;
      }

      if (e.code === "KeyL" && !showFloorSelector) {
        const activeTag = document.activeElement?.tagName;
        if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;
        setSocialInitialTab("account");
        setActiveTopWindow("social");
        document.exitPointerLock();
        return;
      }

      if (e.code === "KeyG" && !showFloorSelector && !inventory.isInventoryOpen) {
        const activeTag = document.activeElement?.tagName;
        if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;
        if (!e.repeat) gameRef.current?.startVoiceCapture();
        return;
      }

      if (isPointerLocked && !showFloorSelector) {
        const inDust2 = defusalMatch !== null || grinderMatch !== null;

        const hotbarIndex = HOTBAR_KEYS.indexOf(e.code);
        if (hotbarIndex !== -1) {
          if (!inDust2) handleSlotClick(hotbarIndex);
          return;
        }

        if (inDust2) {
          if (e.code === "KeyB" && !e.repeat) {
            const buyOpen = grinderMatch
              ? grinderMatch.phase === "live"
              : defusalMatch!.phase === "freeze" || defusalMatch!.phase === "warmup";
            if (buyOpen) {
              setIsBuyMenuOpen((prev) => {
                if (!prev) document.exitPointerLock();
                return !prev;
              });
              return;
            }
          }

          const slotKey = {
            Digit1: "primary",
            Digit2: "pistol",
            Digit3: "melee",
            Digit4: "grenade1",
            Digit5: "grenade2",
          }[e.code];

          if (slotKey && !e.repeat) {
            gameRef.current?.switchDefusalSlot(slotKey as HeldSlot);
            return;
          }

          // Wheels, hotbar, tools and the whole skill tree are shelved inside a
          // match — the arsenal decides everything.
          if (["KeyX", "KeyC", "KeyV", "KeyZ", "KeyQ", "KeyF", "KeyI", "KeyL", "KeyM"].includes(e.code)) return;
          if (ABILITY_KEY_MAP[e.code]) return;
        }

        if (e.code === "KeyE" && !e.repeat && defusalMatch) {
          const me = defusalMatch.roster.find((entry) => entry.id === localPlayerId);
          if (me?.alive) {
            if (defusalMatch.bomb?.state === "planted" && me.side === "ct") gameRef.current?.defuseBomb();
            else if (me.hasBomb) gameRef.current?.plantBomb();
          }
          return;
        }

        if (e.code === "KeyX" && !e.repeat) {
          openWheel("tools");
          return;
        }

        if (e.code === "KeyZ" && !e.repeat) {
          if (isBlueprintEquipped) {
            setIsPlaceableMenuOpen(true);
            document.exitPointerLock();
          } else {
            gameRef.current?.setBlueprintEquipped(true);
          }
          return;
        }

        if (e.code === "KeyC" && !e.repeat) {
          openWheel("emotes");
          return;
        }

        if (e.code === "KeyV" && !e.repeat) {
          openWheel("degen");
          return;
        }

        if (e.code === "KeyB" && !e.repeat) {
          gameRef.current?.cycleFireMode();
          return;
        }

        if (e.code === "NumpadDecimal" && !e.repeat) {
          gameRef.current?.toggleWeaponTuner();
          return;
        }

        if (e.code === "NumpadEnter" && !e.repeat) {
          gameRef.current?.toggleCosmeticTuner();
          return;
        }

        if (e.code === "Backquote" && !e.repeat) {
          gameRef.current?.toggleCanyonTuner();
          return;
        }

        const abilitySlot = ABILITY_KEY_MAP[e.code];
        if (abilitySlot && !e.repeat) {
          const abilityId = progressionState.progression?.loadout?.[abilitySlot];
          if (!abilityId) {
            notifications.addNotification(t("g.notify.noSkillBound"), 2000);
            return;
          }
          if ((abilityState.cooldowns[abilityId] ?? 0) > Date.now()) {
            SoundManager.getInstance().play("ability-fail", { volume: 0.4 });
            return;
          }
          SoundManager.getInstance().play("ability-cast", { volume: 0.5 });
          gameRef.current?.castAbility(abilityId);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [defusalMatch, grinderMatch, localPlayerId, isBuyMenuOpen, isPointerLocked, showFloorSelector, inventory.activeTokenData, isVendorOpen, isSolaOpen, isAlfredoOpen, isGateStewardOpen, bubbleIndex, isPersonalizationOpen, canyonMap.isCanyonMapOpen, inventory.isInventoryOpen, isCreateFactionModalOpen, isEventsPickerOpen, openEventDoorId, activeTopWindow, signEditorId, viewingSign, isPlaceableMenuOpen, wheelMode, isSpecializationOpen, isSkillTreeOpen, npcDialogue.dialogue, hud.hudState.equippedTool, tradeSession, pendingTradeInvite, abilityState.cooldowns]);

  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "KeyG") gameRef.current?.stopVoiceCapture();
    };
    window.addEventListener("keyup", handleKeyUp);
    return () => window.removeEventListener("keyup", handleKeyUp);
  }, []);

  const handleNicknameChange = (nick: string) => {
    gameRef.current?.setNickname(nick);
  };

  const handleSaveSkin = async (blob: Blob) => {
    const formData = new FormData();
    formData.append("file", blob, "skin.png");

    const res = await gameFetch("/api/game/skin/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      throw new Error(res.status === 401 || res.status === 403 ? "session_expired" : "upload_failed");
    }

    const data: { url: string } = await res.json();
    gameRef.current?.applyAndBroadcastSkin(data.url);
    notifications.addNotification(t("g.notify.lookSaved"), 2500);
  };

  // Build contests submit a screenshot rather than an asset the server already
  // has, so the client grabs the frame, uploads it, and only then tells the game
  // server which blob the entry points at. A shot only counts from inside the
  // player's own bubble, so anywhere else this hands off to the shutter prompt.
  const handleCaptureBuildShot = async (tournamentId: string) => {
    if (!gameRef.current?.isInOwnPersonalRoom()) {
      tournamentState.setPendingBuildShot(tournamentId);
      tournamentState.setIsTournamentBoardOpen(false);
      notifications.addNotification(t("g.tournament.goToBubble"), 4000);
      await gameRef.current?.teleportToPersonalRoom();
      return;
    }

    const blob = await gameRef.current?.captureScreenshot();
    if (!blob) {
      notifications.addNotification(t("g.tournament.shotFailed"), 3000);
      return;
    }

    const formData = new FormData();
    formData.append("file", blob, "build.png");

    const res = await gameFetch("/api/game/tournament-shot/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      notifications.addNotification(
        res.status === 401 || res.status === 403 ? t("g.paint.sessionExpired") : t("g.tournament.shotFailed"),
        3500
      );
      return;
    }

    const data: { url: string } = await res.json();
    gameRef.current?.sendTournamentAction({ action: "submitShot", tournamentId, shotUrl: data.url });
    tournamentState.setPendingBuildShot(null);
    notifications.addNotification(t("g.tournament.shotUploaded"), 2500);
  };

  const handleSignSaveText = async (signId: string, text: string) => {
    await gameRef.current?.setSignText(signId, text);
  };

  const handleSignSaveDrawing = async (signId: string, blob: Blob) => {
    const formData = new FormData();
    formData.append("file", blob, "sign.png");

    const res = await gameFetch("/api/game/sign/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      throw new Error(res.status === 401 || res.status === 403 ? "session_expired" : "upload_failed");
    }

    const data: { url: string } = await res.json();
    await gameRef.current?.setSignDrawingUrl(signId, data.url);
  };

  const handleSendMessage = (message: string) => {
    gameRef.current?.sendChatMessage(message);
  };

  const handleNicknameClick = (wallet: string) => {
    gameRef.current?.requestPlayerProfile(wallet);
  };

  const getNicknameMenuActions = (wallet: string, nickname: string): NicknameMenuActions => {
    const blockedEntry = socialState.blocked.find((b) => b.wallet === wallet);
    return {
      isBlocked: !!blockedEntry,
      canInviteToFaction: factionState.myFactions.length > 0,
      onInfo: () => gameRef.current?.requestPlayerProfile(wallet),
      onPrivateMessage: () => pm.openThread(wallet, nickname),
      onReport: () => openSupportWithReport(wallet, nickname),
      onToggleBlock: () => {
        if (blockedEntry) {
          gameRef.current?.unblockPlayer(blockedEntry.userId);
        } else {
          gameRef.current?.blockPlayer({ wallet });
        }
      },
      onInviteToFaction: () => setFactionInviteTarget({ wallet, nickname }),
      onTrade: () => gameRef.current?.sendTradeInvite(wallet),
      onInviteToParty: () => gameRef.current?.invitePlayerToParty(wallet),
    };
  };

  const handleTopMenuSelect = (id: TopWindowId) => {
    if (id === "social") setSocialInitialTab("friends");
    setActiveTopWindow((prev) => {
      const next = prev === id ? null : id;
      if (next !== null) document.exitPointerLock();
      return next;
    });
  };

  const handleSelectFloor = (floorId: string) => {
    if (floorId === "tower-events") {
      setShowFloorSelector(false);
      gameRef.current?.closeFloorSelector();
      if (factionState.myFactions.length === 0) {
        notifications.addNotification(t("g.notify.joinFactionForEvents"), 2500);
        return;
      }
      setIsEventsPickerOpen(true);
      return;
    }
    gameRef.current?.selectFloor(floorId);
  };

  const handleEnterEvents = (factionId: string, factionName: string) => {
    setIsEventsPickerOpen(false);
    gameRef.current?.enterEventsLocation(factionId, factionName);
  };

  if (authError) {
    const isAssetError = authError.includes("Failed to load game assets");
    const authErrorText = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_]+)+$/.test(authError) ? t(authError) : authError;
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-red-500/50 rounded-xl p-6 sm:p-8 max-w-md w-full text-center">
          <div className="text-5xl sm:text-6xl mb-4">{isAssetError ? "🌐" : "🔒"}</div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
            {isAssetError ? t("g.access.connectionTitle") : t("g.access.deniedTitle")}
          </h2>
          <p className="text-zinc-400 mb-6 break-words">{authErrorText}</p>
          <div className="flex gap-4 justify-center">
            {isAssetError && (
              <button
                onClick={() => window.location.reload()}
                className="btn-primary px-6 py-2"
              >
                {t("common.tryAgain")}
              </button>
            )}
            <button
              onClick={() => (window.location.href = "/")}
              className="btn-secondary px-6 py-2"
            >
              {t("common.backToStore")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={gameContainerRef}
      id={GAME_ROOT_ID}
      data-touch={touchMode ? "true" : undefined}
      className="fixed left-0 right-0 bottom-0 z-50 bg-black overflow-hidden"
      style={
        !touchMode
          ? { top: 'var(--header-height, 64px)', height: 'calc(100dvh - var(--header-height, 64px))' }
          : rotated
            ? {
              top: 0,
              left: 0,
              right: 'auto',
              bottom: 'auto',
              width: '100dvh',
              height: '100dvw',
              transform: 'rotate(90deg) translateY(-100%)',
              transformOrigin: 'top left',
            }
            : { top: 0, height: '100dvh' }
      }
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-pointer"
        style={{
          width: '100%',
          height: '100%',
          display: 'block'
        }}
      />

      {loading && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center z-50">
          <Spinner size="lg" />
          <p className="text-white mt-4 text-lg font-mono">{loadingMessage}</p>
          <div className="mt-4 w-64 h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-all duration-300 ease-out"
              style={{ width: `${Math.round(loadingProgress * 100)}%` }}
            />
          </div>
        </div>
      )}

      <HUD
        state={hud.hudState}
        isPointerLocked={isPointerLocked}
        isHitMark={hud.isHitMark}
        isTalking={isVoiceCapturing}
        spawnProtectionSeconds={spawnProtectionSeconds}
        combatRemainingMs={hud.combatRemainingMs}
        partyMembers={partyState.party.members}
        partyLeaderId={partyState.party.leaderId}
        localPlayerId={localPlayerId}
        shardState={shardState}
        onSwitchShard={(instance) => gameRef.current?.switchShard(instance)}
        progression={inDust2Match ? null : progressionState.progression}
        xpPopups={inDust2Match ? [] : progressionState.xpPopups}
        onOpenSkills={() => {
          setIsSkillTreeOpen(true);
          document.exitPointerLock();
        }}
        rightRail={inDust2Match ? null : <QuestTracker quest={quest.questTracker} />}
        topCenter={
          <>
            <ArenaHUD
              arena={arenaState.arena}
              revive={arenaState.revive}
              localPlayerId={localPlayerId}
            />
            <LevelUpToast event={progressionState.levelUp} onDismiss={progressionState.dismissLevelUp} />
          </>
        }
      />
      <SkillTreeWindow
        isOpen={isSkillTreeOpen}
        onClose={() => setIsSkillTreeOpen(false)}
        progression={progressionState.progression}
        onLearn={(nodeId) => gameRef.current?.learnSkill(nodeId)}
        onBind={(slot, abilityId) => gameRef.current?.bindAbility(slot, abilityId)}
        onOpenSpecialization={() => {
          setIsSkillTreeOpen(false);
          setIsSpecializationOpen(true);
        }}
      />
      <PerfPanel isOpen={isPerfPanelOpen} onClose={() => setIsPerfPanelOpen(false)} />

      {!defusalMatch && !grinderMatch && (
        <TopMenu
          active={activeTopWindow}
          onSelect={handleTopMenuSelect}
          badges={{ social: socialState.hasUnreadMail || socialState.hasIncomingRequests || companionState.companions.crates > 0, shop: companionState.companions.crates > 0 }}
        />
      )}
      {dust2Me ? (
        <DefusalLoadout
          me={dust2Me}
          touch={touchMode}
          onSelect={(slot) => gameRef.current?.switchDefusalSlot(slot)}
        />
      ) : touchMode ? null : (
        <Hotbar
          slots={displayHotbarSlots}
          onSlotClick={handleSlotClick}
          onOpenTools={() => openWheel("tools")}
          onOpenEmotes={() => openWheel("emotes")}
          onOpenDegen={() => openWheel("degen")}
        />
      )}
      <Notifications notifications={notifications.notifications} onRemove={notifications.removeNotification} />
      <NpcDialogueModal
        dialogue={npcDialogue.dialogue}
        onFinish={npcDialogue.finish}
        onSkip={npcDialogue.finish}
      />
      {buildArmed && (
        <div className="absolute bottom-36 sm:bottom-28 left-1/2 -translate-x-1/2 z-40 pointer-events-none font-oxanium">
          <div className="rounded-full bg-[rgba(10,13,18,0.82)] backdrop-blur-md ring-1 ring-[#4FD1FF]/30 px-4 py-2 text-[11px] font-bold tracking-wide text-[#4FD1FF] whitespace-nowrap">
            {touchMode ? t("g.build.hintTouch") : t("g.build.hintDesktop")}
          </div>
        </div>
      )}
      <TouchLandscapeGate active={touchMode && rotated && !authError} onEnterImmersion={enterImmersion} />
      <TouchOnboarding active={touchMode && !loading && !authError} />
      <TouchControls
        input={inputManager}
        mode={defusalMatch || grinderMatch ? "combat" : "world"}
        rotated={rotated}
        canBuy={grinderMatch ? grinderMatch.phase === "live" : defusalMatch?.phase === "freeze" || defusalMatch?.phase === "warmup"}
        showSlots={!dust2Me}
        visible={touchMode && !loading && !chatExpanded && activeTopWindow === null && wheelMode === null && !inventory.isInventoryOpen && !isBuyMenuOpen && tradeSession === null && npcDialogue.dialogue === null}
        onOpenWheel={() => openWheel("touch")}
      />
      <RadialWheel
        isOpen={wheelMode !== null}
        pages={
          wheelMode === "touch"
            ? touchWheelPages
            : wheelMode === "tools"
              ? toolWheelPages
              : wheelMode === "degen"
                ? degenWheelPages
                : emoteWheelPages
        }
        onClose={() => closeWheel()}
        onSelect={handleWheelSelect}
      />
      {!defusalMatch && !grinderMatch && <AbilityBar
        progression={progressionState.progression}
        cooldowns={abilityState.cooldowns}
        energy={abilityState.energy}
        shield={abilityState.shield}
        onSlotClick={() => {
          setIsSkillTreeOpen(true);
          document.exitPointerLock();
        }}
      />}
      <Inventory
        items={inventory.inventory}
        ash={inventory.ash}
        isOpen={inventory.isInventoryOpen}
        onClose={() => inventory.setIsInventoryOpen(false)}
        placeables={inventory.placeables}
        homeTeleport={homeTeleport}
        onTeleportHome={() => gameRef.current?.teleportHome()}
      />

      <StorageWindow
        isOpen={storage.key !== null}
        slots={storage.slots}
        entries={storage.entries}
        inventory={inventory.inventory}
        onClose={() => setStorage((prev) => ({ ...prev, key: null }))}
        onDeposit={(address, quantity) => storage.key && gameRef.current?.depositToStorage(storage.key, address, quantity)}
        onWithdraw={(address, quantity) => storage.key && gameRef.current?.withdrawFromStorage(storage.key, address, quantity)}
      />

      <DamageIndicator
        attackerId={hud.damageIndicator.attackerId}
        direction={hud.damageIndicator.direction}
      />

      <DeathScreen
        isVisible={hud.isDead}
        killerName={hud.killerName}
        options={hud.respawnOptions}
        loot={hud.deathLoot}
        onRespawn={(target) => gameRef.current?.requestRespawn(target)}
      />

      <Chat
        messages={chat.chatMessages}
        factionMessages={chat.factionMessages}
        myFactions={factionState.myFactions}
        dmThreads={pm.threads}
        dmFocus={pm.focusWallet}
        myWallet={gameRef.current?.session.wallet ?? ""}
        onSendMessage={handleSendMessage}
        onSendFactionMessage={(factionId, message) => gameRef.current?.sendFactionChatMessage(factionId, message)}
        onSendPrivateMessage={(wallet, message) => gameRef.current?.sendPrivateMessage(wallet, message)}
        onCloseDmThread={(wallet) => pm.closeThread(wallet)}
        isVisible={chat.isChatVisible}
        onExpandedChange={setChatExpanded}
        getNicknameMenuActions={getNicknameMenuActions}
      />

      <AlaricPanel
        isOpen={isCreateFactionModalOpen}
        onClose={() => setIsCreateFactionModalOpen(false)}
        myFactions={factionState.myFactions}
        skipIntro={factionPanelSkipIntro}
        gameSlug={slug}
        onCreated={() => gameRef.current?.requestMyFactions()}
      />

      <FactionsWindow
        influence={influenceState}
        isOpen={activeTopWindow === "factions"}
        onClose={() => setActiveTopWindow(null)}
        myWallet={gameRef.current?.session.wallet ?? ""}
        gameSlug={slug}
        ash={inventory.ash}
        myFactions={factionState.myFactions}
        selectedFactionId={factionState.selectedFactionId}
        setSelectedFactionId={factionState.setSelectedFactionId}
        viewedFaction={factionState.viewedFaction}
        searchResults={factionState.searchResults}
        browseResults={factionState.browseResults}
        factionLeaderboard={leaderboardState.factionLeaderboard}
        taskDefinitions={factionState.taskDefinitions}
        questManageData={factionQuestState.manageData}
        onRequestMyFactions={() => gameRef.current?.requestMyFactions()}
        onViewFaction={(factionId) => gameRef.current?.requestFactionInfo(factionId)}
        onSearchFactions={(ca, name) => gameRef.current?.searchFactions(ca, name)}
        onBrowseFactions={() => gameRef.current?.listFactions()}
        onRequestFactionLeaderboard={() => gameRef.current?.requestFactionLeaderboard()}
        onJoinFaction={(factionId) => gameRef.current?.joinFaction(factionId)}
        onLeaveFaction={(factionId) => gameRef.current?.leaveFaction(factionId)}
        onSetDisplayedFaction={(factionId) => gameRef.current?.setDisplayedFaction(factionId)}
        onRequestTaskList={() => gameRef.current?.requestFactionTaskList()}
        onAcceptTask={(factionId, taskKey) => gameRef.current?.acceptFactionTask(factionId, taskKey)}
        onClaimCreator={(factionId) => gameRef.current?.claimFactionCreator(factionId)}
        onRequestQuestManageList={(factionId) => gameRef.current?.requestFactionQuestManageList(factionId)}
        onCreateQuest={(factionId, targetUrl, slotsTotal, rewardAsh) =>
          gameRef.current?.createFactionQuest(factionId, targetUrl, slotsTotal, rewardAsh)
        }
        getNicknameMenuActions={getNicknameMenuActions}
      />

      <QuestsWindow
        isOpen={activeTopWindow === "quests"}
        onClose={() => setActiveTopWindow(null)}
        quests={factionQuestState.questBoard}
        ash={inventory.ash}
        onRequestQuests={() => gameRef.current?.requestFactionQuestList()}
        onClaimQuest={(questId) => gameRef.current?.claimFactionQuest(questId)}
      />

      <FactionInvitePicker
        target={factionInviteTarget}
        myFactions={factionState.myFactions}
        onClose={() => setFactionInviteTarget(null)}
        onInvite={(factionId) => {
          if (factionInviteTarget) gameRef.current?.inviteToFaction(factionInviteTarget.wallet, factionId);
        }}
      />

      <TradeInvitePopup
        invite={pendingTradeInvite}
        onRespond={(accept) => {
          if (pendingTradeInvite) gameRef.current?.respondToTradeInvite(pendingTradeInvite.tradeId, accept);
          setPendingTradeInvite(null);
        }}
      />

      <DefusalHUD match={defusalMatch} localPlayerId={localPlayerId} />
      <GrinderHUD match={grinderMatch} localPlayerId={localPlayerId} />
      <Minimap
        gameRef={gameRef}
        active={inDust2Match}
        objective={
          defusalMatch?.bomb?.state === "planted" ? ((defusalMatch.bomb.site as "A" | "B" | null) ?? null) : null
        }
      />
      <KillFeed entries={killFeed} />
      <ScopeOverlay active={scopeStep > 0} zoomStep={scopeStep} />
      <FlashOverlay until={flashUntil} />

      <BuyMenu
        mode={grinderMatch ? "grinder" : "defusal"}
        open={isBuyMenuOpen && (grinderMatch !== null || defusalMatch !== null)}
        me={dust2Me}
        side={defusalMe?.side ?? "ct"}
        money={defusalMe?.money ?? 0}
        closesAt={grinderMatch ? null : defusalMatch?.phaseUntil ?? null}
        onBuy={(itemId) => gameRef.current?.buyDefusalItem(itemId)}
        onClose={() => setIsBuyMenuOpen(false)}
        onLeave={() => {
          setIsBuyMenuOpen(false);
          gameRef.current?.leaveEventRoom();
        }}
      />

      <EventDoorPanel
        eventId={openEventDoorId}
        gameSlug={slug}
        localWallet={gameRef.current?.session.wallet ?? null}
        partySize={partyState.party.members.length || 1}
        queue={defusalQueue}
        inQueue={inDefusalQueue}
        onClose={() => setOpenEventDoorId(null)}
        onEnter={(eventId) => {
          setOpenEventDoorId(null);
          gameRef.current?.enterEventRoom(eventId);
        }}
        onJoinQueue={() => { setInDefusalQueue(true); gameRef.current?.joinDefusalQueue(); }}
        onLeaveQueue={() => { setInDefusalQueue(false); gameRef.current?.leaveDefusalQueue(); }}
        onEnterGrinder={() => {
          setOpenEventDoorId(null);
          gameRef.current?.enterGrinder();
        }}
      />

      <ArenaPanel
        isOpen={isArenaPanelOpen}
        onClose={() => { setIsArenaPanelOpen(false); arenaState.dismissSummary(); }}
        arena={arenaState.arena}
        party={partyState.party}
        bestWave={arenaBestWave}
        cooldownUntil={arenaState.cooldownUntil}
        summary={arenaState.summary}
        onStart={() => { gameRef.current?.startArenaRun(); setIsArenaPanelOpen(false); }}
        onJoin={() => { gameRef.current?.joinArenaRun(); setIsArenaPanelOpen(false); }}
        onLeave={() => { gameRef.current?.leaveArenaRun(); setIsArenaPanelOpen(false); }}
        onDismissSummary={() => { arenaState.dismissSummary(); setIsArenaPanelOpen(false); }}
      />

      <PartyInvitePopup
        invite={partyState.partyInvite}
        onRespond={(accept) => {
          const invite = partyState.partyInvite;
          partyState.dismissInvite();
          if (invite) gameRef.current?.respondToPartyInvite(invite.fromId, accept);
        }}
      />

      <TradeWindow
        session={tradeSession}
        myUserId={gameRef.current?.session.userId ?? ""}
        placeables={inventory.placeables}
        companions={companionState.companions}
        onSetOffer={(tradeId, itemId, priceTnj) => gameRef.current?.setTradeOffer(tradeId, itemId, priceTnj)}
        onSetReady={(tradeId, ready) => gameRef.current?.setTradeReady(tradeId, ready)}
        onSubmitPayment={(tradeId, signature) => gameRef.current?.submitTradePayment(tradeId, signature)}
        onCancel={(tradeId) => gameRef.current?.cancelTrade(tradeId)}
        onDismiss={() => setTradeSession(null)}
      />

      <SocialWindow
        isOpen={activeTopWindow === "social"}
        onClose={() => setActiveTopWindow(null)}
        initialTab={socialInitialTab}
        nickname={chat.nickname}
        wallet={gameRef.current?.session.wallet ?? ""}
        selfProfile={profileState.selfProfile}
        onRequestSelfProfile={() => {
          const wallet = gameRef.current?.session.wallet;
          if (wallet) gameRef.current?.requestPlayerProfile(wallet);
        }}
        onNicknameChange={handleNicknameChange}
        quest={quest.questInfo}
        friends={socialState.friends}
        incomingRequests={socialState.incomingRequests}
        outgoingRequests={socialState.outgoingRequests}
        friendSearchResults={socialState.friendSearchResults}
        onRequestFriendsList={() => gameRef.current?.requestFriendsList()}
        onSearchFriends={(query) => gameRef.current?.searchFriends(query)}
        onSendFriendRequest={(target) => gameRef.current?.sendFriendRequest(target)}
        onAcceptFriendRequest={(requestUserId) => gameRef.current?.acceptFriendRequest(requestUserId)}
        onDeclineFriendRequest={(requestUserId) => gameRef.current?.declineFriendRequest(requestUserId)}
        onRemoveFriend={(friendUserId) => gameRef.current?.removeFriend(friendUserId)}
        onViewProfile={handleNicknameClick}
        mail={socialState.mail}
        unreadMailCount={socialState.unreadMailCount}
        onRequestMailInbox={() => gameRef.current?.requestMailInbox()}
        onSendMail={(recipient, subject, body) => gameRef.current?.sendMail(recipient, subject, body)}
        onMarkMailRead={(mailId) => gameRef.current?.markMailRead(mailId)}
        cosmetics={cosmeticState.cosmetics}
        onRequestCosmetics={() => gameRef.current?.requestCosmetics()}
        onEquipCosmetics={(skinId, accessoryId) => gameRef.current?.equipCosmetics(skinId, accessoryId)}
        companions={companionState.companions}
        onRequestCompanions={() => gameRef.current?.requestCompanions()}
        onEquipCompanion={(companionId) => gameRef.current?.equipCompanion(companionId)}
        onDustCompanion={(itemId) => gameRef.current?.dustCompanion(itemId)}
        onCombineFragments={() => gameRef.current?.combineFragments()}
        onOpenCrate={handleOpenCrate}
        blocked={socialState.blocked}
        onRequestBlockedList={() => gameRef.current?.requestBlockedList()}
        onUnblockUser={(blockedUserId) => gameRef.current?.unblockPlayer(blockedUserId)}
        getNicknameMenuActions={getNicknameMenuActions}
        party={partyState.party}
        localPlayerId={localPlayerId}
        onPartyLeave={() => gameRef.current?.leaveParty()}
        onPartyKick={(memberId) => gameRef.current?.kickFromParty(memberId)}
      />

      <ShopWindow
        isOpen={activeTopWindow === "shop"}
        gameSlug={slug}
        placeables={inventory.placeables}
        companions={companionState.companions}
        cosmeticCrates={cosmeticCrateState.wallet}
        onRequestCompanions={() => gameRef.current?.requestCompanions()}
        onRequestCosmeticCrates={() => gameRef.current?.requestCosmeticCrates()}
        onOpenCrate={handleOpenCrate}
        onOpenCosmeticCrate={() => gameRef.current?.openCosmeticCrate()}
        onClose={() => setActiveTopWindow(null)}
      />

      <CrateOpening
        isOpen={isCrateOpeningVisible}
        result={companionState.lastDrop}
        cratesLeft={companionState.companions.crates}
        onOpenAnother={handleOpenCrate}
        onClose={() => {
          setIsCrateOpeningVisible(false);
          companionState.clearDrop();
        }}
      />

      <SignEditorModal
        isOpen={signEditorId !== null}
        onClose={() => setSignEditorId(null)}
        signId={signEditorId}
        onSubmitText={handleSignSaveText}
        onSubmitDraw={handleSignSaveDrawing}
        onNotification={notifications.addNotification}
      />

      <SignViewerModal
        isOpen={viewingSign !== null}
        onClose={() => setViewingSign(null)}
        sign={viewingSign}
      />

      <PlaceableMenu
        isOpen={isPlaceableMenuOpen}
        onClose={() => setIsPlaceableMenuOpen(false)}
        placeables={inventory.placeables}
        onSelect={(itemId) => gameRef.current?.armPlaceable(itemId)}
        isInOwnFactionRoom={isInOwnFactionRoom}
      />

      <LeaderboardsWindow
        isOpen={activeTopWindow === "leaderboards"}
        onClose={() => setActiveTopWindow(null)}
        wallet={gameRef.current?.session.wallet ?? ""}
        myFactions={factionState.myFactions}
        playerLeaderboard={leaderboardState.playerLeaderboard}
        factionLeaderboard={leaderboardState.factionLeaderboard}
        viewedFaction={factionState.viewedFaction}
        onRequestPlayerLeaderboard={() => gameRef.current?.requestLeaderboard()}
        onRequestFactionLeaderboard={() => gameRef.current?.requestFactionLeaderboard()}
        onViewFaction={(factionId) => gameRef.current?.requestFactionInfo(factionId)}
        onViewProfile={handleNicknameClick}
        onJoinFaction={(factionId) => gameRef.current?.joinFaction(factionId)}
      />

      <SettingsWindow
        isOpen={activeTopWindow === "settings"}
        onClose={() => setActiveTopWindow(null)}
        onTeleportToSafeZone={() => gameRef.current?.teleportToSafeZone()}
        isInCombat={hud.isInCombat}
        stuckCooldownUntil={hud.stuckCooldownUntil}
        onOpenSupport={() => setIsSupportOpen(true)}
      />

      <SupportModal
        isOpen={isSupportOpen}
        onClose={() => { setIsSupportOpen(false); setSupportPrefillMessage(""); }}
        onSend={(subject, message) => gameRef.current?.sendSupportTicket(subject, message)}
        initialMessage={supportPrefillMessage}
      />

      <PlayerProfileCard
        isOpen={profileState.isProfileCardOpen}
        profile={profileState.viewedProfile}
        myWallet={gameRef.current?.session.wallet ?? ""}
        friends={socialState.friends}
        outgoingRequests={socialState.outgoingRequests}
        onClose={profileState.closeProfileCard}
        onSendFriendRequest={(target) => gameRef.current?.sendFriendRequest(target)}
      />

      <FloorSelector
        isOpen={showFloorSelector}
        onClose={() => {
          setShowFloorSelector(false);
          gameRef.current?.closeFloorSelector();
        }}
        onSelectFloor={handleSelectFloor}
        currentLocationId={currentLocationId}
      />

      <EventsFactionPicker
        isOpen={isEventsPickerOpen}
        onClose={() => setIsEventsPickerOpen(false)}
        myFactions={factionState.myFactions}
        onConfirm={handleEnterEvents}
      />

      {inventory.activeTokenData && (
        <TokenPanel
          ca={inventory.activeTokenData.ca}
          onClose={() => inventory.setActiveTokenData(null)}
        />
      )}

      <VendorPanel
        isOpen={isVendorOpen}
        inventory={inventory.inventory}
        lastSellResult={lastSellResult}
        gameSlug={slug}
        ash={inventory.ash}
        placeables={inventory.placeables}
        onClose={() => setIsVendorOpen(false)}
        onSell={(address, quantity) => gameRef.current?.sellToken(address, quantity)}
        onBuyItem={(itemId, quantity) => gameRef.current?.buyShopItem(itemId, quantity)}
      />

      <SolaPanel
        isOpen={isSolaOpen}
        quest={quest.questInfo}
        onClose={() => setIsSolaOpen(false)}
        onAccept={(questId) => gameRef.current?.acceptQuest(questId)}
        onTurnIn={(questId) => gameRef.current?.turnInQuest(questId)}
        onRequestTokenInfo={(ca) => gameRef.current?.requestTokenInfo(ca)}
        progression={progressionState.progression}
        ash={inventory.ash}
        onRespec={() => gameRef.current?.respecSkills()}
      />

      <SpecializationModal
        isOpen={isSpecializationOpen}
        onClose={() => setIsSpecializationOpen(false)}
        onSelect={(branch) => gameRef.current?.selectBranch(branch)}
      />

      <AlfredoPanel
        isOpen={isAlfredoOpen}
        onClose={() => setIsAlfredoOpen(false)}
        onOpenPersonalization={() => {
          setIsAlfredoOpen(false);
          setIsPersonalizationOpen(true);
        }}
        gameSlug={slug}
        ash={inventory.ash}
        cosmetics={cosmeticState.cosmetics}
        onRequestCosmetics={() => gameRef.current?.requestCosmetics()}
        onBuyCosmetic={(itemId: CosmeticId) => gameRef.current?.buyCosmetic(itemId)}
        crateWallet={cosmeticCrateState.wallet}
        onRequestCrates={() => gameRef.current?.requestCosmeticCrates()}
        onCombineFragments={() => gameRef.current?.combineCosmeticFragments()}
        onOpenCrate={() => gameRef.current?.openCosmeticCrate()}
      />

      <GateStewardPanel
        isOpen={isGateStewardOpen}
        onClose={() => setIsGateStewardOpen(false)}
        onPurchased={(faction: GateFactionResult) => gameRef.current?.notifyGatePurchased(faction)}
        onTeleport={(faction: GateFactionResult) => gameRef.current?.teleportToFactionGate(faction)}
        myFactions={factionState.myFactions}
        gateFactionIds={gateFactionIds}
        onEnterPersonalRoom={() => gameRef.current?.teleportToPersonalRoom()}
      />

      <BubbleInfoPanel
        bubbleIndex={bubbleIndex}
        onClose={() => setBubbleIndex(null)}
        onEnterRoom={(ownerUserId) => gameRef.current?.teleportToPersonalRoom(ownerUserId)}
        onSetWaypoint={(index) => {
          setBubbleWaypoint(index);
          gameRef.current?.setBubbleWaypoint(index);
        }}
      />

      <FactionBubblePanel
        faction={factionGates.find((g) => g.factionId === factionBubbleId) ?? null}
        isMember={factionBubbleId !== null && factionState.myFactions.some((f) => f.id === factionBubbleId)}
        onClose={() => setFactionBubbleId(null)}
        onEnter={(factionId) => {
          const faction = factionState.myFactions.find((f) => f.id === factionId);
          const gate = factionGates.find((g) => g.factionId === factionId);
          gameRef.current?.teleportToFactionGate({
            id: factionId,
            name: faction?.name ?? gate?.factionName ?? "Faction",
            symbol: faction?.symbol ?? gate?.symbol ?? null,
            image: faction?.image ?? gate?.image ?? null,
          });
        }}
      />

      <RoomConsolePanel
        isOpen={isRoomConsoleOpen}
        factionId={roomConsoleFactionId}
        canBuild={buildEditorState?.canEdit ?? false}
        onClose={() => setIsRoomConsoleOpen(false)}
        onNotification={(msg, duration) => notifications.addNotification(msg, duration)}
        onOpenBuildEditor={() => gameRef.current?.openBuildEditor()}
      />

      {buildEditorState && (
        <BuildEditorPanel
          state={buildEditorState}
          onSelectType={(typeId) => gameRef.current?.buildSession.selectType(typeId)}
          onSetTool={(tool) => gameRef.current?.buildSession.setTool(tool)}
          onRotate={() => gameRef.current?.buildSession.rotate()}
          onSetLevel={(level) => gameRef.current?.buildSession.setLevel(level)}
          onSetEnvironment={(sky, light) => gameRef.current?.buildSession.setEnvironment(sky, light)}
          onDeleteSelection={() => gameRef.current?.buildSession.deleteSelection()}
          onMoveSelection={() => gameRef.current?.buildSession.moveSelection()}
          onRotateSelection={() => gameRef.current?.buildSession.rotateSelection()}
          onPaintSelection={() => {
            gameRef.current?.buildSession.setInputSuspended(true);
            setPaintTarget(null);
            setIsPosterPaintOpen(true);
          }}
          onCancelCarry={() => gameRef.current?.buildSession.cancelCarry()}
          onClearLot={() => gameRef.current?.buildSession.clearLot()}
          onSave={() => { void gameRef.current?.buildSession.save(); }}
          onExit={() => gameRef.current?.closeBuildEditor()}
        />
      )}

      <PosterPaintModal
        isOpen={isPosterPaintOpen && (paintTarget !== null || (buildEditorState?.canPaint ?? false))}
        aspect={paintTarget?.aspect ?? buildEditorState?.paintAspect ?? null}
        sourceUrl={paintTarget?.url ?? buildEditorState?.paintUrl ?? null}
        onClose={() => {
          gameRef.current?.buildSession.setInputSuspended(false);
          setIsPosterPaintOpen(false);
          setPaintTarget(null);
        }}
        onSubmit={async (image) => {
          const session = gameRef.current?.buildSession;
          if (!session) throw new Error("The editor is closed");
          if (paintTarget) await session.paintPiece(paintTarget.key, image);
          else await session.paintSelection(image);
        }}
        onNotification={notifications.addNotification}
      />

      <InfluenceGatePanel
        data={influenceGate}
        onClose={() => setInfluenceGate(null)}
        onEnter={(tx) => gameRef.current?.networkManager.enterInfluence(tx)}
      />

      <InfluenceCrystalPanel
        data={influenceCrystal}
        onClose={() => setInfluenceCrystal(null)}
        onCapture={() => gameRef.current?.networkManager.startInfluenceCapture()}
        onSetFee={(currency, amount) => gameRef.current?.networkManager.setInfluenceFee(currency, amount)}
      />

      <InfluenceHud
        locationId={currentLocationId}
        state={influenceState}
        capture={influenceCapture}
      />

      <RoomPortalPanel
        isOpen={isRoomPortalOpen}
        onClose={() => setIsRoomPortalOpen(false)}
        onGoToOwnBubble={() => gameRef.current?.returnToGalaxy(true)}
        onGoToKeeper={() => gameRef.current?.returnToGalaxy(false)}
        onGoToMainHall={() => gameRef.current?.changeLocation("tower-main-hall")}
      />

      <BubbleMapPanel
        isOpen={isBubbleMapOpen}
        onClose={() => setIsBubbleMapOpen(false)}
        accountCount={accountCount}
        ownBubbleIndex={ownBubbleIndex}
        waypointIndex={bubbleWaypoint}
        factions={factionGates}
        myFactionIds={factionState.myFactions.map((f) => f.id)}
        getPlayerPosition={() => gameRef.current?.getPlayerGroundPosition() ?? null}
        onSetWaypoint={(index) => {
          setBubbleWaypoint(index);
          gameRef.current?.setBubbleWaypoint(index);
        }}
      />

      <PersonalizationEditor
        isOpen={isPersonalizationOpen}
        onClose={() => setIsPersonalizationOpen(false)}
        currentSkinUrl={mySkinUrl}
        onSave={handleSaveSkin}
        onNotification={(msg, duration) => notifications.addNotification(msg, duration)}
      />

      <CanyonMapPanel
        isOpen={canyonMap.isCanyonMapOpen}
        data={canyonMap.canyonMapData}
        onClose={() => canyonMap.setIsCanyonMapOpen(false)}
        onWarp={(segment) => {
          gameRef.current?.warpCanyonSegment(segment);
          canyonMap.setIsCanyonMapOpen(false);
        }}
      />

      <TournamentPanel
        isOpen={tournamentState.isTournamentBoardOpen}
        tournaments={tournamentState.tournaments}
        entriesById={tournamentState.entriesById}
        onClose={() => tournamentState.setIsTournamentBoardOpen(false)}
        onRefresh={() => gameRef.current?.requestTournamentList()}
        onRequestEntries={(tournamentId) => gameRef.current?.requestTournamentEntries(tournamentId)}
        onAction={(payload) => gameRef.current?.sendTournamentAction(payload)}
        onCaptureBuildShot={handleCaptureBuildShot}
        onVisitRoom={(ownerUserId) => {
          tournamentState.setIsTournamentBoardOpen(false);
          gameRef.current?.teleportToPersonalRoom(ownerUserId);
        }}
      />

      <BuildShotPrompt
        tournamentTitle={pendingBuildTournament?.title ?? null}
        onCapture={() => handleCaptureBuildShot(pendingBuildTournament!.id)}
        onCancel={() => tournamentState.setPendingBuildShot(null)}
      />
    </div>
  );
}
