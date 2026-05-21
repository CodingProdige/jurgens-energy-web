import { asc, count, desc, eq, gt } from "drizzle-orm";

import { db } from "@/src/db";
import {
  brandRequests,
  brands,
  categories,
  media,
  products,
  sellers,
  users,
} from "@/src/db/schema";

export type AdminCategory = {
  children: AdminCategory[];
  commissionRateBps: number | null;
  depth: number;
  description: string | null;
  id: string;
  isLocked: boolean;
  name: string;
  parentId: string | null;
  path: string;
  productCount: number;
  slug: string;
  sortOrder: number;
  status: string;
  createdAt: Date;
};

export type AdminCategoryOption = {
  depth: number;
  id: string;
  label: string;
  path: string;
};

export type AdminBrand = {
  createdAt: Date;
  description: string | null;
  id: string;
  logoMediaId: string | null;
  logoUrl: string | null;
  name: string;
  productCount: number;
  slug: string;
  status: string;
  websiteUrl: string | null;
};

export type AdminBrandRequest = {
  brandId: string | null;
  brandName: string;
  createdAt: Date;
  id: string;
  notes: string | null;
  rejectionReason: string | null;
  requestedByEmail: string | null;
  requestedByName: string | null;
  reviewedAt: Date | null;
  sellerName: string | null;
  slug: string;
  status: string;
  websiteUrl: string | null;
};

function buildCategoryTree(rows: Omit<AdminCategory, "children">[]) {
  const byId = new Map<string, AdminCategory>();
  const roots: AdminCategory[] = [];

  for (const row of rows) {
    byId.set(row.id, { ...row, children: [] });
  }

  for (const category of byId.values()) {
    if (!category.parentId) {
      roots.push(category);
      continue;
    }

    const parent = byId.get(category.parentId);

    if (parent) {
      parent.children.push(category);
    } else {
      roots.push(category);
    }
  }

  const sortCategories = (items: AdminCategory[]) => {
    items.sort((first, second) => {
      if (first.sortOrder !== second.sortOrder) {
        return first.sortOrder - second.sortOrder;
      }

      return first.name.localeCompare(second.name);
    });

    for (const item of items) {
      sortCategories(item.children);
      item.productCount += item.children.reduce(
        (total, child) => total + child.productCount,
        0,
      );
    }
  };

  sortCategories(roots);

  return roots;
}

function flattenCategoryOptions(tree: AdminCategory[]) {
  const options: AdminCategoryOption[] = [];

  function visit(category: AdminCategory) {
    options.push({
      depth: category.depth,
      id: category.id,
      label: `${"-- ".repeat(category.depth)}${category.name}`,
      path: category.path,
    });

    for (const child of category.children) {
      visit(child);
    }
  }

  for (const category of tree) {
    visit(category);
  }

  return options;
}

export async function getAdminCatalogTaxonomy() {
  const rows = await db
    .select({
      commissionRateBps: categories.commissionRateBps,
      depth: categories.depth,
      description: categories.description,
      id: categories.id,
      isLocked: categories.isLocked,
      name: categories.name,
      parentId: categories.parentId,
      path: categories.path,
      createdAt: categories.createdAt,
      slug: categories.slug,
      sortOrder: categories.sortOrder,
      status: categories.status,
    })
    .from(categories)
    .orderBy(asc(categories.path));

  const productRows = await db
    .select({
      categoryId: products.categoryId,
      value: count(),
    })
    .from(products)
    .groupBy(products.categoryId);
  const productCounts = new Map(
    productRows
      .filter((row) => row.categoryId)
      .map((row) => [row.categoryId!, row.value]),
  );
  const rowsWithCounts = rows.map((row) => ({
    ...row,
    productCount: productCounts.get(row.id) ?? 0,
  }));
  const tree = buildCategoryTree(rowsWithCounts);
  const options = flattenCategoryOptions(tree);
  const [brandCount] = await db.select({ value: count() }).from(brands);
  const [rootCount] = await db
    .select({ value: count() })
    .from(categories)
    .where(eq(categories.depth, 0));
  const [subcategoryCount] = await db
    .select({ value: count() })
    .from(categories)
    .where(gt(categories.depth, 0));

  return {
    brandCount: brandCount?.value ?? 0,
    categoryCount: rows.length,
    options,
    rootCategoryCount: rootCount?.value ?? 0,
    subcategoryCount: subcategoryCount?.value ?? 0,
    totalProducts: productRows.reduce((total, row) => total + row.value, 0),
    tree,
  };
}

export async function getAdminBrands() {
  const rows = await db
    .select({
      createdAt: brands.createdAt,
      description: brands.description,
      id: brands.id,
      logoMediaId: brands.logoMediaId,
      logoRelativePath: media.relativePath,
      logoThumbnailRelativePath: media.thumbnailRelativePath,
      name: brands.name,
      slug: brands.slug,
      status: brands.status,
      websiteUrl: brands.websiteUrl,
    })
    .from(brands)
    .leftJoin(media, eq(brands.logoMediaId, media.id))
    .orderBy(asc(brands.name));

  const productRows = await db
    .select({
      brandId: products.brandId,
      value: count(),
    })
    .from(products)
    .groupBy(products.brandId);
  const productCounts = new Map(
    productRows
      .filter((row) => row.brandId)
      .map((row) => [row.brandId!, row.value]),
  );

  const items: AdminBrand[] = rows.map((row) => ({
    ...row,
    logoUrl: row.logoThumbnailRelativePath
      ? `/media/${row.logoThumbnailRelativePath}`
      : row.logoRelativePath
        ? `/media/${row.logoRelativePath}`
        : null,
    productCount: productCounts.get(row.id) ?? 0,
  }));

  return {
    activeBrandCount: items.filter((brand) => brand.status === "active").length,
    brands: items,
    totalBrandCount: items.length,
    totalProducts: productRows.reduce((total, row) => total + row.value, 0),
  };
}

export async function getAdminBrandRequests() {
  const rows = await db
    .select({
      brandId: brandRequests.brandId,
      brandName: brandRequests.brandName,
      createdAt: brandRequests.createdAt,
      id: brandRequests.id,
      notes: brandRequests.notes,
      rejectionReason: brandRequests.rejectionReason,
      requestedByEmail: users.email,
      requestedByName: users.name,
      reviewedAt: brandRequests.reviewedAt,
      sellerName: sellers.displayName,
      slug: brandRequests.slug,
      status: brandRequests.status,
      websiteUrl: brandRequests.websiteUrl,
    })
    .from(brandRequests)
    .leftJoin(sellers, eq(brandRequests.sellerId, sellers.id))
    .leftJoin(users, eq(brandRequests.requestedByUserId, users.id))
    .orderBy(desc(brandRequests.createdAt));

  return {
    approvedCount: rows.filter((request) => request.status === "approved").length,
    pendingCount: rows.filter((request) => request.status === "pending").length,
    rejectedCount: rows.filter((request) => request.status === "rejected").length,
    requests: rows,
    totalCount: rows.length,
  };
}
