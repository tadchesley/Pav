import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { useAuth } from './AuthContext';

export const lightTheme = {
  mode: 'light' as const,
  background: '#FFFFFF',
  surface: '#F4F4F5',
  surfaceElevated: '#FFFFFF',
  textPrimary: '#09090B',
  textSecondary: '#52525B',
  textTertiary: '#A1A1AA',
  primary: '#09090B',
  primaryFg: '#FAFAFA',
  bullish: '#16A34A',
  bullishBg: 'rgba(22,163,74,0.1)',
  bearish: '#DC2626',
  bearishBg: 'rgba(220,38,38,0.1)',
  neutral: '#6366F1',
  neutralBg: 'rgba(99,102,241,0.1)',
  border: '#E4E4E7',
};

export const darkTheme = {
  mode: 'dark' as const,
  background: '#09090B',
  surface: '#18181B',
  surfaceElevated: '#27272A',
  textPrimary: '#FAFAFA',
  textSecondary: '#A1A1AA',
  textTertiary: '#52525B',
  primary: '#FAFAFA',
  primaryFg: '#09090B',
  bullish: '#22C55E',
  bullishBg: 'rgba(34,197,94,0.15)',
  bearish: '#EF4444',
  bearishBg: 'rgba(239,68,68,0.15)',
  neutral: '#818CF8',
  neutralBg: 'rgba(129,140,248,0.15)',
  border: '#27272A',
};

export type Theme = typeof darkTheme;

type Ctx = {
  theme: Theme;
  mode: 'dark' | 'light';
  toggle: () => void;
};

const ThemeCtx = createContext<Ctx | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [mode, setMode] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem('theme_mode');
      if (stored === 'light' || stored === 'dark') setMode(stored);
      else if (user?.theme) setMode(user.theme);
    })();
  }, [user?.id]);

  const toggle = async () => {
    const next = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    await AsyncStorage.setItem('theme_mode', next);
    if (user) {
      try { await api.put('/auth/theme', { theme: next }); } catch {}
    }
  };

  const theme = mode === 'dark' ? darkTheme : lightTheme;

  return <ThemeCtx.Provider value={{ theme, mode, toggle }}>{children}</ThemeCtx.Provider>;
};

export const useTheme = () => {
  const v = useContext(ThemeCtx);
  if (!v) throw new Error('useTheme needs ThemeProvider');
  return v;
};
