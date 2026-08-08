"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangleIcon,
  BadgePercentIcon,
  Loader2Icon,
  RotateCcwIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";

import {
  DashboardButton,
  DashboardInput,
  dashboardPanelClass,
} from "@/components/dashboard/dashboard-controls";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type {
  AdminSaleCampaign,
  AdminSaleVariant,
  AdminSalesData,
  SaleActionResult,
} from "@/src/modules/admin/sales";

import {
  createSaleCampaignAction,
  deleteSaleCampaignAction,
  endSaleCampaignAction,
} from "./actions";

function formatMoney(value: number | string | null) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("en-ZA", {
    currency: "ZAR",
    style: "currency",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function getSalePrice(price: string, discountPercent: number) {
  const amount = Number(price);

  if (!Number.isFinite(amount)) {
    return null;
  }

  return Math.max(0.01, Math.round(amount * 100 * (1 - discountPercent / 100)) / 100);
}

function getVariantLabel(variant: AdminSaleVariant) {
  return variant.productTitle === variant.title
    ? variant.productTitle
    : `${variant.productTitle} — ${variant.title}`;
}

function getVariantSearchText(variant: AdminSaleVariant) {
  return [
    variant.productTitle,
    variant.title,
    variant.sku,
    variant.productSlug,
  ]
    .join(" ")
    .toLowerCase();
}

function StatusMessage({ result }: { result: SaleActionResult | null }) {
  if (!result?.message) {
    return null;
  }

  return (
    <p
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        result.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-700",
      )}
    >
      {result.message}
    </p>
  );
}

