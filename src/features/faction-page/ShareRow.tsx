// src/features/faction-page/ShareRow.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Link2, Send, Share2 } from "lucide-react";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface ShareRowProps {
  url: string;
  shareText: string;
}

export function ShareRow({ url, shareText }: ShareRowProps) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      const field = document.createElement("textarea");
      field.value = url;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      try {
        document.execCommand("copy");
        setCopied(true);
      } finally {
        document.body.removeChild(field);
      }
    }
  }, [url]);

  const nativeShare = useCallback(async () => {
    try {
      await navigator.share({ title: shareText, text: shareText, url });
    } catch {
      await copy();
    }
  }, [copy, shareText, url]);

  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(shareText);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={copy}
        className="h-10 px-4 inline-flex items-center gap-2 text-sm rounded-lg border border-border bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] transition-colors"
        aria-live="polite"
      >
        {copied ? <Check className="w-4 h-4 text-[var(--success)]" /> : <Link2 className="w-4 h-4" />}
        <span className="whitespace-nowrap">{copied ? t("faction.share.copied") : t("faction.share.copyLink")}</span>
      </button>

      <a
        href={`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-border bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] transition-colors"
        aria-label={t("faction.share.onX")}
        title={t("faction.share.onX")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4 h-4 fill-current">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </a>

      <a
        href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`}
        target="_blank"
        rel="noopener noreferrer"
        className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-border bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] transition-colors"
        aria-label={t("faction.share.onTelegram")}
        title={t("faction.share.onTelegram")}
      >
        <Send className="w-4 h-4" />
      </a>

      {canShare && (
        <button
          type="button"
          onClick={nativeShare}
          className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-border bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] transition-colors sm:hidden"
          aria-label={t("faction.share.more")}
          title={t("faction.share.more")}
        >
          <Share2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
