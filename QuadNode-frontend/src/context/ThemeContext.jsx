import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'quadnode-theme';

function resolveTheme(preference) {
  if (preference === 'light' || preference === 'dark') return preference;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return 'dark';
}

function applyTheme(resolved) {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved !== 'light');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'light' ? '#F6F8FB' : '#070A0F');
}

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'dark';
    } catch {
      return 'dark';
    }
  });

  const resolved = resolveTheme(preference);

  useEffect(() => {
    applyTheme(resolved);
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch { /* private mode */ }
  }, [preference, resolved]);

  // Follow OS changes while in "system" mode.
  useEffect(() => {
    if (preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => applyTheme(mq.matches ? 'light' : 'dark');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference]);

  const toggle = useCallback(() => {
    setPreference((p) => (resolveTheme(p) === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, isDark: resolved === 'dark', setPreference, toggle }),
    [preference, resolved, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
