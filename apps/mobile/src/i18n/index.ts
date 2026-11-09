/* eslint-disable import/no-named-as-default-member -- i18n.use()/changeLanguage() are the documented instance API */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en';
import te from './te';

export const APP_LANGUAGES = ['en', 'te'] as const;
export type AppLanguage = (typeof APP_LANGUAGES)[number];
const STORAGE_KEY = 'fm.appLanguage';

function deviceLanguage(): AppLanguage {
  const code = getLocales()[0]?.languageCode;
  return code === 'te' ? 'te' : 'en';
}

export const i18nReady = i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, te: { translation: te } },
  lng: deviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** Loads the saved app language (separate from the AI coach language). */
export async function loadSavedLanguage(): Promise<void> {
  await i18nReady;
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'te') await i18n.changeLanguage(saved);
  } catch {
    // keep the device language
  }
}

export async function setAppLanguage(lang: AppLanguage): Promise<void> {
  await i18n.changeLanguage(lang);
  await AsyncStorage.setItem(STORAGE_KEY, lang).catch(() => {});
}

export default i18n;
