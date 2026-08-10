import type { CSSProperties, HTMLAttributes } from "react";

import { cn } from "@/lib/utils";
import { lucideCampaignIconVersion } from "@/src/generated/lucide-campaign-icon-version";

type MarketplaceCampaignIconProps = Omit<
  HTMLAttributes<HTMLSpanElement>,
  "children"
> & {
  name?: string | null;
};

function getCampaignIconName(value: string | null | undefined) {
  return value && /^[a-z0-9-]+$/.test(value) ? value : "flame";
}

export function MarketplaceCampaignIcon({
  className,
  name,
  style,
  ...props
}: MarketplaceCampaignIconProps) {
  const iconName = getCampaignIconName(name);
  const maskUrl = `/generated/lucide/v${lucideCampaignIconVersion}/${iconName}.svg`;
  const iconStyle = {
    ...style,
    WebkitMaskImage: `url("${maskUrl}")`,
    WebkitMaskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
    backgroundColor: "currentColor",
    maskImage: `url("${maskUrl}")`,
    maskPosition: "center",
    maskRepeat: "no-repeat",
    maskSize: "contain",
  } as CSSProperties;

  return (
    <span
      aria-hidden="true"
      className={cn("inline-block shrink-0", className)}
      style={iconStyle}
      {...props}
    />
  );
}
