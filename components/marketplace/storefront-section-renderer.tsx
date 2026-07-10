import Image from "next/image";
import Link from "next/link";
import {
  ArrowRightIcon,
  ChevronRightIcon,
  FlameIcon,
  HeadphonesIcon,
  RefreshCcwIcon,
  ShieldCheckIcon,
  TruckIcon,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import {
  marketplacePrimaryActionClass,
  marketplaceSecondaryActionClass,
} from "@/components/marketplace/action-styles";
import { MarketplaceBlogCard } from "@/components/marketplace/blog-card";
import { MarketplaceProductCard } from "@/components/marketplace/product-card";
import { cn } from "@/lib/utils";
import type { PublicBlogPostSummary } from "@/src/modules/blog";
import type {
  MarketplaceBrandSummary,
  MarketplaceCategorySummary,
  MarketplaceProductCard as MarketplaceProductCardData,
} from "@/src/modules/marketplace/catalog";
import { filterStorefrontProducts } from "@/src/modules/marketplace/product-filters";
import type {
  StorefrontBrandCollectionSection,
  StorefrontButtonAction,
  StorefrontCategoryCollectionSection,
  StorefrontCylinderShowcaseSection,
  StorefrontFeatureGridSection,
  StorefrontHeroSection,
  StorefrontIconKey,
  StorefrontLatestBlogPostsSection,
  StorefrontProductCollectionSection,
  StorefrontQuickActionsSection,
  StorefrontSection,
  StorefrontTitleTag,
} from "@/src/modules/marketplace/storefront-types";

type StorefrontPageRendererProps = {
  brands: MarketplaceBrandSummary[];
  blogPosts: PublicBlogPostSummary[];
  categories: MarketplaceCategorySummary[];
  className?: string;
  products: MarketplaceProductCardData[];
  sections: StorefrontSection[];
  selectedSectionId?: string | null;
};

export function StorefrontPageRenderer({
  brands,
  blogPosts,
  categories,
  className,
  products,
  sections,
  selectedSectionId,
}: StorefrontPageRendererProps) {
  return (
    <div className={cn("contents", className)}>
      {sections
        .filter((section) => section.enabled)
        .map((section) => (
          <div
            className={cn(
              "relative",
              selectedSectionId === section.id &&
                "z-10 ring-2 ring-[#ff5a1f] ring-offset-2 ring-offset-white dark:ring-offset-[#101010]",
            )}
            data-storefront-section={section.type}
            key={section.id}
          >
            {renderStorefrontSection({
              brands,
              blogPosts,
              categories,
              products,
              section,
            })}
          </div>
        ))}
    </div>
  );
}

function renderStorefrontSection({
  brands,
  blogPosts,
  categories,
  products,
  section,
}: {
  brands: MarketplaceBrandSummary[];
  blogPosts: PublicBlogPostSummary[];
  categories: MarketplaceCategorySummary[];
  products: MarketplaceProductCardData[];
  section: StorefrontSection;
}) {
  if (section.type === "hero") {
    return <StorefrontHeroSectionView section={section} />;
  }

  if (section.type === "quick_actions") {
    return <StorefrontQuickActionsSectionView section={section} />;
  }

  if (section.type === "cylinder_showcase") {
    return <StorefrontCylinderShowcaseSectionView section={section} />;
  }

  if (section.type === "product_collection") {
    return (
      <StorefrontProductCollectionSectionView
        products={products}
        section={section}
      />
    );
  }

  if (section.type === "category_collection") {
    return (
      <StorefrontCategoryCollectionSectionView
        categories={categories}
        section={section}
      />
    );
  }

  if (section.type === "brand_collection") {
    return (
      <StorefrontBrandCollectionSectionView
        brands={brands}
        section={section}
      />
    );
  }

  if (section.type === "latest_blog_posts") {
    return (
      <StorefrontLatestBlogPostsSectionView
        posts={blogPosts}
        section={section}
      />
    );
  }

  return <StorefrontFeatureGridSectionView section={section} />;
}

function StorefrontHeroSectionView({
  section,
}: {
  section: StorefrontHeroSection;
}) {
  const { settings } = section;

  return (
    <section className="relative overflow-hidden border-b border-[#ecece6] bg-[radial-gradient(circle_at_72%_28%,rgba(255,90,31,0.09),transparent_30%),linear-gradient(110deg,#ffffff_0%,#ffffff_54%,#f4f4ef_100%)] px-4 pb-6 pt-6 dark:border-white/10 dark:bg-[radial-gradient(circle_at_72%_28%,rgba(255,90,31,0.18),transparent_34%),linear-gradient(110deg,#101010_0%,#101010_54%,#1a1a1a_100%)] sm:px-10 sm:pb-7 sm:pt-8 lg:min-h-[520px] lg:px-16 lg:pb-9 lg:pt-12">
      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div className="relative z-10 max-w-[650px]">
          <StorefrontTitle
            as={settings.headingTag}
            className="max-w-[640px] font-black uppercase leading-[1.08] tracking-normal text-[#080808] dark:text-[#f7f7f2]"
            size={settings.headingSize}
          >
            {renderAccentHeading(settings.heading, settings.accentText)}
          </StorefrontTitle>
          <p className="mt-5 max-w-[360px] text-[17px] font-semibold leading-7 text-[#1a1a1a] dark:text-[#deded7]">
            {settings.copy}
          </p>
          {settings.actions.length > 0 ? (
            <StorefrontActionList
              actions={settings.actions}
              className="mt-7"
            />
          ) : null}
        </div>

        <HeroVisual alt={settings.imageAlt} src={settings.imageUrl} />
      </div>
    </section>
  );
}

function StorefrontQuickActionsSectionView({
  section,
}: {
  section: StorefrontQuickActionsSection;
}) {
  if (section.settings.actions.length === 0) {
    return null;
  }

  return (
    <section className="grid border-b border-[#ecece6] px-4 py-1 dark:border-white/10 sm:gap-3 sm:px-10 sm:py-4 lg:grid-cols-3 lg:px-16">
      {section.settings.actions.map((action) => (
        <ActionCard
          description={action.description}
          href={action.href}
          icon={action.icon}
          key={`${action.title}-${action.href}`}
          title={action.title}
        />
      ))}
    </section>
  );
}

function StorefrontCylinderShowcaseSectionView({
  section,
}: {
  section: StorefrontCylinderShowcaseSection;
}) {
  const { settings } = section;

  return (
    <section
      className="border-b border-[#ecece6] px-3 py-6 dark:border-white/10 sm:px-10 sm:py-9 lg:px-16"
      id="exchange"
    >
      <div className="mx-auto grid max-w-4xl min-w-0 content-start justify-items-center">
        <StorefrontTitle
          as={settings.exchangeTitleTag}
          className="w-full max-w-xl text-center font-black uppercase leading-tight [font-size:min(var(--storefront-title-mobile-size),18px)] sm:[font-size:var(--storefront-title-tablet-size)] lg:[font-size:var(--storefront-title-desktop-size)]"
          size={settings.exchangeTitleSize}
        >
          {settings.exchangeTitle}
        </StorefrontTitle>
        <div className="mt-5 grid w-full grid-cols-3 gap-1 sm:mt-7 sm:gap-5">
          {settings.steps.map((step, index) => (
            <ExchangeStep
              description={step.description}
              icon={step.icon}
              index={index}
              isLast={index === settings.steps.length - 1}
              key={`${step.title}-${index}`}
              title={step.title}
            />
          ))}
        </div>
        <StorefrontActionList
          actions={settings.actions}
          className="mt-5 justify-center sm:mt-7"
        />
      </div>
    </section>
  );
}

function StorefrontProductCollectionSectionView({
  products,
  section,
}: {
  products: MarketplaceProductCardData[];
  section: StorefrontProductCollectionSection;
}) {
  const { settings } = section;
  const selectedProducts = filterStorefrontProducts({
    products,
    selectedBrandIds: settings.selectedBrandIds,
    selectedCategoryIds: settings.selectedCategoryIds,
    source: settings.productSource,
  }).slice(0, settings.productLimit);
  const sectionId = getCollectionSectionId(section.id, settings.actions);

  return (
    <section
      className="grid gap-3 border-b border-[#ecece6] px-0 py-4 dark:border-white/10 sm:gap-4 sm:px-10 sm:py-7 lg:px-16"
      id={sectionId}
    >
      <StorefrontCollectionHeader
        actions={settings.actions}
        eyebrow={settings.eyebrow}
        title={settings.title}
        titleSize={settings.titleSize}
        titleTag={settings.titleTag}
      />
      <ProductCollectionList
        emptyLabel={`No live ${settings.title.toLowerCase()} products yet.`}
        layout={settings.layout}
        products={selectedProducts}
      />
    </section>
  );
}

function StorefrontCategoryCollectionSectionView({
  categories,
  section,
}: {
  categories: MarketplaceCategorySummary[];
  section: StorefrontCategoryCollectionSection;
}) {
  const { settings } = section;
  const selectedCategoryIdSet = new Set(settings.selectedCategoryIds);
  const selectedCategories = categories
    .filter(
      (category) =>
        selectedCategoryIdSet.size === 0 ||
        selectedCategoryIdSet.has(category.id),
    )
    .filter(
      (category) =>
        settings.categoryVisibility === "all" || category.productCount > 0,
    )
    .slice(0, settings.categoryLimit);
  const sectionId = getCollectionSectionId(section.id, settings.actions);

  return (
    <section
      className="grid gap-3 border-b border-[#ecece6] px-0 py-4 dark:border-white/10 sm:gap-4 sm:px-10 sm:py-7 lg:px-16"
      id={sectionId}
    >
      <StorefrontCollectionHeader
        actions={settings.actions}
        eyebrow={settings.eyebrow}
        title={settings.title}
        titleSize={settings.titleSize}
        titleTag={settings.titleTag}
      />
      <CategoryCollectionList
        categories={selectedCategories}
        emptyLabel="No categories match this section yet."
        imageOverrides={settings.categoryImages}
        imageSource={settings.imageSource}
        layout={settings.layout}
      />
    </section>
  );
}

function StorefrontBrandCollectionSectionView({
  brands,
  section,
}: {
  brands: MarketplaceBrandSummary[];
  section: StorefrontBrandCollectionSection;
}) {
  const { settings } = section;
  const selectedBrandIdSet = new Set(settings.selectedBrandIds);
  const selectedBrands = brands
    .filter((brand) => selectedBrandIdSet.size === 0 || selectedBrandIdSet.has(brand.id))
    .slice(0, settings.brandLimit);
  const sectionId = getCollectionSectionId(section.id, settings.actions);

  return (
    <section
      className="grid gap-3 border-b border-[#ecece6] px-0 py-4 dark:border-white/10 sm:gap-4 sm:px-10 sm:py-7 lg:px-16"
      id={sectionId}
    >
      <StorefrontCollectionHeader
        actions={settings.actions}
        eyebrow={settings.eyebrow}
        title={settings.title}
        titleSize={settings.titleSize}
        titleTag={settings.titleTag}
      />
      <BrandCollectionList
        brands={selectedBrands}
        emptyLabel="No brands match this section yet."
        layout={settings.layout}
      />
    </section>
  );
}

function StorefrontLatestBlogPostsSectionView({
  posts,
  section,
}: {
  posts: PublicBlogPostSummary[];
  section: StorefrontLatestBlogPostsSection;
}) {
  const { settings } = section;
  const selectedPosts = posts.slice(0, settings.postLimit);
  const sectionId = getCollectionSectionId(section.id, settings.actions);

  return (
    <section
      className="grid gap-3 border-b border-[#ecece6] px-0 py-4 dark:border-white/10 sm:gap-4 sm:px-10 sm:py-7 lg:px-16"
      id={sectionId}
    >
      <StorefrontCollectionHeader
        actions={settings.actions}
        eyebrow={settings.eyebrow}
        title={settings.title}
        titleSize={settings.titleSize}
        titleTag={settings.titleTag}
      />
      <BlogCollectionList
        emptyLabel="Published blog posts will appear here."
        layout={settings.layout}
        posts={selectedPosts}
      />
    </section>
  );
}

function StorefrontFeatureGridSectionView({
  section,
}: {
  section: StorefrontFeatureGridSection;
}) {
  const { settings } = section;

  return (
    <section
      className="grid gap-7 px-4 py-6 sm:px-10 sm:py-8 lg:grid-cols-[1fr_1fr] lg:px-16"
      id="about"
    >
      <div>
        {settings.eyebrow ? (
          <p className="text-[12px] font-black uppercase tracking-[0.24em] text-[#ff5a1f]">
            {settings.eyebrow}
          </p>
        ) : null}
        <StorefrontTitle
          as={settings.titleTag}
          className="mt-3 max-w-xl font-black uppercase leading-tight"
          size={settings.titleSize}
        >
          {settings.title}
        </StorefrontTitle>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {settings.features.map((feature) => (
          <InfoPoint
            icon={feature.icon}
            key={`${feature.title}-${feature.icon}`}
            text={feature.text}
            title={feature.title}
          />
        ))}
      </div>
    </section>
  );
}

function renderAccentHeading(heading: string, accentText: string) {
  const accentWords = new Set(
    accentText
      .split("|")
      .map((word) => word.trim().toLowerCase())
      .filter(Boolean),
  );

  if (accentWords.size === 0) {
    return heading;
  }

  return heading.split(/(\s+)/).map((part, index) => {
    const normalized = part.replace(/[^a-z0-9]/gi, "").toLowerCase();

    if (!accentWords.has(normalized)) {
      return part;
    }

    return (
      <span className="text-[#ff5a1f]" key={`${part}-${index}`}>
        {part}
      </span>
    );
  });
}

function StorefrontCollectionHeader({
  actions,
  eyebrow,
  title,
  titleSize,
  titleTag,
}: {
  actions: StorefrontButtonAction[];
  eyebrow: string;
  title: string;
  titleSize: number;
  titleTag: StorefrontTitleTag;
}) {
  return (
    <div className="grid gap-2 px-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-x-4 sm:px-0">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#ff5a1f] sm:text-[12px]">
            {eyebrow}
          </p>
        ) : null}
        <StorefrontTitle
          as={titleTag}
          className="mt-1 font-black uppercase leading-tight sm:mt-2"
          size={titleSize}
        >
          {title}
        </StorefrontTitle>
      </div>
      <StorefrontTextActionList
        actions={actions}
        className="sm:justify-end sm:pb-1"
      />
    </div>
  );
}

