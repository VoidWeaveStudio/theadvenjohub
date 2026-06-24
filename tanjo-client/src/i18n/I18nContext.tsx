//tanjo-client\src\i18n\I18nContext.tsx
import { createContext, useContext, useState, ReactNode } from 'react';
import en from './locales/en';
import ru from './locales/ru';
import ko from './locales/ko';
import zh from './locales/zh';
import ja from './locales/ja';

export type Language = 'en' | 'ru' | 'ko' | 'zh' | 'ja';

const translations = {
  en,
  ru,
  ko,
  zh,
  ja,
};

type Translations = typeof en;

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language') as Language;
    return saved || 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  const t = translations[language];

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}