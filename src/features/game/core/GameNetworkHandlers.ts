// src/features/game/core/GameNetworkHandlers.ts
import * as THREE from "three";
import type { Game, GameSession } from "./Game";
import { PlayerNetData } from "../network/NetworkManager";
import { MEME_ABILITIES_BY_ID } from "../data/progression";
import { abilityById } from "../data/skills";
import { OtherPlayer } from "../entities/OtherPlayer";
import { FirstFloor } from "../world/locations/tower/floors/first-floor/FirstFloor";
import { Basement } from "../world/locations/tower/floors/basement/Basement";
import { MainHall } from "../world/locations/tower/floors/main-hall/MainHall";
import { Cave } from "../world/locations/cave/Cave";
import { apiPost } from "@/core/api/client";
import { SoundManager } from "./SoundManager";
import { DEFAULT_SPAWN_LOCATION_ID, applyPositionCorrection, beginTeleportGrace } from "./GameLocationOrchestration";
import { applyWorldStatus } from "./GameWorldState";
import { isBodyEmote } from "../data/emotes";

let systemMessageCounter = 0;
const systemMessageId = () => `system-${Date.now()}-${++systemMessageCounter}`;

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

interface PlayerUpdateData {
    id: string;
    position: number[];
    rotation: number;
    pitch: number;
    state: string;
}

function memeRadius(memeId: string): number {
    return Number(MEME_ABILITIES_BY_ID.get(memeId)?.params.radius ?? 0);
}

interface ShootData {
    id: string;
    origin: number[];
    direction: number[];
    directions?: number[][];
    weapon?: string;
    mode?: string;
    speed?: number;
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
    abilityId?: string | null;
}

const DOT_ABILITY_IDS = new Set(["burning", "bleeding"]);

function dotAbilityId(abilityId?: string | null): string | null {
    return abilityId && DOT_ABILITY_IDS.has(abilityId) ? abilityId : null;
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
    locationId?: string;
}

function reconcilePendingOtherPlayers(game: Game, locationId: string) {
    const currentLocation = game.locationManager.getCurrentLocation();
    if (!currentLocation) return;
    for (const op of game.otherPlayers.values()) {
        if (op.isCreated()) continue;
        const pending = op.getPendingJoinData();
        if (!pending) continue;
        const playerLocation = pending.locationId || 'main-world';
        if (playerLocation !== locationId) continue;

        op.create(currentLocation.scene, game.resourceManager);
        op.setHidden(false);
        game.shootingSystem.registerOtherPlayer(op.id, op.getHitbox());
        op.updateFromNetwork(pending);
        op.setBadges(pending.isAdmin ?? false, pending.isFactionCreator ?? false);
        op.setSkinTexture(pending.skinTextureUrl ?? null);
        op.applyCosmetics((pending.cosmeticSkinId ?? null) as any, (pending.cosmeticAccessoryId ?? null) as any);
    }
    game.updateOnlineCount();
}

