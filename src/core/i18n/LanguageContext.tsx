// src\core\i18n\LanguageContext.tsx
"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from "react";
import {
  Language,
  getTranslation,
  getLanguageFromCookie,
  setLanguageCookie
} from "@/core/i18n/index";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const DEFAULT_LANGUAGE: Language = "en";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const savedLang = getLanguageFromCookie();
    if (savedLang) {
      setLanguageState(savedLang);
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    setLanguageCookie(language);
    document.documentElement.lang = language;
  }, [language, isInitialized]);

  const setLanguageHandler = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = useMemo(() => {
    return (key: string) => getTranslation(key, language);
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage: setLanguageHandler, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}