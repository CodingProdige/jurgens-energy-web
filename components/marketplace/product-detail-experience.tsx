"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  CheckIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CreditCardIcon,
  FileTextIcon,
  FlameIcon,
  MinusIcon,
  PackageCheckIcon,
  PlayIcon,
  PlusIcon,
  RefreshCcwIcon,
  Share2Icon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  StarIcon,
  TruckIcon,
  XIcon,
  ZoomInIcon,
} from "lucide-react";

import { marketplacePrimaryActionBaseClass } from "@/components/marketplace/action-styles";
import { MarketplaceSaleCountdown } from "@/components/marketplace/marketplace-sale-countdown";
import { MarketplaceProductCard } from "@/components/marketplace/product-card";
import { ProductDeliveryEstimate } from "@/components/marketplace/product-delivery-estimate";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  convertFromZar,
  formatFromZar,
  type CurrencyContext,
} from "@/src/modules/currency";
import { addLocalCartItem } from "@/src/modules/cart";
import { getExchangeRequirementText } from "@/src/modules/cart/exchange-requirements";
import {
  trackGoogleEvent,
  type GoogleAnalyticsItem,
} from "@/src/modules/analytics/google";
import type {
  MarketplaceProductCard as MarketplaceProductCardData,
  MarketplaceProductDetail,
  MarketplaceProductMedia,
  MarketplaceVariant,
} from "@/src/modules/marketplace/catalog";
import { policyLinks } from "@/src/modules/marketplace/policies/links";
import {
  getSoldQuantityLabel,
  isExchangeVariant,
} from "@/src/modules/marketplace/product-variant-presentation";
import {
  getMarketplaceStockStatusLabel,
  type MarketplaceStockStatus,
} from "@/src/modules/marketplace/stock-status";
import { parseProductDescription } from "@/src/modules/products/product-description";

export type MarketplaceProductDetailView = Omit<
  MarketplaceProductDetail,
  "updatedAt"
>;

type ProductDetailExperienceProps = {
  catalogProducts: MarketplaceProductCardData[];
  currencyContext: CurrencyContext;
  deliveryCopy: {
    available: boolean;
    benefit: string;
    detail: string;
    label: string;
  };
  deliveryTimingDescription: string;
  initialVariantId?: string;
  jurgensDeliveryCutoffTime: string;
  priceTaxDisclosure?: string;
  product: MarketplaceProductDetailView;
  relatedProducts: MarketplaceProductCardData[];
  sellerName: string;
};

type VariantMarkdownDisplay = {
  compareAtLabel: string;
  discountLabel: string;
};

const previouslyViewedLimit = 16;
const previouslyViewedStorageKey = "jurgens-energy:previously-viewed-products";
const productReviewsHeadingId = "customer-reviews-heading";
const productReviewsSectionId = "customer-reviews";
type ProductPolicyLink = {
  href: string;
  icon: typeof TruckIcon;
  kind: string;
  label: string;
};
const deliveryPolicyLink = policyLinks.find((link) => link.kind === "delivery");
const returnsPolicyLink = policyLinks.find((link) => link.kind === "returns");
const productPolicyLinks = [
  deliveryPolicyLink
    ? { ...deliveryPolicyLink, icon: TruckIcon, label: "Shipping" }
    : null,
  returnsPolicyLink
    ? { ...returnsPolicyLink, icon: RefreshCcwIcon, label: "Returns" }
    : null,
  {
    href: "/payments",
    icon: CreditCardIcon,
    kind: "payments",
    label: "Payments",
  },
  {
    href: "/support",
    icon: ShieldCheckIcon,
    kind: "support",
    label: "Support",
  },
].filter((link): link is ProductPolicyLink => Boolean(link));

const exchangeSteps = [
  {
    description: "Exchange orders can be delivered to your address.",
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
  deliveryCopy,
  deliveryTimingDescription,
  initialVariantId,
  priceTaxDisclosure = "Final price",
  product,
  relatedProducts,
  sellerName,
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
  const selectedVariantImageUrl = selectedVariant?.imageUrl ?? null;
  const selectedVariantMediaFocusKey = selectedVariant
    ? `${selectedVariant.id}:${selectedVariantImageUrl ?? ""}`
    : null;
  const galleryMedia = useMemo(
    () =>
      getProductGalleryMedia(
        product.mediaItems,
        uniqueStrings([
          product.coverImageUrl,
          ...product.imageUrls,
          ...product.variants.map((variant) => variant.imageUrl),
        ]),
      ),
    [
      product.coverImageUrl,
      product.imageUrls,
      product.mediaItems,
      product.variants,
    ],
  );
  const [activeMediaId, setActiveMediaId] = useState<string | null>(
    getPreferredGalleryMediaId(
      galleryMedia,
      selectedVariantImageUrl ?? product.coverImageUrl,
    ),
  );
  const activeMedia =
    galleryMedia.find((item) => item.id === activeMediaId) ??
    galleryMedia[0] ??
    null;
  const lastVariantMediaFocusKeyRef = useRef(
    selectedVariantMediaFocusKey,
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
    if (
      !selectedVariantImageUrl ||
      selectedVariantMediaFocusKey === lastVariantMediaFocusKeyRef.current
    ) {
      return;
    }

    const selectedMedia = findGalleryMediaForImageUrl(
      galleryMedia,
      selectedVariantImageUrl,
    );

    if (selectedMedia) {
      lastVariantMediaFocusKeyRef.current = selectedVariantMediaFocusKey;
      setActiveMediaId(selectedMedia.id);
    }
  }, [galleryMedia, selectedVariantImageUrl, selectedVariantMediaFocusKey]);

  useEffect(() => {
    if (
      !activeMediaId ||
      !galleryMedia.some((item) => item.id === activeMediaId)
    ) {
      setActiveMediaId(
        getPreferredGalleryMediaId(
          galleryMedia,
          selectedVariantImageUrl ?? product.coverImageUrl,
        ),
      );
    }
  }, [
    activeMediaId,
    galleryMedia,
    product.coverImageUrl,
    selectedVariantImageUrl,
  ]);

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
  const deliveryAvailable = deliveryCopy.available;
  const deliveryBenefit = deliveryCopy.benefit;
  const deliveryDetail = deliveryCopy.detail;
  const sizeLabel = getSizeLabel(selectedVariant?.title ?? product.title);
  const isSelectedVariantExchange = isExchangeVariant(selectedVariant);

  function showPreviousMedia() {
    setActiveMediaId((current) =>
      getAdjacentMediaId(galleryMedia, current, -1),
    );
  }

  function showNextMedia() {
    setActiveMediaId((current) =>
      getAdjacentMediaId(galleryMedia, current, 1),
    );
  }

  function openGallery() {
    if (activeMedia) {
      setIsGalleryOpen(true);
    }
  }

  return (
    <div className="grid min-w-0 gap-0 overflow-x-clip pb-24 sm:gap-5 lg:pb-0">
      <section className="grid min-w-0 gap-0 overflow-x-clip sm:gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(24rem,0.88fr)]">
        <ProductGallery
          activeMedia={activeMedia}
          galleryMedia={galleryMedia}
          isLightboxOpen={isGalleryOpen}
          onNext={showNextMedia}
          onOpenGallery={openGallery}
          onPrevious={showPreviousMedia}
          onSelectMedia={setActiveMediaId}
          productTitle={product.title}
          sizeLabel={sizeLabel}
        />

        <ProductBuyBox
          currencyContext={currencyContext}
          deliveryAvailable={deliveryAvailable}
          deliveryBenefit={deliveryBenefit}
          deliveryDetail={deliveryDetail}
          deliveryTimingDescription={deliveryTimingDescription}
          priceTaxDisclosure={priceTaxDisclosure}
          product={product}
          quantity={quantity}
          sellerName={sellerName}
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

        <ProductReviewsSection product={product} />

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

      <ProductMediaLightbox
        activeMedia={activeMedia}
        galleryMedia={galleryMedia}
        isOpen={isGalleryOpen}
        onNext={showNextMedia}
        onOpenChange={setIsGalleryOpen}
        onPrevious={showPreviousMedia}
        onSelectMedia={setActiveMediaId}
        productTitle={product.title}
      />
    </div>
  );
}

