import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import { storefrontPages } from "@/src/db/schema";
import { replaceLegacyDefaultStorefrontClaims } from "@/src/modules/marketplace/storefront-legacy-defaults";
import {
  cloneStorefrontSections,
  defaultStorefrontSections,
  storefrontActionVariants,
  storefrontCategoryImageSources,
  storefrontCategoryScopeOptions,
  storefrontCategoryVisibilityOptions,
  storefrontCollectionLayouts,
  storefrontHeroContentPositions,
  storefrontHeroHeights,
  storefrontHeroImageFits,
  storefrontHeroLayouts,
  storefrontHeroOverlays,
  storefrontSectionCodePrefixes,
  storefrontSectionLabels,
  storefrontSectionTypes,
  storefrontTitleTags,
  type StorefrontSection,
  type StorefrontSectionType,
} from "@/src/modules/marketplace/storefront-types";

export const storefrontHomePageSlug = "home";
const maxStorefrontCollectionItems = 24;
const maxStorefrontBlogPosts = 12;

export type StorefrontAdminPage = {
  draftSections: StorefrontSection[];
  publishedAt: Date | null;
  publishedSections: StorefrontSection[];
  slug: string;
  title: string;
  updatedAt: Date | null;
};

export type StorefrontPublishedPage = {
  sections: StorefrontSection[];
  slug: string;
  title: string;
};

const boundedText = (max: number) => z.string().trim().max(max);

