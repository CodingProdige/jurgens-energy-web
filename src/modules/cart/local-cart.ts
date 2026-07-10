export type LocalCartPurchaseType = "standard" | "exchange";

export type LocalCartItem = {
  brandName: string | null;
  exchangeAcceptedReturnBrands: string[];
  exchangeConfirmationText: string | null;
  exchangeEmptyConfirmed: boolean;
  exchangeRequiredEmptyCylinderSize: string | null;
  imageUrl: string | null;
  priceLabel: string;
  productId: string;
  purchaseType: LocalCartPurchaseType;
  quantity: number;
  slug: string;
  title: string;
  updatedAt: string;
  variantId: string;
};

export type LocalCartInput = Omit<
  LocalCartItem,
  | "exchangeAcceptedReturnBrands"
  | "exchangeConfirmationText"
  | "exchangeEmptyConfirmed"
  | "exchangeRequiredEmptyCylinderSize"
  | "purchaseType"
  | "quantity"
  | "updatedAt"
> & {
  exchangeAcceptedReturnBrands?: string[];
  exchangeConfirmationText?: string | null;
  exchangeEmptyConfirmed?: boolean;
  exchangeRequiredEmptyCylinderSize?: string | null;
  purchaseType?: LocalCartPurchaseType;
  quantity?: number;
};

export type LocalCartState = {
  count: number;
  items: LocalCartItem[];
};

const localCartStorageKey = "jurgens-energy:cart";
const localCartUpdatedEventName = "jurgens-energy:cart-updated";
const maxCartItemQuantity = 99;

function canUseBrowserStorage() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return Boolean(window.localStorage);
  } catch {
    return false;
  }
}

function normalizeQuantity(value: unknown) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return 1;
  }

  return Math.max(1, Math.min(maxCartItemQuantity, Math.floor(parsedValue)));
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getExchangeConfirmationText({
  emptySize,
  fallbackText,
  quantity,
}: {
  emptySize: string | null;
  fallbackText: string | null;
  quantity: number;
}) {
  if (quantity === 1 && fallbackText) {
    return fallbackText;
  }

  const quantityText =
    quantity === 1
      ? emptySize
        ? `a ${emptySize}`
        : "a compatible"
      : emptySize
        ? `x${quantity} ${emptySize}`
        : `x${quantity} compatible`;
  const cylinderText = quantity === 1 ? "empty cylinder" : "empty cylinders";

  return `I confirm I have ${quantityText} ${cylinderText} in acceptable condition to exchange on delivery.`;
}

function normalizeCartItem(value: unknown): LocalCartItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Partial<LocalCartItem>;

  if (
    typeof item.productId !== "string" ||
    typeof item.variantId !== "string" ||
    typeof item.slug !== "string" ||
    typeof item.title !== "string" ||
    typeof item.priceLabel !== "string"
  ) {
    return null;
  }

  return {
    brandName: typeof item.brandName === "string" ? item.brandName : null,
    exchangeAcceptedReturnBrands: normalizeStringList(
      item.exchangeAcceptedReturnBrands,
    ),
    exchangeConfirmationText: normalizeNullableString(
      item.exchangeConfirmationText,
    ),
    exchangeEmptyConfirmed: Boolean(item.exchangeEmptyConfirmed),
    exchangeRequiredEmptyCylinderSize: normalizeNullableString(
      item.exchangeRequiredEmptyCylinderSize,
    ),
    imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : null,
    priceLabel: item.priceLabel,
    productId: item.productId,
    purchaseType: item.purchaseType === "exchange" ? "exchange" : "standard",
    quantity: normalizeQuantity(item.quantity),
    slug: item.slug,
    title: item.title,
    updatedAt:
      typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString(),
    variantId: item.variantId,
  };
}

export function readLocalCartItems(): LocalCartItem[] {
  if (!canUseBrowserStorage()) {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(localCartStorageKey);

    if (!storedValue) {
      return [];
    }

    const parsedValue: unknown = JSON.parse(storedValue);

    return Array.isArray(parsedValue)
      ? parsedValue
          .map(normalizeCartItem)
          .filter((item): item is LocalCartItem => Boolean(item))
      : [];
  } catch {
    return [];
  }
}

