//src\features\privacy\page.tsx
"use client";

import Link from "next/link";
import { useLanguage } from "@/core/i18n/LanguageContext";

export default function PrivacyPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-primary/10 rounded-2xl mb-4 sm:mb-6">
            <svg className="w-6 h-6 sm:w-8 sm:h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 sm:mb-3">{t("privacy.title")}</h1>
          <p className="text-text-secondary text-sm sm:text-base">{t("privacy.subtitle")}</p>
          <p className="text-[10px] sm:text-xs text-text-muted mt-3 sm:mt-4">
            {t("privacy.updated")}: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        <div className="card border-border overflow-hidden">
          <div className="p-4 sm:p-8 space-y-6 sm:space-y-8">

            <section className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-semibold text-xs sm:text-sm">1</span>
                </div>
                <h2 className="text-base sm:text-lg font-semibold text-foreground">{t("privacy.dataCollect")}</h2>
              </div>
              <div className="pl-8 sm:pl-11 space-y-2">
                <p className="text-text-secondary text-xs sm:text-sm leading-relaxed">{t("privacy.dataCollectText")}</p>
                <ul className="space-y-2">
                  {[t("privacy.data1"), t("privacy.data2"), t("privacy.data3")].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-text-secondary">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <div className="h-px bg-border" />

            <section className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-semibold text-xs sm:text-sm">2</span>
                </div>
                <h2 className="text-base sm:text-lg font-semibold text-foreground">{t("privacy.dataUse")}</h2>
              </div>
              <div className="pl-8 sm:pl-11 space-y-2">
                <ul className="space-y-2">
                  {[t("privacy.use1"), t("privacy.use2"), t("privacy.use3")].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-text-secondary">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <div className="h-px bg-border" />

            <section className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-semibold text-xs sm:text-sm">3</span>
                </div>
                <h2 className="text-base sm:text-lg font-semibold text-foreground">{t("privacy.dataStorage")}</h2>
              </div>
              <div className="pl-8 sm:pl-11 space-y-2 sm:space-y-3">
                <div className="flex items-start gap-2 sm:gap-3">
                  <span className="text-primary mt-0.5 sm:mt-1">🔐</span>
                  <p className="text-xs sm:text-sm text-text-secondary">{t("privacy.storage1")}</p>
                </div>
                <div className="flex items-start gap-2 sm:gap-3">
                  <span className="text-primary mt-0.5 sm:mt-1">⛓️</span>
                  <p className="text-xs sm:text-sm text-text-secondary">{t("privacy.storage2")}</p>
                </div>
                <div className="flex items-start gap-2 sm:gap-3">
                  <span className="text-primary mt-0.5 sm:mt-1">🔑</span>
                  <p className="text-xs sm:text-sm text-text-secondary">
                    <strong>{t("privacy.storage3")}</strong>
                  </p>
                </div>
              </div>
            </section>

            <div className="h-px bg-border" />

            <section className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-semibold text-xs sm:text-sm">4</span>
                </div>
                <h2 className="text-base sm:text-lg font-semibold text-foreground">{t("privacy.cookies")}</h2>
              </div>
              <div className="pl-8 sm:pl-11 space-y-2">
                <ul className="space-y-2">
                  {[t("privacy.cookie1"), t("privacy.cookie2"), t("privacy.cookie3")].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-text-secondary">
                      <span className="text-primary mt-0.5">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

          </div>

          <div className="px-4 sm:px-8 py-4 sm:py-6 bg-surface/50 border-t border-border">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div>
                <p className="text-xs sm:text-sm font-medium text-foreground">{t("privacy.questions")}</p>
                <a href="mailto:theadvenjo@gmail.com" className="text-xs sm:text-sm text-primary hover:underline transition-colors break-all">
                  theadvenjo@gmail.com
                </a>
              </div>
              <Link href="/" className="inline-flex items-center gap-2 text-xs sm:text-sm text-text-secondary hover:text-foreground transition-colors">
                <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                {t("privacy.backHome")}
              </Link>
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] sm:text-xs text-text-muted mt-6 sm:mt-8">
          © {new Date().getFullYear()} VoidWeave Studio. All rights reserved.
        </p>
      </div>
    </div>
  );
}