// src/features/game/GameClient.tsx
"use client";

import { useEffect, useRef, useState } from "react";
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
import { FloorSelector } from "./ui/FloorSelector";
import { TokenPanel } from "./ui/TokenPanel";
import { Inventory } from "./ui/Inventory";
import { VendorPanel } from "./ui/VendorPanel";
import { SolaPanel } from "./ui/SolaPanel";
import { QuestTracker } from "./ui/QuestTracker";
import { CanyonMapPanel } from "./ui/CanyonMapPanel";
import { CreateFactionModal } from "./ui/CreateFactionModal";
import { FactionsWindow } from "./ui/FactionsWindow";
import { SocialWindow, SocialTab } from "./ui/SocialWindow";
import { ShopWindow } from "./ui/ShopWindow";
import { LeaderboardsWindow } from "./ui/LeaderboardsWindow";
import { SettingsWindow } from "./ui/SettingsWindow";
import { PlayerProfileCard } from "./ui/PlayerProfileCard";
import { useHudState } from "./ui/hooks/useHudState";
import { useQuestState, SOLA_QUEST_ID } from "./ui/hooks/useQuestState";
import { useInventoryState } from "./ui/hooks/useInventoryState";
import { useChatState } from "./ui/hooks/useChatState";
import { useNotifications } from "./ui/hooks/useNotifications";
import { useCanyonMapState } from "./ui/hooks/useCanyonMapState";
import { useFactionState } from "./ui/hooks/useFactionState";
import { useLeaderboardState } from "./ui/hooks/useLeaderboardState";
import { useProfileState } from "./ui/hooks/useProfileState";
import { useSocialState } from "./ui/hooks/useSocialState";

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

  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Initializing game...");
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [showFloorSelector, setShowFloorSelector] = useState(false);
  const [currentLocationId, setCurrentLocationId] = useState("tower-main-hall");

  const [isVendorOpen, setIsVendorOpen] = useState(false);
  const [isSolaOpen, setIsSolaOpen] = useState(false);
  const [isVoiceCapturing, setIsVoiceCapturing] = useState(false);

  const [activeTopWindow, setActiveTopWindow] = useState<TopWindowId | null>(null);
  const [isCreateFactionModalOpen, setIsCreateFactionModalOpen] = useState(false);
  const [socialInitialTab, setSocialInitialTab] = useState<SocialTab>("friends");

  const hud = useHudState();
  const quest = useQuestState();
  const inventory = useInventoryState();
  const chat = useChatState();
  const notifications = useNotifications();
  const canyonMap = useCanyonMapState();
  const factionState = useFactionState();
  const profileState = useProfileState();
  const leaderboardState = useLeaderboardState();
  const socialState = useSocialState();

  const [hotbarSlots, setHotbarSlots] = useState<HotbarSlot[]>([
    { id: "rifle", icon: "🔫", name: "Rifle", equipped: true },
    { id: "slot2", icon: "", name: "", equipped: false },
    { id: "slot3", icon: "", name: "", equipped: false },
    { id: "slot4", icon: "", name: "", equipped: false },
    { id: "slot5", icon: "", name: "", equipped: false },
  ]);

  const handleSlotClick = (index: number) => {
    setHotbarSlots((prev) => {
      const slot = prev[index];
      if (!slot.icon) return prev;

      if (slot.equipped) {
        const newSlots = prev.map((s) => ({ ...s, equipped: false }));
        gameRef.current?.setWeaponEquipped(false);
        return newSlots;
      }

      const newSlots = prev.map((s, i) => ({
        ...s,
        equipped: i === index,
      }));
      gameRef.current?.setWeaponEquipped(true);
      return newSlots;
    });
  };

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

        game.onStateChange = (state) => { if (!cancelled) hud.handleStateChange(state); };
        game.onLoadStateChange = (loading, message) => {
          if (cancelled) return;
          setLoading(loading);
          if (message) setLoadingMessage(message);
        };
        game.onNotification = (msg, duration = 3000) => {
          if (cancelled) return;
          notifications.addNotification(msg, duration);
        };
        game.onChatMessage = (message) => { if (!cancelled) chat.handleChatMessage(message); };
        game.onNicknameLoaded = (nick: string) => { if (!cancelled) chat.handleNicknameLoaded(nick); };
        game.onLocationChange = (id: string) => { if (!cancelled) setCurrentLocationId(id); };
        game.onFloorSelectorToggle = (isOpen: boolean) => {
          if (cancelled) return;
          setShowFloorSelector(isOpen);
          if (isOpen) document.exitPointerLock();
        };
        game.onInventoryChange = (inv, ashValue) => {
          if (cancelled) return;
          inventory.handleInventoryChange(inv, ashValue);
        };
        game.onOpenTokenUI = (tokenData) => {
          if (cancelled) return;
          inventory.handleOpenTokenUI(tokenData);
        };
        game.onOpenVendorUI = () => {
          if (cancelled) return;
          setIsVendorOpen(true);
          document.exitPointerLock();
        };
        game.onOpenSolaUI = () => {
          if (cancelled) return;
          quest.resetQuestInfo();
          setIsSolaOpen(true);
          gameRef.current?.talkToQuestGiver(SOLA_QUEST_ID);
          document.exitPointerLock();
        };
        game.onQuestInfo = (data) => { if (!cancelled) quest.handleQuestInfo(data); };
        game.onQuestUpdate = (data) => { if (!cancelled) quest.handleQuestUpdate(data); };
        game.onOpenCanyonMapUI = () => {
          if (cancelled) return;
          canyonMap.openWithReset();
          gameRef.current?.talkToDispatcher();
          document.exitPointerLock();
        };
        game.onCanyonMap = (data) => { if (!cancelled) canyonMap.handleCanyonMap(data); };
        game.onOpenFactionBrokerUI = () => {
          if (cancelled) return;
          setIsCreateFactionModalOpen(true);
          document.exitPointerLock();
        };
        game.onFactionCreated = (f) => { if (!cancelled) factionState.handleFactionCreated(f); };
        game.onFactionJoined = (f) => { if (!cancelled) factionState.handleFactionJoined(f); };
        game.onFactionLeft = () => { if (!cancelled) factionState.handleFactionLeft(); };
        game.onFactionSearchResult = (results) => { if (!cancelled) factionState.handleFactionSearchResult(results); };
        game.onFactionListResult = (data) => { if (!cancelled) factionState.handleFactionListResult(data); };
        game.onFactionInfo = (f) => { if (!cancelled) factionState.handleFactionInfo(f); };
        game.onFactionTaskListResult = (tasks) => { if (!cancelled) factionState.handleFactionTaskListResult(tasks); };
        game.onFactionTaskAccepted = (f) => { if (!cancelled) factionState.handleFactionTaskAccepted(f); };
        game.onFactionCreatorClaimResult = (data) => { if (!cancelled) factionState.handleFactionCreatorClaimResult(data); };
        game.onFactionCreatorVerified = (f) => { if (!cancelled) factionState.handleFactionCreatorVerified(f); };
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
        game.onDamageEvent = (event) => { if (!cancelled) hud.handleDamageEvent(event); };
        game.onDeathStateChange = (dead, killer) => { if (!cancelled) hud.handleDeathStateChange(dead, killer); };
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
        } else {
          setAuthError(error.message || "Failed to start game");
        }
        setLoading(false);
      }
    };

    initGame();

    return () => {
      cancelled = true;
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
        if (canyonMap.isCanyonMapOpen) {
          canyonMap.setIsCanyonMapOpen(false);
          return;
        }
        if (isCreateFactionModalOpen) {
          setIsCreateFactionModalOpen(false);
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

      if (isVendorOpen || isSolaOpen || canyonMap.isCanyonMapOpen || isCreateFactionModalOpen || activeTopWindow !== null) return;

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
        const digitKeys = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"];
        const index = digitKeys.indexOf(e.code);
        if (index !== -1) {
          handleSlotClick(index);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPointerLocked, showFloorSelector, inventory.activeTokenData, isVendorOpen, isSolaOpen, canyonMap.isCanyonMapOpen, inventory.isInventoryOpen, isCreateFactionModalOpen, activeTopWindow]);

  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "KeyG") gameRef.current?.stopVoiceCapture();
    };
    window.addEventListener("keyup", handleKeyUp);
    return () => window.removeEventListener("keyup", handleKeyUp);
  }, []);

  const handleNicknameChange = (nick: string) => {
    chat.setNickname(nick);
    gameRef.current?.setNickname(nick);
  };

  const handleSendMessage = (message: string) => {
    gameRef.current?.sendChatMessage(message);
  };

  const handleNicknameClick = (wallet: string) => {
    gameRef.current?.requestPlayerProfile(wallet);
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
    gameRef.current?.selectFloor(floorId);
  };

  if (authError) {
    const isAssetError = authError.includes("Failed to load game assets");
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="bg-zinc-900 border border-red-500/50 rounded-xl p-8 max-w-md text-center">
          <div className="text-6xl mb-4">{isAssetError ? "🌐" : "🔒"}</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {isAssetError ? "Connection Error" : "Access Denied"}
          </h2>
          <p className="text-zinc-400 mb-6">{authError}</p>
          <div className="flex gap-4 justify-center">
            {isAssetError && (
              <button
                onClick={() => window.location.reload()}
                className="btn-primary px-6 py-2"
              >
                Try Again
              </button>
            )}
            <button
              onClick={() => (window.location.href = "/")}
              className="btn-secondary px-6 py-2"
            >
              Back to Store
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed left-0 right-0 bottom-0 z-50 bg-black overflow-hidden"
      style={{
        top: '64px',
        height: 'calc(100vh - 64px)'
      }}
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
        </div>
      )}

      <HUD
        state={hud.hudState}
        isPointerLocked={isPointerLocked}
        isHitMark={hud.isHitMark}
        isTalking={isVoiceCapturing}
      />
      <TopMenu active={activeTopWindow} onSelect={handleTopMenuSelect} />
      <Hotbar
        slots={hotbarSlots}
        onSlotClick={handleSlotClick}
      />
      <Notifications notifications={notifications.notifications} onRemove={notifications.removeNotification} />
      <QuestTracker quest={quest.questTracker} />
      <Inventory
        items={inventory.inventory}
        ash={inventory.ash}
        isOpen={inventory.isInventoryOpen}
        onClose={() => inventory.setIsInventoryOpen(false)}
      />

      <DamageIndicator
        attackerId={hud.damageIndicator.attackerId}
        direction={hud.damageIndicator.direction}
      />

      <DeathScreen
        isVisible={hud.isDead}
        killerName={hud.killerName}
        respawnTime={3}
      />

      <Chat
        messages={chat.chatMessages}
        onSendMessage={handleSendMessage}
        isVisible={chat.isChatVisible}
        onNicknameClick={handleNicknameClick}
      />

      <CreateFactionModal
        isOpen={isCreateFactionModalOpen}
        onClose={() => setIsCreateFactionModalOpen(false)}
        onCreateFaction={(ca) => gameRef.current?.createFaction(ca)}
      />

      <FactionsWindow
        isOpen={activeTopWindow === "factions"}
        onClose={() => setActiveTopWindow(null)}
        myWallet={gameRef.current?.session.wallet ?? ""}
        myFaction={factionState.myFaction}
        viewedFaction={factionState.viewedFaction}
        searchResults={factionState.searchResults}
        browseResults={factionState.browseResults}
        factionLeaderboard={leaderboardState.factionLeaderboard}
        taskDefinitions={factionState.taskDefinitions}
        onRequestOwnFaction={() => gameRef.current?.requestFactionInfo()}
        onViewFaction={(factionId) => gameRef.current?.requestFactionInfo(factionId)}
        onSearchFactions={(ca, name) => gameRef.current?.searchFactions(ca, name)}
        onBrowseFactions={() => gameRef.current?.listFactions()}
        onRequestFactionLeaderboard={() => gameRef.current?.requestFactionLeaderboard()}
        onJoinFaction={(factionId) => gameRef.current?.joinFaction(factionId)}
        onLeaveFaction={() => gameRef.current?.leaveFaction()}
        onOpenCreateFaction={() => {
          setActiveTopWindow(null);
          setIsCreateFactionModalOpen(true);
        }}
        onRequestTaskList={() => gameRef.current?.requestFactionTaskList()}
        onAcceptTask={(taskKey) => gameRef.current?.acceptFactionTask(taskKey)}
        onClaimCreator={() => gameRef.current?.claimFactionCreator()}
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
      />

      <ShopWindow isOpen={activeTopWindow === "shop"} onClose={() => setActiveTopWindow(null)} />

      <LeaderboardsWindow
        isOpen={activeTopWindow === "leaderboards"}
        onClose={() => setActiveTopWindow(null)}
        wallet={gameRef.current?.session.wallet ?? ""}
        playerLeaderboard={leaderboardState.playerLeaderboard}
        factionLeaderboard={leaderboardState.factionLeaderboard}
        viewedFaction={factionState.viewedFaction}
        onRequestPlayerLeaderboard={() => gameRef.current?.requestLeaderboard()}
        onRequestFactionLeaderboard={() => gameRef.current?.requestFactionLeaderboard()}
        onViewFaction={(factionId) => gameRef.current?.requestFactionInfo(factionId)}
      />

      <SettingsWindow
        isOpen={activeTopWindow === "settings"}
        onClose={() => setActiveTopWindow(null)}
        onTeleportToSafeZone={() => gameRef.current?.teleportToSafeZone()}
      />

      <PlayerProfileCard
        isOpen={profileState.isProfileCardOpen}
        profile={profileState.viewedProfile}
        onClose={profileState.closeProfileCard}
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

      {inventory.activeTokenData && (
        <TokenPanel
          ca={inventory.activeTokenData.ca}
          onClose={() => inventory.setActiveTokenData(null)}
        />
      )}

      <VendorPanel
        isOpen={isVendorOpen}
        inventory={inventory.inventory}
        onClose={() => setIsVendorOpen(false)}
        onSell={(address, quantity) => gameRef.current?.sellToken(address, quantity)}
      />

      <SolaPanel
        isOpen={isSolaOpen}
        quest={quest.questInfo}
        onClose={() => setIsSolaOpen(false)}
        onAccept={(questId) => gameRef.current?.acceptQuest(questId)}
        onTurnIn={(questId) => gameRef.current?.turnInQuest(questId)}
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
    </div>
  );
}
