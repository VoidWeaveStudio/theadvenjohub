// src/core/i18n/index.ts
import type { Language, AllTranslations } from "./types";
import { languageFromCookieHeader, normaliseTag, resolveLanguage } from "./detect";
import { en } from "./locales/en";
import { ru } from "./locales/ru";
import { zh } from "./locales/zh";
import { zhTw } from "./locales/zh-tw";
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
  "zh-tw": zhTw,
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
  zh: "简体中文",
  "zh-tw": "繁體中文",
  ja: "日本語",
  ko: "한국어",
  vi: "Tiếng Việt",
  id: "Bahasa Indonesia",
  fil: "Filipino",
};

export const languageEnglishNames: Record<Language, string> = {
  en: "English",
  ru: "Russian",
  be: "Belarusian",
  es: "Spanish",
  it: "Italian",
  zh: "Chinese (Simplified)",
  "zh-tw": "Chinese (Traditional)",
  ja: "Japanese",
  ko: "Korean",
  vi: "Vietnamese",
  id: "Indonesian",
  fil: "Filipino",
};

export const languageFlags: Record<Language, string> = {
  en: "EN",
  ru: "🇷🇺",
  be: "🇧🇾",
  es: "🇪🇸",
  it: "🇮🇹",
  zh: "🇨🇳",
  "zh-tw": "🇹🇼",
  ja: "🇯🇵",
  ko: "🇰🇷",
  vi: "🇻🇳",
  id: "🇮🇩",
  fil: "🇵🇭",
};

export function getTranslation(key: string, lang: Language): string {
  return translations[lang]?.[key] || translations.en[key] || key;
}


export const LANGUAGE_STORAGE_KEY = "language";

/**
 * Only what the user actually chose — the query override or the cookie. The
 * browser preference is deliberately not a fallback here: the server already
 * applies it when there is no cookie, and repeating it on the client let a tab
 * quietly overwrite another tab's choice.
 */
export function readStoredLanguage(): Language | null {
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
  return null;
}

export function setLanguageCookie(lang: Language): void {
  if (typeof document !== "undefined") {
    document.cookie = `language=${lang}; path=/; max-age=31536000; SameSite=Lax`;
  }
}

/** Writing the choice is what other tabs listen for through the storage event. */
export function broadcastLanguage(lang: Language): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // Private mode or blocked storage: the cookie still carries the choice.
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
