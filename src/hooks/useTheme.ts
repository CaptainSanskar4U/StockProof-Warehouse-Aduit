import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'stockproof-theme';
const THEME_COLORS: Record<Theme, string> = {
  light: '#F6F1E7',
  dark: '#1B1815',
};

function readStoredTheme(): Theme {
  try {
    if (localStorage.getItem(STORAGE_KEY) === 'dark') return 'dark';
  } catch {
    // Private mode etc. — fall through to light.
  }
  return 'light';
}

function applyTheme(theme: Theme) {
  const other: Theme = theme === 'dark' ? 'light' : 'dark';
  document.body.classList.remove(`${other}-mode`);
  document.body.classList.add(`${theme}-mode`);
  document.documentElement.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[theme]);
}

/** Inspector Panel theme — starts light, swaps body classes, persists the choice. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    // Respect a forced theme (e.g. landing stays light) if one is already set.
    if (!document.body.dataset.forcedTheme) {
      applyTheme(stored);
    }
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore persistence failures.
    }
    delete document.body.dataset.forcedTheme;
    applyTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Ignore persistence failures.
      }
      delete document.body.dataset.forcedTheme;
      applyTheme(next);
      return next;
    });
  }, []);

  return { theme, setTheme, toggleTheme };
}
