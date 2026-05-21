"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  applySharedTheme,
  getStoredSharedTheme,
  isSharedTheme,
  persistSharedTheme,
  type SharedTheme,
} from "@/components/theme/theme-sync";

type ThemeContextValue = {
  setTheme: (theme: SharedTheme) => void;
  theme: SharedTheme;
};

type ThemeProviderProps = {
  attribute?: string;
  children: ReactNode;
  defaultTheme?: SharedTheme;
  disableTransitionOnChange?: boolean;
  enableSystem?: boolean;
  storageKey?: string;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  defaultTheme = "system",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<SharedTheme>(
    isSharedTheme(defaultTheme) ? defaultTheme : "system",
  );

  useEffect(() => {
    const storedTheme = getStoredSharedTheme() ?? theme;

    setThemeState(storedTheme);
    applySharedTheme(storedTheme);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const storedTheme = getStoredSharedTheme();

      if (storedTheme && storedTheme !== theme) {
        setThemeState(storedTheme);
        applySharedTheme(storedTheme);
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const syncSystemTheme = () => {
      if (theme === "system") {
        applySharedTheme("system");
      }
    };

    mediaQuery.addEventListener("change", syncSystemTheme);

    return () => mediaQuery.removeEventListener("change", syncSystemTheme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme(nextTheme) {
        setThemeState(nextTheme);
        persistSharedTheme(nextTheme);
      },
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function usePiessangTheme() {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error("usePiessangTheme must be used within ThemeProvider.");
  }

  return value;
}
