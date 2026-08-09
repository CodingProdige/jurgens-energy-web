import { z } from "zod";

const MAX_PACKAGES_PER_ORDER = 100;
const MAX_PACKAGE_WEIGHT_GRAMS = 10_000_000;
const MAX_PACKAGE_DIMENSION_MM = 100_000;

export const manualPackingPackageItemInputSchema = z
  .object({
    orderItemId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })
  .strict();

export const manualPackingPackageInputSchema = z
  .object({
    heightMm: z.number().finite().positive().max(MAX_PACKAGE_DIMENSION_MM),
    items: z.array(manualPackingPackageItemInputSchema).min(1).max(1_000),
    lengthMm: z.number().finite().positive().max(MAX_PACKAGE_DIMENSION_MM),
    weightGrams: z
      .number()
      .finite()
      .positive()
      .max(MAX_PACKAGE_WEIGHT_GRAMS),
    widthMm: z.number().finite().positive().max(MAX_PACKAGE_DIMENSION_MM),
  })
  .strict();

export const manualPackingPackagesInputSchema = z
  .array(manualPackingPackageInputSchema)
  .min(1, "Add at least one physical package before confirming the packing plan.")
  .max(MAX_PACKAGES_PER_ORDER);

export type ManualPackingPackageInput = z.infer<
  typeof manualPackingPackageInputSchema
>;

export const manualPackingOrderItemSchema = z
  .object({
    id: z.string().uuid(),
    quantity: z.number().int().positive(),
    sellerId: z.string().uuid().nullable(),
  })
  .strict();

export type ManualPackingOrderItem = z.infer<
  typeof manualPackingOrderItemSchema
>;

export type InspectedManualPackingPackage = ManualPackingPackageInput & {
  packageSequence: number;
  sellerId: string | null;
  totalItemQuantity: number;
};

export type InspectedCourierGuyManualPackingPlan = {
  allocatedItems: Array<{
    allocatedQuantity: number;
    orderItemId: string;
    orderedQuantity: number;
  }>;
  packages: InspectedManualPackingPackage[];
  totalItemQuantity: number;
};

/**
 * Validates only the administrator's explicit physical packing decisions. It
 * deliberately does not infer, combine, or split packages from product data.
 */
export function inspectCourierGuyManualPackingPlan(
  itemsInput: readonly ManualPackingOrderItem[],
  packagesInput: readonly ManualPackingPackageInput[],
): InspectedCourierGuyManualPackingPlan {
  const items = z.array(manualPackingOrderItemSchema).min(1).parse(itemsInput);
  const packages = manualPackingPackagesInputSchema.parse(packagesInput);
  const itemById = new Map<string, ManualPackingOrderItem>();

  for (const item of items) {
    if (itemById.has(item.id)) {
      throw new Error(`Order item ${item.id} appears more than once in the order.`);
    }

    itemById.set(item.id, item);
  }

  const allocatedByItemId = new Map<string, number>();
  const inspectedPackages = packages.map<InspectedManualPackingPackage>(
    (packingPackage, packageIndex) => {
      const seenInPackage = new Set<string>();
      let sellerId: string | null | undefined;
      let totalItemQuantity = 0;

      for (const allocation of packingPackage.items) {
        if (seenInPackage.has(allocation.orderItemId)) {
          throw new Error(
            `Package ${packageIndex + 1} contains order item ${allocation.orderItemId} more than once. Combine it into one quantity.`,
          );
        }

        seenInPackage.add(allocation.orderItemId);
        const orderItem = itemById.get(allocation.orderItemId);

        if (!orderItem) {
          throw new Error(
            `Package ${packageIndex + 1} contains an item that is not part of this Courier Guy order.`,
          );
        }

        if (sellerId === undefined) {
          sellerId = orderItem.sellerId;
        } else if (sellerId !== orderItem.sellerId) {
          throw new Error(
            `Package ${packageIndex + 1} mixes items from different sellers. Create a separate physical package for each seller.`,
          );
        }

        allocatedByItemId.set(
          allocation.orderItemId,
          (allocatedByItemId.get(allocation.orderItemId) ?? 0) +
            allocation.quantity,
        );
        totalItemQuantity += allocation.quantity;
      }

      return {
        ...packingPackage,
        items: packingPackage.items.map((allocation) => ({ ...allocation })),
        packageSequence: packageIndex + 1,
        sellerId: sellerId ?? null,
        totalItemQuantity,
      };
    },
  );

  const allocatedItems = items.map((item) => {
    const allocatedQuantity = allocatedByItemId.get(item.id) ?? 0;

    if (allocatedQuantity !== item.quantity) {
      const difference = allocatedQuantity - item.quantity;

      throw new Error(
        difference < 0
          ? `${Math.abs(difference)} unit${Math.abs(difference) === 1 ? " is" : "s are"} still unpacked for order item ${item.id}.`
          : `Order item ${item.id} is over-allocated by ${difference} unit${difference === 1 ? "" : "s"}.`,
      );
    }

    return {
      allocatedQuantity,
      orderItemId: item.id,
      orderedQuantity: item.quantity,
    };
  });

  return {
    allocatedItems,
    packages: inspectedPackages,
    totalItemQuantity: allocatedItems.reduce(
      (total, item) => total + item.allocatedQuantity,
      0,
    ),
  };
}
