import { and, asc, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { brandRequests, brands, categories } from "@/src/db/schema";
import { getScopedMediaLibrary } from "@/src/modules/media/admin";
import { getPrimarySellerForUser } from "@/src/modules/sellers/dashboard";

export type SellerProductCategory = {
  commissionRateBps: number | null;
  depth: number;
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  slug: string;
};

export type SellerProductBrand = {
  id: string;
  name: string;
};

export type SellerProductBrandRequest = {
  id: string;
  name: string;
  status: "pending";
};

export type SellerCreateProductData = {
  brandRequests: SellerProductBrandRequest[];
  brands: SellerProductBrand[];
  categories: SellerProductCategory[];
  mediaLibrary: Awaited<ReturnType<typeof getScopedMediaLibrary>>;
  seller: {
    displayName: string;
    id: string;
  } | null;
};

export async function getSellerCreateProductData(
  userId: string,
): Promise<SellerCreateProductData> {
  const seller = await getPrimarySellerForUser(userId);
  const [categoryRows, brandRows, brandRequestRows, mediaLibrary] = await Promise.all([
    db
      .select({
        commissionRateBps: categories.commissionRateBps,
        depth: categories.depth,
        id: categories.id,
        name: categories.name,
        parentId: categories.parentId,
        path: categories.path,
        slug: categories.slug,
      })
      .from(categories)
      .where(eq(categories.status, "active"))
      .orderBy(asc(categories.path)),
    db
      .select({
        id: brands.id,
        name: brands.name,
      })
      .from(brands)
      .where(eq(brands.status, "active"))
      .orderBy(asc(brands.name)),
    seller
      ? db
          .select({
            id: brandRequests.id,
            name: brandRequests.brandName,
            status: brandRequests.status,
          })
          .from(brandRequests)
          .where(
            and(
              eq(brandRequests.sellerId, seller.id),
              eq(brandRequests.status, "pending"),
            ),
          )
          .orderBy(asc(brandRequests.brandName))
      : Promise.resolve([]),
    getScopedMediaLibrary({
      ownerUserId: userId,
      surface: "seller",
    }),
  ]);

  return {
    brandRequests: brandRequestRows.map((request) => ({
      id: request.id,
      name: request.name,
      status: "pending",
    })),
    brands: brandRows,
    categories: categoryRows,
    mediaLibrary,
    seller: seller
      ? {
          displayName: seller.displayName,
          id: seller.id,
        }
      : null,
  };
}
