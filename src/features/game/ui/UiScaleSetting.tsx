// src/features/game/ui/UiScaleSetting.tsx
"use client";

import { useState } from "react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { UI_SCALE_MAX, UI_SCALE_MIN, getUiScale, setUiScale } from "../utils/uiScale";

export function UiScaleSetting() {
  const { t } = useLanguage();
  const [value, setValue] = useState(() => getUiScale());

  return (
    <div className="rounded-lg bg-[rgba(255,255,255,0.03)] p-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-[#E5E7EB] font-medium text-[13px]">
          {t("g.settings.uiScale")}
        </span>
        <span className="text-[#4FD1FF] font-bold text-[12px] tabular-nums">
          {Math.round(value * 100)}%
        </span>
      </div>

      <input
        type="range"
        min={UI_SCALE_MIN}
        max={UI_SCALE_MAX}
        step={0.05}
        value={value}
        onChange={(event) => setValue(setUiScale(Number.parseFloat(event.target.value)))}
        className="w-full accent-[#4FD1FF] h-11"
      />

      <p className="text-[#6B7280] text-[11px] mt-1">
        {t("g.settings.uiScaleHint")}
      </p>
    </div>
  );
}
