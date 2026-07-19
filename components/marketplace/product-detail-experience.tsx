"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CreditCardIcon,
  FileTextIcon,
  FlameIcon,
  MinusIcon,
  PackageCheckIcon,
  PlusIcon,
  RefreshCcwIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  TruckIcon,
  XIcon,
  ZapIcon,
  ZoomInIcon,
} from "lucide-react";

import { marketplacePrimaryActionBaseClass } from "@/components/marketplace/action-styles";
import { MarketplaceProductCard } from "@/components/marketplace/product-card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  convertFromZar,
  formatFromZar,
  type CurrencyContext,
} from "@/src/modules/currency";
import { addLocalCartItem } from "@/src/modules/cart";
import {
  trackGoogleEvent,
  type GoogleAnalyticsItem,
} from "@/src/modules/analytics/google";
import type {
  MarketplaceProductCard as MarketplaceProductCardData,
  MarketplaceProductDetail,
  MarketplaceVariant,
} from "@/src/modules/marketplace/catalog";
import { isExchangeVariant } from "@/src/modules/marketplace/product-variant-presentation";

export type MarketplaceProductDetailView = Omit<
  MarketplaceProductDetail,
  "updatedAt"
>;

type ProductDetailExperienceProps = {
  catalogProducts: MarketplaceProductCardData[];
  currencyContext: CurrencyContext;
  initialVariantId?: string;
  jurgensDeliveryCutoffTime: string;
  product: MarketplaceProductDetailView;
  relatedProducts: MarketplaceProductCardData[];
};

type VariantMarkdownDisplay = {
  compareAtLabel: string;
  discountLabel: string;
};

const previouslyViewedLimit = 16;
const previouslyViewedStorageKey = "jurgens-energy:previously-viewed-products";

const exchangeSteps = [
  {
    description: "Eligible exchange orders can be delivered to your address.",
    icon: TruckIcon,
  },
  {
    description:
      "Hand over your compatible empty cylinder to our delivery representative.",
    icon: RefreshCcwIcon,
  },
  {
    description: "The exchange is completed after the handover checks.",
    icon: CheckCircle2Icon,
  },
] as const;

function getDisplayedCurrencyValue(
  amount: string | number,
  currencyContext: CurrencyContext,
) {
  const converted = convertFromZar(amount, currencyContext);
  const maximumFractionDigits = new Intl.NumberFormat(currencyContext.locale, {
    currency: currencyContext.currency,
    style: "currency",
  }).resolvedOptions().maximumFractionDigits ?? 2;
  const factor = 10 ** maximumFractionDigits;

  return Math.round((converted + Number.EPSILON) * factor) / factor;
}

function getGoogleAnalyticsProductItem({
  currencyContext,
  product,
  quantity,
  variant,
}: {
  currencyContext: CurrencyContext;
  product: MarketplaceProductDetailView;
  quantity: number;
  variant: MarketplaceVariant;
}): GoogleAnalyticsItem {
  return {
    affiliation: "Jurgens Energy",
    item_brand: product.brandName ?? undefined,
    item_category: product.category?.name,
    item_id: variant.id,
    item_name: product.title,
    item_variant: variant.title,
    price: getDisplayedCurrencyValue(variant.price, currencyContext),
    quantity,
  };
}

export function ProductDetailExperience({
  catalogProducts,
  currencyContext,
  initialVariantId,
  product,
  relatedProducts,
}: ProductDetailExperienceProps) {
  const sortedVariants = useMemo(
    () =>
      [...product.variants].sort(
        (first, second) => Number(first.price) - Number(second.price),
      ),
    [product.variants],
  );
  const defaultVariantId =
    product.variants.find((variant) => variant.id === initialVariantId)?.id ??
    sortedVariants[0]?.id ??
    product.variants[0]?.id ??
    "";
  const [selectedVariantId, setSelectedVariantId] = useState(defaultVariantId);
  const selectedVariant =
    product.variants.find((variant) => variant.id === selectedVariantId) ??
    sortedVariants[0] ??
    product.variants[0] ??
    null;
  const galleryImages = useMemo(
    () =>
      uniqueStrings([
        selectedVariant?.imageUrl,
        ...product.imageUrls,
        product.coverImageUrl,
        ...product.variants.map((variant) => variant.imageUrl),
      ]),
    [product.coverImageUrl, product.imageUrls, product.variants, selectedVariant],
  );
  const [activeImage, setActiveImage] = useState<string | null>(
    galleryImages[0] ?? null,
  );
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [previouslyViewedProducts, setPreviouslyViewedProducts] = useState<
    MarketplaceProductCardData[]
  >([]);
  const [quantity, setQuantity] = useState(1);
  const lastTrackedViewItemRef = useRef<string | null>(null);

  useEffect(() => {
    setSelectedVariantId(defaultVariantId);
  }, [defaultVariantId, product.id]);

  useEffect(() => {
    const productsById = new Map(
      catalogProducts.map((catalogProduct) => [catalogProduct.id, catalogProduct]),
    );
    const storedProductIds = readPreviouslyViewedProductIds();
    const visibleProductIds = storedProductIds.filter(
      (productId) => productId !== product.id,
    );
    const viewedProducts = visibleProductIds
      .map((productId) => productsById.get(productId))
      .filter((item): item is MarketplaceProductCardData => Boolean(item))
      .slice(0, 12);
    const nextProductIds = [
      product.id,
      ...visibleProductIds.filter((productId) => productsById.has(productId)),
    ].slice(0, previouslyViewedLimit);

    setPreviouslyViewedProducts(viewedProducts);
    writePreviouslyViewedProductIds(nextProductIds);
  }, [catalogProducts, product.id]);

  useEffect(() => {
    if (selectedVariant?.imageUrl) {
      setActiveImage(selectedVariant.imageUrl);
    }
  }, [selectedVariant?.imageUrl]);

  useEffect(() => {
    if (!activeImage && galleryImages[0]) {
      setActiveImage(galleryImages[0]);
    }
  }, [activeImage, galleryImages]);

  const selectedPrice = selectedVariant
    ? formatFromZar(selectedVariant.price, currencyContext)
    : product.priceLabel;

  useEffect(() => {
    if (!selectedVariant) {
      return;
    }

    const trackingKey = [
      product.id,
      selectedVariant.id,
      currencyContext.currency,
      currencyContext.rate,
    ].join(":");

    if (lastTrackedViewItemRef.current === trackingKey) {
      return;
    }

    lastTrackedViewItemRef.current = trackingKey;
    const value = getDisplayedCurrencyValue(
      selectedVariant.price,
      currencyContext,
    );

    trackGoogleEvent("view_item", {
      currency: currencyContext.currency,
      items: [
        getGoogleAnalyticsProductItem({
          currencyContext,
          product,
          quantity: 1,
          variant: selectedVariant,
        }),
      ],
      value,
    });
  }, [currencyContext, product, selectedVariant]);
  const deliveryPromise = getDeliveryPromise(product.fulfillmentMode);
  const deliveryLabel = deliveryPromise.label;
  const deliveryDetail = deliveryPromise.detail;
  const sizeLabel = getSizeLabel(selectedVariant?.title ?? product.title);
  const isSelectedVariantExchange = isExchangeVariant(selectedVariant);

  function showPreviousImage() {
    setActiveImage((current) => getAdjacentImage(galleryImages, current, -1));
  }

  function showNextImage() {
    setActiveImage((current) => getAdjacentImage(galleryImages, current, 1));
  }

  function openGallery() {
    if (activeImage) {
      setIsGalleryOpen(true);
    }
  }

  return (
    <div className="grid min-w-0 gap-0 overflow-x-clip pb-24 sm:gap-5 lg:pb-0">
      <section className="grid min-w-0 gap-0 overflow-x-clip sm:gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(24rem,0.88fr)]">
        <ProductGallery
          activeImage={activeImage}
          galleryImages={galleryImages}
          onNext={showNextImage}
          onOpenGallery={openGallery}
          onPrevious={showPreviousImage}
          onSelectImage={setActiveImage}
          productTitle={product.title}
          sizeLabel={sizeLabel}
        />

        <ProductBuyBox
          currencyContext={currencyContext}
          deliveryDetail={deliveryDetail}
          deliveryLabel={deliveryLabel}
          product={product}
          quantity={quantity}
          selectedPrice={selectedPrice}
          selectedVariant={selectedVariant}
          selectedVariantId={selectedVariantId}
          setQuantity={setQuantity}
          setSelectedVariantId={setSelectedVariantId}
        />
      </section>

      <section className="grid min-w-0 gap-2 overflow-x-clip sm:gap-5">
        {isSelectedVariantExchange ? <ExchangeStepsPanel /> : null}

        <ProductDescriptionSection product={product} />

        {relatedProducts.length > 0 ? (
          <ProductRail
            href={
              product.category ? `/categories/${product.category.path}` : "/products"
            }
            products={relatedProducts}
            title="More in this category"
            viewAllLabel="View category"
          />
        ) : null}

        {previouslyViewedProducts.length > 0 ? (
          <ProductRail
            href="/products"
            products={previouslyViewedProducts}
            title="Previously viewed"
            viewAllLabel="Continue shopping"
          />
        ) : null}
      </section>

      <ProductImageLightbox
        activeImage={activeImage}
        galleryImages={galleryImages}
        isOpen={isGalleryOpen}
        onNext={showNextImage}
        onOpenChange={setIsGalleryOpen}
        onPrevious={showPreviousImage}
        onSelectImage={setActiveImage}
        productTitle={product.title}
      />
    </div>
  );
}

