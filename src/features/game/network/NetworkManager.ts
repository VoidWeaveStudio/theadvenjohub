//src\features\game\network\NetworkManager.ts
export type PlayerNetData = {
  id: string;
  nickname: string;
  position: number[];
  rotation: number;
  pitch: number;
  animation: string;
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

  // ✅ Throttling для playerUpdate
  private lastUpdateSent: number = 0;
  private updateThrottleMs: number = 50; // 20 раз/сек вместо 60

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

  connect(session: GameSession) {
    console.log("🌐 [Net] Connecting to:", session.serverUrl);
    this.session = session;
    this.authenticated = false;

    try {
      this.ws = new WebSocket(session.serverUrl);

      this.ws.onopen = () => {
        console.log("✅ [Net] Connected, sending auth...");
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
          console.error("[Net] Parse error", e);
        }
      };

      this.ws.onclose = (event) => {
        console.log(`🔌 [Net] Disconnected: code=${event.code}, reason="${event.reason}"`);
        this.stopHeartbeat();
        this.authenticated = false;
        this.onDisconnected?.();

        if (event.code !== 1000) {
          console.log(`🔄 [Net] Will reconnect in ${this.reconnectInterval}ms...`);
          this.reconnectTimer = setTimeout(() => {
            if (this.session) this.connect(this.session);
          }, this.reconnectInterval);
        }
      };

      this.ws.onerror = (e) => {
        console.error("❌ [Net] Error", e);
      };
    } catch (e) {
      console.error("❌ [Net] Connect failed", e);
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
        console.log(`✅ [Net] Auth success: playerId=${data.playerId}, nickname=${data.nickname}`);
        this.authenticated = true;
        this.startHeartbeat();
        this.onAuthenticated?.({
          playerId: data.playerId,
          nickname: data.nickname,
        });
        break;
      case "auth_error":
        console.error(`❌ [Net] Auth error: ${data.error}`);
        this.onAuthError?.(data.error || "Authentication failed");
        if (this.ws) this.ws.close(4001, data.error);
        break;
      case "progress_loaded":
        console.log("💾 [Net] Progress loaded:", data.progress);
        this.onProgressLoaded?.(data.progress);
        break;
      case "progress_loaded":
        console.log("💾 [Net] Progress loaded:", data.progress);
        this.onProgressLoaded?.(data.progress);
        break;

      case "init":
        if (data.players && Array.isArray(data.players)) {
          for (const p of data.players) {
            this.onPlayerJoin?.(p);
          }
        }
        break;

      case "playerJoin":
        this.onPlayerJoin?.(data);
        break;
      case "playerLeave":
        this.onPlayerLeave?.(data.playerId);
        break;
      case "playerUpdate":
        this.onPlayerUpdate?.(data);
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
        console.warn("⚠️ [Net] Position correction received");
        break;
      case "serverShutdown":
        console.log("🛑 [Net] Server shutting down");
        break;
    }
  }

  private startHeartbeat() {
    console.log("💓 [Net] Starting heartbeat (5s interval, 15s timeout)");
    this.lastPong = Date.now();
    this.heartbeatInterval = setInterval(() => {
      if (!this.authenticated) return;

      if (Date.now() - this.lastPong > this.heartbeatTimeoutMs) {
        console.warn("⚠️ [Net] Heartbeat timeout, reconnecting...");
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
        console.error("[Net] Send error", e);
      }
    }
  }

  // ✅ Throttling для playerUpdate
  sendPlayerUpdate(data: {
    position: number[];
    rotation: number;
    pitch: number;
    animation: string;
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
    console.log("🔌 [Net] Disconnecting...");
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