export const rememberedEmailCookieName = "piessang_remembered_email";
export const adminSurfaceAccessCookieName = "piessang_admin_access";
export const sellerSurfaceAccessCookieName = "piessang_seller_access";
export const surfaceAccessRememberSeconds = 60 * 60 * 24 * 30;

function getConfiguredRootDomain() {
  const configuredDomain = process.env.DOMAIN?.trim();

  if (configuredDomain) {
    return configuredDomain
      .replace(/^https?:\/\//, "")
      .split("/")[0]
      ?.split(":")[0]
      ?.replace(/^\.+/, "")
      .toLowerCase();
  }

  const configuredUrl = process.env.APP_URL ?? process.env.AUTH_URL;

  if (!configuredUrl) {
    return undefined;
  }

  try {
    return new URL(configuredUrl).hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return undefined;
  }
}

export function getSharedAuthCookieDomain() {
  if (process.env.NODE_ENV !== "production") {
    return "localhost";
  }

  const rootDomain = getConfiguredRootDomain();

  if (!rootDomain || rootDomain === "localhost") {
    return undefined;
  }

  return `.${rootDomain}`;
}
