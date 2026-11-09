import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { dark, light, type Palette } from './tokens';

export type ThemeChoice = 'dark' | 'light' | 'system';
const STORAGE_KEY = 'fm.theme';

interface ThemeValue {
  colors: Palette;
  isDark: boolean;
  choice: ThemeChoice;
  setChoice: (c: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeValue>({ colors: dark, isDark: true, choice: 'dark', setChoice: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  // Dark is the default look; "system" follows the phone.
  const [choice, setChoiceState] = useState<ThemeChoice>('dark');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === 'dark' || v === 'light' || v === 'system') setChoiceState(v);
      })
      .catch(() => {});
  }, []);

  const setChoice = useCallback((c: ThemeChoice) => {
    setChoiceState(c);
    AsyncStorage.setItem(STORAGE_KEY, c).catch(() => {});
  }, []);

  const value = useMemo(() => {
    const isDark = choice === 'system' ? system !== 'light' : choice === 'dark';
    return { colors: isDark ? dark : light, isDark, choice, setChoice };
  }, [choice, system, setChoice]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