function ProductGallery({
  activeImage,
  galleryImages,
  onNext,
  onOpenGallery,
  onPrevious,
  onSelectImage,
  productTitle,
  sizeLabel,
}: {
  activeImage: string | null;
  galleryImages: string[];
  onNext: () => void;
  onOpenGallery: () => void;
  onPrevious: () => void;
  onSelectImage: (image: string) => void;
  productTitle: string;
  sizeLabel: string | null;
}) {
  return (
    <div className="grid min-w-0 gap-3 lg:sticky lg:top-36 lg:self-start">
      <div className="relative aspect-square overflow-hidden border-b border-[#e8e8e2] bg-white dark:border-white/10 dark:bg-white/[0.04] sm:aspect-[1.12] sm:rounded-lg sm:border sm:shadow-sm">
        {sizeLabel ? (
          <span className="absolute left-4 top-4 z-10 rounded-md bg-white px-3 py-1.5 text-sm font-black text-[#080808] shadow-sm dark:bg-[#1a1a1a] dark:text-[#f7f7f2]">
            {sizeLabel}
          </span>
        ) : null}
        {activeImage ? (
          <>
            <Image
              alt={productTitle}
              className="object-cover"
              fill
              priority
              sizes="(min-width: 1024px) 680px, calc(100vw - 2rem)"
              src={activeImage}
            />
            <button
              aria-label="Open larger product image gallery"
              className="absolute inset-0 z-[2] cursor-zoom-in focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-[#ff5a1f]/35"
              onClick={onOpenGallery}
              type="button"
            />
          </>
        ) : (
          <div className="grid size-full place-items-center text-sm font-semibold text-slate-500">
            Jurgens Energy
          </div>
        )}
        {galleryImages.length > 1 ? (
          <>
            <button
              aria-label="Previous product image"
              className="absolute left-4 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/92 text-[#080808] shadow-sm transition hover:bg-white dark:bg-[#1a1a1a]/90 dark:text-[#f7f7f2]"
              onClick={onPrevious}
              type="button"
            >
              <ChevronLeftIcon className="size-5" />
            </button>
            <button
              aria-label="Next product image"
              className="absolute right-4 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/92 text-[#080808] shadow-sm transition hover:bg-white dark:bg-[#1a1a1a]/90 dark:text-[#f7f7f2]"
              onClick={onNext}
              type="button"
            >
              <ChevronRightIcon className="size-5" />
            </button>
          </>
        ) : null}
        <button
          aria-label="Zoom product image"
          className="absolute bottom-4 right-4 z-20 grid size-10 place-items-center rounded-full bg-white/92 text-[#080808] shadow-sm transition hover:bg-white dark:bg-[#1a1a1a]/90 dark:text-[#f7f7f2]"
          onClick={onOpenGallery}
          type="button"
        >
          <ZoomInIcon className="size-5" />
        </button>
      </div>

      {galleryImages.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:gap-3 sm:px-0 sm:pb-1 sm:pt-0 [&::-webkit-scrollbar]:hidden">
          {galleryImages.map((image) => (
            <button
              aria-label={`Show product image ${galleryImages.indexOf(image) + 1}`}
              className={cn(
                "relative aspect-[1.35] h-20 shrink-0 overflow-hidden rounded-lg border bg-white transition dark:bg-white/[0.04]",
                activeImage === image
                  ? "border-[#ff5a1f] ring-2 ring-[#ff5a1f]/15"
                  : "border-[#e8e8e2] hover:border-[#ff5a1f]/45 dark:border-white/10",
              )}
              key={image}
              onClick={() => onSelectImage(image)}
              type="button"
            >
              <Image
                alt={productTitle}
                className="object-cover"
                fill
                sizes="128px"
                src={image}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProductImageLightbox({
  activeImage,
  galleryImages,
  isOpen,
  onNext,
  onOpenChange,
  onPrevious,
  onSelectImage,
  productTitle,
}: {
  activeImage: string | null;
  galleryImages: string[];
  isOpen: boolean;
  onNext: () => void;
  onOpenChange: (open: boolean) => void;
  onPrevious: () => void;
  onSelectImage: (image: string) => void;
  productTitle: string;
}) {
  const selectedImage = activeImage ?? galleryImages[0] ?? null;
  const activeIndex = selectedImage ? galleryImages.indexOf(selectedImage) : -1;
  const displayIndex = activeIndex >= 0 ? activeIndex + 1 : 1;
  const hasMultipleImages = galleryImages.length > 1;

  useEffect(() => {
    if (!isOpen || !hasMultipleImages) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onPrevious();
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        onNext();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasMultipleImages, isOpen, onNext, onPrevious]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[min(96rem,calc(100vw-1rem))] max-w-none border border-white/10 bg-[#080808] p-0 text-white ring-white/15 sm:max-w-none"
        overlayClassName="bg-black/70 backdrop-blur-sm"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">
          {productTitle} image gallery
        </DialogTitle>
        <DialogDescription className="sr-only">
          View larger product images and use thumbnails or arrow keys to move
          through the gallery.
        </DialogDescription>
        <DialogClose className="absolute right-4 top-4 z-30 grid size-10 place-items-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/35">
          <XIcon className="size-5" />
          <span className="sr-only">Close image gallery</span>
        </DialogClose>

        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto]">
          <header className="min-w-0 border-b border-white/10 px-4 py-3 pr-16 sm:px-5">
            <p className="truncate text-sm font-black text-white">
              {productTitle}
            </p>
            <p className="mt-1 text-xs font-semibold text-white/60">
              Image {displayIndex} of {Math.max(galleryImages.length, 1)}
            </p>
          </header>

          <div className="relative min-h-0 bg-[#080808]">
            {selectedImage ? (
              <Image
                alt={productTitle}
                className="object-contain"
                fill
                priority
                sizes="100vw"
                src={selectedImage}
              />
            ) : (
              <div className="grid size-full place-items-center text-sm font-semibold text-white/60">
                Jurgens Energy
              </div>
            )}

            {hasMultipleImages ? (
              <>
                <button
                  aria-label="Previous product image"
                  className="absolute left-3 top-1/2 z-20 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/35 sm:left-5"
                  onClick={onPrevious}
                  type="button"
                >
                  <ChevronLeftIcon className="size-6" />
                </button>
                <button
                  aria-label="Next product image"
                  className="absolute right-3 top-1/2 z-20 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/35 sm:right-5"
                  onClick={onNext}
                  type="button"
                >
                  <ChevronRightIcon className="size-6" />
                </button>
              </>
            ) : null}
          </div>

          {hasMultipleImages ? (
            <div className="border-t border-white/10 bg-[#080808]/95 px-4 py-3 sm:px-5">
              <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {galleryImages.map((image, index) => (
                  <button
                    aria-label={`Show product image ${index + 1}`}
                    className={cn(
                      "relative aspect-[1.28] h-16 shrink-0 overflow-hidden rounded-lg border bg-white/8 transition sm:h-20",
                      selectedImage === image
                        ? "border-[#ff5a1f] ring-2 ring-[#ff5a1f]/30"
                        : "border-white/12 hover:border-white/35",
                    )}
                    key={image}
                    onClick={() => onSelectImage(image)}
                    type="button"
                  >
                    <Image
                      alt={`${productTitle} thumbnail ${index + 1}`}
                      className="object-cover"
                      fill
                      sizes="120px"
                      src={image}
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProductBuyBox({
  currencyContext,
  deliveryDetail,
  deliveryLabel,
  product,
  quantity,
  selectedPrice,
  selectedVariant,
  selectedVariantId,
  setQuantity,
  setSelectedVariantId,
}: {
  currencyContext: CurrencyContext;
  deliveryDetail: string;
  deliveryLabel: string;
  product: MarketplaceProductDetailView;
  quantity: number;
  selectedPrice: string;
  selectedVariant: MarketplaceVariant | null;
  selectedVariantId: string;
  setQuantity: (quantity: number) => void;
  setSelectedVariantId: (variantId: string) => void;
}) {
  const hasExchangeRequirement = isExchangeVariant(selectedVariant);
  const [exchangeConfirmed, setExchangeConfirmed] = useState(false);
  const [added, setAdded] = useState(false);
  const [isOptionsDialogOpen, setIsOptionsDialogOpen] = useState(false);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exchangeAcceptedReturnBrands =
    selectedVariant?.exchangeAcceptedReturnBrands ?? [];
  const exchangeEmptySize = getExchangeEmptySize(product, selectedVariant);
  const exchangeConfirmationText = selectedVariant
    ? getExchangeConfirmationText({
        product,
        quantity,
        variant: selectedVariant,
      })
    : "";
  const canAddToCart =
    Boolean(selectedVariant) && (!hasExchangeRequirement || exchangeConfirmed);
  const needsExchangeConfirmation =
    hasExchangeRequirement && !exchangeConfirmed;
  const needsMobileOptionsDialog =
    product.variants.length > 1 ||
    hasExchangeRequirement ||
    needsExchangeConfirmation;
  const mobilePrimaryActionLabel = added
    ? "Added"
    : needsMobileOptionsDialog
      ? needsExchangeConfirmation
        ? "Confirm Exchange First"
        : "Select An Option"
      : "Add To Cart";
  const selectedPriceMarkdown = selectedVariant
    ? getVariantMarkdownDisplay(selectedVariant, currencyContext)
    : null;
  const topSoldVariantId = getTopSoldVariantId(product.variants);

  useEffect(() => {
    setExchangeConfirmed(false);
    setAdded(false);
  }, [selectedVariantId]);

  useEffect(
    () => () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    },
    [],
  );

  function handleAddToCart({ closeOptions = false } = {}) {
    if (!selectedVariant || !canAddToCart) {
      return;
    }

    addLocalCartItem({
      brandName: product.brandName,
      exchangeAcceptedReturnBrands,
      exchangeConfirmationText,
      exchangeEmptyConfirmed: hasExchangeRequirement ? exchangeConfirmed : false,
      exchangeRequiredEmptyCylinderSize: exchangeEmptySize,
      imageUrl: selectedVariant.imageUrl ?? product.coverImageUrl,
      priceLabel: selectedPrice,
      productId: product.id,
      purchaseType: hasExchangeRequirement ? "exchange" : "standard",
      quantity,
      slug: product.slug,
      title:
        product.variants.length > 1
          ? `${product.title} - ${selectedVariant.title}`
          : product.title,
      variantId: selectedVariant.id,
    });

    trackGoogleEvent("add_to_cart", {
      currency: currencyContext.currency,
      items: [
        getGoogleAnalyticsProductItem({
          currencyContext,
          product,
          quantity,
          variant: selectedVariant,
        }),
      ],
      value: getDisplayedCurrencyValue(
        Number(selectedVariant.price) * quantity,
        currencyContext,
      ),
    });

    setAdded(true);

    if (closeOptions) {
      setIsOptionsDialogOpen(false);
    }

    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }

    resetTimeoutRef.current = setTimeout(() => setAdded(false), 1600);
  }

  function handleMobilePrimaryAction() {
    if (needsMobileOptionsDialog) {
      setIsOptionsDialogOpen(true);
      return;
    }

    handleAddToCart();
  }

  return (
    <>
      <MobileProductPurchaseSummary
        currencyContext={currencyContext}
        deliveryDetail={deliveryDetail}
        deliveryLabel={deliveryLabel}
        isInStock={selectedVariant?.inStock ?? product.inStock}
        onOpenOptions={() => setIsOptionsDialogOpen(true)}
        onSelectVariant={setSelectedVariantId}
        product={product}
        selectedPriceMarkdown={selectedPriceMarkdown}
        selectedPrice={selectedPrice}
        selectedVariant={selectedVariant}
        selectedVariantId={selectedVariantId}
        topSoldVariantId={topSoldVariantId}
      />

      <aside className="hidden h-fit min-w-0 max-w-full gap-4 overflow-hidden rounded-lg border border-[#e8e8e2] bg-white p-4 shadow-[0_16px_40px_rgba(8,8,8,0.05)] dark:border-white/10 dark:bg-white/[0.04] sm:gap-5 sm:p-5 lg:grid">
      <div className="grid gap-3 border-b border-[#ecece6] pb-4 dark:border-white/10 sm:pb-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-bold text-[#080808] dark:text-[#f7f7f2] sm:gap-3 sm:text-sm">
          <Badge className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-300 sm:px-3 sm:text-xs">
            {selectedVariant?.inStock ?? product.inStock ? "In Stock" : "Backorder"}
          </Badge>
          <span className="inline-flex min-w-0 items-center gap-1.5 leading-5 sm:gap-2">
            <TruckIcon className="size-3.5 shrink-0 sm:size-4" />
            {deliveryLabel}
          </span>
        </div>

        <div>
          <h1 className="max-w-full break-words text-[24px] font-black leading-[1.08] text-[#080808] dark:text-[#f7f7f2] sm:text-[30px] lg:text-[34px]">
            {product.title}
          </h1>
          <PriceWithMarkdown
            className="mt-2 sm:mt-3"
            compareAtClassName="text-sm sm:text-base"
            currentClassName="text-[24px] sm:text-[28px]"
            markdown={selectedPriceMarkdown}
            price={selectedPrice}
          />
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold leading-5 text-slate-600 dark:text-zinc-300 sm:text-sm">
            <span>VAT included</span>
            <span className="text-slate-400">•</span>
            <DeliveryDetailInline detail={deliveryDetail} />
          </p>
        </div>

        {product.shortDescription ? (
          <p className="text-xs leading-6 text-slate-600 dark:text-zinc-300 sm:text-sm sm:leading-7">
            {cleanInlineText(product.shortDescription)}
          </p>
        ) : null}
      </div>

      {product.variants.length > 0 ? (
        <ProductVariantSelector
          currencyContext={currencyContext}
          className="w-full"
          onOpenOptions={() => setIsOptionsDialogOpen(true)}
          onSelectVariant={setSelectedVariantId}
          product={product}
          selectedVariant={selectedVariant}
          selectedVariantId={selectedVariantId}
          topSoldVariantId={topSoldVariantId}
        />
      ) : null}

      {hasExchangeRequirement ? (
        <ExchangeConfirmationPanel
          acceptedReturnBrands={exchangeAcceptedReturnBrands}
          confirmationText={exchangeConfirmationText}
          emptySize={exchangeEmptySize}
          isConfirmed={exchangeConfirmed}
          onConfirmedChange={setExchangeConfirmed}
          quantity={quantity}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
        <div className="grid gap-2">
          <span className="text-sm font-black leading-none text-[#080808] dark:text-[#f7f7f2]">
            Quantity
          </span>
          <div className="inline-grid h-11 grid-cols-3 overflow-hidden rounded-md border border-[#e8e8e2] bg-white dark:border-white/10 dark:bg-white/[0.04]">
            <button
              aria-label="Decrease quantity"
              className="grid w-11 place-items-center transition hover:bg-[#f7f7f2] dark:hover:bg-white/10"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              type="button"
            >
              <MinusIcon className="size-4" />
            </button>
            <span className="grid w-11 place-items-center border-x border-[#e8e8e2] text-sm font-black dark:border-white/10">
              {quantity}
            </span>
            <button
              aria-label="Increase quantity"
              className="grid w-11 place-items-center transition hover:bg-[#f7f7f2] dark:hover:bg-white/10"
              onClick={() => setQuantity(quantity + 1)}
              type="button"
            >
              <PlusIcon className="size-4" />
            </button>
          </div>
        </div>

        <button
          className={cn(
            marketplacePrimaryActionBaseClass,
            "inline-flex h-11 w-full gap-2 text-[13px] disabled:cursor-not-allowed disabled:bg-[#cfcfca] disabled:text-white disabled:shadow-none disabled:hover:bg-[#cfcfca]",
          )}
          disabled={!canAddToCart}
          onClick={() => handleAddToCart()}
          type="button"
        >
          {added ? (
            <CheckIcon className="size-4 shrink-0" />
          ) : (
            <ShoppingCartIcon className="size-4 shrink-0" />
          )}
          <span className="leading-none">
            {added
              ? "Added"
              : needsExchangeConfirmation
                ? "Confirm Exchange First"
                : "Add To Cart"}
          </span>
        </button>
      </div>

      <button
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[#ff5a1f] bg-white px-4 text-[13px] font-black uppercase leading-none text-[#ff5a1f] transition hover:bg-[#fff3ec] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/20 disabled:cursor-not-allowed disabled:border-[#cfcfca] disabled:bg-[#f7f7f2] disabled:text-slate-400 disabled:hover:bg-[#f7f7f2] dark:bg-white/[0.04] dark:hover:bg-[#ff5a1f]/10 dark:disabled:border-white/10 dark:disabled:bg-white/[0.03] dark:disabled:text-zinc-500"
        disabled={!canAddToCart}
        onClick={() => handleAddToCart()}
        type="button"
      >
        <ZapIcon className="size-4 shrink-0" />
        <span className="leading-none">
          {needsExchangeConfirmation ? "Confirm Exchange First" : "Buy Now"}
        </span>
      </button>
      </aside>

      <ProductOptionsDialog
        added={added}
        canAddToCart={canAddToCart}
        currencyContext={currencyContext}
        deliveryDetail={deliveryDetail}
        exchangeAcceptedReturnBrands={exchangeAcceptedReturnBrands}
        exchangeConfirmationText={exchangeConfirmationText}
        exchangeConfirmed={exchangeConfirmed}
        exchangeEmptySize={exchangeEmptySize}
        hasExchangeRequirement={hasExchangeRequirement}
        isOpen={isOptionsDialogOpen}
        needsExchangeConfirmation={needsExchangeConfirmation}
        onAddToCart={() => handleAddToCart({ closeOptions: true })}
        onExchangeConfirmedChange={setExchangeConfirmed}
        onOpenChange={setIsOptionsDialogOpen}
        product={product}
        quantity={quantity}
        selectedPriceMarkdown={selectedPriceMarkdown}
        selectedPrice={selectedPrice}
        selectedVariant={selectedVariant}
        selectedVariantId={selectedVariantId}
        setQuantity={setQuantity}
        setSelectedVariantId={setSelectedVariantId}
        topSoldVariantId={topSoldVariantId}
      />

      <MobileStickyPurchaseBar
        added={added}
        deliveryDetail={deliveryDetail}
        label={mobilePrimaryActionLabel}
        needsExchangeConfirmation={needsExchangeConfirmation}
        onAction={handleMobilePrimaryAction}
        selectedPrice={selectedPrice}
      />
    </>
  );
}

function MobileProductPurchaseSummary({
  currencyContext,
  deliveryDetail,
  deliveryLabel,
  isInStock,
  onOpenOptions,
  onSelectVariant,
  product,
  selectedPriceMarkdown,
  selectedPrice,
  selectedVariant,
  selectedVariantId,
  topSoldVariantId,
}: {
  currencyContext: CurrencyContext;
  deliveryDetail: string;
  deliveryLabel: string;
  isInStock: boolean;
  onOpenOptions: () => void;
  onSelectVariant: (variantId: string) => void;
  product: MarketplaceProductDetailView;
  selectedPriceMarkdown: VariantMarkdownDisplay | null;
  selectedPrice: string;
  selectedVariant: MarketplaceVariant | null;
  selectedVariantId: string;
  topSoldVariantId: string | null;
}) {
  const shortDescription = product.shortDescription
    ? cleanInlineText(product.shortDescription)
    : null;

  return (
    <div className="grid min-w-0 gap-0 lg:hidden">
      <MobileTrustTicker
        deliveryLabel={
          product.fulfillmentMode === "piessang_fulfilled"
            ? "Local delivery zones"
            : "Courier rates"
        }
      />

      <section className="grid gap-2.5 border-b border-[#e8e8e2] bg-white px-4 py-3.5 dark:border-white/10 dark:bg-white/[0.04] sm:rounded-lg sm:border sm:p-3 sm:shadow-sm">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] font-bold text-[#080808] dark:text-[#f7f7f2]">
          <Badge
            className={cn(
              "h-5 rounded-full px-2 text-[10px] font-black",
              isInStock
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-300"
                : "bg-[#1a1a1a] text-white dark:bg-[#f7f7f2] dark:text-[#080808]",
            )}
          >
            {isInStock ? "In Stock" : "Backorder"}
          </Badge>
          <span className="inline-flex min-w-0 items-center gap-1.5 leading-5">
            <TruckIcon className="size-3.5 shrink-0" />
            <span className="truncate">{deliveryLabel}</span>
          </span>
        </div>

        <div className="grid gap-1.5">
          <h1 className="text-[20px] font-black leading-[1.08] text-[#080808] dark:text-[#f7f7f2]">
            {product.title}
          </h1>
          <PriceWithMarkdown
            compareAtClassName="text-[11px]"
            currentClassName="text-[22px]"
            markdown={selectedPriceMarkdown}
            price={selectedPrice}
          />
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] font-semibold leading-4 text-slate-600 dark:text-zinc-300">
            <span>VAT included</span>
            <span className="text-slate-400">•</span>
            <DeliveryDetailInline detail={deliveryDetail} />
          </p>
        </div>

        {shortDescription ? (
          <MobileExpandableDescription text={shortDescription} />
        ) : null}
      </section>

      <ProductVariantSelector
        currencyContext={currencyContext}
        className="mx-4 mb-2 mt-2 sm:mx-0"
        onOpenOptions={onOpenOptions}
        onSelectVariant={onSelectVariant}
        product={product}
        selectedVariant={selectedVariant}
        selectedVariantId={selectedVariantId}
        topSoldVariantId={topSoldVariantId}
      />

      <MobileConfidenceRows
        deliveryDetail={deliveryDetail}
        isExchangeSelected={isExchangeVariant(selectedVariant)}
      />
    </div>
  );
}

function ProductVariantSelector({
  className,
  currencyContext,
  onOpenOptions,
  onSelectVariant,
  product,
  selectedVariant,
  selectedVariantId,
  topSoldVariantId,
}: {
  className?: string;
  currencyContext: CurrencyContext;
  onOpenOptions: () => void;
  onSelectVariant: (variantId: string) => void;
  product: MarketplaceProductDetailView;
  selectedVariant: MarketplaceVariant | null;
  selectedVariantId: string;
  topSoldVariantId: string | null;
}) {
  const previewVariants = getVariantPreviewList(
    product.variants,
    selectedVariant?.id ?? null,
    topSoldVariantId,
  );
  const optionGroupLabel = getVariantOptionGroupLabel(product);
  const optionCountLabel =
    product.variants.length === 1
      ? "1 option"
      : `${product.variants.length} options`;

  return (
    <section className={cn("grid min-w-0", className)}>
      <button
        aria-label={`Select ${optionGroupLabel}`}
        className="grid min-w-0 rounded-[3px] border border-solid border-[#080808] bg-white px-2.5 py-2 text-left transition hover:border-[#ff5a1f] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/20 dark:border-white/20 dark:bg-white/[0.04] sm:rounded-lg sm:p-2.5 lg:hidden"
        onClick={onOpenOptions}
        type="button"
      >
        <span className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <span className="min-w-0">
            <span className="block text-[13px] font-black text-[#080808] dark:text-[#f7f7f2]">
              {optionGroupLabel}
            </span>
            <span className="mt-0.5 block truncate text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
              {selectedVariant
                ? `${optionCountLabel} • Selected: ${selectedVariant.title}`
                : optionCountLabel}
            </span>
          </span>
          <span className="inline-flex items-start gap-1.5 pt-0.5 text-xs font-black text-[#080808] dark:text-[#f7f7f2]">
            Select
            <ChevronRightIcon className="size-4 shrink-0" />
          </span>
        </span>

        {previewVariants.length > 0 ? (
          <span className="mt-1.5 flex min-w-0 gap-1 overflow-hidden">
            {previewVariants.map((variant) => (
              <span
                className={cn(
                  "relative aspect-square h-8 overflow-hidden rounded-[3px] border border-solid border-transparent bg-[#f7f7f2] dark:bg-[#1a1a1a]",
                  selectedVariant?.id === variant.id
                    ? "border-[#080808] ring-1 ring-inset ring-[#080808]"
                    : "",
                )}
                key={variant.id}
              >
                {variant.id === topSoldVariantId ? <TopVariantBadge /> : null}
                {variant.imageUrl ? (
                  <Image
                    alt={`${product.title} ${variant.title}`}
                    className="object-cover"
                    fill
                    sizes="40px"
                    src={variant.imageUrl}
                  />
                ) : (
                  <span className="grid size-full place-items-center text-[#ff5a1f]">
                    <PackageCheckIcon className="size-5" />
                  </span>
                )}
              </span>
            ))}
          </span>
        ) : null}
      </button>

      <div className="hidden gap-2.5 lg:grid">
        <h2 className="text-sm font-black text-[#080808] dark:text-[#f7f7f2]">
          {optionGroupLabel}
        </h2>
        <VariantSelectionList
          currencyContext={currencyContext}
          layout="tile"
          onSelectVariant={onSelectVariant}
          productTitle={product.title}
          selectedVariantId={selectedVariantId}
          topSoldVariantId={topSoldVariantId}
          variants={product.variants}
        />
      </div>
    </section>
  );
}

function MobileExpandableDescription({ text }: { text: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const canToggle = text.length > 118;
  const previewText = text.slice(0, 112).trimEnd().replace(/[.,;:!-]+$/, "");
  const visibleText =
    canToggle && !isExpanded ? `${previewText}...` : text;

  return (
    <div>
      <p className="text-[11px] leading-5 text-slate-600 dark:text-zinc-300">
        {visibleText}
        {canToggle ? (
          <>
            {" "}
            <button
              className="inline align-baseline text-[11px] font-black leading-[inherit] text-[#ff5a1f] transition hover:text-[#d43f0c] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/20"
              onClick={() => setIsExpanded((current) => !current)}
              type="button"
            >
              {isExpanded ? "Show less" : "Show more"}
            </button>
          </>
        ) : null}
      </p>
    </div>
  );
}

function PriceWithMarkdown({
  className,
  compareAtClassName,
  currentClassName,
  discountClassName,
  gapClassName = "gap-x-2 gap-y-1",
  markdown,
  price,
}: {
  className?: string;
  compareAtClassName?: string;
  currentClassName?: string;
  discountClassName?: string;
  gapClassName?: string;
  markdown: VariantMarkdownDisplay | null;
  price: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-wrap items-center", gapClassName, className)}>
      <span
        className={cn(
          "font-black leading-none text-[#ff5a1f]",
          currentClassName,
        )}
      >
        {price}
      </span>
      {markdown ? (
        <>
          <span
            className={cn(
              "font-bold leading-none text-slate-400 line-through dark:text-zinc-500",
              compareAtClassName,
            )}
          >
            {markdown.compareAtLabel}
          </span>
          <span
            className={cn(
              "rounded-sm bg-orange-50 px-1.5 py-0.5 text-[9px] font-black uppercase leading-none text-[#ff5a1f] dark:bg-orange-500/10",
              discountClassName,
            )}
          >
            {markdown.discountLabel}
          </span>
        </>
      ) : null}
    </div>
  );
}

function DeliveryDetailInline({ detail }: { detail: string }) {
  return <span>{detail}</span>;
}

function ProductOptionsDialog({
  added,
  canAddToCart,
  currencyContext,
  deliveryDetail,
  exchangeAcceptedReturnBrands,
  exchangeConfirmationText,
  exchangeConfirmed,
  exchangeEmptySize,
  hasExchangeRequirement,
  isOpen,
  needsExchangeConfirmation,
  onAddToCart,
  onExchangeConfirmedChange,
  onOpenChange,
  product,
  quantity,
  selectedPriceMarkdown,
  selectedPrice,
  selectedVariant,
  selectedVariantId,
  setQuantity,
  setSelectedVariantId,
  topSoldVariantId,
}: {
  added: boolean;
  canAddToCart: boolean;
  currencyContext: CurrencyContext;
  deliveryDetail: string;
  exchangeAcceptedReturnBrands: string[];
  exchangeConfirmationText: string;
  exchangeConfirmed: boolean;
  exchangeEmptySize: string | null;
  hasExchangeRequirement: boolean;
  isOpen: boolean;
  needsExchangeConfirmation: boolean;
  onAddToCart: () => void;
  onExchangeConfirmedChange: (checked: boolean) => void;
  onOpenChange: (open: boolean) => void;
  product: MarketplaceProductDetailView;
  quantity: number;
  selectedPriceMarkdown: VariantMarkdownDisplay | null;
  selectedPrice: string;
  selectedVariant: MarketplaceVariant | null;
  selectedVariantId: string;
  setQuantity: (quantity: number) => void;
  setSelectedVariantId: (variantId: string) => void;
  topSoldVariantId: string | null;
}) {
  const selectedImage = selectedVariant?.imageUrl ?? product.coverImageUrl;
  const variantOptionLabel = getVariantOptionGroupLabel(product);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="bottom-0 left-0 top-auto h-auto max-h-[min(82dvh,40rem)] w-full max-w-full translate-x-0 translate-y-0 rounded-b-none rounded-t-xl border border-[#e8e8e2] bg-white p-0 text-[#080808] ring-[#080808]/10 dark:border-white/10 dark:bg-[#101010] dark:text-[#f7f7f2] sm:max-w-full lg:bottom-auto lg:left-1/2 lg:top-1/2 lg:w-[min(32rem,calc(100vw-2rem))] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-xl"
        overlayClassName="bg-black/55"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">
          Select {variantOptionLabel}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {hasExchangeRequirement
            ? `Choose ${variantOptionLabel}, confirm the exchange requirements, and add the item to your cart.`
            : `Choose ${variantOptionLabel} and add the item to your cart.`}
        </DialogDescription>

        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[#d8d8d2] dark:bg-white/20" />

        <header className="grid shrink-0 grid-cols-[3.75rem_minmax(0,1fr)_2.25rem] gap-3 border-b border-[#ecece6] px-3 pb-3 pt-2.5 dark:border-white/10">
          <div className="relative aspect-square overflow-hidden rounded-md bg-[#f7f7f2] dark:bg-[#1a1a1a]">
            {selectedImage ? (
              <Image
                alt={product.title}
                className="object-cover"
                fill
                sizes="60px"
                src={selectedImage}
              />
            ) : (
              <span className="grid size-full place-items-center text-[#ff5a1f]">
                <PackageCheckIcon className="size-6" />
              </span>
            )}
          </div>
          <div className="min-w-0 self-start">
            <p className="truncate text-xs font-bold text-slate-600 dark:text-zinc-300">
              {product.title}
            </p>
            <PriceWithMarkdown
              className="mt-1"
              compareAtClassName="text-[11px]"
              currentClassName="text-lg text-[#080808] dark:text-[#f7f7f2]"
              markdown={selectedPriceMarkdown}
              price={selectedPrice}
            />
            <p className="mt-1 truncate text-xs font-semibold text-slate-500 dark:text-zinc-400">
              VAT included. {deliveryDetail}.
            </p>
          </div>
          <DialogClose className="grid size-9 place-items-center rounded-full text-[#080808] transition hover:bg-[#f7f7f2] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/20 dark:text-[#f7f7f2] dark:hover:bg-white/10">
            <XIcon className="size-5" />
            <span className="sr-only">Close product options</span>
          </DialogClose>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-24 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {product.variants.length > 0 ? (
            <section className="grid gap-2.5">
              <h2 className="text-sm font-black text-[#080808] dark:text-[#f7f7f2]">
                {variantOptionLabel}
              </h2>
              <VariantSelectionList
                currencyContext={currencyContext}
                layout="tile"
                onSelectVariant={setSelectedVariantId}
                productTitle={product.title}
                selectedVariantId={selectedVariantId}
                topSoldVariantId={topSoldVariantId}
                variants={product.variants}
              />
            </section>
          ) : null}

          {hasExchangeRequirement ? (
            <ExchangeConfirmationPanel
              acceptedReturnBrands={exchangeAcceptedReturnBrands}
              className="mt-3"
              confirmationText={exchangeConfirmationText}
              emptySize={exchangeEmptySize}
              isConfirmed={exchangeConfirmed}
              onConfirmedChange={onExchangeConfirmedChange}
              quantity={quantity}
            />
          ) : null}

          <CompactTrustRow className="mt-3" deliveryLabel="Delivery options" />

          <section className="mt-3 grid gap-1.5">
            <h2 className="text-xs font-black text-[#080808] dark:text-[#f7f7f2]">
              Qty
            </h2>
            <QuantityStepper quantity={quantity} setQuantity={setQuantity} />
          </section>
        </div>

        <footer className="absolute inset-x-0 bottom-0 z-10 grid gap-2 border-t border-[#e8e8e2] bg-white px-3 py-2.5 shadow-[0_-12px_28px_rgba(8,8,8,0.08)] dark:border-white/10 dark:bg-[#101010]">
          <p className="text-center text-xs font-semibold text-[#080808] dark:text-[#f7f7f2]">
            Order details are confirmed before payment.
          </p>
          <button
            className={cn(
              marketplacePrimaryActionBaseClass,
              "inline-flex h-11 w-full rounded-full text-[13px] disabled:cursor-not-allowed disabled:bg-[#cfcfca] disabled:text-white disabled:shadow-none disabled:hover:bg-[#cfcfca]",
            )}
            disabled={!canAddToCart}
            onClick={onAddToCart}
            type="button"
          >
            {added ? (
              <CheckIcon className="size-4 shrink-0" />
            ) : (
              <ShoppingCartIcon className="size-4 shrink-0" />
            )}
            <span>
              {added
                ? "Added"
                : needsExchangeConfirmation
                  ? "Confirm Exchange First"
                  : "Add To Cart"}
            </span>
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function VariantSelectionList({
  currencyContext,
  layout,
  onSelectVariant,
  productTitle,
  selectedVariantId,
  topSoldVariantId,
  variants,
}: {
  currencyContext: CurrencyContext;
  layout: "card" | "tile";
  onSelectVariant: (variantId: string) => void;
  productTitle: string;
  selectedVariantId: string;
  topSoldVariantId: string | null;
  variants: MarketplaceVariant[];
}) {
  return (
    <div
      className={cn(
        "grid gap-2",
        layout === "tile" && "grid-cols-3 gap-1.5 sm:grid-cols-4 lg:flex lg:flex-wrap lg:gap-2",
      )}
      role="radiogroup"
    >
      {variants.map((variant) => (
        <VariantOptionCard
          currencyContext={currencyContext}
          isTopSold={variant.id === topSoldVariantId}
          isSelected={selectedVariantId === variant.id}
          key={variant.id}
          layout={layout}
          onSelect={() => onSelectVariant(variant.id)}
          productTitle={productTitle}
          variant={variant}
        />
      ))}
    </div>
  );
}

function VariantOptionCard({
  currencyContext,
  isSelected,
  isTopSold,
  layout,
  onSelect,
  productTitle,
  variant,
}: {
  currencyContext: CurrencyContext;
  isSelected: boolean;
  isTopSold: boolean;
  layout: "card" | "tile";
  onSelect: () => void;
  productTitle: string;
  variant: MarketplaceVariant;
}) {
  const markdown = getVariantMarkdownDisplay(variant, currencyContext);
  const isTile = layout === "tile";

  return (
    <button
      aria-checked={isSelected}
      className={cn(
        "relative grid min-w-0 overflow-hidden border border-solid border-[#080808] bg-white shadow-sm transition hover:border-[#ff5a1f] dark:bg-white/[0.03]",
        isTile
          ? "grid-cols-1 gap-1 rounded-[3px] p-1 text-center lg:w-[5.75rem]"
          : "grid-cols-[4.25rem_minmax(0,1fr)_2rem] items-start gap-3 rounded-[6px] p-2 text-left",
        isSelected
          ? "bg-[#fffaf6] ring-2 ring-[#ff5a1f]/35 dark:bg-orange-500/10"
          : "",
      )}
      onClick={onSelect}
      role="radio"
      type="button"
    >
      <span className="relative aspect-square overflow-hidden rounded-[4px] bg-[#f7f7f2] dark:bg-[#1a1a1a]">
        {isTopSold ? (
          <TopVariantBadge
            className={cn(
              "h-4 text-[7px]",
              isExchangeVariant(variant) && "bottom-0 top-auto",
            )}
          />
        ) : null}
        {variant.imageUrl ? (
          <Image
            alt={`${productTitle} ${variant.title}`}
            className="object-cover"
            fill
            sizes={isTile ? "33vw" : "68px"}
            src={variant.imageUrl}
          />
        ) : (
          <span className="grid size-full place-items-center text-[#ff5a1f]">
            <PackageCheckIcon className="size-5" />
          </span>
        )}
        {isExchangeVariant(variant) ? (
          <Badge className="absolute left-0 top-0 h-5 rounded-none bg-[#ff5a1f] px-1.5 text-[8px] font-black uppercase leading-none text-white shadow-sm">
            Exchange
          </Badge>
        ) : null}
      </span>
      <span
        className={cn(
          "grid min-w-0 gap-1.5",
          isTile && "gap-0.5",
        )}
      >
        <span
          className={cn(
            "truncate text-[15px] font-black leading-5 text-[#080808] dark:text-[#f7f7f2]",
            isTile && "text-[11px] leading-4",
          )}
        >
          {variant.title}
        </span>
        <PriceWithMarkdown
          className={isTile ? "hidden" : undefined}
          compareAtClassName="text-[10px]"
          currentClassName="text-[13px]"
          discountClassName="text-[8px]"
          gapClassName="gap-x-1 gap-y-1"
          markdown={markdown}
          price={formatFromZar(variant.price, currencyContext)}
        />
      </span>
      <span
        className={cn(
          "grid size-8 place-items-center rounded-full border bg-white shadow-sm dark:bg-[#101010]",
          isTile && "absolute right-1 top-1 size-5",
          isSelected
            ? "border-[#ff5a1f] text-[#ff5a1f]"
            : "border-[#d8d8d2] text-transparent",
        )}
      >
        <CheckIcon
          className={cn("size-5", isTile && "size-3.5")}
        />
      </span>
    </button>
  );
}

function MobileTrustTicker({ deliveryLabel }: { deliveryLabel: string }) {
  const items = [
    { icon: ShieldCheckIcon, label: "Safety-first handling" },
    { icon: TruckIcon, label: deliveryLabel },
    { icon: CreditCardIcon, label: "Secure payments" },
    { icon: FileTextIcon, label: "VAT included" },
  ] as const;

  return (
    <div className="flex min-w-0 overflow-x-auto border-b border-[#f2e3d9] bg-[#fff3ec] px-4 py-1.5 text-[11px] font-black leading-none text-[#080808] [scrollbar-width:none] dark:border-white/10 dark:bg-orange-500/10 dark:text-[#f7f7f2] sm:rounded-lg sm:border [&::-webkit-scrollbar]:hidden">
      {items.map((item, index) => {
        const Icon = item.icon;

        return (
          <span
            className="inline-flex shrink-0 items-center gap-1.5"
            key={item.label}
          >
            {index > 0 ? (
              <span className="mx-2 h-4 w-px bg-[#e4c9ba] dark:bg-white/10" />
            ) : null}
            <span className="grid size-4 shrink-0 place-items-center rounded-full bg-emerald-700 text-white dark:bg-emerald-400 dark:text-[#080808]">
              <Icon className="size-2.5 stroke-[2.5]" />
            </span>
            {item.label}
          </span>
        );
      })}
    </div>
  );
}

function MobileConfidenceRows({
  deliveryDetail,
  isExchangeSelected,
}: {
  deliveryDetail: string;
  isExchangeSelected: boolean;
}) {
  const rows = [
    {
      detail:
        deliveryDetail === "Delivery by Jurgens Energy"
          ? "Jurgens Energy direct delivery."
          : deliveryDetail,
      icon: TruckIcon,
      title: "Delivery confirmed at checkout",
    },
    {
      detail: "PayFast secure card payments.",
      icon: CreditCardIcon,
      title: "Safe payments • Secure checkout",
    },
    {
      detail: "Support before, during and after delivery.",
      icon: ShieldCheckIcon,
      title: "Order support",
    },
    ...(isExchangeSelected
      ? [
          {
            detail: "Empty confirmation before checkout.",
            icon: RefreshCcwIcon,
            title: "Exchange checked on delivery",
          },
        ]
      : []),
  ];

  return (
    <section className="overflow-hidden border-b border-[#e8e8e2] bg-white dark:border-white/10 dark:bg-white/[0.04] sm:mt-2 sm:rounded-lg sm:border sm:shadow-sm">
      {rows.map((row, index) => {
        const Icon = row.icon;

        return (
          <div
            className={cn(
              "grid min-w-0 grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-2 px-2.5 py-1.5",
              index > 0 && "border-t border-[#eeeeea] dark:border-white/10",
            )}
            key={row.title}
          >
            <span className="grid size-5 place-items-center rounded-full bg-emerald-700 text-white dark:bg-emerald-400 dark:text-[#080808]">
              <Icon className="size-3 stroke-[2.5]" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[11px] font-black leading-4 text-[#080808] dark:text-[#f7f7f2]">
                {row.title}
              </span>
              <span className="mt-0.5 block truncate text-[10px] font-semibold leading-4 text-slate-500 dark:text-zinc-400">
                {row.detail}
              </span>
            </span>
          </div>
        );
      })}
    </section>
  );
}

function CompactTrustRow({
  className,
  deliveryLabel,
}: {
  className?: string;
  deliveryLabel: string;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 items-start gap-2 rounded-lg border border-[#e8e8e2] bg-white px-3 py-2 text-[11px] font-black uppercase leading-none text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200",
        className,
      )}
    >
      <span className="inline-flex min-w-0 items-start gap-1.5">
        <span className="grid size-4 shrink-0 place-items-center rounded-full bg-emerald-700 text-white dark:bg-emerald-400 dark:text-[#080808]">
          <ShieldCheckIcon className="size-2.5 stroke-[2.5]" />
        </span>
        <span className="truncate">Safety-first handling</span>
      </span>
      <span className="h-3 w-px shrink-0 bg-[#d8d8d2] dark:bg-white/15" />
      <span className="inline-flex min-w-0 items-start gap-1.5">
        <span className="grid size-4 shrink-0 place-items-center rounded-full bg-emerald-700 text-white dark:bg-emerald-400 dark:text-[#080808]">
          <TruckIcon className="size-2.5 stroke-[2.5]" />
        </span>
        <span className="truncate">{deliveryLabel}</span>
      </span>
    </section>
  );
}

function ExchangeConfirmationPanel({
  acceptedReturnBrands,
  className,
  confirmationText,
  emptySize,
  isConfirmed,
  onConfirmedChange,
  quantity,
}: {
  acceptedReturnBrands: string[];
  className?: string;
  confirmationText: string;
  emptySize: string | null;
  isConfirmed: boolean;
  onConfirmedChange: (checked: boolean) => void;
  quantity: number;
}) {
  return (
    <label
      className={cn(
        "grid cursor-pointer gap-2.5 rounded-lg border bg-[#fffaf6] p-2.5 shadow-[0_12px_28px_rgba(8,8,8,0.04)] transition dark:bg-orange-500/10 sm:gap-4 sm:p-4",
        isConfirmed
          ? "border-[#ff5a1f]/35 ring-2 ring-[#ff5a1f]/10 dark:border-[#ff5a1f]/30"
          : "border-[#ff5a1f]/25 hover:border-[#ff5a1f]/45 dark:border-[#ff5a1f]/25",
        className,
      )}
    >
      <span className="grid gap-2.5 sm:gap-3">
        <span className="flex min-w-0 items-start gap-2.5 sm:gap-3 sm:items-center">
          <Checkbox
            aria-label="Confirm empty cylinder exchange"
            checked={isConfirmed}
            className="size-6 rounded-md border-[#ff5a1f]/45 bg-white shadow-sm data-checked:border-[#ff5a1f] data-checked:bg-[#ff5a1f] data-checked:text-white dark:bg-white/[0.04] sm:size-8 sm:rounded-lg"
            onCheckedChange={(checked) => onConfirmedChange(checked === true)}
          />
          <span className="grid min-w-0 gap-1">
            <span className="text-[13px] font-black leading-tight text-[#080808] dark:text-[#f7f7f2] sm:text-base">
              Confirm empty cylinder exchange
            </span>
            <span
              className={cn(
                "text-[10px] font-black leading-none sm:text-xs",
                isConfirmed
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-[#ff5a1f]",
              )}
            >
              {isConfirmed
                ? "Confirmed for the current quantity"
                : "Required before adding to cart"}
            </span>
          </span>
        </span>
        <span
          aria-label={getExchangeEmptyCountLabel(quantity, emptySize)}
          className="inline-flex min-h-9 w-full max-w-full items-center justify-center gap-2.5 rounded-md border border-[#ff5a1f]/25 bg-white px-2.5 py-1.5 text-[#ff5a1f] shadow-[0_8px_18px_rgba(8,8,8,0.08)] dark:border-[#ff5a1f]/30 dark:bg-white/10 sm:min-h-11 sm:gap-3 sm:rounded-lg sm:px-3 sm:py-2"
        >
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#ff5a1f] text-xs font-black leading-none text-white sm:size-8 sm:text-sm">
            {quantity}
          </span>
          <span className="min-w-0 text-[10px] font-black uppercase leading-tight sm:text-[12px]">
            {getExchangeRequiredItemLabel(quantity, emptySize)}
          </span>
        </span>
      </span>

      <span className="text-[11px] leading-5 text-slate-700 dark:text-zinc-300 sm:text-sm sm:leading-6">
        {confirmationText}
      </span>

      {acceptedReturnBrands.length > 0 ? (
        <span className="grid gap-1.5 border-t border-dashed border-[#e8e8e2] pt-2.5 dark:border-white/10 sm:gap-2 sm:pt-3">
          <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400 sm:gap-2 sm:text-[10px] sm:tracking-[0.14em]">
            <span className="grid size-4 shrink-0 place-items-center rounded-full border border-[#ff5a1f]/20 bg-white text-[#ff5a1f] dark:bg-white/10 sm:size-5">
              <CheckCircle2Icon className="size-3 sm:size-3.5" />
            </span>
            Accepted return brands
          </span>
          <span className="flex flex-wrap gap-1">
            {acceptedReturnBrands.map((brand) => (
              <Badge
                className="h-5 max-w-full rounded-md border border-[#e8e8e2] bg-white px-1.5 py-0 text-[9px] font-black text-slate-700 shadow-[0_4px_10px_rgba(8,8,8,0.06)] dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-200 sm:h-7 sm:px-2.5 sm:text-[11px]"
                key={brand}
                variant="outline"
              >
                <CheckCircle2Icon className="!size-2.5 shrink-0 text-[#ff5a1f] sm:!size-3.5" />
                {brand}
              </Badge>
            ))}
          </span>
        </span>
      ) : null}
    </label>
  );
}

function QuantityStepper({
  quantity,
  setQuantity,
}: {
  quantity: number;
  setQuantity: (quantity: number) => void;
}) {
  return (
    <div className="inline-grid h-10 w-fit grid-cols-3 overflow-hidden rounded-md border border-[#d8d8d2] bg-white dark:border-white/10 dark:bg-white/[0.04] sm:h-11">
      <button
        aria-label="Decrease quantity"
        className="grid w-10 place-items-center text-[#080808] transition hover:bg-[#f7f7f2] dark:text-[#f7f7f2] dark:hover:bg-white/10 sm:w-12"
        onClick={() => setQuantity(Math.max(1, quantity - 1))}
        type="button"
      >
        <MinusIcon className="size-4" />
      </button>
      <span className="grid w-10 place-items-center border-x border-[#d8d8d2] text-sm font-black dark:border-white/10 sm:w-12 sm:text-base">
        {quantity}
      </span>
      <button
        aria-label="Increase quantity"
        className="grid w-10 place-items-center text-[#080808] transition hover:bg-[#f7f7f2] dark:text-[#f7f7f2] dark:hover:bg-white/10 sm:w-12"
        onClick={() => setQuantity(quantity + 1)}
        type="button"
      >
        <PlusIcon className="size-4" />
      </button>
    </div>
  );
}

function MobileStickyPurchaseBar({
  added,
  deliveryDetail,
  label,
  needsExchangeConfirmation,
  onAction,
  selectedPrice,
}: {
  added: boolean;
  deliveryDetail: string;
  label: string;
  needsExchangeConfirmation: boolean;
  onAction: () => void;
  selectedPrice: string;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e8e8e2] bg-white px-3 pb-[calc(env(safe-area-inset-bottom)+0.6rem)] pt-2 shadow-[0_-12px_30px_rgba(8,8,8,0.12)] dark:border-white/10 dark:bg-[#101010] lg:hidden">
      <div className="mx-auto grid w-full max-w-4xl gap-1.5">
        <p className="flex min-w-0 items-center justify-center gap-1.5 text-center text-[11px] font-semibold text-[#080808] dark:text-[#f7f7f2]">
          {needsExchangeConfirmation ? (
            <>
              <RefreshCcwIcon className="size-3.5 shrink-0 text-[#ff5a1f]" />
              <span className="truncate">Exchange confirmation required</span>
            </>
          ) : (
            <>
              <ShoppingCartIcon className="size-3.5 shrink-0 text-[#ff5a1f]" />
              <span className="truncate">
                {selectedPrice} • {deliveryDetail}
              </span>
            </>
          )}
        </p>
        <button
          className={cn(
            marketplacePrimaryActionBaseClass,
            "inline-flex h-11 w-full rounded-full text-[13px]",
          )}
          onClick={onAction}
          type="button"
        >
          {added ? (
            <CheckIcon className="size-4 shrink-0" />
          ) : (
            <ShoppingCartIcon className="size-4 shrink-0" />
          )}
          <span>{label}</span>
        </button>
      </div>
    </div>
  );
}

function TopVariantBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute left-0 top-0 z-10 inline-flex h-3.5 items-center gap-0.5 bg-[#ff5a1f] px-0.5 text-[6px] font-black uppercase leading-none text-white shadow-sm animate-pulse",
        className,
      )}
    >
      <FlameIcon className="size-2.5 shrink-0 fill-white/20" />
      Hot
    </span>
  );
}

function ProductRail({
  href,
  products,
  title,
  viewAllLabel,
}: {
  href: string;
  products: MarketplaceProductCardData[];
  title: string;
  viewAllLabel: string;
}) {
  const carouselId = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-rail`;
  const canScroll = products.length > 2;
  const carouselRef = useRef<HTMLDivElement>(null);

  function scrollCarousel(direction: -1 | 1) {
    carouselRef.current?.scrollBy({
      behavior: "smooth",
      left: direction * 260,
    });
  }

  return (
    <section className="min-w-0 overflow-hidden border-y border-[#e8e8e2] bg-white px-4 py-3 dark:border-white/10 dark:bg-white/[0.04] sm:rounded-lg sm:border sm:p-4 sm:shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2
          className="text-sm font-black text-[#080808] dark:text-[#f7f7f2] sm:text-base"
          id={carouselId}
        >
          {title}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            className="inline-flex items-center gap-1 text-[11px] font-black uppercase text-slate-600 transition hover:text-[#ff5a1f] dark:text-zinc-300 sm:text-xs"
            href={href}
          >
            {viewAllLabel}
            <ChevronRightIcon className="size-4" />
          </Link>
          {canScroll ? (
            <div className="hidden items-center gap-1 sm:flex">
              <button
                aria-label={`Scroll ${title} backward`}
                className="grid size-8 place-items-center rounded-full border border-[#e8e8e2] bg-white text-[#080808] transition hover:border-[#ff5a1f] hover:text-[#ff5a1f] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#f7f7f2]"
                onClick={() => scrollCarousel(-1)}
                type="button"
              >
                <ChevronLeftIcon className="size-4" />
              </button>
              <button
                aria-label={`Scroll ${title} forward`}
                className="grid size-8 place-items-center rounded-full border border-[#e8e8e2] bg-white text-[#080808] transition hover:border-[#ff5a1f] hover:text-[#ff5a1f] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#f7f7f2]"
                onClick={() => scrollCarousel(1)}
                type="button"
              >
                <ChevronRightIcon className="size-4" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <div
        aria-labelledby={carouselId}
        className="-mx-4 -my-2 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:-mx-1 sm:gap-3 sm:px-1 [&::-webkit-scrollbar]:hidden"
        ref={carouselRef}
      >
        {products.map((item) => (
          <div
            className="w-[10.75rem] shrink-0 snap-start sm:w-[12rem] lg:w-[13rem]"
            key={item.id}
          >
            <MarketplaceProductCard product={item} />
          </div>
        ))}
      </div>
    </section>
  );
}

function ProductDescriptionSection({
  product,
}: {
  product: MarketplaceProductDetailView;
}) {
  const description = normalizeProductCopy(
    product.fullDescription ?? product.description ?? product.shortDescription,
  );

  return (
    <section className="min-w-0 overflow-hidden border-y border-[#e8e8e2] bg-white px-4 py-3 dark:border-white/10 dark:bg-white/[0.04] sm:rounded-lg sm:border sm:p-4 sm:shadow-sm">
      <h2 className="border-b border-[#e8e8e2] pb-3 text-sm font-black text-[#080808] dark:border-white/10 dark:text-[#f7f7f2] sm:text-base">
        Description
      </h2>

      <div className="mt-4 grid gap-3 text-xs leading-6 text-slate-700 dark:text-zinc-300 sm:text-sm sm:leading-7">
        {description.length > 0 ? (
          description.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
        ) : (
          <p>No product details supplied yet.</p>
        )}
      </div>
    </section>
  );
}

function ExchangeStepsPanel() {
  return (
    <section className="min-w-0 overflow-hidden border-y border-[#e8e8e2] bg-white px-4 py-3 dark:border-white/10 dark:bg-white/[0.04] sm:rounded-lg sm:border sm:p-5 sm:shadow-sm">
      <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-center">
        <h2 className="text-base font-black text-[#080808] dark:text-[#f7f7f2] sm:text-lg">
          How cylinder exchange works
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {exchangeSteps.map((step, index) => {
            const Icon = step.icon;

            return (
              <article
                className="grid min-w-0 grid-cols-[1.5rem_2.25rem_minmax(0,1fr)] items-center gap-2.5 border-t border-[#f0f0ea] py-2.5 first:border-t-0 dark:border-white/10 sm:grid-cols-[2rem_3rem_minmax(0,1fr)] sm:gap-3 sm:rounded-lg sm:border sm:bg-[#f7f7f2]/45 sm:p-3 sm:dark:bg-white/[0.03]"
                key={step.description}
              >
                <span className="grid size-6 place-items-center rounded-full bg-[#ff5a1f] text-xs font-black text-white">
                  {index + 1}
                </span>
                <span className="grid size-10 place-items-center rounded-full border border-[#ff5a1f]/15 bg-orange-50 text-[#ff5a1f] dark:bg-orange-500/10 sm:size-12">
                  <Icon className="size-5 stroke-[1.6] sm:size-6" />
                </span>
                <p className="text-xs leading-5 text-slate-700 dark:text-zinc-300 sm:text-sm">
                  {step.description}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function getSizeLabel(value: string) {
  const match = value.match(/(\d+(?:\.\d+)?)\s*kg/i);

  return match ? `${match[1]}kg` : null;
}

function getVariantOptionGroupLabel(product: MarketplaceProductDetailView) {
  const optionNames = product.optionSchema
    .map((option) => option.name.trim())
    .filter(Boolean);

  if (optionNames.length > 0) {
    return optionNames.join(" / ");
  }

  return product.variants.length === 1 ? "Option" : "Options";
}

function getExchangeEmptySize(
  product: MarketplaceProductDetailView,
  variant: MarketplaceVariant | null,
) {
  return (
    variant?.exchangeEmptyCylinderSize?.trim() ||
    getSizeLabel(variant?.title ?? "") ||
    getSizeLabel(product.title)
  );
}

function getVariantMarkdownDisplay(
  variant: MarketplaceVariant,
  currencyContext: CurrencyContext,
): VariantMarkdownDisplay | null {
  const price = Number(variant.price);
  const compareAtPrice = Number(variant.compareAtPrice);

  if (
    !Number.isFinite(price) ||
    !Number.isFinite(compareAtPrice) ||
    price <= 0 ||
    compareAtPrice <= price
  ) {
    return null;
  }

  const discountPercent = Math.max(
    1,
    Math.round(((compareAtPrice - price) / compareAtPrice) * 100),
  );

  return {
    compareAtLabel: formatFromZar(compareAtPrice, currencyContext),
    discountLabel: `${discountPercent}% off`,
  };
}

function getTopSoldVariantId(variants: MarketplaceVariant[]) {
  const topVariant = variants.reduce<MarketplaceVariant | null>(
    (currentTopVariant, variant) => {
      if (!currentTopVariant || variant.soldQuantity > currentTopVariant.soldQuantity) {
        return variant;
      }

      return currentTopVariant;
    },
    null,
  );

  return topVariant && topVariant.soldQuantity > 0 ? topVariant.id : null;
}

function getVariantPreviewList(
  variants: MarketplaceVariant[],
  selectedVariantId: string | null,
  topSoldVariantId: string | null,
) {
  const priorityIds = [selectedVariantId, topSoldVariantId].filter(
    (id): id is string => Boolean(id),
  );
  const seenIds = new Set<string>();
  const previewVariants: MarketplaceVariant[] = [];

  for (const id of priorityIds) {
    const variant = variants.find((item) => item.id === id);

    if (variant && !seenIds.has(variant.id)) {
      previewVariants.push(variant);
      seenIds.add(variant.id);
    }
  }

  for (const variant of variants) {
    if (!seenIds.has(variant.id)) {
      previewVariants.push(variant);
      seenIds.add(variant.id);
    }
  }

  return previewVariants.slice(0, 6);
}

function getDeliveryPromise(
  fulfillmentMode: MarketplaceProductDetailView["fulfillmentMode"],
) {
  if (fulfillmentMode !== "piessang_fulfilled") {
    return {
      detail: "Courier rates are calculated at checkout",
      label: "Courier delivery options",
    };
  }

  return {
    detail: "Eligibility and delivery details are confirmed at checkout",
    label: "Local delivery subject to availability.",
  };
}

function getExchangeConfirmationText({
  product,
  quantity,
  variant,
}: {
  product: MarketplaceProductDetailView;
  quantity: number;
  variant: MarketplaceVariant;
}) {
  const customText = variant.exchangeConfirmationText
    ? cleanInlineText(variant.exchangeConfirmationText)
    : "";

  if (quantity === 1 && customText) {
    return customText;
  }

  const emptySize = getExchangeEmptySize(product, variant);
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

function getExchangeEmptyCountLabel(quantity: number, emptySize: string | null) {
  return `${quantity}${emptySize ? ` ${emptySize}` : ""} empty ${
    quantity === 1 ? "cylinder" : "cylinders"
  } required`;
}

function getExchangeRequiredItemLabel(
  quantity: number,
  emptySize: string | null,
) {
  return `${emptySize ?? "Compatible"} empty ${
    quantity === 1 ? "cylinder" : "cylinders"
  } required`;
}

function getAdjacentImage(images: string[], current: string | null, direction: -1 | 1) {
  if (images.length === 0) {
    return current;
  }

  const currentIndex = current ? images.indexOf(current) : 0;
  const normalizedIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = (normalizedIndex + direction + images.length) % images.length;

  return images[nextIndex];
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function readPreviouslyViewedProductIds() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(previouslyViewedStorageKey);

    if (!storedValue) {
      return [];
    }

    const parsedValue: unknown = JSON.parse(storedValue);

    return Array.isArray(parsedValue)
      ? parsedValue.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function writePreviouslyViewedProductIds(productIds: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      previouslyViewedStorageKey,
      JSON.stringify(productIds),
    );
  } catch {
    // Browsers can disable storage; the page should still work without history.
  }
}

function cleanInlineText(value: string) {
  return normalizeProductCopy(value).join(" ");
}

function normalizeProductCopy(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  const withBreaks = value
    .replace(/<\/(p|div|h[1-6])>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, "");

  return decodeBasicEntities(withBreaks)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function decodeBasicEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