function getCollectionSectionId(
  fallbackId: string,
  actions: StorefrontButtonAction[],
) {
  const primaryAction = actions[0];

  return primaryAction?.href.startsWith("#") && primaryAction.href.length > 1
    ? primaryAction.href.slice(1)
    : fallbackId;
}

function ProductCollectionList({
  emptyLabel,
  layout,
  products,
}: {
  emptyLabel: string;
  layout: "carousel" | "grid";
  products: MarketplaceProductCardData[];
}) {
  const isCarousel = layout === "carousel";

  return (
    <div
      className={cn(
        "mt-2.5 px-1.5 sm:mt-5 sm:px-0",
        isCarousel
          ? "flex snap-x gap-1.5 overflow-x-auto pb-2 [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden"
          : "grid grid-cols-2 items-start gap-1.5 sm:gap-4 md:grid-cols-4",
      )}
    >
      {products.length > 0 ? (
        products.map((product) => (
          <div
            className={
              isCarousel
                ? "w-[46%] min-w-[8.5rem] max-w-[13rem] snap-start sm:w-56 sm:min-w-56 sm:max-w-56"
                : undefined
            }
            key={product.id}
          >
            <MarketplaceProductCard product={product} />
          </div>
        ))
      ) : (
        <EmptyCollectionState label={emptyLabel} layout={layout} />
      )}
    </div>
  );
}

