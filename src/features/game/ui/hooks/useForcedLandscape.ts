// src/features/game/ui/hooks/useForcedLandscape.ts
"use client";

import { useEffect, useState } from "react";

export function useForcedLandscape(enabled: boolean): boolean {
  const [rotated, setRotated] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setRotated(false);
      return;
    }

    const sync = () => setRotated(window.innerHeight > window.innerWidth);

    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);

    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, [enabled]);

  return rotated;
}
