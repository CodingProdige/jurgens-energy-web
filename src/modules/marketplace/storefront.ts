import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import { storefrontPages } from "@/src/db/schema";
import {
  cloneStorefrontSections,
  defaultStorefrontSections,
  storefrontActionVariants,
  storefrontCategoryImageSources,
  storefrontCategoryVisibilityOptions,
  storefrontCollectionLayouts,
  storefrontSectionCodePrefixes,
  storefrontSectionTypes,
  storefrontTitleTags,
  type StorefrontSection,
  type StorefrontSectionType,
} from "@/src/modules/marketplace/storefront-types";

export const storefrontHomePageSlug = "home";

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

const actionSchema = z.object({
  href: storefrontHrefSchema,
  label: boundedText(80).min(1, "Section links need a label."),
});

const buttonActionSchema = actionSchema.extend({
  variant: z.enum(storefrontActionVariants).default("primary"),
});

const titleTagSchema = z.enum(storefrontTitleTags);
const titleSizeSchema = z.coerce.number().int().min(16).max(86);

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
const categoryVisibilitySchema = z.enum(storefrontCategoryVisibilityOptions);
const categoryImageSourceSchema = z.enum(storefrontCategoryImageSources);

const sectionBaseSchema = z.object({
  componentCode: boundedText(48).optional(),
  enabled: z.coerce.boolean(),
  id: boundedText(80).min(1, "Every section needs an id."),
});

const heroSectionSchema = sectionBaseSchema.extend({
  settings: z
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
          ...settings,
          actions: actions ?? legacyActions,
        };
      },
    ),
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

const productCollectionSectionSchema = sectionBaseSchema.extend({
  settings: z
    .object({
      actions: z.array(buttonActionSchema).max(6).optional(),
      eyebrow: boundedText(80),
      layout: collectionLayoutSchema.default("grid"),
      productLimit: z.coerce.number().int().min(1).max(12),
      productSource: productSourceSchema,
      selectedBrandIds: z.array(boundedText(80)).max(24).default([]),
      selectedCategoryIds: z.array(boundedText(80)).max(24).default([]),
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
    categoryLimit: z.coerce.number().int().min(1).max(24),
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
    brandLimit: z.coerce.number().int().min(1).max(24),
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
    postLimit: z.coerce.number().int().min(1).max(12),
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

  return normalizeSectionComponentCodes(parsed.data as StorefrontSection[]);
}

export function validateStorefrontSections(value: unknown) {
  const parsed = storefrontSectionsSchema.safeParse(value);

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ??
        "Check the storefront sections and try again.",
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
