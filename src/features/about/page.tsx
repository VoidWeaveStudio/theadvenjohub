//src\features\about\page.tsx
"use client";

import Link from "next/link";
import { useLanguage } from "@/core/i18n/LanguageContext";

export default function AboutPage() {
  const { t } = useLanguage();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="text-center mb-8 sm:mb-12">
        <h1 className="text-2xl sm:text-4xl font-bold text-foreground mb-3 sm:mb-4">{t("about.title")}</h1>
        <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto">
          {t("about.subtitle")}
        </p>
      </div>

      <div className="card p-4 sm:p-8 border-border mb-6 sm:mb-10">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-xl sm:text-2xl">🎮</span>
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-2 sm:mb-3">{t("about.mission")}</h2>
            <p className="text-text-secondary leading-relaxed text-sm sm:text-base">
              {t("about.missionText")}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-12">
        <div className="card p-4 sm:p-6 border-border">
          <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2 sm:mb-3 flex items-center gap-2">
            <span className="text-primary">◆</span> {t("about.featureDevFirst")}
          </h3>
          <p className="text-text-secondary text-sm">
            {t("about.featureDevFirstText")}
          </p>
        </div>

        <div className="card p-4 sm:p-6 border-border">
          <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2 sm:mb-3 flex items-center gap-2">
            <span className="text-primary">◆</span> {t("about.featurePlayerOwnership")}
          </h3>
          <p className="text-text-secondary text-sm">
            {t("about.featurePlayerOwnershipText")}
          </p>
        </div>

        <div className="card p-4 sm:p-6 border-border">
          <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2 sm:mb-3 flex items-center gap-2">
            <span className="text-primary">◆</span> {t("about.featureCommunity")}
          </h3>
          <p className="text-text-secondary text-sm">
            {t("about.featureCommunityText")}
          </p>
        </div>

        <div className="card p-4 sm:p-6 border-border">
          <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2 sm:mb-3 flex items-center gap-2">
            <span className="text-primary">◆</span> {t("about.featureSpeed")}
          </h3>
          <p className="text-text-secondary text-sm">
            {t("about.featureSpeedText")}
          </p>
        </div>
      </div>

      <div className="card p-4 sm:p-8 border-border mb-6 sm:mb-10">
        <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-3 sm:mb-4">{t("about.story")}</h2>
        <div className="space-y-3 sm:space-y-4 text-text-secondary leading-relaxed text-sm sm:text-base">
          <p>{t("about.storyP1")}</p>
          <p>{t("about.storyP2")}</p>
          <p>{t("about.storyP3")}</p>
        </div>
      </div>

      <div className="card p-4 sm:p-8 border-border mb-8 sm:mb-12 bg-primary/5 border-primary/20">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-xl sm:text-2xl">🪙</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-2 sm:mb-3">{t("about.token")}</h2>
            <p className="text-text-secondary leading-relaxed mb-3 sm:mb-4 text-sm sm:text-base">
              {t("about.tokenText")}
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <a
                href="https://pump.fun/coin/BTUu1KQ1rhcmtMVGLm7unFbCR4CU6RCwxhTtK2xUpump"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary px-4 sm:px-5 py-2 text-xs sm:text-sm font-medium inline-flex items-center gap-2 w-full sm:w-auto justify-center"
              >
                <span>{t("about.viewOnPump")}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <code className="text-xs text-text-muted bg-surface px-3 py-2 rounded border border-border break-all w-full sm:w-auto">
                BTUu1KQ1rhcmtMVGLm7unFbCR4CU6RCwxhTtK2xUpump
              </code>
            </div>
            <p className="text-xs text-text-muted mt-3">
              {t("about.verifyWarning")}
            </p>
          </div>
        </div>
      </div>

      <div className="text-center">
        <h3 className="text-lg font-semibold text-foreground mb-3 sm:mb-4">{t("about.joinJourney")}</h3>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
          <Link href="/forum" className="btn-primary px-4 sm:px-6 py-2 sm:py-3 font-medium text-sm sm:text-base">
            {t("about.joinForum")}
          </Link>
          <Link href="/support" className="btn-secondary px-4 sm:px-6 py-2 sm:py-3 font-medium text-sm sm:text-base">
            {t("about.contactUs")}
          </Link>
        </div>
        <p className="text-xs text-text-muted mt-4 sm:mt-6">
          {t("about.footer")} © {new Date().getFullYear()} • {t("about.footerText")}
        </p>
      </div>
    </div>
  );
}