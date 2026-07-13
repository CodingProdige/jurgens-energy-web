import type { MetadataRoute } from "next";

import { createMarketplaceCanonicalUrl } from "@/src/modules/marketplace/seo";

export const revalidate = 86400;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      allow: "/",
      disallow: [
        "/account/",
        "/admin/",
        "/api/",
        "/cart",
        "/checkout",
        "/forgot-password",
        "/register",
        "/reset-password",
        "/seller/",
        "/sign-in",
        "/whatsapp/resume/",
      ],
      userAgent: "*",
    },
    sitemap: createMarketplaceCanonicalUrl("/sitemap.xml"),
  };
}