function CampaignCard({
  campaign,
  onDelete,
  onEnd,
  pending,
}: {
  campaign: AdminSaleCampaign;
  onDelete: (campaignId: string) => void;
  onEnd: (campaignId: string) => void;
  pending: boolean;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#151719]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-zinc-950 dark:text-white">
              {campaign.name}
            </h3>
            <Badge className="bg-[#ff5a1f] text-white">{campaign.badgeText}</Badge>
            <Badge variant="secondary">{Number(campaign.discountPercent)}% off</Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            {campaign.variants.length} variant
            {campaign.variants.length === 1 ? "" : "s"} on sale
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <DashboardButton
            disabled={pending}
            onClick={() => onEnd(campaign.id)}
            type="button"
          >
            <RotateCcwIcon className="size-3.5" />
            End & restore
          </DashboardButton>
          <DashboardButton
            className="border-red-200 text-red-700 hover:bg-red-50"
            disabled={pending}
            onClick={() => onDelete(campaign.id)}
            type="button"
          >
            <Trash2Icon className="size-3.5" />
            Delete
          </DashboardButton>
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {campaign.variants.map((variant) => (
          <div
            className="flex flex-col gap-1 rounded-md bg-slate-50 px-3 py-2 text-sm dark:bg-white/[0.04] md:flex-row md:items-center md:justify-between"
            key={`${campaign.id}-${variant.variantId}`}
          >
            <div className="min-w-0">
              <Link
                className="font-semibold text-zinc-950 hover:text-[#ff5a1f] dark:text-white"
                href={`/products/${variant.productSlug}`}
              >
                {variant.productTitle}
              </Link>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {variant.title} · SKU {variant.sku}
              </p>
            </div>
            <p className="text-sm font-semibold text-zinc-950 dark:text-white">
              {formatMoney(variant.originalPrice)} → {formatMoney(variant.salePrice)}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}

export function AdminSaleManager({ data }: { data: AdminSalesData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SaleActionResult | null>(null);
  const [name, setName] = useState("");
  const [badgeText, setBadgeText] = useState("Sale");
  const [discountPercent, setDiscountPercent] = useState("10");
  const [query, setQuery] = useState("");
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);

  const variants = useMemo(
    () =>
      data.products.flatMap((product) =>
        product.variants.map((variant) => ({
          ...variant,
          brandName: product.brandName,
          categoryPath: product.categoryPath,
        })),
      ),
    [data.products],
  );
  const selectedVariants = variants.filter((variant) =>
    selectedVariantIds.includes(variant.id),
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredVariants = variants
    .filter((variant) =>
      normalizedQuery ? getVariantSearchText(variant).includes(normalizedQuery) : true,
    )
    .slice(0, 80);
  const numericDiscount = Number(discountPercent);

  function toggleVariant(variant: AdminSaleVariant, checked: boolean) {
    if (!variant.selectable) {
      return;
    }

    setSelectedVariantIds((current) =>
      checked
        ? Array.from(new Set([...current, variant.id]))
        : current.filter((id) => id !== variant.id),
    );
  }

  function createSale() {
    if (!data.salesAvailable) {
      return;
    }

    startTransition(async () => {
      const response = await createSaleCampaignAction({
        badgeText,
        discountPercent: numericDiscount,
        name,
        variantIds: selectedVariantIds,
      });

      setResult(response);

      if (response.ok) {
        setName("");
        setBadgeText("Sale");
        setDiscountPercent("10");
        setSelectedVariantIds([]);
        router.refresh();
      }
    });
  }

  function endSale(campaignId: string) {
    startTransition(async () => {
      const response = await endSaleCampaignAction({ campaignId });
      setResult(response);
      router.refresh();
    });
  }

  function deleteSale(campaignId: string) {
    const shouldDelete = window.confirm(
      "Delete this sale campaign? Active sale prices will be restored first.",
    );

    if (!shouldDelete) {
      return;
    }

    startTransition(async () => {
      const response = await deleteSaleCampaignAction({ campaignId });
      setResult(response);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4">
      <StatusMessage result={result} />

      {!data.salesAvailable ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <AlertTriangleIcon className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-sm font-bold">Sales management is unavailable</p>
            <p className="mt-1 text-sm">
              {data.salesUnavailableMessage ??
                "The sales campaign storage could not be loaded."}
            </p>
          </div>
        </div>
      ) : null}

      <section className={cn(dashboardPanelClass, "grid gap-4 p-4")}>
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#ff5a1f]/10 text-[#ff5a1f]">
            <BadgePercentIcon className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-zinc-950 dark:text-white">
              Create sale
            </h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Select exact variants, set one discount, and the existing price fields
              are updated. Ending or deleting the sale restores the saved original
              prices.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-sm font-semibold">
            Sale name
            <DashboardInput
              onChange={(event) => setName(event.target.value)}
              placeholder="August promo"
              value={name}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Sale badge text
            <DashboardInput
              maxLength={80}
              onChange={(event) => setBadgeText(event.target.value)}
              placeholder="Sale"
              value={badgeText}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Discount percentage
            <DashboardInput
              max="95"
              min="1"
              onChange={(event) => setDiscountPercent(event.target.value)}
              type="number"
              value={discountPercent}
            />
          </label>
        </div>

        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <DashboardInput
            className="pl-9"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products, SKUs, variants..."
            value={query}
          />
        </div>

        <div className="max-h-[520px] overflow-y-auto rounded-lg border border-slate-200 dark:border-white/10">
          {filteredVariants.map((variant) => {
            const checked = selectedVariantIds.includes(variant.id);
            const salePrice = getSalePrice(variant.price, numericDiscount);

            return (
              <label
                className={cn(
                  "grid cursor-pointer grid-cols-[auto_1fr] gap-3 border-b border-slate-100 p-3 last:border-b-0 dark:border-white/10",
                  !variant.selectable && "cursor-not-allowed opacity-55",
                )}
                key={variant.id}
              >
                <Checkbox
                  checked={checked}
                  disabled={!variant.selectable || isPending}
                  onCheckedChange={(value) => toggleVariant(variant, value === true)}
                />
                <span className="grid min-w-0 gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-zinc-950 dark:text-white">
                      {getVariantLabel(variant)}
                    </span>
                    <Badge variant="secondary">SKU {variant.sku}</Badge>
                    {variant.activeCampaignName ? (
                      <Badge className="bg-[#ff5a1f] text-white">
                        {variant.activeCampaignName}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-zinc-400">
                    {variant.brandName ?? "No brand"} · {variant.categoryPath ?? "No category"}
                  </span>
                  <span className="text-sm text-zinc-900 dark:text-zinc-100">
                    {formatMoney(variant.price)}
                    {salePrice ? ` → ${formatMoney(salePrice)}` : ""}
                    {variant.costPrice
                      ? ` · cost ${formatMoney(variant.costPrice)}`
                      : ""}
                  </span>
                  {variant.unavailableReason ? (
                    <span className="text-xs font-semibold text-red-600">
                      {variant.unavailableReason}
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 dark:bg-white/[0.04] md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-600 dark:text-zinc-300">
            {selectedVariants.length} variant
            {selectedVariants.length === 1 ? "" : "s"} selected
          </p>
          <DashboardButton
            className="border-[#ff5a1f] bg-[#ff5a1f] text-white hover:bg-[#e84d18]"
            disabled={
              isPending ||
              !data.salesAvailable ||
              selectedVariantIds.length === 0 ||
              !name.trim() ||
              !badgeText.trim() ||
              !Number.isFinite(numericDiscount)
            }
            onClick={createSale}
            type="button"
          >
            {isPending ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
            Create sale
          </DashboardButton>
        </div>
      </section>

      <section className={cn(dashboardPanelClass, "grid gap-3 p-4")}>
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-zinc-950 dark:text-white">
              Active sale campaigns
            </h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Public sale page:{" "}
              <Link className="font-semibold text-[#ff5a1f]" href="/sale">
                /sale
              </Link>
            </p>
          </div>
        </div>
        {data.activeCampaigns.length > 0 ? (
          <div className="grid gap-3">
            {data.activeCampaigns.map((campaign) => (
              <CampaignCard
                campaign={campaign}
                key={campaign.id}
                onDelete={deleteSale}
                onEnd={endSale}
                pending={isPending || !data.salesAvailable}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-white/10 dark:text-zinc-400">
            No active sale campaigns.
          </p>
        )}
      </section>
    </div>
  );
}
