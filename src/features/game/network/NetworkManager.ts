//src\features\game\network\NetworkManager.ts
export type PlayerNetData = {
  id: string;
  nickname: string;
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
};

export type DayNightSyncData = {
  epoch: number;
  dayDurationMs: number;
  nightDurationMs: number;
};

export type EnemyNetData = {
  id: string;
  position: number[];
  health: number;
  maxHealth: number;
  alive: boolean;
  targetId: string | null;
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

export type InventoryEntry = {
  address: string;
  name: string;
  symbol: string;
  image: string;
  quantity: number;
};

export interface GameSession {
  gameToken: string;
  serverUrl: string;
  userId: string;
  wallet: string;
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
  public onShoot?: (data: { id: string; origin: number[]; direction: number[] }) => void;
  public onConnected?: () => void;
  public onDisconnected?: () => void;
  public onCount?: (count: number) => void;
  public onChatMessage?: (data: { id: string; sender: string; message: string; timestamp: number }) => void;
  public onAuthenticated?: (data: { playerId: string; nickname: string }) => void;
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
  public onInventoryUpdate?: (data: { inventory: InventoryEntry[]; ash: number }) => void;
  public onSellResult?: (data: {
    address: string;
    quantitySold: number;
    ashEarned: number;
    marketCap: number;
  }) => void;
  public onServerError?: (message: string) => void;

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
        this.onDisconnected?.();

        if (event.code === 1000) return;

        if (event.code === 4009) {
          this.onSessionRevoked?.();
          return;
        }

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
      case "lootSpawn":
        this.onLootSpawn?.({ id: data.id, position: data.position, tokens: data.tokens });
        break;
      case "lootDespawn":
        this.onLootDespawn?.(data.id);
        break;
      case "inventoryUpdate":
        if (Array.isArray(data.inventory)) {
          this.onInventoryUpdate?.({ inventory: data.inventory, ash: data.ash ?? 0 });
        }
        break;
      case "sellResult":
        this.onSellResult?.(data);
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
      case "nicknameChange":
        break;
      case "positionCorrection":
        break;
      case "serverShutdown":
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

  sendChatMessage(message: string) {
    if (!this.authenticated) return;
    this.send({
      type: "chat",
      message: message.slice(0, 200),
      timestamp: Date.now(),
    });
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