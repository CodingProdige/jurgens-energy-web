export const storefrontSectionTypes = [
  "hero",
  "quick_actions",
  "cylinder_showcase",
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

export const storefrontCollectionLayouts = ["grid", "carousel"] as const;

export type StorefrontCollectionLayout =
  (typeof storefrontCollectionLayouts)[number];

export const storefrontCategoryVisibilityOptions = [
  "with_products",
  "all",
] as const;

export type StorefrontCategoryVisibility =
  (typeof storefrontCategoryVisibilityOptions)[number];

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
    accentText: string;
    actions: StorefrontHeroAction[];
    copy: string;
    heading: string;
    headingSize: number;
    headingTag: StorefrontTitleTag;
    imageAlt: string;
    imageUrl: string;
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

export type StorefrontProductCollectionSection = StorefrontSectionBase<
  "product_collection",
  {
    eyebrow: string;
    layout: StorefrontCollectionLayout;
    productLimit: number;
    productSource: StorefrontProductSource;
    selectedBrandIds: string[];
    selectedCategoryIds: string[];
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
  | StorefrontBrandCollectionSection
  | StorefrontCategoryCollectionSection
  | StorefrontCylinderShowcaseSection
  | StorefrontFeatureGridSection
  | StorefrontHeroSection
  | StorefrontLatestBlogPostsSection
  | StorefrontProductCollectionSection
  | StorefrontQuickActionsSection;

export const storefrontSectionLabels: Record<StorefrontSectionType, string> = {
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
      accentText: "full|exchange|accessories",
      actions: [
        {
          href: "#products",
          label: "Buy Full Cylinders",
          variant: "primary",
        },
        {
          href: "#exchange",
          label: "Exchange My Empty",
          variant: "primary",
        },
        {
          href: "#accessories",
          label: "Shop Accessories",
          variant: "secondary",
        },
      ],
      copy: "Safe, certified and delivered to your home or business.",
      heading:
        "Buy full LPG cylinders, exchange empty cylinders, and shop gas accessories.",
      headingSize: 52,
      headingTag: "h1",
      imageAlt: "Jurgens Energy LPG cylinders ready for delivery",
      imageUrl: "/brand/hero_images/multi-cylinder-hero.png",
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
          description: "Choose your size and get it delivered full to your door.",
          href: "#products",
          icon: "cylinder",
          title: "Buy Full Cylinders",
        },
        {
          description: "Swap your empty cylinder for a full one.",
          href: "#exchange",
          icon: "exchange",
          title: "Exchange Empty Cylinders",
        },
        {
          description: "Regulators, hoses, fittings and more.",
          href: "#accessories",
          icon: "accessories",
          title: "Shop Accessories",
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
          description: "Our driver collects your empty cylinder.",
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
      selectedBrandIds: [],
      selectedCategoryIds: [],
      title: "Shop Gas Accessories",
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
      title: "Latest LPG Guides",
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
      eyebrow: "Modern energy, delivered",
      features: [
        {
          icon: "delivery",
          text: "Fast local delivery for homes and businesses.",
          title: "Same day delivery",
        },
        {
          icon: "certified",
          text: "Every cylinder is checked and handled with care.",
          title: "Certified cylinders",
        },
        {
          icon: "flame",
          text: "Full cylinders arrive ready for safe connection.",
          title: "Ready to cook",
        },
        {
          icon: "support",
          text: "Questions before or after delivery are handled quickly.",
          title: "Helpful support",
        },
      ],
      title: "LPG delivered with the speed, safety and service your day needs.",
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
    id: `${type}-${Date.now().toString(36)}`,
  } as StorefrontSection;
}
