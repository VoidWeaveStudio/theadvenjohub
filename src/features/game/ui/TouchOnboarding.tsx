// src/features/game/ui/TouchOnboarding.tsx
"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/core/i18n/LanguageContext";

const STORAGE_KEY = "tanjo_touch_onboarded";

export function TouchOnboarding({ active }: { active: boolean }) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) return;

    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      return;
    }

    setVisible(true);
  }, [active]);

  if (!visible) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
    }
    setVisible(false);
  };

  const hints: [string, string][] = [
    ["◕", t("g.touch.onboardMove")],
    ["↔", t("g.touch.onboardLook")],
    ["🔥", t("g.touch.onboardAction")],
    ["✦", t("g.touch.onboardMenu")],
  ];

  return (
    <div className="absolute inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto font-oxanium">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[rgba(13,17,23,0.98)] p-5">
        <h2 className="text-lg font-black text-[#E5E7EB] mb-4">{t("g.touch.onboardTitle")}</h2>

        <ul className="space-y-3 mb-5">
          {hints.map(([icon, text]) => (
            <li key={text} className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full border border-white/25 bg-black/40 flex items-center justify-center text-lg text-white/85 flex-shrink-0">
                {icon}
              </span>
              <span className="text-[#C5C9D1] text-sm">{text}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={dismiss}
          className="w-full min-h-[48px] rounded-xl bg-[#4FD1FF] text-[#0A0E14] font-black transition-colors"
        >
          {t("g.touch.onboardGot")}
        </button>
      </div>
    </div>
  );
}
