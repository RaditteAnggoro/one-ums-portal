"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { translate, type Locale } from "../../../../packages/domain/src/i18n";
let currentLocale: Locale = "id";
export const localeTag = () => (currentLocale === "en" ? "en-US" : "id-ID");
export const t = (source: string, values: Record<string, unknown> = {}) =>
  translate(source, currentLocale, values);
const LanguageContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
}>({ locale: "id", setLocale: () => {} });
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setCurrent] = useState<Locale>("id");
  const setLocale = (value: Locale) => {
    currentLocale = value;
    setCurrent(value);
    document.documentElement.lang = value;
    try {
      localStorage.setItem("ums.locale", value);
    } catch {}
  };
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ums.locale");
      if (saved === "en" || saved === "id") setLocale(saved);
    } catch {}
  }, []);
  return (
    <LanguageContext.Provider value={{ locale, setLocale }}>
      {children}
    </LanguageContext.Provider>
  );
}
export const useLanguage = () => useContext(LanguageContext);
