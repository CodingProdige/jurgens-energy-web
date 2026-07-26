import type { MetadataRoute } from "next";

import { createMarketplaceCanonicalUrl } from "@/src/modules/marketplace/seo";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const privatePaths = [
    "/account",
    "/account/",
    "/admin/",
    "/api/",
    "/forgot-password",
    "/register",
    "/reset-password",
    "/seller/",
    "/sign-in",
    "/whatsapp/resume/",
  ];

  return {
    rules: [
      {
        userAgent: "StoreBot-Google",
        allow: [
          "/",
          "/cart",
          "/checkout",
          "/api/cart/validate",
          "/api/checkout/quotes",
        ],
        disallow: [...privatePaths, "/cart/", "/checkout/"],
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: [...privatePaths, "/cart", "/checkout"],
      },
    ],
    sitemap: createMarketplaceCanonicalUrl("/sitemap.xml"),
  };
}
