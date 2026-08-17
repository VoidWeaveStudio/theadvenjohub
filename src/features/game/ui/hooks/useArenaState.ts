// src/features/game/ui/hooks/useArenaState.ts
import { useCallback, useState } from "react";
import type { ArenaEndedData, ArenaReviveState, ArenaStateData } from "../../network/NetworkManager";

const IDLE_REVIVE: ArenaReviveState = { channelling: false, targetId: null, channelMs: 0 };

export function useArenaState() {
  const [arena, setArena] = useState<ArenaStateData | null>(null);
  const [revive, setRevive] = useState<ArenaReviveState>(IDLE_REVIVE);
  const [summary, setSummary] = useState<ArenaEndedData | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);

  const handleArenaState = useCallback((state: ArenaStateData) => {
    setArena(state);
    if (state.phase !== "pause") setRevive(IDLE_REVIVE);
  }, []);

  const handleCandleDamage = useCallback((health: number, maxHealth: number) => {
    setArena((prev) => (prev ? { ...prev, candleHealth: health, candleMaxHealth: maxHealth } : prev));
  }, []);

  const handleReviveResult = useCallback((data: { channelling: boolean; targetId?: string; channelMs?: number }) => {
    if (!data.channelling) {
      setRevive(IDLE_REVIVE);
      return;
    }
    setRevive({ channelling: true, targetId: data.targetId ?? null, channelMs: data.channelMs ?? 0 });
  }, []);

  const handleArenaEnded = useCallback((data: ArenaEndedData) => {
    setArena(null);
    setRevive(IDLE_REVIVE);
    setCooldownUntil(data.cooldownUntil);
    if (data.reason !== "left") setSummary(data);
  }, []);

  const handleStartResult = useCallback((cooldown: number) => {
    if (cooldown > 0) setCooldownUntil(cooldown);
  }, []);

  const dismissSummary = useCallback(() => setSummary(null), []);

  return {
    arena,
    revive,
    summary,
    cooldownUntil,
    handleArenaState,
    handleCandleDamage,
    handleReviveResult,
    handleArenaEnded,
    handleStartResult,
    dismissSummary,
  };
}
