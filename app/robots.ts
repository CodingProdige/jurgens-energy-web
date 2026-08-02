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
  const publicCheckoutVerificationPaths = [
    "/cart",
    "/cart/",
    "/checkout",
    "/checkout/",
    "/api/cart/validate",
    "/api/checkout/quotes",
    "/api/checkout/orders",
  ];
  const googleVerificationBots = [
    "StoreBot-Google",
    "Googlebot",
    "Googlebot-Image",
    "Googlebot-Video",
    "Google-InspectionTool",
    "AdsBot-Google",
    "AdsBot-Google-Mobile",
  ];

  return {
    rules: [
      ...googleVerificationBots.map((userAgent) => ({
        userAgent,
        allow: ["/", ...publicCheckoutVerificationPaths],
        disallow: privatePaths,
      })),
      {
        userAgent: "*",
        allow: "/",
        disallow: privatePaths,
      },
    ],
    sitemap: createMarketplaceCanonicalUrl("/sitemap.xml"),
  };
}
