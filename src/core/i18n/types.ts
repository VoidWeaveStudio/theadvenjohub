//src\core\i18n\types.ts
export type Language = "en" | "ru" | "zh" | "ko" | "ja";

export type TranslationKey = string;

export type Translations = Record<TranslationKey, string>;

export type AllTranslations = Record<Language, Translations>;