function CategoryCollectionList({
  categories,
  emptyLabel,
  imageOverrides,
  imageSource,
  layout,
}: {
  categories: MarketplaceCategorySummary[];
  emptyLabel: string;
  imageOverrides: StorefrontCategoryCollectionSection["settings"]["categoryImages"];
  imageSource: StorefrontCategoryCollectionSection["settings"]["imageSource"];
  layout: "carousel" | "grid";
}) {
  const imageOverrideByCategoryId = new Map(
    imageOverrides.map((image) => [image.categoryId, image]),
  );
  const isCarousel = layout === "carousel";

  return (
    <div
      className={cn(
        "mt-2.5 px-1.5 sm:mt-5 sm:px-0",
        isCarousel
          ? "flex snap-x gap-1.5 overflow-x-auto pb-2 [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden"
          : "grid grid-cols-2 items-start gap-1.5 sm:gap-4 md:grid-cols-4",
      )}
    >
      {categories.length > 0 ? (
        categories.map((category) => {
          const override = imageOverrideByCategoryId.get(category.id);
          const imageUrl =
            imageSource === "custom"
              ? (override?.imageUrl ?? category.firstProductImageUrl)
              : category.firstProductImageUrl;
          const imageAlt =
            imageSource === "custom"
              ? (override?.imageAlt ?? `${category.name} category`)
              : `${category.name} category`;

          return (
            <CategoryCard
              category={category}
              className={
                isCarousel
                  ? "w-[46%] min-w-[8.5rem] max-w-[13rem] snap-start sm:w-56 sm:min-w-56 sm:max-w-56"
                  : undefined
              }
              imageAlt={imageAlt}
              imageUrl={imageUrl}
              key={category.id}
            />
          );
        })
      ) : (
        <EmptyCollectionState label={emptyLabel} layout={layout} />
      )}
    </div>
  );
}

