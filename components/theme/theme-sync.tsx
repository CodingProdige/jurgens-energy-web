"use client";

export const themeStorageKey = "piessang_theme";

export type SharedTheme = "light" | "dark" | "system";

const validThemes = new Set<SharedTheme>(["light", "dark", "system"]);
const cookieMaxAge = 60 * 60 * 24 * 365;

export function isSharedTheme(value: unknown): value is SharedTheme {
  return typeof value === "string" && validThemes.has(value as SharedTheme);
}

function getResolvedTheme(theme: SharedTheme) {
  if (theme !== "system") {
    return theme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applySharedTheme(theme: SharedTheme) {
  const resolvedTheme = getResolvedTheme(theme);
  const root = document.documentElement;

  root.classList.remove("light", "dark");
  root.classList.add(resolvedTheme);
  root.style.colorScheme = resolvedTheme;
}

function getCookieTheme() {
  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${themeStorageKey}=`));

  const value = cookie?.split("=")[1];
  const decodedValue = value ? decodeURIComponent(value) : undefined;

  return isSharedTheme(decodedValue) ? decodedValue : undefined;
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

export function getStoredSharedTheme() {
  const storedTheme = window.localStorage.getItem(themeStorageKey);

  if (isSharedTheme(storedTheme)) {
    return storedTheme;
  }

  return getCookieTheme();
}

export function persistSharedTheme(theme: SharedTheme) {
  window.localStorage.setItem(themeStorageKey, theme);
  applySharedTheme(theme);

  const encodedTheme = encodeURIComponent(theme);
  const baseCookie = `${themeStorageKey}=${encodedTheme}; path=/; max-age=${cookieMaxAge}; SameSite=Lax`;

  document.cookie = baseCookie;

  for (const domain of getCookieDomains()) {
    document.cookie = `${baseCookie}; domain=${domain}`;
  }
}