function ProductGallery({
  activeMedia,
  galleryMedia,
  isLightboxOpen,
  onNext,
  onOpenGallery,
  onPrevious,
  onSelectMedia,
  productTitle,
  sizeLabel,
}: {
  activeMedia: MarketplaceProductMedia | null;
  galleryMedia: MarketplaceProductMedia[];
  isLightboxOpen: boolean;
  onNext: () => void;
  onOpenGallery: () => void;
  onPrevious: () => void;
  onSelectMedia: (mediaId: string) => void;
  productTitle: string;
  sizeLabel: string | null;
}) {
  const gallerySwipeRef = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
  });
  const suppressGalleryOpenClickRef = useRef(false);
  const suppressGalleryOpenResetTimeoutRef = useRef<
    ReturnType<typeof setTimeout> | null
  >(null);
  const hasMultipleMedia = galleryMedia.length > 1;
  const activeIndex = activeMedia
    ? Math.max(
        0,
        galleryMedia.findIndex((media) => media.id === activeMedia.id),
      )
    : 0;

  useEffect(
    () => () => {
      if (suppressGalleryOpenResetTimeoutRef.current) {
        clearTimeout(suppressGalleryOpenResetTimeoutRef.current);
      }
    },
    [],
  );

  function handleMediaPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (!hasMultipleMedia || event.pointerType !== "touch") {
      return;
    }

    gallerySwipeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Safari can reject capture while native media controls are active.
    }
  }

  function handleMediaPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (
      !hasMultipleMedia ||
      gallerySwipeRef.current.pointerId !== event.pointerId
    ) {
      return;
    }

    const deltaX = event.clientX - gallerySwipeRef.current.startX;
    const deltaY = event.clientY - gallerySwipeRef.current.startY;
    gallerySwipeRef.current.pointerId = -1;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) {
      return;
    }

    suppressGalleryOpenClickRef.current = true;
    if (suppressGalleryOpenResetTimeoutRef.current) {
      clearTimeout(suppressGalleryOpenResetTimeoutRef.current);
    }
    suppressGalleryOpenResetTimeoutRef.current = setTimeout(() => {
      suppressGalleryOpenClickRef.current = false;
      suppressGalleryOpenResetTimeoutRef.current = null;
    }, 250);

    if (deltaX > 0) {
      onPrevious();
    } else {
      onNext();
    }
  }

  function handleMediaPointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    if (gallerySwipeRef.current.pointerId !== event.pointerId) {
      return;
    }

    gallerySwipeRef.current.pointerId = -1;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleOpenGalleryClick(event: ReactMouseEvent<HTMLButtonElement>) {
    if (suppressGalleryOpenClickRef.current) {
      suppressGalleryOpenClickRef.current = false;
      if (suppressGalleryOpenResetTimeoutRef.current) {
        clearTimeout(suppressGalleryOpenResetTimeoutRef.current);
        suppressGalleryOpenResetTimeoutRef.current = null;
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    onOpenGallery();
  }

  return (
    <div
      className={cn(
        "grid min-w-0 gap-3 lg:sticky lg:top-36 lg:self-start lg:items-start",
        hasMultipleMedia && "lg:grid-cols-[5.75rem_minmax(0,1fr)]",
      )}
    >
      {hasMultipleMedia ? (
        <ProductMediaThumbnailRail
          activeMediaId={activeMedia?.id ?? null}
          galleryMedia={galleryMedia}
          onSelectMedia={onSelectMedia}
          productTitle={productTitle}
        />
      ) : null}

      <div className="grid min-w-0 gap-3">
        <div
          className="relative aspect-[1/1] w-full touch-pan-y overflow-hidden border-b border-[#e8e8e2] bg-white dark:border-white/10 dark:bg-white/[0.04] sm:rounded-lg sm:border sm:shadow-sm"
          data-product-gallery-media-container=""
          onPointerCancel={handleMediaPointerCancel}
          onPointerDown={handleMediaPointerDown}
          onPointerUp={handleMediaPointerUp}
        >
          {sizeLabel ? (
            <span className="absolute left-4 top-4 z-10 rounded-md bg-white px-3 py-1.5 text-sm font-black text-[#080808] shadow-sm dark:bg-[#1a1a1a] dark:text-[#f7f7f2]">
              {sizeLabel}
            </span>
          ) : null}
          {activeMedia ? (
            <>
              <ProductGalleryMediaContent
                key={activeMedia.id}
                media={activeMedia}
                pauseVideo={isLightboxOpen}
                priority
                productTitle={productTitle}
              />
              {activeMedia.kind === "image" ? (
                <button
                  aria-label="Open larger product image gallery"
                  className="absolute inset-0 z-[2] cursor-zoom-in focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-[#ff5a1f]/35"
                  onClick={handleOpenGalleryClick}
                  type="button"
                />
              ) : null}
            </>
          ) : (
            <div className="grid size-full place-items-center text-sm font-semibold text-slate-500">
              Jurgens Energy
            </div>
          )}
          {hasMultipleMedia ? (
            <>
              <button
                aria-label="Previous product media"
                className="absolute left-4 top-1/2 z-20 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white/92 text-[#080808] shadow-sm transition hover:bg-white dark:bg-[#1a1a1a]/90 dark:text-[#f7f7f2] sm:grid"
                onClick={onPrevious}
                type="button"
              >
                <ChevronLeftIcon className="size-5" />
              </button>
              <button
                aria-label="Next product media"
                className="absolute right-4 top-1/2 z-20 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white/92 text-[#080808] shadow-sm transition hover:bg-white dark:bg-[#1a1a1a]/90 dark:text-[#f7f7f2] sm:grid"
                onClick={onNext}
                type="button"
              >
                <ChevronRightIcon className="size-5" />
              </button>
              <span className="absolute bottom-4 right-4 z-20 rounded-full bg-[#080808]/62 px-2.5 py-1 text-xs font-black leading-none text-white shadow-sm backdrop-blur-sm sm:hidden">
                {activeIndex + 1}/{galleryMedia.length}
              </span>
            </>
          ) : null}
          <button
            aria-label={
              activeMedia?.kind === "video"
                ? "Open product video in larger gallery"
                : "Zoom product image"
            }
            className={cn(
              "absolute right-4 z-20 hidden size-10 place-items-center rounded-full bg-white/92 text-[#080808] shadow-sm transition hover:bg-white dark:bg-[#1a1a1a]/90 dark:text-[#f7f7f2] sm:grid",
              activeMedia?.kind === "video" ? "top-4" : "bottom-4",
            )}
            onClick={onOpenGallery}
            type="button"
          >
            <ZoomInIcon className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductGalleryMediaContent({
  media,
  pauseVideo = false,
  priority = false,
  productTitle,
}: {
  media: MarketplaceProductMedia;
  pauseVideo?: boolean;
  priority?: boolean;
  productTitle: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (pauseVideo) {
      videoRef.current?.pause();
    }
  }, [pauseVideo]);

  if (media.kind === "video") {
    return (
      <video
        aria-label={media.altText ?? `${productTitle} product video`}
        className="size-full object-contain"
        controls
        key={media.id}
        playsInline
        poster={media.posterUrl ?? undefined}
        preload="metadata"
        ref={videoRef}
      >
        <source src={media.url} type={media.mimeType} />
        Your browser does not support product video playback.
      </video>
    );
  }

  return (
    <Image
      alt={media.altText ?? productTitle}
      className="object-contain"
      fill
      priority={priority}
      quality={90}
      sizes="(min-width: 1024px) 680px, calc(100vw - 2rem)"
      src={media.url}
    />
  );
}

function ProductMediaThumbnailRail({
  activeMediaId,
  galleryMedia,
  onSelectMedia,
  productTitle,
}: {
  activeMediaId: string | null;
  galleryMedia: MarketplaceProductMedia[];
  onSelectMedia: (mediaId: string) => void;
  productTitle: string;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [canScrollBackward, setCanScrollBackward] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);
  const activeIndex = Math.max(
    0,
    galleryMedia.findIndex((media) => media.id === activeMediaId),
  );

  const updateScrollState = useCallback(() => {
    const rail = railRef.current;

    if (!rail) {
      return;
    }

    const maximumScrollTop = Math.max(0, rail.scrollHeight - rail.clientHeight);

    setCanScrollBackward(rail.scrollTop > 2);
    setCanScrollForward(rail.scrollTop < maximumScrollTop - 2);
  }, []);

  useEffect(() => {
    const rail = railRef.current;

    if (!rail) {
      return;
    }

    updateScrollState();
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateScrollState);

    resizeObserver?.observe(rail);
    window.addEventListener("resize", updateScrollState);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateScrollState);
    };
  }, [galleryMedia.length, updateScrollState]);

  useEffect(() => {
    const rail = railRef.current;

    if (!rail || !activeMediaId) {
      return;
    }

    const activeThumbnail = Array.from(
      rail.querySelectorAll<HTMLElement>("[data-product-media-thumbnail]"),
    ).find((thumbnail) => thumbnail.dataset.mediaId === activeMediaId);

    activeThumbnail?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });

    const animationFrame = window.requestAnimationFrame(updateScrollState);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [activeMediaId, updateScrollState]);

  function scrollRail(direction: -1 | 1) {
    const rail = railRef.current;

    if (!rail) {
      return;
    }

    rail.scrollBy({
      behavior: "smooth",
      top: direction * Math.max(88, rail.clientHeight * 0.72),
    });
  }

  return (
    <div className="hidden min-w-0 lg:grid lg:content-start lg:gap-2">
      <button
        aria-label="Scroll product media thumbnails upward"
        className="grid h-7 place-items-center rounded-full border border-[#e8e8e2] bg-white text-[#080808] transition hover:border-[#ff5a1f] hover:text-[#ff5a1f] disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/10 dark:bg-white/[0.06] dark:text-[#f7f7f2]"
        disabled={!canScrollBackward}
        onClick={() => scrollRail(-1)}
        type="button"
      >
        <ChevronUpIcon className="size-4" />
      </button>

      <div
        aria-label="Product media thumbnails"
        className="flex max-h-[min(42rem,calc(100vh-13rem))] flex-col gap-2 overflow-y-auto overscroll-y-contain pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={updateScrollState}
        ref={railRef}
        role="group"
      >
        {galleryMedia.map((media, index) => (
          <button
            aria-label={`Show product ${media.kind} ${index + 1}`}
            aria-pressed={activeMediaId === media.id}
            className={cn(
              "relative aspect-[1/1] w-full shrink-0 overflow-hidden rounded-md border bg-white transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/25 dark:bg-white/[0.04]",
              activeMediaId === media.id
                ? "border-[#ff5a1f] ring-2 ring-[#ff5a1f]/15"
                : "border-[#e8e8e2] hover:border-[#ff5a1f]/45 dark:border-white/10",
            )}
            data-media-id={media.id}
            data-product-media-thumbnail=""
            key={media.id}
            onClick={() => onSelectMedia(media.id)}
            type="button"
          >
            <ProductMediaThumbnail
              media={media}
              productTitle={productTitle}
              sizes="96px"
            />
          </button>
        ))}
      </div>

      <button
        aria-label="Scroll product media thumbnails downward"
        className="grid h-7 place-items-center rounded-full border border-[#e8e8e2] bg-white text-[#080808] transition hover:border-[#ff5a1f] hover:text-[#ff5a1f] disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/10 dark:bg-white/[0.06] dark:text-[#f7f7f2]"
        disabled={!canScrollForward}
        onClick={() => scrollRail(1)}
        type="button"
      >
        <ChevronDownIcon className="size-4" />
      </button>

      <p
        aria-live="polite"
        className="text-center text-[10px] font-black uppercase leading-none text-[#6a6a63] dark:text-zinc-300"
      >
        {activeIndex + 1}/{galleryMedia.length}
      </p>
    </div>
  );
}

function ProductMediaThumbnail({
  media,
  productTitle,
  sizes,
}: {
  media: MarketplaceProductMedia;
  productTitle: string;
  sizes: string;
}) {
  const thumbnailUrl = media.kind === "video" ? media.posterUrl : media.url;

  return (
    <>
      {thumbnailUrl ? (
        <Image
          alt={media.altText ?? `${productTitle} ${media.kind}`}
          className="object-contain"
          fill
          quality={90}
          sizes={sizes}
          src={thumbnailUrl}
        />
      ) : (
        <span className="grid size-full place-items-center bg-[#1a1a1a] text-white/70">
          <PlayIcon aria-hidden="true" className="size-7 fill-current" />
        </span>
      )}
      {media.kind === "video" ? (
        <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/10">
          <span className="grid size-9 place-items-center rounded-full bg-black/70 text-white shadow-sm">
            <PlayIcon aria-hidden="true" className="ml-0.5 size-4 fill-current" />
          </span>
        </span>
      ) : null}
    </>
  );
}

