// src/features/game/core/GameNetworkHandlers.ts
import * as THREE from "three";
import type { Game, GameSession } from "./Game";
import { PlayerNetData, type DeathLootInfo, type RespawnOptions } from "../network/NetworkManager";
import { MEME_ABILITIES_BY_ID } from "../data/progression";
import { abilityById } from "../data/skills";
import { OtherPlayer } from "../entities/OtherPlayer";
import { FirstFloor } from "../world/locations/tower/floors/first-floor/FirstFloor";
import { Basement } from "../world/locations/tower/floors/basement/Basement";
import { MainHall } from "../world/locations/tower/floors/main-hall/MainHall";
import { Cave } from "../world/locations/cave/Cave";
import { apiPost } from "@/core/api/client";
import type { CanyonSegmentData } from "../network/NetworkManager";
import { SoundManager } from "./SoundManager";
import { perf } from "./PerfProfiler";
import {
    playBombResolved,
    playDefusalMatchEnd,
    playDefusalRoundEnd,
    updateDefusalAudio,
} from "./defusalAudio";
import { DEFAULT_SPAWN_LOCATION_ID, applyPositionCorrection, applyStuckTeleport, beginTeleportGrace, moveToServerPlacement, placeAtPoint } from "./GameLocationOrchestration";
import { applyWorldStatus } from "./GameWorldState";
import { t } from "@/core/i18n";
import { isBodyEmote } from "../data/emotes";
import { STORAGE_CRATE_PIECE } from "@/core/lib/roomLayoutGrid";

let systemMessageCounter = 0;
const systemMessageId = () => `system-${Date.now()}-${++systemMessageCounter}`;

let killFeedSeq = 0;

function nameOf(game: Game, id: string | null): string | null {
    if (!id) return null;
    if (id === game.localPlayerNetId) return game.myNickname || "You";
    return game.otherPlayers.get(id)?.nickname ?? "Player";
}

function restoreHealth(game: Game, health: number) {
    game.player.setHealth(health);
    game.player.setDead(false);
    game.hudState.health = health;
    game.emitState(true);
}

function pushKillFeed(game: Game, killerId: string | null, victimId: string) {
    game.onKillFeed?.({
        id: killFeedSeq++,
        killerName: nameOf(game, killerId),
        victimName: nameOf(game, victimId) ?? "Player",
        killerIsMe: !!killerId && killerId === game.localPlayerNetId,
        victimIsMe: victimId === game.localPlayerNetId,
        at: Date.now(),
    });
}

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
    killerId: string | null;
    options?: RespawnOptions;
    loot?: DeathLootInfo;
}

function killerNameFor(killerId: string | null, lookup: (id: string) => string | undefined): string {
    if (!killerId) return 'Unknown';
    const nickname = lookup(killerId);
    if (nickname) return nickname;
    if (killerId === 'bail-out') return 'Emergency Bail-Out';
    if (killerId.startsWith('canyon-')) return 'Enemy';
    return 'Unknown';
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

        perf.measure("otherPlayer.create", () => op.create(currentLocation.scene, game.resourceManager));
        op.setHidden(false);
        game.shootingSystem.registerOtherPlayer(op.id, op.getHitbox());
        op.updateFromNetwork(pending);
        op.setBadges(pending.isAdmin ?? false, pending.isFactionCreator ?? false);
        perf.measure("otherPlayer.skinTexture", () => op.setSkinTexture(pending.skinTextureUrl ?? null));
        perf.measure("otherPlayer.cosmetics", () =>
            op.applyCosmetics((pending.cosmeticSkinId ?? null) as any, (pending.cosmeticAccessoryId ?? null) as any)
        );
    }
    perf.measure("syncNearbyPeers", () => game.syncNearbyPeers());
    perf.flushLoad("location reconcile");
}

let nextXpTickAt = 0;
let lastAsh: number | null = null;
let tradeActive = false;
let nextWhizAt = 0;

