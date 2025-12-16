import { create } from 'zustand';

export type Locale = 'en' | 'ko' | 'ja' | 'zh' | 'ru' | 'es';

type LocaleState = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
};

const storageKey = 'pandora-locale';
const supported: Locale[] = ['ko', 'en', 'ja', 'zh', 'ru', 'es'];

const getInitialLocale = (): Locale => {
  if (typeof window === 'undefined') return 'ko';
  const stored = window.localStorage.getItem(storageKey) as Locale | null;
  if (stored && supported.includes(stored)) return stored;
  const browser = navigator.language.toLowerCase();
  if (browser.startsWith('ko')) return 'ko';
  if (browser.startsWith('ja')) return 'ja';
  if (browser.startsWith('zh')) return 'zh';
  if (browser.startsWith('ru')) return 'ru';
  if (browser.startsWith('es')) return 'es';
  return 'en';
};

export const useLocaleStore = create<LocaleState>((set, get) => ({
  locale: getInitialLocale(),
  setLocale: (locale) => {
    set({ locale });
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, locale);
    }
  },
  toggleLocale: () => {
    const current = get().locale;
    const idx = supported.indexOf(current);
    const next = supported[(idx + 1) % supported.length];
    set({ locale: next });
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, next);
    }
  },
}));
