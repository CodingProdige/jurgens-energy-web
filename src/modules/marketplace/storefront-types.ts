export const storefrontSectionTypes = [
  "hero",
  "quick_actions",
  "cylinder_showcase",
  "banner_link",
  "product_collection",
  "category_collection",
  "brand_collection",
  "latest_blog_posts",
  "feature_grid",
] as const;

export type StorefrontSectionType = (typeof storefrontSectionTypes)[number];

export const storefrontSectionCodePrefixes: Record<
  StorefrontSectionType,
  string
> = {
  banner_link: "BANNER-LINK",
  brand_collection: "BRAND-COLLECTION",
  category_collection: "CATEGORY-COLLECTION",
  cylinder_showcase: "CYLINDER-EXCHANGE",
  feature_grid: "FEATURE-GRID",
  hero: "HERO",
  latest_blog_posts: "LATEST-BLOG-POSTS",
  product_collection: "PRODUCT-COLLECTION",
  quick_actions: "QUICK-ACTIONS",
};

export type StorefrontProductSource =
  | "accessories"
  | "all"
  | "brand"
  | "category"
  | "exchange"
  | "full_cylinders";

export const storefrontCollectionLayouts = [
  "grid",
  "carousel",
  "load_more",
] as const;

export type StorefrontCollectionLayout =
  (typeof storefrontCollectionLayouts)[number];

export const storefrontCategoryVisibilityOptions = [
  "with_products",
  "all",
] as const;

export type StorefrontCategoryVisibility =
  (typeof storefrontCategoryVisibilityOptions)[number];

export const storefrontCategoryScopeOptions = ["all", "top_level"] as const;

export type StorefrontCategoryScope =
  (typeof storefrontCategoryScopeOptions)[number];

export const storefrontCategoryImageSources = [
  "first_product",
  "custom",
] as const;

export type StorefrontCategoryImageSource =
  (typeof storefrontCategoryImageSources)[number];

export type StorefrontAction = {
  href: string;
  label: string;
};

export const storefrontActionVariants = ["primary", "secondary"] as const;

export type StorefrontActionVariant =
  (typeof storefrontActionVariants)[number];

export type StorefrontButtonAction = StorefrontAction & {
  variant: StorefrontActionVariant;
};

export type StorefrontHeroAction = StorefrontButtonAction;

export const storefrontHeroLayouts = [
  "split",
  "full_bleed",
  "carousel",
] as const;

export type StorefrontHeroLayout = (typeof storefrontHeroLayouts)[number];

export const storefrontHeroHeights = ["compact", "standard", "tall"] as const;

export type StorefrontHeroHeight = (typeof storefrontHeroHeights)[number];

export const storefrontHeroContentPositions = ["left", "center", "right"] as const;

export type StorefrontHeroContentPosition =
  (typeof storefrontHeroContentPositions)[number];

export const storefrontHeroOverlays = ["none", "dark_left", "dark_center"] as const;

export type StorefrontHeroOverlay = (typeof storefrontHeroOverlays)[number];

export const storefrontHeroImageFits = ["cover", "contain"] as const;

export type StorefrontHeroImageFit = (typeof storefrontHeroImageFits)[number];

export const storefrontTitleTags = ["h1", "h2", "h3", "h4"] as const;

export type StorefrontTitleTag = (typeof storefrontTitleTags)[number];

export type StorefrontIconKey =
  | "accessories"
  | "certified"
  | "cylinder"
  | "delivery"
  | "exchange"
  | "flame"
  | "support";

type StorefrontSectionBase<TType extends StorefrontSectionType, TSettings> = {
  componentCode: string;
  enabled: boolean;
  id: string;
  settings: TSettings;
  type: TType;
};

export type StorefrontHeroSection = StorefrontSectionBase<
  "hero",
  {
    autoplay: boolean;
    autoplayInterval: number;
    height: StorefrontHeroHeight;
    layout: StorefrontHeroLayout;
    showControls: boolean;
    slides: Array<{
      accentText: string;
      actions: StorefrontHeroAction[];
      contentPosition: StorefrontHeroContentPosition;
      copy: string;
      desktopImageUrl: string;
      heading: string;
      headingSize: number;
      headingTag: StorefrontTitleTag;
      href: string;
      imageAlt: string;
      imageFit: StorefrontHeroImageFit;
      mobileImageUrl: string;
      overlay: StorefrontHeroOverlay;
    }>;
  }
>;

export type StorefrontQuickActionsSection = StorefrontSectionBase<
  "quick_actions",
  {
    actions: Array<{
      description: string;
      href: string;
      icon: StorefrontIconKey;
      title: string;
    }>;
  }
>;

export type StorefrontCylinderShowcaseSection = StorefrontSectionBase<
  "cylinder_showcase",
  {
    actions: StorefrontButtonAction[];
    exchangeTitleSize: number;
    exchangeTitleTag: StorefrontTitleTag;
    exchangeTitle: string;
    steps: Array<{
      description: string;
      icon: StorefrontIconKey;
      title: string;
    }>;
  }
>;