function BrandCollectionList({
  brands,
  emptyLabel,
  layout,
}: {
  brands: MarketplaceBrandSummary[];
  emptyLabel: string;
  layout: "carousel" | "grid";
}) {
  const isCarousel = layout === "carousel";

  return (
    <div
      className={cn(
        "mt-2.5 px-1.5 sm:mt-5 sm:px-0",
        isCarousel
          ? "flex snap-x gap-1.5 overflow-x-auto pb-2 [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden"
          : "grid grid-cols-2 items-start gap-1.5 sm:gap-4 md:grid-cols-4",
      )}
    >
      {brands.length > 0 ? (
        brands.map((brand) => (
          <BrandCard
            brand={brand}
            className={
              isCarousel
                ? "w-[46%] min-w-[8.5rem] max-w-[13rem] snap-start sm:w-56 sm:min-w-56 sm:max-w-56"
                : undefined
            }
            key={brand.id}
          />
        ))
      ) : (
        <EmptyCollectionState label={emptyLabel} layout={layout} />
      )}
    </div>
  );
}

function BlogCollectionList({
  emptyLabel,
  layout,
  posts,
}: {
  emptyLabel: string;
  layout: "carousel" | "grid";
  posts: PublicBlogPostSummary[];
}) {
  const isCarousel = layout === "carousel";

  return (
    <div
      className={cn(
        "mt-2.5 px-1.5 sm:mt-5 sm:px-0",
        isCarousel
          ? "flex snap-x gap-1.5 overflow-x-auto pb-2 [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden"
          : "grid grid-cols-1 items-start gap-2 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3",
      )}
    >
      {posts.length > 0 ? (
        posts.map((post) => (
          <MarketplaceBlogCard
            className={
              isCarousel
                ? "w-[84%] min-w-[17rem] max-w-[22rem] snap-start sm:w-80 sm:min-w-80 sm:max-w-80"
                : undefined
            }
            key={post.id}
            post={post}
          />
        ))
      ) : (
        <EmptyCollectionState label={emptyLabel} layout={layout} />
      )}
    </div>
  );
}

