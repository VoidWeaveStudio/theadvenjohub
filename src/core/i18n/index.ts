// src/core/i18n/index.ts
import type { Language, AllTranslations } from "./types";
import { languageFromCookieHeader, normaliseTag, resolveLanguage } from "./detect";
import { en } from "./locales/en";
import { ru } from "./locales/ru";
import { zh } from "./locales/zh";
import { ko } from "./locales/ko";
import { ja } from "./locales/ja";
import { es } from "./locales/es";
import { it } from "./locales/it";
import { vi } from "./locales/vi";
import { id } from "./locales/id";
import { fil } from "./locales/fil";
import { be } from "./locales/be";

export { LanguageSwitcher } from "./LanguageSwitcher";
export { normaliseTag, resolveLanguage } from "./detect";
export { LANGUAGES } from "./types";
export type { Language, Translations, Translate } from "./types";

export const translations: AllTranslations = {
  en,
  ru,
  zh,
  ko,
  ja,
  es,
  it,
  vi,
  id,
  fil,
  be,
};

export const languageNames: Record<Language, string> = {
  en: "English",
  ru: "Русский",
  be: "Беларуская",
  es: "Español",
  it: "Italiano",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
  vi: "Tiếng Việt",
  id: "Bahasa Indonesia",
  fil: "Filipino",
};

export const languageFlags: Record<Language, string> = {
  en: "EN",
  ru: "🇷🇺",
  be: "🇧🇾",
  es: "🇪🇸",
  it: "🇮🇹",
  zh: "🇨🇳",
  ja: "🇯🇵",
  ko: "🇰🇷",
  vi: "🇻🇳",
  id: "🇮🇩",
  fil: "🇵🇭",
};

export function getTranslation(key: string, lang: Language): string {
  return translations[lang]?.[key] || translations.en[key] || key;
}


export function getLanguageFromCookie(): Language {
  if (typeof window !== "undefined") {
    const override = new URLSearchParams(window.location.search).get("lang");
    if (override) {
      const resolved = normaliseTag(override);
      if (resolved) return resolved;
    }
  }
  if (typeof document !== "undefined") {
    const stored = languageFromCookieHeader(document.cookie);
    if (stored) return stored;
  }
  if (typeof navigator !== "undefined") {
    for (const tag of navigator.languages ?? [navigator.language]) {
      const resolved = normaliseTag(tag);
      if (resolved) return resolved;
    }
  }
  return "en";
}

export function setLanguageCookie(lang: Language): void {
  if (typeof document !== "undefined") {
    document.cookie = `language=${lang}; path=/; max-age=31536000; SameSite=Lax`;
  }
}

export function getLanguageFromHeaders(cookieHeader?: string | null, acceptLanguage?: string | null): Language {
  return resolveLanguage({ cookie: cookieHeader, acceptLanguage });
}


let activeLanguage: Language = "en";
const listeners = new Set<(lang: Language) => void>();

export function getActiveLanguage(): Language {
  return activeLanguage;
}

export function setActiveLanguage(lang: Language): void {
  if (activeLanguage === lang) return;
  activeLanguage = lang;
  for (const listener of listeners) listener(lang);
}

export function onLanguageChange(listener: (lang: Language) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const text = getTranslation(key, activeLanguage);
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}
