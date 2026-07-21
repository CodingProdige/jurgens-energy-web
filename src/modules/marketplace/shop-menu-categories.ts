export type ShopMenuCategoryTreeNode<T> = {
  children: T[];
  productCount: number;
};

export function filterPopulatedShopMenuCategories<
  T extends ShopMenuCategoryTreeNode<T>,
>(categories: readonly T[]): T[] {
  return categories.flatMap((category) => {
    const children = filterPopulatedShopMenuCategories(category.children);

    if (category.productCount <= 0 && children.length === 0) {
      return [];
    }

    return [{ ...category, children }];
  });
}

export function findShopMenuCategory<T extends { children: T[] }>(
  categories: readonly T[],
  predicate: (category: T) => boolean,
): T | null {
  for (const category of categories) {
    if (predicate(category)) {
      return category;
    }

    const childMatch = findShopMenuCategory(category.children, predicate);

    if (childMatch) {
      return childMatch;
    }
  }

  return null;
}