function CategoryCard({
  category,
  className,
  imageAlt,
  imageUrl,
}: {
  category: MarketplaceCategorySummary;
  className?: string;
  imageAlt: string;
  imageUrl: string | null;
}) {
  return (
    <StorefrontLink
      className={cn(
        "group/card block overflow-hidden rounded-md border border-[#e8e8e2] bg-white text-left shadow-[0_4px_14px_rgba(8,8,8,0.04)] transition hover:-translate-y-0.5 hover:border-[#ff5a1f]/55 hover:shadow-[0_12px_28px_rgba(8,8,8,0.08)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none",
        className,
      )}
      href={`/categories/${category.slug}`}
    >
      <div className="relative aspect-square bg-[#f7f7f2] dark:bg-[#1a1a1a]">
        <StorefrontCollectionImage
          alt={imageAlt}
          fallback={<FlameIcon className="size-10 stroke-[1.4]" />}
          sizes="(min-width: 768px) 220px, 50vw"
          src={imageUrl}
        />
      </div>
      <div className="grid gap-1 px-2 pb-2 pt-2 sm:px-3 sm:pb-3">
        <h3 className="line-clamp-2 text-[13px] font-black leading-tight text-[#080808] dark:text-[#f7f7f2] sm:text-[15px]">
          {category.name}
        </h3>
        <p className="line-clamp-1 text-[10px] font-bold uppercase text-[#7a7a73] dark:text-[#b8b8ae] sm:text-[11px]">
          {category.productCount} products
        </p>
      </div>
    </StorefrontLink>
  );
}

