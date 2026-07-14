import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";

import { MarketplaceGate } from "@/components/marketplace/marketplace-gate";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import {
  ProductDetailExperience,
  type MarketplaceProductDetailView,
} from "@/components/marketplace/product-detail-experience";
import { getCurrencyContext } from "@/src/modules/currency/server";
import {
  getMarketplaceCatalog,
  getMarketplaceProductBySlug,
  type MarketplaceProductCard,
  type MarketplaceProductDetail,
} from "@/src/modules/marketplace/catalog";
import { getMarketplaceSettings } from "@/src/modules/marketplace/settings";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const currencyContext = await getCurrencyContext();
  const product = await getMarketplaceProductBySlug(slug, currencyContext);

  if (!product) {
    return {
      title: "Product",
      description: "Shop Jurgens Energy products.",
    };
  }

  return {
    title: product.title,
    description:
      product.shortDescription ??
      stripProductText(product.description) ??
      `Shop ${product.title} from Jurgens Energy.`,
    openGraph: {
      images: product.coverImageUrl ? [product.coverImageUrl] : undefined,
      title: product.title,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const currencyContext = await getCurrencyContext();
  const product = await getMarketplaceProductBySlug(slug, currencyContext);

  if (!product) {
    notFound();
  }

  const [catalog, settings] = await Promise.all([
    getMarketplaceCatalog({
      currencyContext,
      limit: 48,
    }),
    getMarketplaceSettings(),
  ]);
  const moreInCategoryProducts = catalog.products
    .filter((item) => item.id !== product.id)
    .filter((item) => isRelatedProduct(product, item))
    .slice(0, 12);
  const productView = toProductDetailView(product);

  return (
    <MarketplaceGate>
      <MarketplaceHeader />
      <main className="grid min-w-0 w-full max-w-full gap-0 overflow-x-clip py-0 sm:mx-auto sm:w-[min(1280px,calc(100%-2rem))] sm:gap-6 sm:py-6">
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto border-b border-[#ecece6] px-4 py-2.5 text-[10px] font-semibold leading-none text-slate-500 [scrollbar-width:none] dark:border-white/10 dark:text-zinc-400 sm:mx-0 sm:flex-wrap sm:gap-2 sm:overflow-visible sm:border-b-0 sm:px-0 sm:py-0 sm:text-xs [&::-webkit-scrollbar]:hidden"
        >
          <Link className="shrink-0 transition hover:text-[#ff5a1f]" href="/">
            Home
          </Link>
          <ChevronRightIcon className="size-3 shrink-0 sm:size-3.5" />
          <Link className="shrink-0 transition hover:text-[#ff5a1f]" href="/">
            Shop
          </Link>
          {product.category ? (
            <>
              <ChevronRightIcon className="size-3 shrink-0 sm:size-3.5" />
              <Link
                className="shrink-0 transition hover:text-[#ff5a1f]"
                href={`/categories/${product.category.slug}`}
              >
                {product.category.name}
              </Link>
            </>
          ) : null}
          <ChevronRightIcon className="size-3 shrink-0 sm:size-3.5" />
          <span className="max-w-[11rem] shrink-0 truncate font-bold text-[#080808] dark:text-[#f7f7f2] sm:max-w-[18rem]">
            {product.title}
          </span>
        </nav>

        <ProductDetailExperience
          catalogProducts={catalog.products}
          currencyContext={currencyContext}
          jurgensDeliveryCutoffTime={settings.jurgensDeliveryCutoffTime}
          product={productView}
          relatedProducts={moreInCategoryProducts}
        />
      </main>
      <MarketplaceFooter />
    </MarketplaceGate>
  );
}

function toProductDetailView(
  product: MarketplaceProductDetail,
): MarketplaceProductDetailView {
  return {
    barcode: product.barcode,
    brandId: product.brandId,
    brandName: product.brandName,
    brandSlug: product.brandSlug,
    category: product.category,
    coverImageUrl: product.coverImageUrl,
    compareAtPriceLabel: product.compareAtPriceLabel,
    description: product.description,
    discountLabel: product.discountLabel,
    fulfillmentMode: product.fulfillmentMode,
    fullDescription: product.fullDescription,
    hasExchangeOption: product.hasExchangeOption,
    id: product.id,
    imageUrls: product.imageUrls,
    inStock: product.inStock,
    isOnSale: product.isOnSale,
    optionSchema: product.optionSchema,
    priceLabel: product.priceLabel,
    quickAddVariantId: product.quickAddVariantId,
    shortDescription: product.shortDescription,
    slug: product.slug,
    title: product.title,
    variantCount: product.variantCount,
    variants: product.variants,
  };
}

function isRelatedProduct(
  product: MarketplaceProductDetail,
  item: MarketplaceProductCard,
) {
  if (!product.category || !item.category) {
    return false;
  }

  const productRoot = product.category.path.split(">").at(0)?.trim().toLowerCase();
  const itemPath = item.category.path.toLowerCase();

  return Boolean(productRoot && itemPath.includes(productRoot));
}

function stripProductText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const stripped = value
    .replace(/<\/(p|div|h[1-6])>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

  return stripped || null;
}
