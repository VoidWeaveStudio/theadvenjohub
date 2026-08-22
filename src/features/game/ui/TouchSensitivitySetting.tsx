// src/features/game/ui/TouchSensitivitySetting.tsx
"use client";

import { useState } from "react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import {
  TOUCH_SENSITIVITY_MAX,
  TOUCH_SENSITIVITY_MIN,
  getTouchSensitivity,
  setTouchSensitivity,
} from "../utils/touchSettings";

export function TouchSensitivitySetting() {
  const { t } = useLanguage();
  const [value, setValue] = useState(() => getTouchSensitivity());

  return (
    <div className="rounded-lg bg-[rgba(255,255,255,0.03)] p-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-[#E5E7EB] font-medium text-[13px]">
          {t("g.settings.touchSensitivity")}
        </span>
        <span className="text-[#4FD1FF] font-bold text-[12px] tabular-nums">
          {value.toFixed(2)}×
        </span>
      </div>

      <input
        type="range"
        min={TOUCH_SENSITIVITY_MIN}
        max={TOUCH_SENSITIVITY_MAX}
        step={0.05}
        value={value}
        onChange={(event) => setValue(setTouchSensitivity(Number.parseFloat(event.target.value)))}
        className="w-full accent-[#4FD1FF] h-11"
      />

      <p className="text-[#6B7280] text-[11px] mt-1">
        {t("g.settings.touchSensitivityHint")}
      </p>
    </div>
  );
}
