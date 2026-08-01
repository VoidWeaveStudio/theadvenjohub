// src/features/game/core/GameNetworkHandlers.ts
import * as THREE from "three";
import type { Game, GameSession } from "./Game";
import { PlayerNetData } from "../network/NetworkManager";
import { OtherPlayer } from "../entities/OtherPlayer";
import { FirstFloor } from "../world/locations/tower/floors/first-floor/FirstFloor";
import { apiPost } from "@/core/api/client";
import { SoundManager } from "./SoundManager";

interface PlayerLeaveLocationData {
    playerId: string;
    fromLocation: string;
    toLocation: string;
}

interface AuthData {
    playerId: string;
    nickname: string;
    skinTextureUrl?: string | null;
}

interface PlayerJoinData {
    id: string;
    nickname: string;
    factionSymbol?: string | null;
    factionImage?: string | null;
    locationId?: string;
    position?: number[];
    rotation?: number;
    isAdmin?: boolean;
    isFactionCreator?: boolean;
    skinTextureUrl?: string | null;
}

interface PlayerUpdateData {
    id: string;
    position: number[];
    rotation: number;
    pitch: number;
    state: string;
}

interface ShootData {
    id: string;
    origin: number[];
    direction: number[];
}

interface ChatData {
    id: string;
    sender: string;
    senderWallet?: string;
    senderFactionSymbol?: string | null;
    senderFactionImage?: string | null;
    senderIsAdmin?: boolean;
    senderIsFactionCreator?: boolean;
    message: string;
    timestamp: number;
}

interface ProgressData {
    progress?: {
        locationId?: string;
        position: number[];
        rotation?: number;
    };
    nickname?: string;
}

interface DamageData {
    targetId: string;
    damage: number;
    attackerId: string;
}

interface DeathData {
    playerId: string;
    killerId: string;
}

interface PlayerRespawnData {
    id: string;
    health: number;
    position: number[];
}

interface LocalRespawnData {
    position: number[];
    health: number;
}

