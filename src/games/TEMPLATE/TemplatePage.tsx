//src\games\TEMPLATE\TemplatePage.tsx
"use client";

import { useLanguage } from "@/core/i18n/LanguageContext";

export default function TemplatePage() {
  const { t } = useLanguage();
  
  return (
    <div className="game-root">
      <div className="flex items-center justify-center h-full text-foreground">
        <h1 className="text-2xl">{t("template.gameTitle") || "Game Template Loaded"}</h1>
      </div>
    </div>
  );
}