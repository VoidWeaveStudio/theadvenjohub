// src/features/game/ui/hooks/useMobileImmersion.ts
"use client";

import { useCallback, useEffect, useRef } from "react";

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: string, listener: () => void) => void;
}

export function canForceLandscape(): boolean {
  if (typeof document === "undefined" || typeof screen === "undefined") return false;
  if (!document.fullscreenEnabled) return false;

  const orientation = screen.orientation as (ScreenOrientation & { lock?: unknown }) | undefined;
  return typeof orientation?.lock === "function";
}

export function useMobileImmersion(enabled: boolean, target: React.RefObject<HTMLElement | null>) {
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const enabledRef = useRef(enabled);

  enabledRef.current = enabled;

  const acquireWakeLock = useCallback(async () => {
    const wakeLock = (navigator as unknown as { wakeLock?: { request: (type: string) => Promise<WakeLockSentinelLike> } }).wakeLock;
    if (!wakeLock) return;

    try {
      wakeLockRef.current = await wakeLock.request("screen");
    } catch {
    }
  }, []);

  const enterImmersion = useCallback(async (): Promise<boolean> => {
    if (!enabledRef.current) return false;

    const element = target.current;
    let locked = false;

    if (element && !document.fullscreenElement) {
      try {
        await element.requestFullscreen({ navigationUI: "hide" });
      } catch {
      }
    }

    const orientation = screen.orientation as (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined;
    if (orientation?.lock) {
      try {
        await orientation.lock("landscape");
        locked = true;
      } catch {
      }
    }

    await acquireWakeLock();

    return locked;
  }, [target, acquireWakeLock]);

  useEffect(() => {
    if (!enabled) return;

    document.documentElement.dataset.gameImmersive = "true";

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !wakeLockRef.current?.released) {
        acquireWakeLock();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      delete document.documentElement.dataset.gameImmersive;
      document.removeEventListener("visibilitychange", onVisibility);

      wakeLockRef.current?.release().catch(() => { });
      wakeLockRef.current = null;

      const orientation = screen.orientation as (ScreenOrientation & { unlock?: () => void }) | undefined;
      orientation?.unlock?.();

      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => { });
      }
    };
  }, [enabled, acquireWakeLock]);

  return enterImmersion;
}