function playWhizIfClose(game: Game, origin?: number[], direction?: number[]) {
    if (!origin || !direction) return;

    const now = Date.now();
    if (now < nextWhizAt) return;

    const me = game.player.mesh.position;
    const dx = me.x - origin[0];
    const dz = me.z - origin[2];
    const along = dx * direction[0] + dz * direction[2];
    if (along <= 1 || along > 90) return;

    const missX = dx - direction[0] * along;
    const missZ = dz - direction[2] * along;
    const miss = Math.hypot(missX, missZ);
    if (miss > 3.2) return;

    nextWhizAt = now + 180;
    SoundManager.getInstance().play("bullet-whiz", { volume: 0.35 + (1 - miss / 3.2) * 0.3 });
}

const CANYON_BIOME_COUNT = 5;

function canyonSegmentLabel(data: CanyonSegmentData): string {
    const biome = data.biome ? t(`g.biome.${data.biome}`) : data.name;
    return data.segment <= CANYON_BIOME_COUNT
        ? biome
        : t("g.canyon.segmentOf", { name: biome, segment: data.segment });
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
                const spawned = op;
                perf.measure("otherPlayer.create", () => spawned.create(currentLocation.scene, game.resourceManager));
                game.otherPlayers.set(data.id, op);
            } else if (!op.isCreated()) {
                const spawned = op;
                perf.measure("otherPlayer.create", () => spawned.create(currentLocation.scene, game.resourceManager));
                op.setHidden(false);
            } else {
                currentLocation.scene.add(op.mesh);
                currentLocation.scene.add(op.getHitbox());
                op.setHidden(false);
            }
            const joined = op;
            game.shootingSystem.registerOtherPlayer(data.id, op.getHitbox());
            op.updateFromNetwork(data);
            op.setBadges(data.isAdmin ?? false, data.isFactionCreator ?? false);
            perf.measure("otherPlayer.skinTexture", () => joined.setSkinTexture(data.skinTextureUrl ?? null));
            perf.measure("otherPlayer.cosmetics", () =>
                joined.applyCosmetics((data.cosmeticSkinId ?? null) as any, (data.cosmeticAccessoryId ?? null) as any)
            );
            perf.measure("otherPlayer.weapon", () =>
                joined.setWeaponLoadout(data.branch === "arcanist" ? "staff" : "rifle", data.weaponTier ?? 1)
            );
            perf.measure("syncNearbyPeers", () => game.syncNearbyPeers());
            perf.measure("chat.systemMessage", () =>
                game.onChatMessage?.({
                    id: systemMessageId(), sender: "System",
                    message: `${data.nickname} entered the area`,
                    timestamp: Date.now(), type: "system",
                })
            );
            perf.flushLoad("player entered area");
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
        game.onNotification?.(t("g.net.otherTab"), 5000);
    };

    game.networkManager.onDisconnected = () => {
        game.onNotification?.(t("g.net.reconnecting"), 3000);
    };

    game.networkManager.onAuthError = (error) => {
        if (error === 'banned' || error === 'license_revoked') {
            game.networkManager.disconnect();
            game.onAuthError?.(error);
        }
    };

    game.networkManager.onReconnectFailed = () => {
        game.onNotification?.(t("g.net.lost"), 5000);
    };

    game.networkManager.connect(game.session);

    game.networkManager.onAuthenticated = (data: AuthData) => {
        game.localPlayerNetId = data.playerId;
        game.voiceChat.setLocalId(data.playerId);
        game.onLocalPlayerId?.(data.playerId);
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
        game.syncNearbyPeers();
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
                game.syncNearbyPeers();
            }
   
            if (!hiddenOp.isCreated()) {
                hiddenOp.setPendingJoinData(data);
            }
            return;
        }
        let op = game.otherPlayers.get(data.id);
        if (!op) {
            op = new OtherPlayer(data.id, data.nickname, data.factionSymbol ?? null, data.factionImage ?? null, data.isAdmin ?? false, data.isFactionCreator ?? false);
            const spawned = op;
            perf.measure("otherPlayer.create", () => spawned.create(currentLocation.scene, game.resourceManager));
            game.otherPlayers.set(data.id, op);
        } else if (!op.isCreated()) {
            const spawned = op;
            perf.measure("otherPlayer.create", () => spawned.create(currentLocation.scene, game.resourceManager));
            op.setHidden(false);
        } else if (op.isHidden()) {
            currentLocation.scene.add(op.mesh);
            currentLocation.scene.add(op.getHitbox());
            op.setHidden(false);
        }
        const joined = op;
        game.shootingSystem.registerOtherPlayer(data.id, op.getHitbox());
        op.updateFromNetwork(data);
        op.setBadges(data.isAdmin ?? false, data.isFactionCreator ?? false);
        perf.measure("otherPlayer.skinTexture", () => joined.setSkinTexture(data.skinTextureUrl ?? null));
        perf.measure("otherPlayer.cosmetics", () =>
            joined.applyCosmetics((data.cosmeticSkinId ?? null) as any, (data.cosmeticAccessoryId ?? null) as any)
        );
        perf.measure("syncNearbyPeers", () => game.syncNearbyPeers());
        perf.measure("chat.systemMessage", () =>
            game.onChatMessage?.({
                id: systemMessageId(), sender: "System",
                message: `${data.nickname} joined the game`,
                timestamp: Date.now(), type: "system",
            })
        );
        perf.flushLoad("player joined");
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
            game.syncNearbyPeers();
        }
    };

    game.networkManager.onSpawnProtection = ({ untilMs }) => {
        game.setSpawnProtection(untilMs);
    };

    game.networkManager.onCosmeticState = (data) => {
        game.player.applyCosmetics(data.skinId, data.accessoryId);
        game.onCosmeticState?.(data);
    };

    game.networkManager.onCompanionState = (data) => {
        game.petSystem.setEquipped(data.equipped);
        game.onCompanionState?.(data);
    };

    game.networkManager.onCrateOpened = (data) => {
        game.onCrateOpened?.(data);
    };

    game.networkManager.onCompanionDusted = (data) => {
        game.onCompanionDusted?.(data);
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
        SoundManager.getInstance().playAt('shoot', {
            volume: 0.5,
            x: data.origin[0],
            z: data.origin[2],
        });
        playWhizIfClose(game, data.origin, data.direction);
    };

    game.networkManager.onCount = (count: number) => {
        game.hudState.online = count;
        game.emitState(true);
    };

    game.networkManager.onChatMessage = (data: ChatData) => {
        if (data.sender !== game.myNickname) {
            const mentioned = !!game.myNickname && data.message.toLowerCase().includes(game.myNickname.toLowerCase());
            SoundManager.getInstance().play(mentioned ? "chat-mention" : "chat-message", { volume: mentioned ? 0.55 : 0.3 });
        }
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

            SoundManager.getInstance().play(data.damage >= 20 ? 'hurt-heavy' : 'hurt-light');
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
        if (game.dust2Mode) pushKillFeed(game, data.killerId ?? null, data.playerId);

        if (data.playerId === game.localPlayerNetId) {
            game.isDead = true;
            game.player.setDead(true);
            game.killerName = killerNameFor(data.killerId, (id) => game.otherPlayers.get(id)?.nickname);
            game.onDeathStateChange?.(true, game.killerName, data.options, data.loot);
        } else {
            const op = game.otherPlayers.get(data.playerId);
            if (op && !op.isHidden()) {
                op.setDead(true);
                if (!game.dust2Mode) {
                    game.onChatMessage?.({
                        id: systemMessageId(), sender: "System",
                        message: `${op.nickname} was eliminated`,
                        timestamp: Date.now(), type: "system",
                    });
                }
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
            game.onNotification?.(t("g.notify.respawned"), 2000);
            game.isDead = false;
            game.killerName = null;
            game.onDeathStateChange?.(false, null);
        };

        moveToServerPlacement(game, data.locationId ?? DEFAULT_SPAWN_LOCATION_ID, data.position)
            .then(finishRespawn)
            .catch(finishRespawn);
    };

    game.networkManager.onHomeTeleportResult = (data) => {
        game.onHomeTeleportChange?.({
            casting: data.casting === true,
            castMs: typeof data.castMs === 'number' ? data.castMs : 0,
            cooldownUntil: typeof data.cooldownUntil === 'number' ? data.cooldownUntil : 0,
            charges: typeof data.charges === 'number' ? data.charges : 0,
        });

        if (data.casting) {
            game.onNotification?.(t("g.notify.channelling"), 3000);
            return;
        }

        if (data.done) {
            if (data.locationId) moveToServerPlacement(game, data.locationId, data.position);
            game.onNotification?.(t("g.notify.home"), 2000);
            return;
        }

        const messages: Record<string, string> = {
            damaged: "g.tp.damaged",
            in_combat: "g.tp.inCombat",
            canyon: "g.tp.canyon",
            cooldown: "g.tp.cooldown",
            no_charge: "g.tp.noCharge",
            no_beacon: "g.tp.noBeacon",
            dead: "g.tp.dead",
            casting: "g.tp.casting",
        };
        game.onNotification?.(t(messages[data.reason ?? ''] ?? "g.tp.failed"), 2500);
    };

    game.networkManager.onStorageState = (data) => {
        game.buildSession.filledStorageKeys = new Set(data.filled);
        game.onStorageState?.(data);
    };

    game.networkManager.onCombatState = (data) => {
        game.onCombatStateChange?.(data.until);
    };

    game.networkManager.onStuckResult = (data) => {
        game.onStuckStateChange?.(data.cooldownUntil);

        if (!data.ok) {
            if (data.reason === 'state') return;

            const messages: Record<string, string> = {
                in_combat: "g.tp.inCombat",
                cooldown: "g.stuck.cooldown",
                dead: "g.tp.dead",
            };
            game.onNotification?.(t(messages[data.reason ?? ''] ?? "g.stuck.failed"), 2500);
            return;
        }

        if (data.reason === 'canyon_death') {
            game.onNotification?.(t("g.notify.bailIsDeath"), 3500);
            return;
        }

        applyStuckTeleport(game, data.locationId ?? DEFAULT_SPAWN_LOCATION_ID);
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
        game.onNotification?.(t("g.notify.chestLooted", { amount: ash }), 3000);
    };

    game.networkManager.onCaveBossState = ({ defeated }) => {
        game.caveBossDefeated = defeated;
        const location = game.locationManager.getCurrentLocation();
        if (location instanceof Cave) location.setBossDefeated(defeated);
        if (defeated) game.onNotification?.(t("g.notify.wardenFalls"), 4000);
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

    game.networkManager.onCrateState = (crates) => {
        game.lootSystem.handleCrateState(crates);
    };

    game.networkManager.onCrateSpawn = (crate) => {
        game.lootSystem.handleCrateSpawn(crate);
    };

    game.networkManager.onCrateDespawn = (id) => {
        game.lootSystem.handleCrateDespawn(id);
    };

    game.networkManager.onCrateLootResult = (data) => {
        if (data.moved <= 0) return;
        game.onNotification?.(
            data.remaining > 0
                ? t("g.notify.crateSome", { count: data.moved })
                : t("g.notify.crateAll", { count: data.moved }),
            2500
        );
    };

    game.networkManager.onInsuranceConsumed = () => {
        game.onNotification?.(t("g.notify.insurancePaid"), 4000);
    };

    game.networkManager.onPartyState = (state) => {
        game.partyMemberIds = new Set(state.members.map((member) => member.id));
        game.onPartyState?.(state);
    };

    game.networkManager.onPartyVitals = (members) => {
        game.onPartyVitals?.(members);
    };

    game.networkManager.onPartyInviteReceived = (invite) => {
        SoundManager.getInstance().play("party-invite", { volume: 0.5 });
        game.onPartyInvite?.(invite);
    };

    game.networkManager.onPartyInviteExpired = (data) => {
        game.onPartyInviteExpired?.(data.fromId);
    };

    game.networkManager.onArenaState = (state) => {
        game.arenaWave = state.wave;
        game.applyArenaCandle(state.candleHealth, state.candleMaxHealth, state.wave);

        for (const member of state.members) {
            if (member.down && !member.left && state.phase === 'pause') game.markArenaDown(member.id);
            else game.clearArenaDown(member.id);
        }

        game.onArenaState?.(state);
    };

    game.networkManager.onForceTeleport = (data) => {
        moveToServerPlacement(game, data.locationId, data.position);
    };

    game.networkManager.onDefusalState = (state) => {
        const mySide = state.roster.find((entry) => entry.id === game.localPlayerNetId)?.side ?? null;
        game.dust2MateIds.clear();
        for (const entry of state.roster) {
            if (entry.id !== game.localPlayerNetId && entry.side === mySide) game.dust2MateIds.add(entry.id);
        }
        game.minimapBomb = state.bomb && state.bomb.state === "planted"
            ? { x: state.bomb.x, z: state.bomb.z }
            : null;

        game.onDefusalState?.(state);
        updateDefusalAudio(state, game.localPlayerNetId);

        const me = state.roster.find((entry) => entry.id === game.localPlayerNetId);
        if (!me) return;

        const heldId = me.held === "primary"
            ? me.primary
            : me.held === "melee"
                ? "rug-beater"
                : me.held === "grenade1"
                    ? me.grenades?.[0] ?? null
                    : me.held === "grenade2"
                        ? me.grenades?.[1] ?? null
                        : me.pistol;

        game.applyDefusalHeld(
            heldId,
            me.held === "grenade1" || me.held === "grenade2",
            me.held === "melee"
        );

        for (const entry of state.roster) {
            if (entry.id === game.localPlayerNetId) continue;
            const other = game.otherPlayers.get(entry.id);
            if (!other) continue;

            const theirs = entry.held === "primary"
                ? entry.primary
                : entry.held === "melee"
                    ? "rug-beater"
                    : entry.held === "grenade1" || entry.held === "grenade2"
                        ? null
                        : entry.pistol;

            other.setDefusalWeapon(theirs);
        }
    };

    game.networkManager.onDefusalQueueState = (state) => {
        game.onDefusalQueueState?.(state);
    };

    game.networkManager.onGrinderState = (state) => {
        game.onGrinderState?.(state);

        const me = state.roster.find((entry) => entry.id === game.localPlayerNetId);
        if (!me) return;

        const heldId = me.held === "primary"
            ? me.primary
            : me.held === "melee"
                ? "rug-beater"
                : me.held === "grenade1"
                    ? me.grenades?.[0] ?? null
                    : me.held === "grenade2"
                        ? me.grenades?.[1] ?? null
                        : me.pistol;

        game.applyDefusalHeld(
            heldId,
            me.held === "grenade1" || me.held === "grenade2",
            me.held === "melee"
        );

        for (const entry of state.roster) {
            if (entry.id === game.localPlayerNetId) continue;
            const other = game.otherPlayers.get(entry.id);
            if (!other) continue;

            const theirs = entry.held === "primary"
                ? entry.primary
                : entry.held === "melee"
                    ? "rug-beater"
                    : entry.held === "grenade1" || entry.held === "grenade2"
                        ? null
                        : entry.pistol;

            other.setDefusalWeapon(theirs);
        }
    };

    game.networkManager.onGrinderRespawn = (data) => {
        placeAtPoint(game, data.position);
        restoreHealth(game, data.health);
        game.isDead = false;
        game.onDeathStateChange?.(false, null);
    };

    game.networkManager.onGrinderDeath = (data) => {
        game.isDead = false;
        game.onDeathStateChange?.(false, null);
        pushKillFeed(game, data.killerId, game.localPlayerNetId ?? "");
    };

    game.networkManager.onGrinderRoundEnd = (data) => {
        game.onGrinderRoundEnd?.(data);
        game.onNotification?.(
            data.winnerName ? t("g.notify.grinderWinner", { name: data.winnerName }) : t("g.notify.roundOver"),
            5000
        );
    };

    game.networkManager.onDefusalRespawn = (data) => {
        placeAtPoint(game, data.position);
        restoreHealth(game, data.health);
        game.isDead = false;
        game.onDeathStateChange?.(false, null);
        game.onNotification?.(data.side === 't' ? t("g.notify.defusalAttack") : t("g.notify.defusalDefend"), 2000);
    };

    game.networkManager.onDefusalRoundEnd = (data) => {
        const why = data.reason === 'defused'
            ? t("g.defusal.whyDefused")
            : data.reason === 'exploded'
                ? t("g.defusal.whyExploded")
                : data.reason === 'time'
                    ? t("g.defusal.whyTime")
                    : t("g.defusal.whyEliminated");
        game.onNotification?.(t("g.defusal.roundTaken", { side: data.side === 't' ? t("g.defusal.attackers") : t("g.defusal.defenders"), why }), 4000);
        playDefusalRoundEnd(data.side);
    };

    game.networkManager.onDefusalBombPlanted = (data) => {
        SoundManager.getInstance().play("bomb-planted", { volume: 0.65 });
        game.onNotification?.(t("g.defusal.bombPlanted", { site: data.site }), 3000);
    };

    game.networkManager.onDefusalBombDefused = () => {
        playBombResolved(true);
        game.onNotification?.(t("g.defusal.audited"), 3000);
    };

    game.networkManager.onDefusalGrenadeThrown = (data) => {
        game.grenadeSystem.spawn(data.id, data.itemId, data.x, data.y, data.z);
    };

    game.networkManager.onDefusalGrenades = (data) => {
        game.grenadeSystem.track(data.grenades);
    };

    game.networkManager.onDefusalGrenadeBurst = (data) => {
        game.grenadeSystem.burst(data.id, data.itemId, data.x, data.y, data.z);

        const burstSound = data.itemId === 'rug-flash'
            ? 'flash-explode'
            : data.itemId === 'fud-cloud'
                ? 'smoke-deploy'
                : data.itemId === 'liquidation'
                    ? 'fire-loop'
                    : null;

        if (burstSound) {
            SoundManager.getInstance().playAt(burstSound, { x: data.x, z: data.z, volume: 0.6 });
        }
    };

    game.networkManager.onDefusalCloud = (data) => {
        game.grenadeSystem.cloud(data.x, data.z, data.radius, data.untilMs);
    };

    game.networkManager.onDefusalFlashed = (data) => {
        SoundManager.getInstance().play("flash-ring", { volume: 0.5 });
        game.onFlashed?.(data.durationMs);
    };

    game.networkManager.onDefusalBombExploded = () => {
        playBombResolved(false);
        game.onNotification?.(t("g.defusal.bombExploded"), 3000);
    };

    game.networkManager.onDefusalSideSwap = () => {
        game.onNotification?.(t("g.defusal.sidesSwapped"), 4000);
    };

    game.networkManager.onDefusalMatchEnd = (data) => {
        playDefusalMatchEnd(data.winner);
        game.onDefusalState?.(null);
        game.clearDefusalView();
        game.onNotification?.(
            t("g.defusal.matchWin", { side: data.winner === 't' ? t("g.defusal.attackers") : t("g.defusal.defenders"), t: data.score.t, ct: data.score.ct }),
            6000
        );
    };

    game.networkManager.onArenaStartResult = (data) => {
        game.onArenaStartResult?.(data.cooldownUntil);
        if (data.ok) return;

        const messages: Record<string, string> = {
            cooldown: "g.arenaStart.cooldown",
            instance_busy: "g.arenaStart.instanceBusy",
            already_running: "g.arenaStart.alreadyRunning",
            wrong_place: "g.arenaStart.wrongPlace",
            no_run: "g.arenaStart.noRun",
            not_invited: "g.arenaStart.notInvited",
            full: "g.arenaStart.full",
            dead: "g.arenaStart.dead",
            sealed: "g.arenaStart.sealed",
            not_started: "g.arenaStart.notStarted",
            window_closed: "g.arenaStart.windowClosed",
            need_party: "g.arenaStart.needParty",
        };
        game.onNotification?.(t(messages[data.reason ?? ''] ?? "g.arenaStart.default"), 3000);
    };

    game.networkManager.onArenaWaveStart = (data) => {
        game.onNotification?.(data.boss ? t("g.notify.waveBoss", { wave: data.wave }) : t("g.notify.wave", { wave: data.wave }), 2500);
    };

    game.networkManager.onArenaWaveEnd = (data) => {
        game.onNotification?.(t("g.notify.waveCleared", { wave: data.wave }), 3000);
    };

    game.networkManager.onArenaCandleDamage = (data) => {
        game.flashArenaCandle(data.health, data.maxHealth);
        game.onArenaCandleDamage?.(data.health, data.maxHealth);
    };

    game.networkManager.onArenaPlayerRevived = (data) => {
        if (data.playerId === game.localPlayerNetId) game.onNotification?.(t("g.notify.backOnFeet"), 2500);
    };

    game.networkManager.onArenaReviveResult = (data) => {
        game.onArenaReviveResult?.(data);
        if (data.done) game.onNotification?.(t("g.notify.allyRaised"), 2000);
        else if (data.cancelled && data.reason === 'too_far') game.onNotification?.(t("g.notify.getCloser"), 2000);
        else if (data.cancelled && data.reason === 'not_paused') game.onNotification?.(t("g.notify.onlyBetweenWaves"), 2000);
    };

    game.networkManager.onArenaEnded = (data) => {
        game.arenaWave = 0;
        game.applyArenaCandle(1, 1, 0);
        game.clearArenaDownAll();
        game.onArenaEnded?.(data);
    };

    game.networkManager.onPartyDisbanded = (data) => {
        game.onPartyDisbanded?.(data.reason);
        game.onNotification?.(data.reason === 'kicked' ? t("g.notify.partyKicked") : t("g.notify.partyBrokeUp"), 3000);
    };

    game.networkManager.onInventoryUpdate = ({ inventory, ash, placeables }) => {
        if (typeof ash === "number") {
            if (lastAsh !== null && ash > lastAsh) {
                SoundManager.getInstance().play("ash-gain", { volume: 0.45 });
            }
            lastAsh = ash;
        }
        game.inventory = inventory;
        game.ash = ash;
        game.placeables = placeables;
        game.buildSystem.setPlaceables(placeables);
        game.buildSession.ownedCrates = placeables[STORAGE_CRATE_PIECE] || 0;
        game.petSystem.setOwnedFromPlaceables(placeables);
        game.onInventoryChange?.(inventory, ash, placeables);
    };

    game.networkManager.onSellResult = (data) => {
        game.onSellResult?.(data);
        game.onNotification?.(t("g.notify.sold", { count: data.quantitySold, amount: data.ashEarned }), 2500);
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
        SoundManager.getInstance().play("skill-unlock", { volume: 0.6 });
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
            const from = game.player.mesh.position.toArray();

            if (data.kind === "dash") placeAtPoint(game, data.position);

            game.abilitySystem.playEffect({
                casterId: game.player.id,
                abilityId: data.abilityId,
                kind: data.kind ?? "self",
                position: data.position,
                radius: data.radius ?? 0,
                targetId: data.targetId ?? null,
                chain: data.kind === "dash" ? [from, data.position] : (data.chain ?? null),
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
        const now = Date.now();
        if (now >= nextXpTickAt) {
            nextXpTickAt = now + 400;
            SoundManager.getInstance().play("xp-tick", { volume: 0.3 });
        }
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

    game.networkManager.onNpcMet = (metNpcs) => {
        game.onNpcMet?.(metNpcs);
    };

    game.networkManager.onQuestUpdate = (data) => {
        game.onQuestUpdate?.(data);
        if (data.visitedName) {
            game.onNotification?.(t("g.notify.metNpc", { name: data.visitedName, done: data.progress, total: data.targetCount }), 2500);
        } else if (data.status === "active" && data.progress === 0) {
            SoundManager.getInstance().play("quest-accept", { volume: 0.5 });
            game.onNotification?.(t("g.notify.questAcceptedSlimes", { count: data.targetCount }), 3000);
        }

        if (data.status === "ready_to_turn_in") {
            SoundManager.getInstance().play("quest-complete", { volume: 0.6 });
            game.onNotification?.(t("g.notify.questComplete"), 3000);
        } else if (data.status === "completed") {
            const xp = data.rewardXp ? t("g.notify.andXp", { xp: data.rewardXp }) : "";
            game.onNotification?.(t("g.notify.questTurnedIn", { amount: data.rewardAsh ?? 0, xp }), 3000);
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
        game.onNotification?.(`🗺️ ${canyonSegmentLabel(data)}`, 2500);
    };

    game.networkManager.onCanyonCleared = (data) => {
        const currentLoc = game.locationManager.getCurrentLocation();
        if (currentLoc instanceof FirstFloor) {
            currentLoc.applyBossDefeated(data);
        }
        game.onNotification?.(t("g.notify.bossDefeated"), 3000);
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
        game.onNotification?.(t("g.notify.factionJoined", { name: faction.name }), 2500);
    };

    game.networkManager.onFactionLeft = (factionId) => {
        game.interactionSystem.myFactionIds.delete(factionId);
        game.onFactionLeft?.(factionId);
        game.onNotification?.(t("g.notify.factionLeft"), 2000);
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
        game.onNotification?.(t("g.notify.factionTaskAccepted"), 2500);
    };

    game.networkManager.onFactionTaskCompleted = (data) => {
        game.onFactionTaskCompleted?.(data);
        game.onNotification?.(t("g.notify.factionTaskDone", { label: data.label, amount: data.rewardAsh, who: data.rewardNickname || t("g.notify.factionLeadership") }), 4000);
    };

    game.networkManager.onFactionCreatorClaimResult = (data) => {
        game.onFactionCreatorClaimResult?.(data);
        game.onNotification?.(data.isCreator ? t("g.notify.creatorVerified") : t("g.notify.creatorMismatch"), 3000);
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
        game.onNotification?.(t("g.notify.questPublished", { amount: data.chargedAsh }), 3500);
    };

    game.networkManager.onFactionQuestClaimed = (data) => {
        game.onFactionQuestClaimed?.(data);
        game.onNotification?.(t("g.notify.questRewardClaimed", { amount: data.rewardAsh }), 3000);
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
        game.onNotification?.(t("g.notify.tokenInfoMailed"), 2500);
    };

    game.networkManager.onSupportTicketSent = () => {
        game.onNotification?.(t("g.notify.supportSent"), 3500);
    };

    game.networkManager.onAchievementsUnlocked = (achievements) => {
        achievements.forEach((a) => {
            game.onNotification?.(t("g.notify.achievementUnlocked", { name: t(`g.ach.${a.key}.label`) }), 3500);
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
        game.onNotification?.(t("g.notify.factionInviteSent"), 2500);
    };

    game.networkManager.onTradeSession = (data) => {
        if (data && !tradeActive) {
            tradeActive = true;
            SoundManager.getInstance().play("trade-accept", { volume: 0.5 });
        } else if (!data && tradeActive) {
            tradeActive = false;
            SoundManager.getInstance().play("trade-complete", { volume: 0.5 });
        }
        game.onTradeSession?.(data);
    };

    game.networkManager.onTradeInviteReceived = (data) => {
        SoundManager.getInstance().play("trade-invite", { volume: 0.5 });
        game.onTradeInviteReceived?.(data);
    };

    game.networkManager.onTradeInviteError = (data) => {
        SoundManager.getInstance().play("trade-decline", { volume: 0.45 });
        game.onTradeInviteError?.(data);
    };
}
