import { asc, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { marketplaceSettings, subscriptionPlans } from "@/src/db/schema";
import { decryptSecret } from "@/src/modules/security/secrets";

type StripeMode = "live" | "sandbox";
type BillingInterval = "month" | "year";
type PlanStatus = "active" | "hidden" | "archived";
type SubscriptionScope = "user" | "seller";

export type AdminPremiumPlan = {
  billingInterval: BillingInterval;
  code: string;
  currency: string;
  description: string;
  featureBullets: string[];
  id: string;
  isDefault: boolean;
  isHighlighted: boolean;
  name: string;
  priceCents: number;
  scope: SubscriptionScope;
  sortOrder: number;
  status: PlanStatus;
  storageQuotaMb: number;
  stripeLivePriceId: string | null;
  stripeSandboxPriceId: string | null;
  stripeSyncError: string | null;
  stripeSyncedAt: Date | null;
};

export type SavePremiumPlanInput = {
  billingInterval: BillingInterval;
  code: string;
  currency: string;
  description?: string;
  featureBullets: string[];
  id?: string;
  isDefault: boolean;
  isHighlighted: boolean;
  name: string;
  priceCents: number;
  scope: SubscriptionScope;
  sortOrder: number;
  status: PlanStatus;
  storageQuotaMb: number;
};

const stripeApiBase = "https://api.stripe.com/v1";

export async function getAdminPremiumPlans(): Promise<AdminPremiumPlan[]> {
  const rows = await db
    .select({
      billingInterval: subscriptionPlans.billingInterval,
      code: subscriptionPlans.code,
      currency: subscriptionPlans.currency,
      description: subscriptionPlans.description,
      featureBullets: subscriptionPlans.featureBullets,
      id: subscriptionPlans.id,
      isDefault: subscriptionPlans.isDefault,
      isHighlighted: subscriptionPlans.isHighlighted,
      name: subscriptionPlans.name,
      priceCents: subscriptionPlans.priceCents,
      scope: subscriptionPlans.scope,
      sortOrder: subscriptionPlans.sortOrder,
      status: subscriptionPlans.status,
      storageQuotaMb: subscriptionPlans.storageQuotaMb,
      stripeLivePriceId: subscriptionPlans.stripeLivePriceId,
      stripeSandboxPriceId: subscriptionPlans.stripeSandboxPriceId,
      stripeSyncError: subscriptionPlans.stripeSyncError,
      stripeSyncedAt: subscriptionPlans.stripeSyncedAt,
    })
    .from(subscriptionPlans)
    .orderBy(asc(subscriptionPlans.sortOrder), asc(subscriptionPlans.name));

  return rows.map((row) => ({
    ...row,
    billingInterval: normalizeBillingInterval(row.billingInterval),
    currency: row.currency.toUpperCase(),
    description: row.description ?? "",
    featureBullets: splitFeatureBullets(row.featureBullets),
    scope: row.scope,
    status: normalizePlanStatus(row.status),
  }));
}

export async function savePremiumPlan(input: SavePremiumPlanInput) {
  const existing = input.id
    ? await getExistingPlan(input.id)
    : await getPlanByCode(input.code);
  const now = new Date();
  const syncResult = await syncPlanWithStripe(input, existing);

  if (existing) {
    await db
      .update(subscriptionPlans)
      .set({
        billingInterval: input.billingInterval,
        code: input.code,
        currency: input.currency.toUpperCase(),
        description: input.description || null,
        featureBullets: input.featureBullets.join("\n"),
        isDefault: input.isDefault,
        isHighlighted: input.isHighlighted,
        name: input.name,
        priceCents: input.priceCents,
        scope: input.scope,
        sortOrder: input.sortOrder,
        status: input.status,
        storageQuotaMb: input.storageQuotaMb,
        stripeLivePriceId:
          syncResult.mode === "live"
            ? syncResult.priceId
            : existing.stripeLivePriceId,
        stripeLiveProductId:
          syncResult.mode === "live"
            ? syncResult.productId
            : existing.stripeLiveProductId,
        stripeSandboxPriceId:
          syncResult.mode === "sandbox"
            ? syncResult.priceId
            : existing.stripeSandboxPriceId,
        stripeSandboxProductId:
          syncResult.mode === "sandbox"
            ? syncResult.productId
            : existing.stripeSandboxProductId,
        stripeSyncError: syncResult.error,
        stripeSyncedAt: syncResult.ok ? now : existing.stripeSyncedAt,
        updatedAt: now,
      })
      .where(eq(subscriptionPlans.id, existing.id));
  } else {
    await db.insert(subscriptionPlans).values({
      billingInterval: input.billingInterval,
      code: input.code,
      currency: input.currency.toUpperCase(),
      description: input.description || null,
      featureBullets: input.featureBullets.join("\n"),
      isDefault: input.isDefault,
      isHighlighted: input.isHighlighted,
      name: input.name,
      priceCents: input.priceCents,
      scope: input.scope,
      sortOrder: input.sortOrder,
      status: input.status,
      storageQuotaMb: input.storageQuotaMb,
      stripeLivePriceId: syncResult.mode === "live" ? syncResult.priceId : null,
      stripeLiveProductId:
        syncResult.mode === "live" ? syncResult.productId : null,
      stripeSandboxPriceId:
        syncResult.mode === "sandbox" ? syncResult.priceId : null,
      stripeSandboxProductId:
        syncResult.mode === "sandbox" ? syncResult.productId : null,
      stripeSyncError: syncResult.error,
      stripeSyncedAt: syncResult.ok ? now : null,
      updatedAt: now,
    });
  }

  if (input.isDefault) {
    const saved = await getPlanByCode(input.code);

    if (saved) {
      await db
        .update(subscriptionPlans)
        .set({ isDefault: false, updatedAt: now })
        .where(eq(subscriptionPlans.scope, input.scope));
      await db
        .update(subscriptionPlans)
        .set({ isDefault: true, updatedAt: now })
        .where(eq(subscriptionPlans.id, saved.id));
    }
  }

  return {
    ok: syncResult.ok,
    message: syncResult.ok
      ? "Premium plan saved and synced with Stripe."
      : `Premium plan saved locally. ${syncResult.error}`,
  };
}

async function syncPlanWithStripe(
  input: SavePremiumPlanInput,
  existing: ExistingPlan | null,
) {
  const stripeConfig = await getStripeConfig();

  if (!stripeConfig.secretKey) {
    return {
      error: `Stripe ${stripeConfig.mode} secret key is not configured.`,
      mode: stripeConfig.mode,
      ok: false,
      priceId: null,
      productId: null,
    };
  }

  try {
    const currentProductId =
      stripeConfig.mode === "live"
        ? existing?.stripeLiveProductId
        : existing?.stripeSandboxProductId;
    const currentPriceId =
      stripeConfig.mode === "live"
        ? existing?.stripeLivePriceId
        : existing?.stripeSandboxPriceId;
    const productId = await upsertStripeProduct({
      code: input.code,
      description: input.description,
      mode: stripeConfig.mode,
      name: input.name,
      productId: currentProductId,
      secretKey: stripeConfig.secretKey,
    });
    const priceChanged =
      !existing ||
      existing.priceCents !== input.priceCents ||
      existing.currency.toUpperCase() !== input.currency.toUpperCase() ||
      normalizeBillingInterval(existing.billingInterval) !==
        input.billingInterval;
    const priceId =
      currentPriceId && !priceChanged
        ? currentPriceId
        : await createStripePrice({
            billingInterval: input.billingInterval,
            currency: input.currency,
            oldPriceId: currentPriceId,
            priceCents: input.priceCents,
            productId,
            secretKey: stripeConfig.secretKey,
          });

    return {
      error: null,
      mode: stripeConfig.mode,
      ok: true,
      priceId,
      productId,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Stripe sync failed.",
      mode: stripeConfig.mode,
      ok: false,
      priceId:
        stripeConfig.mode === "live"
          ? (existing?.stripeLivePriceId ?? null)
          : (existing?.stripeSandboxPriceId ?? null),
      productId:
        stripeConfig.mode === "live"
          ? (existing?.stripeLiveProductId ?? null)
          : (existing?.stripeSandboxProductId ?? null),
    };
  }
}

async function getStripeConfig(): Promise<{
  mode: StripeMode;
  secretKey: string | null;
}> {
  const [settings] = await db
    .select({
      mode: marketplaceSettings.stripeMode,
      liveSecret: marketplaceSettings.stripeLiveSecretKeyEncrypted,
      sandboxSecret: marketplaceSettings.stripeSandboxSecretKeyEncrypted,
    })
    .from(marketplaceSettings)
    .where(eq(marketplaceSettings.id, 1))
    .limit(1);
  const mode = settings?.mode === "live" ? "live" : "sandbox";
  const encryptedSecret =
    mode === "live" ? settings?.liveSecret : settings?.sandboxSecret;

  return {
    mode,
    secretKey: encryptedSecret ? decryptSecret(encryptedSecret) : null,
  };
}

async function upsertStripeProduct({
  code,
  description,
  mode,
  name,
  productId,
  secretKey,
}: {
  code: string;
  description?: string;
  mode: StripeMode;
  name: string;
  productId?: string | null;
  secretKey: string;
}) {
  const body = new URLSearchParams();
  body.set("name", name);
  body.set("metadata[piessang_code]", code);
  body.set("metadata[piessang_mode]", mode);

  if (description) {
    body.set("description", description);
  }

  if (productId) {
    const product = await stripeRequest<StripeProduct>(
      `/products/${productId}`,
      secretKey,
      body,
    );
    return product.id;
  }

  const product = await stripeRequest<StripeProduct>(
    "/products",
    secretKey,
    body,
  );
  return product.id;
}

async function createStripePrice({
  billingInterval,
  currency,
  oldPriceId,
  priceCents,
  productId,
  secretKey,
}: {
  billingInterval: BillingInterval;
  currency: string;
  oldPriceId?: string | null;
  priceCents: number;
  productId: string;
  secretKey: string;
}) {
  if (oldPriceId) {
    const body = new URLSearchParams();
    body.set("active", "false");
    await stripeRequest(`/prices/${oldPriceId}`, secretKey, body);
  }

  const body = new URLSearchParams();
  body.set("currency", currency.toLowerCase());
  body.set("product", productId);
  body.set("recurring[interval]", billingInterval);
  body.set("unit_amount", String(priceCents));

  const price = await stripeRequest<StripePrice>("/prices", secretKey, body);
  return price.id;
}

async function stripeRequest<T extends object>(
  path: string,
  secretKey: string,
  body: URLSearchParams,
) {
  const response = await fetch(`${stripeApiBase}${path}`, {
    body,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
  const data = (await response.json()) as StripeError | T;

  if (!response.ok) {
    const message =
      "error" in data
        ? data.error.message
        : `Stripe request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return data as T;
}

type StripeProduct = {
  id: string;
};

type StripePrice = {
  id: string;
};

type StripeError = {
  error: {
    message: string;
  };
};

type ExistingPlan = Awaited<ReturnType<typeof getExistingPlan>>;

async function getExistingPlan(id: string) {
  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, id))
    .limit(1);

  return plan ?? null;
}

async function getPlanByCode(code: string) {
  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.code, code))
    .limit(1);

  return plan ?? null;
}

function normalizeBillingInterval(value: string): BillingInterval {
  return value === "year" ? "year" : "month";
}

function normalizePlanStatus(value: string): PlanStatus {
  if (value === "hidden" || value === "archived") {
    return value;
  }

  return "active";
}

function splitFeatureBullets(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
