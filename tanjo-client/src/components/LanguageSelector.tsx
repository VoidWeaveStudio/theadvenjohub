//tanjo-client\src\components\LanguageSelector.tsx
import { useI18n, type Language } from '../i18n';

export function LanguageSelector() {
  const { language, setLanguage, t } = useI18n();

  const languages: { code: Language; name: string }[] = [
    { code: 'en', name: t.languages.en },
    { code: 'ru', name: t.languages.ru },
    { code: 'ko', name: t.languages.ko },
    { code: 'zh', name: t.languages.zh },
    { code: 'ja', name: t.languages.ja },
  ];

  return (
    <div className="language-selector">
      <label htmlFor="language-select" className="text-sm text-secondary mb-sm">
        {t.settings.languageSelect}
      </label>
      <select
        id="language-select"
        value={language}
        onChange={(e) => setLanguage(e.target.value as Language)}
        className="btn btn-secondary"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
}