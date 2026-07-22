import { createContext, useContext, useState, ReactNode } from 'react';
import { translations, Language } from '../i18n/translations';

export type { Language };

// Chaves aceites por t(), geradas a partir do dicionário: "home.title", "common.save", etc.
// — achata as duas camadas (secção.chave) do objeto translations.pt num único tipo união.
type Section = keyof typeof translations.pt;
export type TranslationKey = {
  [S in Section]: `${S}.${Extract<keyof (typeof translations.pt)[S], string>}`
}[Section];

interface LanguageCtx {
  language: Language;
  setLanguage: (l: Language) => void;
  t: (key: TranslationKey) => string;
}

function translate(language: Language, key: TranslationKey): string {
  const [section, field] = key.split('.') as [Section, string];
  const dict = translations[language][section] as Record<string, string>;
  // Cai para a própria chave (nunca undefined) se a tradução faltar — uma entrada em
  // falta fica visível no ecrã como "home.title" em vez de rebentar a página.
  return dict?.[field] ?? key;
}

const Ctx = createContext<LanguageCtx>({
  language: 'pt',
  setLanguage: () => {},
  t: (key) => key,
});

function languageFromStorage(): Language {
  return localStorage.getItem('devship_lang') === 'en' ? 'en' : 'pt';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(languageFromStorage);

  function setLanguage(l: Language) {
    setLanguageState(l);
    localStorage.setItem('devship_lang', l);
  }

  function t(key: TranslationKey): string {
    return translate(language, key);
  }

  return <Ctx.Provider value={{ language, setLanguage, t }}>{children}</Ctx.Provider>;
}

export function useLanguage() { return useContext(Ctx); }