function BrandCard({
  brand,
  className,
}: {
  brand: MarketplaceBrandSummary;
  className?: string;
}) {
  const imageUrl = brand.logoUrl ?? brand.firstProductImageUrl;

  return (
    <StorefrontLink
      className={cn(
        "group/card block overflow-hidden rounded-md border border-[#e8e8e2] bg-white text-left shadow-[0_4px_14px_rgba(8,8,8,0.04)] transition hover:-translate-y-0.5 hover:border-[#ff5a1f]/55 hover:shadow-[0_12px_28px_rgba(8,8,8,0.08)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none",
        className,
      )}
      href={`/?brand=${brand.slug}#products`}
    >
      <div className="relative aspect-square bg-[#f7f7f2] dark:bg-[#1a1a1a]">
        <StorefrontCollectionImage
          alt={`${brand.name} brand`}
          fallback={<ShieldCheckIcon className="size-10 stroke-[1.4]" />}
          sizes="(min-width: 768px) 220px, 50vw"
          src={imageUrl}
        />
      </div>
      <div className="grid gap-1 px-2 pb-2 pt-2 sm:px-3 sm:pb-3">
        <h3 className="line-clamp-2 text-[13px] font-black leading-tight text-[#080808] dark:text-[#f7f7f2] sm:text-[15px]">
          {brand.name}
        </h3>
        <p className="line-clamp-1 text-[10px] font-bold uppercase text-[#7a7a73] dark:text-[#b8b8ae] sm:text-[11px]">
          {brand.productCount} products
        </p>
      </div>
    </StorefrontLink>
  );
}

function StorefrontCollectionImage({
  alt,
  fallback,
  sizes,
  src,
}: {
  alt: string;
  fallback: ReactNode;
  sizes: string;
  src: string | null;
}) {
  const imageClass =
    "size-full object-contain p-3 transition duration-300 group-hover/card:scale-[1.04] sm:p-4";
  const isRemoteImage =
    src?.startsWith("http://") || src?.startsWith("https://");

  if (!src) {
    return (
      <div className="grid size-full place-items-center text-[#ff5a1f]">
        {fallback}
      </div>
    );
  }

  if (isRemoteImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img alt={alt} className={imageClass} src={src} />
    );
  }

  return (
    <Image alt={alt} className={imageClass} fill sizes={sizes} src={src} />
  );
}

function StorefrontTitle({
  as,
  children,
  className,
  size,
}: {
  as: StorefrontTitleTag;
  children: ReactNode;
  className?: string;
  size: number;
}) {
  const Component = as;
  const sizes = getResponsiveTitleSizes(size);
  const style = {
    "--storefront-title-desktop-size": `${sizes.desktop}px`,
    "--storefront-title-mobile-size": `${sizes.mobile}px`,
    "--storefront-title-tablet-size": `${sizes.tablet}px`,
  } as CSSProperties;

  return (
    <Component
      className={cn(
        "[font-size:var(--storefront-title-mobile-size)] sm:[font-size:var(--storefront-title-tablet-size)] lg:[font-size:var(--storefront-title-desktop-size)]",
        className,
      )}
      style={style}
    >
      {children}
    </Component>
  );
}

function getResponsiveTitleSizes(size: number) {
  const mobileRatio = size >= 44 ? 0.68 : size >= 30 ? 0.78 : 0.9;
  const tabletRatio = size >= 44 ? 0.86 : size >= 30 ? 0.9 : 0.96;

  return {
    desktop: size,
    mobile: Math.max(18, Math.round(size * mobileRatio)),
    tablet: Math.max(20, Math.round(size * tabletRatio)),
  };
}

function StorefrontActionList({
  actions,
  className,
}: {
  actions: StorefrontButtonAction[];
  className?: string;
}) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-3 sm:gap-4", className)}>
      {actions.map((action, index) => (
        <StorefrontActionButton
          action={action}
          key={`${action.label}-${action.href}-${index}`}
        />
      ))}
    </div>
  );
}

function StorefrontTextActionList({
  actions,
  className,
}: {
  actions: StorefrontButtonAction[];
  className?: string;
}) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2",
        className,
      )}
    >
      {actions.map((action, index) => (
        <StorefrontTextActionLink
          action={action}
          key={`${action.label}-${action.href}-${index}`}
        />
      ))}
    </div>
  );
}

