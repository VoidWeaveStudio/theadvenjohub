//src\core\i18n\index.ts
import type { Language, AllTranslations } from "./types";
import { en } from "./locales/en";
import { ru } from "./locales/ru";
import { zh } from "./locales/zh";
import { ko } from "./locales/ko";
import { ja } from "./locales/ja";
export { LanguageSwitcher } from "./LanguageSwitcher";
export type { Language, Translations } from "./types";

export const translations: AllTranslations = {
  en,
  ru,
  zh,
  ko,
  ja,
};

export const languageNames: Record<Language, string> = {
  en: "English",
  ru: "Русский",
  zh: "中文",
  ko: "한국어",
  ja: "日本語",
};

export const languageFlags: Record<Language, string> = {
  en: "🇬",
  ru: "🇷🇺",
  zh: "🇨🇳",
  ko: "🇰🇷",
  ja: "🇯🇵",
};

export function getTranslation(key: string, lang: Language): string {
  return translations[lang]?.[key] || translations.en[key] || key;
}

export function getLanguageFromCookie(): Language {
  if (typeof document !== "undefined") {
    const match = document.cookie.match(/language=([^;]+)/);
    if (match && translations[match[1] as Language]) {
      return match[1] as Language;
    }
  }
  if (typeof navigator !== "undefined") {
    const browserLang = navigator.language.split("-")[0] as Language;
    if (translations[browserLang]) return browserLang;
  }
  return "en";
}

export function setLanguageCookie(lang: Language): void {
  if (typeof document !== "undefined") {
    document.cookie = `language=${lang}; path=/; max-age=31536000; SameSite=Lax`;
  }
}

export function getLanguageFromHeaders(cookieHeader?: string | null): Language {
  if (!cookieHeader) return "en";
  const match = cookieHeader.match(/language=([^;]+)/);
  if (match && translations[match[1] as Language]) {
    return match[1] as Language;
  }
  return "en";
}