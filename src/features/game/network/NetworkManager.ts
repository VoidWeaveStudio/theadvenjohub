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
};

export interface GameSession {
  gameToken: string;
  serverUrl: string;
  userId: string;
  wallet: string;
}

export class NetworkManager {
  private ws: WebSocket | null = null;
  private reconnectInterval: number = 3000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private nickname: string = "Player";
  private session: GameSession | null = null;
  private authenticated: boolean = false;

  private lastUpdateSent: number = 0;
  private updateThrottleMs: number = 50;

  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private lastPong: number = Date.now();
  private heartbeatTimeoutMs: number = 15000;

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

        if (event.code !== 1000) {
          this.reconnectTimer = setTimeout(() => {
            if (this.session) this.connect(this.session);
          }, this.reconnectInterval);
        }
      };

      this.ws.onerror = () => { };
    } catch (e) {
    }
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
        this.startHeartbeat();
        this.onAuthenticated?.({
          playerId: data.playerId,
          nickname: data.nickname,
        });
        break;
      case "auth_error":
        this.onAuthError?.(data.error || "Authentication failed");
        if (this.ws) this.ws.close(4001, data.error);
        break;
      case "progress_loaded":
        this.onProgressLoaded?.(data.progress);
        break;
      case "init":
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
            });
          }
        }
        break;
      case "playerJoin":
        this.onPlayerJoin?.({
          ...data,
          health: data.health ?? 100,
          alive: data.alive ?? true,
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

  sendChatMessage(message: string) {
    if (!this.authenticated) return;
    this.send({
      type: "chat",
      message: message.slice(0, 200),
      timestamp: Date.now(),
    });
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
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
    this.authenticated = false;
  }
}