import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { lightColors, darkColors, type ThemeColors, type ThemeMode } from '@/constants/theme';

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  colors: lightColors,
  isDark: false,
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Seed from the saved theme synchronously (web) so the first render already
  // matches. Native has no persistent store here yet, so it boots light.
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('theme');
        if (saved === 'dark' || saved === 'light') return saved;
      } catch {}
    }
    return 'light';
  });
  const toggle = useCallback(() => setMode(prev => prev === 'dark' ? 'light' : 'dark'), []);

  // On web: persist the choice and paint the page background (html/body) to
  // match, so Safari's rubber-band overscroll on the PWA reveals paper, not
  // white, when a screen scrolls past its content.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const bg = mode === 'dark' ? darkColors.bg : lightColors.bg;
    document.documentElement.style.backgroundColor = bg;
    document.body.style.backgroundColor = bg;
    try { localStorage.setItem('theme', mode); } catch {}
  }, [mode]);

  return (
    <ThemeContext.Provider value={{
      mode,
      colors: mode === 'dark' ? darkColors : lightColors,
      isDark: mode === 'dark',
      toggle,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
