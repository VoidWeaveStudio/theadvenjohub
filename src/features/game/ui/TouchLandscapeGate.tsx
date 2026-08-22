// src/features/game/ui/TouchLandscapeGate.tsx
"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface TouchLandscapeGateProps {
  active: boolean;
  onEnterImmersion: () => void | Promise<void>;
}

export function TouchLandscapeGate({ active, onEnterImmersion }: TouchLandscapeGateProps) {
  const { t } = useLanguage();
  const [portrait, setPortrait] = useState(false);

  useEffect(() => {
    if (!active) {
      setPortrait(false);
      return;
    }

    const sync = () => setPortrait(window.innerHeight > window.innerWidth);

    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);

    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, [active]);

  if (!active || !portrait) return null;

  return (
    <div className="absolute inset-0 z-[400] bg-[#05070B] flex items-center justify-center p-6 pointer-events-auto font-oxanium">
      <div className="w-full max-w-xs text-center">
        <div className="text-6xl mb-6 animate-pulse">📱</div>

        <h2 className="text-xl font-black text-[#E5E7EB] mb-2">
          {t("g.touch.rotateTitle")}
        </h2>

        <p className="text-[#8B8F98] text-sm mb-6">
          {t("g.touch.rotateHint")}
        </p>

        <button
          type="button"
          onClick={() => void onEnterImmersion()}
          className="w-full min-h-[48px] rounded-xl bg-[#4FD1FF] text-[#0A0E14] font-black transition-colors"
        >
          {t("g.touch.rotateAction")}
        </button>
      </div>
    </div>
  );
}
