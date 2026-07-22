import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Theme = 'dark' | 'light';

interface ThemeCtx {
  theme: Theme;
  toggleTheme: () => void;
}

const Ctx = createContext<ThemeCtx>({
  theme: 'dark',
  toggleTheme: () => {},
});

function themeFromStorage(): Theme {
  return localStorage.getItem('devship_theme') === 'light' ? 'light' : 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(themeFromStorage);

  // O atributo data-theme no <html> é o que index.css lê para escolher o conjunto de
  // variáveis de cor — sem isto, mudar o state React não teria nenhum efeito visual.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('devship_theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  }

  return <Ctx.Provider value={{ theme, toggleTheme }}>{children}</Ctx.Provider>;
}

export function useTheme() { return useContext(Ctx); }
