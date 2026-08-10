import Link from "next/link";
import { FlameIcon } from "lucide-react";

import { MarketplaceCampaignIcon } from "@/components/marketplace/marketplace-campaign-icon";
import { cn } from "@/lib/utils";
import type { MarketplaceSaleCampaign } from "@/src/modules/marketplace/sales";
import {
  getReadableSaleCampaignForeground,
  normalizeSaleCampaignColor,
} from "@/src/modules/sales/campaign-presentation";

function getProductCountLabel(count: number) {
  return `${count} product${count === 1 ? "" : "s"}`;
}

export function MarketplaceSaleCampaignHeader({
  campaigns,
  selectedCampaign,
  totalCount,
}: {
  campaigns: readonly MarketplaceSaleCampaign[];
  selectedCampaign: MarketplaceSaleCampaign | null;
  totalCount: number;
}) {
  const backgroundColor = selectedCampaign
    ? normalizeSaleCampaignColor(selectedCampaign.badgeColor)
    : "#080808";
  const foregroundColor = selectedCampaign
    ? getReadableSaleCampaignForeground(backgroundColor)
    : "#FFFFFF";

  return (
    <section aria-labelledby="sale-campaign-heading" className="mt-3">
      <div
        className="relative overflow-hidden rounded-xl px-4 py-5 shadow-[0_12px_30px_rgba(8,8,8,0.14)] sm:rounded-2xl sm:px-7 sm:py-7"
        style={{ backgroundColor, color: foregroundColor }}
      >
        <div
          aria-hidden="true"
          className="absolute -right-8 -top-14 size-40 rounded-full border-[28px] border-current opacity-[0.08] sm:size-52"
        />
        <div className="relative flex items-start gap-3 sm:gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-current/25 bg-white/10 sm:size-12 sm:rounded-xl">
            {selectedCampaign ? (
              <MarketplaceCampaignIcon
                aria-hidden="true"
                className="size-5 sm:size-6"
                name={selectedCampaign.badgeIcon}
              />
            ) : (
              <FlameIcon
                aria-hidden="true"
                className="size-5 fill-current sm:size-6"
                strokeWidth={2.4}
              />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-75 sm:text-xs">
              {selectedCampaign?.badgeText ?? "All current offers"}
            </p>
            <h1
              className="mt-1 max-w-4xl text-[27px] font-black leading-[1.03] tracking-[-0.025em] sm:text-[42px]"
              id="sale-campaign-heading"
            >
              {selectedCampaign?.publicHeadline ?? "Current sales"}
            </h1>
            <p className="mt-2 max-w-2xl text-xs font-semibold leading-5 opacity-80 sm:text-sm sm:leading-6">
              {selectedCampaign
                ? `${getProductCountLabel(totalCount)} from this campaign. Prices shown already include the campaign discount.`
                : `${getProductCountLabel(totalCount)} currently discounted across Jurgens Energy.`}
            </p>
          </div>
        </div>
      </div>

      {campaigns.length > 0 ? (
        <nav
          aria-label="Choose a sale campaign"
          className="-mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0"
        >
          <Link
            aria-current={selectedCampaign ? undefined : "page"}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-black uppercase tracking-[0.06em] transition",
              selectedCampaign
                ? "border-[#d8d8d1] bg-white text-[#30302d] hover:border-[#ff5a1f] hover:text-[#ff5a1f] dark:border-white/15 dark:bg-white/[0.04] dark:text-[#e8e8e2]"
                : "border-[#080808] bg-[#080808] text-white dark:border-white dark:bg-white dark:text-[#080808]",
            )}
            href="/sale"
            prefetch={false}
          >
            <FlameIcon aria-hidden="true" className="size-3.5 fill-current" />
            All sales
          </Link>
          {campaigns.map((campaign) => {
            const isSelected = campaign.id === selectedCampaign?.id;
            const campaignColor = normalizeSaleCampaignColor(campaign.badgeColor);
            const campaignForeground =
              getReadableSaleCampaignForeground(campaignColor);

            return (
              <Link
                aria-current={isSelected ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-black transition",
                  !isSelected &&
                    "border-[#d8d8d1] bg-white text-[#30302d] hover:border-[#aaa9a1] dark:border-white/15 dark:bg-white/[0.04] dark:text-[#e8e8e2]",
                )}
                href={campaign.href}
                key={campaign.id}
                prefetch={false}
                style={
                  isSelected
                    ? {
                        backgroundColor: campaignColor,
                        borderColor: campaignColor,
                        color: campaignForeground,
                      }
                    : undefined
                }
              >
                <MarketplaceCampaignIcon
                  aria-hidden="true"
                  className="size-3.5"
                  name={campaign.badgeIcon}
                  style={isSelected ? undefined : { color: campaignColor }}
                />
                <span>{campaign.name}</span>
                <span className="opacity-60">· {campaign.productCount}</span>
              </Link>
            );
          })}
        </nav>
      ) : null}
    </section>
  );
}