export type StorefrontBannerLinkSection = StorefrontSectionBase<
  "banner_link",
  {
    actionLabel: string;
    copy: string;
    eyebrow: string;
    href: string;
    imageAlt: string;
    imageUrl: string;
    title: string;
    titleSize: number;
    titleTag: StorefrontTitleTag;
  }
>;

export type StorefrontProductCollectionSection = StorefrontSectionBase<
  "product_collection",
  {
    eyebrow: string;
    layout: StorefrontCollectionLayout;
    productLimit: number;
    productSource: StorefrontProductSource;
    categoryScope: StorefrontCategoryScope;
    largeScreenColumns: number;
    selectedBrandIds: string[];
    selectedCategoryIds: string[];
    smallScreenColumns: number;
    actions: StorefrontButtonAction[];
    title: string;
    titleSize: number;
    titleTag: StorefrontTitleTag;
  }
>;

export type StorefrontCategoryCollectionSection = StorefrontSectionBase<
  "category_collection",
  {
    actions: StorefrontButtonAction[];
    categoryImages: Array<{
      categoryId: string;
      imageAlt: string;
      imageUrl: string;
    }>;
    categoryLimit: number;
    categoryScope: StorefrontCategoryScope;
    categoryVisibility: StorefrontCategoryVisibility;
    eyebrow: string;
    imageSource: StorefrontCategoryImageSource;
    layout: StorefrontCollectionLayout;
    selectedCategoryIds: string[];
    title: string;
    titleSize: number;
    titleTag: StorefrontTitleTag;
  }
>;

export type StorefrontBrandCollectionSection = StorefrontSectionBase<
  "brand_collection",
  {
    actions: StorefrontButtonAction[];
    brandLimit: number;
    eyebrow: string;
    layout: StorefrontCollectionLayout;
    selectedBrandIds: string[];
    title: string;
    titleSize: number;
    titleTag: StorefrontTitleTag;
  }
>;

export type StorefrontLatestBlogPostsSection = StorefrontSectionBase<
  "latest_blog_posts",
  {
    actions: StorefrontButtonAction[];
    eyebrow: string;
    layout: StorefrontCollectionLayout;
    postLimit: number;
    title: string;
    titleSize: number;
    titleTag: StorefrontTitleTag;
  }
>;

export type StorefrontFeatureGridSection = StorefrontSectionBase<
  "feature_grid",
  {
    eyebrow: string;
    features: Array<{
      icon: StorefrontIconKey;
      text: string;
      title: string;
    }>;
    title: string;
    titleSize: number;
    titleTag: StorefrontTitleTag;
  }
>;

export type StorefrontSection =
  | StorefrontBannerLinkSection
  | StorefrontBrandCollectionSection
  | StorefrontCategoryCollectionSection
  | StorefrontCylinderShowcaseSection
  | StorefrontFeatureGridSection
  | StorefrontHeroSection
  | StorefrontLatestBlogPostsSection
  | StorefrontProductCollectionSection
  | StorefrontQuickActionsSection;

export const storefrontSectionLabels: Record<StorefrontSectionType, string> = {
  banner_link: "Banner link",
  brand_collection: "Brand collection",
  category_collection: "Category collection",
  cylinder_showcase: "Cylinder exchange",
  feature_grid: "Feature grid",
  hero: "Hero",
  latest_blog_posts: "Latest blog posts",
  product_collection: "Product collection",
  quick_actions: "Quick actions",
};

