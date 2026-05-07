//src\features\store\page.tsx
"use client";

import Link from "next/link";
import { useLanguage } from "@/core/i18n/LanguageContext";

export default function StorePage() {
  const { t } = useLanguage();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-16">

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        <div className="group bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden hover:border-red-700/60 transition-all hover:shadow-[0_0_25px_rgba(220,38,38,0.2)]">
          <div className="h-48 bg-gradient-to-br from-zinc-800 to-zinc-900 relative flex items-center justify-center border-b border-zinc-700">
            <span className="text-6xl group-hover:scale-110 transition-transform duration-300 drop-shadow-lg">⚔️</span>
            <div className="absolute top-3 right-3 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-md">
              {t("store.webPlay")}
            </div>
          </div>
          <div className="p-4">
            <h3 className="text-lg font-bold text-zinc-100 mb-1 tracking-wide">
              {t("game.wardenAbyss.title")}
            </h3>
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
              {t("game.wardenAbyss.description")}
            </p>
            <div className="flex gap-2">
              <Link
                href="/games/warden-abyss"
                className="flex-1 bg-red-700 hover:bg-red-600 text-white text-center py-2 rounded text-sm font-medium transition-colors shadow-md"
              >
                {t("actions.play")}
              </Link>
              <button
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-sm transition-colors border border-zinc-600"
                title={t("actions.addToCart")}
              >
                🛒
              </button>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/40 border border-dashed border-zinc-700 rounded-lg p-6 flex flex-col items-center justify-center text-center opacity-70">
          <div className="text-4xl mb-3">🚀</div>
          <h3 className="text-lg font-bold text-zinc-400 mb-2">
            {t("store.comingSoon")}
          </h3>
          <p className="text-xs text-zinc-500 mb-4 max-w-xs">
            {t("store.comingSoonText")}
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mt-12 text-center">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-text-muted px-2">
          <span>
            © {new Date().getFullYear()} VoidWeave Studio. {t("store.footer")}
          </span>
          <span className="hidden sm:inline text-text-muted/30">•</span>
          <Link
            href="/privacy"
            className="hover:text-foreground transition-colors"
          >
            {t("footer.privacy")}
          </Link>
        </div>
      </div>
    </div>
  );
}