// src/features/game/ui/hooks/useMobileImmersion.ts
"use client";

import { useEffect, useRef } from "react";

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: string, listener: () => void) => void;
}

export function useMobileImmersion(enabled: boolean, target: React.RefObject<HTMLElement | null>) {
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const acquireWakeLock = async () => {
      const wakeLock = (navigator as unknown as { wakeLock?: { request: (type: string) => Promise<WakeLockSentinelLike> } }).wakeLock;
      if (!wakeLock) return;

      try {
        wakeLockRef.current = await wakeLock.request("screen");
      } catch {
      }
    };

    const enterImmersion = async () => {
      if (requestedRef.current) return;
      requestedRef.current = true;

      const element = target.current;

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
        } catch {
        }
      }

      await acquireWakeLock();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !wakeLockRef.current?.released) {
        acquireWakeLock();
      }
    };

    document.addEventListener("pointerdown", enterImmersion, { once: true, passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("pointerdown", enterImmersion);
      document.removeEventListener("visibilitychange", onVisibility);

      requestedRef.current = false;
      wakeLockRef.current?.release().catch(() => { });
      wakeLockRef.current = null;

      const orientation = screen.orientation as (ScreenOrientation & { unlock?: () => void }) | undefined;
      orientation?.unlock?.();

      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => { });
      }
    };
  }, [enabled, target]);
}
