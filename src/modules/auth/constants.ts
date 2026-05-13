export const rememberedEmailCookieName = "piessang_remembered_email";
export const adminSurfaceAccessCookieName = "piessang_admin_access";
export const sellerSurfaceAccessCookieName = "piessang_seller_access";
export const surfaceAccessRememberSeconds = 60 * 60 * 24 * 30;

export function getSharedAuthCookieDomain() {
  if (process.env.NODE_ENV === "production") {
    return undefined;
  }

  return "localhost";
}
