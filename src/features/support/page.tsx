//src\features\support\page.tsx
"use client";

import { useLanguage } from "@/core/i18n/LanguageContext";

interface SupportLink {
  label: string;
  url: string;
  icon: string;
  external?: boolean;
  disabled?: boolean;
  note?: string;
}

export default function SupportPage() {
  const { t } = useLanguage();

  const links: SupportLink[] = [
    {
      label: t("support.links.website"),
      url: "https://theadvenjo.online/",
      icon: "🌐",
    },
    {
      label: t("support.links.discord"),
      url: "https://discord.gg/jwnUptd3",
      icon: "💬",
    },
    {
      label: t("support.links.twitter"),
      url: "https://x.com/TheAdvenJo",
      icon: "𝕏",
      external: true,
    },
    {
      label: t("support.links.telegramChat"),
      url: "https://t.me/tanjochat",
      icon: "💬",
    },
    {
      label: t("support.links.telegramChannel"),
      url: "https://t.me/VoidWeaveDev",
      icon: "📢",
    },
    {
      label: t("support.links.youtube"),
      url: "https://www.youtube.com/@VoidWeaveStudio",
      icon: "▶️",
    },
    {
      label: t("support.links.token"),
      url: "https://pump.fun/coin/BTUu1KQ1rhcmtMVGLm7unFbCR4CU6RCwxhTtK2xUpump",
      icon: "🪙",
      external: true,
    },
  ];

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold text-foreground mb-6">{t("support.title")}</h1>

      <div className="card p-6 mb-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("support.contactUs")}</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">{t("support.email")}</label>
            <a
              href="mailto:theadvenjo@gmail.com"
              className="text-primary hover:underline font-mono"
            >
              theadvenjo@gmail.com
            </a>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">{t("support.community")}</h2>

        <div className="space-y-3">
          {links.map((link, index) => (
            <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-xl">{link.icon}</span>
                <span className="text-foreground font-medium">{link.label}</span>
                {link.note && (
                  <span className="text-xs text-text-muted bg-surface px-2 py-0.5 rounded">
                    {link.note}
                  </span>
                )}
              </div>
              {link.disabled ? (
                <span className="text-sm text-text-muted">{t("support.unavailable")}</span>
              ) : (
                <a
                  href={link.url}
                  target={link.external ? "_blank" : "_self"}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  className="text-primary hover:underline text-sm flex items-center gap-1"
                >
                  {t("support.visit")}
                  {link.external && <span className="text-xs">↗</span>}
                </a>
              )}
            </div>
          ))}
        </div>

        <div className="pt-4 mt-4 border-t border-border">
          <h3 className="text-lg font-medium text-foreground mb-3">{t("support.responseTime")}</h3>
          <p className="text-text-secondary">
            {t("support.responseText")}
          </p>
        </div>
      </div>
    </div>
  );
}