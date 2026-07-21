"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AlertCircleIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HomeIcon,
  LoaderCircleIcon,
  LockKeyholeIcon,
  MapPinIcon,
  PackageCheckIcon,
  ReceiptTextIcon,
  TruckIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CountryPhoneInput } from "@/components/phone/country-phone-input";
import { MarketplaceProductFulfillmentBadge } from "@/components/marketplace/product-fulfillment-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  getLocalCartSelectedVariantIds,
  readLocalCartItems,
  type LocalCartItem,
} from "@/src/modules/cart";
import type {
  CartValidationResponse,
  ValidatedCartItem,
} from "@/src/modules/cart/contracts";
import {
  trackGoogleEvent,
  type GoogleAnalyticsItem,
} from "@/src/modules/analytics/google";
import type {
  CheckoutAddressBookIntent,
  CheckoutAddressPrefill,
  CheckoutDeliveryAddress,
  CheckoutDeliverySchedule,
  CheckoutQuoteResponse,
  CheckoutSavedAddress,
} from "@/src/modules/checkout/contracts";
import {
  CHECKOUT_STEPS,
  getCheapestCheckoutShippingOption,
  isCheckoutAddressStepReady,
  isCheckoutShippingStepReady,
  type CheckoutStep,
} from "@/src/modules/checkout/flow";
import { SOUTH_AFRICAN_PROVINCES } from "@/src/modules/marketplace/account/address-options";
import { POLICY_EFFECTIVE_DATE_ISO } from "@/src/modules/marketplace/policies/constants";
import {
  defaultPhoneCountryCode,
  getPhoneInputParts,
  normalizePhoneNumber,
  type PhoneCountryCode,
} from "@/src/modules/phone";

type CustomerFields = {
  email: string;
  name: string;
  phone: string;
};

const emptyAddress: CheckoutDeliveryAddress = {
  addressLine1: "",
  addressLine2: "",
  city: "",
  countryCode: "ZA",
  postalCode: "",
  province: "",
  suburb: "",
};

const fieldClass =
  "h-11 rounded-md border-[#d8d8d1] bg-white px-3 text-sm shadow-none focus-visible:border-[#ff5a1f] focus-visible:ring-[#ff5a1f]/15 dark:border-white/12 dark:bg-white/[0.04]";
const differentAddressValue = "__different_address__";
const checkoutStepLabels: Record<CheckoutStep, string> = {
  address: "Address",
  payment: "Payment",
  shipping: "Shipping",
};

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-red-500">
      *
    </span>
  );
}

function toValidationItems(items: LocalCartItem[]) {
  return items.map((item) => ({
    purchaseType: item.purchaseType,
    quantity: item.quantity,
    variantId: item.variantId,
  }));
}

function formatZar(value: number) {
  return new Intl.NumberFormat("en-ZA", {
    currency: "ZAR",
    style: "currency",
  }).format(value);
}

function getShippingChargeLabel(groupKey: string) {
  if (groupKey === "jurgens") {
    return "Jurgens Energy shipping";
  }

  if (groupKey === "courier") {
    return "Bob Go courier shipping";
  }

  return "Shipping";
}

function formatPreferredDeliveryDate(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "long",
    timeZone: "Africa/Johannesburg",
  }).format(new Date(`${value}T12:00:00+02:00`));
}

function isAddressComplete(address: CheckoutDeliveryAddress) {
  return (
    address.addressLine1.trim().length >= 2 &&
    address.city.trim().length >= 2 &&
    address.postalCode.trim().length >= 2 &&
    address.province.trim().length >= 2 &&
    address.countryCode.trim().length === 2
  );
}

function normalizeDeliveryAddress(
  address: CheckoutDeliveryAddress,
): CheckoutDeliveryAddress {
  return {
    addressLine1: address.addressLine1.trim(),
    addressLine2: address.addressLine2.trim(),
    city: address.city.trim(),
    countryCode: address.countryCode.trim().toUpperCase(),
    postalCode: address.postalCode.trim().toUpperCase().replace(/\s+/g, ""),
    province: address.province.trim(),
    suburb: address.suburb.trim(),
  };
}

function toDeliveryAddress(
  source: CheckoutAddressPrefill,
): CheckoutDeliveryAddress {
  return {
    addressLine1: source.addressLine1,
    addressLine2: source.addressLine2,
    city: source.city,
    countryCode: source.countryCode,
    postalCode: source.postalCode,
    province: source.province,
    suburb: source.suburb,
  };
}

function isSavedAddressUnchanged({
  address,
  customer,
  normalizedPhone,
  savedAddress,
}: {
  address: CheckoutDeliveryAddress;
  customer: CustomerFields;
  normalizedPhone: string | null;
  savedAddress: CheckoutSavedAddress;
}) {
  return (
    customer.name.trim() === savedAddress.recipientName.trim() &&
    normalizedPhone === savedAddress.recipientPhone &&
    address.addressLine1.trim() === savedAddress.addressLine1.trim() &&
    address.addressLine2.trim() === savedAddress.addressLine2.trim() &&
    address.suburb.trim() === savedAddress.suburb.trim() &&
    address.city.trim() === savedAddress.city.trim() &&
    address.province.trim() === savedAddress.province.trim() &&
    address.postalCode.trim() === savedAddress.postalCode.trim() &&
    address.countryCode.trim().toUpperCase() ===
      savedAddress.countryCode.trim().toUpperCase()
  );
}

function abortCheckoutRequest(controller: AbortController | null) {
  if (!controller || controller.signal.aborted) {
    return;
  }

  controller.abort(new DOMException("Checkout refresh cancelled.", "AbortError"));
}

function toGoogleAnalyticsItem(
  item: ValidatedCartItem,
): GoogleAnalyticsItem {
  const variant = [
    item.variantTitle,
    item.purchaseType === "exchange" ? "Exchange" : "Full/new",
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    affiliation: item.sellerName ?? "Jurgens Energy",
    ...(item.brandName ? { item_brand: item.brandName } : {}),
    item_id: item.variantId,
    item_name: item.productTitle,
    ...(variant ? { item_variant: variant } : {}),
    price: item.unitPriceZar,
    quantity: item.quantity,
  };
}

function createCartAnalyticsPayload(items: ValidatedCartItem[]) {
  const analyticsItems = items.map(toGoogleAnalyticsItem);
  const signature = JSON.stringify(
    [...analyticsItems].sort((left, right) =>
      left.item_id.localeCompare(right.item_id),
    ),
  );

  return {
    items: analyticsItems,
    signature,
    value: Number(
      items
        .reduce((total, item) => total + item.lineTotalZar, 0)
        .toFixed(2),
    ),
  };
}