function StorefrontTextActionLink({
  action,
}: {
  action: StorefrontButtonAction;
}) {
  return (
    <StorefrontLink
      className="inline-flex min-w-0 items-center gap-1.5 text-[12px] font-normal uppercase leading-none text-[#080808] transition hover:text-[#ff5a1f] dark:text-[#f7f7f2] dark:hover:text-[#ff7a4b] sm:text-[13px]"
      href={action.href}
    >
      <span className="truncate">{action.label}</span>
      <ArrowRightIcon className="size-3.5 shrink-0" />
    </StorefrontLink>
  );
}

function StorefrontActionButton({ action }: { action: StorefrontButtonAction }) {
  return (
    <StorefrontLink
      className={
        action.variant === "secondary"
          ? marketplaceSecondaryActionClass
          : marketplacePrimaryActionClass
      }
      href={action.href}
    >
      {action.label}
    </StorefrontLink>
  );
}

function isExternalStorefrontHref(href: string) {
  return (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  );
}

function StorefrontLink({
  children,
  className,
  href,
}: {
  children: ReactNode;
  className?: string;
  href: string;
}) {
  if (isExternalStorefrontHref(href)) {
    return (
      <a
        className={className}
        href={href}
        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
        target={href.startsWith("http") ? "_blank" : undefined}
      >
        {children}
      </a>
    );
  }

  return (
    <Link className={className} href={href}>
      {children}
    </Link>
  );
}

function HeroVisual({ alt, src }: { alt: string; src: string }) {
  const imageClass =
    "size-full object-contain object-center drop-shadow-[0_26px_42px_rgba(8,8,8,0.18)] dark:drop-shadow-[0_28px_46px_rgba(0,0,0,0.42)]";
  const isRemoteImage = src.startsWith("http://") || src.startsWith("https://");

  return (
    <div className="relative z-0 aspect-[1672/941] w-full overflow-visible">
      {isRemoteImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={alt} className={imageClass} src={src} />
      ) : (
        <Image
          alt={alt}
          className={imageClass}
          fill
          priority
          sizes="(min-width: 1024px) 52vw, 100vw"
          src={src}
        />
      )}
    </div>
  );
}

function ActionCard({
  description,
  href,
  icon,
  title,
}: {
  description: string;
  href: string;
  icon: StorefrontIconKey;
  title: string;
}) {
  return (
    <StorefrontLink
      className="grid min-h-[72px] grid-cols-[3.25rem_minmax(0,1fr)_1.25rem] items-center gap-3 border-b border-[#ecece6] bg-white py-3 transition last:border-b-0 hover:text-[#ff5a1f] dark:border-white/10 dark:bg-transparent sm:min-h-[104px] sm:grid-cols-[4.5rem_minmax(0,1fr)_1.5rem] sm:gap-4 sm:rounded-lg sm:border sm:border-[#e8e8e2] sm:bg-white sm:px-5 sm:py-4 sm:shadow-[0_8px_24px_rgba(8,8,8,0.03)] sm:hover:border-[#ff5a1f] sm:dark:border-white/10 sm:dark:bg-white/[0.04] sm:dark:shadow-none"
      href={href}
    >
      <StorefrontIcon icon={icon} variant="action" />
      <div className="min-w-0">
        <h2 className="text-[17px] font-black uppercase">{title}</h2>
        <p className="mt-1 max-w-[240px] text-[14px] leading-5 text-[#4f4f49] dark:text-[#c8c8c0]">
          {description}
        </p>
      </div>
      <ChevronRightIcon className="size-5 text-[#080808] dark:text-[#f7f7f2] sm:size-6" />
    </StorefrontLink>
  );
}

