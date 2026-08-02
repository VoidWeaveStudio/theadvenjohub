// src/features/game/ui/hooks/useHudState.ts
import { useCallback, useRef, useState } from "react";
import { HUDState, DamageEvent } from "../../core/Game";

export function useHudState() {
  const [hudState, setHudState] = useState<HUDState>({
    health: 100,
    maxHealth: 100,
    ammo: 30,
    maxAmmo: 30,
    reserve: 0,
    online: 1,
    inSafeZone: true,
    prompt: null,
    isReloading: false,
    isWeaponEquipped: true,
    equippedTool: "weapon",
  });

  const [damageEvents, setDamageEvents] = useState<DamageEvent[]>([]);
  const [isDead, setIsDead] = useState(false);
  const [killerName, setKillerName] = useState<string | null>(null);
  const [damageIndicator, setDamageIndicator] = useState<{
    attackerId: string | null;
    direction: number;
  }>({ attackerId: null, direction: 0 });
  const [isHitMark, setIsHitMark] = useState(false);

  const handleStateChange = useCallback((state: HUDState) => {
    setHudState(state);
  }, []);

  const handleDamageEvent = useCallback((event: DamageEvent) => {
    setDamageEvents((prev) => [...prev, event]);
    setTimeout(() => setDamageEvents((prev) => prev.filter((e) => e.id !== event.id)), 2000);
  }, []);

  const handleDeathStateChange = useCallback((dead: boolean, killer: string | null) => {
    setIsDead(dead);
    setKillerName(killer);
  }, []);

  const lastDamageIndicatorUpdateRef = useRef(0);
  const handleDamageIndicatorUpdate = useCallback((attackerId: string | null, direction: number) => {
    setDamageIndicator((prev) => {
      const attackerChanged = attackerId !== prev.attackerId;
      const now = Date.now();
      if (!attackerChanged && now - lastDamageIndicatorUpdateRef.current < 66) {
        return prev;
      }
      lastDamageIndicatorUpdateRef.current = now;
      return { attackerId, direction };
    });
  }, []);

  const handleHitMark = useCallback(() => {
    setIsHitMark(true);
    setTimeout(() => setIsHitMark(false), 200);
  }, []);

  return {
    hudState,
    damageEvents,
    isDead,
    killerName,
    damageIndicator,
    isHitMark,
    handleStateChange,
    handleDamageEvent,
    handleDeathStateChange,
    handleDamageIndicatorUpdate,
    handleHitMark,
  };
}
