"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

export const themeStorageKey = "piessang_theme";
const validThemes = new Set(["light", "dark", "system"]);
const cookieMaxAge = 60 * 60 * 24 * 365;

function getCookieTheme() {
  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${themeStorageKey}=`));

  const value = cookie?.split("=")[1];
  const decodedValue = value ? decodeURIComponent(value) : undefined;

  return decodedValue && validThemes.has(decodedValue) ? decodedValue : undefined;
}

function getCookieDomains() {
  const hostname = window.location.hostname;

  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return ["localhost", ".localhost"];
  }

  const parts = hostname.split(".");

  if (parts.length >= 2) {
    return [`.${parts.slice(-2).join(".")}`];
  }

  return [];
}

export function persistSharedTheme(theme: string) {
  if (!validThemes.has(theme)) {
    return;
  }

  const encodedTheme = encodeURIComponent(theme);
  const baseCookie = `${themeStorageKey}=${encodedTheme}; path=/; max-age=${cookieMaxAge}; SameSite=Lax`;

  document.cookie = baseCookie;

  for (const domain of getCookieDomains()) {
    document.cookie = `${baseCookie}; domain=${domain}`;
  }
}

export function ThemeCookieSync() {
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    const cookieTheme = getCookieTheme();

    if (cookieTheme && cookieTheme !== theme) {
      setTheme(cookieTheme);
    }
  }, [setTheme, theme]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const cookieTheme = getCookieTheme();

      if (cookieTheme && cookieTheme !== theme) {
        setTheme(cookieTheme);
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [setTheme, theme]);

  return null;
}

export function ThemeCookieBootstrapScript() {
  const script = `
    (function() {
      try {
        var key = ${JSON.stringify(themeStorageKey)};
        var match = document.cookie.match(new RegExp('(?:^|; )' + key + '=([^;]*)'));
        if (!match) return;
        var theme = decodeURIComponent(match[1]);
        if (theme === 'light' || theme === 'dark' || theme === 'system') {
          localStorage.setItem(key, theme);
        }
      } catch (error) {}
    })();
  `;

  return <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: script }} />;
}
