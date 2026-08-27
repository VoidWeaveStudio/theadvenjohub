// src/core/i18n/types.ts
export type Language =
    | "en"
    | "ru"
    | "zh"
    | "zh-tw"
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


export type Translate = (key: string, vars?: Record<string, string | number>) => string;


export type PartialTranslations = Partial<Translations>;

export type AllTranslations = Record<Language, PartialTranslations> & { en: Translations };

export const LANGUAGES: Language[] = ["en", "ru", "be", "es", "it", "zh", "zh-tw", "ja", "ko", "vi", "id", "fil"];
