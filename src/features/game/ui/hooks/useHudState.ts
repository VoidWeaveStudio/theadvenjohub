// src/features/game/ui/hooks/useHudState.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { HUDState, DamageEvent } from "../../core/Game";
import type { DeathLootInfo, RespawnOptions } from "../../network/NetworkManager";

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
    weaponName: "Standard Rifle",
    weaponKind: "rifle",
    fireMode: "Single",
    chargeProgress: 0,
    tunerReadout: null,
    inkDarkness: 0,
  });

  const [damageEvents, setDamageEvents] = useState<DamageEvent[]>([]);
  const [isDead, setIsDead] = useState(false);
  const [killerName, setKillerName] = useState<string | null>(null);
  const [respawnOptions, setRespawnOptions] = useState<RespawnOptions | undefined>(undefined);
  const [deathLoot, setDeathLoot] = useState<DeathLootInfo | undefined>(undefined);
  const [damageIndicator, setDamageIndicator] = useState<{
    attackerId: string | null;
    direction: number;
  }>({ attackerId: null, direction: 0 });
  const [isHitMark, setIsHitMark] = useState(false);
  const [combatUntil, setCombatUntil] = useState(0);
  const [combatRemainingMs, setCombatRemainingMs] = useState(0);
  const [stuckCooldownUntil, setStuckCooldownUntil] = useState(0);

  const handleCombatState = useCallback((until: number) => {
    setCombatUntil(until);
  }, []);

  const handleStuckState = useCallback((cooldownUntil: number) => {
    setStuckCooldownUntil(cooldownUntil);
  }, []);

  useEffect(() => {
    if (combatUntil <= 0) {
      setCombatRemainingMs(0);
      return;
    }

    const tick = () => {
      const left = combatUntil - Date.now();
      setCombatRemainingMs(left > 0 ? left : 0);
      return left;
    };

    if (tick() <= 0) return;

    const timer = setInterval(() => {
      if (tick() <= 0) clearInterval(timer);
    }, 200);

    return () => clearInterval(timer);
  }, [combatUntil]);

  const handleStateChange = useCallback((state: HUDState) => {
    setHudState(state);
  }, []);

  const handleDamageEvent = useCallback((event: DamageEvent) => {
    setDamageEvents((prev) => [...prev, event]);
    setTimeout(() => setDamageEvents((prev) => prev.filter((e) => e.id !== event.id)), 2000);
  }, []);

  const handleDeathStateChange = useCallback((dead: boolean, killer: string | null, options?: RespawnOptions, loot?: DeathLootInfo) => {
    setIsDead(dead);
    setKillerName(killer);
    setRespawnOptions(dead ? options : undefined);
    setDeathLoot(dead ? loot : undefined);
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
    respawnOptions,
    deathLoot,
    damageIndicator,
    isHitMark,
    combatRemainingMs,
    isInCombat: combatRemainingMs > 0,
    stuckCooldownUntil,
    handleStateChange,
    handleDamageEvent,
    handleDeathStateChange,
    handleDamageIndicatorUpdate,
    handleHitMark,
    handleCombatState,
    handleStuckState,
  };
}