export function CheckoutExperience({
  initialAddresses,
  initialCustomer,
  initialFallbackAddress,
  isSignedIn,
}: {
  initialAddresses: CheckoutSavedAddress[];
  initialCustomer: { email: string; name: string; phone: string };
  initialFallbackAddress: CheckoutAddressPrefill | null;
  isSignedIn: boolean;
}) {
  const initialSavedAddress =
    initialAddresses.find((candidate) => candidate.isDefault) ??
    initialAddresses[0] ??
    null;
  const initialDeliveryDetails = initialSavedAddress ?? initialFallbackAddress;
  const initialPhone = getPhoneInputParts(
    initialSavedAddress?.recipientPhone ||
      initialCustomer.phone ||
      initialFallbackAddress?.recipientPhone ||
      "",
    defaultPhoneCountryCode,
  );
  const [cartItems, setCartItems] = useState<LocalCartItem[]>([]);
  const [cart, setCart] = useState<CartValidationResponse | null>(null);
  const [customer, setCustomer] = useState<CustomerFields>({
    email: initialCustomer.email,
    name: initialDeliveryDetails?.recipientName || initialCustomer.name,
    phone: initialPhone.nationalNumber,
  });
  const [phoneCountryCode, setPhoneCountryCode] =
    useState<PhoneCountryCode>(initialPhone.countryCode);
  const [address, setAddress] = useState<CheckoutDeliveryAddress>(
    initialDeliveryDetails
      ? toDeliveryAddress(initialDeliveryDetails)
      : emptyAddress,
  );
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<
    string | null
  >(initialSavedAddress?.id ?? null);
  const [saveAddressToBook, setSaveAddressToBook] = useState(false);
  const [addressLabel, setAddressLabel] = useState(
    initialSavedAddress?.label ?? "Home",
  );
  const [makeDefaultAddress, setMakeDefaultAddress] = useState(
    initialSavedAddress?.isDefault ?? initialAddresses.length === 0,
  );
  const [useBusinessBilling, setUseBusinessBilling] = useState(false);
  const [billingBusinessName, setBillingBusinessName] = useState("");
  const [billingVatNumber, setBillingVatNumber] = useState("");
  const [billingSameAsDelivery, setBillingSameAsDelivery] = useState(true);
  const [billingAddress, setBillingAddress] =
    useState<CheckoutDeliveryAddress>(emptyAddress);
  const [quotes, setQuotes] = useState<CheckoutQuoteResponse | null>(null);
  const [selectedQuoteByGroup, setSelectedQuoteByGroup] = useState<
    Record<string, string>
  >({});
  const [jurgensDeliverySchedule, setJurgensDeliverySchedule] =
    useState<CheckoutDeliverySchedule | null>(null);
  const [isLoadingCart, setIsLoadingCart] = useState(true);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [hasAcceptedPolicies, setHasAcceptedPolicies] = useState(true);
  const [checkoutStep, setCheckoutStep] =
    useState<CheckoutStep>("address");
  const [furthestCheckoutStep, setFurthestCheckoutStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const stepPanelRef = useRef<HTMLDivElement | null>(null);
  const cartAbortControllerRef = useRef<AbortController | null>(null);
  const quoteAbortControllerRef = useRef<AbortController | null>(null);
  const quoteRequestIdRef = useRef(0);
  const quotesRef = useRef<CheckoutQuoteResponse | null>(null);
  const jurgensDeliveryScheduleRef =
    useRef<CheckoutDeliverySchedule | null>(null);
  const trackedBeginCheckoutSignaturesRef = useRef(new Set<string>());
  const trackedShippingInfoSignaturesRef = useRef(new Set<string>());
  const trackedPaymentInfoSignaturesRef = useRef(new Set<string>());

  useEffect(() => {
    const allItems = readLocalCartItems();
    const selectedVariantIds = new Set(
      getLocalCartSelectedVariantIds(allItems),
    );
    const selectedItems = allItems.filter((item) =>
      selectedVariantIds.has(item.variantId),
    );
    setCartItems(selectedItems);

    if (selectedItems.length === 0) {
      setIsLoadingCart(false);
      return;
    }

    const abortController = new AbortController();
    cartAbortControllerRef.current = abortController;

    void fetch("/api/cart/validate", {
      body: JSON.stringify({ items: toValidationItems(selectedItems) }),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Cart validation failed.");
        }

        return (await response.json()) as CartValidationResponse;
      })
      .then((result) => setCart(result))
      .catch((caughtError) => {
        if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
          return;
        }

        setError("Your cart could not be refreshed. Return to the cart and try again.");
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setIsLoadingCart(false);
        }
      });

    return () => abortCheckoutRequest(abortController);
  }, []);

  useEffect(
    () => () => {
      abortCheckoutRequest(cartAbortControllerRef.current);
      abortCheckoutRequest(quoteAbortControllerRef.current);
    },
    [],
  );

  useEffect(() => {
    stepPanelRef.current?.focus();
  }, [checkoutStep]);

  useEffect(() => {
    quotesRef.current = quotes;
    jurgensDeliveryScheduleRef.current = jurgensDeliverySchedule;
  }, [jurgensDeliverySchedule, quotes]);

  const checkoutItems = useMemo(() => toValidationItems(cartItems), [cartItems]);
  const requestedQuantityByVariantId = useMemo(
    () => new Map(cartItems.map((item) => [item.variantId, item.quantity])),
    [cartItems],
  );
  const cartReviewRequired = Boolean(
    cart &&
      (cart.invalidVariantIds.length > 0 ||
        cart.items.length !== cartItems.length ||
        cart.items.some((item) => !item.checkoutEligible) ||
        cart.items.some(
          (item) => requestedQuantityByVariantId.get(item.variantId) !== item.quantity,
        )),
  );
  const quoteRequestBody = useMemo(() => {
    if (
      !cart ||
      isLoadingCart ||
      cartReviewRequired ||
      checkoutItems.length === 0 ||
      !isAddressComplete(address)
    ) {
      return null;
    }

    return JSON.stringify({
      deliveryAddress: normalizeDeliveryAddress(address),
      items: checkoutItems,
    });
  }, [address, cart, cartReviewRequired, checkoutItems, isLoadingCart]);
  const checkoutAnalytics = useMemo(() => {
    if (!cart || cartReviewRequired || cart.items.length === 0) {
      return null;
    }

    return createCartAnalyticsPayload(cart.items);
  }, [cart, cartReviewRequired]);
  const selectedShippingOptions = useMemo(() => {
    if (!quotes || quotes.groups.length === 0) {
      return null;
    }

    const selections = [];

    for (const group of quotes.groups) {
      const selectedQuoteId = selectedQuoteByGroup[group.groupKey];
      const option = group.options.find(
        (candidate) => candidate.quoteId === selectedQuoteId,
      );

      if (!option) {
        return null;
      }

      selections.push({
        amountZar: option.amountZar,
        deliveryInformation: option.deliveryInformation,
        displayLabel: getShippingChargeLabel(group.groupKey),
        groupKey: group.groupKey,
        label: option.label,
        provider: option.provider,
        serviceLevel: option.serviceLevel,
      });
    }

    return selections;
  }, [quotes, selectedQuoteByGroup]);
  const shippingAnalytics = useMemo(() => {
    if (!checkoutAnalytics || !selectedShippingOptions) {
      return null;
    }

    const selections = [...selectedShippingOptions].sort((left, right) =>
      left.groupKey.localeCompare(right.groupKey),
    );

    return {
      signature: JSON.stringify({
        cart: checkoutAnalytics.signature,
        selections,
      }),
      tier: selections.map((selection) => selection.label).join(" + "),
    };
  }, [checkoutAnalytics, selectedShippingOptions]);
  const shippingTotal =
    quotes?.groups.reduce((total, group) => {
      const selectedQuoteId = selectedQuoteByGroup[group.groupKey];
      const option = group.options.find((item) => item.quoteId === selectedQuoteId);

      return total + (option?.amountZar ?? 0);
    }, 0) ?? 0;
  const subtotal = cart?.subtotalZar ?? 0;
  const grandTotal = subtotal + shippingTotal;
  const selectedProductCount =
    cart?.items.reduce((total, item) => total + item.quantity, 0) ?? 0;
  const checkoutStepIndex = CHECKOUT_STEPS.indexOf(checkoutStep);
  const allGroupsAvailable = Boolean(
    quotes &&
      quotes.groups.length > 0 &&
      selectedShippingOptions?.length === quotes.groups.length,
  );
  const jurgensFulfilledProductCount =
    cart?.items.filter(
      (item) => item.fulfillmentMode === "piessang_fulfilled",
    ).length ?? 0;
  const hasJurgensFulfilledProducts = jurgensFulfilledProductCount > 0;
  const jurgensSchedulingGroup =
    quotes?.groups.find(
      (group) =>
        group.groupKey === "jurgens" &&
        group.scheduling &&
        Boolean(selectedQuoteByGroup[group.groupKey]),
    ) ?? null;
  const jurgensScheduleOptions =
    jurgensSchedulingGroup?.scheduling?.options ?? [];
  const jurgensSchedulePolicyChangeAt =
    jurgensSchedulingGroup?.scheduling?.nextPolicyChangeAt ?? null;
  const selectedJurgensScheduleOption = jurgensDeliverySchedule
    ? jurgensScheduleOptions.find(
        (option) => option.date === jurgensDeliverySchedule.date,
      )
    : null;
  const jurgensScheduleIsValid =
    !jurgensDeliverySchedule || Boolean(selectedJurgensScheduleOption);
  const normalizedCustomerPhone = normalizePhoneNumber(customer.phone, {
    defaultCountryCode: phoneCountryCode,
  });
  const selectedSavedAddress = useMemo(
    () =>
      initialAddresses.find(
        (candidate) => candidate.id === selectedSavedAddressId,
      ) ?? null,
    [initialAddresses, selectedSavedAddressId],
  );
  const selectedSavedAddressUnchanged = Boolean(
    selectedSavedAddress &&
      isSavedAddressUnchanged({
        address,
        customer,
        normalizedPhone: normalizedCustomerPhone,
        savedAddress: selectedSavedAddress,
      }),
  );
  let addressBookIntent: CheckoutAddressBookIntent = { kind: "none" };

  if (selectedSavedAddress && selectedSavedAddressUnchanged) {
    addressBookIntent = {
      addressId: selectedSavedAddress.id,
      kind: "use_saved",
    };
  } else if (saveAddressToBook && selectedSavedAddress) {
    addressBookIntent = {
      addressId: selectedSavedAddress.id,
      isDefault: makeDefaultAddress,
      kind: "update_existing",
      label: addressLabel,
    };
  } else if (saveAddressToBook) {
    addressBookIntent = {
      isDefault: makeDefaultAddress,
      kind: "save_new",
      label: addressLabel,
    };
  }

  const addressBookChoiceComplete =
    (addressBookIntent.kind !== "save_new" &&
      addressBookIntent.kind !== "update_existing") ||
    addressBookIntent.label.trim().length > 0;
  const customerComplete = Boolean(
    customer.name.trim().length >= 2 &&
      customer.email.includes("@") &&
      normalizedCustomerPhone,
  );
  const normalizedBillingVatNumber = billingVatNumber.replace(/\s+/g, "");
  const billingVatNumberValid =
    !normalizedBillingVatNumber || /^\d{10}$/.test(normalizedBillingVatNumber);
  const billingComplete = Boolean(
    !useBusinessBilling ||
      (billingBusinessName.trim().length >= 2 &&
        billingVatNumberValid &&
        (billingSameAsDelivery || isAddressComplete(billingAddress))),
  );
  const addressStepReady = isCheckoutAddressStepReady({
    addressBookChoiceComplete,
    addressComplete: isAddressComplete(address),
    customerComplete,
  });
  const shippingStepReady = isCheckoutShippingStepReady({
    allGroupsAvailable,
    hasQuoteError: Boolean(quoteError),
    isLoadingQuotes,
    scheduleValid: jurgensScheduleIsValid,
  });
  const canCreateOrder =
    shippingStepReady &&
    addressStepReady &&
    billingComplete &&
    hasAcceptedPolicies &&
    !cartReviewRequired &&
    !isLoadingQuotes &&
    !quoteError &&
    !isCreatingOrder;

  useEffect(() => {
    if (!checkoutAnalytics || isLoadingCart || cartReviewRequired) {
      return;
    }

    if (
      trackedBeginCheckoutSignaturesRef.current.has(
        checkoutAnalytics.signature,
      )
    ) {
      return;
    }

    trackedBeginCheckoutSignaturesRef.current.add(checkoutAnalytics.signature);
    trackGoogleEvent("begin_checkout", {
      currency: "ZAR",
      items: checkoutAnalytics.items,
      value: checkoutAnalytics.value,
    });
  }, [cartReviewRequired, checkoutAnalytics, isLoadingCart]);

  useEffect(() => {
    if (
      !checkoutAnalytics ||
      !shippingAnalytics ||
      !allGroupsAvailable ||
      isLoadingQuotes ||
      quoteError
    ) {
      return;
    }

    if (
      trackedShippingInfoSignaturesRef.current.has(
        shippingAnalytics.signature,
      )
    ) {
      return;
    }

    trackedShippingInfoSignaturesRef.current.add(shippingAnalytics.signature);
    trackGoogleEvent("add_shipping_info", {
      currency: "ZAR",
      items: checkoutAnalytics.items,
      shipping_tier: shippingAnalytics.tier,
      value: checkoutAnalytics.value,
    });
  }, [
    allGroupsAvailable,
    checkoutAnalytics,
    isLoadingQuotes,
    quoteError,
    shippingAnalytics,
  ]);

  function resetDeliverySelection() {
    quoteRequestIdRef.current += 1;
    abortCheckoutRequest(quoteAbortControllerRef.current);
    quoteAbortControllerRef.current = null;
    quotesRef.current = null;
    jurgensDeliveryScheduleRef.current = null;
    setIsLoadingQuotes(false);
    setQuoteError(null);
    setQuotes(null);
    setSelectedQuoteByGroup({});
    setJurgensDeliverySchedule(null);
  }

  function invalidateDeliverySelection() {
    resetDeliverySelection();
    setCheckoutStep("address");
    setFurthestCheckoutStep(0);
    setStepError(null);
  }

  function updateAddress(
    field: keyof CheckoutDeliveryAddress,
    value: string,
  ) {
    setAddress((current) => ({ ...current, [field]: value }));
    invalidateDeliverySelection();
  }

  function updateBillingAddress(
    field: keyof CheckoutDeliveryAddress,
    value: string,
  ) {
    setBillingAddress((current) => ({ ...current, [field]: value }));
  }

  function selectSavedAddress(savedAddress: CheckoutSavedAddress) {
    const phone = getPhoneInputParts(
      savedAddress.recipientPhone,
      phoneCountryCode,
    );

    setSelectedSavedAddressId(savedAddress.id);
    setAddress(toDeliveryAddress(savedAddress));
    setCustomer((current) => ({
      ...current,
      name: savedAddress.recipientName,
      phone: phone.nationalNumber,
    }));
    setPhoneCountryCode(phone.countryCode);
    setSaveAddressToBook(false);
    setAddressLabel(savedAddress.label);
    setMakeDefaultAddress(savedAddress.isDefault);
    invalidateDeliverySelection();
  }

  function selectDifferentAddress() {
    setSelectedSavedAddressId(null);
    setAddress(emptyAddress);
    setSaveAddressToBook(false);
    setAddressLabel("Home");
    setMakeDefaultAddress(initialAddresses.length === 0);
    invalidateDeliverySelection();
  }

  const requestDeliveryQuotes = useCallback(async ({
    preserveSelections = false,
  }: {
    preserveSelections?: boolean;
  } = {}) => {
    if (!quoteRequestBody) {
      return false;
    }

    const requestId = quoteRequestIdRef.current + 1;
    quoteRequestIdRef.current = requestId;
    const previousSchedule = jurgensDeliveryScheduleRef.current;

    abortCheckoutRequest(quoteAbortControllerRef.current);
    const abortController = new AbortController();
    quoteAbortControllerRef.current = abortController;
    setIsLoadingQuotes(true);
    setQuoteError(null);

    if (!preserveSelections) {
      quotesRef.current = null;
      jurgensDeliveryScheduleRef.current = null;
      setQuotes(null);
      setSelectedQuoteByGroup({});
      setJurgensDeliverySchedule(null);
    }

    try {
      const response = await fetch("/api/checkout/quotes", {
        body: quoteRequestBody,
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: abortController.signal,
      });
      const payload = (await response.json()) as CheckoutQuoteResponse & {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(payload.message ?? "Delivery rates could not be calculated.");
      }

      if (
        abortController.signal.aborted ||
        requestId !== quoteRequestIdRef.current
      ) {
        return false;
      }

      const nextSelections = Object.fromEntries(
        payload.groups.flatMap((group) => {
          const automaticOption = getCheapestCheckoutShippingOption(
            group.options,
          );

          return automaticOption
            ? [[group.groupKey, automaticOption.quoteId]]
            : [];
        }),
      );
      const nextSchedule =
        preserveSelections &&
        previousSchedule &&
        payload.groups
          .find((group) => group.groupKey === "jurgens")
          ?.scheduling?.options.some(
            (option) => option.date === previousSchedule.date,
          )
          ? previousSchedule
          : null;

      quotesRef.current = payload;
      jurgensDeliveryScheduleRef.current = nextSchedule;
      setQuotes(payload);
      setSelectedQuoteByGroup(nextSelections);
      setJurgensDeliverySchedule(nextSchedule);
      return true;
    } catch (caughtError) {
      if (
        abortController.signal.aborted ||
        requestId !== quoteRequestIdRef.current
      ) {
        return false;
      }

      quotesRef.current = null;
      jurgensDeliveryScheduleRef.current = null;
      setQuotes(null);
      setSelectedQuoteByGroup({});
      setJurgensDeliverySchedule(null);
      setQuoteError(
        caughtError instanceof Error
          ? caughtError.message
          : "Delivery rates could not be calculated.",
      );
      setCheckoutStep("shipping");
      setFurthestCheckoutStep(1);
      return false;
    } finally {
      if (
        !abortController.signal.aborted &&
        requestId === quoteRequestIdRef.current
      ) {
        quoteAbortControllerRef.current = null;
        setIsLoadingQuotes(false);
      }
    }
  }, [quoteRequestBody]);

  async function continueToShipping() {
    setError(null);

    if (!addressStepReady) {
      setStepError(
        "Complete the required contact and delivery address fields before continuing.",
      );
      return;
    }

    setStepError(null);
    setCheckoutStep("shipping");
    setFurthestCheckoutStep((current) => Math.max(current, 1));

    await requestDeliveryQuotes({
      preserveSelections: Boolean(quotesRef.current),
    });
  }

  function continueToPayment() {
    if (!shippingStepReady) {
      return;
    }

    setStepError(null);
    setError(null);
    setCheckoutStep("payment");
    setFurthestCheckoutStep(2);
  }

  function visitCheckoutStep(step: CheckoutStep) {
    const stepIndex = CHECKOUT_STEPS.indexOf(step);

    if (stepIndex > furthestCheckoutStep) {
      return;
    }

    if (step !== "address" && !addressStepReady) {
      return;
    }

    if (step === "payment" && !shippingStepReady) {
      return;
    }

    setStepError(null);
    setError(null);
    setCheckoutStep(step);
  }

  useEffect(() => {
    if (
      checkoutStep === "address" ||
      !quoteRequestBody ||
      !quotes?.expiresAt
    ) {
      return;
    }

    const expiresAt = Date.parse(quotes.expiresAt);

    if (!Number.isFinite(expiresAt)) {
      return;
    }

    const timeoutId = window.setTimeout(
      () => void requestDeliveryQuotes({ preserveSelections: true }),
      Math.max(0, expiresAt - Date.now() - 30_000),
    );

    return () => window.clearTimeout(timeoutId);
  }, [
    checkoutStep,
    quoteRequestBody,
    quotes?.expiresAt,
    requestDeliveryQuotes,
  ]);

  useEffect(() => {
    if (
      checkoutStep === "address" ||
      !quoteRequestBody ||
      !jurgensSchedulePolicyChangeAt
    ) {
      return;
    }

    const policyChangesAt = Date.parse(jurgensSchedulePolicyChangeAt);

    if (!Number.isFinite(policyChangesAt)) {
      return;
    }

    const timeoutId = window.setTimeout(
      () => void requestDeliveryQuotes({ preserveSelections: true }),
      Math.max(0, policyChangesAt - Date.now() + 250),
    );

    return () => window.clearTimeout(timeoutId);
  }, [
    checkoutStep,
    jurgensSchedulePolicyChangeAt,
    quoteRequestBody,
    requestDeliveryQuotes,
  ]);

  async function startHostedCheckout() {
    if (
      checkoutStep !== "payment" ||
      !canCreateOrder ||
      !quotes ||
      !normalizedCustomerPhone
    ) {
      return;
    }

    setIsCreatingOrder(true);
    setError(null);

    try {
      if (
        checkoutAnalytics &&
        shippingAnalytics &&
        !trackedPaymentInfoSignaturesRef.current.has(
          shippingAnalytics.signature,
        )
      ) {
        trackedPaymentInfoSignaturesRef.current.add(
          shippingAnalytics.signature,
        );
        trackGoogleEvent("add_payment_info", {
          currency: "ZAR",
          items: checkoutAnalytics.items,
          payment_type: "PayFast",
          value: checkoutAnalytics.value,
        });
      }

      const response = await fetch("/api/checkout/orders", {
        body: JSON.stringify({
          addressBookIntent,
          billingDetails: {
            ...(useBusinessBilling
              ? {
                  businessName: billingBusinessName,
                  vatRegistrationNumber: billingVatNumber,
                }
              : {}),
            ...(useBusinessBilling && !billingSameAsDelivery
              ? { address: normalizeDeliveryAddress(billingAddress) }
              : {}),
            name: customer.name,
            sameAsDelivery: !useBusinessBilling || billingSameAsDelivery,
          },
          customer: {
            ...customer,
            phone: normalizedCustomerPhone,
          },
          deliveryAddress: address,
          deliverySelections: quotes.groups.map((group) => ({
            groupKey: group.groupKey,
            quoteId: selectedQuoteByGroup[group.groupKey],
          })),
          items: checkoutItems,
          policyAcceptance: {
            accepted: true,
            version: POLICY_EFFECTIVE_DATE_ISO,
          },
          ...(jurgensDeliverySchedule
            ? { jurgensDeliverySchedule }
            : {}),
        }),
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as {
        message?: string;
        redirectUrl?: string;
      };

      if (!response.ok || !payload.redirectUrl) {
        throw new Error(payload.message ?? "Checkout could not be started.");
      }

      window.location.assign(payload.redirectUrl);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Checkout could not be started.",
      );
      setIsCreatingOrder(false);
    }
  }

  if (isLoadingCart) {
    return (
      <div className="grid min-h-[45dvh] place-items-center">
        <span className="inline-flex items-center gap-2 text-sm text-[#666660] dark:text-[#aaa9a1]">
          <LoaderCircleIcon className="size-5 animate-spin text-[#ff5a1f]" />
          Preparing checkout
        </span>
      </div>
    );
  }

  if (!cart || cartItems.length === 0) {
    return (
      <section className="grid min-h-[45dvh] place-items-center border-y border-[#e8e8e2] bg-white px-5 py-12 text-center dark:border-white/10 dark:bg-[#101010] sm:rounded-md sm:border">
        <div>
          <AlertCircleIcon className="mx-auto size-8 text-[#ff5a1f]" />
          <h2 className="mt-4 text-lg font-black">Nothing selected</h2>
          <p className="mt-2 text-sm text-[#666660] dark:text-[#aaa9a1]">
            Select at least one product before checking out.
          </p>
          <Link
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-[#ff5a1f] px-4 text-sm font-bold text-white"
            href="/cart"
          >
            <ChevronLeftIcon className="size-4" />
            Return to cart
          </Link>
        </div>
      </section>
    );
  }

  if (cartReviewRequired) {
    return (
      <section className="grid min-h-[45dvh] place-items-center border-y border-[#e8e8e2] bg-white px-5 py-12 text-center dark:border-white/10 dark:bg-[#101010] sm:rounded-md sm:border">
        <div className="max-w-md">
          <AlertCircleIcon className="mx-auto size-8 text-[#ff5a1f]" />
          <h2 className="mt-4 text-lg font-black">Review your cart</h2>
          <p className="mt-2 text-sm leading-6 text-[#666660] dark:text-[#aaa9a1]">
            One or more selected products changed since you opened checkout.
            Return to the cart to confirm the latest availability and quantities.
          </p>
          <Link
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-[#ff5a1f] px-4 text-sm font-bold text-white"
            href="/cart"
          >
            <ChevronLeftIcon className="size-4" />
            Return to cart
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="grid min-w-0 gap-4">
        <nav
          aria-label="Checkout progress"
          className="border-y border-[#e8e8e2] bg-white px-2 py-2 dark:border-white/10 dark:bg-[#101010] sm:rounded-md sm:border sm:px-5 sm:py-3"
        >
          <ol className="grid grid-cols-3 gap-1 sm:gap-2">
            {CHECKOUT_STEPS.map((step, index) => {
              const isCurrent = checkoutStep === step;
              const canVisit = index <= furthestCheckoutStep;

              return (
                <li className="min-w-0" key={step}>
                  <button
                    aria-current={isCurrent ? "step" : undefined}
                    className={cn(
                      "flex min-h-10 w-full min-w-0 items-center justify-center gap-1 rounded-md px-1 py-1.5 text-center transition sm:min-h-11 sm:justify-start sm:gap-2 sm:px-3 sm:py-2 sm:text-left",
                      isCurrent
                        ? "bg-[#fff1eb] text-[#b93809] dark:bg-[#ff5a1f]/12 dark:text-[#ff8a60]"
                        : canVisit
                          ? "text-[#555550] hover:bg-[#f7f7f2] dark:text-[#c8c8c0] dark:hover:bg-white/[0.04]"
                          : "cursor-not-allowed text-[#aaa9a3] dark:text-[#666660]",
                    )}
                    disabled={!canVisit}
                    onClick={() => visitCheckoutStep(step)}
                    type="button"
                  >
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full border text-[9px] font-black sm:size-6 sm:text-[10px]",
                        isCurrent
                          ? "border-[#ff5a1f] bg-[#ff5a1f] text-white"
                          : index < checkoutStepIndex
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-[#d8d8d1] bg-white dark:border-white/15 dark:bg-white/[0.04]",
                      )}
                    >
                      {index < checkoutStepIndex ? (
                        <CheckCircle2Icon className="size-3.5" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span className="whitespace-nowrap text-[9px] font-black uppercase tracking-normal sm:text-xs sm:tracking-wide">
                      {checkoutStepLabels[step]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <section className="border-y border-[#e8e8e2] bg-white dark:border-white/10 dark:bg-[#101010] sm:rounded-md sm:border">
          <details
            className="group"
            open={checkoutStep === "payment" ? true : undefined}
          >
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-3 outline-none marker:hidden focus-visible:ring-2 focus-visible:ring-[#ff5a1f]/30 [&::-webkit-details-marker]:hidden">
              <PackageCheckIcon className="size-4 shrink-0 text-[#ff5a1f]" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-black uppercase sm:text-sm">
                  Order summary
                </span>
                <span className="mt-0.5 block text-[10px] text-[#777770] dark:text-[#aaa9a1]">
                  {selectedProductCount} {selectedProductCount === 1 ? "item" : "items"} in your order
                </span>
              </span>
              <strong className="shrink-0 text-xs tabular-nums sm:text-sm">
                {formatZar(subtotal)}
              </strong>
              <ChevronDownIcon className="size-4 shrink-0 text-[#777770] transition-transform group-open:rotate-180" />
            </summary>
            <div className="divide-y divide-[#e8e8e2] border-t border-[#e8e8e2] dark:divide-white/10 dark:border-white/10">
            {cart.items.map((item) => (
              <div
                className="grid grid-cols-[3.75rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-3 py-3 sm:grid-cols-[3.75rem_minmax(0,1fr)_auto] sm:px-4"
                key={item.variantId}
              >
                <div className="relative aspect-square overflow-hidden rounded-[5px] border border-[#e4e4de] bg-[#f4f4f0] dark:border-white/10 dark:bg-white/[0.04]">
                  {item.imageUrl ? (
                    <Image
                      alt={item.productTitle}
                      className="object-contain"
                      fill
                      sizes="60px"
                      src={item.imageUrl}
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-[12px] font-bold sm:text-sm">
                    {item.productTitle}
                  </p>
                  <p className="mt-1 truncate text-[10px] text-[#777770] dark:text-[#aaa9a1]">
                    {item.variantTitle} · Qty {item.quantity}
                  </p>
                  {item.purchaseType === "exchange" ? (
                    <p className="mt-1 text-[10px] font-semibold leading-4 text-[#9a3b13] dark:text-orange-300">
                      Empty cylinder required
                      {item.exchangeRequiredEmptyCylinderSize
                        ? `: ${item.exchangeRequiredEmptyCylinderSize}`
                        : ""}
                      .
                      {item.exchangeAcceptedReturnBrands.length > 0
                        ? ` Accepted return brands: ${item.exchangeAcceptedReturnBrands.join(", ")}.`
                        : ""}
                    </p>
                  ) : null}
                  <div className="mt-2 flex min-w-0 items-center">
                    <MarketplaceProductFulfillmentBadge
                      fulfillmentMode={item.fulfillmentMode}
                      label={
                        item.fulfillmentMode === "piessang_fulfilled"
                          ? "Jurgens delivery"
                          : "Bob Go courier"
                      }
                    />
                  </div>
                </div>
                <p className="col-start-2 text-[12px] font-black tabular-nums sm:col-start-auto sm:text-sm">
                  {formatZar(item.lineTotalZar)}
                </p>
              </div>
            ))}
            </div>
          </details>
        </section>

        <div
          className="grid min-w-0 gap-4 outline-none"
          ref={stepPanelRef}
          tabIndex={-1}
        >
        {checkoutStep === "address" ? (
        <form
          className="border-y border-[#e8e8e2] bg-white px-3 py-4 dark:border-white/10 dark:bg-[#101010] sm:rounded-md sm:border sm:px-5 sm:py-5"
          id="checkout-address-form"
          onSubmit={(event) => {
            event.preventDefault();
            void continueToShipping();
          }}
        >
          <div className="flex items-center gap-2">
            <MapPinIcon className="size-4 text-[#ff5a1f]" />
            <h2 className="text-sm font-black uppercase">
              Contact and delivery address
            </h2>
          </div>

          {isSignedIn ? (
            initialAddresses.length > 0 ? (
              <div className="mt-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="grid min-w-0 gap-1.5">
                  <Label htmlFor="checkout-saved-address">
                    Saved delivery address
                  </Label>
                  <Select
                    onValueChange={(value) => {
                      if (!value) {
                        return;
                      }

                      if (value === differentAddressValue) {
                        selectDifferentAddress();
                        return;
                      }

                      const savedAddress = initialAddresses.find(
                        (candidate) => candidate.id === value,
                      );

                      if (savedAddress) {
                        selectSavedAddress(savedAddress);
                      }
                    }}
                    value={selectedSavedAddressId ?? differentAddressValue}
                  >
                    <SelectTrigger
                      className={cn(fieldClass, "w-full")}
                      id="checkout-saved-address"
                    >
                      <SelectValue className="min-w-0">
                        <span className="min-w-0 truncate">
                          {selectedSavedAddress ? (
                            <>
                              {selectedSavedAddress.label}
                              {selectedSavedAddress.isDefault
                                ? " (Default)"
                                : ""}{" "}
                              — {selectedSavedAddress.addressLine1},{" "}
                              {selectedSavedAddress.city}{" "}
                              {selectedSavedAddress.postalCode}
                            </>
                          ) : (
                            "Use a different address"
                          )}
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent
                      align="start"
                      alignItemWithTrigger={false}
                      className="z-[90] border border-[#deded7] bg-white text-zinc-950 shadow-xl dark:border-white/12 dark:bg-[#151515] dark:text-white"
                    >
                      {initialAddresses.map((savedAddress) => (
                        <SelectItem
                          className="min-w-0 py-2.5"
                          key={savedAddress.id}
                          value={savedAddress.id}
                        >
                          <span className="min-w-0 truncate">
                            {savedAddress.label}
                            {savedAddress.isDefault ? " (Default)" : ""} —{" "}
                            {savedAddress.addressLine1}, {savedAddress.city}{" "}
                            {savedAddress.postalCode}
                          </span>
                        </SelectItem>
                      ))}
                      <SelectItem
                        className="py-2.5"
                        value={differentAddressValue}
                      >
                        Use a different address
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Link
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#d8d8d1] bg-white px-4 text-xs font-bold transition hover:border-[#ff5a1f] hover:text-[#ff5a1f] dark:border-white/15 dark:bg-white/[0.04]"
                  href="/account/addresses"
                >
                  <HomeIcon className="size-4" />
                  Manage addresses
                </Link>
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#e2e2dc] bg-[#f7f7f2] px-3 py-3 dark:border-white/10 dark:bg-white/[0.035]">
                <p className="text-xs text-[#666660] dark:text-[#aaa9a1]">
                  No saved delivery addresses yet.
                </p>
                <Link
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#d8d8d1] bg-white px-3 text-xs font-bold transition hover:border-[#ff5a1f] hover:text-[#ff5a1f] dark:border-white/15 dark:bg-white/[0.04]"
                  href="/account/addresses"
                >
                  <HomeIcon className="size-3.5" />
                  Add saved address
                </Link>
              </div>
            )
          ) : null}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="checkout-name">
                Full name <RequiredMark />
              </Label>
              <Input
                autoComplete="name"
                className={fieldClass}
                id="checkout-name"
                onChange={(event) =>
                  setCustomer((current) => ({ ...current, name: event.target.value }))
                }
                required
                value={customer.name}
              />
            </label>
            <label className="grid gap-1.5">
              <Label htmlFor="checkout-email">
                Email <RequiredMark />
              </Label>
              <Input
                autoComplete="email"
                className={fieldClass}
                id="checkout-email"
                onChange={(event) =>
                  setCustomer((current) => ({ ...current, email: event.target.value }))
                }
                required
                type="email"
                value={customer.email}
              />
            </label>
            <label className="grid gap-1.5">
              <Label htmlFor="checkout-phone">
                Phone <RequiredMark />
              </Label>
              <CountryPhoneInput
                countryCode={phoneCountryCode}
                id="checkout-phone"
                inputClassName={fieldClass}
                name="checkoutPhone"
                onChange={(event) =>
                  setCustomer((current) => ({ ...current, phone: event.target.value }))
                }
                onCountryCodeChange={setPhoneCountryCode}
                placeholder="82 123 4567"
                required
                selectClassName={fieldClass}
                value={customer.phone}
              />
            </label>
            <label className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="checkout-address-1">
                Street address <RequiredMark />
              </Label>
              <Input
                autoComplete="address-line1"
                className={fieldClass}
                id="checkout-address-1"
                onChange={(event) => updateAddress("addressLine1", event.target.value)}
                required
                value={address.addressLine1}
              />
            </label>
            <label className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="checkout-address-2">Complex, unit or building</Label>
              <Input
                autoComplete="address-line2"
                className={fieldClass}
                id="checkout-address-2"
                onChange={(event) => updateAddress("addressLine2", event.target.value)}
                value={address.addressLine2}
              />
            </label>
            <label className="grid gap-1.5">
              <Label htmlFor="checkout-suburb">Suburb (optional)</Label>
              <Input
                autoComplete="address-level3"
                className={fieldClass}
                id="checkout-suburb"
                onChange={(event) => updateAddress("suburb", event.target.value)}
                value={address.suburb}
              />
            </label>
            <label className="grid gap-1.5">
              <Label htmlFor="checkout-city">
                City <RequiredMark />
              </Label>
              <Input
                autoComplete="address-level2"
                className={fieldClass}
                id="checkout-city"
                onChange={(event) => updateAddress("city", event.target.value)}
                required
                value={address.city}
              />
            </label>
            <label className="grid gap-1.5">
              <Label htmlFor="checkout-province">
                Province <RequiredMark />
              </Label>
              <select
                autoComplete="address-level1"
                className={cn(fieldClass, "border")}
                id="checkout-province"
                onChange={(event) => updateAddress("province", event.target.value)}
                required
                value={address.province}
              >
                <option value="">Select province</option>
                {SOUTH_AFRICAN_PROVINCES.map((province) => (
                  <option key={province} value={province}>
                    {province}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <Label htmlFor="checkout-postal-code">
                Postal code <RequiredMark />
              </Label>
              <Input
                autoComplete="postal-code"
                className={fieldClass}
                id="checkout-postal-code"
                inputMode="numeric"
                onChange={(event) => updateAddress("postalCode", event.target.value)}
                required
                value={address.postalCode}
              />
            </label>
          </div>

          {isSignedIn ? (
            <div className="mt-4 rounded-md border border-[#e2e2dc] bg-[#f7f7f2] px-3 py-3 dark:border-white/10 dark:bg-white/[0.035]">
              {selectedSavedAddress && selectedSavedAddressUnchanged ? (
                <p className="flex items-start gap-2 text-[11px] leading-5 text-[#666660] dark:text-[#aaa9a1]">
                  <HomeIcon className="mt-0.5 size-3.5 shrink-0 text-[#ff5a1f]" />
                  Using your saved “{selectedSavedAddress.label}” address. We’ll
                  keep your order’s delivery snapshot unchanged if you edit the
                  address later.
                </p>
              ) : (
                <>
                  <label className="grid cursor-pointer grid-cols-[1.1rem_minmax(0,1fr)] items-start gap-2.5">
                    <input
                      checked={saveAddressToBook}
                      className="mt-0.5 size-4 accent-[#ff5a1f]"
                      onChange={(event) =>
                        setSaveAddressToBook(event.target.checked)
                      }
                      type="checkbox"
                    />
                    <span className="text-xs font-bold leading-5">
                      {selectedSavedAddress
                        ? `Save changes to “${selectedSavedAddress.label}”`
                        : "Save this address to my account"}
                    </span>
                  </label>

                  {saveAddressToBook ? (
                    <div className="mt-3 grid gap-3 border-t border-[#dfdfd8] pt-3 dark:border-white/10 sm:grid-cols-2">
                      <label className="grid gap-1.5">
                        <Label htmlFor="checkout-address-label">
                          Address label <RequiredMark />
                        </Label>
                        <Input
                          className={fieldClass}
                          id="checkout-address-label"
                          maxLength={80}
                          onChange={(event) => setAddressLabel(event.target.value)}
                          placeholder="Home, work, office..."
                          required
                          value={addressLabel}
                        />
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 self-end pb-3 text-xs font-bold">
                        <input
                          checked={makeDefaultAddress}
                          className="size-4 accent-[#ff5a1f]"
                          disabled={Boolean(selectedSavedAddress?.isDefault)}
                          onChange={(event) =>
                            setMakeDefaultAddress(event.target.checked)
                          }
                          type="checkbox"
                        />
                        {selectedSavedAddress?.isDefault
                          ? "This is your default address"
                          : "Make this my default address"}
                      </label>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {stepError ? (
            <p
              className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
              role="alert"
            >
              <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
              {stepError}
            </p>
          ) : null}
        </form>
        ) : null}

        {checkoutStep === "payment" ? (
        <>
        <section className="border-y border-[#e8e8e2] bg-white px-3 py-4 dark:border-white/10 dark:bg-[#101010] sm:rounded-md sm:border sm:px-5 sm:py-5">
          <div className="flex items-center gap-2">
            <CheckCircle2Icon className="size-4 text-emerald-600" />
            <h2 className="text-sm font-black uppercase">Review and confirm</h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-[#666660] dark:text-[#aaa9a1]">
            Confirm your contact, delivery, shipping, and billing details before
            completing payment.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <article className="rounded-md border border-[#e4e4de] bg-[#f7f7f2] px-3 py-3 dark:border-white/10 dark:bg-white/[0.035] sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-black uppercase">
                  Contact and delivery
                </h3>
                <button
                  className="text-[10px] font-black uppercase text-[#d9430e] underline underline-offset-2 hover:text-[#ff5a1f] dark:text-[#ff8a60]"
                  onClick={() => visitCheckoutStep("address")}
                  type="button"
                >
                  Edit
                </button>
              </div>
              <div className="mt-3 grid gap-3 text-xs leading-5 text-[#555550] dark:text-[#c8c8c0] sm:grid-cols-2">
                <div>
                  <p className="font-bold text-[#080808] dark:text-white">
                    {customer.name}
                  </p>
                  <p>{customer.email}</p>
                  <p>{normalizedCustomerPhone ?? customer.phone}</p>
                </div>
                <address className="not-italic">
                  <p className="font-bold text-[#080808] dark:text-white">
                    Delivery address
                  </p>
                  <p>{address.addressLine1}</p>
                  {address.addressLine2 ? <p>{address.addressLine2}</p> : null}
                  <p>
                    {[address.suburb, address.city].filter(Boolean).join(", ")}
                  </p>
                  <p>
                    {address.province} {address.postalCode}
                  </p>
                  <p>South Africa</p>
                </address>
              </div>
            </article>

            <article className="rounded-md border border-[#e4e4de] bg-[#f7f7f2] px-3 py-3 dark:border-white/10 dark:bg-white/[0.035]">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-black uppercase">Shipping</h3>
                <button
                  className="text-[10px] font-black uppercase text-[#d9430e] underline underline-offset-2 hover:text-[#ff5a1f] dark:text-[#ff8a60]"
                  onClick={() => visitCheckoutStep("shipping")}
                  type="button"
                >
                  Edit
                </button>
              </div>
              <div className="mt-3 grid gap-2 text-xs leading-5 text-[#555550] dark:text-[#c8c8c0]">
                {selectedShippingOptions?.map((option) => (
                  <div
                    className="flex items-start justify-between gap-3"
                    key={option.groupKey}
                  >
                    <span>
                      <strong className="block text-[#080808] dark:text-white">
                        {option.displayLabel}
                      </strong>
                      <span className="block text-[10px] leading-4">
                        {option.label}
                      </span>
                      {option.deliveryInformation ? (
                        <span className="text-[10px] leading-4">
                          {option.deliveryInformation}
                        </span>
                      ) : null}
                    </span>
                    <strong className="shrink-0 tabular-nums text-[#080808] dark:text-white">
                      {option.amountZar === 0
                        ? "FREE"
                        : formatZar(option.amountZar)}
                    </strong>
                  </div>
                ))}
                {jurgensDeliverySchedule ? (
                  <div className="border-t border-[#dfdfd8] pt-2 dark:border-white/10">
                    <p>
                      Preferred date:{" "}
                      <strong className="text-[#080808] dark:text-white">
                        {formatPreferredDeliveryDate(
                          jurgensDeliverySchedule.date,
                        )}
                      </strong>
                    </p>
                    {jurgensDeliverySchedule.deliveryInstructions ? (
                      <p className="mt-1">
                        Notes: {jurgensDeliverySchedule.deliveryInstructions}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </article>

            <article className="rounded-md border border-[#e4e4de] bg-[#f7f7f2] px-3 py-3 dark:border-white/10 dark:bg-white/[0.035]">
              <h3 className="text-xs font-black uppercase">Billing</h3>
              <div className="mt-3 text-xs leading-5 text-[#555550] dark:text-[#c8c8c0]">
                {useBusinessBilling ? (
                  <>
                    <p className="font-bold text-[#080808] dark:text-white">
                      {billingBusinessName}
                    </p>
                    {normalizedBillingVatNumber ? (
                      <p>VAT number: {normalizedBillingVatNumber}</p>
                    ) : null}
                    <p>
                      {billingSameAsDelivery
                        ? "Billing address matches the delivery address."
                        : [
                            billingAddress.addressLine1,
                            billingAddress.addressLine2,
                            billingAddress.suburb,
                            billingAddress.city,
                            billingAddress.province,
                            billingAddress.postalCode,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-[#080808] dark:text-white">
                      {customer.name}
                    </p>
                    <p>VAT invoice using the delivery address.</p>
                  </>
                )}
              </div>
            </article>
          </div>
        </section>

        <section className="border-y border-[#e8e8e2] bg-white dark:border-white/10 dark:bg-[#101010] sm:rounded-md sm:border">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-start gap-3 px-3 py-4 outline-none marker:hidden focus-visible:ring-2 focus-visible:ring-[#ff5a1f]/30 sm:px-5 sm:py-5 [&::-webkit-details-marker]:hidden">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[#ff5a1f]/10 text-[#ff5a1f]">
                <ReceiptTextIcon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-black uppercase">
                    Billing &amp; VAT invoice
                  </span>
                  <span className="rounded-full border border-[#ff5a1f]/30 bg-[#ff5a1f]/8 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#d9430e] dark:text-[#ff8a60]">
                    Optional details
                  </span>
                </span>
                <span className="mt-1 block text-xs leading-5 text-[#666660] dark:text-[#aaa9a1]">
                  A paid VAT invoice is sent automatically. Open this section
                  only if it should include a business name, VAT number, or a
                  different billing address.
                </span>
              </span>
              <ChevronDownIcon className="mt-2 size-4 shrink-0 text-[#777770] transition-transform group-open:rotate-180" />
            </summary>

            <div className="border-t border-[#e8e8e2] px-3 py-4 dark:border-white/10 sm:px-5 sm:py-5">
              <label className="grid cursor-pointer grid-cols-[1.1rem_minmax(0,1fr)] items-start gap-2.5 rounded-md border border-[#e2e2dc] bg-[#f7f7f2] px-3 py-3 dark:border-white/10 dark:bg-white/[0.035]">
                <input
                  checked={useBusinessBilling}
                  className="mt-0.5 size-4 accent-[#ff5a1f]"
                  onChange={(event) => {
                    setUseBusinessBilling(event.target.checked);

                    if (!event.target.checked) {
                      setBillingSameAsDelivery(true);
                    }
                  }}
                  type="checkbox"
                />
                <span>
                  <span className="block text-xs font-bold">
                    Add business billing details
                  </span>
                  <span className="mt-1 block text-[10px] leading-4 text-[#777770] dark:text-[#aaa9a1]">
                    Use this for company purchases or when a customer VAT
                    number should appear on the invoice.
                  </span>
                </span>
              </label>

              {useBusinessBilling ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5">
                    <Label htmlFor="checkout-billing-business-name">
                      Registered business name <RequiredMark />
                    </Label>
                    <Input
                      autoComplete="organization"
                      className={fieldClass}
                      id="checkout-billing-business-name"
                      maxLength={200}
                      onChange={(event) =>
                        setBillingBusinessName(event.target.value)
                      }
                      required
                      value={billingBusinessName}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <Label htmlFor="checkout-billing-vat-number">
                      Customer VAT number (optional)
                    </Label>
                    <Input
                      aria-describedby={
                        billingVatNumber && !billingVatNumberValid
                          ? "checkout-billing-vat-number-error"
                          : undefined
                      }
                      aria-invalid={
                        billingVatNumber && !billingVatNumberValid
                          ? true
                          : undefined
                      }
                      className={fieldClass}
                      id="checkout-billing-vat-number"
                      maxLength={80}
                      onChange={(event) =>
                        setBillingVatNumber(event.target.value)
                      }
                      placeholder="e.g. 4XXXXXXXXX"
                      value={billingVatNumber}
                    />
                    {billingVatNumber && !billingVatNumberValid ? (
                      <span
                        className="text-[10px] leading-4 text-red-600 dark:text-red-300"
                        id="checkout-billing-vat-number-error"
                      >
                        Enter a valid 10-digit South African VAT number.
                      </span>
                    ) : null}
                  </label>

                  <label className="flex cursor-pointer items-center gap-2 text-xs font-bold sm:col-span-2">
                    <input
                      checked={billingSameAsDelivery}
                      className="size-4 accent-[#ff5a1f]"
                      onChange={(event) =>
                        setBillingSameAsDelivery(event.target.checked)
                      }
                      type="checkbox"
                    />
                    Billing address is the same as the delivery address
                  </label>

                  {!billingSameAsDelivery ? (
                    <>
                      <label className="grid gap-1.5 sm:col-span-2">
                        <Label htmlFor="checkout-billing-address-1">
                          Billing street address <RequiredMark />
                        </Label>
                        <Input
                          autoComplete="billing address-line1"
                          className={fieldClass}
                          id="checkout-billing-address-1"
                          onChange={(event) =>
                            updateBillingAddress(
                              "addressLine1",
                              event.target.value,
                            )
                          }
                          required
                          value={billingAddress.addressLine1}
                        />
                      </label>
                      <label className="grid gap-1.5 sm:col-span-2">
                        <Label htmlFor="checkout-billing-address-2">
                          Complex, unit or building
                        </Label>
                        <Input
                          autoComplete="billing address-line2"
                          className={fieldClass}
                          id="checkout-billing-address-2"
                          onChange={(event) =>
                            updateBillingAddress(
                              "addressLine2",
                              event.target.value,
                            )
                          }
                          value={billingAddress.addressLine2}
                        />
                      </label>
                      <label className="grid gap-1.5">
                        <Label htmlFor="checkout-billing-suburb">
                          Suburb (optional)
                        </Label>
                        <Input
                          autoComplete="billing address-level3"
                          className={fieldClass}
                          id="checkout-billing-suburb"
                          onChange={(event) =>
                            updateBillingAddress("suburb", event.target.value)
                          }
                          value={billingAddress.suburb}
                        />
                      </label>
                      <label className="grid gap-1.5">
                        <Label htmlFor="checkout-billing-city">
                          City <RequiredMark />
                        </Label>
                        <Input
                          autoComplete="billing address-level2"
                          className={fieldClass}
                          id="checkout-billing-city"
                          onChange={(event) =>
                            updateBillingAddress("city", event.target.value)
                          }
                          required
                          value={billingAddress.city}
                        />
                      </label>
                      <label className="grid gap-1.5">
                        <Label htmlFor="checkout-billing-province">
                          Province <RequiredMark />
                        </Label>
                        <select
                          autoComplete="billing address-level1"
                          className={cn(fieldClass, "border")}
                          id="checkout-billing-province"
                          onChange={(event) =>
                            updateBillingAddress(
                              "province",
                              event.target.value,
                            )
                          }
                          required
                          value={billingAddress.province}
                        >
                          <option value="">Select province</option>
                          {SOUTH_AFRICAN_PROVINCES.map((province) => (
                            <option key={province} value={province}>
                              {province}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1.5">
                        <Label htmlFor="checkout-billing-postal-code">
                          Postal code <RequiredMark />
                        </Label>
                        <Input
                          autoComplete="billing postal-code"
                          className={fieldClass}
                          id="checkout-billing-postal-code"
                          inputMode="numeric"
                          onChange={(event) =>
                            updateBillingAddress(
                              "postalCode",
                              event.target.value,
                            )
                          }
                          required
                          value={billingAddress.postalCode}
                        />
                      </label>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          </details>
        </section>
        </>
        ) : null}

        {checkoutStep === "shipping" ? (
          <section className="border-y border-[#e8e8e2] bg-white px-3 py-4 dark:border-white/10 dark:bg-[#101010] sm:rounded-md sm:border sm:px-5 sm:py-5">
            <div className="flex items-center gap-2">
              <TruckIcon className="size-4 text-[#ff5a1f]" />
              <h2 className="text-sm font-black uppercase">Shipping breakdown</h2>
            </div>
            <p className="mt-1 text-xs leading-5 text-[#666660] dark:text-[#aaa9a1]">
              Shipping is selected automatically. We apply Jurgens Energy
              delivery where applicable and the cheapest available Bob Go
              courier rate.
            </p>
            {isLoadingQuotes ? (
              <div
                aria-live="polite"
                className="mt-4 flex min-h-24 items-center justify-center gap-2 rounded-md border border-[#e3e3dc] bg-[#f7f7f2] px-4 text-sm font-semibold text-[#666660] dark:border-white/10 dark:bg-white/[0.035] dark:text-[#aaa9a1]"
              >
                <LoaderCircleIcon className="size-5 animate-spin text-[#ff5a1f]" />
                Calculating shipping charges…
              </div>
            ) : quoteError ? (
              <div
                className="mt-4 flex flex-col items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-4 text-sm leading-5 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 sm:flex-row sm:items-center sm:justify-between"
                role="alert"
              >
                <span className="flex items-start gap-2">
                  <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
                  {quoteError}
                </span>
                <Button
                  className="h-11 w-full border-red-300 bg-white text-red-700 hover:bg-red-100 sm:w-auto dark:border-red-500/30 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-500/10"
                  onClick={() => void requestDeliveryQuotes()}
                  type="button"
                  variant="outline"
                >
                  Try again
                </Button>
              </div>
            ) : quotes ? (
            <div className="mt-4 grid gap-5">
              {quotes.groups.map((group) => {
                const selectedQuoteId = selectedQuoteByGroup[group.groupKey];
                const option = group.options.find(
                  (candidate) => candidate.quoteId === selectedQuoteId,
                );

                return (
                  <article className="min-w-0" key={group.groupKey}>
                    {option ? (
                      <div
                        className={cn(
                          "grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md border px-3 py-3",
                          option.amountZar === 0
                            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                            : "border-[#deded7] bg-[#f7f7f2] dark:border-white/12 dark:bg-white/[0.035]",
                        )}
                      >
                        <span
                          className={cn(
                            "grid size-8 place-items-center rounded-full",
                            option.amountZar === 0
                              ? "bg-emerald-600 text-white"
                              : "bg-[#ff5a1f]/10 text-[#ff5a1f]",
                          )}
                        >
                          <CheckCircle2Icon className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <strong className="block text-[12px] font-bold sm:text-sm">
                            {getShippingChargeLabel(group.groupKey)}
                          </strong>
                          <span className="mt-0.5 block text-[10px] font-semibold leading-4 text-[#666660] dark:text-[#aaa9a1]">
                            {option.label}
                            {group.groupKey === "courier"
                              ? " · Cheapest available Bob Go rate"
                              : " · Applied automatically"}
                          </span>
                          {option.deliveryInformation ? (
                            <span className="mt-0.5 block text-[10px] leading-4 text-[#777770] dark:text-[#aaa9a1]">
                              {option.deliveryInformation}
                            </span>
                          ) : null}
                        </span>
                        <strong
                          className={cn(
                            "text-[12px] tabular-nums sm:text-sm",
                            option.amountZar === 0 &&
                              "text-emerald-700 dark:text-emerald-300",
                          )}
                        >
                          {option.amountZar === 0
                            ? "FREE"
                            : formatZar(option.amountZar)}
                        </strong>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-bold">
                          {getShippingChargeLabel(group.groupKey)}
                        </p>
                        <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] leading-4 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                          {group.unavailableReason ?? "Delivery is unavailable."}
                        </p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            ) : (
              <div className="mt-4 rounded-md border border-[#e3e3dc] bg-[#f7f7f2] px-4 py-4 text-sm text-[#666660] dark:border-white/10 dark:bg-white/[0.035] dark:text-[#aaa9a1]">
                Shipping charges have not been calculated yet.
              </div>
            )}
          </section>
        ) : null}

        {checkoutStep === "shipping" &&
        hasJurgensFulfilledProducts &&
        jurgensSchedulingGroup?.scheduling &&
        jurgensScheduleOptions.length > 0 ? (
          <section className="border-y border-[#e8e8e2] bg-white dark:border-white/10 dark:bg-[#101010] sm:rounded-md sm:border">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-start gap-3 px-3 py-4 outline-none marker:hidden focus-visible:ring-2 focus-visible:ring-[#ff5a1f]/30 sm:px-5 sm:py-5 [&::-webkit-details-marker]:hidden">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[#ff5a1f]/10 text-[#ff5a1f]">
                  <CalendarDaysIcon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black uppercase">
                      Schedule Jurgens Energy delivery
                    </span>
                    <span className="rounded-full border border-[#ff5a1f]/30 bg-[#ff5a1f]/8 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#d9430e] dark:text-[#ff8a60]">
                      Optional
                    </span>
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-2">
                    <MarketplaceProductFulfillmentBadge
                      fulfillmentMode="piessang_fulfilled"
                      label="Jurgens delivery"
                    />
                    <span className="text-[10px] font-bold leading-4 text-emerald-700 dark:text-emerald-300">
                      Applies only to the {jurgensFulfilledProductCount}{" "}
                      selected {jurgensFulfilledProductCount === 1
                        ? "product"
                        : "products"}{" "}
                      carrying this badge.
                    </span>
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[#666660] dark:text-[#aaa9a1]">
                    {jurgensDeliverySchedule
                      ? `Preferred date: ${formatPreferredDeliveryDate(jurgensDeliverySchedule.date)}.`
                      : "Without a preferred date, Jurgens Energy will arrange those items through the normal delivery process."}
                  </span>
                </span>
                <ChevronDownIcon className="mt-2 size-4 shrink-0 text-[#777770] transition-transform group-open:rotate-180" />
              </summary>

              <div className="border-t border-[#e8e8e2] px-3 py-4 dark:border-white/10 sm:px-5 sm:py-5">
                <div className="mb-4 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] leading-5 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200">
                  <TruckIcon className="mt-0.5 size-4 shrink-0" />
                  <p>
                    <strong>Jurgens-fulfilled products only.</strong> This date
                    preference does not affect products delivered separately by
                    a Bob Go courier.
                  </p>
                </div>
                <div className="grid gap-1.5 sm:max-w-sm">
                  <Label htmlFor="jurgens-delivery-date">
                    Preferred delivery date
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      aria-describedby="jurgens-delivery-date-help"
                      className={fieldClass}
                      id="jurgens-delivery-date"
                      max={jurgensScheduleOptions.at(-1)?.date}
                      min={jurgensScheduleOptions[0]?.date}
                      onChange={(event) => {
                        const date = event.target.value;

                        setJurgensDeliverySchedule((current) =>
                          date
                            ? {
                                date,
                                deliveryInstructions:
                                  current?.deliveryInstructions ?? "",
                              }
                            : null,
                        );
                      }}
                      type="date"
                      value={jurgensDeliverySchedule?.date ?? ""}
                    />
                    {jurgensDeliverySchedule ? (
                      <button
                        aria-label="Clear preferred delivery date"
                        className="grid size-11 shrink-0 place-items-center rounded-md border border-[#d8d8d1] bg-white text-[#777770] transition hover:border-[#ff5a1f] hover:text-[#ff5a1f] dark:border-white/12 dark:bg-white/[0.04]"
                        onClick={() => setJurgensDeliverySchedule(null)}
                        title="Clear preferred delivery date"
                        type="button"
                      >
                        <XIcon className="size-4" />
                      </button>
                    ) : null}
                  </div>
                  <p
                    className="text-[10px] leading-4 text-[#777770] dark:text-[#aaa9a1]"
                    id="jurgens-delivery-date-help"
                  >
                    Requests for today close at{" "}
                    {jurgensSchedulingGroup.scheduling.cutoffTime} SAST. {" "}
                    {jurgensScheduleOptions[0]?.isSameDay
                      ? "Today is currently available."
                      : jurgensScheduleOptions[0]
                        ? `The earliest available date is ${formatPreferredDeliveryDate(jurgensScheduleOptions[0].date)}.`
                        : "No preferred dates are currently available."}{" "}
                    Jurgens Energy will plan the delivery time as part of the
                    delivery run.
                  </p>
                </div>

                <div className="mt-4 grid gap-1.5">
                  <Label htmlFor="jurgens-delivery-instructions">
                    Delivery notes (optional)
                  </Label>
                  <Textarea
                    aria-describedby="jurgens-delivery-instructions-help"
                    className="min-h-24 resize-y rounded-md border-[#d8d8d1] bg-white px-3 py-3 text-sm shadow-none focus-visible:border-[#ff5a1f] focus-visible:ring-[#ff5a1f]/15 dark:border-white/12 dark:bg-white/[0.04]"
                    disabled={!jurgensDeliverySchedule}
                    id="jurgens-delivery-instructions"
                    maxLength={500}
                    onChange={(event) =>
                      setJurgensDeliverySchedule((current) =>
                        current
                          ? {
                              ...current,
                              deliveryInstructions: event.target.value,
                            }
                          : current,
                      )
                    }
                    placeholder="Gate code, preferred entrance, delivery notes..."
                    value={
                      jurgensDeliverySchedule?.deliveryInstructions ?? ""
                    }
                  />
                  <p
                    className="text-[10px] leading-4 text-[#777770] dark:text-[#aaa9a1]"
                    id="jurgens-delivery-instructions-help"
                  >
                    {jurgensDeliverySchedule
                      ? "These notes apply only to the Jurgens Energy delivery."
                      : "Select a preferred date before adding delivery notes."}
                  </p>
                </div>

              </div>
            </details>
          </section>
        ) : null}

        {checkoutStep === "shipping" ? (
          <div className="flex border-y border-[#e8e8e2] bg-white px-3 py-4 dark:border-white/10 dark:bg-[#101010] sm:rounded-md sm:border sm:px-5">
            <Button
              className="h-12 w-full sm:w-auto"
              onClick={() => visitCheckoutStep("address")}
              type="button"
              variant="outline"
            >
              <ChevronLeftIcon className="size-4" />
              Back to address
            </Button>
          </div>
        ) : null}

        {checkoutStep === "payment" ? (
          <Button
            className="h-12 w-full sm:w-fit"
            onClick={() => visitCheckoutStep("shipping")}
            type="button"
            variant="outline"
          >
            <ChevronLeftIcon className="size-4" />
            Back to shipping
          </Button>
        ) : null}

        {checkoutStep === "payment" && error ? (
          <div className="flex items-start gap-2 border-y border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 sm:rounded-md sm:border">
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        ) : null}
        </div>
      </div>

      <aside className="overflow-hidden border-y border-[#e8e8e2] bg-white dark:border-white/10 dark:bg-[#101010] sm:rounded-md sm:border lg:sticky lg:top-36">
        <div className="border-b border-[#e8e8e2] px-4 py-3 dark:border-white/10 sm:px-5">
          <h2 className="text-sm font-black uppercase">Order summary</h2>
        </div>
        <div className="grid gap-3 px-4 py-4 text-sm sm:px-5 sm:py-5">
          <div className="flex justify-between gap-4 text-[#666660] dark:text-[#aaa9a1]">
            <span>Products</span>
            <span className="tabular-nums">{formatZar(subtotal)}</span>
          </div>
          {selectedShippingOptions?.length ? (
            selectedShippingOptions.map((option) => (
              <div
                className="flex justify-between gap-4 text-[#666660] dark:text-[#aaa9a1]"
                key={option.groupKey}
              >
                <span>{option.displayLabel}</span>
                <span
                  className={cn(
                    "shrink-0 tabular-nums",
                    option.amountZar === 0 &&
                      "font-black text-emerald-700 dark:text-emerald-300",
                  )}
                >
                  {option.amountZar === 0
                    ? "FREE"
                    : formatZar(option.amountZar)}
                </span>
              </div>
            ))
          ) : (
            <div className="flex justify-between gap-4 text-[#666660] dark:text-[#aaa9a1]">
              <span>Shipping</span>
              <span className="tabular-nums">
                {isLoadingQuotes
                  ? "Calculating…"
                  : quotes || quoteError
                    ? "Unavailable"
                    : checkoutStep === "address"
                      ? "Calculated next"
                      : "Not calculated"}
              </span>
            </div>
          )}
          <div className="mt-1 flex items-end justify-between gap-4 border-t border-[#e8e8e2] pt-4 dark:border-white/10">
            <span className="font-bold">
              {allGroupsAvailable ? "Total" : "Subtotal"}
            </span>
            <span className="text-xl font-black tabular-nums">
              {formatZar(grandTotal)}
            </span>
          </div>
          {checkoutStep === "payment" ? (
            <>
              <div className="mt-2 grid grid-cols-[1.1rem_minmax(0,1fr)] items-start gap-2.5 rounded-md border border-[#e4e4de] bg-[#f7f7f2] px-3 py-3 dark:border-white/10 dark:bg-white/[0.035]">
                <input
                  aria-required="true"
                  checked={hasAcceptedPolicies}
                  className="mt-0.5 size-4 accent-[#ff5a1f]"
                  id="checkout-policy-acceptance"
                  onChange={(event) =>
                    setHasAcceptedPolicies(event.target.checked)
                  }
                  type="checkbox"
                />
                <label
                  className="text-[11px] leading-5 text-[#555550] dark:text-[#c8c8c0]"
                  htmlFor="checkout-policy-acceptance"
                >
                  I agree to the{" "}
                  <Link
                    className="font-bold text-[#080808] underline decoration-[#ff5a1f]/50 underline-offset-2 hover:text-[#ff5a1f] dark:text-white"
                    href="/terms-and-conditions"
                    rel="noreferrer"
                    target="_blank"
                  >
                    Terms &amp; Conditions
                  </Link>{" "}
                  and acknowledge the{" "}
                  <Link
                    className="font-bold text-[#080808] underline decoration-[#ff5a1f]/50 underline-offset-2 hover:text-[#ff5a1f] dark:text-white"
                    href="/privacy-policy"
                    rel="noreferrer"
                    target="_blank"
                  >
                    Privacy Policy
                  </Link>,{" "}
                  <Link
                    className="font-bold text-[#080808] underline decoration-[#ff5a1f]/50 underline-offset-2 hover:text-[#ff5a1f] dark:text-white"
                    href="/returns-and-refunds"
                    rel="noreferrer"
                    target="_blank"
                  >
                    Returns &amp; Refunds Policy
                  </Link>, and{" "}
                  <Link
                    className="font-bold text-[#080808] underline decoration-[#ff5a1f]/50 underline-offset-2 hover:text-[#ff5a1f] dark:text-white"
                    href="/delivery-information"
                    rel="noreferrer"
                    target="_blank"
                  >
                    Shipping &amp; Delivery Policy
                  </Link>
                  .
                </label>
              </div>
              <Button
                aria-busy={isCreatingOrder}
                className="mt-2 h-12 rounded-md bg-[#ff5a1f] text-sm font-bold text-white hover:bg-[#e84c15]"
                disabled={!canCreateOrder}
                onClick={() => void startHostedCheckout()}
                type="button"
              >
                {isCreatingOrder ? (
                  <LoaderCircleIcon className="size-4 animate-spin" />
                ) : (
                  <LockKeyholeIcon className="size-4" />
                )}
                Complete payment
              </Button>
              <div className="mt-1 grid gap-2 text-[10px] leading-4 text-[#666660] dark:text-[#aaa9a1]">
                <p className="flex items-center gap-2">
                  <CheckCircle2Icon className="size-3.5 text-emerald-600" />
                  VAT included in product prices.
                </p>
                <p className="flex items-center gap-2">
                  <LockKeyholeIcon className="size-3.5 text-[#ff5a1f]" />
                  Pay securely on PayFast hosted checkout.
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 flex items-start gap-2 rounded-md border border-[#e4e4de] bg-[#f7f7f2] px-3 py-3 text-[11px] leading-5 text-[#666660] dark:border-white/10 dark:bg-white/[0.035] dark:text-[#aaa9a1]">
                {checkoutStep === "address" ? (
                  <MapPinIcon className="mt-0.5 size-3.5 shrink-0 text-[#ff5a1f]" />
                ) : (
                  <TruckIcon className="mt-0.5 size-3.5 shrink-0 text-[#ff5a1f]" />
                )}
                {checkoutStep === "address"
                  ? "Enter your delivery address to calculate shipping."
                  : shippingStepReady
                    ? "Review the automatically calculated shipping charges, then continue to payment."
                    : "Shipping must be calculated before you can continue to payment."}
              </p>
              {checkoutStep === "address" ? (
                <Button
                  className="mt-2 h-12 w-full rounded-md bg-[#ff5a1f] text-sm font-bold text-white hover:bg-[#e84c15]"
                  form="checkout-address-form"
                  type="submit"
                >
                  Continue to shipping
                  <ChevronRightIcon className="size-4" />
                </Button>
              ) : (
                <Button
                  className="mt-2 h-12 w-full rounded-md bg-[#ff5a1f] text-sm font-bold text-white hover:bg-[#e84c15]"
                  disabled={!shippingStepReady}
                  onClick={continueToPayment}
                  type="button"
                >
                  Continue to payment
                  <ChevronRightIcon className="size-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