type ProductMediaThumbnailStripProps = {
  activeMediaId: string | null;
  galleryMedia: MarketplaceProductMedia[];
  onSelectMedia: (mediaId: string) => void;
  productTitle: string;
  tone: "dark" | "light";
};

type ProductMediaThumbnailOverflow = {
  canScrollBackward: boolean;
  canScrollForward: boolean;
  hiddenAfter: number;
  scrollThumbLeft: number;
  scrollThumbWidth: number;
};

const initialThumbnailOverflow: ProductMediaThumbnailOverflow = {
  canScrollBackward: false,
  canScrollForward: false,
  hiddenAfter: 0,
  scrollThumbLeft: 0,
  scrollThumbWidth: 100,
};

function ProductMediaThumbnailStrip({
  activeMediaId,
  galleryMedia,
  onSelectMedia,
  productTitle,
  tone,
}: ProductMediaThumbnailStripProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({
    moved: false,
    pointerId: -1,
    startScrollLeft: 0,
    startX: 0,
  });
  const suppressClickRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [overflow, setOverflow] = useState(initialThumbnailOverflow);
  const activeIndex = Math.max(
    0,
    galleryMedia.findIndex((media) => media.id === activeMediaId),
  );

  const updateOverflow = useCallback(() => {
    const strip = stripRef.current;

    if (!strip) {
      return;
    }

    const maximumScrollLeft = Math.max(0, strip.scrollWidth - strip.clientWidth);
    const canScrollBackward = strip.scrollLeft > 2;
    const canScrollForward = strip.scrollLeft < maximumScrollLeft - 2;
    const stripBounds = strip.getBoundingClientRect();
    const thumbnailButtons = Array.from(
      strip.querySelectorAll<HTMLElement>("[data-product-media-thumbnail]"),
    );
    const hiddenAfter = thumbnailButtons.filter(
      (button) => button.getBoundingClientRect().right > stripBounds.right + 2,
    ).length;
    const scrollThumbWidth =
      strip.scrollWidth > 0
        ? Math.max(
            16,
            Math.min(100, (strip.clientWidth / strip.scrollWidth) * 100),
          )
        : 100;
    const scrollProgress =
      maximumScrollLeft > 0 ? strip.scrollLeft / maximumScrollLeft : 0;
    const scrollThumbLeft = scrollProgress * (100 - scrollThumbWidth);
    const nextOverflow = {
      canScrollBackward,
      canScrollForward,
      hiddenAfter,
      scrollThumbLeft,
      scrollThumbWidth,
    };

    setOverflow((current) =>
      current.canScrollBackward === nextOverflow.canScrollBackward &&
      current.canScrollForward === nextOverflow.canScrollForward &&
      current.hiddenAfter === nextOverflow.hiddenAfter &&
      Math.abs(current.scrollThumbLeft - nextOverflow.scrollThumbLeft) < 0.1 &&
      Math.abs(current.scrollThumbWidth - nextOverflow.scrollThumbWidth) < 0.1
        ? current
        : nextOverflow,
    );
  }, []);

  useEffect(() => {
    const strip = stripRef.current;

    if (!strip) {
      return;
    }

    updateOverflow();
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateOverflow);

    resizeObserver?.observe(strip);
    window.addEventListener("resize", updateOverflow);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateOverflow);
    };
  }, [galleryMedia.length, updateOverflow]);

  useEffect(() => {
    const strip = stripRef.current;

    if (!strip || !activeMediaId) {
      return;
    }

    const activeThumbnail = Array.from(
      strip.querySelectorAll<HTMLElement>("[data-product-media-thumbnail]"),
    ).find((thumbnail) => thumbnail.dataset.mediaId === activeMediaId);

    activeThumbnail?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });

    const animationFrame = window.requestAnimationFrame(updateOverflow);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [activeMediaId, updateOverflow]);

  function scrollThumbnails(direction: -1 | 1) {
    const strip = stripRef.current;

    if (!strip) {
      return;
    }

    strip.scrollBy({
      behavior: "smooth",
      left: direction * Math.max(112, strip.clientWidth * 0.72),
    });
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.pointerType === "touch") {
      return;
    }

    dragRef.current = {
      moved: false,
      pointerId: event.pointerId,
      startScrollLeft: event.currentTarget.scrollLeft,
      startX: event.clientX,
    };
    suppressClickRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current.pointerId !== event.pointerId) {
      return;
    }

    const distance = event.clientX - dragRef.current.startX;

    if (Math.abs(distance) > 4) {
      dragRef.current.moved = true;
      suppressClickRef.current = true;
      event.preventDefault();
    }

    if (dragRef.current.moved) {
      event.currentTarget.scrollLeft =
        dragRef.current.startScrollLeft - distance;
      updateOverflow();
    }
  }

  function finishPointerDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragRef.current.pointerId = -1;
    setIsDragging(false);
  }

  function suppressClickAfterDrag(event: ReactMouseEvent<HTMLDivElement>) {
    if (!suppressClickRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  }

  const hasOverflow =
    overflow.canScrollBackward || overflow.canScrollForward;
  const isDark = tone === "dark";

  return (
    <div className={cn("min-w-0", !isDark && "px-4 pb-1 sm:px-0")}>
      <div className="mb-1.5 flex min-h-8 items-center justify-between gap-3">
        <p
          aria-live="polite"
          className={cn(
            "min-w-0 text-[11px] font-bold",
            isDark ? "text-white/65" : "text-[#6a6a63] dark:text-zinc-300",
          )}
        >
          Media {activeIndex + 1} of {galleryMedia.length}
          {overflow.hiddenAfter > 0 ? (
            <span
              className={cn(
                "ml-2 inline-flex rounded-full px-2 py-1 text-[9px] font-black uppercase leading-none",
                isDark
                  ? "bg-white/12 text-white"
                  : "bg-[#fff0e8] text-[#c93d08] dark:bg-orange-500/15 dark:text-orange-300",
              )}
            >
              +{overflow.hiddenAfter} more
            </span>
          ) : null}
        </p>

        <div className="flex shrink-0 items-center gap-1">
          <button
            aria-label="Scroll product media thumbnails backward"
            className={cn(
              "grid size-8 place-items-center rounded-full border transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/35 disabled:cursor-not-allowed disabled:opacity-35",
              isDark
                ? "border-white/15 bg-white/10 text-white hover:bg-white/20"
                : "border-[#e8e8e2] bg-white text-[#080808] hover:border-[#ff5a1f] hover:text-[#ff5a1f] dark:border-white/10 dark:bg-white/[0.06] dark:text-[#f7f7f2]",
            )}
            disabled={!overflow.canScrollBackward}
            onClick={() => scrollThumbnails(-1)}
            type="button"
          >
            <ChevronLeftIcon className="size-4" />
          </button>
          <button
            aria-label="Scroll product media thumbnails forward"
            className={cn(
              "grid size-8 place-items-center rounded-full border transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/35 disabled:cursor-not-allowed disabled:opacity-35",
              isDark
                ? "border-white/15 bg-white/10 text-white hover:bg-white/20"
                : "border-[#e8e8e2] bg-white text-[#080808] hover:border-[#ff5a1f] hover:text-[#ff5a1f] dark:border-white/10 dark:bg-white/[0.06] dark:text-[#f7f7f2]",
            )}
            disabled={!overflow.canScrollForward}
            onClick={() => scrollThumbnails(1)}
            type="button"
          >
            <ChevronRightIcon className="size-4" />
          </button>
        </div>
      </div>

      <div className="relative min-w-0">
        {overflow.canScrollBackward ? (
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r to-transparent",
              isDark ? "from-[#080808]" : "from-white dark:from-[#1a1a1a]",
            )}
          />
        ) : null}
        <div
          aria-label="Product media thumbnails. Swipe, drag, or use the arrow buttons to browse."
          className={cn(
            "flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain py-1 touch-pan-x select-none [scrollbar-width:none] sm:gap-3 [&::-webkit-scrollbar]:hidden",
            isDragging ? "cursor-grabbing" : "cursor-grab",
          )}
          onClickCapture={suppressClickAfterDrag}
          onDragStart={(event) => event.preventDefault()}
          onPointerCancel={finishPointerDrag}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerDrag}
          onScroll={updateOverflow}
          ref={stripRef}
          role="group"
        >
          {galleryMedia.map((media, index) => (
            <button
              aria-label={`Show product ${media.kind} ${index + 1}`}
              aria-pressed={activeMediaId === media.id}
              className={cn(
                "relative aspect-[1/1] h-20 shrink-0 snap-start overflow-hidden rounded-lg border bg-white transition",
                isDark ? "bg-white/8" : "dark:bg-white/[0.04]",
                activeMediaId === media.id
                  ? isDark
                    ? "border-[#ff5a1f] ring-2 ring-[#ff5a1f]/30"
                    : "border-[#ff5a1f] ring-2 ring-[#ff5a1f]/15"
                  : isDark
                    ? "border-white/12 hover:border-white/35"
                    : "border-[#e8e8e2] hover:border-[#ff5a1f]/45 dark:border-white/10",
              )}
              data-media-id={media.id}
              data-product-media-thumbnail=""
              key={media.id}
              onClick={() => onSelectMedia(media.id)}
              type="button"
            >
              <ProductMediaThumbnail
                media={media}
                productTitle={productTitle}
                sizes="128px"
              />
            </button>
          ))}
        </div>
        {overflow.canScrollForward ? (
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l to-transparent",
              isDark ? "from-[#080808]" : "from-white dark:from-[#1a1a1a]",
            )}
          />
        ) : null}
      </div>

      {hasOverflow ? (
        <div
          aria-hidden="true"
          className={cn(
            "relative mt-1.5 h-1 overflow-hidden rounded-full",
            isDark ? "bg-white/12" : "bg-[#e8e8e2] dark:bg-white/10",
          )}
        >
          <span
            className="absolute inset-y-0 rounded-full bg-[#ff5a1f] transition-[left] duration-150"
            style={{
              left: `${overflow.scrollThumbLeft}%`,
              width: `${overflow.scrollThumbWidth}%`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function ProductMediaLightbox({
  activeMedia,
  galleryMedia,
  isOpen,
  onNext,
  onOpenChange,
  onPrevious,
  onSelectMedia,
  productTitle,
}: {
  activeMedia: MarketplaceProductMedia | null;
  galleryMedia: MarketplaceProductMedia[];
  isOpen: boolean;
  onNext: () => void;
  onOpenChange: (open: boolean) => void;
  onPrevious: () => void;
  onSelectMedia: (mediaId: string) => void;
  productTitle: string;
}) {
  const selectedMedia = activeMedia ?? galleryMedia[0] ?? null;
  const activeIndex = selectedMedia
    ? galleryMedia.findIndex((item) => item.id === selectedMedia.id)
    : -1;
  const displayIndex = activeIndex >= 0 ? activeIndex + 1 : 1;
  const hasMultipleMedia = galleryMedia.length > 1;
  const lightboxSwipeRef = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
  });

  useEffect(() => {
    if (!isOpen || !hasMultipleMedia) {
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
  }, [hasMultipleMedia, isOpen, onNext, onPrevious]);

  function handleLightboxPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (!hasMultipleMedia || event.pointerType !== "touch") {
      return;
    }

    lightboxSwipeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some mobile browsers reject capture while media controls are active.
    }
  }

  function handleLightboxPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (
      !hasMultipleMedia ||
      lightboxSwipeRef.current.pointerId !== event.pointerId
    ) {
      return;
    }

    const deltaX = event.clientX - lightboxSwipeRef.current.startX;
    const deltaY = event.clientY - lightboxSwipeRef.current.startY;
    lightboxSwipeRef.current.pointerId = -1;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) {
      return;
    }

    if (deltaX > 0) {
      onPrevious();
    } else {
      onNext();
    }
  }

  function handleLightboxPointerCancel(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (lightboxSwipeRef.current.pointerId !== event.pointerId) {
      return;
    }

    lightboxSwipeRef.current.pointerId = -1;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="left-0 top-0 h-dvh max-h-dvh w-screen max-w-screen translate-x-0 translate-y-0 rounded-none border-0 bg-[#080808] p-0 text-white ring-white/15 sm:left-1/2 sm:top-1/2 sm:h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-1rem)] sm:w-[min(96rem,calc(100vw-1rem))] sm:max-w-none sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border sm:border-white/10"
        overlayClassName="bg-black/70 backdrop-blur-sm"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">
          {productTitle} media gallery
        </DialogTitle>
        <DialogDescription className="sr-only">
          View larger product images and videos, then use thumbnails or arrow
          keys to move through the gallery.
        </DialogDescription>
        <DialogClose className="absolute right-4 top-4 z-30 grid size-10 place-items-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/35">
          <XIcon className="size-5" />
          <span className="sr-only">Close media gallery</span>
        </DialogClose>

        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] sm:grid-rows-[auto_minmax(0,1fr)_auto]">
          <header className="min-w-0 border-b border-white/10 px-4 py-3 pr-16 sm:px-5">
            <p className="max-w-full truncate text-sm font-black text-white sm:text-base">
              {productTitle}
            </p>
            <p className="mt-1 text-xs font-semibold text-white/60">
              Media {displayIndex} of {Math.max(galleryMedia.length, 1)}
            </p>
          </header>

          <div
            className="relative grid min-h-0 touch-pan-y place-items-center overflow-hidden bg-[#080808]"
            onPointerCancel={handleLightboxPointerCancel}
            onPointerDown={handleLightboxPointerDown}
            onPointerUp={handleLightboxPointerUp}
          >
            <div
              className="relative size-full max-h-full max-w-full overflow-hidden"
              data-product-lightbox-media-container=""
            >
              {selectedMedia ? (
                selectedMedia.kind === "video" ? (
                  <video
                    aria-label={
                      selectedMedia.altText ?? `${productTitle} product video`
                    }
                    className="size-full object-contain"
                    controls
                    key={selectedMedia.id}
                    playsInline
                    poster={selectedMedia.posterUrl ?? undefined}
                    preload="metadata"
                  >
                    <source
                      src={selectedMedia.url}
                      type={selectedMedia.mimeType}
                    />
                    Your browser does not support product video playback.
                  </video>
                ) : (
                  <Image
                    alt={selectedMedia.altText ?? productTitle}
                    className="object-contain"
                    fill
                    priority
                    quality={90}
                    sizes="100vw"
                    src={selectedMedia.url}
                  />
                )
              ) : (
                <div className="grid size-full place-items-center text-sm font-semibold text-white/60">
                  Jurgens Energy
                </div>
              )}
            </div>

            {hasMultipleMedia ? (
              <>
                <button
                  aria-label="Previous product media"
                  className="absolute left-3 top-1/2 z-20 hidden size-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/35 sm:left-5 sm:grid"
                  onClick={onPrevious}
                  type="button"
                >
                  <ChevronLeftIcon className="size-6" />
                </button>
                <button
                  aria-label="Next product media"
                  className="absolute right-3 top-1/2 z-20 hidden size-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/35 sm:right-5 sm:grid"
                  onClick={onNext}
                  type="button"
                >
                  <ChevronRightIcon className="size-6" />
                </button>
                <span className="absolute bottom-4 right-4 z-20 rounded-full bg-white/18 px-2.5 py-1 text-xs font-black leading-none text-white shadow-sm backdrop-blur-sm sm:hidden">
                  {displayIndex}/{galleryMedia.length}
                </span>
              </>
            ) : null}
          </div>

          {hasMultipleMedia ? (
            <div className="hidden border-t border-white/10 bg-[#080808]/95 px-4 py-3 sm:block sm:px-5">
              <ProductMediaThumbnailStrip
                activeMediaId={selectedMedia?.id ?? null}
                galleryMedia={galleryMedia}
                onSelectMedia={onSelectMedia}
                productTitle={productTitle}
                tone="dark"
              />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProductBuyBox({
  currencyContext,
  deliveryAvailable,
  deliveryBenefit,
  deliveryDetail,
  deliveryTimingDescription,
  priceTaxDisclosure,
  product,
  quantity,
  sellerName,
  selectedPrice,
  selectedVariant,
  selectedVariantId,
  setQuantity,
  setSelectedVariantId,
}: {
  currencyContext: CurrencyContext;
  deliveryAvailable: boolean;
  deliveryBenefit: string;
  deliveryDetail: string;
  deliveryTimingDescription: string;
  priceTaxDisclosure: string;
  product: MarketplaceProductDetailView;
  quantity: number;
  sellerName: string;
  selectedPrice: string;
  selectedVariant: MarketplaceVariant | null;
  selectedVariantId: string;
  setQuantity: (quantity: number) => void;
  setSelectedVariantId: (variantId: string) => void;
}) {
  const hasExchangeRequirement = isExchangeVariant(selectedVariant);
  const [added, setAdded] = useState(false);
  const [isOptionsDialogOpen, setIsOptionsDialogOpen] = useState(false);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exchangeEmptySize = getExchangeEmptySize(product, selectedVariant);
  const exchangeRequirementText = selectedVariant
    ? getExchangeRequirementText({
        emptySize: exchangeEmptySize,
        fallbackText: selectedVariant.exchangeConfirmationText,
        quantity,
      })
    : "";
  const canAddToCart = Boolean(selectedVariant);
  const needsMobileOptionsDialog =
    product.variants.length > 1 || hasExchangeRequirement;
  const mobilePrimaryActionLabel = added
    ? "Added"
    : product.variants.length > 1
      ? "Select An Option"
      : hasExchangeRequirement
        ? "Review & Add"
        : "Add To Cart";
  const selectedPriceMarkdown = selectedVariant
    ? getVariantMarkdownDisplay(selectedVariant, currencyContext)
    : null;
  const topSoldVariantId = getTopSoldVariantId(product.variants);
  const soldLabel = getSoldQuantityLabel(product.totalSoldQuantity);
  const selectedStockStatus = selectedVariant?.stockStatus ?? product.stockStatus;
  const selectedLowStockQuantity =
    selectedStockStatus === "low_stock"
      ? selectedVariant
        ? Math.max(0, Math.floor(selectedVariant.stockOnHand))
        : product.lowStockQuantity
      : null;

  useEffect(() => {
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
      exchangeConfirmationText: exchangeRequirementText,
      exchangeEmptyConfirmed: false,
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
        deliveryAvailable={deliveryAvailable}
        deliveryBenefit={deliveryBenefit}
        deliveryDetail={deliveryDetail}
        deliveryTimingDescription={deliveryTimingDescription}
        onOpenOptions={() => setIsOptionsDialogOpen(true)}
        onSelectVariant={setSelectedVariantId}
        product={product}
        sellerName={sellerName}
        selectedPriceMarkdown={selectedPriceMarkdown}
        selectedPrice={selectedPrice}
        selectedVariant={selectedVariant}
        selectedVariantId={selectedVariantId}
        lowStockQuantity={selectedLowStockQuantity}
        priceTaxDisclosure={priceTaxDisclosure}
        soldLabel={soldLabel}
        stockStatus={selectedStockStatus}
        topSoldVariantId={topSoldVariantId}
      />

      <aside className="hidden h-fit min-w-0 max-w-full gap-4 overflow-hidden rounded-lg border border-[#e8e8e2] bg-white p-4 shadow-[0_16px_40px_rgba(8,8,8,0.05)] dark:border-white/10 dark:bg-white/[0.04] sm:gap-5 sm:p-5 lg:sticky lg:top-36 lg:grid lg:self-start">
      <div className="grid gap-3 border-b border-[#ecece6] pb-4 dark:border-white/10 sm:pb-5">
        <div>
          <ProductConversionHeader
            averageRating={product.averageRating}
            available={deliveryAvailable}
            benefit={deliveryBenefit}
            productCode={selectedVariant?.sku ?? null}
            productTitle={product.title}
            reviewCount={product.reviewCount}
            sellerName={sellerName}
            soldLabel={soldLabel}
          />
          <PriceWithMarkdown
            className="mt-2.5"
            compareAtClassName="text-xs sm:text-sm"
            currentClassName="text-[22px] sm:text-[24px]"
            markdown={selectedPriceMarkdown}
            price={selectedPrice}
          />
          {shouldShowPriceTaxDisclosure(priceTaxDisclosure) ? (
            <p className="-mt-px text-[10px] font-medium leading-3 text-slate-500 dark:text-zinc-400 sm:text-[11px]">
              {priceTaxDisclosure}
            </p>
          ) : null}
          {selectedVariant?.saleBadge?.endsAt ? (
            <MarketplaceSaleCountdown
              className="mt-3 w-fit"
              endsAt={selectedVariant.saleBadge.endsAt}
              label={selectedVariant.saleBadge.text}
              variant="prominent"
            />
          ) : null}
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
            <ProductStockStatusBadge
              lowStockQuantity={selectedLowStockQuantity}
              status={selectedStockStatus}
            />
          </div>
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
        <ExchangeRequirementNotice
          emptySize={exchangeEmptySize}
          quantity={quantity}
          requirementText={exchangeRequirementText}
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
            "inline-flex h-auto min-h-14 w-full flex-col gap-0.5 rounded-full py-2 normal-case leading-normal disabled:cursor-not-allowed disabled:bg-[#cfcfca] disabled:text-white disabled:shadow-none disabled:hover:bg-[#cfcfca]",
          )}
          disabled={!canAddToCart}
          onClick={() => handleAddToCart()}
          type="button"
        >
          <ProductConversionActionContent
            actionLabel="Add to cart"
            added={added}
            deliveryBenefit={deliveryBenefit}
            discountLabel={selectedPriceMarkdown?.discountLabel ?? null}
          />
        </button>
      </div>

      <ProductDeliveryEstimate
        deliveryTimingDescription={deliveryTimingDescription}
        variantId={selectedVariant?.id ?? null}
      />

      <ProductPolicyLinks />

      </aside>

      <ProductOptionsDialog
        added={added}
        canAddToCart={canAddToCart}
        currencyContext={currencyContext}
        deliveryAvailable={deliveryAvailable}
        deliveryBenefit={deliveryBenefit}
        exchangeEmptySize={exchangeEmptySize}
        exchangeRequirementText={exchangeRequirementText}
        hasExchangeRequirement={hasExchangeRequirement}
        isOpen={isOptionsDialogOpen}
        onAddToCart={() => handleAddToCart({ closeOptions: true })}
        onOpenChange={setIsOptionsDialogOpen}
        product={product}
        quantity={quantity}
        selectedPriceMarkdown={selectedPriceMarkdown}
        selectedPrice={selectedPrice}
        selectedVariant={selectedVariant}
        selectedVariantId={selectedVariantId}
        setQuantity={setQuantity}
        setSelectedVariantId={setSelectedVariantId}
        lowStockQuantity={selectedLowStockQuantity}
        priceTaxDisclosure={priceTaxDisclosure}
        soldLabel={soldLabel}
        stockStatus={selectedStockStatus}
        topSoldVariantId={topSoldVariantId}
      />

      {!isOptionsDialogOpen ? (
        <MobileStickyPurchaseBar
          added={added}
          deliveryBenefit={deliveryBenefit}
          deliveryDetail={deliveryDetail}
          discountLabel={selectedPriceMarkdown?.discountLabel ?? null}
          hasExchangeRequirement={hasExchangeRequirement}
          label={mobilePrimaryActionLabel}
          onAction={handleMobilePrimaryAction}
          selectedPrice={selectedPrice}
        />
      ) : null}
    </>
  );
}

function ProductStockStatusBadge({
  className,
  compact = false,
  lowStockQuantity,
  status,
}: {
  className?: string;
  compact?: boolean;
  lowStockQuantity?: number | null;
  status: MarketplaceStockStatus;
}) {
  if (status === "low_stock") {
    const stockLabel =
      lowStockQuantity && lowStockQuantity > 0
        ? lowStockQuantity === 1
          ? "Only 1 left"
          : `Only ${lowStockQuantity} left`
        : getMarketplaceStockStatusLabel(status);

    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap font-black leading-none text-[#ff5a1f]",
          compact ? "text-[10px]" : "text-xs sm:text-sm",
          className,
        )}
      >
        <FlameIcon
          aria-hidden="true"
          className={cn(
            "shrink-0 fill-current",
            compact ? "size-3" : "size-3.5 sm:size-4",
          )}
        />
        {stockLabel}
      </span>
    );
  }

  return (
    <Badge
      className={cn(
        "rounded-full font-black",
        compact
          ? "h-5 px-2 text-[10px]"
          : "px-2.5 py-1 text-[11px] sm:px-3 sm:text-xs",
        status === "in_stock" &&
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-300",
        status === "backorder" &&
          "bg-[#1a1a1a] text-white dark:bg-[#f7f7f2] dark:text-[#080808]",
        className,
      )}
    >
      {getMarketplaceStockStatusLabel(status)}
    </Badge>
  );
}

