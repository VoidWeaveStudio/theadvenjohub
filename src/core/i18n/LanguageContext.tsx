// src/core/i18n/LanguageContext.tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import {
  Language,
  LANGUAGE_STORAGE_KEY,
  broadcastLanguage,
  getTranslation,
  readStoredLanguage,
  setActiveLanguage,
  setLanguageCookie,
} from "@/core/i18n/index";
import { LANGUAGES } from "@/core/i18n/types";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const SUPPORTED = new Set<string>(LANGUAGES);

function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

export function LanguageProvider({
  initialLanguage = "en",
  children,
}: {
  initialLanguage?: Language;
  children: ReactNode;
}) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  // The world outside React (three.js labels, canvas text) reads the module level
  // language, so it is moved in the same tick as the state. Doing it in an effect
  // instead left every render one language behind, which is how the page and the
  // game ended up showing two different languages at once.
  const applyLanguage = useCallback((next: Language, persist: boolean) => {
    setActiveLanguage(next);
    if (persist) {
      setLanguageCookie(next);
      broadcastLanguage(next);
    }
    setLanguageState(next);
  }, []);

  useEffect(() => {
    const stored = readStoredLanguage();
    const initial = stored ?? initialLanguage;

    setActiveLanguage(initial);
    if (initial !== language) setLanguageState(initial);

    // Nothing stored yet means the server picked this from Accept-Language; write
    // it down so every later render and every other tab agree on it.
    if (!stored) {
      setLanguageCookie(initial);
      broadcastLanguage(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== LANGUAGE_STORAGE_KEY || !event.newValue) return;
      if (!SUPPORTED.has(event.newValue)) return;

      const next = event.newValue as Language;
      if (next === language) return;

      // Another tab made the choice. Follow it without writing the cookie back,
      // so two open tabs cannot keep overwriting each other.
      setActiveLanguage(next);
      setLanguageState(next);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [language]);

  const setLanguage = useCallback(
    (lang: Language) => {
      if (!SUPPORTED.has(lang)) return;
      applyLanguage(lang, true);
    },
    [applyLanguage]
  );

  const t = useMemo(
    () => (key: string, vars?: Record<string, string | number>) => interpolate(getTranslation(key, language), vars),
    [language]
  );

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