export function registerNetworkHandlers(game: Game) {
    game.networkManager.onPlayerLeaveLocation = (data: PlayerLeaveLocationData) => {
        const op = game.otherPlayers.get(data.playerId);
        if (!op) return;
        const currentLocation = game.locationManager.getCurrentLocation();
        if (!currentLocation) return;
        if (currentLocation.id === data.fromLocation) {
            currentLocation.scene.remove(op.mesh);
            currentLocation.scene.remove(op.getHitbox());
            game.shootingSystem.unregisterOtherPlayer(data.playerId);
            op.setHidden(true);
            game.onChatMessage?.({
                id: `system-${Date.now()}`, sender: "System",
                message: `${op.nickname} left the area`,
                timestamp: Date.now(), type: "system",
            });
        }
    };

    game.networkManager.onPlayerJoinLocation = (data: PlayerNetData) => {
        const currentLocation = game.locationManager.getCurrentLocation();
        if (!currentLocation) return;
        const locationId = data.locationId || 'main-world';
        if (currentLocation.id === locationId) {
            let op = game.otherPlayers.get(data.id);
            if (!op) {
                op = new OtherPlayer(data.id, data.nickname, data.factionSymbol ?? null, data.factionImage ?? null, data.isAdmin ?? false, data.isFactionCreator ?? false);
                op.create(currentLocation.scene, game.resourceManager);
                game.otherPlayers.set(data.id, op);
            } else {
                currentLocation.scene.add(op.mesh);
                currentLocation.scene.add(op.getHitbox());
                op.setHidden(false);
            }
            game.shootingSystem.registerOtherPlayer(data.id, op.getHitbox());
            op.updateFromNetwork(data);
            op.setBadges(data.isAdmin ?? false, data.isFactionCreator ?? false);
            op.setSkinTexture(data.skinTextureUrl ?? null);
            game.updateOnlineCount();
            game.onChatMessage?.({
                id: `system-${Date.now()}`, sender: "System",
                message: `${data.nickname} entered the area`,
                timestamp: Date.now(), type: "system",
            });
        }
    };

    game.networkManager.setSessionRefresher(async () => {
        try {
            const fresh = await apiPost<GameSession>("/api/game/session", { gameSlug: game.slug });
            game.session = fresh;
            return fresh;
        } catch {
            return null;
        }
    });

    game.networkManager.onSessionRevoked = () => {
        game.onNotification?.("⚠️ Connected from another tab/device", 5000);
    };

    game.networkManager.onDisconnected = () => {
        game.onNotification?.("⚠️ Connection lost, reconnecting...", 3000);
    };

    game.networkManager.onAuthError = (error) => {
        if (error === 'banned') {
            game.networkManager.disconnect();
            game.onAuthError?.(error);
        }
    };

    game.networkManager.onReconnectFailed = () => {
        game.onNotification?.("❌ Lost connection to game server", 5000);
    };

    game.networkManager.connect(game.session);

    game.networkManager.onAuthenticated = (data: AuthData) => {
        game.localPlayerNetId = data.playerId;
        game.onNicknameLoaded?.(data.nickname);
        game.player.applySkinTexture(data.skinTextureUrl ?? null);
        game.onMySkinChange?.(data.skinTextureUrl ?? null);


        game.requestMyFactions();
        game.requestMailInbox();
        game.requestFriendsList();

        game.restoreTimeoutId = setTimeout(() => {
            game.restoreTimeoutId = null;
            if (game.hasRestoredLocation) return;
            game.hasRestoredLocation = true;
            game.restoreResolver?.();
            game.restoreResolver = null;
        }, 800);
    };

    game.networkManager.onInit = (playerIds) => {
        const known = new Set(playerIds);
        const currentLocation = game.locationManager.getCurrentLocation();
        for (const [id, op] of Array.from(game.otherPlayers.entries())) {
            if (known.has(id)) continue;
            if (currentLocation) op.dispose(currentLocation.scene);
            game.otherPlayers.delete(id);
            game.shootingSystem.unregisterOtherPlayer(id);
        }
        game.updateOnlineCount();
    };

    game.networkManager.onPlayerJoin = (data: PlayerJoinData) => {
        if (data.id === game.localPlayerNetId) return;
        const currentLocation = game.locationManager.getCurrentLocation();
        if (!currentLocation) return;
        const playerLocation = data.locationId || 'main-world';
        if (playerLocation !== currentLocation.id) {
            if (!game.otherPlayers.has(data.id)) {
                const op = new OtherPlayer(data.id, data.nickname, data.factionSymbol ?? null, data.factionImage ?? null, data.isAdmin ?? false, data.isFactionCreator ?? false);
                op.setHidden(true);
                game.otherPlayers.set(data.id, op);
                game.updateOnlineCount();
            }
            return;
        }
        let op = game.otherPlayers.get(data.id);
        if (!op) {
            op = new OtherPlayer(data.id, data.nickname, data.factionSymbol ?? null, data.factionImage ?? null, data.isAdmin ?? false, data.isFactionCreator ?? false);
            op.create(currentLocation.scene, game.resourceManager);
            game.otherPlayers.set(data.id, op);
        } else if (op.isHidden()) {
            currentLocation.scene.add(op.mesh);
            currentLocation.scene.add(op.getHitbox());
            op.setHidden(false);
        }
        game.shootingSystem.registerOtherPlayer(data.id, op.getHitbox());
        op.updateFromNetwork(data);
        op.setBadges(data.isAdmin ?? false, data.isFactionCreator ?? false);
        op.setSkinTexture(data.skinTextureUrl ?? null);
        game.updateOnlineCount();
        game.onChatMessage?.({
            id: `system-${Date.now()}`, sender: "System",
            message: `${data.nickname} joined the game`,
            timestamp: Date.now(), type: "system",
        });
    };

    game.networkManager.onPlayerLeave = (playerId: string) => {
        const op = game.otherPlayers.get(playerId);
        if (op) {
            game.onChatMessage?.({
                id: `system-${Date.now()}`, sender: "System",
                message: `${op.nickname} left the game`,
                timestamp: Date.now(), type: "system",
            });
            const currentLocation = game.locationManager.getCurrentLocation();
            if (currentLocation) op.dispose(currentLocation.scene);
            game.otherPlayers.delete(playerId);
            game.shootingSystem.unregisterOtherPlayer(playerId);
            game.updateOnlineCount();
        }
    };

    game.networkManager.onPlayerUpdate = (data: PlayerUpdateData) => {
        const op = game.otherPlayers.get(data.id);
        if (!op || op.isHidden()) return;
        op.updateFromNetwork(data);
    };

    game.networkManager.onShoot = (data: ShootData) => {
        if (data.id === game.localPlayerNetId) return;
        game.shootingSystem.handleNetworkShoot({ origin: data.origin, direction: data.direction });
        SoundManager.getInstance().play('shoot', { volume: 0.5 });
    };

    game.networkManager.onCount = (count: number) => {
        game.hudState.online = count;
        game.emitState(true);
    };

    game.networkManager.onChatMessage = (data: ChatData) => {
        game.onChatMessage?.({
            id: data.id, sender: data.sender, senderWallet: data.senderWallet,
            senderFactionSymbol: data.senderFactionSymbol, senderFactionImage: data.senderFactionImage,
            senderIsAdmin: data.senderIsAdmin, senderIsFactionCreator: data.senderIsFactionCreator,
            message: data.message, timestamp: data.timestamp, type: "player",
        });
    };

    game.networkManager.onVoiceClip = (data) => {
        game.voiceChat.playIncoming(data.senderId, data.chunk, data.mimeType);
    };

    game.networkManager.onProgressLoaded = (data: ProgressData) => {
        if (data?.nickname) game.onNicknameLoaded?.(data.nickname);

        if (!game.hasRestoredLocation) {
            game.hasRestoredLocation = true;
            game.restoreToSavedProgress(data?.progress);
        }
    };

    game.networkManager.onPlayerDamaged = (data: DamageData) => {
        if (data.attackerId?.startsWith('canyon-')) {
            game.enemySystem.handleEnemyAttack(data.attackerId);
        }

        if (data.targetId === game.localPlayerNetId) {
            game.player.takeDamage(data.damage);
            game.hudState.health = game.player.health;
            game.emitState(true);
            SoundManager.getInstance().play('damage-taken');
            game.damageAttackerId = data.attackerId;
            game.lastDamageTime = Date.now();
            const attacker = game.otherPlayers.get(data.attackerId);
            const enemyAttacker = game.enemySystem.getEnemy(data.attackerId);
            let direction = 0;
            if (attacker && !attacker.isHidden()) {
                const playerPos = game.player.mesh.position;
                const attackerPos = attacker.mesh.position;
                direction = Math.atan2(attackerPos.x - playerPos.x, attackerPos.z - playerPos.z);
            } else if (enemyAttacker) {
                const playerPos = game.player.mesh.position;
                const attackerPos = enemyAttacker.mesh.position;
                direction = Math.atan2(attackerPos.x - playerPos.x, attackerPos.z - playerPos.z);
            } else {
                direction = game.cameraController.getYaw() + Math.PI;
            }
            game.onDamageEvent?.({
                id: Date.now() + Math.random(),
                direction, damage: data.damage, timestamp: Date.now(),
            });
        }
    };

    game.networkManager.onPlayerDeath = (data: DeathData) => {
        if (data.playerId === game.localPlayerNetId) {
            game.isDead = true;
            game.player.setDead(true);
            const killer = game.otherPlayers.get(data.killerId);
            game.killerName = killer?.nickname || (data.killerId.startsWith('canyon-') ? 'Enemy' : 'Unknown');
            game.onDeathStateChange?.(true, game.killerName);
        } else {
            const op = game.otherPlayers.get(data.playerId);
            if (op && !op.isHidden()) {
                op.setDead(true);
                game.onChatMessage?.({
                    id: `system-${Date.now()}`, sender: "System",
                    message: `${op.nickname} was eliminated`,
                    timestamp: Date.now(), type: "system",
                });
            }
        }
    };

    game.networkManager.onPlayerRespawn = (data: PlayerRespawnData) => {
        const op = game.otherPlayers.get(data.id);
        if (op && !op.isHidden()) {
            op.setDead(false);
            op.setHealth(data.health);
            op.updateFromNetwork({
                position: data.position, rotation: op.mesh.rotation.y,
                pitch: 0, state: 'idle', alive: true, health: data.health,
            });
            op.mesh.position.fromArray(data.position);
        }
    };

    game.networkManager.onRespawn = (data: LocalRespawnData) => {
        game.player.teleportTo(new THREE.Vector3().fromArray(data.position));
        game.player.setHealth(data.health);
        game.player.setDead(false);
        game.hudState.health = game.player.health;
        game.emitState(true);
        game.onNotification?.('✨ Respawned!', 2000);
        game.isDead = false;
        game.killerName = null;
        game.onDeathStateChange?.(false, null);
    };

    game.networkManager.onPositionCorrection = (data: { position: number[] }) => {
        game.player.teleportTo(new THREE.Vector3().fromArray(data.position));
    };

    game.networkManager.onDayNightSync = (data) => {
        game.dayNightConfig = data;
    };

    game.networkManager.onEnemyState = (list) => {
        game.enemySystem.handleEnemyState(list);
    };

    game.networkManager.onEnemyDamaged = (data) => {
        game.enemySystem.handleEnemyDamaged(data);
    };

    game.networkManager.onEnemyDeath = (data) => {
        game.enemySystem.handleEnemyDeath(data);
    };

    game.networkManager.onEnemyRespawn = (data) => {
        game.enemySystem.handleEnemyRespawn(data);
    };

    game.networkManager.onLootState = (list) => {
        game.lootSystem.handleLootState(list);
    };

    game.networkManager.onLootSpawn = (data) => {
        game.lootSystem.handleLootSpawn(data);
    };

    game.networkManager.onLootDespawn = (id) => {
        game.lootSystem.handleLootDespawn(id);
    };

    game.networkManager.onInventoryUpdate = ({ inventory, ash }) => {
        game.inventory = inventory;
        game.ash = ash;
        game.onInventoryChange?.(inventory, ash);
    };

    game.networkManager.onSellResult = (data) => {
        game.onSellResult?.(data);
        game.onNotification?.(`💨 Sold ${data.quantitySold}x for ${data.ashEarned} ash`, 2500);
    };

    game.networkManager.onServerError = (message) => {
        game.onNotification?.(`⚠️ ${message}`, 2500);
    };

    game.networkManager.onNicknameChanged = (nickname) => {
        game.onNicknameLoaded?.(nickname);
    };

    game.networkManager.onOtherPlayerNicknameChange = (data) => {
        const op = game.otherPlayers.get(data.id);
        if (op) op.setNickname(data.nickname);
    };

    game.networkManager.onSkinUpdate = (data) => {
        if (data.playerId === game.localPlayerNetId) {
            game.player.applySkinTexture(data.url);
            game.onMySkinChange?.(data.url);
            return;
        }
        const op = game.otherPlayers.get(data.playerId);
        op?.setSkinTexture(data.url);
    };

    game.networkManager.onQuestInfo = (data) => {
        game.onQuestInfo?.(data);
    };

    game.networkManager.onQuestUpdate = (data) => {
        game.onQuestUpdate?.(data);
        if (data.status === "active" && data.progress === 0) {
            game.onNotification?.(`📜 Quest accepted: kill ${data.targetCount} slimes in Slime Valley`, 3000);
        } else if (data.status === "ready_to_turn_in") {
            game.onNotification?.("✨ Quest complete! Return to Sola for your reward", 3000);
        } else if (data.status === "completed") {
            game.onNotification?.(`🎉 Quest turned in: +${data.rewardAsh ?? 0} ash`, 3000);
        }
    };

    game.networkManager.onCanyonSegment = (data) => {
        const currentLoc = game.locationManager.getCurrentLocation();
        if (currentLoc instanceof FirstFloor) {
            currentLoc.applyFreshSegment(data);
            const spawnPoint = currentLoc.getSpawnPoint();
            game.player.teleportTo(spawnPoint);
            game.cameraController.yawObject.position.copy(spawnPoint);
            game.networkManager.sendPlayerUpdate({
                position: spawnPoint.toArray(),
                rotation: game.player.mesh.rotation.y,
                pitch: game.cameraController.getPitch(),
                state: 'idle', jumping: false, velocityY: 0,
                weaponEquipped: game.hudState.isWeaponEquipped, isShooting: false,
            });
        }
        game.onCanyonSegment?.(data);
        game.onNotification?.(`🗺️ ${data.name}`, 2500);
    };

    game.networkManager.onCanyonCleared = (data) => {
        const currentLoc = game.locationManager.getCurrentLocation();
        if (currentLoc instanceof FirstFloor) {
            currentLoc.applyBossDefeated(data);
        }
        game.onNotification?.("🎉 Boss defeated! The way forward has opened.", 3000);
    };

    game.networkManager.onCanyonMap = (data) => {
        game.onCanyonMap?.(data);
    };

    game.networkManager.onCanyonHub = (data) => {
        const currentLoc = game.locationManager.getCurrentLocation();
        if (currentLoc instanceof FirstFloor) {
            currentLoc.applyHub(data);
            const spawnPoint = currentLoc.getSpawnPoint();
            game.player.teleportTo(spawnPoint);
            game.cameraController.yawObject.position.copy(spawnPoint);
            game.networkManager.sendPlayerUpdate({
                position: spawnPoint.toArray(),
                rotation: game.player.mesh.rotation.y,
                pitch: game.cameraController.getPitch(),
                state: 'idle', jumping: false, velocityY: 0,
                weaponEquipped: game.hudState.isWeaponEquipped, isShooting: false,
            });
        }
    };

    game.networkManager.onFactionCreated = (faction) => {
        game.onFactionCreated?.(faction);
        game.onNotification?.(`🚩 Faction "${faction.name}" founded!`, 3000);
    };

    game.networkManager.onFactionJoined = (faction) => {
        game.onFactionJoined?.(faction);
        game.onNotification?.(`🚩 Joined faction "${faction.name}"`, 2500);
    };

    game.networkManager.onFactionLeft = (factionId) => {
        game.onFactionLeft?.(factionId);
        game.onNotification?.("🚩 Left faction", 2000);
    };

    game.networkManager.onFactionMyListResult = (factions) => {
        game.onFactionMyListResult?.(factions);
    };

    game.networkManager.onFactionDisplayedSet = (faction) => {
        game.onFactionDisplayedSet?.(faction);
    };

    game.networkManager.onFactionSearchResult = (results) => {
        game.onFactionSearchResult?.(results);
    };

    game.networkManager.onFactionListResult = (data) => {
        game.onFactionListResult?.(data);
    };

    game.networkManager.onFactionInfo = (faction) => {
        game.onFactionInfo?.(faction);
    };

    game.networkManager.onPlayerProfile = (profile) => {
        if (profile && profile.wallet === game.session.wallet) {
            game.onSelfProfile?.(profile);
        } else {
            game.onViewedProfile?.(profile);
        }
    };

    game.networkManager.onLeaderboardResult = (leaderboard) => {
        game.onLeaderboardResult?.(leaderboard);
    };

    game.networkManager.onFactionLeaderboardResult = (leaderboard) => {
        game.onFactionLeaderboardResult?.(leaderboard);
    };

    game.networkManager.onFactionTaskListResult = (tasks) => {
        game.onFactionTaskListResult?.(tasks);
    };

    game.networkManager.onFactionTaskAccepted = (faction) => {
        game.onFactionTaskAccepted?.(faction);
        game.onNotification?.("🎯 Faction task accepted", 2500);
    };

    game.networkManager.onFactionTaskCompleted = (data) => {
        game.onFactionTaskCompleted?.(data);
        game.onNotification?.(`🏆 "${data.label}" complete! ${data.rewardAsh} Ash sent to ${data.rewardNickname || "faction leadership"}`, 4000);
    };

    game.networkManager.onFactionCreatorClaimResult = (data) => {
        game.onFactionCreatorClaimResult?.(data);
        game.onNotification?.(data.isCreator ? "💎 Verified as token creator!" : "Wallet doesn't match the token creator", 3000);
    };

    game.networkManager.onFactionCreatorVerified = (faction) => {
        game.onFactionCreatorVerified?.(faction);
    };

    game.networkManager.onFriendRequestSent = (friend, status) => {
        game.onFriendRequestSent?.(friend, status);
    };

    game.networkManager.onFriendRequestAccepted = (friend) => {
        game.onFriendRequestAccepted?.(friend);
    };

    game.networkManager.onFriendRequestDeclined = (requestUserId) => {
        game.onFriendRequestDeclined?.(requestUserId);
    };

    game.networkManager.onFriendRemoved = (friendUserId) => {
        game.onFriendRemoved?.(friendUserId);
    };

    game.networkManager.onFriendsListResult = (data) => {
        game.onFriendsListResult?.(data);
    };

    game.networkManager.onFriendSearchResult = (results) => {
        game.onFriendSearchResult?.(results);
    };

    game.networkManager.onMailSent = (mailId) => {
        game.onMailSent?.(mailId);
    };

    game.networkManager.onMailInboxResult = (data) => {
        game.onMailInboxResult?.(data);
    };

    game.networkManager.onMailMarkedRead = (mailId) => {
        game.onMailMarkedRead?.(mailId);
    };

    game.networkManager.onMailReceived = (data) => {
        game.onMailReceived?.(data);
    };

    game.networkManager.onTokenInfoSent = () => {
        game.onNotification?.('📬 Token info sent to your mail', 2500);
    };

    game.networkManager.onSupportTicketSent = () => {
        game.onNotification?.('📨 Message sent to support — the reply will arrive in your mail', 3500);
    };

    game.networkManager.onAchievementsUnlocked = (achievements) => {
        achievements.forEach((a) => {
            game.onNotification?.(`🏆 Achievement unlocked: ${a.label}`, 3500);
        });
    };

    game.networkManager.onFriendRequestReceived = (friend) => {
        game.onFriendRequestReceived?.(friend);
    };

    game.networkManager.onWeaponForceUnequip = () => {
        game.setWeaponEquipped(false);
    };

    game.networkManager.onUserBlocked = (entry) => {
        game.onUserBlocked?.(entry);
    };

    game.networkManager.onUserUnblocked = (blockedUserId) => {
        game.onUserUnblocked?.(blockedUserId);
    };

    game.networkManager.onBlockedListResult = (blocked) => {
        game.onBlockedListResult?.(blocked);
    };

    game.networkManager.onPrivateMessage = (data) => {
        game.onPrivateMessage?.(data);
    };

    game.networkManager.onPrivateMessageSent = (data) => {
        game.onPrivateMessageSent?.(data);
    };

    game.networkManager.onPrivateMessageError = (data) => {
        game.onPrivateMessageError?.(data);
    };

    game.networkManager.onFactionChatMessage = (data) => {
        game.onFactionChatMessage?.({
            id: data.id, factionId: data.factionId, sender: data.sender, senderWallet: data.senderWallet,
            senderFactionSymbol: data.senderFactionSymbol, senderFactionImage: data.senderFactionImage,
            senderIsAdmin: data.senderIsAdmin, senderIsFactionCreator: data.senderIsFactionCreator,
            message: data.message, timestamp: data.timestamp, type: "player",
        });
    };

    game.networkManager.onFactionInviteSent = (toWallet) => {
        game.onFactionInviteSent?.(toWallet);
        game.onNotification?.('✉️ Faction invite sent', 2500);
    };
}
