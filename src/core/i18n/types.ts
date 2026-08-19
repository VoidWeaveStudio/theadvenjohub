// src/core/i18n/types.ts
export type Language =
    | "en"
    | "ru"
    | "zh"
    | "ko"
    | "ja"
    | "es"
    | "it"
    | "vi"
    | "id"
    | "fil"
    | "be";

export type TranslationKey = string;

export type Translations = Record<TranslationKey, string>;

// Helpers that live outside a component take t() as an argument rather than
// reaching for the module-level one, so the active language stays a single source.
export type Translate = (key: string, vars?: Record<string, string | number>) => string;

// Only English has to be complete: every other locale may be filled in over
// time and falls back to English key by key.
export type PartialTranslations = Partial<Translations>;

export type AllTranslations = Record<Language, PartialTranslations> & { en: Translations };

export const LANGUAGES: Language[] = ["en", "ru", "be", "es", "it", "zh", "ja", "ko", "vi", "id", "fil"];