function MobileProductPurchaseSummary({
  currencyContext,
  deliveryAvailable,
  deliveryBenefit,
  deliveryDetail,
  deliveryTimingDescription,
  onOpenOptions,
  onSelectVariant,
  product,
  sellerName,
  selectedPriceMarkdown,
  selectedPrice,
  selectedVariant,
  selectedVariantId,
  lowStockQuantity,
  priceTaxDisclosure,
  soldLabel,
  stockStatus,
  topSoldVariantId,
}: {
  currencyContext: CurrencyContext;
  deliveryAvailable: boolean;
  deliveryBenefit: string;
  deliveryDetail: string;
  deliveryTimingDescription: string;
  onOpenOptions: () => void;
  onSelectVariant: (variantId: string) => void;
  product: MarketplaceProductDetailView;
  sellerName: string;
  selectedPriceMarkdown: VariantMarkdownDisplay | null;
  selectedPrice: string;
  selectedVariant: MarketplaceVariant | null;
  selectedVariantId: string;
  lowStockQuantity: number | null;
  priceTaxDisclosure: string;
  soldLabel: string | null;
  stockStatus: MarketplaceStockStatus;
  topSoldVariantId: string | null;
}) {
  const shortDescription = product.shortDescription
    ? cleanInlineText(product.shortDescription)
    : null;

  return (
    <div className="grid min-w-0 gap-0 lg:hidden">
      <MobileTrustTicker priceTaxDisclosure={priceTaxDisclosure} />

      <section className="grid w-full min-w-0 max-w-[100vw] gap-2.5 overflow-x-hidden border-b border-[#e8e8e2] bg-white px-4 py-3.5 dark:border-white/10 dark:bg-white/[0.04] sm:rounded-lg sm:border sm:p-3 sm:shadow-sm">
        <div className="grid min-w-0 gap-1.5">
          <ProductConversionHeader
            averageRating={product.averageRating}
            available={deliveryAvailable}
            benefit={deliveryBenefit}
            compact
            productCode={selectedVariant?.sku ?? null}
            productTitle={product.title}
            reviewCount={product.reviewCount}
            sellerName={sellerName}
            soldLabel={soldLabel}
          />
          <PriceWithMarkdown
            className="mt-0.5"
            compareAtClassName="text-[11px]"
            currentClassName="text-[20px] sm:text-[21px]"
            markdown={selectedPriceMarkdown}
            price={selectedPrice}
          />
          {shouldShowPriceTaxDisclosure(priceTaxDisclosure) ? (
            <p className="-mt-px text-[10px] font-medium leading-3 text-slate-500 dark:text-zinc-400">
              {priceTaxDisclosure}
            </p>
          ) : null}
          {selectedVariant?.saleBadge?.endsAt ? (
            <MarketplaceSaleCountdown
              className="mt-1.5 w-fit"
              endsAt={selectedVariant.saleBadge.endsAt}
              label={selectedVariant.saleBadge.text}
              variant="prominent"
            />
          ) : null}
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <ProductStockStatusBadge
              compact
              lowStockQuantity={lowStockQuantity}
              status={stockStatus}
            />
          </div>
        </div>

        {shortDescription ? (
          <MobileExpandableDescription text={shortDescription} />
        ) : null}

        <ProductPolicyLinks />

        <ProductDeliveryEstimate
          deliveryTimingDescription={deliveryTimingDescription}
          variantId={selectedVariant?.id ?? null}
        />
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
                    className="object-contain"
                    fill
                    quality={90}
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

type ProductShareFeedback = "copied" | "error" | "idle" | "shared";

function ProductConversionHeader({
  averageRating,
  available,
  benefit,
  compact = false,
  productCode,
  productTitle,
  reviewCount,
  sellerName,
  soldLabel,
}: {
  averageRating: number | null;
  available: boolean;
  benefit: string;
  compact?: boolean;
  productCode: string | null;
  productTitle: string;
  reviewCount: number;
  sellerName: string;
  soldLabel: string | null;
}) {
  const sellerLabel = sellerName.trim() || "Jurgens Energy";

  return (
    <div className="min-w-0">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="grid min-w-0 gap-1">
          <ProductDeliveryBenefit
            available={available}
            benefit={benefit}
            compact={compact}
            className={compact ? "text-[11px]" : "text-xs sm:text-[13px]"}
          />
          <h1
            className={cn(
              "min-w-0 max-w-full break-words font-normal text-[#080808] [overflow-wrap:anywhere] dark:text-[#f7f7f2]",
              compact
                ? "text-[18px] leading-[1.24] sm:text-[19px]"
                : "text-[21px] leading-[1.28] xl:text-[22px]",
            )}
          >
            {productTitle}
          </h1>
          {productCode ? (
            <p
              className={cn(
                "min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-400",
                compact ? "leading-3" : "sm:text-[11px]",
              )}
            >
              Product code: {productCode}
            </p>
          ) : null}
        </div>
        <ProductShareButton compact={compact} productTitle={productTitle} />
      </div>

      <div className="mt-2 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] leading-4 text-slate-600 dark:text-zinc-300 sm:text-[11px]">
          <span className="inline-flex shrink-0 items-center gap-1 font-bold text-[#ff5a1f]">
            <FlameIcon
              aria-hidden="true"
              className="size-3.5 shrink-0 fill-current"
            />
            {soldLabel ?? "New"}
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-zinc-600">
            •
          </span>
          <span className="min-w-0">
            Sold by{" "}
            <span className="font-semibold text-[#080808] dark:text-[#f7f7f2]">
              {sellerLabel}
            </span>
          </span>
        </div>

        <ProductInlineRating
          averageRating={averageRating}
          compact={compact}
          reviewCount={reviewCount}
        />
      </div>
    </div>
  );
}

function ProductShareButton({
  compact = false,
  productTitle,
}: {
  compact?: boolean;
  productTitle: string;
}) {
  const [feedback, setFeedback] = useState<ProductShareFeedback>("idle");
  const resetFeedbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetFeedbackRef.current) {
        clearTimeout(resetFeedbackRef.current);
      }
    },
    [],
  );

  function showFeedback(nextFeedback: Exclude<ProductShareFeedback, "idle">) {
    setFeedback(nextFeedback);

    if (resetFeedbackRef.current) {
      clearTimeout(resetFeedbackRef.current);
    }

    resetFeedbackRef.current = setTimeout(() => setFeedback("idle"), 2200);
  }

  async function handleShare() {
    const url = window.location.href;

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: productTitle,
          url,
        });
        showFeedback("shared");
        return;
      } catch (error) {
        if (
          error instanceof DOMException
            ? error.name === "AbortError"
            : error instanceof Error && error.name === "AbortError"
        ) {
          return;
        }
      }
    }

    try {
      await copyProductUrlToClipboard(url);
      showFeedback("copied");
    } catch {
      showFeedback("error");
    }
  }

  const feedbackLabel =
    feedback === "copied"
      ? "Link copied"
      : feedback === "shared"
        ? "Shared"
        : feedback === "error"
          ? "Unable to share"
          : "";

  return (
    <div className="relative shrink-0">
      <button
        aria-label={
          feedback === "copied"
            ? "Product link copied"
            : feedback === "shared"
              ? "Product shared"
              : "Share this product"
        }
        className={cn(
          "grid place-items-center rounded-full border border-[#e8e8e2] bg-white text-[#080808] shadow-sm transition hover:border-[#ff5a1f] hover:text-[#ff5a1f] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/25 dark:border-white/15 dark:bg-white/[0.06] dark:text-[#f7f7f2]",
          compact ? "size-9" : "size-10",
        )}
        onClick={handleShare}
        title="Share this product"
        type="button"
      >
        {feedback === "copied" || feedback === "shared" ? (
          <CheckIcon aria-hidden="true" className="size-4 text-emerald-600" />
        ) : (
          <Share2Icon aria-hidden="true" className="size-4" />
        )}
      </button>
      {feedbackLabel ? (
        <span
          aria-live="polite"
          className="absolute right-0 top-[calc(100%+0.35rem)] z-20 whitespace-nowrap rounded-md bg-[#080808] px-2 py-1 text-[9px] font-semibold text-white shadow-lg dark:bg-[#f7f7f2] dark:text-[#080808]"
          role="status"
        >
          {feedbackLabel}
        </span>
      ) : null}
    </div>
  );
}

