export type ExistingProductVariantIdentity = {
  id: string;
  sku: string;
};

export type SubmittedProductVariantIdentity = {
  persistedVariantId?: string | null;
  sku: string;
};

type ProductVariantIdentityReconciliation =
  | {
      ok: true;
      resolvedVariantIds: Array<string | null>;
      retiredVariantIds: string[];
    }
  | {
      message: string;
      ok: false;
    };

function normalizeSku(sku: string) {
  return sku.trim().toLowerCase();
}

export function reconcileProductVariantIdentities({
  existingVariants,
  fallbackToOnlyExistingVariant = false,
  submittedVariants,
}: {
  existingVariants: readonly ExistingProductVariantIdentity[];
  fallbackToOnlyExistingVariant?: boolean;
  submittedVariants: readonly SubmittedProductVariantIdentity[];
}): ProductVariantIdentityReconciliation {
  const existingById = new Map(
    existingVariants.map((variant) => [variant.id, variant]),
  );
  const existingBySku = new Map(
    existingVariants.map((variant) => [normalizeSku(variant.sku), variant]),
  );
  const claimedVariantIds = new Set<string>();
  const resolvedVariantIds: Array<string | null> = [];

  for (const submittedVariant of submittedVariants) {
    const persistedVariantId = submittedVariant.persistedVariantId ?? null;

    if (persistedVariantId) {
      if (claimedVariantIds.has(persistedVariantId)) {
        return {
          ok: false,
          message: "The same saved variant was submitted more than once.",
        };
      }

      if (!existingById.has(persistedVariantId)) {
        return {
          ok: false,
          message: "One or more saved variants do not belong to this product.",
        };
      }

      claimedVariantIds.add(persistedVariantId);
      resolvedVariantIds.push(persistedVariantId);
      continue;
    }

    const skuMatch = existingBySku.get(normalizeSku(submittedVariant.sku));

    if (skuMatch && !claimedVariantIds.has(skuMatch.id)) {
      claimedVariantIds.add(skuMatch.id);
      resolvedVariantIds.push(skuMatch.id);
      continue;
    }

    const onlyExistingVariant =
      fallbackToOnlyExistingVariant && existingVariants.length === 1
        ? existingVariants[0]
        : null;

    if (
      onlyExistingVariant &&
      !claimedVariantIds.has(onlyExistingVariant.id)
    ) {
      claimedVariantIds.add(onlyExistingVariant.id);
      resolvedVariantIds.push(onlyExistingVariant.id);
      continue;
    }

    resolvedVariantIds.push(null);
  }

  return {
    ok: true,
    resolvedVariantIds,
    retiredVariantIds: existingVariants
      .filter((variant) => !claimedVariantIds.has(variant.id))
      .map((variant) => variant.id),
  };
}
