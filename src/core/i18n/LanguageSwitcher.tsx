// src/core/i18n/LanguageSwitcher.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/core/i18n/LanguageContext";
import { Language, LANGUAGES, languageEnglishNames, languageFlags, languageNames } from "@/core/i18n/index";

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const languages: Language[] = LANGUAGES;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (lang: Language) => {
    setLanguage(lang);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-text-secondary hover:text-foreground hover:bg-surface/50 rounded-md transition-colors"
        aria-label={t("common.changeLanguage")}
      >
        <span>{languageNames[language]}</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-52 max-h-[70vh] overflow-y-auto bg-surface border border-border rounded-lg shadow-lg z-50">
          {languages.map((lang) => (
            <button
              key={lang}
              onClick={() => handleSelect(lang)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${language === lang
                  ? "bg-primary/10 text-primary"
                  : "text-text-secondary hover:text-foreground hover:bg-surface/50"
                }`}
            >
              <span className="w-6 text-center">{languageFlags[lang]}</span>
              <span className="flex flex-col leading-tight">
                <span>{languageNames[lang]}</span>
                {languageEnglishNames[lang] !== languageNames[lang] && (
                  <span className="text-xs text-text-secondary/70">{languageEnglishNames[lang]}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}