export const defaultStorefrontSections: StorefrontSection[] = [
  {
    componentCode: "HERO-01",
    enabled: true,
    id: "hero-main",
    settings: {
      autoplay: true,
      autoplayInterval: 5,
      height: "standard",
      layout: "split",
      showControls: true,
      slides: [
        {
          accentText: "home|energy|online",
          actions: [
            {
              href: "#products",
              label: "Shop Products",
              variant: "primary",
            },
            {
              href: "#categories",
              label: "Browse Categories",
              variant: "primary",
            },
            {
              href: "/support",
              label: "Get Support",
              variant: "secondary",
            },
          ],
          contentPosition: "left",
          copy:
            "Jurgens Energy is a South African online store for practical home, energy, appliance and lifestyle products, with clear product details, secure checkout and straightforward customer support.",
          desktopImageUrl: "/brand/hero_images/multi-cylinder-hero.png",
          heading: "Shop home, energy and lifestyle products online.",
          headingSize: 52,
          headingTag: "h1",
          href: "",
          imageAlt: "Jurgens Energy online store products ready for delivery",
          imageFit: "contain",
          mobileImageUrl: "",
          overlay: "dark_left",
        },
      ],
    },
    type: "hero",
  },
  {
    componentCode: "QUICK-ACTIONS-01",
    enabled: true,
    id: "quick-actions",
    settings: {
      actions: [
        {
          description: "Browse current products and order online.",
          href: "#products",
          icon: "cylinder",
          title: "Shop products",
        },
        {
          description: "Review delivery timing and fees before payment.",
          href: "/delivery-information",
          icon: "delivery",
          title: "Delivery at checkout",
        },
        {
          description: "Get help before or after placing an order.",
          href: "/support",
          icon: "support",
          title: "Customer support",
        },
      ],
    },
    type: "quick_actions",
  },
  {
    componentCode: "CYLINDER-EXCHANGE-01",
    enabled: true,
    id: "cylinder-showcase",
    settings: {
      actions: [
        {
          href: "#exchange",
          label: "Exchange My Empty",
          variant: "primary",
        },
      ],
      exchangeTitle: "How Cylinder Exchange Works",
      exchangeTitleSize: 20,
      exchangeTitleTag: "h2",
      steps: [
        {
          description: "Select the size of cylinder you need.",
          icon: "cylinder",
          title: "Choose Your Size",
        },
        {
          description: "A delivery representative collects your empty cylinder.",
          icon: "exchange",
          title: "Hand Over Empty",
        },
        {
          description: "Get a full cylinder delivered to you.",
          icon: "delivery",
          title: "Receive Full Delivery",
        },
      ],
    },
    type: "cylinder_showcase",
  },
  {
    componentCode: "BANNER-LINK-01",
    enabled: false,
    id: "banner-link",
    settings: {
      actionLabel: "Shop now",
      copy:
        "Feature a promotion, category, brand, or important customer update with a full-width link.",
      eyebrow: "Featured",
      href: "/products",
      imageAlt: "Jurgens Energy featured storefront banner",
      imageUrl: "",
      title: "Build a full-width banner link.",
      titleSize: 34,
      titleTag: "h2",
    },
    type: "banner_link",
  },
  {
    componentCode: "PRODUCT-COLLECTION-01",
    enabled: true,
    id: "accessories-collection",
    settings: {
      actions: [
        {
          href: "#accessories",
          label: "View All Accessories",
          variant: "secondary",
        },
      ],
      eyebrow: "Accessories",
      layout: "grid",
      productLimit: 4,
      productSource: "accessories",
      categoryScope: "all",
      largeScreenColumns: 5,
      selectedBrandIds: [],
      selectedCategoryIds: [],
      smallScreenColumns: 2,
      title: "Shop Accessories",
      titleSize: 24,
      titleTag: "h2",
    },
    type: "product_collection",
  },
  {
    componentCode: "CATEGORY-COLLECTION-01",
    enabled: true,
    id: "category-collection",
    settings: {
      actions: [],
      categoryImages: [],
      categoryLimit: 8,
      categoryScope: "top_level",
      categoryVisibility: "with_products",
      eyebrow: "Shop by category",
      imageSource: "first_product",
      layout: "grid",
      selectedCategoryIds: [],
      title: "Browse Categories",
      titleSize: 24,
      titleTag: "h2",
    },
    type: "category_collection",
  },
  {
    componentCode: "BRAND-COLLECTION-01",
    enabled: true,
    id: "brand-collection",
    settings: {
      actions: [],
      brandLimit: 8,
      eyebrow: "Shop by brand",
      layout: "grid",
      selectedBrandIds: [],
      title: "Browse Brands",
      titleSize: 24,
      titleTag: "h2",
    },
    type: "brand_collection",
  },
  {
    componentCode: "LATEST-BLOG-POSTS-01",
    enabled: true,
    id: "latest-blog-posts",
    settings: {
      actions: [
        {
          href: "/blog",
          label: "View All Posts",
          variant: "secondary",
        },
      ],
      eyebrow: "Blog",
      layout: "grid",
      postLimit: 3,
      title: "Latest Store Guides",
      titleSize: 24,
      titleTag: "h2",
    },
    type: "latest_blog_posts",
  },
  {
    componentCode: "FEATURE-GRID-01",
    enabled: true,
    id: "about-feature-grid",
    settings: {
      eyebrow: "South African online store",
      features: [
        {
          icon: "delivery",
          text: "Usually arrives within 1–4 business days after payment confirmation.",
          title: "South Africa delivery",
        },
        {
          icon: "certified",
          text: "Cylinder handover checks apply where required.",
          title: "Careful handling",
        },
        {
          icon: "flame",
          text: "Review the product details and connection requirements before use.",
          title: "Clear product details",
        },
        {
          icon: "support",
          text: "Questions before or after delivery are handled quickly.",
          title: "Helpful support",
        },
      ],
      title: "Online ordering with clear product, payment and delivery updates.",
      titleSize: 30,
      titleTag: "h2",
    },
    type: "feature_grid",
  },
];

export function cloneStorefrontSections(sections: StorefrontSection[]) {
  return structuredClone(sections);
}

export function createDefaultStorefrontSection(
  type: StorefrontSectionType,
  componentCode?: string,
): StorefrontSection {
  const defaultSection =
    defaultStorefrontSections.find((section) => section.type === type) ??
    defaultStorefrontSections[0];

  return {
    ...structuredClone(defaultSection),
    componentCode:
      componentCode ??
      `${storefrontSectionCodePrefixes[type]}-${Date.now().toString(36).toUpperCase()}`,
    enabled: true,
    id: `${type}-${Date.now().toString(36)}`,
  } as StorefrontSection;
}
