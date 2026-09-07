// src/core/i18n/server.ts
import { headers } from "next/headers";
import { getTranslation } from "@/core/i18n";
import { resolveLanguage } from "@/core/i18n/detect";
import type { Language, Translate } from "@/core/i18n/types";

export async function serverLanguage(): Promise<Language> {
  const headerList = await headers();
  return resolveLanguage({
    override: headerList.get("x-language"),
    cookie: headerList.get("cookie"),
    acceptLanguage: headerList.get("accept-language"),
  });
}

export function translatorFor(language: Language): Translate {
  return (key, vars) => {
    const text = getTranslation(key, language);
    if (!vars) return text;
    return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
  };
}

export async function serverTranslator(): Promise<{ language: Language; t: Translate }> {
  const language = await serverLanguage();
  return { language, t: translatorFor(language) };
}
