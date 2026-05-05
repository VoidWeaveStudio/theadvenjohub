//src\games\warden-abyss\hooks\useGameLogic.ts
"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { UPGRADES, calculateUpgradeCost } from "../data/upgrades";
import { SKINS, calculateSkinCost } from "../data/skins";
import { loadProgress, recordAction, saveFullProgress, syncTotalEarned } from "@/games/warden-abyss/actions/gameProgress";
import { getTranslation, getLanguageFromCookie } from "@/core/i18n/index";

export interface FloatingDamage {
  id: number;
  value: number;
  x: number;
  y: number;
  createdAt: number;
}

export interface ActionStats {
  burned: number;
  withdrawn: number;
  blocked: number;
}

interface UseGameLogicProps {
  wallet: string;
  onDbLoading: (loading: boolean) => void;
  onError?: (message: string) => void;
}

const MAX_MANUAL = 5;
const MAX_TOTAL = 10;
const VISUAL_ATTACK_INTERVAL = 200;       
const ANIMATION_RESET_DELAY = 200;         
const SYNC_INTERVAL = 30 * 1000;
const MAX_SYNC_RETRIES = 3;
const SYNC_RETRY_DELAY = 2000;
const DAMAGE_LIFETIME = 1000;
const ACTION_COOLDOWN_MS = 30 * 60 * 1000;

const ANIMATION_FPS_TARGET = 60;
const ANIMATION_FRAME_BUDGET = 1000 / ANIMATION_FPS_TARGET;

const roundToTenth = (value: number): number => Math.round(value * 10) / 10;

