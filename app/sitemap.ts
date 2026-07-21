import type { MetadataRoute } from "next";

import { getPublishedBlogPostSitemapEntries } from "@/src/modules/blog";
import { getMarketplaceSitemapEntries } from "@/src/modules/marketplace/catalog";
import { POLICY_EFFECTIVE_DATE_ISO } from "@/src/modules/marketplace/policies/constants";
import { createMarketplaceCanonicalUrl } from "@/src/modules/marketplace/seo";
import {
  getStaticPageSeoUpdatedAtMap,
  type StaticSeoPageKey,
} from "@/src/modules/marketplace/static-page-seo";

export const dynamic = "force-dynamic";

type SitemapEntry = MetadataRoute.Sitemap[number];
type SitemapChangeFrequency = NonNullable<SitemapEntry["changeFrequency"]>;
const policyEffectiveDate = new Date(
  `${POLICY_EFFECTIVE_DATE_ISO}T00:00:00+02:00`,
);
// Keep this aligned with edits to the static About, Contact, FAQ, or Safety copy.
const contentPageLastModified = new Date("2026-07-20T00:00:00+02:00");

function latestDate(dates: Array<Date | null | undefined>) {
  return dates.reduce<Date | null>((latest, date) => {
    if (!date) {
      return latest;
    }

    return !latest || date.getTime() > latest.getTime() ? date : latest;
  }, null);
}

function staticPageLastModified(
  key: StaticSeoPageKey,
  fallback: Date,
  updates: Partial<Record<StaticSeoPageKey, Date>>,
) {
  return latestDate([fallback, updates[key]]) ?? fallback;
}

function sitemapEntry({
  changeFrequency,
  lastModified,
  path,
  priority,
}: {
  changeFrequency: SitemapChangeFrequency;
  lastModified: Date;
  path: string;
  priority: number;
}): SitemapEntry {
  return {
    changeFrequency,
    lastModified,
    priority,
    url: createMarketplaceCanonicalUrl(path),
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [catalogEntries, blogEntries, staticSeoUpdatedAt] = await Promise.all([
    getMarketplaceSitemapEntries(),
    getPublishedBlogPostSitemapEntries(),
    getStaticPageSeoUpdatedAtMap(),
  ]);
  const now = new Date();
  const latestProductDate = latestDate(
    catalogEntries.products.map((entry) => entry.updatedAt),
  );
  const latestCategoryDate = latestDate(
    catalogEntries.categories.map((entry) => entry.updatedAt),
  );
  const latestBrandDate = latestDate(
    catalogEntries.brands.map((entry) => entry.updatedAt),
  );
  const latestBlogDate = latestDate(blogEntries.map((entry) => entry.updatedAt));
  const latestMarketplaceDate =
    latestDate([
      latestProductDate,
      latestCategoryDate,
      latestBrandDate,
      latestBlogDate,
    ]) ?? now;

  return [
    sitemapEntry({
      changeFrequency: "weekly",
      lastModified: staticPageLastModified(
        "home",
        latestMarketplaceDate,
        staticSeoUpdatedAt,
      ),
      path: "/",
      priority: 1,
    }),
    sitemapEntry({
      changeFrequency: "daily",
      lastModified: staticPageLastModified(
        "products",
        latestProductDate ?? latestMarketplaceDate,
        staticSeoUpdatedAt,
      ),
      path: "/products",
      priority: 0.9,
    }),
    sitemapEntry({
      changeFrequency: "weekly",
      lastModified: staticPageLastModified(
        "blog",
        latestBlogDate ?? latestMarketplaceDate,
        staticSeoUpdatedAt,
      ),
      path: "/blog",
      priority: 0.7,
    }),
    sitemapEntry({
      changeFrequency: "weekly",
      lastModified: staticPageLastModified(
        "brands",
        latestBrandDate ?? latestMarketplaceDate,
        staticSeoUpdatedAt,
      ),
      path: "/brands",
      priority: 0.7,
    }),
    sitemapEntry({
      changeFrequency: "monthly",
      lastModified: staticPageLastModified(
        "lpg-delivery",
        contentPageLastModified,
        staticSeoUpdatedAt,
      ),
      path: "/lpg-delivery",
      priority: 0.8,
    }),
    sitemapEntry({
      changeFrequency: "monthly",
      lastModified: staticPageLastModified(
        "about",
        contentPageLastModified,
        staticSeoUpdatedAt,
      ),
      path: "/about",
      priority: 0.6,
    }),
    sitemapEntry({
      changeFrequency: "monthly",
      lastModified: staticPageLastModified(
        "contact",
        contentPageLastModified,
        staticSeoUpdatedAt,
      ),
      path: "/contact",
      priority: 0.6,
    }),
    sitemapEntry({
      changeFrequency: "monthly",
      lastModified: staticPageLastModified(
        "faq",
        contentPageLastModified,
        staticSeoUpdatedAt,
      ),
      path: "/faq",
      priority: 0.6,
    }),
    sitemapEntry({
      changeFrequency: "monthly",
      lastModified: staticPageLastModified(
        "lpg-safety",
        contentPageLastModified,
        staticSeoUpdatedAt,
      ),
      path: "/lpg-safety",
      priority: 0.6,
    }),
    sitemapEntry({
      changeFrequency: "yearly",
      lastModified: staticPageLastModified(
        "privacy-policy",
        policyEffectiveDate,
        staticSeoUpdatedAt,
      ),
      path: "/privacy-policy",
      priority: 0.4,
    }),
    sitemapEntry({
      changeFrequency: "yearly",
      lastModified: staticPageLastModified(
        "terms-and-conditions",
        policyEffectiveDate,
        staticSeoUpdatedAt,
      ),
      path: "/terms-and-conditions",
      priority: 0.4,
    }),
    sitemapEntry({
      changeFrequency: "yearly",
      lastModified: staticPageLastModified(
        "returns-and-refunds",
        policyEffectiveDate,
        staticSeoUpdatedAt,
      ),
      path: "/returns-and-refunds",
      priority: 0.4,
    }),
    sitemapEntry({
      changeFrequency: "yearly",
      lastModified: staticPageLastModified(
        "delivery-information",
        policyEffectiveDate,
        staticSeoUpdatedAt,
      ),
      path: "/delivery-information",
      priority: 0.4,
    }),
    ...catalogEntries.products.map((product) =>
      sitemapEntry({
        changeFrequency: "weekly",
        lastModified: product.updatedAt,
        path: `/products/${product.slug}`,
        priority: 0.8,
      }),
    ),
    ...catalogEntries.categories.map((category) =>
      sitemapEntry({
        changeFrequency: "weekly",
        lastModified: category.updatedAt,
        path: `/categories/${category.path}`,
        priority: 0.7,
      }),
    ),
    ...catalogEntries.brands.map((brand) =>
      sitemapEntry({
        changeFrequency: "weekly",
        lastModified: brand.updatedAt,
        path: `/brands/${brand.slug}`,
        priority: 0.6,
      }),
    ),
    ...blogEntries.map((post) =>
      sitemapEntry({
        changeFrequency: "monthly",
        lastModified: post.updatedAt,
        path: `/blog/${post.slug}`,
        priority: 0.6,
      }),
    ),
  ];
}