export function getLocalCartState(): LocalCartState {
  const items = readLocalCartItems();

  return {
    count: items.reduce((total, item) => total + item.quantity, 0),
    items,
  };
}

function writeLocalCartItems(items: LocalCartItem[]) {
  if (!canUseBrowserStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(localCartStorageKey, JSON.stringify(items));
  } catch {
    // Storage may be disabled; the UI should remain usable without persistence.
  }
}

function emitLocalCartUpdated() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<LocalCartState>(localCartUpdatedEventName, {
      detail: getLocalCartState(),
    }),
  );
}

export function addLocalCartItem(input: LocalCartInput): LocalCartState {
  const items = readLocalCartItems();
  const existingItemIndex = items.findIndex(
    (item) => item.variantId === input.variantId,
  );
  const nextQuantity = normalizeQuantity(input.quantity);
  const updatedAt = new Date().toISOString();
  const purchaseType: LocalCartPurchaseType =
    input.purchaseType === "exchange" ? "exchange" : "standard";
  const exchangeConfirmationText =
    purchaseType === "exchange"
      ? normalizeNullableString(input.exchangeConfirmationText)
      : null;
  const exchangeRequiredEmptyCylinderSize =
    purchaseType === "exchange"
      ? normalizeNullableString(input.exchangeRequiredEmptyCylinderSize)
      : null;
  const exchangeSnapshot = {
    exchangeAcceptedReturnBrands:
      purchaseType === "exchange"
        ? normalizeStringList(input.exchangeAcceptedReturnBrands)
        : [],
    exchangeConfirmationText,
    exchangeEmptyConfirmed:
      purchaseType === "exchange" ? Boolean(input.exchangeEmptyConfirmed) : false,
    exchangeRequiredEmptyCylinderSize,
    purchaseType,
  };

  if (existingItemIndex >= 0) {
    const existingItem = items[existingItemIndex];
    const combinedQuantity = normalizeQuantity(existingItem.quantity + nextQuantity);
    const combinedEmptySize =
      exchangeRequiredEmptyCylinderSize ??
      existingItem.exchangeRequiredEmptyCylinderSize;

    items[existingItemIndex] = {
      ...existingItem,
      ...exchangeSnapshot,
      exchangeConfirmationText:
        purchaseType === "exchange"
          ? getExchangeConfirmationText({
              emptySize: combinedEmptySize,
              fallbackText:
                exchangeConfirmationText ?? existingItem.exchangeConfirmationText,
              quantity: combinedQuantity,
            })
          : null,
      exchangeRequiredEmptyCylinderSize: combinedEmptySize,
      quantity: combinedQuantity,
      updatedAt,
    };
  } else {
    items.unshift({
      brandName: input.brandName,
      ...exchangeSnapshot,
      exchangeConfirmationText:
        purchaseType === "exchange"
          ? getExchangeConfirmationText({
              emptySize: exchangeRequiredEmptyCylinderSize,
              fallbackText: exchangeConfirmationText,
              quantity: nextQuantity,
            })
          : null,
      imageUrl: input.imageUrl,
      priceLabel: input.priceLabel,
      productId: input.productId,
      quantity: nextQuantity,
      slug: input.slug,
      title: input.title,
      updatedAt,
      variantId: input.variantId,
    });
  }

  writeLocalCartItems(items);
  emitLocalCartUpdated();

  return getLocalCartState();
}

export function subscribeToLocalCart(
  callback: (state: LocalCartState) => void,
) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleCartUpdated = () => callback(getLocalCartState());
  const handleStorage = (event: StorageEvent) => {
    if (event.key === localCartStorageKey) {
      handleCartUpdated();
    }
  };

  window.addEventListener(localCartUpdatedEventName, handleCartUpdated);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(localCartUpdatedEventName, handleCartUpdated);
    window.removeEventListener("storage", handleStorage);
  };
}