function ExchangeStep({
  description,
  icon,
  index,
  isLast,
  title,
}: {
  description: string;
  icon: StorefrontIconKey;
  index: number;
  isLast: boolean;
  title: string;
}) {
  return (
    <article className="relative grid min-w-0 justify-items-center text-center">
      {!isLast ? (
        <span className="absolute left-[calc(50%+1.6875rem)] top-[1.6875rem] h-px w-[calc(100%-3.375rem)] bg-[#ff5a1f] sm:left-[calc(50%+2.75rem)] sm:top-9 sm:w-[calc(100%-5.5rem)]" />
      ) : null}
      <span className="relative z-10 grid size-[54px] place-items-center rounded-full border border-[#ff5a1f]/40 bg-white text-[#ff5a1f] dark:bg-[#171717] sm:size-[78px]">
        <StorefrontIcon icon={icon} variant="step" />
      </span>
      <span className="mt-1.5 grid size-4 place-items-center rounded-full bg-[#ff5a1f] text-[8px] font-black text-white sm:mt-2 sm:size-5 sm:text-[10px]">
        {index + 1}
      </span>
      <h3 className="mt-1.5 whitespace-nowrap text-[9px] font-black leading-3 sm:mt-2 sm:text-[13px] sm:leading-4">
        {title}
      </h3>
      <p className="mt-1 max-w-[96px] text-[9px] leading-3 text-[#4f4f49] dark:text-[#c8c8c0] sm:max-w-[130px] sm:text-[11px] sm:leading-4">
        {description}
      </p>
    </article>
  );
}

function MiniCylinder({ className = "" }: { className?: string }) {
  return (
    <span className={`relative block h-14 w-9 ${className}`}>
      <span className="absolute left-1/2 top-0 h-4 w-7 -translate-x-1/2 rounded-t-lg border-[3px] border-[#ff5a1f] border-b-0" />
      <span className="absolute inset-x-0 bottom-0 top-3 rounded-[0.8rem_0.8rem_0.45rem_0.45rem] bg-[linear-gradient(90deg,#da3e12,#ff5a1f,#e64916)] shadow-[inset_6px_0_8px_rgba(255,255,255,0.22),inset_-6px_0_8px_rgba(8,8,8,0.14)]">
        <span className="absolute left-1/2 top-5 size-4 -translate-x-1/2 rounded-full bg-[#1a1a1a]" />
      </span>
    </span>
  );
}

function StorefrontIcon({
  icon,
  variant,
}: {
  icon: StorefrontIconKey;
  variant: "action" | "feature" | "step";
}) {
  const iconClass =
    variant === "feature"
      ? "size-8 stroke-[1.6]"
      : variant === "step"
        ? "size-6 stroke-[1.6] sm:size-8"
        : "size-12";

  if (icon === "cylinder") {
    return (
      <MiniCylinder
        className={variant === "step" ? "scale-[0.72] sm:scale-100" : ""}
      />
    );
  }

  if (icon === "exchange") {
    return <RefreshCcwIcon className={cn(iconClass, "text-[#ff5a1f]")} />;
  }

  if (icon === "accessories") {
    return (
      <div className="flex items-center gap-1 text-[#ff5a1f]">
        <HeadphonesIcon className="size-8" />
        <FlameIcon className="size-8" />
      </div>
    );
  }

  if (icon === "certified") {
    return <ShieldCheckIcon className={cn(iconClass, "text-[#ff5a1f]")} />;
  }

  if (icon === "support") {
    return <HeadphonesIcon className={cn(iconClass, "text-[#ff5a1f]")} />;
  }

  if (icon === "flame") {
    return <FlameIcon className={cn(iconClass, "text-[#ff5a1f]")} />;
  }

  return <TruckIcon className={cn(iconClass, "text-[#ff5a1f]")} />;
}

function EmptyCollectionState({
  label,
  layout,
}: {
  label: string;
  layout: "carousel" | "grid";
}) {
  return (
    <div
      className={cn(
        "grid min-h-[218px] place-items-center rounded-lg border border-dashed border-[#e8e8e2] bg-white p-5 text-center text-sm font-semibold text-[#4f4f49] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#c8c8c0]",
        layout === "carousel" ? "min-w-full" : "col-span-full",
      )}
    >
      {label}
    </div>
  );
}

function InfoPoint({
  icon,
  text,
  title,
}: {
  icon: StorefrontIconKey;
  text: string;
  title: string;
}) {
  return (
    <article className="grid grid-cols-[3rem_minmax(0,1fr)] gap-4">
      <span className="grid size-11 place-items-center text-[#ff5a1f]">
        <StorefrontIcon icon={icon} variant="feature" />
      </span>
      <div>
        <h3 className="text-[13px] font-black uppercase">{title}</h3>
        <p className="mt-1 text-[13px] leading-5 text-[#4f4f49] dark:text-[#c8c8c0]">
          {text}
        </p>
      </div>
    </article>
  );
}