export function useGameLogic({ wallet, onDbLoading, onError }: UseGameLogicProps) {
  const lang = getLanguageFromCookie();
  const t = (key: string, params?: Record<string, string | number>) => {
    const template = getTranslation(key, lang);
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_, k) => 
      params[k] !== undefined ? String(params[k]) : `{${k}}`
    );
  };
  
  const [balance, setBalance] = useState<number>(0);
  const [totalEarned, setTotalEarned] = useState<number>(0);
  const [activeSprite, setActiveSprite] = useState<number>(0);
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'attack' | 'recover'>('idle');
  
  const floatingDamagesRef = useRef<Map<number, FloatingDamage>>(new Map());
  const [forceUpdateState, setForceUpdateState] = useState<number>(0);
  const [actionStats, setActionStats] = useState<ActionStats>({ burned: 0, withdrawn: 0, blocked: 0 });
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [burnBonusPercent, setBurnBonusPercent] = useState<number>(0);
  const [blockedAmount, setBlockedAmount] = useState<number>(0);
  const [isOffline, setIsOffline] = useState<boolean>(false);

  const [upgradeLevels, setUpgradeLevels] = useState<Record<string, number>>({});
  const [skinStates, setSkinStates] = useState<Record<string, { owned: boolean }>>({});

  const [lastBurnTime, setLastBurnTime] = useState<number>(0);
  const [lastWithdrawTime, setLastWithdrawTime] = useState<number>(0);
  const [lastBlockTime, setLastBlockTime] = useState<number>(0);

  const manualClicksRef = useRef<number[]>([]);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const attackIndexRef = useRef<number>(0);
  const damageIdRef = useRef<number>(0);
  const lastAttackTimeRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);
  const hasLoadedRef = useRef<boolean>(false);
  
  const lastSyncTimeRef = useRef<number>(0);
  const syncRetryCountRef = useRef<number>(0);
  const totalEarnedRef = useRef<number>(0);
  const balanceRef = useRef<number>(0);
  const upgradeLevelsRef = useRef<Record<string, number>>({});
  const skinStatesRef = useRef<Record<string, { owned: boolean }>>({});
  const animationQueueRef = useRef<Array<{ timestamp: number; type: 'attack' }>>([]);

  useEffect(() => { totalEarnedRef.current = totalEarned; }, [totalEarned]);
  useEffect(() => { balanceRef.current = balance; }, [balance]);
  useEffect(() => { upgradeLevelsRef.current = upgradeLevels; }, [upgradeLevels]);
  useEffect(() => { skinStatesRef.current = skinStates; }, [skinStates]);

  useEffect(() => {
    const setOnline = () => setIsOffline(false);
    const setOffline = () => setIsOffline(true);
    
    window.addEventListener('online', setOnline);
    window.addEventListener('offline', setOffline);
    setIsOffline(!navigator.onLine);
    
    return () => {
      window.removeEventListener('online', setOnline);
      window.removeEventListener('offline', setOffline);
    };
  }, []);

  useEffect(() => {
    if (!wallet || totalEarned <= 0) return;
    try {
      const key = `warden_progress_${wallet}`;
      localStorage.setItem(key, JSON.stringify({
        totalEarned,
        balance,
        upgradeLevels,
        skinStates,
        burnBonusPercent,
        actionStats,
        lastBurnTime,
        lastWithdrawTime,
        lastBlockTime,
        timestamp: Date.now()
      }));
    } catch (e) {
    }
  }, [wallet, totalEarned, balance, upgradeLevels, skinStates, burnBonusPercent, actionStats, lastBurnTime, lastWithdrawTime, lastBlockTime]);

  useEffect(() => {
    isMountedRef.current = true;
    if (!wallet || hasLoadedRef.current) return;

    const load = async () => {
      onDbLoading(true);
      try {
        const data = await loadProgress(wallet);
        
        if (!isMountedRef.current) return;
        
        if (data && typeof data.totalEarned === "number") {
          setTotalEarned(data.totalEarned);
          setBalance(data.balance ?? 0);
          setActionStats({ burned: data.burned, withdrawn: data.withdrawn, blocked: data.blocked });
          setBurnBonusPercent(data.burnBonusPercent || 0);
          setUpgradeLevels(data.upgrades || {});
          setSkinStates(data.skins || {});
          hasLoadedRef.current = true;
          lastSyncTimeRef.current = Date.now();
        }
      } catch (e: any) {
        try {
          const key = `warden_progress_${wallet}`;
          const cached = localStorage.getItem(key);
          if (cached) {
            const local = JSON.parse(cached);
            if (Date.now() - local.timestamp < 24 * 60 * 60 * 1000) {
              setTotalEarned(local.totalEarned || 0);
              setBalance(local.balance || 0);
              setActionStats(local.actionStats || { burned: 0, withdrawn: 0, blocked: 0 });
              setBurnBonusPercent(local.burnBonusPercent || 0);
              setUpgradeLevels(local.upgradeLevels || {});
              setSkinStates(local.skinStates || {});
              if (local.lastBurnTime) setLastBurnTime(local.lastBurnTime);
              if (local.lastWithdrawTime) setLastWithdrawTime(local.lastWithdrawTime);
              if (local.lastBlockTime) setLastBlockTime(local.lastBlockTime);
            }
          }
        } catch (localErr) {
        }
        
        onError?.(t("loadProgressFailed", { message: e.message }));
      } finally {
        if (isMountedRef.current) onDbLoading(false);
      }
    };

    load();
    return () => { isMountedRef.current = false; };
  }, [wallet, lang]);

  useEffect(() => {
    if (!wallet) return;

    const syncInBackground = async () => {
      if (isOffline || totalEarnedRef.current <= 0) return;
      
      const now = Date.now();
      if (now - lastSyncTimeRef.current < SYNC_INTERVAL) return;

      try {
        const result = await syncTotalEarned(wallet, totalEarnedRef.current, balanceRef.current);
        
        if (result.success) {
          lastSyncTimeRef.current = now;
          syncRetryCountRef.current = 0;
        } else {
          throw new Error("Sync returned failure");
        }
      } catch (e: any) {
        syncRetryCountRef.current++;
        
        if (syncRetryCountRef.current < MAX_SYNC_RETRIES) {
          setTimeout(syncInBackground, SYNC_RETRY_DELAY * syncRetryCountRef.current);
          return;
        }
        
        onError?.(t("saveProgressFailed"));
        syncRetryCountRef.current = 0;
      }
    };

    const interval = setInterval(syncInBackground, 10 * 1000);
    
    return () => clearInterval(interval);
  }, [wallet, isOffline, lang]);

  const currentClickPower = useMemo(() => {
    let power = 1;
    
    UPGRADES.forEach(upgrade => {
      if (upgrade.isAuto) return;
      const level = upgradeLevels[upgrade.id] || 0;
      if (level > 0) power *= (1 + upgrade.damageBonusPercent / 100);
    });
    
    let totalSkinBonus = 0;
    Object.entries(skinStates).forEach(([skinId, state]) => {
      if (state.owned) {
        const skin = SKINS.find(s => s.id === skinId);
        if (skin) {
          totalSkinBonus += skin.bonusPercent;
        }
      }
    });
    
    if (totalSkinBonus > 0) {
      power *= (1 + totalSkinBonus / 100);
    }
    
    if (burnBonusPercent > 0) {
      power *= (1 + burnBonusPercent / 100);
    }
    
    return roundToTenth(power);
  }, [upgradeLevels, skinStates, burnBonusPercent]);

  const autoHitsPerSec = upgradeLevels["auto"] || 0;

  const playAttackAnimation = useCallback(() => {
    const now = Date.now();
    
    if (now - lastAttackTimeRef.current < VISUAL_ATTACK_INTERVAL) {
      animationQueueRef.current.push({ timestamp: now, type: 'attack' });
      return;
    }
    
    lastAttackTimeRef.current = now;
    
    const nextPhase = animationPhase === 'idle' ? 'attack' : animationPhase === 'attack' ? 'recover' : 'idle';
    setAnimationPhase(nextPhase);
    
    if (nextPhase === 'attack') {
      attackIndexRef.current = attackIndexRef.current === 1 ? 2 : 1;
      setActiveSprite(attackIndexRef.current);
    } else if (nextPhase === 'recover') {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setActiveSprite(0);
          setAnimationPhase('idle');
        }
      }, ANIMATION_RESET_DELAY);
    }
    
    if (animationQueueRef.current.length > 0) {
      const pending = animationQueueRef.current.shift();
      if (pending && now - pending.timestamp < 500) {
        setTimeout(playAttackAnimation, 50);
      } else {
        animationQueueRef.current = []; 
      }
    }
  }, [animationPhase]);

  useEffect(() => {
    if (isPaused) return;
    
    let lastFrameTime = performance.now();
    
    const animationLoop = (currentTime: number) => {
      if (!isMountedRef.current || isPaused) return;
      
      const deltaTime = currentTime - lastFrameTime;
      lastFrameTime = currentTime;
      
      if (deltaTime >= ANIMATION_FRAME_BUDGET) {
      }
      
      animationFrameRef.current = requestAnimationFrame(animationLoop);
    };
    
    animationFrameRef.current = requestAnimationFrame(animationLoop);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPaused]);

  const addFloatingDamage = useCallback((x: number, y: number, value: number) => {
    const id = damageIdRef.current++;
    const damage: FloatingDamage = {
      id,
      value: roundToTenth(value),
      x,
      y,
      createdAt: Date.now()
    };
    
    floatingDamagesRef.current.set(id, damage);
    setForceUpdateState(n => n + 1);

    const timeoutId = setTimeout(() => {
      if (isMountedRef.current) {
        floatingDamagesRef.current.delete(id);
        setForceUpdateState(n => n + 1);
      }
    }, DAMAGE_LIFETIME);
    
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (autoHitsPerSec === 0 || isPaused) return;
    
    const intervalMs = 1000 / autoHitsPerSec;
    let lastTime = performance.now();
    let accumulated = 0;
    let animationFrameId: number;

    const tick = (now: number) => {
      if (!isMountedRef.current) return;
      
      const delta = now - lastTime;
      lastTime = now;
      accumulated += delta;

      while (accumulated >= intervalMs) {
        if (!isPaused && isMountedRef.current) {
          const currentTime = Date.now();
          const recentManual = manualClicksRef.current.filter(t => currentTime - t < 1000).length;
          
          if (recentManual + autoHitsPerSec <= MAX_TOTAL) {
            const power = currentClickPower;
            setBalance(prev => roundToTenth(prev + power));
            setTotalEarned(prev => roundToTenth(prev + power));
            playAttackAnimation();
            addFloatingDamage(75, 60, power);
          }
        }
        accumulated -= intervalMs;
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [autoHitsPerSec, currentClickPower, playAttackAnimation, addFloatingDamage, isPaused]);

  const handleManualClick = useCallback((e?: React.MouseEvent) => {
    if (isPaused) return;
    const now = Date.now();
    
    manualClicksRef.current = manualClicksRef.current.filter(t => now - t < 1000);
    
    if (manualClicksRef.current.length >= MAX_MANUAL) return;
    if (manualClicksRef.current.length + autoHitsPerSec >= MAX_TOTAL) return;
    
    manualClicksRef.current.push(now);
    const power = currentClickPower;
    setBalance(prev => roundToTenth(prev + power));
    setTotalEarned(prev => roundToTenth(prev + power));
    playAttackAnimation();
    
    if (e && isMountedRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      addFloatingDamage(x, y, power);
    } else {
      addFloatingDamage(75, 60, power);
    }
  }, [isPaused, autoHitsPerSec, currentClickPower, playAttackAnimation, addFloatingDamage]);

  const getCooldownRemaining = (lastTime: number): number => {
    const elapsed = Date.now() - lastTime;
    return Math.max(0, ACTION_COOLDOWN_MS - elapsed);
  };
  
  const getCooldownText = (lastTime: number): string => {
    const remaining = getCooldownRemaining(lastTime);
    if (remaining <= 0) return "";
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleBurn = useCallback(async (amount: number) => {
    if (!wallet || balance < amount || amount <= 0) return;
    const remaining = getCooldownRemaining(lastBurnTime);
    if (remaining > 0) {
      onError?.(t("actionCooldown", { time: getCooldownText(lastBurnTime) }));
      return;
    }
    
    const prevBalance = balance;
    const prevBurnBonusPercent = burnBonusPercent;
    const prevActionStats = { ...actionStats };
    
    onDbLoading(true);
    try {
      await recordAction(wallet, "burn", amount);
      
      const newBalance = roundToTenth(balance - amount);
      const newBurnBonus = amount >= 50000 ? burnBonusPercent + 10 : burnBonusPercent;
      
      await saveFullProgress(wallet, { 
        totalEarned, 
        balance: newBalance,
        burnBonusPercent: newBurnBonus,
        upgrades: upgradeLevels, 
        skins: skinStates 
      });
      
      if (isMountedRef.current) {
        setBalance(newBalance);
        setBurnBonusPercent(newBurnBonus);
        setActionStats(prev => ({ ...prev, burned: roundToTenth(prev.burned + amount) }));
        setLastBurnTime(Date.now());
      }
    } catch (e: unknown) { 
      onError?.(t("burnFailed"));
      setBalance(prevBalance);
      setBurnBonusPercent(prevBurnBonusPercent);
      setActionStats(prevActionStats);
    } finally { 
      if (isMountedRef.current) onDbLoading(false); 
    }
  }, [balance, wallet, totalEarned, burnBonusPercent, upgradeLevels, skinStates, actionStats, lastBurnTime, t]);

  const handleWithdraw = useCallback(async (amount: number) => {
    if (!wallet || balance < amount || amount <= 0) return;
    if (amount < 50000) { onError?.(t("minWithdraw")); return; }
    const remaining = getCooldownRemaining(lastWithdrawTime);
    if (remaining > 0) {
      onError?.(t("actionCooldown", { time: getCooldownText(lastWithdrawTime) }));
      return;
    }
    
    const prevBalance = balance;
    const prevActionStats = { ...actionStats };
    
    onDbLoading(true);
    try {
      await recordAction(wallet, "withdraw", amount);
      
      const newBalance = roundToTenth(balance - amount);
      
      await saveFullProgress(wallet, { 
        totalEarned, 
        balance: newBalance,
        burnBonusPercent, 
        upgrades: upgradeLevels, 
        skins: skinStates 
      });
      
      if (isMountedRef.current) {
        setBalance(newBalance);
        setActionStats(prev => ({ ...prev, withdrawn: roundToTenth(prev.withdrawn + amount) }));
        setLastWithdrawTime(Date.now());
      }
    } catch (e: unknown) { 
      onError?.(t("withdrawFailed"));
      setBalance(prevBalance);
      setActionStats(prevActionStats);
    } finally { 
      if (isMountedRef.current) onDbLoading(false); 
    }
  }, [balance, wallet, totalEarned, burnBonusPercent, upgradeLevels, skinStates, actionStats, lastWithdrawTime, t]);

  const handleBlock = useCallback(async (amount: number) => {
    if (!wallet || balance < amount || amount <= 0) return;
    const remaining = getCooldownRemaining(lastBlockTime);
    if (remaining > 0) {
      onError?.(t("actionCooldown", { time: getCooldownText(lastBlockTime) }));
      return;
    }
    
    const prevBalance = balance;
    const prevBlockedAmount = blockedAmount;
    const prevActionStats = { ...actionStats };
    
    onDbLoading(true);
    try {
      await recordAction(wallet, "block", amount);
      
      const newBalance = roundToTenth(balance - amount);
      
      await saveFullProgress(wallet, { 
        totalEarned, 
        balance: newBalance,
        burnBonusPercent, 
        upgrades: upgradeLevels, 
        skins: skinStates 
      });
      
      if (isMountedRef.current) {
        setBalance(newBalance);
        setBlockedAmount(prev => prev + amount);
        setActionStats(prev => ({ ...prev, blocked: roundToTenth(prev.blocked + amount) }));
        setLastBlockTime(Date.now());
      }
    } catch (e: unknown) { 
      onError?.(t("blockFailed"));
      setBalance(prevBalance);
      setBlockedAmount(prevBlockedAmount);
      setActionStats(prevActionStats);
    } finally { 
      if (isMountedRef.current) onDbLoading(false); 
    }
  }, [balance, wallet, totalEarned, burnBonusPercent, upgradeLevels, skinStates, actionStats, blockedAmount, lastBlockTime, t]);

  const buyUpgrade = useCallback(async (id: string) => {
    const upgrade = UPGRADES.find(u => u.id === id);
    if (!upgrade) return;
    const currentLevel = upgradeLevels[id] || 0;
    if (currentLevel >= upgrade.maxLevel) return;
    const cost = calculateUpgradeCost(upgrade.baseCost, upgrade.costMultiplier, currentLevel);
    if (balance < cost) return;
    
    const prevBalance = balance;
    const prevUpgradeLevels = { ...upgradeLevels };
    
    const newBalance = roundToTenth(balance - cost);
    setBalance(newBalance);
    setUpgradeLevels(prev => ({ ...prev, [id]: currentLevel + 1 }));
    
    try {
      await recordAction(wallet, "upgrade", cost, { upgradeId: id });
      await saveFullProgress(wallet, { 
        totalEarned, 
        balance: newBalance,
        burnBonusPercent, 
        upgrades: { ...upgradeLevels, [id]: currentLevel + 1 }, 
        skins: skinStates 
      });
    } catch (e) { 
      setBalance(prevBalance);
      setUpgradeLevels(prevUpgradeLevels);
      onError?.(t("upgradePurchaseFailed"));
    }
  }, [balance, upgradeLevels, wallet, totalEarned, burnBonusPercent, skinStates, lang]);

  const buySkin = useCallback(async (id: string) => {
    const skin = SKINS.find(s => s.id === id);
    if (!skin || skinStates[id]?.owned) return;
    const cost = calculateSkinCost(skin.baseCost);
    if (balance < cost) return;
    
    const prevBalance = balance;
    const prevSkinStates = { ...skinStates };
    
    const newBalance = roundToTenth(balance - cost);
    
    const newSkinStates = { 
      ...skinStates, 
      [id]: { owned: true }
    };
    
    setBalance(newBalance);
    setSkinStates(newSkinStates);
    
    try {
      await recordAction(wallet, "skin", cost, { skinId: id });
      await saveFullProgress(wallet, { 
        totalEarned, 
        balance: newBalance,
        burnBonusPercent, 
        upgrades: upgradeLevels, 
        skins: newSkinStates
      });
    } catch (e) { 
      setBalance(prevBalance);
      setSkinStates(prevSkinStates);
      onError?.(t("skinPurchaseFailed"));
    }
  }, [balance, skinStates, wallet, totalEarned, burnBonusPercent, upgradeLevels, lang]);

  const selectSkin = useCallback((id: string) => {
    if (!skinStates[id]?.owned) return;
  }, [skinStates]);

  const togglePause = useCallback((state: boolean) => setIsPaused(state), []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      animationQueueRef.current = [];
    };
  }, []);

  const upgrades = useMemo(() => UPGRADES.map(u => ({ ...u, level: upgradeLevels[u.id] || 0 })), [upgradeLevels]);
  const skins = useMemo(() => SKINS.map(s => ({ 
    ...s, 
    owned: skinStates[s.id]?.owned || s.owned
  })), [skinStates]);

  return {
    balance, 
    totalEarned, 
    currentClickPower, 
    autoHitsPerSec, 
    activeSprite, 
    animationPhase, 
    upgrades, 
    skins,
    floatingDamages: Array.from(floatingDamagesRef.current.values()),
    actionStats, 
    handleManualClick, 
    buyUpgrade, 
    buySkin, 
    selectSkin,
    isPaused, 
    burnBonusPercent, 
    blockedAmount, 
    togglePause, 
    handleBurn, 
    handleWithdraw, 
    handleBlock,
    isOffline,
    lastBurnTime, 
    lastWithdrawTime, 
    lastBlockTime,
    getCooldownRemaining,
    getCooldownText,
  };
}