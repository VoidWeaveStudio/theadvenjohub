// src/features/game/ui/TouchLandscapeGate.tsx
"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { canForceLandscape } from "./hooks/useMobileImmersion";

const STORAGE_KEY = "tanjo_touch_rotate_hint";

interface TouchLandscapeGateProps {
  active: boolean;
  onEnterImmersion: () => Promise<boolean>;
}

export function TouchLandscapeGate({ active, onEnterImmersion }: TouchLandscapeGateProps) {
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState(true);
  const [canRotate, setCanRotate] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
    }

    setDismissed(seen);
    setCanRotate(canForceLandscape());
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
    }
    setDismissed(true);
  };

  if (!active || dismissed) return null;

  return (
    <div className="absolute inset-0 z-[400] bg-[#05070B]/95 flex items-center justify-center p-6 pointer-events-auto font-oxanium">
      <div className="w-full max-w-xs text-center">
        <div className="text-6xl mb-6">📱</div>

        <h2 className="text-xl font-black text-[#E5E7EB] mb-2">
          {t("g.touch.rotateTitle")}
        </h2>

        <p className="text-[#8B8F98] text-sm mb-6">
          {t("g.touch.rotateHint")}
        </p>

        {canRotate && (
          <button
            type="button"
            onClick={() => void onEnterImmersion()}
            className="w-full min-h-[48px] mb-3 rounded-xl border border-white/25 bg-transparent text-[#C5C9D1] font-black transition-colors"
          >
            {t("g.touch.rotateAction")}
          </button>
        )}

        <button
          type="button"
          onClick={dismiss}
          className="w-full min-h-[48px] rounded-xl bg-[#4FD1FF] text-[#0A0E14] font-black transition-colors"
        >
          {t("g.touch.onboardGot")}
        </button>
      </div>
    </div>
  );
}
