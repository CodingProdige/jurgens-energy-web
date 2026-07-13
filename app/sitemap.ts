import type { MetadataRoute } from "next";

import { getPublishedBlogPostSitemapEntries } from "@/src/modules/blog";
import { getMarketplaceSitemapEntries } from "@/src/modules/marketplace/catalog";
import { createMarketplaceCanonicalUrl } from "@/src/modules/marketplace/seo";

export const revalidate = 3600;

type SitemapEntry = MetadataRoute.Sitemap[number];
type SitemapChangeFrequency = NonNullable<SitemapEntry["changeFrequency"]>;

function latestDate(dates: Array<Date | null | undefined>) {
  return dates.reduce<Date | null>((latest, date) => {
    if (!date) {
      return latest;
    }

    return !latest || date.getTime() > latest.getTime() ? date : latest;
  }, null);
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
  const [catalogEntries, blogEntries] = await Promise.all([
    getMarketplaceSitemapEntries(),
    getPublishedBlogPostSitemapEntries(),
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
      lastModified: latestMarketplaceDate,
      path: "/",
      priority: 1,
    }),
    sitemapEntry({
      changeFrequency: "daily",
      lastModified: latestProductDate ?? latestMarketplaceDate,
      path: "/products",
      priority: 0.9,
    }),
    sitemapEntry({
      changeFrequency: "weekly",
      lastModified: latestBlogDate ?? latestMarketplaceDate,
      path: "/blog",
      priority: 0.7,
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
        path: `/categories/${category.slug}`,
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