function ProductInlineRating({
  averageRating,
  compact = false,
  reviewCount,
}: {
  averageRating: number | null;
  compact?: boolean;
  reviewCount: number;
}) {
  const reviewWord = reviewCount === 1 ? "review" : "reviews";
  const reviewsHref = `#${productReviewsSectionId}`;

  function handleReviewShortcutClick(
    event: ReactMouseEvent<HTMLAnchorElement>,
  ) {
    const reviewsSection = document.getElementById(productReviewsSectionId);

    if (!reviewsSection) {
      return;
    }

    event.preventDefault();

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    reviewsSection.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
    reviewsSection.focus({ preventScroll: true });
    window.history.replaceState(null, "", reviewsHref);
  }

  if (averageRating && reviewCount > 0) {
    return (
      <a
        aria-label={`${formatProductRating(averageRating)} out of 5 stars from ${reviewCount} review${reviewCount === 1 ? "" : "s"}`}
        className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold leading-none text-[#080808] transition hover:text-[#ff5a1f] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/20 dark:text-[#f7f7f2]"
        href={reviewsHref}
        onClick={handleReviewShortcutClick}
        title={`Read ${reviewCount} customer ${reviewWord}`}
      >
        <span>{formatProductRating(averageRating)}</span>
        <span aria-hidden="true" className="flex items-center gap-px text-[#ff5a1f]">
          {Array.from({ length: 5 }, (_, index) => (
            <StarIcon
              className={cn(
                "size-3",
                index < Math.round(averageRating)
                  ? "fill-current"
                  : "text-slate-300 dark:text-zinc-600",
              )}
              key={index}
            />
          ))}
        </span>
        <span className="text-slate-500 dark:text-zinc-400">
          ({reviewCount})
        </span>
      </a>
    );
  }

  return (
    <a
      aria-label="No product ratings yet. Be first to review this product."
      className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold leading-none text-slate-500 transition hover:text-[#ff5a1f] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/20 dark:text-zinc-400"
      href={reviewsHref}
      onClick={handleReviewShortcutClick}
      title="Be first to review"
    >
      {!compact ? (
        <>
          <span>No ratings yet</span>
          <span aria-hidden="true" className="text-slate-300 dark:text-zinc-600">
            ·
          </span>
        </>
      ) : null}
      <span className="font-bold text-[#ff5a1f]">Be first to review</span>
    </a>
  );
}

function formatProductRating(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

async function copyProductUrlToClipboard(url: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return;
  }

  const textArea = document.createElement("textarea");
  const previouslyFocusedElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

  textArea.value = url;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();

  const copied = document.execCommand("copy");

  textArea.remove();
  previouslyFocusedElement?.focus();

  if (!copied) {
    throw new Error("Clipboard copy was unavailable.");
  }
}

function ProductDeliveryBenefit({
  available,
  benefit,
  className,
  compact = false,
  inline = false,
}: {
  available: boolean;
  benefit: string;
  className?: string;
  compact?: boolean;
  inline?: boolean;
}) {
  return (
    <span
      className={cn(
        "min-w-0 max-w-full items-start gap-1.5 font-bold",
        inline
          ? "mr-1 inline-flex align-middle"
          : "grid w-full grid-cols-[auto_minmax(0,1fr)]",
        available
          ? "text-emerald-700 dark:text-emerald-300"
          : "text-rose-700 dark:text-rose-300",
        compact ? "text-[11px] leading-4" : "text-[13px] leading-5 sm:text-sm",
        className,
      )}
    >
      <TruckIcon
        aria-hidden="true"
        className={cn(
          "mt-0.5 shrink-0 stroke-[2.4]",
          compact ? "size-3.5" : "size-4 sm:size-[18px]",
        )}
      />
      <span className="min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere]">
        {benefit}
      </span>
    </span>
  );
}

function ProductSoldProof({
  className,
  compact = false,
  label,
}: {
  className?: string;
  compact?: boolean;
  label: string | null;
}) {
  if (!label) {
    return null;
  }

  return (
    <p
      className={cn(
        "inline-flex w-fit items-center gap-1 font-semibold text-[#ff5a1f]",
        compact ? "text-[10px] leading-4" : "text-[11px] leading-4 sm:text-xs",
        className,
      )}
      data-product-sales-proof=""
    >
      <FlameIcon
        aria-hidden="true"
        className={cn(
          "shrink-0 fill-current",
          compact ? "size-3" : "size-3.5",
        )}
      />
      <span>{label}</span>
    </p>
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
          "font-extrabold leading-none text-[#080808] dark:text-[#f7f7f2]",
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

function ProductPolicyLinks({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <nav
      aria-label="Product help links"
      className={cn(
        "flex min-w-0 items-stretch overflow-x-auto border-t border-[#ecece6] [scrollbar-width:none] dark:border-white/10 [&::-webkit-scrollbar]:hidden",
        compact ? "pt-2" : "pt-2.5",
        className,
      )}
    >
      {productPolicyLinks.map((policy) => {
        const Icon = policy.icon;

        return (
          <Link
            className={cn(
              "inline-flex min-w-[4.75rem] flex-1 shrink-0 items-center justify-center whitespace-nowrap border-l border-[#ecece6] font-black text-slate-700 transition first:border-l-0 hover:text-[#ff5a1f] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/20 dark:border-white/10 dark:text-zinc-200",
              compact
                ? "h-7 gap-1 px-2 text-[9px] leading-none"
                : "h-9 gap-1.5 px-2 text-[11px] leading-none",
            )}
            href={policy.href}
            key={policy.kind}
          >
            <Icon
              aria-hidden="true"
              className={cn(
                "shrink-0 text-[#ff5a1f]",
                compact ? "size-3" : "size-3.5",
              )}
            />
            <span className="min-w-0 whitespace-nowrap">{policy.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function ProductOptionsDialog({
  added,
  canAddToCart,
  currencyContext,
  deliveryAvailable,
  deliveryBenefit,
  exchangeEmptySize,
  exchangeRequirementText,
  hasExchangeRequirement,
  isOpen,
  onAddToCart,
  onOpenChange,
  product,
  quantity,
  selectedPriceMarkdown,
  selectedPrice,
  selectedVariant,
  selectedVariantId,
  setQuantity,
  setSelectedVariantId,
  lowStockQuantity,
  priceTaxDisclosure,
  soldLabel,
  stockStatus,
  topSoldVariantId,
}: {
  added: boolean;
  canAddToCart: boolean;
  currencyContext: CurrencyContext;
  deliveryAvailable: boolean;
  deliveryBenefit: string;
  exchangeEmptySize: string | null;
  exchangeRequirementText: string;
  hasExchangeRequirement: boolean;
  isOpen: boolean;
  onAddToCart: () => void;
  onOpenChange: (open: boolean) => void;
  product: MarketplaceProductDetailView;
  quantity: number;
  selectedPriceMarkdown: VariantMarkdownDisplay | null;
  selectedPrice: string;
  selectedVariant: MarketplaceVariant | null;
  selectedVariantId: string;
  setQuantity: (quantity: number) => void;
  setSelectedVariantId: (variantId: string) => void;
  lowStockQuantity: number | null;
  priceTaxDisclosure: string;
  soldLabel: string | null;
  stockStatus: MarketplaceStockStatus;
  topSoldVariantId: string | null;
}) {
  const selectedImage = selectedVariant?.imageUrl ?? product.coverImageUrl;
  const variantOptionLabel = getVariantOptionGroupLabel(product);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="bottom-0 left-0 top-auto min-h-0 max-h-[min(88dvh,42rem)] w-full max-w-full translate-x-0 translate-y-0 rounded-b-none rounded-t-xl border border-[#e8e8e2] bg-white p-0 text-[#080808] ring-[#080808]/10 dark:border-white/10 dark:bg-[#101010] dark:text-[#f7f7f2] sm:max-w-full lg:bottom-auto lg:left-1/2 lg:top-1/2 lg:w-[min(32rem,calc(100vw-2rem))] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-xl"
        overlayClassName="bg-black/55"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">
          Select {variantOptionLabel}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {hasExchangeRequirement
            ? `Choose ${variantOptionLabel}, review the exchange requirement, and add the item to your cart.`
            : `Choose ${variantOptionLabel} and add the item to your cart.`}
        </DialogDescription>

        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[#d8d8d2] dark:bg-white/20" />

        <header className="grid shrink-0 grid-cols-[3.75rem_minmax(0,1fr)_2.25rem] gap-3 border-b border-[#ecece6] px-3 pb-3 pt-2.5 dark:border-white/10">
          <div className="relative aspect-square overflow-hidden rounded-md bg-[#f7f7f2] dark:bg-[#1a1a1a]">
            {selectedImage ? (
              <Image
                alt={product.title}
                className="object-contain"
                fill
                quality={90}
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
            <ProductDeliveryBenefit
              available={deliveryAvailable}
              benefit={deliveryBenefit}
              compact
            />
            <p className="mt-0.5 line-clamp-2 break-words text-sm font-normal leading-5 text-[#080808] [overflow-wrap:anywhere] dark:text-[#f7f7f2]">
              {product.title}
            </p>
            <ProductSoldProof className="mt-0.5" compact label={soldLabel} />
            <PriceWithMarkdown
              className="mt-1"
              compareAtClassName="text-[11px]"
              currentClassName="text-lg text-[#080808] dark:text-[#f7f7f2]"
              markdown={selectedPriceMarkdown}
              price={selectedPrice}
            />
            {shouldShowPriceTaxDisclosure(priceTaxDisclosure) ? (
              <div className="mt-1 text-[10px] font-medium leading-4 text-slate-500 dark:text-zinc-400">
                <p>{priceTaxDisclosure}</p>
              </div>
            ) : null}
            <ProductStockStatusBadge
              className="mt-1"
              compact
              lowStockQuantity={lowStockQuantity}
              status={stockStatus}
            />
          </div>
          <DialogClose className="grid size-9 place-items-center rounded-full text-[#080808] transition hover:bg-[#f7f7f2] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/20 dark:text-[#f7f7f2] dark:hover:bg-white/10">
            <XIcon className="size-5" />
            <span className="sr-only">Close product options</span>
          </DialogClose>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
            <ExchangeRequirementNotice
              className="mt-3"
              emptySize={exchangeEmptySize}
              quantity={quantity}
              requirementText={exchangeRequirementText}
            />
          ) : null}

          <ProductPolicyLinks className="mt-3" compact />

          <CompactTrustRow className="mt-2.5" deliveryLabel="Delivery options" modalCompact />

          <section className="mt-3 grid gap-1.5">
            <h2 className="text-xs font-black text-[#080808] dark:text-[#f7f7f2]">
              Qty
            </h2>
            <QuantityStepper quantity={quantity} setQuantity={setQuantity} />
          </section>
        </div>

        <footer className="grid shrink-0 gap-2 border-t border-[#e8e8e2] bg-white px-3 pb-[calc(env(safe-area-inset-bottom)+0.625rem)] pt-2.5 shadow-[0_-12px_28px_rgba(8,8,8,0.08)] dark:border-white/10 dark:bg-[#101010]">
          <p className="text-center text-xs font-semibold text-[#080808] dark:text-[#f7f7f2]">
            Order details are confirmed before payment.
          </p>
          <button
            className={cn(
              marketplacePrimaryActionBaseClass,
              "inline-flex h-auto min-h-14 w-full flex-col gap-0.5 rounded-full py-2 normal-case leading-normal disabled:cursor-not-allowed disabled:bg-[#cfcfca] disabled:text-white disabled:shadow-none disabled:hover:bg-[#cfcfca]",
            )}
            disabled={!canAddToCart}
            onClick={onAddToCart}
            type="button"
          >
            <ProductConversionActionContent
              actionLabel="Add to cart"
              added={added}
              deliveryBenefit={deliveryBenefit}
              discountLabel={selectedPriceMarkdown?.discountLabel ?? null}
            />
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
            className="object-contain"
            fill
            quality={90}
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

function shouldShowPriceTaxDisclosure(value: string) {
  return value.trim().toLowerCase() !== "final price";
}

function MobileTrustTicker({
  priceTaxDisclosure,
}: {
  priceTaxDisclosure: string;
}) {
  const items = [
    { icon: ShieldCheckIcon, label: "Careful handling" },
    { icon: CreditCardIcon, label: "Secure payments" },
    ...(shouldShowPriceTaxDisclosure(priceTaxDisclosure)
      ? [{ icon: FileTextIcon, label: priceTaxDisclosure }]
      : []),
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
      title: "Delivery details before payment",
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
            detail: "A matching empty cylinder is required at delivery.",
            icon: RefreshCcwIcon,
            title: "Empty cylinder required",
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
  modalCompact = false,
}: {
  className?: string;
  deliveryLabel: string;
  modalCompact?: boolean;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-lg border border-[#e8e8e2] bg-white font-black uppercase leading-none text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200",
        modalCompact
          ? "grid grid-cols-2 gap-1.5 px-2 py-1.5 text-[9px]"
          : "flex items-start gap-2 px-3 py-2 text-[11px]",
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex min-w-0 items-center",
          modalCompact ? "gap-1" : "gap-1.5",
        )}
      >
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-full bg-emerald-700 text-white dark:bg-emerald-400 dark:text-[#080808]",
            modalCompact ? "size-3.5" : "size-4",
          )}
        >
          <ShieldCheckIcon
            className={cn("stroke-[2.5]", modalCompact ? "size-2" : "size-2.5")}
          />
        </span>
        <span className="min-w-0 whitespace-nowrap">
          {modalCompact ? "Careful handling" : "Handled with care"}
        </span>
      </span>
      <span
        className={cn(
          "h-3 w-px shrink-0 bg-[#d8d8d2] dark:bg-white/15",
          modalCompact && "hidden",
        )}
      />
      <span
        className={cn(
          "inline-flex min-w-0 items-center",
          modalCompact ? "gap-1" : "gap-1.5",
        )}
      >
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-full bg-emerald-700 text-white dark:bg-emerald-400 dark:text-[#080808]",
            modalCompact ? "size-3.5" : "size-4",
          )}
        >
          <TruckIcon
            className={cn("stroke-[2.5]", modalCompact ? "size-2" : "size-2.5")}
          />
        </span>
        <span className="min-w-0 whitespace-nowrap">{deliveryLabel}</span>
      </span>
    </section>
  );
}

function ExchangeRequirementNotice({
  className,
  emptySize,
  quantity,
  requirementText,
}: {
  className?: string;
  emptySize: string | null;
  quantity: number;
  requirementText: string;
}) {
  return (
    <section
      aria-label="Empty cylinder required"
      className={cn(
        "rounded-md border border-[#e8e8e2] border-l-2 border-l-[#ff5a1f] bg-[#f7f7f2]/60 px-3 py-2.5 dark:border-white/10 dark:border-l-[#ff5a1f] dark:bg-white/[0.03]",
        className,
      )}
      role="note"
    >
      <div className="grid min-w-0 grid-cols-[1rem_minmax(0,1fr)] gap-x-2 gap-y-1">
        <RefreshCcwIcon
          aria-hidden="true"
          className="mt-0.5 size-4 text-[#ff5a1f]"
        />
        <p
          aria-atomic="true"
          aria-live="polite"
          className="text-[12px] font-black leading-4 text-[#080808] dark:text-[#f7f7f2]"
        >
          {getExchangeEmptyCountLabel(quantity, emptySize)}
        </p>
        <p className="col-start-2 text-[11px] leading-4 text-slate-600 dark:text-zinc-300">
          {requirementText}
        </p>
      </div>
    </section>
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

function ProductConversionActionContent({
  actionLabel,
  added,
  deliveryBenefit,
  discountLabel,
}: {
  actionLabel: string;
  added: boolean;
  deliveryBenefit: string;
  discountLabel: string | null;
}) {
  const headline = getProductConversionActionHeadline({
    actionLabel,
    added,
    discountLabel,
  });

  return (
    <>
      <span className="inline-flex min-w-0 items-center justify-center gap-1.5 text-[13px] font-black leading-4 normal-case">
        {added ? (
          <CheckIcon aria-hidden="true" className="size-4 shrink-0" />
        ) : null}
        <span className="min-w-0">{headline}</span>
      </span>
      <span className="block max-w-full px-2 text-[10px] font-semibold leading-3 text-white/85 normal-case">
        {deliveryBenefit}
      </span>
    </>
  );
}

function getProductConversionActionHeadline({
  actionLabel,
  added,
  discountLabel,
}: {
  actionLabel: string;
  added: boolean;
  discountLabel: string | null;
}) {
  if (added) {
    return "Added to cart";
  }

  const normalizedAction = /^select/i.test(actionLabel)
    ? "Select an option"
    : /^review/i.test(actionLabel)
      ? "Review & add"
      : "Add to cart";
  const discountPercent = discountLabel?.match(/(\d+(?:\.\d+)?)\s*%/)?.[1];

  return discountPercent
    ? `-${discountPercent}% now! ${normalizedAction}!`
    : `${normalizedAction}!`;
}

function MobileStickyPurchaseBar({
  added,
  deliveryBenefit,
  deliveryDetail,
  discountLabel,
  hasExchangeRequirement,
  label,
  onAction,
  selectedPrice,
}: {
  added: boolean;
  deliveryBenefit: string;
  deliveryDetail: string;
  discountLabel: string | null;
  hasExchangeRequirement: boolean;
  label: string;
  onAction: () => void;
  selectedPrice: string;
}) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e8e8e2] bg-white px-3 pb-[calc(env(safe-area-inset-bottom)+0.6rem)] pt-2 shadow-[0_-12px_30px_rgba(8,8,8,0.12)] dark:border-white/10 dark:bg-[#101010] lg:hidden"
      data-marketplace-mobile-dock
    >
      <div className="mx-auto grid w-full max-w-4xl gap-1.5">
        <p className="flex min-w-0 items-center justify-center gap-1.5 text-center text-[11px] font-semibold text-[#080808] dark:text-[#f7f7f2]">
          {hasExchangeRequirement ? (
            <>
              <RefreshCcwIcon className="size-3.5 shrink-0 text-[#ff5a1f]" />
              <span className="truncate">Empty cylinder required</span>
            </>
          ) : (
            <>
              <ShoppingCartIcon className="size-3.5 shrink-0 text-[#ff5a1f]" />
              <span className="truncate">{selectedPrice}</span>
            </>
          )}
        </p>
        <button
          className={cn(
            marketplacePrimaryActionBaseClass,
            "inline-flex h-auto min-h-14 w-full flex-col gap-0.5 rounded-full py-2 normal-case leading-normal",
          )}
          onClick={onAction}
          type="button"
        >
          <ProductConversionActionContent
            actionLabel={label}
            added={added}
            deliveryBenefit={deliveryBenefit || deliveryDetail}
            discountLabel={discountLabel}
          />
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
            className="flex w-[10.75rem] shrink-0 snap-start sm:w-[12rem] lg:w-[13rem]"
            key={item.id}
          >
            <MarketplaceProductCard
              product={item}
            />
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
  const description = parseProductDescription(
    product.fullDescription ?? product.description ?? product.shortDescription,
  );

  return (
    <section className="min-w-0 overflow-hidden border-y border-[#e8e8e2] bg-white px-4 py-3 dark:border-white/10 dark:bg-white/[0.04] sm:rounded-lg sm:border sm:p-4 sm:shadow-sm">
      <h2 className="border-b border-[#e8e8e2] pb-3 text-sm font-black text-[#080808] dark:border-white/10 dark:text-[#f7f7f2] sm:text-base">
        Description
      </h2>

      <div className="mt-4 grid gap-3 text-xs leading-6 text-slate-700 dark:text-zinc-300 sm:text-sm sm:leading-7">
        {description.length > 0 ? (
          description.map((block, index) => {
            if (block.type === "heading") {
              const className =
                block.level === 2
                  ? "mt-1 text-sm font-black text-[#080808] first:mt-0 dark:text-[#f7f7f2] sm:text-base"
                  : "mt-1 text-xs font-black uppercase tracking-[0.04em] text-[#080808] first:mt-0 dark:text-[#f7f7f2] sm:text-sm";

              return block.level === 2 ? (
                <h3 className={className} key={`${block.type}-${index}`}>
                  {block.text}
                </h3>
              ) : (
                <h4 className={className} key={`${block.type}-${index}`}>
                  {block.text}
                </h4>
              );
            }

            if (
              block.type === "ordered-list" ||
              block.type === "unordered-list"
            ) {
              const className = cn(
                "grid gap-1.5 pl-5 marker:font-black marker:text-[#ff5a1f]",
                block.type === "ordered-list" ? "list-decimal" : "list-disc",
              );
              const items = block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{item}</li>
              ));

              return block.type === "ordered-list" ? (
                <ol className={className} key={`${block.type}-${index}`}>
                  {items}
                </ol>
              ) : (
                <ul className={className} key={`${block.type}-${index}`}>
                  {items}
                </ul>
              );
            }

            if (block.type === "blockquote") {
              return (
                <blockquote
                  className="border-l-2 border-[#ff5a1f] pl-3 italic text-slate-600 dark:text-zinc-400"
                  key={`${block.type}-${index}`}
                >
                  {block.text}
                </blockquote>
              );
            }

            return <p key={`${block.type}-${index}`}>{block.text}</p>;
          })
        ) : (
          <p>No product details supplied yet.</p>
        )}
      </div>
    </section>
  );
}

function ProductReviewsSection({
  product,
}: {
  product: MarketplaceProductDetailView;
}) {
  const ratingSummary = product.ratingSummary;
  const ratingRows = [
    { count: ratingSummary.ratingCount5, label: "5 stars", value: 5 },
    { count: ratingSummary.ratingCount4, label: "4 stars", value: 4 },
    { count: ratingSummary.ratingCount3, label: "3 stars", value: 3 },
    { count: ratingSummary.ratingCount2, label: "2 stars", value: 2 },
    { count: ratingSummary.ratingCount1, label: "1 star", value: 1 },
  ];

  return (
    <section
      aria-labelledby={productReviewsHeadingId}
      className="grid min-w-0 scroll-mt-32 gap-4 overflow-hidden border-y border-[#e8e8e2] bg-white px-4 py-3 focus:outline-none dark:border-white/10 dark:bg-white/[0.04] sm:rounded-lg sm:border sm:p-4 sm:shadow-sm"
      id={productReviewsSectionId}
      tabIndex={-1}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            className="text-sm font-black text-[#080808] dark:text-[#f7f7f2] sm:text-base"
            id={productReviewsHeadingId}
          >
            Customer reviews
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
            Verified-purchase product feedback from Jurgens Energy customers.
          </p>
        </div>
        {product.averageRating && product.reviewCount > 0 ? (
          <div className="text-right">
            <p className="text-2xl font-black leading-none text-[#080808] dark:text-[#f7f7f2]">
              {formatProductRating(product.averageRating)}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              {product.reviewCount} review{product.reviewCount === 1 ? "" : "s"}
            </p>
          </div>
        ) : null}
      </div>

      {product.reviewCount > 0 ? (
        <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <div className="grid content-start gap-2">
            {ratingRows.map((row) => {
              const percentage =
                product.reviewCount > 0
                  ? Math.round((row.count / product.reviewCount) * 100)
                  : 0;

              return (
                <div
                  className="grid grid-cols-[3.4rem_minmax(0,1fr)_2.5rem] items-center gap-2 text-xs"
                  key={row.value}
                >
                  <span className="font-bold text-slate-600 dark:text-zinc-300">
                    {row.label}
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-[#f1f1eb] dark:bg-white/10">
                    <span
                      className="block h-full rounded-full bg-[#ff5a1f]"
                      style={{ width: `${percentage}%` }}
                    />
                  </span>
                  <span className="text-right tabular-nums text-slate-500 dark:text-zinc-400">
                    {row.count}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="grid gap-3">
            {product.reviews.map((review) => (
              <article
                className="rounded-md border border-[#ecece6] p-3 dark:border-white/10"
                key={review.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-0.5 text-[#ff5a1f]">
                      {Array.from({ length: 5 }, (_, index) => (
                        <StarIcon
                          aria-hidden="true"
                          className={cn(
                            "size-3.5",
                            index < review.rating
                              ? "fill-current"
                              : "text-slate-300 dark:text-zinc-600",
                          )}
                          key={index}
                        />
                      ))}
                    </span>
                    {review.isVerifiedPurchase ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-300">
                        Verified purchase
                      </span>
                    ) : null}
                  </div>
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                    {new Intl.DateTimeFormat("en-ZA", {
                      dateStyle: "medium",
                      timeZone: "Africa/Johannesburg",
                    }).format(review.createdAt)}
                  </span>
                </div>
                {review.title ? (
                  <p className="mt-2 text-sm font-black text-[#080808] dark:text-[#f7f7f2]">
                    {review.title}
                  </p>
                ) : null}
                {review.body ? (
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-zinc-300">
                    {review.body}
                  </p>
                ) : null}
                <p className="mt-2 text-xs font-bold text-slate-500 dark:text-zinc-400">
                  {review.customerDisplayName ?? "Jurgens Energy customer"}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-2 rounded-md bg-[#f7f7f2] px-4 py-4 text-sm leading-6 text-slate-600 dark:bg-white/[0.05] dark:text-zinc-300">
          <p>
            No customer reviews yet. Verified buyers can review delivered items
            from their order history.
          </p>
          <Link
            className="inline-flex w-fit items-center gap-1 text-xs font-black uppercase leading-none text-[#ff5a1f] transition hover:text-[#d43f0c] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#ff5a1f]/20"
            href="/account/orders"
          >
            Review from your orders
            <ChevronRightIcon className="size-3.5" />
          </Link>
        </div>
      )}
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

function getExchangeEmptyCountLabel(quantity: number, emptySize: string | null) {
  return `${quantity} × ${emptySize ? `${emptySize} ` : "compatible "}empty ${
    quantity === 1 ? "cylinder" : "cylinders"
  } required`;
}

function getAdjacentMediaId(
  media: MarketplaceProductMedia[],
  currentId: string | null,
  direction: -1 | 1,
) {
  if (media.length === 0) {
    return currentId;
  }

  const currentIndex = currentId
    ? media.findIndex((item) => item.id === currentId)
    : 0;
  const normalizedIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = (normalizedIndex + direction + media.length) % media.length;

  return media[nextIndex]?.id ?? currentId;
}

function getPreferredGalleryMediaId(
  media: MarketplaceProductMedia[],
  preferredImageUrl: string | null | undefined,
) {
  if (preferredImageUrl) {
    const preferredMedia = findGalleryMediaForImageUrl(media, preferredImageUrl);

    if (preferredMedia) {
      return preferredMedia.id;
    }
  }

  return media[0]?.id ?? null;
}

function findGalleryMediaForImageUrl(
  media: MarketplaceProductMedia[],
  imageUrl: string,
) {
  return media.find(
    (item) =>
      (item.kind === "image" && item.url === imageUrl) ||
      (item.kind === "video" && item.posterUrl === imageUrl),
  );
}

function getProductGalleryMedia(
  productMedia: MarketplaceProductMedia[],
  fallbackImageUrls: string[],
) {
  const galleryMedia: MarketplaceProductMedia[] = [];
  const representedUrls = new Set<string>();
  const mediaIds = new Set<string>();

  for (const media of productMedia) {
    if (mediaIds.has(media.id) || !media.url) {
      continue;
    }

    galleryMedia.push(media);
    mediaIds.add(media.id);
    representedUrls.add(media.url);

    if (media.posterUrl) {
      representedUrls.add(media.posterUrl);
    }
  }

  for (const imageUrl of fallbackImageUrls) {
    if (representedUrls.has(imageUrl)) {
      continue;
    }

    galleryMedia.push({
      altText: null,
      id: `fallback-image:${imageUrl}`,
      kind: "image",
      mimeType: "image/*",
      posterUrl: null,
      url: imageUrl,
    });
    representedUrls.add(imageUrl);
  }

  return galleryMedia;
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
