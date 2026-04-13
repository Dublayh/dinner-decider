import React, { createContext, useContext, useState, useCallback } from 'react';
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
  const [mode, setMode] = useState<ThemeMode>('light');
  const toggle = useCallback(() => setMode(prev => prev === 'dark' ? 'light' : 'dark'), []);

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