function isAllowedStorefrontHref(value: string) {
  if (
    value.startsWith("#") ||
    value.startsWith("?") ||
    (value.startsWith("/") && !value.startsWith("//")) ||
    value.startsWith("mailto:") ||
    value.startsWith("tel:")
  ) {
    return true;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isAllowedStorefrontMediaUrl(value: string) {
  if (value.startsWith("/") && !value.startsWith("//")) {
    return true;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const storefrontHrefSchema = boundedText(500)
  .min(1, "Section links need a destination.")
  .refine(
    isAllowedStorefrontHref,
    "Use an anchor, relative path, query string, or full http/https link.",
  );
const storefrontMediaUrlSchema = boundedText(500)
  .min(1, "Image URL is required.")
  .refine(
    isAllowedStorefrontMediaUrl,
    "Use a relative image path or full http/https image URL.",
  );
const optionalStorefrontMediaUrlSchema = boundedText(500).refine(
  (value) => !value || isAllowedStorefrontMediaUrl(value),
  "Use a relative image path or full http/https image URL.",
);
const optionalStorefrontHrefSchema = boundedText(500).refine(
  (value) => !value || isAllowedStorefrontHref(value),
  "Use an anchor, relative path, query string, or full http/https link.",
);

const actionSchema = z.object({
  href: storefrontHrefSchema,
  label: boundedText(80).min(1, "Section links need a label."),
});

const buttonActionSchema = actionSchema.extend({
  variant: z.enum(storefrontActionVariants).default("primary"),
});

const titleTagSchema = z.enum(storefrontTitleTags);
const titleSizeSchema = z.coerce.number().int().min(16).max(86);
const heroLayoutSchema = z.enum(storefrontHeroLayouts);
const heroHeightSchema = z.enum(storefrontHeroHeights);
const heroContentPositionSchema = z.enum(storefrontHeroContentPositions);
const heroOverlaySchema = z.enum(storefrontHeroOverlays);
const heroImageFitSchema = z.enum(storefrontHeroImageFits);

const iconKeySchema = z.enum([
  "accessories",
  "certified",
  "cylinder",
  "delivery",
  "exchange",
  "flame",
  "support",
]);

const productSourceSchema = z.enum([
  "accessories",
  "all",
  "brand",
  "category",
  "exchange",
  "full_cylinders",
]);
const collectionLayoutSchema = z.enum(storefrontCollectionLayouts);
const categoryScopeSchema = z.enum(storefrontCategoryScopeOptions);
const categoryVisibilitySchema = z.enum(storefrontCategoryVisibilityOptions);
const categoryImageSourceSchema = z.enum(storefrontCategoryImageSources);

const sectionBaseSchema = z.object({
  componentCode: boundedText(48).optional(),
  enabled: z.coerce.boolean(),
  id: boundedText(80).min(1, "Every section needs an id."),
});

const heroSlideSchema = z.object({
  accentText: boundedText(160).default(""),
  actions: z.array(buttonActionSchema).max(6).default([]),
  contentPosition: heroContentPositionSchema.default("left"),
  copy: boundedText(300).default(""),
  desktopImageUrl: storefrontMediaUrlSchema,
  heading: boundedText(220).default(""),
  headingSize: titleSizeSchema.default(52),
  headingTag: titleTagSchema.default("h1"),
  href: optionalStorefrontHrefSchema.default(""),
  imageAlt: boundedText(160).default(""),
  imageFit: heroImageFitSchema.default("cover"),
  mobileImageUrl: optionalStorefrontMediaUrlSchema.default(""),
  overlay: heroOverlaySchema.default("dark_left"),
});

const heroSettingsSchema = z.object({
  autoplay: z.coerce.boolean().default(true),
  autoplayInterval: z.coerce.number().int().min(3).max(12).default(5),
  height: heroHeightSchema.default("standard"),
  layout: heroLayoutSchema.default("split"),
  showControls: z.coerce.boolean().default(true),
  slides: z.array(heroSlideSchema).min(1).max(6),
});

const legacyHeroSettingsSchema = z
  .object({
    accentText: boundedText(160),
    actions: z.array(buttonActionSchema).max(6).optional(),
    copy: boundedText(300),
    heading: boundedText(220).min(1, "Hero heading is required."),
    headingSize: titleSizeSchema.default(52),
    headingTag: titleTagSchema.default("h1"),
    imageAlt: boundedText(160),
    imageUrl: storefrontMediaUrlSchema,
    primaryAction: actionSchema.optional(),
    secondaryAction: actionSchema.optional(),
    tertiaryAction: actionSchema.optional(),
  })
  .transform(
    ({
      actions,
      primaryAction,
      secondaryAction,
      tertiaryAction,
      imageUrl,
      ...settings
    }) => {
      const legacyActions = [
        primaryAction ? { ...primaryAction, variant: "primary" as const } : null,
        secondaryAction
          ? { ...secondaryAction, variant: "primary" as const }
          : null,
        tertiaryAction
          ? { ...tertiaryAction, variant: "secondary" as const }
          : null,
      ].filter((action) => action !== null);

      return {
        autoplay: true,
        autoplayInterval: 5,
        height: "standard" as const,
        layout: "split" as const,
        showControls: true,
        slides: [
          {
            ...settings,
            actions: actions ?? legacyActions,
            contentPosition: "left" as const,
            desktopImageUrl: imageUrl,
            href: "",
            imageFit: "contain" as const,
            mobileImageUrl: "",
            overlay: "dark_left" as const,
          },
        ],
      };
    },
  );

const heroSectionSchema = sectionBaseSchema.extend({
  settings: z.union([heroSettingsSchema, legacyHeroSettingsSchema]),
  type: z.literal("hero"),
});

const quickActionsSectionSchema = sectionBaseSchema.extend({
  settings: z.object({
    actions: z
      .array(
        z.object({
          description: boundedText(180),
          href: storefrontHrefSchema,
          icon: iconKeySchema,
          title: boundedText(80).min(1, "Quick action title is required."),
        }),
      )
      .min(0)
      .max(6),
  }),
  type: z.literal("quick_actions"),
});

const cylinderShowcaseSectionSchema = sectionBaseSchema.extend({
  settings: z
    .object({
      actions: z.array(buttonActionSchema).max(6).optional(),
      exchangeAction: actionSchema.optional(),
      exchangeTitle: boundedText(120).min(1),
      exchangeTitleSize: titleSizeSchema.default(20),
      exchangeTitleTag: titleTagSchema.default("h2"),
      steps: z
        .array(
          z.object({
            description: boundedText(180),
            icon: iconKeySchema,
            title: boundedText(80).min(1),
          }),
        )
        .min(1)
        .max(5),
    })
    .transform(({ actions, exchangeAction, ...settings }) => ({
      ...settings,
      actions:
        actions ??
        (exchangeAction
          ? [{ ...exchangeAction, variant: "primary" as const }]
          : []),
    })),
  type: z.literal("cylinder_showcase"),
});

const bannerLinkSectionSchema = sectionBaseSchema.extend({
  settings: z.object({
    actionLabel: boundedText(80).min(1, "Banner action label is required."),
    copy: boundedText(320),
    eyebrow: boundedText(90),
    href: storefrontHrefSchema,
    imageAlt: boundedText(160),
    imageUrl: optionalStorefrontMediaUrlSchema.default(""),
    title: boundedText(160).min(1, "Banner title is required."),
    titleSize: titleSizeSchema.default(34),
    titleTag: titleTagSchema.default("h2"),
  }),
  type: z.literal("banner_link"),
});

const productCollectionSectionSchema = sectionBaseSchema.extend({
  settings: z
    .object({
      actions: z.array(buttonActionSchema).max(6).optional(),
      eyebrow: boundedText(80),
      largeScreenColumns: z.coerce
        .number()
        .int()
        .min(3, "Large-screen cards per row must be at least 3.")
        .max(6, "Large-screen cards per row must be 6 or fewer.")
        .default(5),
      layout: collectionLayoutSchema.default("grid"),
      productLimit: z.coerce
        .number()
        .int()
        .min(1, "Product limit must be at least 1.")
        .max(
          maxStorefrontCollectionItems,
          `Product limit must be ${maxStorefrontCollectionItems} or fewer.`,
        ),
      productSource: productSourceSchema,
      categoryScope: categoryScopeSchema.default("all"),
      selectedBrandIds: z.array(boundedText(80)).max(24).default([]),
      selectedCategoryIds: z.array(boundedText(80)).max(24).default([]),
      smallScreenColumns: z.coerce
        .number()
        .int()
        .min(1, "Small-screen cards per row must be at least 1.")
        .max(3, "Small-screen cards per row must be 3 or fewer.")
        .default(2),
      title: boundedText(120).min(1, "Product collection title is required."),
      titleSize: titleSizeSchema.default(24),
      titleTag: titleTagSchema.default("h2"),
      viewAllAction: actionSchema.optional(),
    })
    .transform(({ actions, viewAllAction, ...settings }) => ({
      ...settings,
      actions:
        actions ??
        (viewAllAction
          ? [{ ...viewAllAction, variant: "secondary" as const }]
          : []),
    })),
  type: z.literal("product_collection"),
});

const categoryCollectionSectionSchema = sectionBaseSchema.extend({
  settings: z.object({
    actions: z.array(buttonActionSchema).max(6).default([]),
    categoryImages: z
      .array(
        z.object({
          categoryId: boundedText(80).min(1),
          imageAlt: boundedText(160),
          imageUrl: storefrontMediaUrlSchema,
        }),
      )
      .max(48)
      .default([]),
    categoryLimit: z.coerce
      .number()
      .int()
      .min(1, "Category limit must be at least 1.")
      .max(
        maxStorefrontCollectionItems,
        `Category limit must be ${maxStorefrontCollectionItems} or fewer.`,
      ),
    categoryScope: categoryScopeSchema.default("all"),
    categoryVisibility: categoryVisibilitySchema.default("with_products"),
    eyebrow: boundedText(80),
    imageSource: categoryImageSourceSchema.default("first_product"),
    layout: collectionLayoutSchema.default("grid"),
    selectedCategoryIds: z.array(boundedText(80)).max(48).default([]),
    title: boundedText(120).min(1, "Category collection title is required."),
    titleSize: titleSizeSchema.default(24),
    titleTag: titleTagSchema.default("h2"),
  }),
  type: z.literal("category_collection"),
});

const brandCollectionSectionSchema = sectionBaseSchema.extend({
  settings: z.object({
    actions: z.array(buttonActionSchema).max(6).default([]),
    brandLimit: z.coerce
      .number()
      .int()
      .min(1, "Brand limit must be at least 1.")
      .max(
        maxStorefrontCollectionItems,
        `Brand limit must be ${maxStorefrontCollectionItems} or fewer.`,
      ),
    eyebrow: boundedText(80),
    layout: collectionLayoutSchema.default("grid"),
    selectedBrandIds: z.array(boundedText(80)).max(48).default([]),
    title: boundedText(120).min(1, "Brand collection title is required."),
    titleSize: titleSizeSchema.default(24),
    titleTag: titleTagSchema.default("h2"),
  }),
  type: z.literal("brand_collection"),
});

const latestBlogPostsSectionSchema = sectionBaseSchema.extend({
  settings: z.object({
    actions: z.array(buttonActionSchema).max(6).default([]),
    eyebrow: boundedText(80),
    layout: collectionLayoutSchema.default("grid"),
    postLimit: z.coerce
      .number()
      .int()
      .min(1, "Post limit must be at least 1.")
      .max(
        maxStorefrontBlogPosts,
        `Post limit must be ${maxStorefrontBlogPosts} or fewer.`,
      ),
    title: boundedText(120).min(1, "Blog section title is required."),
    titleSize: titleSizeSchema.default(24),
    titleTag: titleTagSchema.default("h2"),
  }),
  type: z.literal("latest_blog_posts"),
});

const featureGridSectionSchema = sectionBaseSchema.extend({
  settings: z.object({
    eyebrow: boundedText(90),
    features: z
      .array(
        z.object({
          icon: iconKeySchema,
          text: boundedText(180),
          title: boundedText(80).min(1),
        }),
      )
      .min(1)
      .max(8),
    title: boundedText(180).min(1, "Feature section title is required."),
    titleSize: titleSizeSchema.default(30),
    titleTag: titleTagSchema.default("h2"),
  }),
  type: z.literal("feature_grid"),
});

const storefrontSectionsSchema = z
  .array(
    z.discriminatedUnion("type", [
      heroSectionSchema,
      quickActionsSectionSchema,
      cylinderShowcaseSectionSchema,
      bannerLinkSectionSchema,
      productCollectionSectionSchema,
      categoryCollectionSectionSchema,
      brandCollectionSectionSchema,
      latestBlogPostsSectionSchema,
      featureGridSectionSchema,
    ]),
  )
  .min(0)
  .max(24, "The storefront can have up to 24 sections.");

function fallbackSections() {
  return cloneStorefrontSections(defaultStorefrontSections);
}

function getNextComponentCode(
  type: StorefrontSectionType,
  usedComponentCodes: Set<string>,
) {
  const prefix = storefrontSectionCodePrefixes[type];
  let index = 1;
  let componentCode = `${prefix}-${String(index).padStart(2, "0")}`;

  while (usedComponentCodes.has(componentCode)) {
    index += 1;
    componentCode = `${prefix}-${String(index).padStart(2, "0")}`;
  }

  usedComponentCodes.add(componentCode);

  return componentCode;
}

function normalizeSectionComponentCodes(sections: StorefrontSection[]) {
  const usedComponentCodes = new Set<string>();

  return sections.map((section) => {
    const existingComponentCode = section.componentCode?.trim().toUpperCase();
    const componentCode =
      existingComponentCode && !usedComponentCodes.has(existingComponentCode)
        ? existingComponentCode
        : getNextComponentCode(section.type, usedComponentCodes);

    usedComponentCodes.add(componentCode);

    return {
      ...section,
      componentCode,
    };
  }) as StorefrontSection[];
}

function parseStoredSections(value: unknown) {
  const parsed = storefrontSectionsSchema.safeParse(value);

  if (!parsed.success) {
    return fallbackSections();
  }

  return replaceLegacyDefaultStorefrontClaims(
    normalizeSectionComponentCodes(parsed.data as StorefrontSection[]),
  );
}

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

const storefrontValidationFieldLabels: Record<string, string> = {
  brandLimit: "Brand limit",
  categoryLimit: "Category limit",
  categoryScope: "Category scope",
  categoryVisibility: "Category visibility",
  actionLabel: "Action label",
  href: "Link destination",
  imageUrl: "Image URL",
  layout: "Layout",
  largeScreenColumns: "Large-screen cards per row",
  postLimit: "Post limit",
  productLimit: "Product limit",
  productSource: "Product source",
  selectedBrandIds: "Selected brands",
  selectedCategoryIds: "Selected categories",
  smallScreenColumns: "Small-screen cards per row",
  title: "Title",
};

function formatStorefrontValidationMessage(
  error: z.ZodError,
  value: unknown,
) {
  const issue = error.issues[0];

  if (!issue) {
    return "Check the storefront sections and try again.";
  }

  const sectionIndex = typeof issue.path[0] === "number" ? issue.path[0] : null;
  const fieldKey = String(issue.path[issue.path.length - 1] ?? "");
  const fieldLabel = storefrontValidationFieldLabels[fieldKey] ?? fieldKey;

  if (sectionIndex === null || !Array.isArray(value)) {
    return fieldLabel ? `${fieldLabel}: ${issue.message}` : issue.message;
  }

  const section = asRecord(value[sectionIndex]);
  const settings = asRecord(section?.settings);
  const sectionType =
    typeof section?.type === "string" &&
    section.type in storefrontSectionLabels
      ? (section.type as StorefrontSectionType)
      : null;
  const sectionLabel = sectionType ? storefrontSectionLabels[sectionType] : null;
  const sectionTitle =
    typeof settings?.title === "string" && settings.title.trim()
      ? settings.title.trim()
      : `Section ${sectionIndex + 1}`;
  const componentCode =
    typeof section?.componentCode === "string" && section.componentCode.trim()
      ? section.componentCode.trim()
      : null;
  const location = [sectionTitle, sectionLabel, componentCode]
    .filter(Boolean)
    .join(" · ");

  return `${location}: ${fieldLabel ? `${fieldLabel}: ` : ""}${issue.message}`;
}

export function validateStorefrontSections(value: unknown) {
  const parsed = storefrontSectionsSchema.safeParse(value);

  if (!parsed.success) {
    return {
      ok: false,
      message: formatStorefrontValidationMessage(parsed.error, value),
    } as const;
  }

  return {
    ok: true,
    sections: normalizeSectionComponentCodes(parsed.data as StorefrontSection[]),
  } as const;
}

export function getStorefrontSectionTypeOptions() {
  return [...storefrontSectionTypes];
}

export async function getStorefrontPageForAdmin(
  slug = storefrontHomePageSlug,
): Promise<StorefrontAdminPage> {
  const [page] = await db
    .select({
      draftSections: storefrontPages.draftSections,
      publishedAt: storefrontPages.publishedAt,
      publishedSections: storefrontPages.publishedSections,
      slug: storefrontPages.slug,
      title: storefrontPages.title,
      updatedAt: storefrontPages.updatedAt,
    })
    .from(storefrontPages)
    .where(eq(storefrontPages.slug, slug))
    .limit(1);

  if (!page) {
    const sections = fallbackSections();

    return {
      draftSections: sections,
      publishedAt: null,
      publishedSections: sections,
      slug,
      title: "Home page",
      updatedAt: null,
    };
  }

  return {
    ...page,
    draftSections: parseStoredSections(page.draftSections),
    publishedSections: parseStoredSections(page.publishedSections),
  };
}

export async function getPublishedStorefrontPage(
  slug = storefrontHomePageSlug,
): Promise<StorefrontPublishedPage> {
  const [page] = await db
    .select({
      publishedSections: storefrontPages.publishedSections,
      slug: storefrontPages.slug,
      title: storefrontPages.title,
    })
    .from(storefrontPages)
    .where(eq(storefrontPages.slug, slug))
    .limit(1);

  if (!page) {
    return {
      sections: fallbackSections(),
      slug,
      title: "Home page",
    };
  }

  return {
    sections: parseStoredSections(page.publishedSections),
    slug: page.slug,
    title: page.title,
  };
}

export async function saveStorefrontDraft({
  sections,
  slug = storefrontHomePageSlug,
  title = "Home page",
}: {
  sections: StorefrontSection[];
  slug?: string;
  title?: string;
}) {
  const now = new Date();

  await db
    .insert(storefrontPages)
    .values({
      draftSections: sections,
      publishedSections: fallbackSections(),
      slug,
      title,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: storefrontPages.slug,
      set: {
        draftSections: sections,
        title,
        updatedAt: now,
      },
    });
}

export async function publishStorefrontDraft({
  sections,
  slug = storefrontHomePageSlug,
  title = "Home page",
}: {
  sections: StorefrontSection[];
  slug?: string;
  title?: string;
}) {
  const now = new Date();

  await db
    .insert(storefrontPages)
    .values({
      draftSections: sections,
      publishedAt: now,
      publishedSections: sections,
      slug,
      title,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: storefrontPages.slug,
      set: {
        draftSections: sections,
        publishedAt: now,
        publishedSections: sections,
        title,
        updatedAt: now,
      },
    });
}