export function registerNetworkHandlers(game: Game) {
    const previousOnLocationChange = game.locationManager.onLocationChange;
    game.locationManager.onLocationChange = (id: string) => {
        previousOnLocationChange?.(id);
        reconcilePendingOtherPlayers(game, id);
    };

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
                id: systemMessageId(), sender: "System",
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
            } else if (!op.isCreated()) {
            
                op.create(currentLocation.scene, game.resourceManager);
                op.setHidden(false);
            } else {
                currentLocation.scene.add(op.mesh);
                currentLocation.scene.add(op.getHitbox());
                op.setHidden(false);
            }
            game.shootingSystem.registerOtherPlayer(data.id, op.getHitbox());
            op.updateFromNetwork(data);
            op.setBadges(data.isAdmin ?? false, data.isFactionCreator ?? false);
            op.setSkinTexture(data.skinTextureUrl ?? null);
            op.applyCosmetics((data.cosmeticSkinId ?? null) as any, (data.cosmeticAccessoryId ?? null) as any);
            op.setWeaponLoadout(data.branch === "arcanist" ? "staff" : "rifle", data.weaponTier ?? 1);
            game.updateOnlineCount();
            game.onChatMessage?.({
                id: systemMessageId(), sender: "System",
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
        if (error === 'banned' || error === 'license_revoked') {
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
        game.voiceChat.setLocalId(data.playerId);
        game.onNicknameLoaded?.(data.nickname);
        game.player.applySkinTexture(data.skinTextureUrl ?? null);
        game.onMySkinChange?.(data.skinTextureUrl ?? null);

        game.requestMyFactions();
        game.requestMailInbox();
        game.requestFriendsList();
        game.notifyClientReadyIfLoaded();

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

    game.networkManager.onPlayerJoin = (data: PlayerNetData) => {
        if (data.id === game.localPlayerNetId) return;
        const currentLocation = game.locationManager.getCurrentLocation();
        if (!currentLocation) return;
        const playerLocation = data.locationId || 'main-world';
        if (playerLocation !== currentLocation.id) {
            let hiddenOp = game.otherPlayers.get(data.id);
            if (!hiddenOp) {
                hiddenOp = new OtherPlayer(data.id, data.nickname, data.factionSymbol ?? null, data.factionImage ?? null, data.isAdmin ?? false, data.isFactionCreator ?? false);
                hiddenOp.setHidden(true);
                game.otherPlayers.set(data.id, hiddenOp);
                game.updateOnlineCount();
            }
   
            if (!hiddenOp.isCreated()) {
                hiddenOp.setPendingJoinData(data);
            }
            return;
        }
        let op = game.otherPlayers.get(data.id);
        if (!op) {
            op = new OtherPlayer(data.id, data.nickname, data.factionSymbol ?? null, data.factionImage ?? null, data.isAdmin ?? false, data.isFactionCreator ?? false);
            op.create(currentLocation.scene, game.resourceManager);
            game.otherPlayers.set(data.id, op);
        } else if (!op.isCreated()) {
            op.create(currentLocation.scene, game.resourceManager);
            op.setHidden(false);
        } else if (op.isHidden()) {
            currentLocation.scene.add(op.mesh);
            currentLocation.scene.add(op.getHitbox());
            op.setHidden(false);
        }
        game.shootingSystem.registerOtherPlayer(data.id, op.getHitbox());
        op.updateFromNetwork(data);
        op.setBadges(data.isAdmin ?? false, data.isFactionCreator ?? false);
        op.setSkinTexture(data.skinTextureUrl ?? null);
        op.applyCosmetics((data.cosmeticSkinId ?? null) as any, (data.cosmeticAccessoryId ?? null) as any);
        game.updateOnlineCount();
        game.onChatMessage?.({
            id: systemMessageId(), sender: "System",
            message: `${data.nickname} joined the game`,
            timestamp: Date.now(), type: "system",
        });
    };

    game.networkManager.onPlayerLeave = (playerId: string) => {
        const op = game.otherPlayers.get(playerId);
        if (op) {
            game.onChatMessage?.({
                id: systemMessageId(), sender: "System",
                message: `${op.nickname} left the game`,
                timestamp: Date.now(), type: "system",
            });
            const currentLocation = game.locationManager.getCurrentLocation();
            if (currentLocation) op.dispose(currentLocation.scene);
            game.emoteSystem.stop(playerId);
            game.candleSystem.stop(playerId);
            game.otherPlayers.delete(playerId);
            game.shootingSystem.unregisterOtherPlayer(playerId);
            game.updateOnlineCount();
        }
    };

    game.networkManager.onSpawnProtection = ({ untilMs }) => {
        game.setSpawnProtection(untilMs);
    };

    game.networkManager.onCosmeticState = (data) => {
        game.player.applyCosmetics(data.skinId, data.accessoryId);
        game.onCosmeticState?.(data);
    };

    game.networkManager.onCosmeticUpdate = ({ playerId, skinId, accessoryId }) => {
        game.otherPlayers.get(playerId)?.applyCosmetics(skinId, accessoryId);
    };

    game.networkManager.onRemoteEmote = ({ playerId, key }) => {
        const op = game.otherPlayers.get(playerId);
        if (!op || op.isHidden()) return;
        if (isBodyEmote(key)) {
            game.startRemoteBodyEmote(playerId, op.mesh, (name) => op.playPose(name));
        } else {
            game.emoteSystem.play(playerId, key, op.mesh);
        }
    };

    game.networkManager.onPlayerUpdate = (data: PlayerUpdateData) => {
        const op = game.otherPlayers.get(data.id);
        if (!op || op.isHidden()) return;
        op.updateFromNetwork(data);
    };

    game.networkManager.onShoot = (data: ShootData) => {
        if (data.id === game.localPlayerNetId) return;
        game.shootingSystem.handleNetworkShoot({
            id: data.id,
            origin: data.origin,
            direction: data.direction,
            directions: data.directions,
            weapon: data.weapon,
            speed: data.speed,
        });
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

    game.networkManager.onVoiceOffer = (data) => {
        game.voiceChat.handleOffer(data.fromId, data.sdp);
    };
    game.networkManager.onVoiceAnswer = (data) => {
        game.voiceChat.handleAnswer(data.fromId, data.sdp);
    };
    game.networkManager.onVoiceIceCandidate = (data) => {
        game.voiceChat.handleIceCandidate(data.fromId, data.candidate);
    };

    game.networkManager.onProgressLoaded = (data: ProgressData) => {
        if (data?.nickname) game.onNicknameLoaded?.(data.nickname);

        if (!game.hasRestoredLocation) {
            game.hasRestoredLocation = true;
            game.restoreToSavedProgress();
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

            const dot = dotAbilityId(data.abilityId);
            if (dot) {
                game.abilitySystem.spawnEmber(game.player.mesh.position.toArray(), dot);
                return;
            }

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
                    id: systemMessageId(), sender: "System",
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
        const finishRespawn = () => {
            game.player.setHealth(data.health);
            game.player.setDead(false);
            game.player.clearSlow();
            game.hudState.health = game.player.health;
            game.emitState(true);
            game.onNotification?.('✨ Respawned!', 2000);
            game.isDead = false;
            game.killerName = null;
            game.onDeathStateChange?.(false, null);
        };

        const placeInHall = () => {
            const hall = game.locationManager.getCurrentLocation();
            if (!hall) return;
            const spawnPoint = hall.getSpawnPoint();
            game.player.teleportTo(spawnPoint);
            game.cameraController.resetVerticalSmoothing();
            game.cameraController.yawObject.position.copy(spawnPoint);
            beginTeleportGrace(game);
            game.networkManager.sendPlayerUpdate({
                position: spawnPoint.toArray(),
                rotation: game.player.mesh.rotation.y,
                pitch: game.cameraController.getPitch(),
                state: 'idle', jumping: false, velocityY: 0,
                weaponEquipped: game.hudState.isWeaponEquipped, isShooting: false,
            });
        };

        const currentLocationId = game.locationManager.getCurrentLocation()?.id;
        if (currentLocationId !== DEFAULT_SPAWN_LOCATION_ID) {
            game.changeLocation(DEFAULT_SPAWN_LOCATION_ID, { silent: true }).then(() => {
                placeInHall();
                finishRespawn();
            });
        } else {
            placeInHall();
            finishRespawn();
        }
    };

    game.networkManager.onPositionCorrection = (data: { position: number[] }) => {
        applyPositionCorrection(game, data.position);
    };

    game.networkManager.onDayNightSync = (data) => {
        game.dayNightConfig = data;
    };

    game.networkManager.onWorldStatus = (data) => {
        applyWorldStatus(game, data);
    };

    game.networkManager.onEnemyState = (list) => {
        game.enemySystem.handleEnemyState(list);
    };

    game.networkManager.onEnemyDamaged = (data) => {
        game.enemySystem.handleEnemyDamaged(data);

        const hurt = game.enemySystem.getEnemy(data.id);
        if (!hurt) return;

        const dot = dotAbilityId(data.abilityId);
        if (dot) {
            game.abilitySystem.spawnEmber(hurt.mesh.position.toArray(), dot);
            return;
        }

        SoundManager.getInstance().playAt("enemy-hit", {
            x: hurt.mesh.position.x,
            z: hurt.mesh.position.z,
            volume: 0.6,
            rate: 0.9 + Math.random() * 0.25,
        });
    };

    game.networkManager.onEnemyDeath = (data) => {
        const dying = game.enemySystem.getEnemy(data.id);
        if (dying) {
            SoundManager.getInstance().playAt("enemy-death", {
                x: dying.mesh.position.x,
                z: dying.mesh.position.z,
                volume: 0.85,
            });
        }

        game.enemySystem.handleEnemyDeath(data);
    };

    game.networkManager.onBossCast = (data) => {
        const boss = game.enemySystem.getEnemy(data.enemyId);
        boss?.beginCast(data.windup / 1000);

        if (boss) {
            SoundManager.getInstance().playAt("boss-cast", {
                x: boss.mesh.position.x,
                z: boss.mesh.position.z,
                volume: 0.9,
                rate: 1300 / data.windup,
                maxDistance: 70,
            });
        }

        if (data.attack === "spit") return;
        game.bossProjectiles.addTelegraph(
            data.aim[0],
            data.aim[2],
            data.radius,
            data.windup,
            game.getGroundHeight(data.aim[0], data.aim[2])
        );
    };

    game.networkManager.onBossProjectile = (data) => {
        const target = new THREE.Vector3(
            data.target[0],
            game.getGroundHeight(data.target[0], data.target[2]) + 0.4,
            data.target[2]
        );

        game.bossProjectiles.addProjectile(
            new THREE.Vector3(data.origin[0], data.origin[1], data.origin[2]),
            target,
            data.travel,
            data.radius,
            data.attack !== "spit"
        );

        SoundManager.getInstance().playAt("boss-launch", {
            x: data.origin[0],
            z: data.origin[2],
            volume: 0.7,
            maxDistance: 70,
        });

        SoundManager.getInstance().playAt("boss-impact", {
            x: data.target[0],
            z: data.target[2],
            volume: 0.8,
            delay: data.travel / 1000,
            maxDistance: 70,
        });
    };

    game.networkManager.onBossPool = (data) => {
        SoundManager.getInstance().playAt("acid-pool", {
            x: data.x,
            z: data.z,
            volume: 0.55,
            maxDistance: 55,
        });

        game.bossProjectiles.addPool(
            data.x,
            data.z,
            data.radius,
            data.duration,
            game.getGroundHeight(data.x, data.z)
        );
    };

    game.networkManager.onLootState = (list) => {
        game.lootSystem.handleLootState(list);
    };

    game.networkManager.onLootSpawn = (data) => {
        game.lootSystem.handleLootSpawn(data);
    };

    game.networkManager.onFactionGatesState = (gates) => {
        game.gateFactionIds = gates.map((g) => g.factionId);
        game.factionGates = gates;
        game.onFactionGatesChange?.(gates);

        const location = game.locationManager.getCurrentLocation();
        if (location instanceof Basement) {
            location.handleFactionGatesState(gates);
        }
    };

    game.networkManager.onCaveChestOpened = ({ chestId, ash }) => {
        const location = game.locationManager.getCurrentLocation();
        if (location instanceof Cave) location.markChestOpened(chestId);
        game.onNotification?.(`💰 Chest looted — ${ash} Ash`, 3000);
    };

    game.networkManager.onCaveBossState = ({ defeated }) => {
        game.caveBossDefeated = defeated;
        const location = game.locationManager.getCurrentLocation();
        if (location instanceof Cave) location.setBossDefeated(defeated);
        if (defeated) game.onNotification?.("🩸 The warden falls — something unseals below", 4000);
    };

    game.networkManager.onShardState = (state) => {
        game.shardState = state;
        game.onShardStateChange?.(state);
    };

    game.networkManager.onShardTeleport = ({ position }) => {
        const target = new THREE.Vector3(position[0], position[1], position[2]);
        game.player.teleportTo(target);
        game.cameraController.resetVerticalSmoothing();
        game.cameraController.yawObject.position.copy(target);
        beginTeleportGrace(game);
        game.otherPlayers.forEach((op) => op.setHidden(true));
    };

    game.networkManager.onAccountCount = (count) => {
        game.accountCount = count;
        game.onAccountCountChange?.(count);
        const location = game.locationManager.getCurrentLocation();
        if (location instanceof Basement) {
            location.setAccountCount(count);
        }
    };

    game.networkManager.onLootDespawn = (id) => {
        game.lootSystem.handleLootDespawn(id);
    };

    game.networkManager.onInventoryUpdate = ({ inventory, ash, placeables }) => {
        game.inventory = inventory;
        game.ash = ash;
        game.placeables = placeables;
        game.buildSystem.setPlaceables(placeables);
        game.onInventoryChange?.(inventory, ash, placeables);
    };

    game.networkManager.onSellResult = (data) => {
        game.onSellResult?.(data);
        game.onNotification?.(`💨 Sold ${data.quantitySold}x for ${data.ashEarned} ash`, 2500);
    };

    game.networkManager.onServerError = (message) => {
        game.onNotification?.(`⚠️ ${message}`, 2500);
        game.rejectPendingSignSave(message);
    };

    game.networkManager.onNicknameChanged = (nickname) => {
        game.onNicknameLoaded?.(nickname);
    };

    game.networkManager.onOtherPlayerNicknameChange = (data) => {
        const op = game.otherPlayers.get(data.id);
        if (op) op.setNickname(data.nickname);
    };

    game.networkManager.onPlayerFactionIdentity = (data) => {
        const op = game.otherPlayers.get(data.id);
        op?.setFactionIdentity(data.factionSymbol, data.factionImage, data.isFactionCreator);
    };

    game.networkManager.onFactionRosterChanged = (data) => {
        game.refreshFactionViews(data.mine);
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

    game.networkManager.onProgressionState = (data) => {
        game.progression = data;
        if (data.stats) {
            game.player.applyCombatStats(data.stats);
            game.hudState.maxHealth = data.stats.maxHealth;
            game.emitState(true);
        }
        const kind = data.weapon === "staff" ? "staff" : "rifle";
        game.player.getWeapon().setLoadout(kind, data.weaponTier ?? 1);
        game.shootingSystem.setWeapon(kind, data.weaponTier ?? 1);
        game.shootingSystem.setAvailableModes(data.fireModes ?? []);
        game.shootingSystem.setBoltStats(
            data.stats?.boltSpeed ?? 0,
            data.stats?.boltRange ?? 0,
            data.stats?.boltEnergyCost ?? 0
        );
        game.shootingSystem.setEnergyStats(data.stats?.maxEnergy ?? 0, data.stats?.energyRegen ?? 0);
        game.shootingSystem.setEnergy(data.energy ?? 0);
        game.shootingSystem.setFireMode(data.fireMode ?? "single");
        game.onProgressionState?.(data);
    };

    game.networkManager.onSkillLearned = (data) => {
        game.onSkillLearned?.(data);
    };

    game.networkManager.onSkillLearnRejected = (data) => {
        game.onSkillLearnRejected?.(data);
    };

    game.networkManager.onPlayerHealed = (data) => {
        game.player.health = data.health;
        game.player.maxHealth = data.maxHealth;
        game.emitState(true);
    };

    game.networkManager.onAbilityResult = (data) => {
        if (data.ok && typeof data.energy === "number") game.shootingSystem.setEnergy(data.energy);

        const cast = data.ok ? abilityById(data.abilityId) : null;
        if (cast?.params.ccImmune) {
            game.player.setControlImmuneUntil(performance.now() + (cast.durationMs ?? 0));
            game.player.clearSlow();
        }

        if (data.ok && data.position) {
            game.abilitySystem.playEffect({
                casterId: game.player.id,
                abilityId: data.abilityId,
                kind: data.kind ?? "self",
                position: data.position,
                radius: data.radius ?? 0,
                targetId: data.targetId ?? null,
                chain: data.chain ?? null,
            });
        }
        game.onAbilityResult?.(data);
    };

    game.networkManager.onAbilityEffect = (data) => {
        game.abilitySystem.playEffect(data);
    };

    game.networkManager.onAbilityZone = (data) => {
        game.abilitySystem.addZone(data);
    };

    game.networkManager.onAbilityZoneEnded = (zoneId) => {
        game.abilitySystem.removeZone(zoneId);
    };

    game.networkManager.onAbilityImpactPending = (data) => {
        game.abilitySystem.addPendingImpact(data);
    };

    game.networkManager.onAbilityMeter = (data) => {
        game.shootingSystem.setEnergy(data.energy);
        game.onAbilityMeter?.(data);
    };

    game.networkManager.onFireModeChanged = (mode) => {
        game.shootingSystem.setFireMode(mode);
        game.onFireModeChanged?.(mode);
    };

    game.networkManager.onMemeResult = (data) => {
        if (data.ok) game.playLocalMeme(data.memeId, data.durationMs ?? 1000, memeRadius(data.memeId));
        game.onMemeResult?.(data);
    };

    game.networkManager.onMemeEffect = (data) => {
        game.handleMemeEffect(data);
    };

    game.networkManager.onAbilityTrigger = (data) => {
        game.player.health = data.health;
        game.emitState(true);
        game.onAbilityTrigger?.(data);
    };

    game.networkManager.onXpGain = (data) => {
        game.onXpGain?.(data);
    };

    game.networkManager.onLevelUp = (data) => {
        game.onLevelUp?.(data);
    };

    game.networkManager.onPlayerLevelUpdate = (data) => {
        const levelled = game.otherPlayers.get(data.playerId);
        levelled?.setProgression(data.level, data.tier);
        levelled?.setWeaponLoadout(data.branch === "arcanist" ? "staff" : "rifle", data.weaponTier ?? 1);
        game.onPlayerLevelUpdate?.(data);
    };

    game.networkManager.onPlayerShield = (data) => {
        game.otherPlayers.get(data.playerId)?.setShielded(data.active);
    };

    game.networkManager.onPlayerControl = (data) => {
        game.player.applySlow(data.slowPercent, data.durationMs);
    };

    game.networkManager.onBranchSelected = (branch) => {
        game.onBranchSelected?.(branch);
    };

    game.networkManager.onSkillsRespecced = (data) => {
        game.onSkillsRespecced?.(data);
    };

    game.networkManager.onQuestInfo = (data) => {
        game.onQuestInfo?.(data);
    };

    game.networkManager.onQuestUpdate = (data) => {
        game.onQuestUpdate?.(data);
        if (data.visitedName) {
            game.onNotification?.(`🤝 Met ${data.visitedName} (${data.progress}/${data.targetCount})`, 2500);
        } else if (data.status === "active" && data.progress === 0) {
            game.onNotification?.(`📜 Quest accepted: kill ${data.targetCount} slimes in Slime Valley`, 3000);
        }

        if (data.status === "ready_to_turn_in") {
            game.onNotification?.("✨ Quest complete! Return to Sola for your reward", 3000);
        } else if (data.status === "completed") {
            const xp = data.rewardXp ? ` and ${data.rewardXp} XP` : "";
            game.onNotification?.(`🎉 Quest turned in: +${data.rewardAsh ?? 0} ash${xp}`, 3000);
        }
    };

    game.networkManager.onCanyonSegment = (data) => {
        const currentLoc = game.locationManager.getCurrentLocation();
        if (currentLoc instanceof FirstFloor) {
            currentLoc.applyFreshSegment(data);
            const spawnPoint = currentLoc.getSpawnPoint();
            game.player.teleportTo(spawnPoint);
            game.cameraController.resetVerticalSmoothing();
            game.cameraController.yawObject.position.copy(spawnPoint);
            beginTeleportGrace(game);
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
            game.cameraController.resetVerticalSmoothing();
            game.cameraController.yawObject.position.copy(spawnPoint);
            beginTeleportGrace(game);
            game.networkManager.sendPlayerUpdate({
                position: spawnPoint.toArray(),
                rotation: game.player.mesh.rotation.y,
                pitch: game.cameraController.getPitch(),
                state: 'idle', jumping: false, velocityY: 0,
                weaponEquipped: game.hudState.isWeaponEquipped, isShooting: false,
            });
        }
    };

    game.networkManager.onFactionJoined = (faction) => {
        game.interactionSystem.myFactionIds.add(faction.id);
        game.onFactionJoined?.(faction);
        game.onNotification?.(`🚩 Joined faction "${faction.name}"`, 2500);
    };

    game.networkManager.onFactionLeft = (factionId) => {
        game.interactionSystem.myFactionIds.delete(factionId);
        game.onFactionLeft?.(factionId);
        game.onNotification?.("🚩 Left faction", 2000);
    };

    game.networkManager.onFactionMyListResult = (factions) => {
        game.interactionSystem.myFactionIds = new Set(factions.map((f) => f.id));
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
        game.leaderboard = leaderboard;
        game.onLeaderboardResult?.(leaderboard);

        const location = game.locationManager.getCurrentLocation();
        if (location instanceof MainHall) {
            location.setLeaderboard(leaderboard);
        }
    };

    game.networkManager.onFactionLeaderboardResult = (leaderboard) => {
        game.factionLeaderboard = leaderboard;
        game.onFactionLeaderboardResult?.(leaderboard);

        const location = game.locationManager.getCurrentLocation();
        if (location instanceof MainHall) {
            location.setFactionLeaderboard(leaderboard);
        }
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

    game.networkManager.onFactionQuestListResult = (quests) => {
        game.factionQuests = quests;
        game.onFactionQuestListResult?.(quests);

        const questLocation = game.locationManager.getCurrentLocation();
        if (questLocation instanceof MainHall) {
            questLocation.setFactionQuests(quests);
        }
    };

    game.networkManager.onFactionQuestManageListResult = (data) => {
        game.onFactionQuestManageListResult?.(data);
    };

    game.networkManager.onFactionQuestCreated = (data) => {
        game.onFactionQuestCreated?.(data);
        game.onNotification?.(`📣 Quest published — ${data.chargedAsh} Ash locked in the quest bank`, 3500);
    };

    game.networkManager.onFactionQuestClaimed = (data) => {
        game.onFactionQuestClaimed?.(data);
        game.onNotification?.(`✅ Quest reward claimed — +${data.rewardAsh} Ash`, 3000);
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

    game.networkManager.onTradeSession = (data) => {
        game.onTradeSession?.(data);
    };

    game.networkManager.onTradeInviteReceived = (data) => {
        game.onTradeInviteReceived?.(data);
    };

    game.networkManager.onTradeInviteError = (data) => {
        game.onTradeInviteError?.(data);
    };
}
